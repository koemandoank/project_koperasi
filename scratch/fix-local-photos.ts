import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Ganti photo_path yang berupa path lokal (/uploads/...) dengan URL
 * ui-avatars.com berdasarkan nama anggota, agar tampil di Vercel.
 */
async function fixLocalPhotoPaths() {
  const members = await prisma.member.findMany({
    where: { photo_path: { not: null } },
    select: { id: true, full_name: true, photo_path: true },
  })

  const localPathMembers = members.filter(m =>
    m.photo_path?.startsWith("/uploads/") || m.photo_path?.startsWith("./")
  )

  console.log(`Found ${localPathMembers.length} members with local photo paths:`)
  localPathMembers.forEach(m => console.log(`  ID:${m.id} | ${m.full_name} | ${m.photo_path}`))

  if (localPathMembers.length === 0) {
    console.log("Nothing to fix.")
    return
  }

  for (const member of localPathMembers) {
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name)}&background=random&size=200`
    await prisma.member.update({
      where: { id: member.id },
      data: { photo_path: avatarUrl },
    })
    console.log(`✅ Updated ID:${member.id} ${member.full_name} → ${avatarUrl}`)
  }

  console.log(`\nDone. Fixed ${localPathMembers.length} records.`)
}

fixLocalPhotoPaths()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
