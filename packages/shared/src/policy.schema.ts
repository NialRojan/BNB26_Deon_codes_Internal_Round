import { z } from "zod";

/**
 * Heirloom Release Policy Schema (Owner-signed)
 * Defines the immutable rules under which a vault transitions and releases assets.
 */

export const GuardianRuleSchema = z.object({
  guardianId: z.string().min(1),
  name: z.string().min(1),
  contactChannel: z.enum(["PUSH", "SMS", "WHATSAPP", "EMAIL"]),
  publicKey: z.string().min(1), // Address or secp256k1/Ed25519 public key
  relationship: z.string().optional(),
});

export const BeneficiaryAssignmentSchema = z.object({
  beneficiaryId: z.string().min(1),
  name: z.string().min(1),
  addressOrKey: z.string().min(1),
  assignedStage: z.number().int().min(1).max(3),
  shardIndex: z.number().int().optional(),
});

export const ReleasePolicySchema = z.object({
  version: z.string().default("1.0.0"),
  vaultId: z.string().min(1),
  ownerAddress: z.string().min(1),

  heartbeat: z.object({
    intervalDays: z.number().int().min(1).max(365).default(30),
    gracePeriodDays: z.number().int().min(1).max(30).default(7),
    maxMissedPingsBeforeWatch: z.number().int().min(1).max(10).default(3),
    channels: z.array(z.enum(["PUSH", "BIOMETRIC", "MESSAGING_BOT", "EMAIL"])).min(1),
  }),

  guardians: z.object({
    thresholdK: z.number().int().min(1),
    totalN: z.number().int().min(1),
    list: z.array(GuardianRuleSchema),
  }).refine((data) => data.thresholdK <= data.totalN && data.list.length === data.totalN, {
    message: "Threshold k must be <= total n, and guardian list count must equal total n",
  }),

  vetoWindow: z.object({
    baseWindowDays: z.number().int().min(3).max(60).default(14),
    highRiskExtensionDays: z.number().int().min(0).max(30).default(14),
  }),

  stagedRelease: z.object({
    enabled: z.boolean().default(true),
    stages: z.array(
      z.object({
        stageNumber: z.number().int().min(1).max(3),
        title: z.string().min(1),
        description: z.string(),
        delayAfterApprovalHours: z.number().int().min(0).default(0),
      })
    ),
  }),

  beneficiaries: z.array(BeneficiaryAssignmentSchema),

  /** Owner cryptographic signature over canonical JSON of the policy */
  ownerSignature: z.string().optional(),
  createdAt: z.string().datetime().optional(),
});

export type GuardianRule = z.infer<typeof GuardianRuleSchema>;
export type BeneficiaryAssignment = z.infer<typeof BeneficiaryAssignmentSchema>;
export type ReleasePolicy = z.infer<typeof ReleasePolicySchema>;
