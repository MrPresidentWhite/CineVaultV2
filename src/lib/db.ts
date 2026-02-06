import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseUrl } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const logLevel = process.env.PRISMA_LOG_LEVEL;
const validLevels = ["query", "info", "warn", "error"] as const;
const logArray =
  process.env.NODE_ENV === "development" &&
  logLevel &&
  logLevel !== "none" &&
  validLevels.includes(logLevel as (typeof validLevels)[number])
    ? [logLevel as (typeof validLevels)[number]]
    : undefined;

function createPrismaClient() {
  const connectionString = getDatabaseUrl();
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: logArray,
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
