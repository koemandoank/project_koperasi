import { getAccountsPayable, getAccountsReceivable } from "@/lib/actions/accounts";
import { getSuppliers } from "@/lib/actions/procurement";
import { KeuanganClient } from "./keuangan-client";

export default async function KeuanganPage() {
  const [apRes, arRes, suppliersRes] = await Promise.all([
    getAccountsPayable(),
    getAccountsReceivable(),
    getSuppliers(),
  ]);

  const serializeAP = (aps: any[]) =>
    aps.map((ap) => ({
      id: Number(ap.id),
      invoice_no: ap.invoice_no,
      supplier_name: ap.suppliers?.supplier_name ?? "-",
      invoice_date: ap.invoice_date?.toISOString().split("T")[0] ?? "-",
      due_date: ap.due_date?.toISOString().split("T")[0] ?? "-",
      total_amount: Number(ap.total_amount),
      amount_paid: Number(ap.amount_paid),
      amount_due: Number(ap.amount_due),
      status: ap.status,
    }));

  const serializeAR = (ars: any[]) =>
    ars.map((ar) => ({
      id: Number(ar.id),
      invoice_no: ar.invoice_no,
      customer_name: ar.customer_name,
      invoice_date: ar.invoice_date?.toISOString().split("T")[0] ?? "-",
      due_date: ar.due_date?.toISOString().split("T")[0] ?? "-",
      total_amount: Number(ar.total_amount),
      amount_paid: Number(ar.amount_paid),
      amount_due: Number(ar.amount_due),
      status: ar.status,
    }));

  const aps = apRes.success ? serializeAP(apRes.data as any[]) : [];
  const ars = arRes.success ? serializeAR(arRes.data as any[]) : [];
  const suppliers = suppliersRes.success
    ? (suppliersRes.data as any[]).map((s) => ({ id: Number(s.id), name: s.supplier_name }))
    : [];

  // Aging summary
  const today = new Date();
  const apAging = { current: 0, overdue: 0 };
  aps.forEach((ap) => {
    const diff = (today.getTime() - new Date(ap.due_date).getTime()) / 86400000;
    if (diff > 0) apAging.overdue += ap.amount_due;
    else apAging.current += ap.amount_due;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Keuangan — Hutang & Piutang Dagang</h1>
        <p className="text-muted-foreground mt-1">
          Kelola Accounts Payable (AP), Accounts Receivable (AR), dan Aging Schedule.
        </p>
      </div>
      <KeuanganClient
        accountsPayable={aps}
        accountsReceivable={ars}
        suppliers={suppliers}
        apAging={apAging}
      />
    </div>
  );
}
