import { z } from "zod";

// ── Members ──
export const memberCreateSchema = z.object({
  nik: z.string()
    .min(1, "NIK wajib diisi")
    .max(20, "NIK maksimal 20 karakter")
    .regex(/^[0-9]+$/, "NIK hanya boleh angka"),
  
  full_name: z.string()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  
  email: z.string()
    .email("Email tidak valid")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  phone: z.string()
    .min(10, "Nomor telepon minimal 10 digit")
    .max(15, "Nomor telepon maksimal 15 digit")
    .regex(/^[0-9+\-\s]+$/, "Format nomor telepon tidak valid")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  unit_id: z.string().or(z.number()).transform(Number),
  
  role: z.enum(["anggota", "admin", "pengurus", "superadmin", "kasir", "petugas_akuntan", "pengawas"]),
  
  photo_path: z.string().optional().nullable().or(z.literal(""))
});

export const memberUpdateSchema = memberCreateSchema.partial();

// ── Users ──
export const userCreateSchema = z.object({
  username: z.string()
    .min(3, "Username minimal 3 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[a-zA-Z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore"),
  
  email: z.string().email("Email tidak valid"),
  
  password: z.string()
    .min(6, "Password minimal 6 karakter")
    .max(100, "Password maksimal 100 karakter")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  role: z.enum(["superadmin", "admin", "pengurus", "kasir", "anggota", "petugas_akuntan", "pengawas"]),
  
  is_active: z.boolean().default(true)
});

export const userUpdateSchema = userCreateSchema.partial();

// ── Products ──
export const productCreateSchema = z.object({
  sku: z.string()
    .max(50, "SKU maksimal 50 karakter")
    .optional()
    .nullable()
    .or(z.literal("")),
  
  name: z.string()
    .min(3, "Nama barang minimal 3 karakter")
    .max(200, "Nama barang maksimal 200 karakter"),
  
  purchase_price: z.string().or(z.number()).transform(Number)
    .refine(val => val >= 0, "Harga beli tidak boleh negatif"),
  
  price: z.string().or(z.number()).transform(Number)
    .refine(val => val >= 0, "Harga jual tidak boleh negatif"),
  
  member_price: z.string().or(z.number()).optional().nullable().transform(val => val ? Number(val) : null),
  
  stock: z.string().or(z.number()).transform(Number)
    .refine(val => Number.isInteger(val) && val >= 0, "Stok harus berupa angka bulat dan tidak boleh negatif"),
  
  min_stock: z.string().or(z.number()).optional().nullable().transform(val => val ? Number(val) : 0),
  
  category_id: z.string().or(z.number()).transform(Number),
  unit_id: z.string().or(z.number()).transform(Number),
  unit_measure: z.string().default("pcs"),
  image_path: z.string().optional().nullable().or(z.literal(""))
});

export const productUpdateSchema = productCreateSchema.partial();

// ── Loans ──
export const loanApplicationSchema = z.object({
  loan_product_id: z.string().or(z.number()).transform(Number),
  
  amount_requested: z.string().or(z.number()).transform(Number)
    .refine(val => val >= 100000, "Minimal pinjaman Rp 100.000")
    .refine(val => val <= 1000000000, "Maksimal pinjaman Rp 1 Miliar"),
  
  tenor_months: z.string().or(z.number()).transform(Number)
    .refine(val => Number.isInteger(val) && val >= 1, "Tenor minimal 1 bulan")
    .refine(val => val <= 360, "Tenor maksimal 360 bulan"),
  
  repayment_method: z.enum(["cash", "salary_cut", "saving_deduct"]),
  
  purpose: z.string()
    .min(10, "Tujuan pinjaman minimal 10 karakter")
    .max(500, "Tujuan pinjaman maksimal 500 karakter"),
  
  guarantor_name: z.string().optional().nullable().or(z.literal("")),
  guarantor_phone: z.string().optional().nullable().or(z.literal(""))
});

// ── POS Checkout ──
export const posCheckoutSchema = z.object({
  cart: z.array(
    z.object({
      id: z.string().or(z.number()).transform(Number),
      name: z.string(),
      price: z.string().or(z.number()).transform(Number),
      qty: z.string().or(z.number()).transform(Number)
        .refine(val => Number.isInteger(val) && val >= 1, "Kuantitas minimal 1"),
      stock: z.string().or(z.number()).transform(Number)
        .refine(val => Number.isInteger(val) && val >= 0, "Stok tidak boleh negatif")
    })
  ).min(1, "Keranjang tidak boleh kosong"),
  
  memberId: z.string().or(z.number()).nullable().optional().transform(val => val ? Number(val) : null),
  
  paymentMethod: z.enum(["cash", "paylater", "qris"]),
  
  subtotal: z.string().or(z.number()).transform(Number),
  discount: z.string().or(z.number()).transform(Number),
  grandTotal: z.string().or(z.number()).transform(Number)
});
