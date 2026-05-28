import { PrismaClient } from "@prisma/client"

const createPrismaClient = () => {
  const baseClient = new PrismaClient({
    log: ["error"]
  })

  return baseClient.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        let retries = 1
        while (retries >= 0) {
          try {
            return await query(args)
          } catch (error: any) {
            const isConnErr = 
              error.code === "P1001" ||
              error.code === "P1002" ||
              error.code === "P1003" ||
              error.code === "P1017" ||
              String(error).includes("Can't reach database server") ||
              String(error).includes("connection") ||
              String(error).includes("pool")

            if (isConnErr && retries > 0) {
              console.warn(`[Prisma Connection Warning] Stale connection detected during "${operation}" on "${model}". Reconnecting and retrying...`)
              retries--
              try {
                await baseClient.$disconnect()
                await baseClient.$connect()
                continue
              } catch (reconnectErr) {
                console.error("[Prisma Reconnect Error] Failed to reconnect:", reconnectErr)
              }
            }
            throw error
          }
        }
      }
    }
  })
}

const prisma = createPrismaClient()

async function main() {
  console.log("Testing extended prisma query...")
  const products = await prisma.loan_products.findMany()
  console.log(`Success! Loaded ${products.length} products.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
