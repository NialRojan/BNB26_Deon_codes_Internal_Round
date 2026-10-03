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
import { deployments, heirloomVaultAbi } from '@heirloom/contracts'

declare global {
  interface Window {
    ethereum?: EIP1193Provider
  }
}

export const VAULT_ADDRESS = (import.meta.env.VITE_VAULT_ADDRESS || deployments.sepolia.demoVault) as Address
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
  beneficiaries: { wallet: Address; bps: number }[]
  ethBalance: bigint
}

export async function readVault(address: Address = VAULT_ADDRESS): Promise<OnChainVault> {
  const i = await publicClient.readContract({ address, abi: heirloomVaultAbi, functionName: 'getVaultInfo' })
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
    beneficiaries: i.beneficiaries.map((b) => ({ wallet: b.wallet, bps: Number(b.bps) })),
    ethBalance: i.ethBalance,
  }
}

export async function readHasAttested(guardian: Address, address: Address = VAULT_ADDRESS) {
  return publicClient.readContract({ address, abi: heirloomVaultAbi, functionName: 'hasAttestedThisRound', args: [guardian] })
}

export async function readClaimable(heir: Address, token: Address = ETH, address: Address = VAULT_ADDRESS) {
  return publicClient.readContract({ address, abi: heirloomVaultAbi, functionName: 'claimable', args: [token, heir] })
}

export async function readHasClaimed(heir: Address, token: Address = ETH, address: Address = VAULT_ADDRESS) {
  return publicClient.readContract({ address, abi: heirloomVaultAbi, functionName: 'hasClaimed', args: [token, heir] })
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

type VaultWrite =
  | { functionName: 'pingHeartbeat' | 'vetoRecovery' | 'attestGuardian' | 'revokeAttestation' | 'executeRelease' }
  | { functionName: 'claim'; args: readonly [Address, Address] }

/** Send a vault transaction from the connected wallet and wait for it to be mined. */
export async function writeVault(call: VaultWrite, address: Address = VAULT_ADDRESS): Promise<Hash> {
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
