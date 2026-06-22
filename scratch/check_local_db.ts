import { PrismaClient } from '@prisma/client'

async function testConnection() {
  const localUrl = "mysql://root:@127.0.0.1:3306/koperasi_digital"
  console.log(`Connecting to local DB: ${localUrl}`)
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: localUrl
      }
    }
  })

  try {
    const swType = await prisma.saving_types.findFirst({
      where: { code: 'SW' }
    })
    console.log("Success! Connected to local database.")
    console.log("Current SW setting in local DB:", swType)
  } catch (error) {
    console.error("Failed to connect to local database:", error)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
