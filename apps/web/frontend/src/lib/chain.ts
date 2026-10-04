// On-chain access to the HeirloomVault (Member 2) via viem + the browser wallet (MetaMask).
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type EIP1193Provider,
  type Hash,
} from 'viem'
import { sepolia } from 'viem/chains'
import { attestTypedData, deployments, heirloomVaultAbi, heirloomVaultFactoryAbi } from '@heirloom/contracts'

declare global {
  interface Window {
    ethereum?: EIP1193Provider
  }
}

export const VAULT_ADDRESS = (import.meta.env.VITE_VAULT_ADDRESS || deployments.sepolia.demoVault) as Address
export const FACTORY_ADDRESS = (import.meta.env.VITE_FACTORY_ADDRESS || deployments.sepolia.factory) as Address

// The vault the app is currently looking at. Defaults to VITE_VAULT_ADDRESS; the law-firm/client
// screens switch it when a different client vault is selected.
let activeVault: Address = VAULT_ADDRESS
export const getActiveVault = () => activeVault
export function setActiveVault(a: Address) {
  activeVault = a
}
export const ETH = '0x0000000000000000000000000000000000000000' as Address
export const EXPLORER = 'https://sepolia.etherscan.io'

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'),
})

export type OnChainState = 0 | 1 | 2 | 3 // Active, Watch, TriggerPending, Executed

export interface OnChainVault {
  address: Address
  state: OnChainState
  owner: Address
  executor: Address
  assetMapCID: string
  lastHeartbeat: number // ms
  inactivityThreshold: number // seconds
  vetoGracePeriod: number // seconds
  watchStartsAt: number // ms
  vetoEndTime: number // ms, 0 when no trigger
  executedAt: number // ms
  epoch: bigint
  currentSignatures: number
  requiredSignatures: number
  guardians: Address[]
  /** Default split (applies to every asset without its own plan). */
  beneficiaries: Allocation[]
  plannedTokens: Address[]
  nftFallback: Address
  ethBalance: bigint
}

/** One heir's share of an asset, with optional conditions (v2 estate plan). */
export interface Allocation {
  wallet: Address
  bps: number
  unlockAt: number // ms, 0 = no condition
  installments: number
  interval: number // seconds
}

type RawAllocation = { beneficiary: Address; bps: number; unlockAt: bigint; installments: number; interval: number }
type RawVaultInfo = {
  state: number; owner: Address; executor: Address; assetMapCID: string; lastHeartbeat: bigint; inactivityThreshold: bigint
  vetoGracePeriod: bigint; watchStartsAt: bigint; vetoEndTime: bigint; executedAt: bigint; epoch: bigint; currentSignatures: bigint
  requiredSignatures: bigint; guardians: readonly Address[]; defaultAllocations: readonly RawAllocation[]; plannedTokens: readonly Address[]
  nftRuleCount: bigint; nftFallback: Address; ethBalance: bigint
}

const toAllocation = (a: { beneficiary: Address; bps: number; unlockAt: bigint; installments: number; interval: number }): Allocation => ({
  wallet: a.beneficiary,
  bps: Number(a.bps),
  unlockAt: Number(a.unlockAt) * 1000,
  installments: Number(a.installments),
  interval: Number(a.interval),
})

/** Typed wrapper around readContract for the (large) vault ABI; avoids TS "excessively deep" errors. */
function readVaultFn<T>(address: Address, functionName: string, args: readonly unknown[] = []): Promise<T> {
  const read = publicClient.readContract as unknown as (p: { address: Address; abi: typeof heirloomVaultAbi; functionName: string; args: readonly unknown[] }) => Promise<T>
  return read({ address, abi: heirloomVaultAbi, functionName, args })
}

export async function readVault(address: Address = getActiveVault()): Promise<OnChainVault> {
  const i = await readVaultFn<RawVaultInfo>(address, 'getVaultInfo')
  return {
    address,
    state: i.state as OnChainState,
    owner: i.owner,
    executor: i.executor,
    assetMapCID: i.assetMapCID,
    lastHeartbeat: Number(i.lastHeartbeat) * 1000,
    inactivityThreshold: Number(i.inactivityThreshold),
    vetoGracePeriod: Number(i.vetoGracePeriod),
    watchStartsAt: Number(i.watchStartsAt) * 1000,
    vetoEndTime: Number(i.vetoEndTime) * 1000,
    executedAt: Number(i.executedAt) * 1000,
    epoch: i.epoch,
    currentSignatures: Number(i.currentSignatures),
    requiredSignatures: Number(i.requiredSignatures),
    guardians: [...i.guardians],
    beneficiaries: i.defaultAllocations.map(toAllocation),
    plannedTokens: [...i.plannedTokens],
    nftFallback: i.nftFallback,
    ethBalance: i.ethBalance,
  }
}

export async function readHasAttested(guardian: Address, address: Address = getActiveVault()) {
  return readVaultFn<boolean>(address, 'hasAttestedThisRound', [guardian])
}

export async function readClaimable(heir: Address, token: Address = ETH, address: Address = getActiveVault()) {
  return readVaultFn<bigint>(address, 'claimable', [token, heir])
}

/** True if `who` is named in any split or NFT rule of the vault. */
export async function readIsBeneficiary(who: Address, address: Address = getActiveVault()) {
  return readVaultFn<boolean>(address, 'isBeneficiary', [who])
}

/** Amount of `token` already paid to `heir`. */
export async function readReleased(heir: Address, token: Address = ETH, address: Address = getActiveVault()) {
  return readVaultFn<bigint>(address, 'released', [token, heir])
}

/** The split that applies to `token` (its own plan or the default). */
export async function readPlan(token: Address = ETH, address: Address = getActiveVault()): Promise<Allocation[]> {
  const plan = await readVaultFn<RawAllocation[]>(address, 'getPlan', [token])
  return plan.map(toAllocation)
}

/** Next unlock / installment time for `heir` in `token` (ms, 0 = nothing pending). */
export async function readNextUnlock(heir: Address, token: Address = ETH, address: Address = getActiveVault()) {
  return Number(await readVaultFn<bigint>(address, 'nextUnlock', [token, heir])) * 1000
}

function wallet() {
  if (!window.ethereum) throw new Error('No browser wallet found. Install MetaMask.')
  return createWalletClient({ chain: sepolia, transport: custom(window.ethereum) })
}

/** Ask the wallet for an account and make sure it is on Sepolia. */
export async function connectWallet(): Promise<Address> {
  const w = wallet()
  const [account] = await w.requestAddresses()
  if ((await w.getChainId()) !== sepolia.id) {
    try {
      await w.switchChain({ id: sepolia.id })
    } catch {
      await w.addChain({ chain: sepolia })
      await w.switchChain({ id: sepolia.id })
    }
  }
  return account
}

/** Open MetaMask's account picker so the user can connect/switch to another account. */
export async function switchAccount(): Promise<Address> {
  if (!window.ethereum) throw new Error('No browser wallet found. Install MetaMask.')
  await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] })
  return connectWallet()
}

export async function currentAccount(): Promise<Address | null> {
  if (!window.ethereum) return null
  const [a] = await wallet().getAddresses()
  return a ?? null
}

export function onAccountsChanged(cb: (a: Address | null) => void) {
  const eth = window.ethereum as (EIP1193Provider & { removeListener?: EIP1193Provider['removeListener'] }) | undefined
  if (!eth?.on) return () => {}
  const handler = (accounts: readonly Address[]) => cb(accounts[0] ?? null)
  eth.on('accountsChanged', handler)
  return () => eth.removeListener?.('accountsChanged', handler)
}

/** Sign a plain-text message with the connected wallet (EIP-191). */
export async function signMessage(message: string): Promise<{ account: Address; signature: Hash }> {
  const account = await connectWallet()
  const signature = await wallet().signMessage({ account, message })
  return { account, signature }
}

type VaultWrite =
  | { functionName: 'pingHeartbeat' | 'vetoRecovery' | 'attestGuardian' | 'revokeAttestation' | 'executeRelease' }
  | { functionName: 'claim'; args: readonly [Address, Address] }
  | { functionName: 'distribute'; args: readonly [Address] }

/** Send a vault transaction from the connected wallet and wait for it to be mined. */
export async function writeVault(call: VaultWrite, address: Address = getActiveVault()): Promise<Hash> {
  const account = await connectWallet()
  const { request } = await publicClient.simulateContract({
    account,
    address,
    abi: heirloomVaultAbi,
    ...(call as { functionName: 'pingHeartbeat' }),
  })
  const hash = await wallet().writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Transaction reverted')
  return hash
}

/** Turn viem/contract errors into a sentence a person can act on. */
export function explainError(e: unknown): string {
  const msg = String((e as { shortMessage?: string; message?: string })?.shortMessage || (e as Error)?.message || e)
  const known: [RegExp, string][] = [
    [/OwnerStillActive/, 'The owner is still active. Guardians can only confirm after the inactivity period.'],
    [/NotGuardian/, 'This wallet is not a guardian of this vault.'],
    [/AlreadyAttested/, 'This guardian has already confirmed in this round.'],
    [/NotOwner\b|NotOwnerOrEntryPoint/, 'Only the vault owner wallet can do this.'],
    [/VetoWindowOpen/, 'The veto window has not ended yet.'],
    [/VaultAlreadyExecuted/, 'The vault has already been released. The owner key no longer works.'],
    [/NotBeneficiary/, 'This wallet is not a beneficiary of this vault.'],
    [/AlreadyClaimed/, 'This share has already been claimed.'],
    [/NothingToClaim/, 'There is nothing left to claim.'],
    [/InvalidState/, 'The vault is not in the right state for this action.'],
    [/User rejected|denied/i, 'You rejected the request in your wallet.'],
  ]
  return known.find(([re]) => re.test(msg))?.[1] ?? msg
}

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
export const txUrl = (h: string) => `${EXPLORER}/tx/${h}`
export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`


// ---------------------------------------------------------------------------------------------
// B2B2C helpers (law-firm creates vaults, client deposits, guardians vote gaslessly)
// ---------------------------------------------------------------------------------------------

/** HeirloomVault v2 Config, as passed to HeirloomVaultFactory.createVault. */
export interface VaultConfig {
  owner: Address
  executor: Address
  guardians: Address[]
  requiredSignatures: bigint
  inactivityThreshold: bigint
  vetoGracePeriod: bigint
  assetMapCID: string
  defaultAllocations: RawAllocation[]
  tokenPlans: { token: Address; allocations: RawAllocation[] }[]
  nftRules: { collection: Address; tokenId: bigint; beneficiary: Address; unlockAt: bigint }[]
  nftFallback: Address
}

/** Create a client vault through the factory from the connected (law-firm) wallet. */
export async function createVaultOnChain(cfg: VaultConfig, salt: bigint): Promise<{ vault: Address; txHash: Hash }> {
  const account = await connectWallet()
  const { request, result } = await publicClient.simulateContract({
    account,
    address: FACTORY_ADDRESS,
    abi: heirloomVaultFactoryAbi,
    functionName: 'createVault',
    args: [cfg, salt],
  })
  const txHash = await wallet().writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  if (receipt.status !== 'success') throw new Error('Vault creation reverted')
  return { vault: result as Address, txHash }
}

/** Address the factory will give a vault with this exact config + salt (before it exists). */
export async function predictVaultAddress(cfg: VaultConfig, salt: bigint): Promise<Address> {
  return publicClient.readContract({ address: FACTORY_ADDRESS, abi: heirloomVaultFactoryAbi, functionName: 'getAddress', args: [cfg, salt] }) as Promise<Address>
}

/** Every vault the factory records as created by `creator` (e.g. a law firm's wallet). */
export async function readVaultsByCreator(creator: Address): Promise<Address[]> {
  return [...((await publicClient.readContract({ address: FACTORY_ADDRESS, abi: heirloomVaultFactoryAbi, functionName: 'getVaultsByCreator', args: [creator] })) as readonly Address[])]
}

/** Send ETH from the connected wallet (e.g. the client funding their vault). */
export async function sendEth(to: Address, wei: bigint): Promise<Hash> {
  const account = await connectWallet()
  const hash = await wallet().sendTransaction({ account, to, value: wei, chain: sepolia })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Transfer reverted')
  return hash
}

/** Guardian signs the EIP-712 attestation for the vault's current round (no gas). */
export async function signAttestation(vault: Address, validForSeconds = 7 * 86400) {
  const account = await connectWallet()
  const epoch = await readVaultFn<bigint>(vault, 'epoch')
  const deadline = BigInt(Math.floor(Date.now() / 1000) + validForSeconds)
  const typed = attestTypedData(vault, sepolia.id, epoch, deadline)
  const signature = await wallet().signTypedData({ account, ...typed })
  return { guardian: account, deadline, signature }
}

export const ZERO = '0x0000000000000000000000000000000000000000' as Address
