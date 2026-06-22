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
const globalForPrisma = globalThis as unknown as { prisma: any };

const createPrismaClient = () => {
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  return baseClient.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        let retries = 2; // Dicoba hingga 2 kali jika gagal koneksi
        while (retries >= 0) {
          try {
            return await query(args);
          } catch (error: any) {
            const isConnErr = 
              error.code === "P1001" ||
              error.code === "P1002" ||
              error.code === "P1003" ||
              error.code === "P1017" ||
              String(error).includes("Can't reach database server") ||
              String(error).includes("connection") ||
              String(error).includes("pool");

            if (isConnErr && retries > 0) {
              console.warn(`[Prisma Connection Warning] Stale connection detected during "${operation}" on "${model}". Reconnecting and retrying (${retries} left)...`);
              retries--;
              try {
                // Bersihkan pool lama dan hubungkan kembali
                await baseClient.$disconnect();
                await baseClient.$connect();
                continue;
              } catch (reconnectErr) {
                console.error("[Prisma Reconnect Error] Failed to reconnect:", reconnectErr);
              }
            }
            throw error;
          }
        }
      }
    }
  });
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
