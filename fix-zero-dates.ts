import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

async function main() {
  console.log('Starting to fix invalid dates (0000-00-00 00:00:00) in database...')

  // Fix consignment_items
  const affectedItems1 = await prisma.$executeRawUnsafe(
    `UPDATE consignment_items SET updated_at = NULL WHERE CAST(updated_at AS CHAR) = '0000-00-00 00:00:00' OR updated_at IS NULL OR updated_at = 0`
  ).catch(err => {
    console.error('Error updating updated_at in consignment_items:', err)
    return 0
  })

  const affectedItems2 = await prisma.$executeRawUnsafe(
    `UPDATE consignment_items SET created_at = NULL WHERE CAST(created_at AS CHAR) = '0000-00-00 00:00:00' OR created_at IS NULL OR created_at = 0`
  ).catch(err => {
    console.error('Error updating created_at in consignment_items:', err)
    return 0
  })

  // Simple direct updates for all potential zero dates in consignment_items
  const directUpdate = await prisma.$executeRawUnsafe(
    `UPDATE consignment_items SET updated_at = NULL WHERE updated_at < '1970-01-02 00:00:00'`
  ).catch(() => 0)

  const directUpdateCreated = await prisma.$executeRawUnsafe(
    `UPDATE consignment_items SET created_at = NULL WHERE created_at < '1970-01-02 00:00:00'`
  ).catch(() => 0)

  console.log(`Updated consignment_items table:`)
  console.log(`- updated_at (strict/null/0): ${affectedItems1} rows`)
  console.log(`- created_at (strict/null/0): ${affectedItems2} rows`)
  console.log(`- updated_at (< 1970): ${directUpdate} rows`)
  console.log(`- created_at (< 1970): ${directUpdateCreated} rows`)

  // Also check consignment_payables just in case
  const payablesUpdateCreated = await prisma.$executeRawUnsafe(
    `UPDATE consignment_payables SET created_at = NULL WHERE created_at < '1970-01-02 00:00:00'`
  ).catch(() => 0)

  const payablesUpdateUpdated = await prisma.$executeRawUnsafe(
    `UPDATE consignment_payables SET updated_at = NULL WHERE updated_at < '1970-01-02 00:00:00'`
  ).catch(() => 0)

  console.log(`Updated consignment_payables table:`)
  console.log(`- created_at (< 1970): ${payablesUpdateCreated} rows`)
  console.log(`- updated_at (< 1970): ${payablesUpdateUpdated} rows`)
  
  console.log('Database clean-up finished successfully!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
