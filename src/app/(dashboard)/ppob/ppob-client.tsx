"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Smartphone,
  Zap,
  Wallet as EWalletIcon,
  Receipt,
  Coins,
  Lock,
  CheckCircle2,
  XCircle,
  Printer,
  Search,
  Building,
  CreditCard,
  ArrowRight,
  ChevronRight,
  Info,
  ShieldCheck,
  Loader2
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { executePpobTransactionPaylater } from "@/lib/actions/ppob-settings";

// ─── TYPES & INTERFACES ────────────────────────────────────────────────────────
interface PPOBClientProps {
  memberData: {
    member_name: string;
    member_code: string;
    paylater_limit: number;
    paylater_spent: number;
    paylater_available: number;
    paylater_debts: Array<{
      id: number;
      order_no: string;
      amount: number;
      ordered_at: string;
    }>;
  } | null;
}

interface ProductItem {
  id: string;
  name: string;
  price: number;
  actualPrice: number; // Harga setelah margin
  points: number; // SHU points
}

// ─── DUMMY DATA FOR PRODUCTS ───────────────────────────────────────────────────
const PROVIDER_PREFIXES: Record<string, string> = {
  // Telkomsel
  "0811": "Telkomsel", "0812": "Telkomsel", "0813": "Telkomsel", "0821": "Telkomsel", "0822": "Telkomsel", "0823": "Telkomsel", "0852": "Telkomsel", "0853": "Telkomsel", "0851": "Telkomsel",
  // Indosat
  "0814": "Indosat Ooredoo", "0815": "Indosat Ooredoo", "0816": "Indosat Ooredoo", "0855": "Indosat Ooredoo", "0856": "Indosat Ooredoo", "0857": "Indosat Ooredoo", "0858": "Indosat Ooredoo",
  // XL
  "0817": "XL Axiata", "0818": "XL Axiata", "0819": "XL Axiata", "0859": "XL Axiata", "0877": "XL Axiata", "0878": "XL Axiata",
  // Axis
  "0831": "Axis", "0832": "Axis", "0833": "Axis", "0838": "Axis",
  // Tri
  "0895": "Tri (3)", "0896": "Tri (3)", "0897": "Tri (3)", "0898": "Tri (3)", "0899": "Tri (3)",
  // Smartfren
  "0881": "Smartfren", "0882": "Smartfren", "0883": "Smartfren", "0884": "Smartfren", "0885": "Smartfren", "0886": "Smartfren", "0887": "Smartfren", "0888": "Smartfren", "0889": "Smartfren"
};

const PULSA_PRODUCTS: ProductItem[] = [
  { id: "P5", name: "Pulsa Rp 5.000", price: 5000, actualPrice: 7000, points: 50 },
  { id: "P10", name: "Pulsa Rp 10.000", price: 10000, actualPrice: 12000, points: 100 },
  { id: "P25", name: "Pulsa Rp 25.000", price: 25000, actualPrice: 26800, points: 250 },
  { id: "P50", name: "Pulsa Rp 50.000", price: 50000, actualPrice: 51500, points: 500 },
  { id: "P100", name: "Pulsa Rp 100.000", price: 100000, actualPrice: 101000, points: 1000 },
];

const DATA_PRODUCTS: ProductItem[] = [
  { id: "D1", name: "Paket Data 1 GB - 3 Hari", price: 8000, actualPrice: 9900, points: 80 },
  { id: "D3", name: "Paket Data 3 GB - 7 Hari", price: 20000, actualPrice: 22000, points: 200 },
  { id: "D10", name: "Paket Internet Combo 10 GB - 30 Hari", price: 55000, actualPrice: 57500, points: 550 },
  { id: "D25", name: "Paket Internet Unlimited 25 GB - 30 Hari", price: 95000, actualPrice: 97800, points: 950 },
];

const PLN_PRODUCTS: ProductItem[] = [
  { id: "PLN20", name: "Token PLN Rp 20.000", price: 20000, actualPrice: 22500, points: 200 },
  { id: "PLN50", name: "Token PLN Rp 50.000", price: 50000, actualPrice: 52500, points: 500 },
  { id: "PLN100", name: "Token PLN Rp 100.000", price: 100000, actualPrice: 102500, points: 1000 },
  { id: "PLN200", name: "Token PLN Rp 200.000", price: 200000, actualPrice: 202500, points: 2000 },
  { id: "PLN500", name: "Token PLN Rp 500.000", price: 500000, actualPrice: 502500, points: 5000 },
];

const EWALLET_PRODUCTS: ProductItem[] = [
  { id: "EW10", name: "Top Up Rp 10.000", price: 10000, actualPrice: 12000, points: 100 },
  { id: "EW20", name: "Top Up Rp 20.000", price: 20000, actualPrice: 22000, points: 200 },
  { id: "EW50", name: "Top Up Rp 50.000", price: 50000, actualPrice: 52000, points: 500 },
  { id: "EW100", name: "Top Up Rp 100.000", price: 100000, actualPrice: 102000, points: 1000 },
  { id: "EW200", name: "Top Up Rp 200.000", price: 200000, actualPrice: 202000, points: 2000 },
];

// Fallback dummy paylater data
const defaultMemberData = {
  member_name: "BUDI SANTOSO",
  member_code: "KOP-09432",
  paylater_limit: 2000000,
  paylater_spent: 250000,
  paylater_available: 1750000,
  paylater_debts: [
    { id: 1, order_no: "TX-PL-892134", amount: 150000, ordered_at: "2026-05-20" },
    { id: 2, order_no: "TX-PL-899120", amount: 100000, ordered_at: "2026-05-24" },
  ]
};

export function TokoPPOBClient({ memberData }: PPOBClientProps) {
  const activeMember = memberData || defaultMemberData;

  // Active Category State
  const [activeCategory, setActiveCategory] = useState<"pulsa" | "pln" | "ewallet" | "tagihan">("pulsa");

  // Pulsa state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [pulsaSubtype, setPulsaSubtype] = useState<"pulsa" | "data">("pulsa");

  // PLN state
  const [meterNo, setMeterNo] = useState("");
  const [plnCustomerName, setPlnCustomerName] = useState<string | null>(null);
  const [plnCustomerDaya, setPlnCustomerDaya] = useState<string | null>(null);
  const [isCheckingPln, setIsCheckingPln] = useState(false);

  // E-Wallet state
  const [selectedEWallet, setSelectedEWallet] = useState<"dana" | "gopay" | "ovo" | "shopeepay" | null>("dana");
  const [walletPhoneNo, setWalletPhoneNo] = useState("");

  // Tagihan state
  const [selectedTagihanType, setSelectedTagihanType] = useState<"bpjs" | "pdam" | "pln_post" | "telkom" | null>("bpjs");
  const [billingNo, setBillingNo] = useState("");
  const [isCheckingBill, setIsCheckingBill] = useState(false);
  const [checkedBillData, setCheckedBillData] = useState<{
    customerName: string;
    period: string;
    amount: number;
    adminFee: number;
    totalBill: number;
  } | null>(null);

  // checkout/security state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pinCode, setPinCode] = useState<string[]>(Array(6).fill(""));
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [txStatus, setTxStatus] = useState<"processing" | "success" | "failed" | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  // Dummy recent transactions list
  const [recentTxs, setRecentTxs] = useState([
    { id: "TX-PPOB-902341", date: "2026-05-29 11:20", type: "Pulsa", detail: "Telkomsel Rp 10.000 (081234567890)", price: 12000, status: "SUCCESS" },
    { id: "TX-PPOB-901452", date: "2026-05-28 14:05", type: "Token PLN", detail: "Listrik Prabayar - ID 53214592039", price: 52500, status: "SUCCESS" },
  ]);

  // Provider detection effect
  useEffect(() => {
    if (phoneNumber.length >= 4) {
      const prefix = phoneNumber.slice(0, 4);
      setDetectedProvider(PROVIDER_PREFIXES[prefix] || "Provider Tidak Dikenal");
    } else {
      setDetectedProvider(null);
    }
  }, [phoneNumber]);

  // Simulating check customer name for PLN
  const handleCheckPlnCustomer = () => {
    if (!meterNo || meterNo.length < 9) {
      toast.error("Silakan masukkan Nomor Meter / ID Pelanggan PLN yang valid (minimal 9 digit).");
      return;
    }

    setIsCheckingPln(true);
    setTimeout(() => {
      setIsCheckingPln(false);
      setPlnCustomerName("BUDI SANTOSO H.");
      setPlnCustomerDaya("R1M / 900 VA");
      toast.success("ID Pelanggan berhasil ditemukan!");
    }, 1500);
  };

  // Simulating check bill for BPJS/PDAM
  const handleCheckBill = () => {
    if (!billingNo || billingNo.length < 8) {
      toast.error("Silakan masukkan Nomor Tagihan yang valid.");
      return;
    }

    setIsCheckingBill(true);
    setCheckedBillData(null);
    setTimeout(() => {
      setIsCheckingBill(false);
      const name = "BUDI SANTOSO H.";
      let amount = 145000;
      let period = "Mei 2026";
      let adminFee = 2500;

      if (selectedTagihanType === "pdam") {
        amount = 89000;
        period = "Mei 2026";
      } else if (selectedTagihanType === "telkom") {
        amount = 345000;
        period = "Mei 2026";
        adminFee = 3000;
      }

      setCheckedBillData({
        customerName: name,
        period,
        amount,
        adminFee,
        totalBill: amount + adminFee,
      });
      toast.success("Data tagihan berhasil diambil!");
    }, 1500);
  };

  // Open checkout confirmation
  const handleTriggerCheckout = (prod: ProductItem | null, isBill = false) => {
    let p = prod;

    if (isBill && checkedBillData) {
      p = {
        id: "BILL-" + (selectedTagihanType || "TAG").toUpperCase(),
        name: `Bayar Tagihan ${selectedTagihanType?.toUpperCase()}`,
        price: checkedBillData.amount,
        actualPrice: checkedBillData.totalBill,
        points: Math.floor(checkedBillData.amount / 100),
      };
    }

    if (!p) {
      toast.error("Silakan pilih nominal atau selesaikan pengisian data.");
      return;
    }

    // Check Paylater limit
    if (activeMember.paylater_available < p.actualPrice) {
      toast.error("Limit Paylater koperasi Anda tidak mencukupi untuk melakukan transaksi ini.");
      return;
    }

    setSelectedProduct(p);
    setShowConfirmModal(true);
    setPinCode(Array(6).fill(""));
    setTxStatus(null);
  };

  // Handle PIN keyboard
  const handlePinInput = (index: number, val: string) => {
    if (isNaN(Number(val)) && val !== "") return;
    const newPin = [...pinCode];
    newPin[index] = val;
    setPinCode(newPin);

    // Focus next input automatically
    if (val !== "" && index < 5) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && pinCode[index] === "" && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Finalize transaction execution with Backend Server Action
  const executeTransaction = () => {
    const enteredPin = pinCode.join("");
    if (enteredPin.length < 6) {
      toast.error("Silakan masukkan PIN Transaksi lengkap 6 digit.");
      return;
    }

    if (!selectedProduct) return;

    setIsProcessingTx(true);
    setTxStatus("processing");

    // Call the server action!
    executePpobTransactionPaylater({
      productType: activeCategory === "pulsa" ? (pulsaSubtype === "pulsa" ? "pulsa" : "data") :
                   activeCategory === "pln" ? "listrik" :
                   activeCategory === "ewallet" ? "other" : "bpjs",
      productCode: selectedProduct.id,
      customerNo: activeCategory === "pulsa" ? phoneNumber :
                  activeCategory === "pln" ? meterNo :
                  activeCategory === "ewallet" ? walletPhoneNo : billingNo,
      customerName: plnCustomerName || checkedBillData?.customerName || undefined,
      amount: selectedProduct.price,
      adminFee: selectedProduct.actualPrice - selectedProduct.price,
      totalAmount: selectedProduct.actualPrice,
    }).then((res) => {
      if (res.success && res.refNo) {
        setTxStatus("success");
        const detailStr = 
          activeCategory === "pulsa" ? `${selectedProduct.name} ke ${phoneNumber}` :
          activeCategory === "pln" ? `${selectedProduct.name} (Meter: ${meterNo})` :
          activeCategory === "ewallet" ? `${selectedProduct.name} ke ${selectedEWallet?.toUpperCase()} (${walletPhoneNo})` :
          `Tagihan ${selectedTagihanType?.toUpperCase()} No: ${billingNo}`;

        const dataReceipt = {
          refNo: res.refNo,
          date: res.date,
          type: activeCategory.toUpperCase(),
          detail: detailStr,
          amount: selectedProduct.actualPrice,
          points: res.points,
          plnToken: activeCategory === "pln" ? "4392 - 1289 - 5582 - 0039 - 1493" : null,
          customerName: plnCustomerName || checkedBillData?.customerName || null,
        };

        setReceiptData(dataReceipt);
        
        // Add to history
        setRecentTxs([
          {
            id: res.refNo,
            date: new Date().toISOString().replace("T", " ").slice(0, 16),
            type: activeCategory === "pulsa" ? "Pulsa" : activeCategory === "pln" ? "Token PLN" : activeCategory === "ewallet" ? "E-Wallet" : "Tagihan",
            detail: detailStr,
            price: selectedProduct.actualPrice,
            status: "SUCCESS"
          },
          ...recentTxs
        ]);
        
        // Decrement limit locally
        activeMember.paylater_available -= selectedProduct.actualPrice;
        activeMember.paylater_spent += selectedProduct.actualPrice;

        toast.success("Transaksi PPOB Paylater berhasil diproses!");
      } else {
        setTxStatus("failed");
        toast.error(res.error || "Gagal memproses transaksi PPOB.");
      }
    }).catch((err) => {
      setTxStatus("failed");
      toast.error(err?.message || "Terjadi kesalahan koneksi sistem.");
    }).finally(() => {
      setIsProcessingTx(false);
    });
  };

  return (
    <div className="w-full space-y-6">
      {/* ─── HEADER & WALLET CARD (PAYLATER THEME) ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-700 via-slate-800 to-emerald-800 dark:from-slate-900 dark:via-indigo-950 dark:to-emerald-950 text-white rounded-3xl p-6 shadow-xl border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[190px]">
          {/* Decorative ambient glows */}
          <div className="absolute right-[-10%] top-[-20%] w-[250px] h-[250px] rounded-full bg-emerald-400/20 blur-[80px] pointer-events-none" />
          <div className="absolute left-[30%] bottom-[-30%] w-[180px] h-[180px] rounded-full bg-indigo-500/20 blur-[60px] pointer-events-none" />
          
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" /> Limit Paylater Tersedia
              </p>
              <h2 className="text-3xl font-extrabold mt-1.5 filter drop-shadow-md">
                Rp {activeMember.paylater_available.toLocaleString("id-ID")}
              </h2>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-center justify-center shrink-0">
              <Coins className="h-6 w-6 text-emerald-300" />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-6 relative z-10 text-xs text-indigo-100 font-semibold">
            <div>
              <p className="opacity-75">NAMA ANGGOTA</p>
              <p className="text-white text-sm font-bold mt-0.5">{activeMember.member_name}</p>
            </div>
            <div className="text-right">
              <p className="opacity-75">KODE ANGGOTA</p>
              <p className="text-white text-sm font-bold mt-0.5">{activeMember.member_code}</p>
            </div>
          </div>
        </div>

        {/* Breakdown detail paylater */}
        <Card className="border border-slate-200/60 dark:border-slate-800 shadow-lg rounded-3xl bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Rincian Paylater Koperasi</CardTitle>
            <CardDescription className="text-xs">Kelayakan kredit dan pemakaian paylater Anda.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-slate-500">Total Limit Kredit</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                Rp {activeMember.paylater_limit.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-rose-500">Tagihan Belum Dibayar</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                Rp {activeMember.paylater_spent.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs py-1.5 border-0">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Sisa Limit Tersedia</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Rp {activeMember.paylater_available.toLocaleString("id-ID")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── PPOB TRANSACTION MAIN INTERFACE ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Category Side Navigation */}
        <div className="lg:col-span-3 flex flex-col gap-2">
          <button
            onClick={() => { setActiveCategory("pulsa"); setSelectedProduct(null); }}
            className={`flex items-center gap-3.5 w-full text-left px-5 py-4 rounded-2xl font-bold transition-all border ${
              activeCategory === "pulsa"
                ? "bg-[#0f4c3a] text-white border-[#0f4c3a] shadow-lg shadow-[#0f4c3a]/15"
                : "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
            }`}
          >
            <div className={`p-2 rounded-xl shrink-0 ${activeCategory === "pulsa" ? "bg-white/15 text-white" : "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400"}`}>
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm">Pulsa & Data</p>
              <p className="text-[10px] opacity-75 font-medium mt-0.5">Top-up Kuota & Paket reguler</p>
            </div>
            <ChevronRight className="h-4.5 w-4.5 shrink-0 opacity-60" />
          </button>

          <button
            onClick={() => { setActiveCategory("pln"); setSelectedProduct(null); }}
            className={`flex items-center gap-3.5 w-full text-left px-5 py-4 rounded-2xl font-bold transition-all border ${
              activeCategory === "pln"
                ? "bg-[#0f4c3a] text-white border-[#0f4c3a] shadow-lg shadow-[#0f4c3a]/15"
                : "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
            }`}
          >
            <div className={`p-2 rounded-xl shrink-0 ${activeCategory === "pln" ? "bg-white/15 text-white" : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-500"}`}>
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm">Token PLN</p>
              <p className="text-[10px] opacity-75 font-medium mt-0.5">Listrik Pintar Prabayar</p>
            </div>
            <ChevronRight className="h-4.5 w-4.5 shrink-0 opacity-60" />
          </button>

          <button
            onClick={() => { setActiveCategory("ewallet"); setSelectedProduct(null); }}
            className={`flex items-center gap-3.5 w-full text-left px-5 py-4 rounded-2xl font-bold transition-all border ${
              activeCategory === "ewallet"
                ? "bg-[#0f4c3a] text-white border-[#0f4c3a] shadow-lg shadow-[#0f4c3a]/15"
                : "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
            }`}
          >
            <div className={`p-2 rounded-xl shrink-0 ${activeCategory === "ewallet" ? "bg-white/15 text-white" : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"}`}>
              <EWalletIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm">E-Wallet</p>
              <p className="text-[10px] opacity-75 font-medium mt-0.5">DANA, GoPay, OVO, ShopeePay</p>
            </div>
            <ChevronRight className="h-4.5 w-4.5 shrink-0 opacity-60" />
          </button>

          <button
            onClick={() => { setActiveCategory("tagihan"); setSelectedProduct(null); }}
            className={`flex items-center gap-3.5 w-full text-left px-5 py-4 rounded-2xl font-bold transition-all border ${
              activeCategory === "tagihan"
                ? "bg-[#0f4c3a] text-white border-[#0f4c3a] shadow-lg shadow-[#0f4c3a]/15"
                : "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
            }`}
          >
            <div className={`p-2 rounded-xl shrink-0 ${activeCategory === "tagihan" ? "bg-white/15 text-white" : "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"}`}>
              <Receipt className="h-5 w-5" />
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm">Tagihan Bulanan</p>
              <p className="text-[10px] opacity-75 font-medium mt-0.5">PDAM, BPJS, Pascabayar</p>
            </div>
            <ChevronRight className="h-4.5 w-4.5 shrink-0 opacity-60" />
          </button>
        </div>

        {/* Focused Panel Forms */}
        <div className="lg:col-span-9">
          <AnimatePresence mode="wait">
            {activeCategory === "pulsa" && (
              <motion.div
                key="pulsa-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border border-slate-200/60 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                      <span>Beli Pulsa & Paket Data</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold px-2.5 py-1 rounded-full uppercase">
                        Mode Paylater Aktif
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Isi pulsa dan kuota data secara instan, ditagih ke saldo Paylater Anda bulan depan.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Input HP */}
                    <div className="space-y-2">
                      <Label htmlFor="phoneNo" className="font-bold text-slate-700 dark:text-slate-300 text-sm">Nomor HP</Label>
                      <div className="relative">
                        <Smartphone className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                        <Input
                          id="phoneNo"
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="Masukkan nomor handphone (contoh: 0812xxxxxx)"
                          className="pl-12 pr-28 h-12 bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-2xl font-bold"
                        />
                        {detectedProvider && (
                          <span className="absolute right-4 top-3 px-3 py-1 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                            {detectedProvider}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Subtype toggle */}
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl w-fit">
                      <button
                        onClick={() => { setPulsaSubtype("pulsa"); setSelectedProduct(null); }}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${pulsaSubtype === "pulsa" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        Pulsa Reguler
                      </button>
                      <button
                        onClick={() => { setPulsaSubtype("data"); setSelectedProduct(null); }}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${pulsaSubtype === "data" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        Paket Data Internet
                      </button>
                    </div>

                    {/* Denomination list Grid */}
                    <div className="space-y-3">
                      <Label className="font-bold text-slate-700 dark:text-slate-300 text-sm">Pilih Nominal Produk</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                        {(pulsaSubtype === "pulsa" ? PULSA_PRODUCTS : DATA_PRODUCTS).map((prod) => (
                          <button
                            key={prod.id}
                            disabled={!phoneNumber || phoneNumber.length < 9}
                            onClick={() => setSelectedProduct(prod)}
                            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-[90px] relative overflow-hidden group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              selectedProduct?.id === prod.id
                                ? "bg-[#0f4c3a]/5 dark:bg-[#0f4c3a]/10 border-[#0f4c3a] ring-2 ring-[#0f4c3a]/10"
                                : "bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#0f4c3a] dark:group-hover:text-emerald-400 transition-colors">
                              {prod.name}
                            </span>
                            <div className="flex justify-between items-baseline mt-2.5">
                              <span className="text-sm font-extrabold text-[#0f4c3a] dark:text-emerald-400">
                                Rp {prod.actualPrice.toLocaleString("id-ID")}
                              </span>
                              <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded-sm">
                                +{prod.points} SHU
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submit checkout */}
                    <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-800 pt-5">
                      <Button
                        onClick={() => handleTriggerCheckout(selectedProduct)}
                        disabled={!selectedProduct}
                        className="h-12 px-8 bg-[#0f4c3a] hover:bg-[#15614b] text-white font-bold rounded-2xl text-sm shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <span>Beli Sekarang (Paylater)</span>
                        <ArrowRight className="h-4.5 w-4.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeCategory === "pln" && (
              <motion.div
                key="pln-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border border-slate-200/60 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                      <span>Beli Token Listrik PLN</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold px-2.5 py-1 rounded-full uppercase">
                        Mode Paylater Aktif
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Isi ulang daya listrik prabayar Anda kapan saja secara praktis dengan limit paylater koperasi.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Input No Meter */}
                    <div className="space-y-2">
                      <Label htmlFor="meterNo" className="font-bold text-slate-700 dark:text-slate-300 text-sm">Nomor Meter / ID Pelanggan</Label>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <Zap className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                          <Input
                            id="meterNo"
                            type="text"
                            value={meterNo}
                            onChange={(e) => { setMeterNo(e.target.value.replace(/[^0-9]/g, "")); setPlnCustomerName(null); }}
                            placeholder="Masukkan 11-12 digit ID Pelanggan PLN"
                            className="pl-12 h-12 bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-2xl font-bold"
                          />
                        </div>
                        <Button
                          onClick={handleCheckPlnCustomer}
                          disabled={isCheckingPln || !meterNo}
                          className="h-12 px-6 rounded-2xl border border-[#0f4c3a] hover:bg-[#0f4c3a]/5 text-[#0f4c3a] bg-transparent font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isCheckingPln ? (
                            <Loader2 className="h-4.5 w-4.5 animate-spin" />
                          ) : (
                            <Search className="h-4.5 w-4.5" />
                          )}
                          <span>Cek ID</span>
                        </Button>
                      </div>
                    </div>

                    {/* Customer display card if found */}
                    {plnCustomerName && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-2 text-xs"
                      >
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">NAMA PELANGGAN</span>
                          <span className="font-extrabold text-slate-800 dark:text-emerald-400">{plnCustomerName}</span>
                        </div>
                        <div className="flex justify-between border-t border-emerald-100/50 dark:border-emerald-900/10 pt-2">
                          <span className="font-semibold text-slate-500">TARIF / DAYA</span>
                          <span className="font-extrabold text-slate-800 dark:text-emerald-400">{plnCustomerDaya}</span>
                        </div>
                      </motion.div>
                    )}

                    {/* Denomination list Grid */}
                    <div className="space-y-3">
                      <Label className="font-bold text-slate-700 dark:text-slate-300 text-sm">Pilih Nominal Token</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                        {PLN_PRODUCTS.map((prod) => (
                          <button
                            key={prod.id}
                            disabled={!plnCustomerName}
                            onClick={() => setSelectedProduct(prod)}
                            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-[90px] relative overflow-hidden group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              selectedProduct?.id === prod.id
                                ? "bg-[#0f4c3a]/5 dark:bg-[#0f4c3a]/10 border-[#0f4c3a] ring-2 ring-[#0f4c3a]/10"
                                : "bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#0f4c3a] dark:group-hover:text-emerald-400 transition-colors">
                              {prod.name}
                            </span>
                            <div className="flex justify-between items-baseline mt-2.5">
                              <span className="text-sm font-extrabold text-[#0f4c3a] dark:text-emerald-400">
                                Rp {prod.actualPrice.toLocaleString("id-ID")}
                              </span>
                              <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded-sm">
                                +{prod.points} SHU
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submit checkout */}
                    <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-800 pt-5">
                      <Button
                        onClick={() => handleTriggerCheckout(selectedProduct)}
                        disabled={!selectedProduct || !plnCustomerName}
                        className="h-12 px-8 bg-[#0f4c3a] hover:bg-[#15614b] text-white font-bold rounded-2xl text-sm shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <span>Beli Token (Paylater)</span>
                        <ArrowRight className="h-4.5 w-4.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeCategory === "ewallet" && (
              <motion.div
                key="ewallet-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border border-slate-200/60 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                      <span>Top Up E-Wallet</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold px-2.5 py-1 rounded-full uppercase">
                        Mode Paylater Aktif
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Isi ulang dompet digital ShopeePay, DANA, OVO, atau GoPay menggunakan limit paylater Anda.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* E-Wallet selection Grid */}
                    <div className="space-y-3">
                      <Label className="font-bold text-slate-700 dark:text-slate-300 text-sm">Pilih Dompet Digital</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {["dana", "gopay", "ovo", "shopeepay"].map((ew) => (
                          <button
                            key={ew}
                            type="button"
                            onClick={() => { setSelectedEWallet(ew as any); setSelectedProduct(null); }}
                            className={`p-4 border rounded-2xl text-center capitalize font-bold transition-all relative overflow-hidden flex flex-col items-center gap-2 cursor-pointer ${
                              selectedEWallet === ew
                                ? "border-[#0f4c3a] bg-[#0f4c3a]/5 dark:bg-[#0f4c3a]/10 text-[#0f4c3a] dark:text-emerald-400"
                                : "bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-800 hover:border-slate-300"
                            }`}
                          >
                            <EWalletIcon className="h-5 w-5 text-emerald-500" />
                            <span className="text-xs font-extrabold">{ew}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Input No HP E-wallet */}
                    <div className="space-y-2">
                      <Label htmlFor="walletPhoneNo" className="font-bold text-slate-700 dark:text-slate-300 text-sm">Nomor HP E-Wallet</Label>
                      <div className="relative">
                        <Smartphone className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                        <Input
                          id="walletPhoneNo"
                          type="tel"
                          value={walletPhoneNo}
                          onChange={(e) => setWalletPhoneNo(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="Masukkan nomor HP yang terdaftar di E-Wallet"
                          className="pl-12 h-12 bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-2xl font-bold"
                        />
                      </div>
                    </div>

                    {/* Denomination list Grid */}
                    <div className="space-y-3">
                      <Label className="font-bold text-slate-700 dark:text-slate-300 text-sm">Pilih Nominal Top Up</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                        {EWALLET_PRODUCTS.map((prod) => (
                          <button
                            key={prod.id}
                            disabled={!walletPhoneNo || walletPhoneNo.length < 9 || !selectedEWallet}
                            onClick={() => setSelectedProduct(prod)}
                            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-[90px] relative overflow-hidden group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              selectedProduct?.id === prod.id
                                ? "bg-[#0f4c3a]/5 dark:bg-[#0f4c3a]/10 border-[#0f4c3a] ring-2 ring-[#0f4c3a]/10"
                                : "bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#0f4c3a] dark:group-hover:text-emerald-400 transition-colors">
                              {prod.name}
                            </span>
                            <div className="flex justify-between items-baseline mt-2.5">
                              <span className="text-sm font-extrabold text-[#0f4c3a] dark:text-emerald-400">
                                Rp {prod.actualPrice.toLocaleString("id-ID")}
                              </span>
                              <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded-sm">
                                +{prod.points} SHU
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submit checkout */}
                    <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-800 pt-5">
                      <Button
                        onClick={() => handleTriggerCheckout(selectedProduct)}
                        disabled={!selectedProduct || !walletPhoneNo || !selectedEWallet}
                        className="h-12 px-8 bg-[#0f4c3a] hover:bg-[#15614b] text-white font-bold rounded-2xl text-sm shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <span>Top Up Sekarang (Paylater)</span>
                        <ArrowRight className="h-4.5 w-4.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeCategory === "tagihan" && (
              <motion.div
                key="tagihan-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border border-slate-200/60 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-6">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                      <span>Pembayaran Tagihan Bulanan</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold px-2.5 py-1 rounded-full uppercase">
                        Mode Paylater Aktif
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Bayar BPJS Kesehatan, tagihan air PDAM, atau IndiHome secara instan menggunakan limit paylater.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Select Tagihan Type */}
                      <div className="space-y-2">
                        <Label htmlFor="tagihanType" className="font-bold text-slate-700 dark:text-slate-300 text-sm">Jenis Tagihan</Label>
                        <Select
                          value={selectedTagihanType || ""}
                          onValueChange={(val) => { setSelectedTagihanType(val as any); setCheckedBillData(null); }}
                        >
                          <SelectTrigger className="w-full h-12 text-sm bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-2xl px-4 flex items-center justify-between">
                            <SelectValue placeholder="Pilih Jenis Tagihan" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg animate-in fade-in-0 duration-100">
                            <SelectItem value="bpjs" className="text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800 cursor-pointer py-2">
                              BPJS Kesehatan
                            </SelectItem>
                            <SelectItem value="pdam" className="text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800 cursor-pointer py-2">
                              PDAM Air Bersih
                            </SelectItem>
                            <SelectItem value="pln_post" className="text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800 cursor-pointer py-2">
                              Listrik Pascabayar
                            </SelectItem>
                            <SelectItem value="telkom" className="text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800 cursor-pointer py-2">
                              Telkom / IndiHome
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Input Billing Number */}
                      <div className="space-y-2">
                        <Label htmlFor="billingNo" className="font-bold text-slate-700 dark:text-slate-300 text-sm">Nomor Tagihan / Pelanggan</Label>
                        <div className="relative">
                          <Building className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                          <Input
                            id="billingNo"
                            type="text"
                            value={billingNo}
                            onChange={(e) => { setBillingNo(e.target.value.replace(/[^0-9]/g, "")); setCheckedBillData(null); }}
                            placeholder="Masukkan nomor pelanggan / billing"
                            className="pl-12 h-12 bg-white/50 dark:bg-slate-950 border-slate-200 focus:border-[#0f4c3a] focus:ring-[#0f4c3a]/10 rounded-2xl font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Check Bill Button */}
                    {!checkedBillData && (
                      <div className="flex justify-end pt-2">
                        <Button
                          onClick={handleCheckBill}
                          disabled={isCheckingBill || !billingNo || !selectedTagihanType}
                          className="h-12 px-6 bg-[#0f4c3a] hover:bg-[#15614b] text-white font-bold rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isCheckingBill ? (
                            <Loader2 className="h-4.5 w-4.5 animate-spin" />
                          ) : (
                            <Search className="h-4.5 w-4.5" />
                          )}
                          <span>Cek Tagihan</span>
                        </Button>
                      </div>
                    )}

                    {/* Detailed billing display if checked */}
                    {checkedBillData && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl space-y-4"
                      >
                        <div className="flex items-center gap-2 border-b border-indigo-100/50 dark:border-indigo-900/10 pb-3">
                          <Receipt className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                          <span className="font-extrabold text-sm text-indigo-900 dark:text-indigo-200">INFORMASI TAGIKAN</span>
                        </div>
                        
                        <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                          <div className="flex justify-between">
                            <span>Nama Pelanggan</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{checkedBillData.customerName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Periode Tagihan</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{checkedBillData.period}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Nilai Tagihan</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              Rp {checkedBillData.amount.toLocaleString("id-ID")}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Biaya Admin</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              Rp {checkedBillData.adminFee.toLocaleString("id-ID")}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-indigo-100/50 dark:border-indigo-900/20 pt-3 text-sm text-indigo-900 dark:text-indigo-200 font-extrabold">
                            <span>Total Pembayaran</span>
                            <span>Rp {checkedBillData.totalBill.toLocaleString("id-ID")}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Submit checkout */}
                    {checkedBillData && (
                      <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-800 pt-5">
                        <Button
                          onClick={() => handleTriggerCheckout(null, true)}
                          className="h-12 px-8 bg-[#0f4c3a] hover:bg-[#15614b] text-white font-bold rounded-2xl text-sm shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2 cursor-pointer"
                        >
                          <span>Bayar Tagihan (Paylater)</span>
                          <ArrowRight className="h-4.5 w-4.5" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── RECENT PPOB TRANSACTIONS TABLE ────────────────────────────────────── */}
      <Card className="border border-slate-200/60 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
        <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Riwayat Transaksi PPOB Terakhir</CardTitle>
          <CardDescription className="text-xs mt-0.5">Daftar riwayat transaksi pembelian pulsa, listrik, dan tagihan bulanan terbaru Anda.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-950/20 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                  <th className="p-4 pl-6">ID TRANSAKSI</th>
                  <th className="p-4">TANGGAL</th>
                  <th className="p-4">KATEGORI</th>
                  <th className="p-4">DESKRIPSI TRANSAKSI</th>
                  <th className="p-4">TOTAL</th>
                  <th className="p-4 pr-6 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {recentTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 font-medium">
                    <td className="p-4 pl-6 font-extrabold text-slate-800 dark:text-slate-100">{tx.id}</td>
                    <td className="p-4 text-slate-400">{tx.date}</td>
                    <td className="p-4 text-slate-500 font-semibold">{tx.type}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">{tx.detail}</td>
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                      Rp {tx.price.toLocaleString("id-ID")}
                    </td>
                    <td className="p-4 pr-6 text-center">
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold rounded-lg">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECURITY & PIN MODAL (MODAL DI ATAS SELURUH LAYAR) ───────────────── */}
      <AnimatePresence>
        {showConfirmModal && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (txStatus !== "processing") setShowConfirmModal(false); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative max-w-md w-full overflow-hidden"
            >
              {txStatus === null && (
                <div className="space-y-6">
                  {/* Header ringkasan */}
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Konfirmasi Pembayaran</p>
                    <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-2">
                      Rp {selectedProduct.actualPrice.toLocaleString("id-ID")}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 mt-1">{selectedProduct.name}</p>
                  </div>

                  {/* Summary Box */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-2.5 text-xs font-semibold text-slate-500 font-sans">
                    <div className="flex justify-between">
                      <span>Sumber Dana</span>
                      <span className="font-extrabold text-[#0f4c3a] dark:text-emerald-400 uppercase">Paylater Koperasi</span>
                    </div>
                    {activeCategory === "pulsa" && (
                      <div className="flex justify-between">
                        <span>Nomor HP Tujuan</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{phoneNumber}</span>
                      </div>
                    )}
                    {activeCategory === "pln" && (
                      <div className="flex justify-between">
                        <span>ID Meter PLN</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{meterNo}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200/40 dark:border-slate-800 pt-2.5 text-slate-800 dark:text-slate-200 font-extrabold">
                      <span>Total Tagihan</span>
                      <span>Rp {selectedProduct.actualPrice.toLocaleString("id-ID")}</span>
                    </div>
                  </div>

                  {/* PIN Input Pad */}
                  <div className="space-y-3.5">
                    <Label className="font-bold text-slate-700 dark:text-slate-300 text-sm text-center block">
                      Masukkan PIN Transaksi Anda
                    </Label>
                    
                    <div className="flex justify-center gap-2">
                      {pinCode.map((char, index) => (
                        <input
                          key={index}
                          id={`pin-${index}`}
                          type="password"
                          maxLength={1}
                          value={char}
                          onChange={(e) => handlePinInput(index, e.target.value)}
                          onKeyDown={(e) => handlePinKeyDown(index, e)}
                          className="w-12 h-12 border border-slate-200 focus:border-[#0f4c3a] focus:ring-4 focus:ring-[#0f4c3a]/10 bg-white/50 dark:bg-slate-950 rounded-xl text-center text-xl font-bold font-mono outline-none"
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                      <span>Sistem Keamanan Terenkripsi</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 h-12 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 bg-transparent font-bold cursor-pointer"
                    >
                      Batal
                    </Button>
                    <Button
                      onClick={executeTransaction}
                      disabled={pinCode.join("").length < 6}
                      className="flex-1 h-12 rounded-2xl bg-[#0f4c3a] hover:bg-[#15614b] text-white font-bold cursor-pointer disabled:opacity-50"
                    >
                      Konfirmasi
                    </Button>
                  </div>
                </div>
              )}

              {/* Processing loading state */}
              {txStatus === "processing" && (
                <div className="flex flex-col items-center justify-center py-12 space-y-5">
                  <div className="relative h-16 w-16 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-[#0f4c3a]" />
                  </div>
                  <div className="text-center space-y-1">
                    <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Sedang Memproses Transaksi</h4>
                    <p className="text-xs text-slate-400">Menghubungkan ke server Biller PPOB Gateway...</p>
                  </div>
                </div>
              )}

              {/* Success Result / Struk Pembayaran */}
              {txStatus === "success" && receiptData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col items-center text-center">
                    <CheckCircle2 className="h-14 w-14 text-emerald-500 shrink-0 filter drop-shadow-md" />
                    <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mt-3">Transaksi Sukses!</h3>
                    <p className="text-xs text-slate-400 mt-1">Transaksi Anda telah dicatat sebagai tagihan Paylater.</p>
                  </div>

                  {/* Struk digital */}
                  <div className="p-5 border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl space-y-4 text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
                    <div className="text-center border-b border-dashed border-slate-200 dark:border-slate-700 pb-3 space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest text-sm">Koperasi Sulfindo</p>
                      <p className="text-[10px] text-slate-400">Bukti Transaksi PPOB Paylater</p>
                    </div>

                    <div className="space-y-2 border-b border-dashed border-slate-200 dark:border-slate-700 pb-3">
                      <div className="flex justify-between">
                        <span>No. Referensi</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{receiptData.refNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tanggal/Waktu</span>
                        <span className="text-right">{receiptData.date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Jenis Transaksi</span>
                        <span className="font-bold">{receiptData.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Metode Bayar</span>
                        <span className="font-bold text-[#0f4c3a] dark:text-emerald-400 uppercase">PAYLATER</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Detail Transaksi</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-right max-w-[200px] break-words">{receiptData.detail}</span>
                      </div>
                    </div>

                    {receiptData.plnToken && (
                      <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-center space-y-1">
                        <p className="text-[9px] font-bold text-amber-600 dark:text-amber-500 tracking-wider">NOMOR TOKEN STROM</p>
                        <p className="text-sm font-extrabold text-amber-800 dark:text-amber-400 tracking-wider">{receiptData.plnToken}</p>
                      </div>
                    )}

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-slate-800 dark:text-slate-200 font-extrabold">
                        <span>Total Bayar</span>
                        <span>Rp {receiptData.amount.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        <span>Komisi SHU Koperasi</span>
                        <span>+{receiptData.points} SHU</span>
                      </div>
                    </div>
                  </div>

                  {/* Receipt actions */}
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        toast.success("Bukti transaksi berhasil dicetak!");
                      }}
                      className="flex-1 h-12 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 bg-transparent font-bold cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Printer className="h-4.5 w-4.5" />
                      <span>Cetak</span>
                    </Button>
                    <Button
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 h-12 rounded-2xl bg-[#0f4c3a] hover:bg-[#15614b] text-white font-bold cursor-pointer"
                    >
                      Selesai
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
