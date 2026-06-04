import { getMyPinjaman } from "@/lib/actions/member-portal";
import { TokoPPOBClient } from "./ppob-client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

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
  
  let memberData = null;

  if (myPinjamanData) {
    const paylaterLimit = 2000000; // Rp 2.000.000 standard credit limit
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
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          Transaksi PPOB Koperasi
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gunakan limit Bayar Tempo koperasi Anda untuk berbagai kebutuhan transaksi digital secara instan dan aman.
        </p>
      </div>
      
      <TokoPPOBClient memberData={memberData} />
    </div>
  );
}
