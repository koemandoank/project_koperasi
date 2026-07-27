/**
 * POST /api/upload
 *
 * Universal file upload endpoint — uploads ke Cloudinary (cloud storage).
 * Kompatibel dengan Vercel serverless (tidak bergantung filesystem lokal).
 *
 * Request: multipart/form-data dengan field "file" dan optional "folder"
 * Response: { url: string } — Cloudinary secure_url permanen
 *
 * @param {Request} req - Next.js Request object
 * @returns {NextResponse<{ url: string } | { error: string }>}
 */

import { NextResponse } from "next/server"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { auth } from "@/auth"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export async function POST(req: Request) {
  try {
    // SECURITY FIX: /api/upload tidak dilindungi middleware (matcher exclude "api"),
    // jadi setiap route API wajib verifikasi sesi sendiri. Sebelumnya endpoint ini
    // bisa diakses tanpa login sama sekali.
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const folder = (formData.get("folder") as string | null) ?? "koperasi/uploads"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF." },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Ukuran file melebihi batas 5MB." },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { url } = await uploadToCloudinary(buffer, folder)

    return NextResponse.json({ url })
  } catch (err) {
    console.error("[upload] Error:", err)
    return NextResponse.json({ error: "Upload gagal, coba lagi." }, { status: 500 })
  }
}
