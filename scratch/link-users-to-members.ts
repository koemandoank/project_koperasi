import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const usersWithoutMembers = await prisma.user.findMany({
    where: { member_id: null },
  });

  console.log(`Found ${usersWithoutMembers.length} users without member records.`);

  // Get a default unit (e.g. first active unit, or default to HO Jakarta)
  const defaultUnit = await prisma.unit.findFirst({
    where: { is_active: true }
  });

  if (!defaultUnit) {
    throw new Error("No active unit found in database!");
  }

  console.log(`Using default unit: ${defaultUnit.name} (ID: ${defaultUnit.id})`);

  for (const user of usersWithoutMembers) {
    const count = await prisma.member.count();
    const memberCode = `MBR-${String(count + 1).padStart(4, "0")}`;
    
    // Generate unique NIK based on username
    let nik = "";
    if (user.username === "admin") nik = "ADM001";
    else if (user.username === "superadmin") nik = "SAD001";
    else if (user.username === "pengurus01") nik = "PEN001";
    else if (user.username === "kasir01") nik = "KAS001";
    else if (user.username === "ketua01") nik = "KET001";
    else nik = `USR${String(user.id).padStart(3, "0")}`;

    const fullName = user.username.charAt(0).toUpperCase() + user.username.slice(1);

    await prisma.$transaction(async (tx) => {
      // Create Member record
      const member = await tx.member.create({
        data: {
          member_code: memberCode,
          nik,
          full_name: fullName,
          email: user.email,
          phone: "081200000000",
          unit_id: defaultUnit.id,
          join_date: new Date(),
          status: "active",
          photo_path: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
        }
      });

      // Link User to Member
      await tx.user.update({
        where: { id: user.id },
        data: { member_id: member.id }
      });

      console.log(`Created member record ${memberCode} (NIK: ${nik}) for user ${user.username} and linked them.`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
