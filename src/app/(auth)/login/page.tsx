import { LoginForm } from "@/components/forms/login-form";
import { getAppSettings } from "@/lib/actions/settings";
import { headers } from "next/headers";

export const metadata = {
  title: "Login - Koperasi Sulfindo",
  description: "Masuk ke sistem Koperasi Sulfindo",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const [settings, headersList, params] = await Promise.all([
    getAppSettings(),
    headers(),
    searchParams,
  ]);

  const userAgent = headersList.get("user-agent") || "";
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(userAgent);
  const idleReason = params.reason === "idle";

  return <LoginForm settings={settings} isMobile={isMobile} idleLogout={idleReason} />;
}
