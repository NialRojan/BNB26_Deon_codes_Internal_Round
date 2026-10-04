import { PrismaClient } from "@prisma/client";
import { IWebAuthnRepository, WebAuthnCredentialRecord } from "./interfaces.js";
import { prisma as defaultPrisma } from "../database/prisma.js";

export class WebAuthnRepository implements IWebAuthnRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  private get model() {
    return (this.db as any).webAuthnCredential;
  }

  async create(data: {
    ownerId: string;
    credentialId: string;
    publicKey: string;
    counter?: bigint | number;
    transports?: string[] | null;
  }): Promise<WebAuthnCredentialRecord> {
    const counterBigInt = typeof data.counter === "number" ? BigInt(data.counter) : data.counter ?? 0n;
    const transportsStr = data.transports ? JSON.stringify(data.transports) : null;

    return this.model.create({
      data: {
        ownerId: data.ownerId,
        credentialId: data.credentialId,
        publicKey: data.publicKey,
        counter: counterBigInt,
        transports: transportsStr,
      },
    });
  }

  async findById(id: string): Promise<WebAuthnCredentialRecord | null> {
    return this.model.findUnique({
      where: { id },
    });
  }

  async findByCredentialId(credentialId: string): Promise<WebAuthnCredentialRecord | null> {
    return this.model.findUnique({
      where: { credentialId },
    });
  }

  async findManyByOwnerId(ownerId: string): Promise<WebAuthnCredentialRecord[]> {
    return this.model.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateCounterAndUsage(
    id: string,
    counter: bigint | number,
    lastUsedAt: Date = new Date()
  ): Promise<WebAuthnCredentialRecord> {
    const counterBigInt = typeof counter === "number" ? BigInt(counter) : counter;

    return this.model.update({
      where: { id },
      data: {
        counter: counterBigInt,
        lastUsedAt,
      },
    });
  }

  async deleteByCredentialId(ownerId: string, credentialId: string): Promise<boolean> {
    const existing = await this.model.findFirst({
      where: { ownerId, credentialId },
    });
    if (!existing) {
      return false;
    }
    await this.model.delete({
      where: { id: existing.id },
    });
    return true;
  }
}
