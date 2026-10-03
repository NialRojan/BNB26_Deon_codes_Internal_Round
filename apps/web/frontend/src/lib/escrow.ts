// Guardian key escrow (option B): Member 1 crypto + Member 3 storage, gated by Member 2's contract.
// Private keys never leave this browser; the backend only ever sees ciphertext.
import { escrow, generateHeirKeyPair, serializePublicKey } from '@heirloom/crypto'
import type { EncryptedAsset } from '@heirloom/crypto'
import { escrowMessages, type EscrowRole } from '@heirloom/contracts'
import { signMessage, VAULT_ADDRESS } from './chain'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'
const vault = VAULT_ADDRESS.toLowerCase()

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      method: init?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new Error(`Cannot reach the Heirloom backend at ${API}. Start it with: npm run dev:api`)
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || `Request failed (${res.status})`)
  return json.data as T
}

// ---------------------------------------------------------------- local key storage
const storeKey = (address: string, role: EscrowRole) => `heirloom:escrow:${vault}:${address.toLowerCase()}:${role}`

function loadPrivateJwk(address: string, role: EscrowRole): string | null {
  try {
    return localStorage.getItem(storeKey(address, role))
  } catch {
    return null
  }
}

export const hasLocalKey = (address: string | null, role: EscrowRole) => !!address && !!loadPrivateJwk(address, role)

async function privateKey(address: string, role: EscrowRole) {
  const jwk = loadPrivateJwk(address, role)
  if (!jwk) throw new Error(`No ${role.toLowerCase()} key on this device. Register your key first.`)
  return escrow.importPrivateKey(jwk)
}

// ---------------------------------------------------------------- API types
export interface PublicKeyRow { address: string; role: EscrowRole; publicKey: string }
export interface SecretRow { id: string; label: string; threshold: number; createdAt: string; held: { guardian: string; encryptedShare: string }[]; releasedBy: string[] }
interface ReleasedRow { id: string; label: string; threshold: number; asset: EncryptedAsset; shares: { guardian: string; encryptedShare: string }[] }

export const listKeys = () => api<PublicKeyRow[]>(`/escrow/keys?vault=${vault}`)
export const listSecrets = () => api<SecretRow[]>(`/escrow/secrets?vault=${vault}`)

// ---------------------------------------------------------------- actions
/** Guardian/heir: create an encryption key pair on this device and publish the public half. */
export async function registerKey(role: EscrowRole) {
  const pair = await generateHeirKeyPair()
  const publicKey = await serializePublicKey(pair.publicKey)
  const { account, signature } = await signMessage(escrowMessages.registerKey(vault, role, publicKey))
  await api('/escrow/keys', { method: 'POST', body: { vaultAddress: vault, address: account, role, publicKey, signature } })
  localStorage.setItem(storeKey(account, role), await escrow.exportPrivateKey(pair.privateKey))
  return account
}

/** Owner: encrypt a secret and give each registered guardian one encrypted Shamir share. */
export async function sealSecret(label: string, secret: string, threshold: number) {
  const guardians = (await listKeys()).filter((k) => k.role === 'GUARDIAN')
  if (guardians.length < threshold)
    throw new Error(`${guardians.length} of the needed ${threshold} guardians have registered a key. Ask them to open the Guardian portal first.`)
  const { asset, shares } = await escrow.sealSecret(secret, guardians, threshold)
  const { signature } = await signMessage(escrowMessages.sealSecret(vault, label, asset, shares))
  return api<{ id: string }>('/escrow/secrets', { method: 'POST', body: { vaultAddress: vault, label, asset, threshold, shares, signature } })
}

/** Guardian (after execution): decrypt own shares and re-encrypt them to every registered heir. */
export async function releaseMyShares(guardian: string) {
  const me = guardian.toLowerCase()
  const key = await privateKey(me, 'GUARDIAN')
  const heirs = (await listKeys()).filter((k) => k.role === 'HEIR')
  if (!heirs.length) throw new Error('No heir has registered a key yet. Ask them to open the Heir portal.')
  let released = 0
  for (const s of await listSecrets()) {
    const held = s.held.find((h) => h.guardian === me)
    if (!held) continue
    const releases = await escrow.releaseShare(held.encryptedShare, key, heirs)
    const { signature } = await signMessage(escrowMessages.releaseShare(s.id, me, releases))
    await api(`/escrow/secrets/${s.id}/release`, { method: 'POST', body: { guardian: me, releases, signature } })
    released++
  }
  return released
}

export interface Recovered { id: string; label: string; plaintext?: string; have: number; need: number }

/** Heir (after execution): rebuild each vault key from released shares and decrypt. */
export async function recoverSecrets(heir: string): Promise<Recovered[]> {
  const me = heir.toLowerCase()
  const key = await privateKey(me, 'HEIR')
  const rows = await api<ReleasedRow[]>(`/escrow/released?vault=${vault}&heir=${me}`)
  return Promise.all(
    rows.map(async (r) => {
      const base = { id: r.id, label: r.label, have: r.shares.length, need: r.threshold }
      if (r.shares.length < r.threshold) return base
      const plaintext = await escrow.recoverSecret(r.asset, r.shares.map((s) => s.encryptedShare), key, r.threshold)
      return { ...base, plaintext }
    }),
  )
}
