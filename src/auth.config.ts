import type { NextAuthConfig } from "next-auth";

// Route access map per role
const ROLE_ROUTES: Record<string, string[]> = {
  superadmin: ["*"], // all
  admin: ["*"],
  pengurus: [
    "/dashboard", "/anggota", "/simpanan", "/pinjaman", "/laporan",
    "/akuntansi", "/toko/kasir", "/toko/produk", "/toko/pesanan", "/toko/inventaris", "/toko/konsinyasi",
    "/pembelian", "/pengaturan", "/log",
  ],
  ketua: [
    "/dashboard", "/anggota", "/simpanan", "/pinjaman", "/laporan",
    "/akuntansi", "/pengaturan/shu", "/log",
  ],
  kasir: ["/dashboard", "/toko/kasir", "/toko/produk", "/toko/pesanan", "/toko/konsinyasi", "/laporan/harian", "/laporan/stok"],
  anggota: ["/dashboard", "/simpanan", "/pinjaman", "/toko"],
};

function canAccess(role: string, pathname: string): boolean {
  const allowed = ROLE_ROUTES[role];
  if (!allowed) return false;
  if (allowed[0] === "*") return true;
  return allowed.some(r => pathname === r || pathname.startsWith(r + "/"));
}

export const authConfig = {
  // FIX: [Capacitor Android Network Security (MITM Prevention)] - Enforce secure cookies in production
  useSecureCookies: process.env.NODE_ENV === "production",
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl, headers } }) {
      const isLoggedIn = !!auth?.user;

      const userAgent = headers.get("user-agent") || "";
      const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(userAgent);

      const publicPaths = ["/login", "/api/auth"];
      if (publicPaths.some(p => nextUrl.pathname.startsWith(p))) {
        if (isLoggedIn && nextUrl.pathname.startsWith("/login")) {
          const redirectUrl = isMobile ? "/dashboard/home" : "/dashboard";
          return Response.redirect(new URL(redirectUrl, nextUrl));
        }
        return true;
      }

      // All other paths require login
      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      const role = String(auth?.user?.role || "anggota");

      // Bypas RBAC untuk halaman profil & home dashboard agar dapat diakses semua user
      if (nextUrl.pathname === "/profil" || nextUrl.pathname.startsWith("/profil/") || nextUrl.pathname === "/dashboard/home") {
        return true;
      }

      // Redirect user mobile dari /dashboard ke /dashboard/home (Beranda)
      if (nextUrl.pathname === "/dashboard" && nextUrl.searchParams.get("forceDashboard") !== "true") {
        if (isMobile) {
          return Response.redirect(new URL("/dashboard/home", nextUrl));
        }
      }

      // Check RBAC
      if (!canAccess(role, nextUrl.pathname)) {
        const redirectUrl = isMobile ? "/dashboard/home" : "/dashboard";
        return Response.redirect(new URL(redirectUrl, nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        const u = user as { role?: unknown; id?: unknown };
        if (u.role !== undefined) token.role = String(u.role);
        if (u.id !== undefined) {
          token.id = String(u.id);
          token.sub = String(u.id);
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = String(token.id);
      } else if (session.user && token.sub) {
        session.user.id = String(token.sub);
      }
      if (session.user && token.role) {
        session.user.role = String(token.role);
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
