# SPRINT 1 REFACTORING ROADMAP
## Week 1-2: Foundation & Critical Fixes

**Goal:** Address showstoppers, establish reusable patterns, fix performance bottlenecks

**Total Effort:** 32 hours (4 full working days)  
**Team Size:** 1-2 developers recommended

---

## Task Breakdown

### Task 1.1: Add Pagination System (8 hours)

#### Objective
Replace O(n) list fetching with paginated queries. This is the **highest impact** fix.

#### Current State
```tsx
// lib/actions/members.ts
export async function getMembers() {
  return await prisma.member.findMany({
    include: { unit: true },
    orderBy: { created_at: 'desc' }
    // ❌ Fetches ALL records - if 5000 members exist, all come at once
  })
}
```

#### Implementation Steps

**Step 1.1.1: Create Pagination Utility** (1 hour)

File: `src/lib/utils/pagination.ts`

```tsx
export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    pages: number
    hasMore: boolean
  }
}

export function calculatePagination(page: number = 1, pageSize: number = 25) {
  const skip = Math.max(0, (page - 1) * pageSize)
  return { skip, take: pageSize }
}

export function getPaginationMeta(
  total: number,
  page: number,
  pageSize: number
) {
  const pages = Math.ceil(total / pageSize)
  return {
    page: Math.max(1, page),
    pageSize,
    total,
    pages,
    hasMore: page < pages
  }
}
```

**Step 1.1.2: Refactor All List Actions** (4 hours)

Apply to:
- `lib/actions/members.ts`
- `lib/actions/users.ts`
- `lib/actions/products.ts`
- `lib/actions/transactions.ts`
- `lib/actions/loans.ts`

Example pattern:
```tsx
// BEFORE
export async function getMembers() {
  return await prisma.member.findMany({
    include: { unit: true },
    orderBy: { created_at: 'desc' }
  })
}

// AFTER
export async function getMembers(page: number = 1, pageSize: number = 25) {
  const { skip, take } = calculatePagination(page, pageSize)
  
  const [data, total] = await Promise.all([
    prisma.member.findMany({
      include: { unit: true },
      orderBy: { created_at: 'desc' },
      skip,
      take
    }),
    prisma.member.count()
  ])
  
  return {
    data,
    pagination: getPaginationMeta(total, page, pageSize)
  }
}
```

**Step 1.1.3: Create Pagination UI Component** (1.5 hours)

File: `src/components/ui/pagination.tsx` (or use existing shadcn pagination)

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  page: number
  pages: number
  onPageChange: (page: number) => void
  loading?: boolean
}

export function Pagination({
  page,
  pages,
  onPageChange,
  loading = false
}: PaginationProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-slate-500">
        Page <span className="font-semibold">{page}</span> of{" "}
        <span className="font-semibold">{pages}</span>
      </p>
      
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages || loading}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

**Step 1.1.4: Update Page Components** (1.5 hours)

Example: `app/(dashboard)/anggota/page.tsx`

```tsx
import { Pagination } from "@/components/ui/pagination"
import { MembersTable } from "./member-table"

export default async function MembersPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1"))
  const pageSize = 25

  const result = await getMembers(page, pageSize)

  return (
    <div className="space-y-4">
      <MembersTable data={result.data} />
      
      <Pagination
        page={result.pagination.page}
        pages={result.pagination.pages}
        onPageChange={(newPage) => {
          // Use URL query params for server-side pagination
          // This will trigger a new request with ?page=2
        }}
      />
    </div>
  )
}
```

**Testing Checklist:**
- [ ] Load 5000 member records, verify only 25 load
- [ ] Check DB query logs show `LIMIT 25 OFFSET 0`
- [ ] Navigation between pages works
- [ ] Page state persists in URL (deep-linking works)

---

### Task 1.2: Remove Duplicate API Routes (6 hours)

#### Objective
Eliminate REST API endpoints that duplicate Server Actions. Consolidate to **4 API routes only:**
- `/api/auth` (required for NextAuth)
- `/api/upload` (BFF for Cloudinary)
- `/api/ping` (health check)
- (optional) `/api/health` for load balancer

#### Current Redundancy Issues

```
❌ /api/koperasi-settings/   ←→ getAppSettings() Server Action
❌ /api/shu-config/          ←→ getShuConfig() Server Action
❌ /api/loan-rules/          ←→ getLoanRules() Server Action
❌ /api/loan-transaction/[id]/ ←→ getLoanTransaction() Server Action
```

#### Implementation Steps

**Step 1.2.1: Audit API Usage** (1 hour)

Search codebase for API calls:
```bash
grep -r "fetch.*\/api\/" src/ --include="*.tsx" --include="*.ts"
grep -r "\/api\/koperasi-settings" src/
grep -r "\/api\/shu-config" src/
grep -r "\/api\/loan-rules" src/
grep -r "\/api\/loan-transaction" src/
```

Document all usage locations.

**Step 1.2.2: Replace API Calls with Server Actions** (3 hours)

For each endpoint, find all usages and migrate:

**Example: /api/koperasi-settings**

Current usage (if any):
```tsx
// Old API call
const res = await fetch('/api/koperasi-settings')
const settings = await res.json()
```

Migrate to:
```tsx
// New Server Action
const settings = await getAppSettings()
```

Actions already exist in:
- `lib/actions/settings.ts` → `getAppSettings()`, `updateAppSettings()`
- `lib/actions/shu-calculation.ts` → `getShuConfig()`
- `lib/actions/loans.ts` → `getLoanRules()`, `getLoanTransaction()`

If migrations don't exist, create them:

```tsx
// lib/actions/settings.ts
export const getAppSettings = cache(async () => {
  // Already exists ✓
})

// lib/actions/loans.ts
export async function getLoanRules() {
  return await prisma.loan_rules.findMany({
    where: { is_active: true },
    orderBy: { created_at: 'desc' }
  })
}

export async function getLoanTransaction(id: bigint) {
  return await prisma.loan_transactions.findUnique({
    where: { id },
    include: { loans: true, member: true }
  })
}
```

**Step 1.2.3: Delete Old API Routes** (1 hour)

```bash
# Delete files
rm -rf src/app/api/koperasi-settings/
rm -rf src/app/api/shu-config/
rm -rf src/app/api/loan-rules/
rm -rf src/app/api/loan-transaction/

# Keep only:
# src/app/api/auth/
# src/app/api/upload/
# src/app/api/ping/
```

**Step 1.2.4: Test & Verify** (1 hour)

- [ ] No broken imports in codebase
- [ ] All pages still load
- [ ] Settings page still works
- [ ] SHU config still loads
- [ ] Loan creation still validates rules
- [ ] Run full app in dev mode, no errors

---

### Task 1.3: Fix N+1 Queries (8 hours)

#### Objective
Optimize database queries to prevent slow performance as data grows.

#### Current Problem Areas

**Issue 1: Audit Log Loop**
```tsx
// Current: N+1 query
export async function getAuditLogs(limit: number = 100) {
  const entries = await prisma.audit_logs.findMany({
    take: limit,
    orderBy: { created_at: 'desc' }
    // ❌ Missing include - if code later accesses entry.user, triggers separate query
  })
  
  // If looping and accessing entry.user → 100 extra queries!
  return entries.map(e => ({
    ...e,
    user: e.user // ❌ Another query if not included
  }))
}
```

**Issue 2: Dashboard Stats (Multiple joins)**
```tsx
// lib/actions/dashboard-stats.ts
export async function getAdminStats() {
  const totalMembers = await prisma.member.count()
  const activeMembers = await prisma.member.count({ where: { status: "active" } })
  const cashBankAccounts = await prisma.chart_of_accounts.findMany({...})
  const journalLines = await prisma.journal_lines.aggregate({...})
  // ❌ 4 separate queries - should be 1-2
}
```

#### Implementation Steps

**Step 1.3.1: Add Eager Loading** (3 hours)

File: `lib/actions/audit-log.ts`

```tsx
// BEFORE
export async function getAuditLogs(limit: number = 100) {
  return await prisma.audit_logs.findMany({
    take: limit,
    orderBy: { created_at: 'desc' }
    // ❌ Missing relations
  })
}

// AFTER
export async function getAuditLogs(limit: number = 100) {
  return await prisma.audit_logs.findMany({
    take: limit,
    orderBy: { created_at: 'desc' },
    include: {
      user: {
        select: { id: true, username: true, email: true }
        // Only select needed fields
      }
    }
  })
}
```

**Step 1.3.2: Consolidate Dashboard Queries** (3 hours)

File: `lib/actions/dashboard-stats.ts`

```tsx
// BEFORE: 10+ separate queries
export async function getAdminStats() {
  const totalMembers = await prisma.member.count()
  const activeMembers = await prisma.member.count({ where: { status: "active" } })
  const loans = await prisma.loans.findMany()
  const savings = await prisma.savings.findMany()
  // ... etc
  return { totalMembers, activeMembers, loans, savings }
}

// AFTER: Consolidated with parallel fetches
export async function getAdminStats() {
  const [
    totalMembers,
    activeMembers,
    loanStats,
    savingStats,
    assetLiquidity
  ] = await Promise.all([
    prisma.member.count(),
    prisma.member.count({ where: { status: "active" } }),
    prisma.loans.aggregate({
      _sum: { amount_disbursed: true },
      _count: true,
      where: { status: "active" }
    }),
    prisma.savings.aggregate({
      _sum: { balance: true },
      _count: true
    }),
    // Asset liquidity with proper aggregation
    prisma.journal_lines.aggregate({
      _sum: { debit: true, credit: true },
      where: {
        journal_entries: { is_posted: true },
        chart_of_accounts: { type: "asset" }
      }
    })
  ])

  return {
    totalMembers,
    activeMembers,
    loans: {
      count: loanStats._count,
      total: loanStats._sum.amount_disbursed || 0
    },
    savings: {
      count: savingStats._count,
      total: savingStats._sum.balance || 0
    },
    assetLiquidity: assetLiquidity._sum.debit - assetLiquidity._sum.credit
  }
}
```

**Step 1.3.3: Add Database Indexes** (2 hours)

File: `prisma/migrations/[timestamp]_add_indexes.sql`

```sql
-- Add indexes to frequently queried columns
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_member_status_created ON member(status, created_at DESC);
CREATE INDEX idx_orders_ordered_at ON orders(ordered_at DESC);
CREATE INDEX idx_loan_applications_status ON loan_applications(status);
CREATE INDEX idx_journal_entries_posted_date ON journal_entries(is_posted, entry_date);
```

Run migration:
```bash
npx prisma migrate dev --name add_indexes
```

**Testing Checklist:**
- [ ] Check dashboard load time with 1000 members
- [ ] Monitor DB query count (should be <5 queries per page)
- [ ] Verify indexes are being used: `EXPLAIN ANALYZE`
- [ ] Audit log page loads quickly with 1000+ entries

---

### Task 1.4: Add Input Validation (10 hours)

#### Objective
Implement Zod validation in all Server Actions for security & consistency.

#### Current State
```tsx
// lib/actions/members.ts
export async function createMember(data: any) {
  // ❌ No validation - could pass anything
  const member = await prisma.member.create({
    data: {
      nik: data.nik,           // Could be empty
      full_name: data.full_name, // Could be 5000 chars
      email: data.email,       // Could be invalid
      phone: data.phone        // Could be text
    }
  })
}
```

#### Implementation Steps

**Step 1.4.1: Create Validation Schemas** (3 hours)

File: `src/lib/validations/index.ts`

```tsx
import { z } from 'zod'

// ── Members ──
export const memberCreateSchema = z.object({
  nik: z.string()
    .min(1, "NIK wajib diisi")
    .max(20, "NIK maksimal 20 karakter")
    .regex(/^[0-9]+$/, "NIK hanya boleh angka"),
  
  full_name: z.string()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  
  email: z.string()
    .email("Email tidak valid")
    .optional()
    .or(z.literal("")),
  
  phone: z.string()
    .min(10, "Nomor telepon minimal 10 digit")
    .max(15, "Nomor telepon maksimal 15 digit")
    .regex(/^[0-9+\-\s]+$/, "Format nomor telepon tidak valid"),
  
  unit_id: z.string().or(z.number()).transform(Number),
  
  role: z.enum(["anggota", "admin", "pengurus"]),
  
  photo_path: z.string().optional()
})

export const memberUpdateSchema = memberCreateSchema.partial()

// ── Users ──
export const userCreateSchema = z.object({
  username: z.string()
    .min(3, "Username minimal 3 karakter")
    .max(50, "Username maksimal 50 karakter")
    .regex(/^[a-z0-9_]+$/, "Username hanya boleh huruf kecil, angka, dan underscore"),
  
  email: z.string().email("Email tidak valid"),
  
  password: z.string()
    .min(6, "Password minimal 6 karakter")
    .max(100, "Password maksimal 100 karakter"),
  
  role: z.enum(["superadmin", "admin", "pengurus", "kasir", "petugas_akuntan", "pengawas"]),
  
  is_active: z.boolean().default(true)
})

// ── Products ──
export const productCreateSchema = z.object({
  sku: z.string()
    .min(1, "SKU wajib diisi")
    .max(50, "SKU maksimal 50 karakter"),
  
  name: z.string()
    .min(3, "Nama barang minimal 3 karakter")
    .max(200, "Nama barang maksimal 200 karakter"),
  
  purchase_price: z.number()
    .min(0, "Harga beli tidak boleh negatif"),
  
  price: z.number()
    .min(0, "Harga jual tidak boleh negatif"),
  
  member_price: z.number()
    .min(0, "Harga member tidak boleh negatif")
    .optional(),
  
  stock: z.number()
    .int("Stok harus berupa angka bulat")
    .min(0, "Stok tidak boleh negatif"),
  
  category_id: z.number(),
  unit_id: z.number(),
  unit_measure: z.string().default("pcs"),
  image_path: z.string().optional()
})

// ── Loans ──
export const loanApplicationSchema = z.object({
  loan_product_id: z.number(),
  
  amount_requested: z.number()
    .min(100000, "Minimal pinjaman Rp 100.000")
    .max(1000000000, "Maksimal pinjaman Rp 1 Miliar"),
  
  tenor_months: z.number()
    .int()
    .min(1, "Tenor minimal 1 bulan")
    .max(360, "Tenor maksimal 360 bulan"),
  
  repayment_method: z.enum(["salary_cut", "monthly_payment", "lump_sum"]),
  
  purpose: z.string()
    .min(10, "Tujuan pinjaman minimal 10 karakter")
    .max(500, "Tujuan pinjaman maksimal 500 karakter"),
  
  guarantor_name: z.string().optional(),
  guarantor_phone: z.string().optional()
})

// ── POS Checkout ──
export const posCheckoutSchema = z.object({
  cart: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      price: z.number().min(0),
      qty: z.number().int().min(1),
      stock: z.number().int().min(0)
    })
  ).min(1, "Keranjang tidak boleh kosong"),
  
  memberId: z.number().nullable().optional(),
  
  paymentMethod: z.enum(["cash", "qris", "paylater"]),
  
  subtotal: z.number().min(0),
  discount: z.number().min(0),
  grandTotal: z.number().min(0)
})
```

**Step 1.4.2: Update All Server Actions** (5 hours)

Apply validation to all CRUD actions:

```tsx
// BEFORE
export async function createMember(data: any) {
  const member = await prisma.member.create({ data })
  return { success: true, data: member }
}

// AFTER
export async function createMember(data: unknown) {
  try {
    // Validate input
    const validated = memberCreateSchema.parse(data)
    
    // Check duplicate NIK
    const existing = await prisma.member.findUnique({
      where: { nik: validated.nik }
    })
    if (existing) {
      return { success: false, error: "NIK sudah terdaftar" }
    }
    
    // Create member
    const member = await prisma.member.create({
      data: validated
    })
    
    // Audit log
    await logAudit({
      action: "CREATE",
      modelType: "member",
      modelId: Number(member.id),
      newValues: validated
    })
    
    revalidatePath('/anggota')
    return { success: true, data: member }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors[0].message,
        details: error.errors
      }
    }
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}
```

**Step 1.4.3: Add Type-safe Client Calls** (2 hours)

Create client-side wrapper that validates before sending:

```tsx
// lib/client/actions.ts
"use client"

import { memberCreateSchema } from "@/lib/validations"
import { createMember as serverCreateMember } from "@/lib/actions/members"

export async function createMemberSafe(data: unknown) {
  try {
    // Client-side validation before sending to server
    const validated = memberCreateSchema.parse(data)
    return await serverCreateMember(validated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
        details: error.errors
      }
    }
    throw error
  }
}
```

**Testing Checklist:**
- [ ] Create member with missing NIK → error
- [ ] Create member with invalid email → error
- [ ] Create member with negative phone length → error
- [ ] Create product with negative price → error
- [ ] Submit loan with amount < minimum → error
- [ ] Submit loan with invalid tenor → error
- [ ] POS checkout with empty cart → error

---

## Sprint 1 Completion Checklist

### Task 1.1: Pagination ✓
- [ ] Pagination utility created
- [ ] All list actions refactored (members, users, products, transactions, loans)
- [ ] Pagination UI component implemented
- [ ] All page components updated with pagination
- [ ] Deep linking works (?page=2 in URL)
- [ ] Performance improved on large datasets

### Task 1.2: Remove Duplicate APIs ✓
- [ ] All /api/koperasi-settings calls replaced with getAppSettings()
- [ ] All /api/shu-config calls replaced with getShuConfig()
- [ ] All /api/loan-rules calls replaced with getLoanRules()
- [ ] All /api/loan-transaction calls replaced with getLoanTransaction()
- [ ] Old API routes deleted
- [ ] No broken imports in codebase
- [ ] Tests pass

### Task 1.3: Fix N+1 Queries ✓
- [ ] Audit log eager loading added
- [ ] Dashboard queries consolidated with parallel fetches
- [ ] Database indexes created and verified
- [ ] Query count reduced on all pages
- [ ] Load time improved on large datasets

### Task 1.4: Add Input Validation ✓
- [ ] Zod schemas created for all entities
- [ ] All Server Actions have validation
- [ ] Error handling returns structured errors
- [ ] Client-side validation wrapper created
- [ ] Tests verify validation rules

---

## Rollout Plan

### Phase 1: Development (Days 1-5)
```
Day 1: Task 1.1 (Pagination)
Day 2: Task 1.2 (Remove APIs) + Task 1.3 Part 1 (Eager loading)
Day 3: Task 1.3 Part 2 (Consolidate queries) + Task 1.4 Part 1 (Schemas)
Day 4: Task 1.4 Part 2 (Update actions) + Testing
Day 5: QA, bug fixes, documentation
```

### Phase 2: Testing (Day 5-6)
```
Performance tests:
- Load with 5000 members → <2s page load
- Load with 1000 audit logs → single page displays instantly
- DB query count → <5 queries per page

Security tests:
- Invalid input → proper error message
- SQL injection attempt → blocked by Zod
- XSS attempt → blocked by React
```

### Phase 3: Deployment (Day 6)
```
1. Backup database
2. Run migrations (indexes)
3. Deploy code
4. Monitor performance metrics
5. Verify all pages load correctly
```

---

## Success Metrics

After Sprint 1 completes, you should see:

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| **Members page load time** | 5-10s | <2s | <2s ✓ |
| **API routes** | 8 | 4 | 4 ✓ |
| **DB queries per page** | 10-15 | <5 | <5 ✓ |
| **Validation coverage** | 0% | 100% | 100% ✓ |
| **Code duplication** | High | Low | Low ✓ |

---

## Dependencies & Resources

**Required:**
- Zod (already installed)
- Prisma (already installed)
- Next.js 16.2 (already installed)

**Optional but recommended:**
- PostgreSQL client to monitor queries
- Chrome DevTools Network tab for performance testing
- Lighthouse for performance reports

---

**Ready to start?** Next step: Clone branch & begin Day 1 (Pagination)
