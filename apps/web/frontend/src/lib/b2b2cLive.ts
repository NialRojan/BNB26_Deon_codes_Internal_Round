// Live (Sepolia + backend) implementation of the B2B2C store. Same shape as the mock store so the
// law-firm / client / guardian / heir screens work unchanged; every action does the real thing.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { keccak256, parseEther, stringToHex, type Address } from 'viem'
import type { AssetRecord, ClientVault, GuardianItem, HeirItem, LawFirmInfo, VaultStatus } from '../data/mockData'
import {
  ETH,
  ZERO,
  createVaultOnChain,
  explainError,
  readHasAttested,
  readVault,
  readVaultsByCreator,
  sendEth,
  signAttestation,
  writeVault,
  type OnChainVault,
  type VaultConfig,
} from './chain'
import {
  firmSignIn,
  firmSignOut,
  getFirmToken,
  getMyFirm,
  getOnboarding,
  listFirmClients,
  listVaultsFor,
  registerClientVault,
  registerFirm,
  relayAttestation,
  reviewCertificate,
  saveAssets,
  submitCertificate,
  type ClientRecord,
  type FirmRecord,
} from './b2bApi'
import type { Role } from './b2b2cStore'
import type { Chain } from './vault'
import { buildVaultConfig, emptyRules, validatePlan, type VaultRules } from './vaultPlan'

type Log = { id: string; time: string; text: string; actor: string; tone: 'ok' | 'warn' | 'risk' }
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
const lc = (a?: string) => (a ?? '').toLowerCase()

function ago(ms: number) {
  if (!ms) return '—'
  const m = Math.round((Date.now() - ms) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}

/** Contract state -> the dashboard's richer status vocabulary. */
function statusOf(v: OnChainVault): VaultStatus {
  if (v.state === 3) return 'EXECUTED'
  if (v.state === 2) return Date.now() > v.vetoEndTime ? 'READY FOR EXECUTION' : 'VETO WINDOW'
  if (v.state === 1) return v.currentSignatures > 0 ? 'RECOVERY PENDING' : 'WATCH'
  return 'ACTIVE'
}

function detailOf(v: OnChainVault, cert: ClientRecord['certificate'] | undefined): string {
  if (v.state === 3) return `Digital will executed ${ago(v.executedAt)} · heirs can claim`
  if (v.state === 2)
    return Date.now() > v.vetoEndTime
      ? 'Veto window over · ready for execution'
      : `${v.currentSignatures} of ${v.requiredSignatures} guardians confirmed · client veto window open`
  if (cert?.status === 'Pending') return `Death certificate submitted by ${cert.uploadedBy} · awaiting lawyer review`
  if (v.state === 1) return v.currentSignatures > 0 ? `${v.currentSignatures} of ${v.requiredSignatures} guardian confirmations` : 'Client inactive past threshold · monitoring'
  return `Normal · last proof of life ${ago(v.lastHeartbeat)}`
}

/** Merge the firm's human record (names) with the on-chain truth (state, votes, balance). */
function toClientVault(addr: Address, rec: ClientRecord | undefined, v: OnChainVault | undefined, attested: Record<string, boolean>): ClientVault {
  const heirs: HeirItem[] = (rec?.heirs ?? v?.beneficiaries.map((b) => ({ name: short(b.wallet), wallet: b.wallet, percentage: b.bps / 100, relationship: 'Beneficiary', contact: '' })) ?? []).map((h, i) => ({
    id: `h-${i}`,
    name: h.name,
    contact: h.contact ?? '',
    wallet: h.wallet,
    percentage: h.percentage,
    relationship: h.relationship,
  }))
  const guardians: GuardianItem[] = (rec?.guardians ?? v?.guardians.map((g) => ({ name: short(g), wallet: g, role: 'Guardian', contact: '' })) ?? []).map((g, i) => ({
    id: `g-${i}`,
    name: g.name,
    contact: g.contact ?? '',
    role: g.role,
    wallet: g.wallet,
    hasAttested: !!attested[lc(g.wallet)],
  }))
  const balance: AssetRecord = {
    id: 'onchain-eth',
    category: 'Crypto',
    name: 'Vault ETH balance (on-chain)',
    detail: v ? `Held by the vault contract ${short(addr)}` : 'Reading from Sepolia…',
    valueOrSize: v ? `${(Number(v.ethBalance) / 1e18).toFixed(4)} ETH` : '…',
  }
  const cert = rec?.certificate
  return {
    id: lc(addr),
    clientName: rec?.clientName ?? `Vault ${short(addr)}`,
    clientEmail: rec?.clientEmail ?? '',
    clientWallet: rec?.clientWallet ?? v?.owner ?? '',
    vaultAddress: addr,
    status: v ? statusOf(v) : 'ACTIVE',
    heirs,
    guardians,
    requiredApprovals: v?.requiredSignatures ?? guardians.length,
    executor: rec?.executorLabel ?? (v?.executor && v.executor !== ZERO ? short(v.executor) : '—'),
    // 2 significant digits keeps short demo timers readable (e.g. 120 s -> 0.0014 days)
    inactivityDays: v ? Number((v.inactivityThreshold / 86400).toPrecision(2)) : 0,
    vetoHours: v ? Number((v.vetoGracePeriod / 3600).toPrecision(2)) : 0,
    lastCheckIn: v ? ago(v.lastHeartbeat) : '…',
    recoveryStatusDetail: v ? detailOf(v, cert) : 'Reading from Sepolia…',
    deathCertificateStatus: cert?.status ?? 'None',
    deathCertificateUrl: cert?.fileName ?? undefined,
    deathCertUploadedBy: cert?.uploadedBy ?? undefined,
    deathCertUploadedAt: cert?.uploadedAt ? ago(Date.parse(cert.uploadedAt)) : undefined,
    guardianAttestationsCount: v?.currentSignatures ?? 0,
    vetoTimeRemainingHours: v && v.state === 2 ? Math.max(0, (v.vetoEndTime - Date.now()) / 3600e3) : undefined,
    assets: [balance, ...((rec?.assets ?? []) as unknown as AssetRecord[])],
  }
}

export function useLiveB2B(chain: Chain, role: Role, enabled: boolean) {
  const [firm, setFirm] = useState<FirmRecord | null>(null)
  const [firmSignedIn, setFirmSignedIn] = useState<boolean>(!!getFirmToken())
  const [fetchedRecords, setRecords] = useState<ClientRecord[]>([])
  // Records opened via an onboarding link (kept even before the client connects a wallet)
  const [linkRecords, setLinkRecords] = useState<ClientRecord[]>([])
  const records = useMemo(() => {
    const m = new Map<string, ClientRecord>()
    for (const r of [...linkRecords, ...fetchedRecords]) m.set(lc(r.vaultAddress), r)
    return [...m.values()]
  }, [linkRecords, fetchedRecords])
  const [onChain, setOnChain] = useState<Record<string, OnChainVault>>({})
  const [attested, setAttested] = useState<Record<string, Record<string, boolean>>>({})
  const [activeVaultId, setActiveVaultIdState] = useState<string>(lc(chain.vaultAddress))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setErrorState] = useState<string | null>(null)
  const errorRef = useRef<string | null>(null)
  const setError = (e: string | null) => {
    errorRef.current = e
    setErrorState(e)
  }
  const [auditLogs, setAuditLogs] = useState<Log[]>([])
  const recordsRef = useRef(records)
  recordsRef.current = records

  const addAuditLog = useCallback((text: string, actor: string, tone: Log['tone'] = 'ok') => {
    setAuditLogs((l) => [{ id: `${Date.now()}-${Math.random()}`, time: 'Just now', text, actor, tone }, ...l].slice(0, 40))
  }, [])

  // ---- records: the firm's clients (lawyer) or vaults this wallet is part of (client/guardian/heir)
  const loadRecords = useCallback(async () => {
    try {
      if (role === 'lawyer') {
        if (!getFirmToken()) return setRecords([])
        setFirm(await getMyFirm())
        setRecords(await listFirmClients())
      } else if (chain.account) {
        setRecords(await listVaultsFor(chain.account))
      } else {
        setRecords([])
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }, [role, chain.account])

  useEffect(() => {
    if (!enabled) return
    loadRecords()
    const t = setInterval(loadRecords, 15000)
    return () => clearInterval(t)
  }, [loadRecords, firmSignedIn, enabled])

  // Vault addresses to show: records + the vault the app is pointed at (so demo vaults always appear).
  const addresses = useMemo(() => {
    const set = new Map<string, Address>()
    for (const r of records) set.set(lc(r.vaultAddress), r.vaultAddress)
    // A wallet with no vaults of its own still sees the app's default (demo) vault. Otherwise it would show up as an
    // extra unnamed "Vault 0x…" card next to the wallet's real vaults. A law firm sees only its own clients.
    if (role !== 'lawyer' && !records.length) set.set(lc(chain.vaultAddress), chain.vaultAddress)
    return [...set.values()]
  }, [records, chain.vaultAddress, role])

  // Point the app (header role, demo controls, claims) at one of this wallet's own vaults once they load.
  useEffect(() => {
    if (!enabled || role === 'lawyer' || !records.length) return
    if (records.some((r) => lc(r.vaultAddress) === lc(chain.vaultAddress))) return
    setActiveVaultIdState(lc(records[0].vaultAddress))
    chain.selectVault(records[0].vaultAddress)
  }, [enabled, role, records, chain])

  // ---- on-chain state for every listed vault
  const loadChain = useCallback(async () => {
    const entries = await Promise.all(
      addresses.map(async (a) => {
        try {
          const v = await readVault(a)
          const flags = await Promise.all(v.guardians.map(async (g) => [lc(g), await readHasAttested(g, a)] as const))
          return [lc(a), v, Object.fromEntries(flags)] as const
        } catch {
          return null
        }
      }),
    )
    const vs: Record<string, OnChainVault> = {}
    const at: Record<string, Record<string, boolean>> = {}
    for (const e of entries) if (e) ((vs[e[0]] = e[1]), (at[e[0]] = e[2]))
    setOnChain(vs)
    setAttested(at)
  }, [addresses])

  useEffect(() => {
    if (!enabled) return
    loadChain()
    const t = setInterval(loadChain, 8000)
    return () => clearInterval(t)
  }, [loadChain, enabled])

  const vaults: ClientVault[] = useMemo(
    () => addresses.map((a) => toClientVault(a, records.find((r) => lc(r.vaultAddress) === lc(a)), onChain[lc(a)], attested[lc(a)] ?? {})),
    [addresses, records, onChain, attested],
  )
  const activeVault = vaults.find((v) => v.id === activeVaultId) ?? vaults[0]

  const setActiveVaultId = (id: string) => {
    setActiveVaultIdState(id)
    const v = vaults.find((x) => x.id === id)
    if (v) chain.selectVault(v.vaultAddress as Address)
  }

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label)
    setError(null)
    try {
      const msg = await fn()
      if (msg) addAuditLog(msg, label)
      await Promise.all([loadRecords(), loadChain()])
    } catch (e) {
      setError(explainError(e))
      throw e
    } finally {
      setBusy(null)
    }
  }
  /** Resolve to true on success, false on failure (the message is in lastError()). */
  const quiet = (p: Promise<unknown>) => p.then(() => true).catch(() => false)
  const addrOf = (vaultId: string) => (vaults.find((v) => v.id === vaultId)?.vaultAddress ?? vaultId) as Address
  const recordOf = (vaultId: string) => records.find((r) => lc(r.vaultAddress) === lc(addrOf(vaultId)))

  // ---- firm session
  const signInFirm = () =>
    quiet(
      run('Law-firm sign-in', async () => {
        const { firm: f } = await firmSignIn()
        setFirm(f)
        setFirmSignedIn(true)
        return f ? `Signed in as ${f.name}` : 'Wallet signed in. Register the firm to continue.'
      }),
    )
  const registerFirmAction = (name: string, lawyerName: string, license?: string) =>
    quiet(
      run('Firm registration', async () => {
        setFirm(await registerFirm(name, lawyerName, license))
        return `Firm "${name}" registered`
      }),
    )
  // ---- vaults this firm wallet created on-chain that are not in its client list yet
  const [importable, setImportable] = useState<Address[]>([])
  useEffect(() => {
    if (!enabled || role !== 'lawyer' || !firm || !chain.account) return setImportable([])
    let cancelled = false
    readVaultsByCreator(chain.account as Address)
      .then((all) => !cancelled && setImportable(all.filter((a) => !records.some((r) => lc(r.vaultAddress) === lc(a)))))
      .catch(() => !cancelled && setImportable([]))
    return () => {
      cancelled = true
    }
  }, [enabled, role, firm, chain.account, records])

  /** Register vaults this firm created earlier (e.g. by script) using their on-chain settings. Names can be edited later. */
  const importVaults = (addrs: Address[] = importable) =>
    quiet(
      run('Import vaults', async () => {
        for (const a of addrs) {
          const v = await readVault(a)
          await registerClientVault({
            vaultAddress: a,
            clientName: `Client ${short(v.owner)}`,
            clientEmail: '',
            clientWallet: v.owner,
            heirs: v.beneficiaries.map((b) => ({ name: short(b.wallet), wallet: b.wallet, percentage: b.bps / 100, relationship: 'Beneficiary' })),
            guardians: v.guardians.map((g) => ({ name: short(g), wallet: g, role: lc(g) === lc(chain.account ?? '') ? 'Law firm' : 'Guardian' })),
            executorLabel: firm?.name ?? 'Law firm',
            assets: [],
          })
        }
        return `Imported ${addrs.length} existing vault${addrs.length === 1 ? '' : 's'} into ${firm?.name ?? 'the firm'}'s client list`
      }),
    )

  /** Client opened the onboarding link: load the plan by its one-time token and focus that vault. */
  const openOnboarding = async (token: string) => {
    try {
      const rec = await getOnboarding(token)
      setLinkRecords((l) => [rec, ...l.filter((x) => lc(x.vaultAddress) !== lc(rec.vaultAddress))])
      setActiveVaultIdState(lc(rec.vaultAddress))
      chain.selectVault(rec.vaultAddress)
      return rec
    } catch (e) {
      setError((e as Error).message)
      return null
    }
  }

  const signOutFirm = () => {
    firmSignOut()
    setFirm(null)
    setFirmSignedIn(false)
    setRecords([])
  }

  const lawFirm: LawFirmInfo = firm
    ? { name: firm.name, loggedLawyer: firm.lawyerName, lawyerRole: 'Law firm (signed in by wallet)', licenseNumber: firm.license ?? '—' }
    : { name: 'Law firm (not signed in)', loggedLawyer: chain.account ? short(chain.account) : 'Connect wallet', lawyerRole: 'Sign in with the firm wallet', licenseNumber: '—' }

  // ---- actions
  /** Lawyer: create the client's vault on-chain from the wizard data, then register it with the firm. */
  const createVault = async (data: Omit<ClientVault, 'id'>, opts: { rules?: VaultRules; salt?: bigint } = {}): Promise<ClientVault> => {
    let created: ClientVault | null = null
    await run('Create vault', async () => {
      const rules = opts.rules ?? emptyRules()
      // The factory records the sending wallet as creator; the backend only accepts vaults the signed-in firm created.
      if (firm && lc(chain.account ?? '') !== lc(firm.wallet))
        throw new Error(`MetaMask is on ${chain.account ? short(chain.account) : 'no account'}, but the firm signed in with ${short(firm.wallet)}. Switch MetaMask to the firm wallet, then create the vault.`)
      const problems = validatePlan(data, rules)
      if (problems.length) throw new Error(problems.join(' '))
      // The firm wallet becomes the executor (reads the legal packet after release).
      const cfg: VaultConfig = buildVaultConfig(data, rules, (chain.account ?? ZERO) as Address)
      const { vault, txHash } = await createVaultOnChain(cfg, opts.salt ?? BigInt(Date.now()))
      const rec = await registerClientVault({
        vaultAddress: vault,
        creationTx: txHash,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientWallet: data.clientWallet as Address,
        heirs: data.heirs.map((h) => ({ name: h.name, contact: h.contact, wallet: h.wallet as Address, percentage: Number(h.percentage), relationship: h.relationship })),
        guardians: data.guardians.map((g) => ({ name: g.name, contact: g.contact, wallet: g.wallet as Address, role: g.role })),
        executorLabel: data.executor,
        assets: data.assets.map((a) => ({ ...a })),
      })
      created = { ...toClientVault(vault, rec, undefined, {}), id: lc(vault) }
      setActiveVaultIdState(lc(vault))
      chain.selectVault(vault)
      return `Vault ${short(vault)} created on Sepolia for ${data.clientName}`
    })
    return created!
  }

  /** Onboarding link for a vault the firm created (contains the backend's one-time token). */
  const onboardingLinkFor = (vaultId: string) => {
    const r = recordOf(vaultId)
    return r?.onboardingToken ? `${window.location.origin}/client/onboarding?token=${r.onboardingToken}&vault=${r.vaultAddress}` : ''
  }

  const submitDeathCertificate = (vaultId: string, docName: string, uploadedBy: string, fileHash?: string) =>
    quiet(
      run('Death certificate', async () => {
        const hash = fileHash ?? keccak256(stringToHex(`${docName}|${uploadedBy}|${Date.now()}`))
        await submitCertificate(addrOf(vaultId), docName, hash, uploadedBy)
        return `Death certificate "${docName}" submitted by ${uploadedBy} (fingerprint ${hash.slice(0, 10)}…)`
      }),
    )

  const verifyDeathCertificate = (vaultId: string, approve: boolean) =>
    quiet(
      run('Certificate review', async () => {
        await reviewCertificate(addrOf(vaultId), approve)
        return `Death certificate ${approve ? 'VERIFIED' : 'REJECTED'} by ${lawFirm.name}`
      }),
    )

  /** Guardian: sign the vote (free) and have the relayer submit it; falls back to a direct transaction. */
  const submitGuardianAttestation = (vaultId: string, _guardianId: string, approve: boolean) =>
    quiet(
      run('Guardian vote', async () => {
        if (!approve) return 'Guardian declined to confirm; no vote was cast.'
        const vault = addrOf(vaultId)
        const { guardian, deadline, signature } = await signAttestation(vault)
        try {
          const { txHash } = await relayAttestation(vault, guardian, deadline, signature)
          return `Guardian ${short(guardian)} confirmed (gasless, relayed in ${txHash.slice(0, 10)}…)`
        } catch (e) {
          if (!/Relayer is not configured|Cannot reach/.test((e as Error).message)) throw e
          await writeVault({ functionName: 'attestGuardian' }, vault)
          return `Guardian ${short(guardian)} confirmed (paid own gas: relayer unavailable)`
        }
      }),
    )

  const cancelRecovery = (vaultId: string) =>
    quiet(run('Client veto', async () => (await writeVault({ functionName: 'vetoRecovery' }, addrOf(vaultId)), 'Client vetoed the recovery on-chain. Vault is Active again.')))

  /** Lawyer: finalise the will on-chain, then push every heir's ETH share. */
  const executeDigitalWill = (vaultId: string) =>
    quiet(
      run('Execute digital will', async () => {
        const vault = addrOf(vaultId)
        const v = onChain[lc(vault)] ?? (await readVault(vault))
        if (v.state !== 3) await writeVault({ functionName: 'executeRelease' }, vault)
        await writeVault({ functionName: 'distribute', args: [ETH] }, vault)
        return `Digital will executed and ETH distributed to heirs (${short(vault)})`
      }),
    )

  const persistAssets = async (vaultId: string, next: AssetRecord[]) => {
    const stored = next.filter((a) => a.id !== 'onchain-eth')
    await saveAssets(addrOf(vaultId), stored as unknown as Record<string, unknown>[])
  }
  const currentAssets = (vaultId: string) => (recordOf(vaultId)?.assets ?? []) as unknown as AssetRecord[]

  const addClientAsset = (vaultId: string, asset: Omit<AssetRecord, 'id'>) =>
    quiet(run('Asset register', async () => (await persistAssets(vaultId, [...currentAssets(vaultId), { ...asset, id: `a-${Date.now()}` }]), `Asset "${asset.name}" added`)))

  const updateAssetRule = (vaultId: string, assetId: string, rule: string) =>
    quiet(run('Asset register', async () => (await persistAssets(vaultId, currentAssets(vaultId).map((a) => (a.id === assetId ? { ...a, customRule: rule } : a))), 'Asset instruction updated')))

  /** Record a sealed secret in the asset register (the secret itself is sealed via the escrow, not here). */
  const sealSecret = (vaultId: string, name: string, category: AssetRecord['category'], detail: string) =>
    quiet(
      run('Asset register', async () => {
        const entry: AssetRecord = { id: `s-${Date.now()}`, category, name, detail, sealed: true, sealedAt: new Date().toLocaleDateString() }
        await persistAssets(vaultId, [...currentAssets(vaultId), entry])
        return `Secret "${name}" sealed (guardian-held key shares)`
      }),
    )

  /** Client: real ETH transfer into the vault (other assets are not supported in the live demo). */
  const depositEth = async (vaultId: string, amountEth: string) => {
    let hash = ''
    await run('Deposit', async () => {
      hash = await sendEth(addrOf(vaultId), parseEther(amountEth))
      return `Client deposited ${amountEth} ETH into the vault (${hash.slice(0, 10)}…)`
    })
    return hash
  }
  const recordDeposit = (_vaultId: string, asset: string, amount: string, txHash: string) =>
    addAuditLog(`Client deposited ${amount} ${asset} (${txHash.slice(0, 10)}…)`, 'Client wallet')

  return {
    vaults,
    activeVaultId: activeVault?.id ?? activeVaultId,
    setActiveVaultId,
    activeVault,
    lawFirm,
    auditLogs,
    addAuditLog,
    createVault,
    updateVaultStatus: () => {},
    submitDeathCertificate,
    verifyDeathCertificate,
    submitGuardianAttestation,
    cancelRecovery,
    executeDigitalWill,
    addClientAsset,
    updateAssetRule,
    sealSecret,
    recordDeposit,
    // live-only extras
    live: {
      firm,
      firmSignedIn,
      signInFirm,
      registerFirm: registerFirmAction,
      signOutFirm,
      onboardingLinkFor,
      openOnboarding,
      importable,
      importVaults,
      depositEth,
      busy,
      error,
      clearError: () => setError(null),
      lastError: () => errorRef.current,
      refresh: () => Promise.all([loadRecords(), loadChain()]),
    },
  }
}

export type LiveExtras = ReturnType<typeof useLiveB2B>['live']
