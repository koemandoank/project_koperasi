import { LoginForm } from "@/components/forms/login-form";
import { getAppSettings } from "@/lib/actions/settings";

export const metadata = {
  title: "Login - Koperasi Digital",
  description: "Masuk ke sistem Koperasi Digital",
};

export default async function LoginPage() {
  const settings = await getAppSettings();
  return <LoginForm settings={settings} />;
}
