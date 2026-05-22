import { updateMember } from "../src/lib/actions/members";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Let's test updating the unit_id of Rian Nuriana (id 16) from 4 to 5.
  console.log("Before:");
  const before = await prisma.member.findUnique({
    where: { id: BigInt(16) }
  });
  console.log({ id: Number(before?.id), name: before?.full_name, unit_id: Number(before?.unit_id) });

  console.log("Updating via Server Action...");
  const res = await updateMember(16, {
    nik: before?.nik,
    full_name: before?.full_name,
    email: before?.email,
    phone: before?.phone,
    unit_id: "5", // MEI Plant
    role: "anggota"
  });
  console.log("Action result:", res);

  console.log("After:");
  const after = await prisma.member.findUnique({
    where: { id: BigInt(16) }
  });
  console.log({ id: Number(after?.id), name: after?.full_name, unit_id: Number(after?.unit_id) });

  // Restore back to 4
  await updateMember(16, {
    nik: before?.nik,
    full_name: before?.full_name,
    email: before?.email,
    phone: before?.phone,
    unit_id: "4",
    role: "anggota"
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
