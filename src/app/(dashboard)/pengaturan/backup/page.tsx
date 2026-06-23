import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getBackupPageData } from "@/lib/actions/backup-actions";
import { BackupClient } from "./backup-client";

export default async function BackupSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;
  if (!["superadmin", "admin"].includes(role)) {
    redirect("/dashboard");
  }

  const data = await getBackupPageData();

  return (
    <div className="p-6">
      <BackupClient initialData={data} />
    </div>
  );
}
