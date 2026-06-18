import { Session } from "next-auth";
import { auth } from "@/auth";

export type AllowedRoles = 
  | "superadmin" 
  | "admin" 
  | "pengurus" 
  | "ketua" 
  | "kasir" 
  | "petugas_akuntan" 
  | "pengawas" 
  | "anggota";

/**
 * Verify user has required role, throw if not authorized
 */
export async function checkRole(
  allowedRoles: AllowedRoles[],
  session?: Session | null
): Promise<Session> {
  const sess = session || (await auth());
  
  if (!sess?.user?.role) {
    throw new Error("Unauthorized: No session");
  }
  
  if (!allowedRoles.includes(sess.user.role as AllowedRoles)) {
    throw new Error(
      `Unauthorized: Requires ${allowedRoles.join(" or ")}. ` +
      `Current role: ${sess.user.role}`
    );
  }
  
  return sess;
}

/**
 * Verify user owns the resource (IDOR protection)
 */
export async function checkOwnership(
  session: Session,
  resourceUserId: BigInt | string | number
): Promise<void> {
  const userId = BigInt(session.user.id);
  const resId = BigInt(resourceUserId);
  
  if (userId !== resId) {
    throw new Error(
      "Unauthorized: Cannot access this resource"
    );
  }
}

/**
 * Wrapper for server actions with role check
 */
export async function withRoleCheck<T>(
  allowedRoles: AllowedRoles[],
  fn: (session: Session) => Promise<T>
): Promise<T> {
  const session = await checkRole(allowedRoles);
  return fn(session);
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(
  roles: AllowedRoles[],
  session?: Session | null
): Promise<boolean> {
  const sess = session || (await auth());
  if (!sess?.user?.role) return false;
  return roles.includes(sess.user.role as AllowedRoles);
}

/**
 * Check if user is admin-level (superadmin or admin)
 */
export async function isAdmin(
  session?: Session | null
): Promise<boolean> {
  return hasAnyRole(["superadmin", "admin"], session);
}

/**
 * Check if user is manager-level (admin, pengurus, or ketua)
 */
export async function isManager(
  session?: Session | null
): Promise<boolean> {
  return hasAnyRole(["superadmin", "admin", "pengurus", "ketua"], session);
}

/**
 * Check if user is staff (anyone except anggota)
 */
export async function isStaff(
  session?: Session | null
): Promise<boolean> {
  const sess = session || (await auth());
  if (!sess?.user?.role) return false;
  return sess.user.role !== "anggota";
}
