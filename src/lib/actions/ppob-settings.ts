"use server";

import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/log-audit";
import { verifySessionAndRole } from "@/lib/auth-helpers";
import { auth } from "@/auth";

export type PPOBSettingsData = {
  apiKey: string;
  privateKey: string;
  merchantCode: string;
  environment: "sandbox" | "production";
  defaultMargin: number;
  shuPercentage: number;
  dynamicPricingByLevel: boolean;
  webhookUrl: string;
  enablePulsa: boolean;
  enablePln: boolean;
  enableEWallet: boolean;
  enableBills: boolean;
};

// Default fallback dummy settings if table is empty
const defaultSettings: PPOBSettingsData = {
  apiKey: "tp_live_a1b2c3d4e5f6g7h8i9j0",
  privateKey: "tp_secret_9e8d7c6b5a4f3e2d1c",
  merchantCode: "SULFINO_COOP",
  environment: "sandbox",
  defaultMargin: 2500,
  shuPercentage: 40,
  dynamicPricingByLevel: true,
  webhookUrl: "https://koperasi.sulfindo.co.id/api/v1/webhook/ppob",
  enablePulsa: true,
  enablePln: true,
  enableEWallet: true,
  enableBills: true,
};

/**
 * Fetch PPOB settings from database.
 */
export const getPpobSettings = cache(async (): Promise<PPOBSettingsData> => {
  try {
    const settings = await (prisma as any).ppob_settings?.findFirst();
    if (!settings) {
      return defaultSettings;
    }

    return {
      apiKey: settings.api_key || "",
      privateKey: settings.private_key || "",
      merchantCode: settings.merchant_code || "",
      environment: (settings.environment as any) || "sandbox",
      defaultMargin: Number(settings.default_margin || 0),
      shuPercentage: Number(settings.shu_percentage || 0),
      dynamicPricingByLevel: Boolean(settings.dynamic_pricing_by_level),
      webhookUrl: settings.webhook_url || "",
      enablePulsa: Boolean(settings.enable_pulsa),
      enablePln: Boolean(settings.enable_pln),
      enableEWallet: Boolean(settings.enable_ewallet),
      enableBills: Boolean(settings.enable_bills),
    };
  } catch (error) {
    console.warn("[ppob-settings] Gagal mengambil ppob_settings, gunakan default.", error);
    return defaultSettings;
  }
});

/**
 * Update PPOB settings in database.
 */
export async function updatePpobSettings(data: PPOBSettingsData) {
  try {
    await verifySessionAndRole(["superadmin", "admin", "pengurus"]);

    const dbData = {
      api_key: data.apiKey,
      private_key: data.privateKey,
      merchant_code: data.merchantCode,
      environment: data.environment,
      default_margin: data.defaultMargin,
      shu_percentage: data.shuPercentage,
      dynamic_pricing_by_level: data.dynamicPricingByLevel,
      webhook_url: data.webhookUrl,
      enable_pulsa: data.enablePulsa,
      enable_pln: data.enablePln,
      enable_ewallet: data.enableEWallet,
      enable_bills: data.enableBills,
      updated_at: new Date(),
    };

    const existing = await (prisma as any).ppob_settings?.findFirst();

    let result;
    if (existing) {
      result = await (prisma as any).ppob_settings.update({
        where: { id: existing.id },
        data: dbData,
      });
    } else {
      result = await (prisma as any).ppob_settings.create({
        data: {
          ...dbData,
          created_at: new Date(),
        },
      });
    }

    await logAudit({
      action: "UPDATE",
      modelType: "ppob_settings",
      modelId: result ? Number(result.id) : null,
      oldValues: existing ? { environment: existing.environment } : {},
      newValues: { environment: data.environment } as any,
    });

    revalidatePath("/pengaturan/ppob");
    return { success: true };
  } catch (error: any) {
    console.error("updatePpobSettings error:", error);
    return { success: false, error: error?.message || "Gagal menyimpan pengaturan PPOB" };
  }
}

/**
 * Executing PPOB transaction strictly as PAYLATER.
 */
export async function executePpobTransactionPaylater(data: {
  productType: "pulsa" | "data" | "listrik" | "air" | "internet" | "bpjs" | "pajak" | "tv" | "other";
  productCode: string;
  customerNo: string;
  customerName?: string;
  amount: number;
  adminFee: number;
  totalAmount: number;
  providerRef?: string;
  sn?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Sesi Anda telah berakhir. Silakan masuk kembali." };
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      include: { members: true },
    });

    if (!user?.members) {
      return { success: false, error: "Data anggota tidak ditemukan." };
    }

    const member = user.members;

    // Generate reference number
    const trxNo = "TX-PPOB-" + Math.floor(100000 + Math.random() * 900000);

    // Save transaction in ppob_transactions table strictly as "paylater"
    const tx = await (prisma as any).ppob_transactions.create({
      data: {
        member_id: member.id,
        trx_no: trxNo,
        product_type: data.productType,
        product_code: data.productCode,
        customer_no: data.customerNo,
        customer_name: data.customerName || null,
        amount: data.amount,
        admin_fee: data.adminFee,
        total_amount: data.totalAmount,
        payment_method: "paylater", // strictly paylater as requested!
        provider_ref: data.providerRef || "TRIPAY-" + Math.floor(100000 + Math.random() * 900000),
        sn: data.sn || null,
        status: "success",
        transacted_at: new Date(),
        completed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Also register an unpaid Accounts Receivable or Paylater Debt in orders / accounts_receivable table
    // Let's create an entry in the orders table with paylater method to reflect as unpaid debt for the member!
    await (prisma as any).orders.create({
      data: {
        order_no: trxNo,
        member_id: member.id,
        unit_id: member.unit_id,
        channel: "online",
        subtotal: data.amount,
        discount: 0,
        grand_total: data.totalAmount,
        payment_method: "paylater", // strictly paylater!
        payment_status: "unpaid",   // member owes this amount to the coop
        order_status: "confirmed",
        note: `PPOB ${data.productType.toUpperCase()} - No: ${data.customerNo}`,
        ordered_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await logAudit({
      action: "CREATE",
      modelType: "ppob_transactions",
      modelId: Number(tx.id),
      oldValues: {},
      newValues: { trx_no: trxNo, payment_method: "paylater" },
    });

    revalidatePath("/ppob");
    
    return {
      success: true,
      refNo: trxNo,
      date: new Date().toLocaleString("id-ID"),
      points: Math.floor(data.amount / 100),
    };
  } catch (error: any) {
    console.error("executePpobTransactionPaylater error:", error);
    return { success: false, error: error?.message || "Gagal memproses transaksi PPOB" };
  }
}
