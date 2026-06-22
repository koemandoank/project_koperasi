import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCacheStats } from "@/lib/cache";
import { CacheClient } from "./cache-client";

export default async function CacheManagementPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;
  if (!["superadmin", "admin"].includes(role)) {
    redirect("/dashboard");
  }

  const initialStats = await getCacheStats();

  return (
    <div className="p-6">
      <CacheClient initialStats={initialStats} />
    </div>
  );
}
