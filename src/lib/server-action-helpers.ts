import { Session } from "next-auth";
import { ZodSchema } from "zod";
import { auth } from "@/auth";
import { checkRole, AllowedRoles } from "./auth-helpers";

export interface ServerActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Wrap server action with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>
): Promise<ServerActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[ServerActionError]", message);
    return { success: false, error: message };
  }
}

/**
 * Wrap server action with auth check
 */
export async function withAuth<T>(
  fn: (session: Session) => Promise<T>
): Promise<ServerActionResult<T>> {
  return withErrorHandling(async () => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return fn(session);
  });
}

/**
 * Wrap server action with role check
 */
export async function withRoleAndError<T>(
  roles: AllowedRoles[],
  fn: (session: Session) => Promise<T>
): Promise<ServerActionResult<T>> {
  return withErrorHandling(async () => {
    const session = await checkRole(roles);
    return fn(session);
  });
}

/**
 * Wrap server action with validation
 */
export async function withValidation<T, V>(
  schema: ZodSchema,
  data: unknown,
  fn: (validated: V) => Promise<T>
): Promise<ServerActionResult<T>> {
  return withErrorHandling(async () => {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(result.error.flatten().formErrors[0] || "Validation failed");
    }
    return fn(result.data as V);
  });
}

/**
 * Combine all: auth + role + validation + error handling
 */
export async function withFullProtection<T, V>(
  roles: AllowedRoles[],
  schema: ZodSchema,
  data: unknown,
  fn: (session: Session, validated: V) => Promise<T>
): Promise<ServerActionResult<T>> {
  return withErrorHandling(async () => {
    const session = await checkRole(roles);
    
    const validated = schema.safeParse(data);
    if (!validated.success) {
      throw new Error(validated.error.flatten().formErrors[0] || "Validation failed");
    }
    
    return fn(session, validated.data as V);
  });
}

/**
 * Simple wrapper that only does error handling and auth (no role/validation)
 */
export async function withAuthAndError<T>(
  fn: (session: Session) => Promise<T>
): Promise<ServerActionResult<T>> {
  return withErrorHandling(async () => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return fn(session);
  });
}
