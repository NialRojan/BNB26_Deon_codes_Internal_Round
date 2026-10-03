import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";
import type { HeirItem, GuardianItem } from "../../data/mockData";

const STEPS = [
  "1. Client Information",
  "2. Heirs & Allocations",
  "3. Guardians & Threshold",
  "4. Executor Designation",
  "5. Recovery Timers",
  "6. Review & Seal",
];

export default function CreateVaultPage() {
  const { createVault, lawFirm } = useB2B2C();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Form State
  const [clientName, setClientName] = useState("Rahul Sharma");
  const [clientEmail, setClientEmail] = useState("rahul.sharma@legacyclient.com");
  const [clientWallet, setClientWallet] = useState("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");

  // Heirs
  const [heirs, setHeirs] = useState<HeirItem[]>([
    { id: "h-1", name: "Asha Sharma", contact: "asha.s@gmail.com", wallet: "0x3A21...b82F", percentage: 50, relationship: "Wife" },
    { id: "h-2", name: "Arjun Sharma", contact: "arjun.s@gmail.com", wallet: "0x8F14...55a1", percentage: 30, relationship: "Son" },
    { id: "h-3", name: "Diya Sharma", contact: "diya.s@gmail.com", wallet: "0x6E92...04c9", percentage: 20, relationship: "Daughter" },
  ]);
  const [newHeirName, setNewHeirName] = useState("");
  const [newHeirContact, setNewHeirContact] = useState("");
  const [newHeirWallet, setNewHeirWallet] = useState("");
  const [newHeirPct, setNewHeirPct] = useState<number>(0);
  const [newHeirRel, setNewHeirRel] = useState("Beneficiary");

  // Guardians
  const [guardians, setGuardians] = useState<GuardianItem[]>([
    { id: "g-1", name: lawFirm.name, contact: "trusts@mehtapartners.com", role: "Institutional Legal Guardian", wallet: "0x111122223333444455556666777788889999AAAA" },
    { id: "g-2", name: "Vikram Sharma", contact: "+91 98200 44122", role: "Family Guardian (Brother)", wallet: "0x22223333444455556666777788889999AAAABBBB" },
    { id: "g-3", name: "Priya Sharma", contact: "+91 98199 77800", role: "Trusted Guardian (Sister-in-law)", wallet: "0x3333444455556666777788889999AAAABBBBCCCC" },
  ]);
  const [newGName, setNewGName] = useState("");
  const [newGContact, setNewGContact] = useState("");
  const [newGRole, setNewGRole] = useState("");
  const [newGWallet, setNewGWallet] = useState("");
  const [requiredApprovals, setRequiredApprovals] = useState(2);

  // Executor
  const [executor, setExecutor] = useState(`Law Firm — ${lawFirm.name}`);

  // Recovery Timers
  const [inactivityDays, setInactivityDays] = useState(30);
  const [vetoHours, setVetoHours] = useState(48);

  // Completed State
  const [createdVaultAddress, setCreatedVaultAddress] = useState<string | null>(null);
  const [createdVaultId, setCreatedVaultId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Total Percentage
  const totalPercentage = heirs.reduce((sum, h) => sum + Number(h.percentage || 0), 0);
  const isPercentageValid = totalPercentage === 100;

  const handleAddHeir = () => {
    if (!newHeirName.trim()) return;
    setHeirs([
      ...heirs,
      {
        id: `h-${Date.now()}`,
        name: newHeirName.trim(),
        contact: newHeirContact.trim() || "contact@heir.com",
        wallet: newHeirWallet.trim() || "0x0000...0000",
        percentage: Number(newHeirPct) || 0,
        relationship: newHeirRel,
      },
    ]);
    setNewHeirName("");
    setNewHeirContact("");
    setNewHeirWallet("");
    setNewHeirPct(0);
  };

  const handleRemoveHeir = (id: string) => {
    setHeirs(heirs.filter((h) => h.id !== id));
  };

  const handleAddGuardian = () => {
    if (!newGName.trim()) return;
    setGuardians([
      ...guardians,
      {
        id: `g-${Date.now()}`,
        name: newGName.trim(),
        contact: newGContact.trim() || "+91 98000 00000",
        role: newGRole.trim() || "Independent Guardian",
        wallet: newGWallet.trim() || "0x0000...0000",
      },
    ]);
    setNewGName("");
    setNewGContact("");
    setNewGRole("");
    setNewGWallet("");
  };

  const handleRemoveGuardian = (id: string) => {
    const updated = guardians.filter((g) => g.id !== id);
    setGuardians(updated);
    if (requiredApprovals > updated.length) {
      setRequiredApprovals(Math.max(1, updated.length));
    }
  };

  const handleCreate = () => {
    const randomHex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const vaultAddress = `0x${randomHex}`;
    const v = createVault({
      clientName,
      clientEmail,
      clientWallet,
      vaultAddress,
      status: "ACTIVE",
      heirs,
      guardians,
      requiredApprovals,
      executor,
      inactivityDays,
      vetoHours,
      lastCheckIn: "Today, just now (Created by Lawyer)",
      recoveryStatusDetail: "Vault configured · Awaiting client onboarding review",
      deathCertificateStatus: "None",
      guardianAttestationsCount: 0,
      assets: [
        { id: "a-init-1", category: "Crypto", name: "Bitcoin Cold Wallet", detail: "Client to fund upon onboarding", valueOrSize: "Pending deposit" },
        { id: "a-init-2", category: "Access Kit", name: "Emergency Cloud & Password Recovery", detail: "Client to seal in browser", sealed: false },
        { id: "a-init-3", category: "Legal / Asset Information", name: "Primary Demat & Banking Accounts", detail: "Client legal dossier", institution: "Designated Banks" },
      ],
    });
    setCreatedVaultAddress(vaultAddress);
    setCreatedVaultId(v.id);
  };

  const onboardingLink = createdVaultId
    ? `${window.location.origin}/client/onboarding?vaultId=${createdVaultId}&client=${encodeURIComponent(clientName)}`
    : "";

  const handleCopyOnboardingLink = () => {
    navigator.clipboard?.writeText(onboardingLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#e1e8e1] pb-4">
        <div>
          <span className="section-kicker">LAWYER ONBOARDING WIZARD</span>
          <h2 className="text-2xl font-bold text-[#17221b]">Create Client Vault</h2>
          <p className="text-xs text-[#718077]">
            Fiduciary onboarding for <b>{lawFirm.name}</b> · Configured on client instructions.
          </p>
        </div>
        <Link
          to="/lawyer"
          className="rounded-lg border border-[#dce4dc] px-3 py-1.5 text-xs font-semibold text-[#2b382e] hover:bg-[#f5f7f4]"
        >
          ← Back to Client List
        </Link>
      </div>

      {createdVaultAddress ? (
        /* Success Screen */
        <div className="rounded-2xl border border-[#b9d79e] bg-[#f8faf4] p-8 text-center shadow-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#a3e635] text-2xl font-bold text-[#17221b]">
            ✓
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#3d8b50]">
            FIDUCIARY VAULT ESTABLISHED
          </span>
          <h3 className="mt-1 text-2xl font-bold text-[#17221b]">Vault Created Successfully</h3>
          <p className="mx-auto mt-2 max-w-md text-xs text-[#68756c]">
            The trust-minimized vault configuration has been generated for <b>{clientName}</b>. The client now needs to review and deposit assets.
          </p>

          <div className="mx-auto mt-6 max-w-lg rounded-xl border border-[#e1e8e1] bg-white p-4 text-left shadow-sm">
            <span className="text-[10px] uppercase font-bold text-[#718077]">Designated Vault Smart Contract</span>
            <div className="mt-1 flex items-center justify-between font-mono text-xs text-[#17221b]">
              <span className="break-all font-semibold">{createdVaultAddress}</span>
              <button
                onClick={() => navigator.clipboard?.writeText(createdVaultAddress)}
                className="ml-2 rounded bg-[#f5f7f4] px-2 py-1 text-[11px] font-medium text-[#2d5836] hover:bg-[#eaf4df]"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-lg space-y-3">
            <div className="rounded-xl border border-[#e1e8e1] bg-white p-4 text-left shadow-sm">
              <span className="text-[10px] uppercase font-bold text-[#718077]">Client Onboarding Secure URL</span>
              <p className="mt-1 text-[11px] text-[#556358]">
                Share this direct onboarding link with <b>{clientName}</b>. They will review your pre-filled setup, confirm heirs, and deposit their assets.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={onboardingLink}
                  className="w-full rounded border border-[#dce4dc] bg-[#f8faf7] px-2.5 py-1.5 font-mono text-[11px] text-[#2b382e]"
                />
                <button
                  onClick={handleCopyOnboardingLink}
                  className="whitespace-nowrap rounded-lg bg-[#a3e635] px-3 py-1.5 text-xs font-bold text-[#17221b] hover:brightness-95"
                >
                  {copiedLink ? "Copied ✓" : "Copy Link"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                onClick={() => navigate(`/client/onboarding?vaultId=${createdVaultId}&client=${encodeURIComponent(clientName)}`)}
                className="rounded-lg bg-[#17221b] px-5 py-2.5 text-xs font-bold text-white hover:bg-black"
              >
                Open Client Onboarding Flow Now →
              </button>
              <Link
                to="/lawyer"
                className="rounded-lg border border-[#dce4dc] bg-white px-4 py-2.5 text-xs font-semibold text-[#2b382e] hover:bg-[#f5f7f4]"
              >
                Return to Lawyer Dashboard
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Wizard Steps */
        <div className="space-y-6">
          {/* Step Progress Pills */}
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#e1e8e1] bg-white p-1.5 shadow-sm">
            {STEPS.map((s, idx) => (
              <button
                key={s}
                onClick={() => setStep(idx)}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-center text-xs font-semibold transition ${
                  step === idx
                    ? "bg-[#a3e635] text-[#17221b]"
                    : step > idx
                    ? "bg-[#edf5ed] text-[#34a853]"
                    : "text-[#869188] hover:text-[#17221b]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* STEP 1: Client Information */}
          {step === 0 && (
            <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4">
              <div className="border-b border-[#edf0ed] pb-3">
                <h3 className="text-lg font-bold text-[#17221b]">Step 1 — Client Identification</h3>
                <p className="text-xs text-[#718077]">
                  Enter the estate planning client's primary legal credentials.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#2b382e]">Client Full Legal Name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 text-xs text-[#17221b] outline-none focus:border-[#a3e635]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#2b382e]">Client Email / Contact</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="e.g. rahul.sharma@legacyclient.com"
                    className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 text-xs text-[#17221b] outline-none focus:border-[#a3e635]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#2b382e]">Client Personal Wallet Address (Owner Control)</label>
                  <input
                    type="text"
                    value={clientWallet}
                    onChange={(e) => setClientWallet(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 font-mono text-xs text-[#17221b] outline-none focus:border-[#a3e635]"
                  />
                  <p className="mt-1 text-[10px] text-[#718077]">
                    Only this client wallet holds owner authority to cancel recoveries, update rules, and deposit assets.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Heirs & Allocations */}
          {step === 1 && (
            <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between border-b border-[#edf0ed] pb-3">
                <div>
                  <h3 className="text-lg font-bold text-[#17221b]">Step 2 — Designate Heirs & Allocation</h3>
                  <p className="text-xs text-[#718077]">
                    Add beneficiaries and assign percentage shares. Must total exactly 100%.
                  </p>
                </div>
                <div
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    isPercentageValid ? "bg-[#eaf4df] text-[#276332]" : "bg-[#fef2f2] text-[#b91c1c]"
                  }`}
                >
                  Total = {totalPercentage}% {isPercentageValid ? "✓ Valid" : "⚠ Must equal 100%"}
                </div>
              </div>

              {/* Heirs List */}
              <div className="space-y-2">
                {heirs.map((heir) => (
                  <div
                    key={heir.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e1e8e1] p-3 text-xs"
                  >
                    <div>
                      <b className="text-sm text-[#17221b]">{heir.name}</b>{" "}
                      <span className="text-[#718077]">({heir.relationship})</span>
                      <div className="text-[11px] text-[#869188]">{heir.contact} · {heir.wallet}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 font-bold text-sm text-[#17221b]">
                        <input
                          type="number"
                          value={heir.percentage}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setHeirs(heirs.map((h) => (h.id === heir.id ? { ...h, percentage: val } : h)));
                          }}
                          className="w-16 rounded border border-[#dce4dc] px-2 py-1 text-right text-xs"
                          min="0"
                          max="100"
                        />
                        <span>%</span>
                      </div>
                      <button
                        onClick={() => handleRemoveHeir(heir.id)}
                        className="text-xs text-[#b91c1c] hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Heir Form */}
              <div className="rounded-xl border border-dashed border-[#cfdbcb] bg-[#fafbfa] p-4 text-xs">
                <span className="font-bold text-[#17221b]">Add Another Heir</span>
                <div className="mt-2 grid gap-3 sm:grid-cols-4">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newHeirName}
                    onChange={(e) => setNewHeirName(e.target.value)}
                    className="rounded border border-[#dce4dc] px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Relationship (e.g. Son)"
                    value={newHeirRel}
                    onChange={(e) => setNewHeirRel(e.target.value)}
                    className="rounded border border-[#dce4dc] px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Email / Phone"
                    value={newHeirContact}
                    onChange={(e) => setNewHeirContact(e.target.value)}
                    className="rounded border border-[#dce4dc] px-2.5 py-1.5 text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="%"
                      value={newHeirPct || ""}
                      onChange={(e) => setNewHeirPct(Number(e.target.value))}
                      className="w-20 rounded border border-[#dce4dc] px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddHeir}
                      className="flex-1 rounded bg-[#17221b] px-3 py-1.5 font-bold text-white hover:bg-black"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Guardians & Threshold */}
          {step === 2 && (
            <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4">
              <div className="border-b border-[#edf0ed] pb-3">
                <h3 className="text-lg font-bold text-[#17221b]">Step 3 — Fiduciary Guardians & Approval Threshold</h3>
                <p className="text-xs text-[#718077]">
                  Guardians hold key shares and submit recovery attestations. No single guardian can execute alone.
                </p>
              </div>

              {/* Threshold Selector Box */}
              <div className="rounded-xl border border-[#b9d79e] bg-[#f8faf4] p-4 text-xs">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#3d8b50]">Threshold Policy</span>
                    <h4 className="text-base font-bold text-[#17221b]">
                      {requiredApprovals} of {guardians.length} guardians required to authorize recovery
                    </h4>
                    <p className="text-[#68756c]">
                      Protects against collusion while ensuring resiliency if one guardian is unreachable.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-[#17221b]">Required:</label>
                    <select
                      value={requiredApprovals}
                      onChange={(e) => setRequiredApprovals(Number(e.target.value))}
                      className="rounded-lg border border-[#dce4dc] bg-white px-3 py-1.5 font-bold text-[#17221b]"
                    >
                      {Array.from({ length: guardians.length }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} of {guardians.length} approvals
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Guardians List */}
              <div className="space-y-2">
                {guardians.map((g, idx) => (
                  <div
                    key={g.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e1e8e1] p-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f0f4ef] text-[10px] font-bold text-[#2d4d35]">
                          {idx + 1}
                        </span>
                        <b className="text-sm text-[#17221b]">{g.name}</b>
                        <span className="rounded bg-[#f5f7f4] px-1.5 py-0.5 text-[10px] text-[#6b786e]">
                          {g.role}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-[#869188]">{g.contact} · {g.wallet}</div>
                    </div>
                    {guardians.length > 2 && (
                      <button
                        onClick={() => handleRemoveGuardian(g.id)}
                        className="text-xs text-[#b91c1c] hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Guardian Form */}
              <div className="rounded-xl border border-dashed border-[#cfdbcb] bg-[#fafbfa] p-4 text-xs">
                <span className="font-bold text-[#17221b]">Add Institutional or Trusted Guardian</span>
                <div className="mt-2 grid gap-3 sm:grid-cols-4">
                  <input
                    type="text"
                    placeholder="Guardian Name"
                    value={newGName}
                    onChange={(e) => setNewGName(e.target.value)}
                    className="rounded border border-[#dce4dc] px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Role (e.g. Family Doctor)"
                    value={newGRole}
                    onChange={(e) => setNewGRole(e.target.value)}
                    className="rounded border border-[#dce4dc] px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Contact / Email"
                    value={newGContact}
                    onChange={(e) => setNewGContact(e.target.value)}
                    className="rounded border border-[#dce4dc] px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddGuardian}
                    className="rounded bg-[#17221b] px-3 py-1.5 font-bold text-white hover:bg-black"
                  >
                    + Add Guardian
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Executor Designation */}
          {step === 3 && (
            <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4">
              <div className="border-b border-[#edf0ed] pb-3">
                <h3 className="text-lg font-bold text-[#17221b]">Step 4 — Executor Designation</h3>
                <p className="text-xs text-[#718077]">
                  Specify the legal entity or person authorized to execute the digital will and claim institutional assets.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  `Law Firm — ${lawFirm.name}`,
                  "Institutional Co-Trustee & Law Firm",
                  "Family Executor named in Physical Will",
                  "Independent Chartered Accountant",
                ].map((opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 text-xs transition ${
                      executor === opt ? "border-[#a3e635] bg-[#f8faf4] ring-1 ring-[#a3e635]" : "border-[#e1e8e1] hover:bg-[#fafbfa]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="executor"
                        checked={executor === opt}
                        onChange={() => setExecutor(opt)}
                        className="accent-[#34a853]"
                      />
                      <div>
                        <div className="font-bold text-sm text-[#17221b]">{opt}</div>
                        <p className="text-[11px] text-[#718077]">
                          Authorized to trigger contract distribution and distribute legal claim packets to banks.
                        </p>
                      </div>
                    </div>
                    {opt.includes(lawFirm.name) && (
                      <span className="rounded bg-[#eaf4df] px-2 py-0.5 text-[10px] font-bold text-[#276332]">
                        Recommended
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: Recovery Settings */}
          {step === 4 && (
            <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4">
              <div className="border-b border-[#edf0ed] pb-3">
                <h3 className="text-lg font-bold text-[#17221b]">Step 5 — Inactivity & Veto Time-Locks</h3>
                <p className="text-xs text-[#718077]">
                  Configure heartbeat thresholds and the safety cancellation window for the client.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-[#e1e8e1] p-4 text-xs">
                  <label className="font-bold text-[#17221b] block mb-1">Inactivity Period Before Watch</label>
                  <p className="text-[11px] text-[#718077] mb-3">
                    If the client misses regular check-ins past this threshold, guardians are notified.
                  </p>
                  <select
                    value={inactivityDays}
                    onChange={(e) => setInactivityDays(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 text-xs font-semibold text-[#17221b]"
                  >
                    <option value={14}>14 days (High frequency)</option>
                    <option value={30}>30 days (Standard estate default)</option>
                    <option value={60}>60 days (Relaxed schedule)</option>
                    <option value={90}>90 days (Quarterly check-in)</option>
                  </select>
                </div>

                <div className="rounded-xl border border-[#e1e8e1] p-4 text-xs">
                  <label className="font-bold text-[#17221b] block mb-1">Owner Veto Window</label>
                  <p className="text-[11px] text-[#718077] mb-3">
                    After death cert and guardian approvals, this delay allows the living client to cancel any false recovery.
                  </p>
                  <select
                    value={vetoHours}
                    onChange={(e) => setVetoHours(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 text-xs font-semibold text-[#17221b]"
                  >
                    <option value={24}>24 hours (Expedited)</option>
                    <option value={48}>48 hours (Standard legal default)</option>
                    <option value={72}>72 hours (3 business days)</option>
                    <option value={168}>7 days (Maximum protection)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Review & Seal */}
          {step === 5 && (
            <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4">
              <div className="border-b border-[#edf0ed] pb-3">
                <h3 className="text-lg font-bold text-[#17221b]">Step 6 — Final Fiduciary Review</h3>
                <p className="text-xs text-[#718077]">
                  Verify client parameters before generating the on-chain vault and client onboarding link.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-lg bg-[#f8faf7] p-3 border border-[#edf0ed]">
                  <span className="text-[10px] uppercase font-bold text-[#718077]">Client</span>
                  <div className="font-bold text-[#17221b] mt-0.5">{clientName}</div>
                  <div className="text-[11px] text-[#718077]">{clientEmail}</div>
                  <div className="text-[10px] font-mono text-[#869188]">{clientWallet}</div>
                </div>

                <div className="rounded-lg bg-[#f8faf7] p-3 border border-[#edf0ed]">
                  <span className="text-[10px] uppercase font-bold text-[#718077]">Executor</span>
                  <div className="font-bold text-[#17221b] mt-0.5">{executor}</div>
                  <div className="text-[11px] text-[#718077]">Fiduciary Nominee on Record</div>
                </div>

                <div className="rounded-lg bg-[#f8faf7] p-3 border border-[#edf0ed]">
                  <span className="text-[10px] uppercase font-bold text-[#718077]">Guardian Threshold</span>
                  <div className="font-bold text-[#17221b] mt-0.5">{requiredApprovals} of {guardians.length} required</div>
                  <div className="text-[11px] text-[#718077]">{guardians.map((g) => g.name).join(", ")}</div>
                </div>

                <div className="rounded-lg bg-[#f8faf7] p-3 border border-[#edf0ed]">
                  <span className="text-[10px] uppercase font-bold text-[#718077]">Timers</span>
                  <div className="font-bold text-[#17221b] mt-0.5">Inactivity: {inactivityDays}d · Veto: {vetoHours}h</div>
                  <div className="text-[11px] text-[#718077]">Client safety window enabled</div>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-[#718077]">Heir Distribution</span>
                <div className="mt-1 divide-y divide-[#edf0ed] rounded-lg border border-[#e1e8e1] text-xs">
                  {heirs.map((h) => (
                    <div key={h.id} className="flex justify-between p-2.5">
                      <span><b>{h.name}</b> ({h.relationship})</span>
                      <span className="font-bold text-[#276332]">{h.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {!isPercentageValid && (
                <div className="rounded-lg bg-[#fef2f2] p-3 text-xs text-[#b91c1c] font-semibold">
                  ⚠ Heir allocation must total exactly 100% before you can create the vault. Current total: {totalPercentage}%.
                </div>
              )}
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between border-t border-[#e1e8e1] pt-4">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
              className="rounded-lg border border-[#dce4dc] px-4 py-2 text-xs font-semibold text-[#2b382e] hover:bg-[#f5f7f4] disabled:opacity-40"
            >
              ← Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={step === 1 && !isPercentageValid}
                onClick={() => setStep(step + 1)}
                className="rounded-lg bg-[#17221b] px-5 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-40"
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                disabled={!isPercentageValid}
                onClick={handleCreate}
                className="rounded-lg bg-[#a3e635] px-6 py-2.5 text-xs font-bold text-[#17221b] shadow-sm hover:brightness-95 disabled:opacity-40"
              >
                Create Client Vault
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
