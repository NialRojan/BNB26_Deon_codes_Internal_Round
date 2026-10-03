import { PrismaClient, Owner, OwnerAvailability } from "@prisma/client";
import { IOwnerRepository } from "./interfaces.js";
import { prisma as defaultPrisma } from "../database/prisma.js";

export class OwnerRepository implements IOwnerRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async findById(id: string): Promise<Owner | null> {
    return this.db.owner.findUnique({
      where: { id },
      include: { availability: true },
    });
  }

  async findByExternalReference(ref: string): Promise<Owner | null> {
    return this.db.owner.findUnique({
      where: { externalReference: ref },
      include: { availability: true },
    });
  }

  async create(data: { externalReference: string; status?: string }): Promise<Owner> {
    const defaultIntervalDays = 30;
    const initialDueAt = new Date(Date.now() + defaultIntervalDays * 24 * 60 * 60 * 1000);

    return this.db.owner.create({
      data: {
        externalReference: data.externalReference,
        status: data.status ?? "ACTIVE",
        availability: {
          create: {
            state: "ACTIVE",
            missedCount: 0,
            heartbeatIntervalDays: defaultIntervalDays,
            gracePeriodDays: 7,
            nextCheckInDueAt: initialDueAt,
          },
        },
      },
      include: {
        availability: true,
      },
    });
  }

  async updateStatus(id: string, status: string): Promise<Owner> {
    return this.db.owner.update({
      where: { id },
      data: { status },
      include: { availability: true },
    });
  }

  async getAvailability(ownerId: string): Promise<OwnerAvailability | null> {
    return this.db.ownerAvailability.findUnique({
      where: { ownerId },
    });
  }

  async createAvailability(data: { ownerId: string; state?: string }): Promise<OwnerAvailability> {
    const defaultIntervalDays = 30;
    const initialDueAt = new Date(Date.now() + defaultIntervalDays * 24 * 60 * 60 * 1000);

    return this.db.ownerAvailability.create({
      data: {
        ownerId: data.ownerId,
        state: data.state ?? "ACTIVE",
        heartbeatIntervalDays: defaultIntervalDays,
        gracePeriodDays: 7,
        nextCheckInDueAt: initialDueAt,
      },
    });
  }

  async updateAvailability(
    ownerId: string,
    data: Partial<{
      state: string;
      lastHeartbeatAt: Date | null;
      nextCheckInDueAt: Date | null;
      heartbeatIntervalDays: number;
      gracePeriodDays: number;
      missedCount: number;
      stateReason: string | null;
    }>
  ): Promise<OwnerAvailability> {
    return this.db.ownerAvailability.upsert({
      where: { ownerId },
      update: data,
      create: {
        ownerId,
        state: data.state ?? "ACTIVE",
        lastHeartbeatAt: data.lastHeartbeatAt,
        nextCheckInDueAt: data.nextCheckInDueAt,
        heartbeatIntervalDays: data.heartbeatIntervalDays ?? 30,
        gracePeriodDays: data.gracePeriodDays ?? 7,
        missedCount: data.missedCount ?? 0,
        stateReason: data.stateReason,
      },
    });
  }
}
