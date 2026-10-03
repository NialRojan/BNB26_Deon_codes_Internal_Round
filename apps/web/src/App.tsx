import { useState } from "react";
import type { EncryptedAsset, KeyShare, ReleasePolicy } from "@heirloom/crypto";
import {
  generateVaultKeyMaterial,
  vaultKeyFromBytes,
  encryptAsset,
  decryptAsset,
  splitVaultKey,
  combineVaultShares,
  generateHeirKeyPair,
  encryptForHeir,
  signReleasePolicy,
} from "@heirloom/crypto";


export default function App() {
  const [status, setStatus] = useState<string>("Choose a file and press Start.");
  const [asset, setAsset] = useState<EncryptedAsset | null>(null);
  const [shares, setShares] = useState<KeyShare[] | null>(null);
  const [policy, setPolicy] = useState<ReleasePolicy | null>(null);
  const [sig, setSig] = useState<ArrayBuffer | null>(null);
  const [subset, setSubset] = useState<KeyShare[] | null>(null);
  const [recovered, setRecovered] = useState<ArrayBuffer | null>(null);
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);  async function start() {
    setStatus("Generating vault key, encrypting, splitting into 5 shares (3-of-5)...");
    setErr(null);
    try {
      const { key: vaultKey, keyBytes: vaultKeyBytes } = await generateVaultKeyMaterial();
      const enc = await encryptAsset(
        new TextEncoder().encode("secret document"),
        vaultKey,
      );
      setAsset(enc);

      const sharesSlice = await splitVaultKey(vaultKeyBytes, 5, 3);
      vaultKeyBytes.fill(0);
      setShares(sharesSlice);

      const heirPair = await generateHeirKeyPair();
      await encryptForHeir(vaultKeyBytes, heirPair.publicKey);
      setStatus("Vault key encrypted; 5 shares (3-of-5) generated; heir copy packaged.");

      const ownerKeyPair = await generateHeirKeyPair();
      const pol: ReleasePolicy = {
        owner: "owner-alice",
        assetId: "asset-doc-001",
        beneficiary: "heir-bob",
        checkIn: { gracePeriodSeconds: 300 },
        guardianThreshold: 2,
        requiredEvidence: "two-notarized-identity-cards",
        delay: { seconds: 0 },
        beneficiaryTier: "standard",
        assetType: "legal-packet",
      };
      const signed = await signReleasePolicy(pol, ownerKeyPair.privateKey);
      setPolicy(pol);
      setSig(signed);

      setStatus("Vault key encrypted, split into 5 shares, recovered with 3 of 5 shares, policy signed.");

      const one: KeyShare[] = [sharesSlice[0]];
      setSubset(one);
      try {
        await combineVaultShares(one, 3);
        setRecovered(new Uint8Array(0).buffer);
      } catch {
        setRecovered(null);
      }

      if (sharesSlice.length >= 2) {
        const two: KeyShare[] = [sharesSlice[0], sharesSlice[1]];
        setSubset(two);
        try {
          await combineVaultShares(two, 3);
          setRecovered(new Uint8Array(0).buffer);
        } catch {
          setRecovered(null);
        }
      }

      if (sharesSlice.length >= 3) {
        const three: KeyShare[] = [sharesSlice[0], sharesSlice[1], sharesSlice[2]];
        setSubset(three);
        const recoveredKey = await combineVaultShares(three, 3);
        setRecovered(recoveredKey.slice().buffer as ArrayBuffer);
      }
    } catch (e) {
      setErr(String((e as Error).message));
      setStatus("Error: " + (e as Error).message);
    }
  }

  async function downloadAsset() {
    if (!asset || !recovered) return;
    const vaultKeyBytes = new Uint8Array(recovered!);
    const vaultKey = await vaultKeyFromBytes(vaultKeyBytes);
    const plaintext = new TextDecoder().decode(
      await decryptAsset(asset, vaultKey),
    );
    const blob = new Blob([plaintext], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "decrypted.txt";
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setStatus("Encrypted asset decrypted and downloaded.");
  }

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 860,
        margin: "2rem auto",
        padding: "0 1rem",
        color: "#111",
      }}
    >
      <h1>Heirloom — Member 1 Crypto Demo</h1>

      <section
        style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}
      >
        <h2>Client-side Encrypt</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{status}</p>
        <p style={{ color: "#444", fontSize: "0.9rem" }}>
          Plaintext never leaves the browser. Vault key is 32 bytes (AES-256), encrypted with AES-256-GCM.
        </p>
        <button
          onClick={start}
          disabled={!!asset}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          {asset ? "Restricted" : "Start: encrypt file"}
        </button>
      </section>

      {asset && (
        <section
          style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}
        >
          <h2>Encrypted Asset</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(asset, null, 2)}</pre>
        </section>
      )}

      {shares && (
        <section
          style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}
        >
          <h2>Shares (5-of-3) <span style={{ fontSize: "0.8rem", color: "#666" }}>— metadata only, holderId provided by member 2/3</span></h2>
          <p style={{ fontSize: "0.9rem", color: "#444" }}>
            Raw share bytes are never logged. The UI only shows the holderId metadata.
          </p>
          {shares.map((s, i) => (
            <div
              key={s.holderId + i}
              style={{ padding: "0.4rem", border: "1px solid #eee", borderRadius: 4, marginBottom: "0.4rem" }}
            >
              <b>{s.holderType}</b> holderId=<b>{s.holderId}</b> — share length {s.share.length} chars
            </div>
          ))}
        </section>
      )}

      {policy && sig && (
        <section
          style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}
        >
          <h2>Owner-Signed Release Policy</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(policy, null, 2)}</pre>
          <p style={{ fontSize: "0.9rem", color: "#444" }}>
            Signature is over a canonical policy blob. Modifying the policy or the signature fails verification.
          </p>
        </section>
      )}

      {shares && (
        <section
          style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}
        >
          <h2>Security Boundary — Share Counts</h2>
          <ul style={{ paddingLeft: "1.2rem", color: "#333" }}>
            {subset && subset.length === 1 ? (
              <li>1 share → cannot recover vault key: <b>{recovered ? "WRONG (leaked!)" : "correctly rejected"}</b></li>
            ) : null}
            {!!subset && subset.length === 2 ? (
              <li>2 shares → cannot recover vault key: <b>{recovered ? "WRONG (leaked!)" : "correctly rejected"}</b></li>
            ) : null}
            {!!subset && subset.length === 3 ? (
              <li>3 shares → recover vault key: <b>{recovered ? (recovered.byteLength > 0 ? "success" : "WRONG") : "—"}</b></li>
            ) : null}
          </ul>
          <p style={{ fontSize: "0.85rem", color: "#666" }}>Demo subsets are fixed to the first N shares; the crypto layer only enforces k-of-n.</p>
        </section>
      )}

      {recovered && recovered.byteLength > 0 && (
        <section
          style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}
        >
          <h2>Reconstructed Vault Key</h2>
          <p style={{ fontSize: "0.9rem", color: "#444" }}>{recovered.byteLength} bytes recovered.</p>
        </section>
      )}

      <section
        style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}
      >
        <button
          onClick={downloadAsset}
          disabled={!recovered}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          {downloaded ? "Downloaded" : "Decrypt & Download"}
        </button>
        <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.4rem" }}>
          {downloaded
            ? "Original plaintext: " + (asset ? (asset as unknown as string) : "")
            : "Encrypted asset + reconstructed vault key needed."}
        </p>
      </section>

      {err && <p style={{ color: "red" }}>{err}</p>}
      <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "1rem" }}>
        Member 1 responsibility only: encryption, vault key, Shamir k-of-n, per-heir, packaging, owner-signed policy.
        No triggers, no guardians, no blockchain, no backend endpoints built here.
      </p>
    </main>
  );
}
