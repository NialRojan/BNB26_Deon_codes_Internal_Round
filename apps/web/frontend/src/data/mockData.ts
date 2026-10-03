export type VaultStatus =
  | "ACTIVE"
  | "WATCH"
  | "RECOVERY PENDING"
  | "VETO WINDOW"
  | "READY FOR EXECUTION"
  | "EXECUTED";

export interface HeirItem {
  id: string;
  name: string;
  contact: string;
  wallet: string;
  percentage: number;
  relationship: string;
}

export interface GuardianItem {
  id: string;
  name: string;
  contact: string;
  role: string;
  wallet: string;
  hasAttested?: boolean;
}

export interface AssetRecord {
  id: string;
  category: "Crypto" | "Access Kit" | "Legal / Asset Information";
  name: string;
  detail: string;
  institution?: string;
  valueOrSize?: string;
  customRule?: string;
  sealed?: boolean;
  sealedAt?: string;
}

export interface ClientVault {
  id: string;
  clientName: string;
  clientEmail: string;
  clientWallet: string;
  vaultAddress: string;
  status: VaultStatus;
  heirs: HeirItem[];
  guardians: GuardianItem[];
  requiredApprovals: number;
  executor: string;
  inactivityDays: number;
  vetoHours: number;
  lastCheckIn: string;
  recoveryStatusDetail: string;
  deathCertificateStatus: "None" | "Pending" | "Verified" | "Rejected";
  deathCertificateUrl?: string;
  deathCertUploadedBy?: string;
  deathCertUploadedAt?: string;
  guardianAttestationsCount: number;
  vetoTimeRemainingHours?: number;
  assets: AssetRecord[];
}

export interface LawFirmInfo {
  name: string;
  loggedLawyer: string;
  lawyerRole: string;
  licenseNumber: string;
}

export const LAW_FIRM: LawFirmInfo = {
  name: "Mehta & Partners",
  loggedLawyer: "Adv. Rohit Mehta",
  lawyerRole: "Senior Partner — Trusts & Estate Planning",
  licenseNumber: "BAR/MH/2008/4921",
};

export const INITIAL_CLIENT_VAULTS: ClientVault[] = [
  {
    id: "vault-1",
    clientName: "Rahul Sharma",
    clientEmail: "rahul.sharma@legacyclient.com",
    clientWallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    vaultAddress: "0x8F3a27Bc19D3901a81Ef4429B5eFa556A82091C2",
    status: "ACTIVE",
    heirs: [
      { id: "h1", name: "Asha Sharma", contact: "asha.s@gmail.com", wallet: "0x3A21...b82F", percentage: 50, relationship: "Wife" },
      { id: "h2", name: "Arjun Sharma", contact: "arjun.s@gmail.com", wallet: "0x8F14...55a1", percentage: 30, relationship: "Son" },
      { id: "h3", name: "Diya Sharma", contact: "diya.s@gmail.com", wallet: "0x6E92...04c9", percentage: 20, relationship: "Daughter" },
    ],
    guardians: [
      { id: "g1", name: "Mehta & Partners", contact: "trusts@mehtapartners.com", role: "Institutional Legal Guardian", wallet: "0x1111...AAAA", hasAttested: false },
      { id: "g2", name: "Vikram Sharma", contact: "+91 98200 44122", role: "Family Guardian (Brother)", wallet: "0x2222...BBBB", hasAttested: false },
      { id: "g3", name: "Priya Sharma", contact: "+91 98199 77800", role: "Trusted Guardian (Sister-in-law)", wallet: "0x3333...CCCC", hasAttested: false },
    ],
    requiredApprovals: 2,
    executor: "Mehta & Partners",
    inactivityDays: 30,
    vetoHours: 48,
    lastCheckIn: "Today, 10:45 AM",
    recoveryStatusDetail: "Normal · Periodic heartbeat active",
    deathCertificateStatus: "None",
    guardianAttestationsCount: 0,
    assets: [
      { id: "a1", category: "Crypto", name: "Ethereum Cold Storage", detail: "Primary vault balance: 14.5 ETH", valueOrSize: "14.5 ETH", customRule: "Custom split: Asha 70%, Arjun 30%" },
      { id: "a2", category: "Crypto", name: "Bitcoin Cold Wallet", detail: "Multi-sig 1.25 BTC address", valueOrSize: "1.25 BTC", customRule: "Distribute to all heirs" },
      { id: "a3", category: "Crypto", name: "CryptoPunk #1234", detail: "ERC-721 Digital Collectible", valueOrSize: "1 NFT", customRule: "Assigned solely to Diya Sharma" },
      { id: "a4", category: "Access Kit", name: "1Password Family Recovery Key", detail: "Encrypted browser-side AES-GCM", sealed: true, sealedAt: "Oct 2, 2026" },
      { id: "a5", category: "Access Kit", name: "Google & Proton Account Recovery Codes", detail: "Emergency cloud restore kit", sealed: true, sealedAt: "Oct 2, 2026" },
      { id: "a6", category: "Legal / Asset Information", name: "HDFC Private Banking & Demat", detail: "A/C ending in 4419 · Folio #IN-88912", institution: "HDFC Bank", customRule: "Legal packet for executor claim" },
      { id: "a7", category: "Legal / Asset Information", name: "Bandra Apartment Property Deed", detail: "Registration Document #2019-BDR-8812", institution: "Sub-Registrar Mumbai" },
    ],
  },
  {
    id: "vault-2",
    clientName: "Alok Verma",
    clientEmail: "alok.verma@techcorp.in",
    clientWallet: "0x91F24e81561085C089923b7a12D298101a1202B1",
    vaultAddress: "0x4C19b88301AcE231908bF410298B3210451333E0",
    status: "WATCH",
    heirs: [
      { id: "h21", name: "Neha Verma", contact: "neha.v@gmail.com", wallet: "0x77F1...9081", percentage: 60, relationship: "Spouse" },
      { id: "h22", name: "Kabir Verma", contact: "kabir.v@gmail.com", wallet: "0x55E2...1209", percentage: 40, relationship: "Son" },
    ],
    guardians: [
      { id: "g21", name: "Mehta & Partners", contact: "trusts@mehtapartners.com", role: "Institutional Legal Guardian", wallet: "0x1111...AAAA", hasAttested: false },
      { id: "g22", name: "Dr. Sameer Joshi", contact: "+91 98330 11223", role: "Family Physician & Guardian", wallet: "0x4444...DDDD", hasAttested: false },
      { id: "g23", name: "Rajesh Nair", contact: "+91 98440 99887", role: "Business Partner", wallet: "0x5555...EEEE", hasAttested: false },
    ],
    requiredApprovals: 2,
    executor: "Mehta & Partners",
    inactivityDays: 14,
    vetoHours: 72,
    lastCheckIn: "16 days ago (Oct 18)",
    recoveryStatusDetail: "Heartbeat missed (2 of 3) · Escalation countdown",
    deathCertificateStatus: "None",
    guardianAttestationsCount: 0,
    assets: [
      { id: "a21", category: "Crypto", name: "Treasury ETH & USDC", detail: "8.2 ETH & 45,000 USDC", valueOrSize: "8.2 ETH" },
      { id: "a22", category: "Access Kit", name: "Bitwarden Master Key", detail: "Sealed browser secret", sealed: true },
      { id: "a23", category: "Legal / Asset Information", name: "ICICI Securities Portfolio", detail: "Demat A/C 9901844", institution: "ICICI Securities" },
    ],
  },
  {
    id: "vault-3",
    clientName: "Sunita Desai",
    clientEmail: "sunita.desai@heritage.com",
    clientWallet: "0x18B220918F9A4c8dE9938B6a44510B1209B192A0",
    vaultAddress: "0x1B89f20108Fa671B20A9B01F6E2091B01201AA57",
    status: "RECOVERY PENDING",
    heirs: [
      { id: "h31", name: "Rohan Desai", contact: "rohan.d@gmail.com", wallet: "0x129B...5412", percentage: 50, relationship: "Son" },
      { id: "h32", name: "Ananya Desai", contact: "ananya.d@gmail.com", wallet: "0x89C1...8765", percentage: 50, relationship: "Daughter" },
    ],
    guardians: [
      { id: "g31", name: "Mehta & Partners", contact: "trusts@mehtapartners.com", role: "Institutional Legal Guardian", wallet: "0x1111...AAAA", hasAttested: true },
      { id: "g32", name: "Kavita Shah", contact: "+91 99200 44556", role: "Personal Attorney", wallet: "0x6666...FFFF", hasAttested: false },
      { id: "g33", name: "Anil Merchant", contact: "+91 98211 66778", role: "Chartered Accountant", wallet: "0x7777...0000", hasAttested: false },
    ],
    requiredApprovals: 2,
    executor: "Mehta & Partners",
    inactivityDays: 30,
    vetoHours: 48,
    lastCheckIn: "34 days ago",
    recoveryStatusDetail: "Recovery initiated by Heir · 1 of 2 guardian attestations recorded",
    deathCertificateStatus: "Pending",
    deathCertificateUrl: "death_certificate_sunita_desai.pdf",
    deathCertUploadedBy: "Rohan Desai (Son / Heir)",
    deathCertUploadedAt: "Oct 3, 2026, 04:30 PM",
    guardianAttestationsCount: 1,
    assets: [
      { id: "a31", category: "Crypto", name: "Hardware Wallet Seed Backup", detail: "25.0 ETH equivalent", valueOrSize: "25 ETH" },
      { id: "a32", category: "Access Kit", name: "Enpass Recovery Payload", detail: "Encrypted vault credentials", sealed: true },
      { id: "a33", category: "Legal / Asset Information", name: "Kotak Mahindra Wealth Portfolio", detail: "Client Code #KM-7721", institution: "Kotak Wealth" },
    ],
  },
  {
    id: "vault-4",
    clientName: "Devendra Patel",
    clientEmail: "dev.patel@patelventures.com",
    clientWallet: "0x9810Ba84C320A8129B0192aF8120B8C90281F082",
    vaultAddress: "0x7E41c390A812Ef44180A1820Bc982001a1825201",
    status: "VETO WINDOW",
    heirs: [
      { id: "h41", name: "Kiran Patel", contact: "kiran.p@gmail.com", wallet: "0x231A...6712", percentage: 100, relationship: "Son" },
    ],
    guardians: [
      { id: "g41", name: "Mehta & Partners", contact: "trusts@mehtapartners.com", role: "Institutional Legal Guardian", wallet: "0x1111...AAAA", hasAttested: true },
      { id: "g42", name: "Suresh Amin", contact: "+91 98201 12345", role: "Trustee", wallet: "0x8888...1111", hasAttested: true },
      { id: "g43", name: "Bhavin Patel", contact: "+91 98111 67890", role: "Cousin", wallet: "0x9999...2222", hasAttested: false },
    ],
    requiredApprovals: 2,
    executor: "Mehta & Partners",
    inactivityDays: 30,
    vetoHours: 48,
    lastCheckIn: "38 days ago",
    recoveryStatusDetail: "All approvals verified · 48h Owner Veto countdown active",
    deathCertificateStatus: "Verified",
    deathCertificateUrl: "death_certificate_devendra_patel.pdf",
    deathCertUploadedBy: "Kiran Patel (Son / Heir)",
    deathCertUploadedAt: "Oct 2, 2026, 11:15 AM",
    guardianAttestationsCount: 2,
    vetoTimeRemainingHours: 19,
    assets: [
      { id: "a41", category: "Crypto", name: "Trezor Stash", detail: "30.0 ETH, 2.0 BTC", valueOrSize: "30 ETH" },
      { id: "a42", category: "Access Kit", name: "NordPass Master Emergency File", detail: "Encrypted browser key", sealed: true },
      { id: "a43", category: "Legal / Asset Information", name: "Axis Bank Fixed Deposits & Lockers", detail: "Branch Fort Mumbai · Locker #81", institution: "Axis Bank" },
    ],
  },
  {
    id: "vault-5",
    clientName: "Rajesh Kapoor",
    clientEmail: "rajesh.kapoor@kapoorgroup.in",
    clientWallet: "0x51A82c091Ba67E01824c90281F08291aBc982001",
    vaultAddress: "0x9D23e1920B8C90281F08291aBc982001a182618F",
    status: "READY FOR EXECUTION",
    heirs: [
      { id: "h51", name: "Simran Kapoor", contact: "simran.k@gmail.com", wallet: "0x9901...3312", percentage: 50, relationship: "Daughter" },
      { id: "h52", name: "Varun Kapoor", contact: "varun.k@gmail.com", wallet: "0x4421...9908", percentage: 50, relationship: "Son" },
    ],
    guardians: [
      { id: "g51", name: "Mehta & Partners", contact: "trusts@mehtapartners.com", role: "Institutional Legal Guardian", wallet: "0x1111...AAAA", hasAttested: true },
      { id: "g52", name: "Adv. Harish Chawla", contact: "+91 98204 88771", role: "Family Legal Counsel", wallet: "0xAAAA...3333", hasAttested: true },
      { id: "g53", name: "Sanjay Singhal", contact: "+91 98331 44552", role: "Lifelong Trustee", wallet: "0xBBBB...4444", hasAttested: true },
    ],
    requiredApprovals: 2,
    executor: "Mehta & Partners",
    inactivityDays: 60,
    vetoHours: 24,
    lastCheckIn: "65 days ago",
    recoveryStatusDetail: "Veto period elapsed · Authorization verified · Ready for Digital Will execution",
    deathCertificateStatus: "Verified",
    deathCertificateUrl: "death_certificate_rajesh_kapoor.pdf",
    deathCertUploadedBy: "Simran Kapoor (Daughter)",
    deathCertUploadedAt: "Sep 28, 2026",
    guardianAttestationsCount: 3,
    vetoTimeRemainingHours: 0,
    assets: [
      { id: "a51", category: "Crypto", name: "Institutional Vault Balance", detail: "50.0 ETH & 100,000 USDC", valueOrSize: "50 ETH" },
      { id: "a52", category: "Access Kit", name: "Encrypted Hardware Wallet Shards", detail: "3-of-5 Shamir shards", sealed: true },
      { id: "a53", category: "Legal / Asset Information", name: "Kapoor Textiles Shares & Real Estate Deeds", detail: "Registered Folio #KT-0091", institution: "ROC Mumbai" },
    ],
  },
  {
    id: "vault-6",
    clientName: "Maya Sen",
    clientEmail: "maya.sen@senfoundation.org",
    clientWallet: "0x3890281F08291aBc982001a182618F51A82c091B",
    vaultAddress: "0x3F90d80192aF8120B8C90281F08291aBc9824419",
    status: "EXECUTED",
    heirs: [
      { id: "h61", name: "Tariq Sen", contact: "tariq.sen@gmail.com", wallet: "0x1189...8821", percentage: 100, relationship: "Nephew" },
    ],
    guardians: [
      { id: "g61", name: "Mehta & Partners", contact: "trusts@mehtapartners.com", role: "Institutional Legal Guardian", wallet: "0x1111...AAAA", hasAttested: true },
      { id: "g62", name: "Ritika Roy", contact: "+91 98200 99112", role: "Foundation Trustee", wallet: "0xCCCC...5555", hasAttested: true },
    ],
    requiredApprovals: 2,
    executor: "Mehta & Partners",
    inactivityDays: 30,
    vetoHours: 48,
    lastCheckIn: "Executed Oct 1, 2026",
    recoveryStatusDetail: "Digital Will executed · Staged release in progress",
    deathCertificateStatus: "Verified",
    guardianAttestationsCount: 2,
    assets: [
      { id: "a61", category: "Crypto", name: "Digital Inheritance ETH", detail: "18.0 ETH (Stage 3 Timelocked)", valueOrSize: "18 ETH" },
      { id: "a62", category: "Access Kit", name: "Master Password Kit", detail: "Stage 2 (Unlocks in 4 days)", sealed: true },
      { id: "a63", category: "Legal / Asset Information", name: "Foundation Demat & Bank Accounts", detail: "Stage 1 (Released to Executor)", institution: "SBI Main" },
    ],
  },
];
