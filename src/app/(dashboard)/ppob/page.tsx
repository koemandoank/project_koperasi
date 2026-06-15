import { getMyPinjaman } from "@/lib/actions/member-portal";
import { TokoPPOBClient } from "./ppob-client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLoanRules } from "@/lib/actions/loan-rules";
import { prisma } from "@/lib/db/prisma";

export const metadata = {
  title: "Transaksi PPOB Anggota",
  description: "Beli pulsa, token listrik, top up dompet digital, dan bayar tagihan bulanan menggunakan limit bayar tempo Koperasi Anda.",
};

export default async function PPOBMemberPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Load member paylater debts
  const myPinjamanData = await getMyPinjaman();
  const rules = await getLoanRules();
  const paylaterLimit = rules.max_paylater_debt?.enabled ? rules.max_paylater_debt.value : 2000000;
  
  let sukarelaBalance = 0;
  if (session.user.id) {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      select: { member_id: true }
    });
    if (user?.member_id) {
      const sukarelaType = await prisma.saving_types.findFirst({
        where: {
          OR: [
            { code: "SUKARELA" },
            { name: { contains: "Sukarela" } }
          ]
        }
      });
      if (sukarelaType) {
        const saving = await prisma.savings.findUnique({
          where: {
            member_id_saving_type_id: {
              member_id: user.member_id,
              saving_type_id: sukarelaType.id
            }
          },
          select: { balance: true }
        });
        sukarelaBalance = Number(saving?.balance ?? 0);
      }
    }
  }

  let memberData = null;

  if (myPinjamanData) {
    const paylaterSpent = myPinjamanData.paylater_debts.reduce(
      (sum: number, debt: any) => sum + debt.amount,
      0
    );
    const paylaterAvailable = paylaterLimit - paylaterSpent;

    memberData = {
      member_name: myPinjamanData.member_name,
      member_code: `KOP-${myPinjamanData.member_id.toString().padStart(5, "0")}`,
      paylater_limit: paylaterLimit,
      paylater_spent: paylaterSpent,
      paylater_available: paylaterAvailable,
      paylater_debts: myPinjamanData.paylater_debts,
      sukarela_balance: sukarelaBalance,
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          Transaksi PPOB Koperasi
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gunakan limit Bayar Tempo atau Saldo Simpanan Sukarela koperasi Anda untuk berbagai kebutuhan transaksi digital secara instan dan aman.
        </p>
      </div>
      
      <TokoPPOBClient memberData={memberData} />
    </div>
  );
}
