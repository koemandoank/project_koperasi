"use client";

import { useState, useEffect } from "react";
import { type UserData, createUser, updateUser } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerFooter } from "@/components/ui/drawer";
import { Plus, Edit, Loader2, Lock, ShieldAlert, UserCheck, Shield, BookOpen, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function UsersClient({
  initialUsers,
  currentRole,
}: {
  initialUsers: UserData[];
  currentRole: string;
}) {
  const [users, setUsers] = useState<UserData[]>(initialUsers);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "pengurus",
    is_active: true,
  });

  const router = useRouter();

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const handleOpenAdd = () => {
    setEditId(null);
    setForm({ username: "", email: "", password: "", role: "pengurus", is_active: true });
    setOpen(true);
  };

  const handleOpenEdit = (user: UserData) => {
    setEditId(user.id);
    setForm({
      username: user.username,
      email: user.email,
      password: "", // biarkan kosong jika tidak diubah
      role: user.role,
      is_active: user.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.username || !form.email) {
      return toast.error("Username dan Email wajib diisi.");
    }
    if (!editId && (!form.password || form.password.length < 6)) {
      return toast.error("Password wajib minimal 6 karakter untuk akun baru.");
    }

    setSaving(true);
    try {
      const payload: any = {
        username: form.username,
        email: form.email,
        role: form.role,
        is_active: form.is_active,
      };

      if (form.password) payload.password = form.password;

      const res = editId
        ? await updateUser(editId, payload)
        : await createUser(payload);

      if (res.success) {
        toast.success(editId ? "Akun diperbarui!" : "Akun berhasil dibuat!");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Gagal menyimpan akun");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  const roleLabels: Record<string, string> = {
    superadmin: "Super Admin",
    admin: "Administrator",
    pengurus: "Pengurus Koperasi",
    kasir: "Kasir Toko",
    petugas_akuntan: "Petugas Akuntan",
    pengawas: "Pengawas Koperasi",
  };

  const roleColors: Record<string, string> = {
    superadmin: "bg-purple-100 text-purple-700 border-purple-200",
    admin: "bg-blue-100 text-blue-700 border-blue-200",
    pengurus: "bg-emerald-100 text-emerald-700 border-emerald-200",
    kasir: "bg-amber-100 text-amber-700 border-amber-200",
    petugas_akuntan: "bg-cyan-100 text-cyan-700 border-cyan-200",
    pengawas: "bg-indigo-100 text-indigo-700 border-indigo-200",
  };

  const roleIcons: Record<string, React.ReactNode> = {
    superadmin: <ShieldAlert className="h-3.5 w-3.5" />,
    admin: <Shield className="h-3.5 w-3.5" />,
    pengurus: <UserCheck className="h-3.5 w-3.5" />,
    kasir: <Lock className="h-3.5 w-3.5" />,
    petugas_akuntan: <BookOpen className="h-3.5 w-3.5" />,
    pengawas: <ShieldCheck className="h-3.5 w-3.5" />,
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah User
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role / Hak Akses</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Aktivitas Terakhir</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-slate-400">
                  Tidak ada data user.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u: any) => {
                const canEdit =
                  currentRole === "superadmin" ||
                  (currentRole === "admin" && u.role !== "superadmin");

                return (
                  <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-semibold">{u.username}</TableCell>
                    <TableCell className="text-slate-400">{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`gap-1.5 ${roleColors[u.role] || "bg-slate-100"}`}
                      >
                        {roleIcons[u.role]}
                        {roleLabels[u.role] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={u.is_active ? "default" : "secondary"}>
                        {u.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-400">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleString("id-ID")
                        : "Belum pernah login"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canEdit}
                        onClick={() => handleOpenEdit(u)}
                      >
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card Feed View */}
      <div className="block md:hidden space-y-3">
        {users.length === 0 ? (
          <div className="text-center py-10 text-slate-400 border border-dashed rounded-2xl bg-white dark:bg-slate-900">
            Tidak ada data user.
          </div>
        ) : (
          users.map((u: any) => {
            const canEdit =
              currentRole === "superadmin" ||
              (currentRole === "admin" && u.role !== "superadmin");

            return (
              <div
                key={u.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 ${
                  !u.is_active ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-base text-slate-900 dark:text-slate-50">{u.username}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{u.email}</p>
                  </div>
                  <Badge variant={u.is_active ? "default" : "secondary"} className="text-xs shrink-0">
                    {u.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800/50 pt-2.5">
                  <Badge
                    variant="outline"
                    className={`gap-1.5 text-xs ${roleColors[u.role] || "bg-slate-100"}`}
                  >
                    {roleIcons[u.role]}
                    {roleLabels[u.role] || u.role}
                  </Badge>
                  <p className="text-[10px] text-slate-400">
                    Log: {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString("id-ID") : "Never"}
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full h-11 gap-2 font-medium"
                  disabled={!canEdit}
                  onClick={() => handleOpenEdit(u)}
                >
                  <Edit className="h-4 w-4" /> Edit Hak Akses / Password
                </Button>
              </div>
            );
          })
        )}
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent showClose>
          <DrawerHeader>
            <DrawerTitle>{editId ? "Edit Akun User" : "Tambah Akun User"}</DrawerTitle>
          </DrawerHeader>

          <DrawerBody className="space-y-4">
            <div className="space-y-1">
              <Label className="font-semibold text-sm">Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="contoh: admin_toko"
                className="lowercase h-12 text-base"
              />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold text-sm">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@koperasi.id"
                className="lowercase h-12 text-base"
              />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold text-sm">Role / Hak Akses</Label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="flex w-full rounded-lg border border-input bg-white dark:bg-slate-900 px-3 py-2 text-base h-12 outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 dark:text-slate-100"
              >
                {currentRole === "superadmin" && (
                  <option value="superadmin">Super Admin</option>
                )}
                <option value="admin">Administrator</option>
                <option value="pengurus">Pengurus Koperasi</option>
                <option value="kasir">Kasir Toko</option>
                <option value="petugas_akuntan">Petugas Akuntan</option>
                <option value="pengawas">Pengawas Koperasi</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold text-sm">Password {editId && <span className="text-slate-400 font-normal">(Kosongkan jika tidak ingin diubah)</span>}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimal 6 karakter"
                className="h-12 text-base"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800/50 pt-4 mt-2">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Status Akun</p>
                <p className="text-xs text-slate-400">Aktifkan untuk mengizinkan login.</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {saving ? "Menyimpan..." : "Simpan Akun"}
            </Button>
            <Button type="button" variant="ghost" className="w-full h-12" onClick={() => setOpen(false)}>Batal</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
