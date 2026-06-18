# ARCHITECTURE IMPROVEMENT - PRACTICAL EXAMPLES
## Implementation Guides for Koperasi Sulfindo

**Date**: June 17, 2026  
**Purpose**: Provide concrete code examples for each recommendation

---

## 1. SECURITY FIXES

### 1.1 Centralized RBAC Utility

**File: `src/lib/auth-helpers.ts`** (New)

```typescript
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
```

**Usage in Server Actions:**

```typescript
// src/lib/actions/loan-products.ts
"use server";

import { checkRole, withRoleCheck } from "@/lib/auth-helpers";

export async function createLoanProduct(data: any) {
  return withRoleCheck(["admin", "pengurus"], async (session) => {
    // ... implementation
  });
}

// OR manual check
export async function updateLoanProduct(id: number, data: any) {
  const session = await checkRole(["admin", "pengurus"]);
  
  // ... implementation
  
  return result;
}
```

---

### 1.2 Fix IDOR in Member Portal

**File: `src/lib/actions/member-portal.ts`** (Updated)

**BEFORE (Vulnerable)**:
```typescript
export async function getMyPinjaman() {
  // ❌ No user filter!
  return prisma.loans.findMany({
    where: { status: "active" },
    include: { member: true }
  });
}
```

**AFTER (Fixed)**:
```typescript
export async function getMyPinjaman() {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  
  // ✅ Filter by user's member ID
  const member = await prisma.member.findFirst({
    where: { users: { some: { id: BigInt(session.user.id) } } }
  });
  
  if (!member) {
    throw new Error("Member not found");
  }
  
  return prisma.loans.findMany({
    where: { 
      member_id: member.id,
      status: "active" 
    },
    include: { member: true }
  });
}
```

---

### 1.3 Add Zod `.strict()` Validation

**File: `src/lib/actions/loan-products.ts`** (Updated)

**BEFORE (Vulnerable)**:
```typescript
const createSchema = z.object({
  code: z.string(),
  name: z.string(),
  rate: z.number()
});  // ← Missing .strict()

export async function createLoanProduct(data: unknown) {
  const validated = createSchema.safeParse(data);
  // Attacker sends: { code, name, rate, is_system: true }
  // Extra field silently ignored ❌
}
```

**AFTER (Fixed)**:
```typescript
const createLoanProductSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  rate: z.number().positive().max(100),
  grace_period_days: z.number().int().positive().optional(),
  is_active: z.boolean().default(true)
}).strict();  // ✅ Reject unknown fields

export async function createLoanProduct(data: unknown) {
  const session = await checkRole(["admin", "pengurus"]);
  
  const validated = createLoanProductSchema.safeParse(data);
  if (!validated.success) {
    throw new Error(`Validation error: ${validated.error.message}`);
  }
  
  const result = await prisma.loanProducts.create({
    data: validated.data
  });
  
  return { success: true, data: result };
}
```

---

### 1.4 Fix Race Conditions with Atomic Operations

**File: `src/lib/actions/pos.ts`** (Updated)

**BEFORE (Race Condition)**:
```typescript
export async function processPosCheckout(data: {
  productId: number;
  qty: number;
  price: number;
}) {
  // ❌ Race condition: Check then Act
  const product = await prisma.products.findUnique({
    where: { id: data.productId }
  });
  
  if (product.stock < data.qty) {
    throw new Error("Out of stock");  // ← Check
  }
  
  // ← Race condition window here!
  // Another request can buy the last items
  
  await prisma.products.update({
    where: { id: data.productId },
    data: { stock: product.stock - data.qty }  // ← Act
  });
}
```

**AFTER (Fixed with Atomic Operations)**:
```typescript
export async function processPosCheckout(data: {
  productId: number;
  qty: number;
  price: number;
}) {
  const session = await checkRole(["kasir"]);
  
  try {
    // ✅ Atomic operation: Decrement and check in one DB operation
    const updated = await prisma.products.update({
      where: { id: data.productId },
      data: {
        stock: { decrement: data.qty }  // ← Atomic!
      }
    });
    
    // ✅ Check AFTER write
    if (updated.stock < 0) {
      // Rollback by incrementing back
      await prisma.products.update({
        where: { id: data.productId },
        data: { stock: { increment: data.qty } }
      });
      throw new Error("Out of stock");
    }
    
    // Create order with transaction
    return prisma.$transaction(async (tx) => {
      const order = await tx.orders.create({
        data: {
          user_id: BigInt(session.user.id),
          product_id: BigInt(data.productId),
          qty: data.qty,
          total_price: data.qty * data.price,
          status: "completed"
        }
      });
      
      await tx.orderItems.create({
        data: {
          order_id: order.id,
          product_id: BigInt(data.productId),
          qty: data.qty,
          price: data.price
        }
      });
      
      return order;
    });
  } catch (error) {
    // Rollback on any error
    if (error instanceof Error && error.message.includes("Out of stock")) {
      throw error;
    }
    
    console.error("[POS Checkout Error]", error);
    throw new Error("Failed to process checkout");
  }
}
```

---

## 2. CODE ORGANIZATION FIXES

### 2.1 Split `inventory.ts` (656 lines)

**Current Structure:**
```
src/lib/actions/inventory.ts (656 lines)
```

**New Structure:**
```
src/lib/actions/inventory/
├── locations.ts       (Warehouse locations)
├── balances.ts        (Stock queries)
├── movements.ts       (Receipt/adjustment)
├── transfers.ts       (Transfer workflow)
├── opname.ts          (Physical count)
├── reorder.ts         (Reorder points)
└── index.ts           (Re-exports)
```

**File: `src/lib/actions/inventory/index.ts`**
```typescript
// Re-export all inventory actions
export * from "./locations";
export * from "./balances";
export * from "./movements";
export * from "./transfers";
export * from "./opname";
export * from "./reorder";
```

**File: `src/lib/actions/inventory/locations.ts`** (Sample)
```typescript
"use server";

import { prisma } from "@/lib/db";
import { checkRole } from "@/lib/auth-helpers";

export async function createWarehouseLocation(
  unitId: bigint,
  name: string,
  code: string
) {
  await checkRole(["admin", "pengurus"]);
  
  return prisma.warehouseLocations.create({
    data: {
      unit_id: unitId,
      name,
      code
    }
  });
}

export async function getWarehouseLocations(unitId: bigint) {
  return prisma.warehouseLocations.findMany({
    where: { unit_id: unitId },
    include: { stock_balances: true }
  });
}

export async function deleteWarehouseLocation(id: bigint) {
  await checkRole(["admin"]);
  
  return prisma.warehouseLocations.delete({
    where: { id }
  });
}
```

**Update imports in components:**
```typescript
// Old
import { 
  createWarehouseLocation, 
  getStockBalances,
  createStockTransfer 
} from "@/lib/actions/inventory";

// New (same)
import { 
  createWarehouseLocation, 
  getStockBalances,
  createStockTransfer 
} from "@/lib/actions/inventory";

// Both work because of index.ts re-exports!
```

---

### 2.2 Create Server Action Helpers

**File: `src/lib/server-action-helpers.ts`** (New)

```typescript
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
```

**Usage in Server Actions:**

```typescript
// src/lib/actions/loans.ts
"use server";

import { withFullProtection } from "@/lib/server-action-helpers";
import { z } from "zod";

const createLoanSchema = z.object({
  product_id: z.number().positive(),
  amount: z.number().positive(),
  term_months: z.number().positive()
}).strict();

export async function createLoan(data: unknown) {
  return withFullProtection(
    ["admin", "pengurus"],  // Roles
    createLoanSchema,       // Validation
    data,                   // Input
    async (session, validated) => {
      // Fully protected! Auth checked, role checked, validated
      const loan = await prisma.loans.create({
        data: {
          product_id: BigInt(validated.product_id),
          amount: validated.amount,
          term_months: validated.term_months,
          user_id: BigInt(session.user.id)
        }
      });
      return loan;
    }
  );
}
```

---

## 3. DATA INTEGRITY FIXES

### 3.1 Transaction Support

**File: `src/lib/actions/loans.ts`** (Updated)

**BEFORE (Not Transactional)**:
```typescript
export async function submitLoanApplication(data: any) {
  const app = await prisma.loanApplications.create({
    data: { /* ... */ }
  });
  
  // ❌ If next line fails, app exists but has no schedule!
  const schedule = await prisma.loanPaymentSchedules.create({
    data: { loan_application_id: app.id }
  });
  
  return app;
}
```

**AFTER (Transactional)**:
```typescript
export async function submitLoanApplication(data: any) {
  // ✅ All-or-nothing: both succeed or both fail
  return prisma.$transaction(async (tx) => {
    // Create application
    const app = await tx.loanApplications.create({
      data: {
        member_id: BigInt(data.memberId),
        product_id: BigInt(data.productId),
        amount: data.amount,
        status: "pending",
        applied_at: new Date()
      }
    });
    
    // Create schedule
    const schedule = await tx.loanPaymentSchedules.create({
      data: {
        loan_application_id: app.id,
        total_installments: data.termMonths,
        monthly_amount: data.amount / data.termMonths,
        created_at: new Date()
      }
    });
    
    // Create journal entry
    await tx.journalEntries.create({
      data: {
        date: new Date(),
        description: `Loan application ${app.id}`,
        posted: false
      }
    });
    
    // If any fails, entire transaction rolls back!
    return { app, schedule };
  }, {
    timeout: 10000  // 10 second timeout
  });
}
```

---

### 3.2 Standardized Soft Delete Queries

**File: `src/lib/queries.ts`** (New)

```typescript
/**
 * Always use these helpers to ensure soft deletes are respected
 */

export const getActiveMembers = () =>
  prisma.member.findMany({
    where: { deleted_at: null }
  });

export const getActiveLoans = () =>
  prisma.loans.findMany({
    where: { deleted_at: null }
  });

export const getActiveProducts = () =>
  prisma.products.findMany({
    where: { deleted_at: null }
  });

export async function softDelete(model: string, id: bigint) {
  // Generic soft delete
  const prismaModel = prisma[model as keyof typeof prisma];
  return (prismaModel as any).update({
    where: { id },
    data: { deleted_at: new Date() }
  });
}

export async function softRestore(model: string, id: bigint) {
  // Restore soft-deleted record
  const prismaModel = prisma[model as keyof typeof prisma];
  return (prismaModel as any).update({
    where: { id },
    data: { deleted_at: null }
  });
}
```

**Usage**:
```typescript
// Instead of
const members = await prisma.member.findMany();

// Use
const members = await getActiveMembers();  // ✅ Auto-excludes deleted
```

---

## 4. PERFORMANCE IMPROVEMENTS

### 4.1 Add Pagination

**File: `src/lib/actions/members.ts`** (Updated)

```typescript
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function getMembers(
  params: PaginationParams = {}
): Promise<PaginationResult<any>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const skip = (page - 1) * pageSize;
  
  // Fetch data and count in parallel
  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where: { deleted_at: null },
      skip,
      take: pageSize,
      include: { units: true, users: true },
      orderBy: { created_at: "desc" }
    }),
    prisma.member.count({
      where: { deleted_at: null }
    })
  ]);
  
  return {
    data: members,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
}
```

---

## 5. QUICK WINS CHECKLIST

### Must-Do First (1-3 days)

- [ ] Create `src/lib/auth-helpers.ts` with `checkRole()` utility
- [ ] Add RBAC check to 10 most critical server actions
- [ ] Add Zod `.strict()` to 5 form validation schemas
- [ ] Create `src/lib/server-action-helpers.ts` with error wrappers
- [ ] Test IDOR vulnerability in member-portal.ts manually

### Should-Do Next (1-2 weeks)

- [ ] Audit all 51 server actions for IDOR
- [ ] Fix race conditions in POS checkout
- [ ] Add pagination to member/loan/product lists
- [ ] Split `inventory.ts` into 6 focused files
- [ ] Add transaction support to multi-step operations


