import { auth } from "@/auth";

export function checkRole(session: any, allowedRoles: string[]) {
  if (!session || !session.user) {
    throw new Error("Unauthorized: Harap login kembali");
  }

  // If "*" is allowed, just verifying authentication is enough
  if (allowedRoles.includes("*")) {
    return session;
  }

  const role = session.user.role as string;
  if (!allowedRoles.includes(role)) {
    throw new Error(`Forbidden: Role '${role}' tidak memiliki hak akses untuk tindakan ini`);
  }

  return session;
}

export async function verifySessionAndRole(allowedRoles: string[]) {
  const session = await auth();
  return checkRole(session, allowedRoles);
}

