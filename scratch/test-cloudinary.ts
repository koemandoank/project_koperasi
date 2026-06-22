import { v2 as cloudinary } from "cloudinary"
import * as dotenv from "dotenv"

dotenv.config()

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

async function testCloudinary() {
  console.log("Testing Cloudinary connection...")
  console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME)

  try {
    const result = await cloudinary.api.ping()
    console.log("✅ Cloudinary connected successfully!", result)
  } catch (err) {
    console.error("❌ Cloudinary connection failed:", err)
  }
}

testCloudinary()
