import { PrismaClient } from "@prisma/client";

// Patch for BigInt serialization in JSON
if (!('toJSON' in BigInt.prototype)) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    get() {
      return () => this.toString();
    }
  });
}

// Mencegah PrismaClient membuat koneksi baru setiap kali file diubah selama development (HMR)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
