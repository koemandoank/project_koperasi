"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().min(3, "Email atau NIK minimal 3 karakter"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const validatedData = loginSchema.safeParse(rawData);

    if (!validatedData.success) {
      return "Email atau password tidak valid.";
    }

    await signIn("credentials", {
      email: validatedData.data.email,
      password: validatedData.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Email atau password salah.";
        default:
          return "Terjadi kesalahan sistem: " + error.message;
      }
    }
    // if it's NEXT_REDIRECT it must be rethrown
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
