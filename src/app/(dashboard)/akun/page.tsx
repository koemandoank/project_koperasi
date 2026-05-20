import { getUsers } from "@/lib/actions/users";
import { UsersClient } from "./users-client";
import { auth } from "@/auth";

export const metadata = {
  title: "Data Akun User | Koperasi",
};

export default async function UsersPage() {
  const session = await auth();
  const users = await getUsers();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Akun User</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Kelola akun administrator, pengurus, dan kasir sistem.
        </p>
      </div>

      <UsersClient initialUsers={users} currentRole={session?.user?.role || ""} />
    </div>
  );
}
