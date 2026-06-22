import { getUsers } from "@/lib/actions/users";
import { UsersClient } from "./users-client";
import { auth } from "@/auth";

export const metadata = {
  title: "Data Akun User | Koperasi",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const pageSize = 20;

  const result = await getUsers(page, pageSize);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Akun User</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Kelola akun administrator, pengurus, dan kasir sistem.
        </p>
      </div>

      <UsersClient
        initialUsers={result.data}
        currentRole={session?.user?.role || ""}
        pagination={result.pagination}
      />
    </div>
  );
}
