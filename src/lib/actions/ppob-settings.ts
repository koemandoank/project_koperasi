"use server";

import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/actions/log-audit";
import { checkRole } from "@/lib/auth-helpers";
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
    await checkRole(["superadmin", "admin", "pengurus"]);

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
  paymentMethod?: "paylater" | "saving_deduct";
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
    const trxNo = "TX-PPOB-" + Math.floor(100000 + Math.random() * 900000);
    const paymentMethod = data.paymentMethod || "paylater";

    if (paymentMethod === "saving_deduct") {
      // Find the Sukarela saving type
      const sukarelaType = await prisma.saving_types.findFirst({
        where: {
          OR: [
            { code: "SUKARELA" },
            { name: { contains: "Sukarela" } }
          ]
        }
      });
      if (!sukarelaType) {
        return { success: false, error: "Jenis simpanan Sukarela tidak ditemukan. Silakan hubungi admin." };
      }

      // Find member's Sukarela savings record
      const memberSaving = await prisma.savings.findUnique({
        where: {
          member_id_saving_type_id: {
            member_id: member.id,
            saving_type_id: sukarelaType.id
          }
        }
      });

      if (!memberSaving || Number(memberSaving.balance) < data.totalAmount) {
        return { success: false, error: "Saldo Simpanan Sukarela tidak mencukupi." };
      }

      const balanceBefore = Number(memberSaving.balance);
      const balanceAfter = balanceBefore - data.totalAmount;

      const txResult = await prisma.$transaction(async (tx: any) => {
        // Update savings balance
        await tx.savings.update({
          where: { id: memberSaving.id },
          data: {
            balance: balanceAfter,
            total_withdraw: { increment: data.totalAmount },
            updated_at: new Date()
          }
        });

        // Log saving transaction
        await tx.saving_transactions.create({
          data: {
            savings_id: memberSaving.id,
            member_id: member.id,
            type: "withdraw",
            amount: data.totalAmount,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            reference_no: trxNo,
            note: `Pembelian PPOB ${data.productType.toUpperCase()} - No: ${data.customerNo}`,
            processed_by: BigInt(session.user.id),
            transaction_at: new Date(),
          }
        });

        // Create PPOB Transaction
        const ppobTx = await tx.ppob_transactions.create({
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
            payment_method: "saving_deduct",
            provider_ref: data.providerRef || "BILLER-" + Math.floor(100000 + Math.random() * 900000),
            sn: data.sn || null,
            status: "success",
            transacted_at: new Date(),
            completed_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          }
        });

        // Create Paid Order
        await tx.orders.create({
          data: {
            order_no: trxNo,
            member_id: member.id,
            unit_id: member.unit_id,
            channel: "online",
            subtotal: data.amount,
            discount: 0,
            grand_total: data.totalAmount,
            payment_method: "saving_deduct",
            payment_status: "paid",
            order_status: "confirmed",
            note: `PPOB ${data.productType.toUpperCase()} - No: ${data.customerNo}`,
            ordered_at: new Date(),
            paid_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          }
        });

        return ppobTx;
      });

      await logAudit({
        action: "CREATE",
        modelType: "ppob_transactions",
        modelId: Number(txResult.id),
        oldValues: {},
        newValues: { trx_no: trxNo, payment_method: "saving_deduct" },
      });

      revalidatePath("/ppob");

      return {
        success: true,
        refNo: trxNo,
        date: new Date().toLocaleString("id-ID"),
        points: Math.floor(data.amount / 100),
      };
    } else {
      // Paylater route (needs limit checking!)
      const { getLoanRules } = await import('./loan-rules');
      const rules = await getLoanRules();
      const paylaterLimit = rules.max_paylater_debt?.enabled ? rules.max_paylater_debt.value : 2000000;

      // Calculate total unpaid paylater orders
      const existingPaylater = await prisma.orders.aggregate({
        where: {
          member_id: member.id,
          payment_method: "paylater",
          payment_status: "unpaid",
          order_status: { not: "cancelled" }
        },
        _sum: { grand_total: true }
      });
      
      const currentDebt = Number(existingPaylater._sum.grand_total || 0);
      if ((currentDebt + data.totalAmount) > paylaterLimit) {
        return { success: false, error: `Limit Bayar Tempo ditolak: Sisa batas hutang Anda tidak mencukupi (Maksimal Rp ${paylaterLimit.toLocaleString('id-ID')}).` };
      }

      // Save transaction in ppob_transactions table strictly as "paylater"
      const tx = await prisma.ppob_transactions.create({
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
          payment_method: "paylater",
          provider_ref: data.providerRef || "BILLER-" + Math.floor(100000 + Math.random() * 900000),
          sn: data.sn || null,
          status: "success",
          transacted_at: new Date(),
          completed_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Also register an unpaid Accounts Receivable or Paylater Debt in orders / accounts_receivable table
      await prisma.orders.create({
        data: {
          order_no: trxNo,
          member_id: member.id,
          unit_id: member.unit_id,
          channel: "online",
          subtotal: data.amount,
          discount: 0,
          grand_total: data.totalAmount,
          payment_method: "paylater",
          payment_status: "unpaid",
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
    }
  } catch (error: any) {
    console.error("executePpobTransactionPaylater error:", error);
    return { success: false, error: error?.message || "Gagal memproses transaksi PPOB" };
  }
}

/**
 * Fetch favorite PPOB contacts/numbers for the logged-in member.
 */
export async function getPpobFavorites(productType?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
    });

    if (!user?.member_id) {
      return { success: false, error: "Data anggota tidak ditemukan." };
    }

    const favorites = await (prisma as any).ppob_favorites.findMany({
      where: {
        member_id: user.member_id,
        ...(productType ? { product_type: productType } : {}),
      },
      orderBy: { created_at: "desc" },
    });

    // Serialize BigInt to number/string for client serialization
    const list = favorites.map((f: any) => ({
      id: Number(f.id),
      member_id: Number(f.member_id),
      label: f.label,
      customer_no: f.customer_no,
      product_type: f.product_type,
      created_at: f.created_at,
    }));

    return { success: true, favorites: list };
  } catch (error: any) {
    console.error("getPpobFavorites error:", error);
    return { success: false, error: error?.message || "Gagal memuat kontak favorit." };
  }
}

/**
 * Add or update a PPOB favorite contact.
 */
export async function addPpobFavorite(data: {
  label: string;
  customerNo: string;
  productType: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
    });

    if (!user?.member_id) {
      return { success: false, error: "Data anggota tidak ditemukan." };
    }

    // Check if duplicate exists for this type & number
    const existing = await (prisma as any).ppob_favorites.findFirst({
      where: {
        member_id: user.member_id,
        customer_no: data.customerNo,
        product_type: data.productType,
      },
    });

    if (existing) {
      await (prisma as any).ppob_favorites.update({
        where: { id: existing.id },
        data: {
          label: data.label,
          updated_at: new Date(),
        },
      });
      return { success: true, message: "Label favorit berhasil diperbarui!" };
    }

    await (prisma as any).ppob_favorites.create({
      data: {
        member_id: user.member_id,
        label: data.label,
        customer_no: data.customerNo,
        product_type: data.productType,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return { success: true, message: "Berhasil menyimpan ke daftar favorit!" };
  } catch (error: any) {
    console.error("addPpobFavorite error:", error);
    return { success: false, error: error?.message || "Gagal menyimpan favorit." };
  }
}

/**
 * Delete a PPOB favorite contact.
 */
export async function deletePpobFavorite(id: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Sesi tidak valid." };
    }

    await (prisma as any).ppob_favorites.delete({
      where: { id: BigInt(id) },
    });

    return { success: true, message: "Berhasil menghapus nomor favorit!" };
  } catch (error: any) {
    console.error("deletePpobFavorite error:", error);
    return { success: false, error: error?.message || "Gagal menghapus nomor favorit." };
  }
}

