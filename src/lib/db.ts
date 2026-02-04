import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const logLevel = process.env.PRISMA_LOG_LEVEL;
const log =
  logLevel === "none" || !logLevel
    ? undefined
    : (logLevel as "query" | "info" | "warn" | "error");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? log ?? "error" : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
