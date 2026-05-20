"use client";

import { useState, useEffect } from "react";
import { type UserData, createUser, updateUser } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Loader2, Lock, ShieldAlert, UserCheck, Shield } from "lucide-react";
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
  };

  const roleColors: Record<string, string> = {
    superadmin: "bg-purple-100 text-purple-700 border-purple-200",
    admin: "bg-blue-100 text-blue-700 border-blue-200",
    pengurus: "bg-emerald-100 text-emerald-700 border-emerald-200",
    kasir: "bg-amber-100 text-amber-700 border-amber-200",
  };

  const roleIcons: Record<string, React.ReactNode> = {
    superadmin: <ShieldAlert className="h-3.5 w-3.5" />,
    admin: <Shield className="h-3.5 w-3.5" />,
    pengurus: <UserCheck className="h-3.5 w-3.5" />,
    kasir: <Lock className="h-3.5 w-3.5" />,
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah User
        </Button>
      </div>

      <div className="border rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
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
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  Tidak ada data user.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const canEdit =
                  currentRole === "superadmin" ||
                  (currentRole === "admin" && u.role !== "superadmin");

                return (
                  <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-semibold">{u.username}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
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
                    <TableCell className="text-sm text-muted-foreground">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Akun User" : "Tambah Akun User"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="contoh: admin_toko"
                className="lowercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@koperasi.id"
                className="lowercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Role / Hak Akses</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v ?? "pengurus" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Role" />
                </SelectTrigger>
                <SelectContent>
                  {currentRole === "superadmin" && (
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                  )}
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="pengurus">Pengurus Koperasi</SelectItem>
                  <SelectItem value="kasir">Kasir Toko</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Password {editId && <span className="text-muted-foreground font-normal">(Kosongkan jika tidak ingin diubah)</span>}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimal 6 karakter"
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4 mt-2">
              <div className="space-y-0.5">
                <Label>Status Akun</Label>
                <p className="text-xs text-muted-foreground">Aktifkan untuk mengizinkan login.</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>

            <Button className="w-full mt-4" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {saving ? "Menyimpan..." : "Simpan Akun"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
