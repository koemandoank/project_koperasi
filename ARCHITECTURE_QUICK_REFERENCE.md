# ARCHITECTURE QUICK REFERENCE
## Koperasi Sulfindo - Developer Checklist

**Version**: 1.0  
**Last Updated**: June 17, 2026  
**Purpose**: Quick lookup for team during development

---

## 🚨 CRITICAL CHECKLIST (Do This First)

Before writing any new server action, ensure:

- [ ] **Role Check**: Does it need `checkRole()`?
- [ ] **User Filter**: Does it access personal data? Add `session.user.id` filter
- [ ] **Validation**: Use Zod schema with `.strict()`?
- [ ] **Atomic Ops**: Does it modify stock/payment? Use `.decrement()`/`.increment()`
- [ ] **Transactions**: Multi-step operation? Wrap in `prisma.$transaction()`
- [ ] **Error Handling**: Return `{ success, data, error }` format
- [ ] **Enum Safety**: Use `z.enum()` for database enums

---

## 📋 NEW SERVER ACTION TEMPLATE

```typescript
"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { checkRole } from "@/lib/auth-helpers";

// 1. Define schema with strict validation
const createXxxSchema = z.object({
  name: z.string().min(1).max(100),
  status: z.enum(["active", "inactive"]),
  amount: z.number().positive()
}).strict();

// 2. Define return type
export interface CreateXxxResult {
  success: boolean;
  data?: any;
  error?: string;
}

// 3. Implement action with full protection
export async function createXxx(
  data: unknown
): Promise<CreateXxxResult> {
  try {
    // Validate input
    const validated = createXxxSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.message };
    }

    // Check authorization
    const session = await checkRole(["admin", "pengurus"]);

    // Execute with transaction if needed
    const result = await prisma.xxx.create({
      data: validated.data
    });

    return { success: true, data: result };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[CreateXxx Error]", msg);
    return { success: false, error: msg };
  }
}
```

---

## 🛡️ SECURITY CHECKLIST FOR CODE REVIEW

### IDOR Prevention
```typescript
// ❌ WRONG - No user filter
const data = await prisma.xxx.findMany({
  where: { memberId: params.memberId }
});

// ✅ RIGHT - Filter by session user
const session = await auth();
const data = await prisma.xxx.findMany({
  where: { 
    memberId: params.memberId,
    user_id: BigInt(session.user.id)  // ← Must have this
  }
});
```

### Race Condition Prevention
```typescript
// ❌ WRONG - Check then Act
if (product.stock < qty) throw Error();
await db.update({ stock: product.stock - qty });

// ✅ RIGHT - Atomic Operation
await prisma.products.update({
  where: { id },
  data: { stock: { decrement: qty } }  // ← Atomic
});
```

### Validation Enforcement
```typescript
// ❌ WRONG - Missing .strict()
const schema = z.object({ name: z.string() });

// ✅ RIGHT - Reject unknown fields
const schema = z.object({ 
  name: z.string() 
}).strict();
```

### Role Check
```typescript
// ❌ WRONG - No role check
export async function deleteProduct(id: number) {
  return prisma.products.delete({ where: { id } });
}

// ✅ RIGHT - Explicit role check
export async function deleteProduct(id: number) {
  await checkRole(["admin"]);  // ← Must have this
  return prisma.products.delete({ where: { id } });
}
```

---

## 📊 FILE SIZE GUIDELINES

### Recommended Limits
- Server action files: **MAX 300 lines**
- Component files: **MAX 400 lines**
- Utility files: **MAX 500 lines**

### Current Problem Files (Need Refactor)
- `inventory.ts` - 656 lines → Split into 6 files
- `loans.ts` - ~400 lines → Split into 4 files
- `accounting.ts` - ~300 lines → Consider splitting

### How to Split
```
Before: src/lib/actions/inventory.ts (656 lines)

After:  src/lib/actions/inventory/
        ├── index.ts (re-exports)
        ├── locations.ts (50 lines)
        ├── balances.ts (100 lines)
        ├── movements.ts (150 lines)
        ├── transfers.ts (100 lines)
        ├── opname.ts (120 lines)
        └── reorder.ts (50 lines)
```

---

## 🔧 COMMON PATTERNS

### Pattern 1: Query with User Filter
```typescript
export async function getMyData() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  
  return prisma.xxx.findMany({
    where: { user_id: BigInt(session.user.id) }
  });
}
```

### Pattern 2: Atomic Stock Update
```typescript
const updated = await prisma.products.update({
  where: { id: productId },
  data: { stock: { decrement: qty } }
});

if (updated.stock < 0) {
  throw new Error("Out of stock");
}
```

### Pattern 3: Transactional Operation
```typescript
return prisma.$transaction(async (tx) => {
  const record1 = await tx.model1.create({ ... });
  const record2 = await tx.model2.create({
    ...data,
    relation_id: record1.id
  });
  return { record1, record2 };
});
```

### Pattern 4: Pagination
```typescript
export async function getRecords(page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;
  const [data, total] = await Promise.all([
    prisma.xxx.findMany({ skip, take: pageSize }),
    prisma.xxx.count()
  ]);
  return { data, total, page, pageSize };
}
```

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying any changes:

- [ ] **Security**: Run IDOR tests manually
- [ ] **Performance**: Check query logs (< 100ms P95)
- [ ] **Validation**: All Zod schemas have `.strict()`
- [ ] **Transactions**: Multi-step ops wrapped in `$transaction()`
- [ ] **Role Checks**: `checkRole()` on all mutations
- [ ] **Error Handling**: Consistent return format
- [ ] **Tests**: Unit tests for critical paths
- [ ] **Code Review**: 2+ approvers for security changes

---

## 📚 FILE ORGANIZATION REFERENCE

### Correct Structure
```
src/
├── lib/
│   ├── actions/
│   │   ├── index.ts (re-exports all)
│   │   ├── auth.ts (3 functions)
│   │   ├── members.ts (5 functions)
│   │   ├── loans.ts (4 functions) ← Consider splitting
│   │   ├── inventory/
│   │   │   ├── index.ts
│   │   │   ├── locations.ts
│   │   │   └── balances.ts
│   │   └── [domain]/
│   ├── auth-helpers.ts ← NEW
│   ├── server-action-helpers.ts ← NEW
│   ├── db.ts
│   └── utils.ts
├── components/
│   ├── forms/
│   │   ├── member-form.tsx
│   │   └── loan-form.tsx
│   ├── shared/
│   │   └── sidebar.tsx
│   └── ui/
│       └── [...shadcn components]
└── app/
    ├── (auth)/
    ├── (dashboard)/
    │   └── [...routes]
    └── api/
```

---

## 🔍 DEBUGGING TIPS

### IDOR Testing
```bash
# 1. Login as User A, note their ID
# 2. Fetch personal resource of User A (works)
# 3. Try fetching personal resource of User B
# 4. If it works → IDOR vulnerability!

Example:
GET /api/member-portal/loans?memberId=1  (OK)
GET /api/member-portal/loans?memberId=2  (SHOULD FAIL!)
```

### Race Condition Testing
```bash
# Use curl in parallel to simulate concurrent requests
for i in {1..10}; do
  curl -X POST /api/checkout \
    -d '{"product":1,"qty":1}' &
done
wait
# Check if stock went negative → race condition!
```

### N+1 Query Detection
```typescript
// Enable query logging in development
const prisma = new PrismaClient({
  log: ['query']
});

// Watch console output
// If you see multiple SELECT for same table → N+1!
```

---

## 🆘 COMMON MISTAKES TO AVOID

| Mistake | Why Bad | Fix |
|---------|---------|-----|
| No user filter in personal data queries | IDOR vulnerability | Add `user_id` filter |
| Check stock, then update (race condition) | Overselling | Use `.decrement()` |
| Missing `.strict()` on Zod schemas | Mass assignment | Add `.strict()` |
| No role check on mutations | Privilege escalation | Add `checkRole()` |
| Individual DB updates, not transactional | Data corruption | Use `$transaction()` |
| Oversized files (600+ lines) | Hard to maintain | Split into smaller files |
| Inconsistent error handling | Bugs hard to debug | Use standard format |
| N+1 queries | Performance degradation | Add `include` or `select` |

---

## 📞 QUICK REFERENCE LINKS

**Documentation Files:**
- `COMPREHENSIVE_ARCHITECTURE_REVIEW.md` - Deep dive (read first!)
- `ARCHITECTURE_IMPROVEMENT_EXAMPLES.md` - Code examples
- `ARCHITECTURE_EXECUTIVE_SUMMARY.md` - Status & roadmap
- `ARCHITECTURE_QUICK_REFERENCE.md` - This file

**Key Functions:**
- `checkRole()` - Role verification → `src/lib/auth-helpers.ts`
- `withErrorHandling()` - Error wrapper → `src/lib/server-action-helpers.ts`
- `auth()` - Get session → `src/auth.ts`

**Important Files:**
- Auth config → `src/auth.config.ts`
- Database schema → `prisma/schema.prisma`
- Server actions → `src/lib/actions/`
- Routes → `src/app/`

---

## ⚡ QUICK START: First 3 Days

### Day 1: Setup
```bash
# Create new utility files
touch src/lib/auth-helpers.ts
touch src/lib/server-action-helpers.ts

# Copy templates from ARCHITECTURE_IMPROVEMENT_EXAMPLES.md
# into these files
```

### Day 2: Fix Critical Actions
```bash
# Update these files with IDOR fixes + role checks:
src/lib/actions/member-portal.ts
src/lib/actions/shu-calculation.ts
src/lib/actions/pos.ts

# Use template patterns from QUICK_REFERENCE above
```

### Day 3: Add Validations
```bash
# Add .strict() to all Zod schemas in:
src/lib/actions/loan-products.ts
src/lib/actions/members.ts
src/lib/actions/loans.ts
src/lib/actions/products.ts

# Add enum validation with z.enum()
```

---

**Remember**: When in doubt, ask in code review. Security > Speed.


