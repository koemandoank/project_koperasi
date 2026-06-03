import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const newMemberNames = [
  'Eka Saputra', 'Tri Wahyuni', 'Kartika Sari', 'Dian Wijaya', 'Joko Susilo',
  'Bambang Hermawan', 'Sri Utami', 'Ani Lestari', 'Hendra Setiawan', 'Agus Raharjo',
  'Dewi Sartika', 'Maria Ulfah', 'Rudi Hartono', 'Ahmad Fauzi', 'Slamet Riyadi'
]

function getRandomDate(start: Date, end: Date): Date {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  const day = date.getDay()
  if (day === 6) { // Saturday -> Friday
    date.setDate(date.getDate() - 1)
  } else if (day === 0) { // Sunday -> Monday
    date.setDate(date.getDate() + 1)
  }
  return date
}

function getRandomTimeOnDate(date: Date): Date {
  const newDate = new Date(date)
  const hours = 8 + Math.floor(Math.random() * 9) // 08:00 to 17:00
  const minutes = Math.floor(Math.random() * 60)
  const seconds = Math.floor(Math.random() * 60)
  newDate.setHours(hours, minutes, seconds, 0)
  return newDate
}

async function main() {
  console.log("=======================================================================")
  console.log("=== STARTING ACTIVE HISTORY GENERATOR SEEDING ===")
  console.log("=======================================================================\n")

  const unit = await prisma.unit.findFirst({ where: { code: 'U-001' } })
  const unitId = unit ? unit.id : BigInt(1)

  const cashier = await prisma.user.findFirst({
    where: { role: { in: ['superadmin', 'admin', 'kasir'] } }
  })
  const cashierId = cashier ? cashier.id : BigInt(1)

  const availableProducts = await prisma.products.findMany({
    where: {
      category_id: { not: BigInt(4) }, // Exclude consignment
      is_active: true
    }
  })

  if (availableProducts.length === 0) {
    throw new Error("No products available to generate orders.")
  }

  // 1. Generate 15 members
  console.log("--- STEP 1: Seeding 15 New Members & Users ---")
  const lastMember = await prisma.member.findFirst({
    orderBy: { id: 'desc' }
  })

  let startIndex = 21
  if (lastMember) {
    const codeNum = parseInt(lastMember.member_code.replace("MBR-", ""))
    if (!isNaN(codeNum)) {
      startIndex = codeNum + 1
    }
  }

  const hashedPassword = await bcrypt.hash('654321', 10)
  const newMembersCount = 15

  for (let i = 0; i < newMembersCount; i++) {
    const idx = startIndex + i
    const member_code = `MBR-${String(idx).padStart(4, '0')}`
    const nik = `S${String(idx).padStart(4, '0')}`
    const full_name = newMemberNames[i % newMemberNames.length]
    const email = `anggota${idx}@koperasi.digital`
    const phone = `0812${String(10000000 + idx)}`
    const username = `anggota${idx}`

    const joinDate = getRandomDate(new Date('2025-06-01'), new Date('2026-04-01'))

    const member = await prisma.member.create({
      data: {
        member_code,
        nik,
        full_name,
        email,
        phone,
        join_date: joinDate,
        status: 'active',
        unit_id: unitId,
        created_at: joinDate,
        updated_at: joinDate
      }
    })

    await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'anggota',
        member_id: member.id,
        is_active: true,
        created_at: joinDate,
        updated_at: joinDate
      }
    })

    // SP saving (Simpanan Pokok)
    const spSaving = await prisma.savings.create({
      data: {
        member_id: member.id,
        saving_type_id: BigInt(3),
        balance: 300000,
        total_deposit: 300000,
        created_at: joinDate,
        updated_at: joinDate
      }
    })

    await prisma.saving_transactions.create({
      data: {
        savings_id: spSaving.id,
        member_id: member.id,
        type: "deposit",
        amount: 300000,
        balance_before: 0,
        balance_after: 300000,
        reference_no: `TX-SP-${member.member_code}`,
        note: "Setoran Awal Simpanan Pokok",
        processed_by: cashierId,
        transaction_at: joinDate,
        created_at: joinDate,
        updated_at: joinDate
      }
    })

    // SW saving (Simpanan Wajib)
    await prisma.savings.create({
      data: {
        member_id: member.id,
        saving_type_id: BigInt(1),
        balance: 0,
        total_deposit: 0,
        created_at: joinDate,
        updated_at: joinDate
      }
    })

    // SS saving (Simpanan Sukarela)
    const ssSaving = await prisma.savings.create({
      data: {
        member_id: member.id,
        saving_type_id: BigInt(2),
        balance: 50000,
        total_deposit: 50000,
        created_at: joinDate,
        updated_at: joinDate
      }
    })

    await prisma.saving_transactions.create({
      data: {
        savings_id: ssSaving.id,
        member_id: member.id,
        type: "deposit",
        amount: 50000,
        balance_before: 0,
        balance_after: 50000,
        reference_no: `TX-SS-INIT-${member.member_code}`,
        note: "Setoran Awal Simpanan Sukarela",
        processed_by: cashierId,
        transaction_at: joinDate,
        created_at: joinDate,
        updated_at: joinDate
      }
    })

    console.log(`  ✅ Created Member ${member_code} (${full_name}) and initialized accounts.`)
  }
  console.log()

  // 2. Backfill empty workdays
  console.log("--- STEP 2: Backfilling Empty Workdays with Mock Transactions ---")
  const startDate = new Date('2025-05-18')
  const endDate = new Date('2026-06-03')
  
  const allMembers = await prisma.member.findMany({
    where: { status: "active" }
  })

  let emptyDaysCount = 0
  let generatedSavingTrx = 0
  let generatedOrders = 0

  let current = new Date(startDate)
  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Skip Saturday and Sunday
      current.setDate(current.getDate() + 1)
      continue
    }

    const dayStart = new Date(current)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(current)
    dayEnd.setHours(23, 59, 59, 999)

    const countSavingTrx = await prisma.saving_transactions.count({
      where: {
        transaction_at: { gte: dayStart, lte: dayEnd }
      }
    })

    const countOrders = await prisma.orders.count({
      where: {
        ordered_at: { gte: dayStart, lte: dayEnd }
      }
    })

    if (countSavingTrx === 0 && countOrders === 0) {
      emptyDaysCount++
      
      // Filter members who joined before/on this day
      const eligibleMembers = allMembers.filter(m => m.join_date <= dayStart)
      if (eligibleMembers.length > 0) {
        const dateStr = dayStart.toISOString().split("T")[0]
        
        // A. Generate random saving transactions (1-2)
        const savingTrxCount = 1 + Math.floor(Math.random() * 2)
        for (let j = 0; j < savingTrxCount; j++) {
          const randMember = eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)]
          const ssSaving = await prisma.savings.findFirst({
            where: { member_id: randMember.id, saving_type_id: BigInt(2) }
          })
          if (ssSaving) {
            const amount = 10000 * (1 + Math.floor(Math.random() * 15)) // Rp 10.000 to Rp 150.000
            const balanceBefore = Number(ssSaving.balance)
            const balanceAfter = balanceBefore + amount
            const trxTime = getRandomTimeOnDate(dayStart)

            await prisma.saving_transactions.create({
              data: {
                savings_id: ssSaving.id,
                member_id: randMember.id,
                type: "deposit",
                amount,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                reference_no: `TX-SS-${randMember.member_code}-${dateStr.replace(/-/g, "")}-${j}`,
                note: "Setoran Simpanan Sukarela (Simulasi)",
                processed_by: cashierId,
                transaction_at: trxTime,
                created_at: trxTime,
                updated_at: trxTime
              }
            })

            await prisma.savings.update({
              where: { id: ssSaving.id },
              data: {
                balance: balanceAfter,
                total_deposit: { increment: amount },
                updated_at: new Date()
              }
            })

            generatedSavingTrx++
          }
        }

        // B. Generate random POS orders (1-2)
        const orderCount = 1 + Math.floor(Math.random() * 2)
        for (let j = 0; j < orderCount; j++) {
          const randMember = eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)]
          const trxTime = getRandomTimeOnDate(dayStart)
          const orderNo = `ORD-${dateStr.replace(/-/g, "")}-${String(j).padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`

          const order = await prisma.orders.create({
            data: {
              order_no: orderNo,
              member_id: randMember.id,
              unit_id: unitId,
              channel: "pos",
              subtotal: 0,
              discount: 0,
              grand_total: 0,
              payment_method: "cash",
              payment_status: "paid",
              order_status: "delivered",
              cashier_id: cashierId,
              ordered_at: trxTime,
              paid_at: trxTime,
              created_at: trxTime,
              updated_at: trxTime
            }
          })

          // Generate 1-3 items
          const itemsCount = 1 + Math.floor(Math.random() * 3)
          let subtotal = 0
          const shuffledProducts = [...availableProducts].sort(() => 0.5 - Math.random())

          for (let k = 0; k < Math.min(itemsCount, shuffledProducts.length); k++) {
            const product = shuffledProducts[k]
            const qty = 1 + Math.floor(Math.random() * 2)
            const itemSubtotal = qty * Number(product.price)
            subtotal += itemSubtotal

            await prisma.order_items.create({
              data: {
                order_id: order.id,
                product_id: product.id,
                product_name: product.name,
                qty,
                unit_price: product.price,
                purchase_price: product.purchase_price,
                subtotal: itemSubtotal,
                created_at: trxTime,
                updated_at: trxTime
              }
            })
          }

          // Update order totals
          await prisma.orders.update({
            where: { id: order.id },
            data: {
              subtotal,
              grand_total: subtotal
            }
          })

          // Create payment record
          await prisma.order_payments.create({
            data: {
              order_id: order.id,
              payment_method: "cash",
              amount: subtotal,
              payment_status: "captured",
              paid_at: trxTime,
              created_at: trxTime,
              updated_at: trxTime
            }
          })

          generatedOrders++
        }
      }
    }

    current.setDate(current.getDate() + 1)
  }

  console.log(`  Total empty workdays found and filled: ${emptyDaysCount}`)
  console.log(`  Total mock saving transactions generated: ${generatedSavingTrx}`)
  console.log(`  Total mock POS orders (and payments) generated: ${generatedOrders}`)
  console.log()

  console.log("=======================================================================")
  console.log("=== ACTIVE HISTORY GENERATOR COMPLETED ===")
  console.log("=======================================================================")
}

main().catch(console.error).finally(() => prisma.$disconnect())
