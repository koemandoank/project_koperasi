/**
 * Cloudinary SDK singleton untuk upload gambar server-side.
 * Gunakan helper uploadToCloudinary() di API route atau Server Action.
 *
 * @module cloudinary
 */

import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

/**
 * Upload file buffer ke Cloudinary.
 *
 * @param {Buffer} buffer - Raw file buffer dari FormData
 * @param {string} folder - Folder di Cloudinary (e.g. "koperasi/members")
 * @param {string} [publicId] - Optional custom public_id (auto-generated jika tidak di-set)
 * @returns {Promise<{ url: string; publicId: string }>} URL permanen + public_id
 * @throws {Error} Jika upload gagal
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId?: string
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const options: Record<string, unknown> = {
      folder,
      resource_type: "image" as const,
      transformation: [
        { quality: "auto:good" },
        { fetch_format: "auto" },
      ],
    }

    if (publicId) options.public_id = publicId

    cloudinary.uploader
      .upload_stream(options, (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Cloudinary upload failed"))
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        })
      })
      .end(buffer)
  })
}

export default cloudinary
