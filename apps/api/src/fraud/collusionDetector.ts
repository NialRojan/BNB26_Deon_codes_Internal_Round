import { RiskFactor } from "@heirloom/shared";

export interface GuardianAttestationSubmission {
  guardianId: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  submittedAt: Date;
}

export class CollusionDetector {
  /**
   * Helper to extract IPv4 /24 or IPv6 /48 subnet.
   */
  static extractSubnet(ip: string): string | null {
    const trimmed = ip.trim();
    if (trimmed.includes(".")) {
      // IPv4: /24 subnet
      const parts = trimmed.split(".");
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      }
    } else if (trimmed.includes(":")) {
      // IPv6: /48 prefix
      const parts = trimmed.split(":");
      if (parts.length >= 3) {
        return `${parts.slice(0, 3).join(":")}::/48`;
      }
    }
    return null;
  }

  /**
   * Evaluates guardian submissions to detect collusion vectors:
   * 1. Shared device fingerprint
   * 2. Identical IP address
   * 3. IPv4 /24 or IPv6 /48 subnet sharing
   * 4. Temporal clustering (rapid attestations within a tight window)
   */
  static detect(
    submissions: GuardianAttestationSubmission[],
    temporalWindowMs = 120_000 // 2 minutes default
  ): RiskFactor[] {
    const factors: RiskFactor[] = [];
    if (submissions.length < 2) return factors;

    // 1. Check shared device fingerprints
    const fingerprints = new Map<string, string[]>();
    for (const sub of submissions) {
      if (sub.deviceFingerprint) {
        const list = fingerprints.get(sub.deviceFingerprint) || [];
        if (!list.includes(sub.guardianId)) list.push(sub.guardianId);
        fingerprints.set(sub.deviceFingerprint, list);
      }
    }

    for (const [fp, guardians] of fingerprints.entries()) {
      if (guardians.length > 1) {
        factors.push({
          code: "DEVICE_FINGERPRINT_MISMATCH",
          severity: "CRITICAL",
          score: 0.95,
          description: `Guardians ${guardians.join(", ")} attested from identical physical device fingerprint: ${fp}`,
          detectedAt: new Date().toISOString(),
          metadata: { deviceFingerprint: fp, guardians },
        });
      }
    }

    // 2. Check identical IP addresses
    const exactIps = new Map<string, string[]>();
    for (const sub of submissions) {
      if (sub.ipAddress) {
        const list = exactIps.get(sub.ipAddress) || [];
        if (!list.includes(sub.guardianId)) list.push(sub.guardianId);
        exactIps.set(sub.ipAddress, list);
      }
    }

    const flaggedIps = new Set<string>();
    for (const [ip, guardians] of exactIps.entries()) {
      if (guardians.length > 1) {
        flaggedIps.add(ip);
        factors.push({
          code: "GUARDIAN_COLLUSION",
          severity: "HIGH",
          score: 0.85,
          description: `Guardians ${guardians.join(", ")} submitted attestations from identical IP address: ${ip}`,
          detectedAt: new Date().toISOString(),
          metadata: { collusionType: "IDENTICAL_IP", ipAddress: ip, guardians },
        });
      }
    }

    // 3. Check Subnet (/24 IPv4 or /48 IPv6)
    const subnets = new Map<string, { guardians: Set<string>; ips: Set<string> }>();
    for (const sub of submissions) {
      if (sub.ipAddress) {
        const subnet = this.extractSubnet(sub.ipAddress);
        if (subnet) {
          const entry = subnets.get(subnet) || { guardians: new Set<string>(), ips: new Set<string>() };
          entry.guardians.add(sub.guardianId);
          entry.ips.add(sub.ipAddress);
          subnets.set(subnet, entry);
        }
      }
    }

    for (const [subnet, entry] of subnets.entries()) {
      // Only flag subnet if multiple distinct guardians are on the same subnet
      // and not already fully captured as an identical IP
      if (entry.guardians.size > 1 && entry.ips.size > 1) {
        factors.push({
          code: "GUARDIAN_COLLUSION",
          severity: "HIGH",
          score: 0.70,
          description: `Guardians ${Array.from(entry.guardians).join(", ")} submitted attestations from the same network subnet: ${subnet}`,
          detectedAt: new Date().toISOString(),
          metadata: {
            collusionType: "SHARED_SUBNET",
            subnet,
            guardians: Array.from(entry.guardians),
            ipAddresses: Array.from(entry.ips),
          },
        });
      }
    }

    // 4. Temporal clustering (rapid attestations within temporalWindowMs)
    const sorted = [...submissions].sort(
      (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

    const clusterGuardians = new Set<string>();
    let minGapMs = Infinity;

    for (let i = 0; i < sorted.length - 1; i++) {
      const delta = Math.abs(
        new Date(sorted[i + 1].submittedAt).getTime() - new Date(sorted[i].submittedAt).getTime()
      );
      if (delta <= temporalWindowMs && sorted[i].guardianId !== sorted[i + 1].guardianId) {
        clusterGuardians.add(sorted[i].guardianId);
        clusterGuardians.add(sorted[i + 1].guardianId);
        if (delta < minGapMs) minGapMs = delta;
      }
    }

    if (clusterGuardians.size > 1) {
      const deltaSeconds = (minGapMs / 1000).toFixed(0);
      factors.push({
        code: "GUARDIAN_COLLUSION",
        severity: "HIGH",
        score: 0.65,
        description: `Guardians ${Array.from(clusterGuardians).join(", ")} submitted attestations in rapid succession (within ${deltaSeconds}s)`,
        detectedAt: new Date().toISOString(),
        metadata: {
          collusionType: "RAPID_CONCURRENT_ATTESTATIONS",
          guardians: Array.from(clusterGuardians),
          windowMs: temporalWindowMs,
          minGapSeconds: parseFloat(deltaSeconds),
        },
      });
    }

    return factors;
  }
}
