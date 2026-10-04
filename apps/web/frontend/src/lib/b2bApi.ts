// Client for the backend's B2B2C (law-firm) API. Firm sessions are a wallet-signed sign-in.
import { b2bMessages } from '@heirloom/contracts'
import type { Address } from 'viem'
import { connectWallet, signMessage } from './chain'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'
const TOKEN_KEY = 'heirloom:firmToken'

export interface FirmRecord { id: string; wallet: string; name: string; lawyerName: string; license?: string | null }
export interface ClientRecord {
  id: string
  vaultAddress: Address
  creationTx?: string | null
  clientName: string
  clientEmail?: string | null
  clientWallet: Address
  heirs: { name: string; contact?: string; wallet: Address; percentage: number; relationship: string }[]
  guardians: { name: string; contact?: string; wallet: Address; role: string }[]
  executorLabel?: string | null
  assets: Record<string, unknown>[]
  certificate: { status: 'None' | 'Pending' | 'Verified' | 'Rejected'; fileName?: string | null; hash?: string | null; uploadedBy?: string | null; uploadedAt?: string | null; reviewedBy?: string | null; reviewedAt?: string | null }
  onboardingToken?: string
  createdAt: string
}

export const getFirmToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
const setFirmToken = (t: string | null) => {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode: session lasts until reload */
  }
}

async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (init.auth) {
    const t = getFirmToken()
    if (!t) throw new Error('Sign in with the law-firm wallet first.')
    headers.Authorization = `Bearer ${t}`
  }
  let res: Response
  try {
    res = await fetch(`${API}${path}`, { method: init.method ?? 'GET', headers, body: init.body ? JSON.stringify(init.body, (_, v) => (typeof v === 'bigint' ? v.toString() : v)) : undefined })
  } catch {
    throw new Error(`Cannot reach the Heirloom backend at ${API}. Start it with: npm run dev:api`)
  }
  const json = await res.json().catch(() => ({}))
  if (res.status === 401 && init.auth) setFirmToken(null)
  if (!res.ok) throw new Error(json?.error?.message || `Request failed (${res.status})`)
  return json.data as T
}

/** Sign in as a law firm with the connected wallet. Returns the firm (null if not registered yet). */
export async function firmSignIn(): Promise<{ wallet: Address; firm: FirmRecord | null }> {
  const account = await connectWallet()
  const issuedAt = new Date().toISOString()
  const { signature } = await signMessage(b2bMessages.firmLogin(account, issuedAt))
  const data = await api<{ token: string; firm: FirmRecord | null }>('/b2b/firm/login', { method: 'POST', body: { address: account, issuedAt, signature } })
  setFirmToken(data.token)
  return { wallet: account, firm: data.firm }
}

export const firmSignOut = () => setFirmToken(null)
export const registerFirm = (name: string, lawyerName: string, license?: string) =>
  api<FirmRecord>('/b2b/firm/register', { method: 'POST', auth: true, body: { name, lawyerName, license } })
export const getMyFirm = () => api<FirmRecord | null>('/b2b/firm/me', { auth: true })
export const listFirmClients = () => api<ClientRecord[]>('/b2b/firm/clients', { auth: true })
export const registerClientVault = (body: Omit<ClientRecord, 'id' | 'certificate' | 'createdAt' | 'onboardingToken'>) =>
  api<ClientRecord>('/b2b/firm/clients', { method: 'POST', auth: true, body })
export const listVaultsFor = (wallet: Address) => api<ClientRecord[]>(`/b2b/vaults?wallet=${wallet}`)
export const getOnboarding = (token: string) => api<ClientRecord & { firm: { name: string; lawyerName: string } }>(`/b2b/onboard/${encodeURIComponent(token)}`)

export async function saveAssets(vault: Address, assets: Record<string, unknown>[]) {
  const { account, signature } = await signMessage(b2bMessages.updateAssets(vault, assets))
  return api(`/b2b/vaults/${vault}/assets`, { method: 'PUT', body: { signer: account, assets, signature } })
}

export const submitCertificate = (vault: Address, fileName: string, fileHash: string, uploadedBy: string) =>
  api(`/b2b/vaults/${vault}/certificate`, { method: 'POST', body: { fileName, fileHash, uploadedBy } })
export const reviewCertificate = (vault: Address, approve: boolean) =>
  api<{ status: string }>(`/b2b/vaults/${vault}/certificate/review`, { method: 'POST', auth: true, body: { approve } })
export const relayAttestation = (vault: Address, guardian: Address, deadline: bigint, signature: string) =>
  api<{ txHash: string }>('/b2b/relay/attest', { method: 'POST', body: { vault, guardian, deadline, signature } })
