# POS MODULES IMPLEMENTATION GUIDE

## Overview

This is a comprehensive POS (Point of Sale) system implementation guide covering 8 major modules integrated into the Koperasi Digital application. All database schemas have been created, and Server Actions are ready to use.

---

## ✅ COMPLETED IMPLEMENTATION

### 1. **DATABASE SCHEMA** ✓
All 8 modules have complete database schemas in `prisma/schema.prisma` with:
- 30+ new models added
- Proper relationships and indexes
- Enums for all statuses and types
- Database migration applied successfully

### 2. **SERVER ACTIONS** ✓
Complete Server Actions created for core functionality:

#### **Modul 1: POS Transactions** (`src/lib/actions/pos-transactions.ts`)
- `createCashRegisterSession()` - Open register
- `closeCashRegisterSession()` - Close & reconcile
- `processMultiPaymentOrder()` - Handle multi-payment (Cash/Debit/Credit/QRIS)
- `createOrderReturn()` - Process returns & refunds
- `approveOrderReturn()` - Approve refund
- `getPOSTransactionSummary()` - Daily summary

#### **Modul 2: Inventory Management** (`src/lib/actions/inventory.ts`)
- `createWarehouseLocation()` - Multi-location setup
- `getStockBalances()` - Real-time stock per location
- `setStockReorderPoint()` - Auto-reorder alerts
- `createStockTransferOrder()` - Inter-branch transfer
- `createStockOpname()` - Reconciliation
- `setProductCosting()` - FIFO/LIFO/Average

#### **Modul 3: Consignment** (`src/lib/actions/consignment.ts`)
- `createConsignmentItem()` - Mark as titip jual
- `recordConsignmentPayable()` - Track hutang konsinyasi
- `createConsignmentSettlement()` - Payment to supplier
- `getConsignmentAnalytics()` - Settlement reports

#### **Modul 4: Accounts Payable/Receivable** (`src/lib/actions/accounts.ts`)
- `createAccountsPayable()` - Hutang dagang
- `recordAPPayment()` - Payment tracking
- `createAccountsReceivable()` - Bon pelanggan
- `getAPAgingSchedule()` - Overdue analysis
- `getARAgingSchedule()` - Customer payment analysis
- `recordTaxCalculation()` - PPN per item

#### **Modul 5: Procurement** (`src/lib/actions/procurement.ts`)
- `createSupplier()` - Supplier database
- `createPurchaseOrder()` - PO creation & tracking
- `approvePurchaseOrder()` - PO workflow
- `createGoodReceipt()` - GR validation & stock update
- `getSupplierPerformance()` - Delivery metrics

#### **Modul 8: CRM & Loyalty** (`src/lib/actions/crm.ts`)
- `createLoyaltyProgram()` - Program setup
- `enrollMemberToLoyaltyProgram()` - Membership
- `addLoyaltyPoints()` - Point accumulation
- `redeemLoyaltyPoints()` - Point redemption
- `setPriceTier()` - Retail/Grosir/VIP pricing
- `getMemberPurchaseHistory()` - Customer analytics

---

## 📋 HOW TO USE SERVER ACTIONS

### Example 1: Create a Cash Register Session

```typescript
import { createCashRegisterSession } from '@/lib/actions/pos-transactions'

const result = await createCashRegisterSession(
  BigInt(1), // registerId
  500000,    // openingBalance
  'Morning shift' // notes
)

if (result.success) {
  console.log('Session created:', result.data)
} else {
  console.error('Error:', result.error)
}
```

### Example 2: Process Multi-Payment Order

```typescript
import { processMultiPaymentOrder } from '@/lib/actions/pos-transactions'

const result = await processMultiPaymentOrder(
  BigInt(123), // orderId
  [
    { method: 'cash', amount: 300000 },
    { method: 'qris', amount: 200000 },
    { method: 'debit_card', amount: 100000, referenceNo: 'DEBIT-001' }
  ]
)
```

### Example 3: Create Purchase Order

```typescript
import { createPurchaseOrder } from '@/lib/actions/procurement'

const result = await createPurchaseOrder(
  BigInt(5), // supplierId
  new Date(),
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  [
    { productId: BigInt(10), qtyOrdered: 100, unitPrice: 50000 },
    { productId: BigInt(11), qtyOrdered: 50, unitPrice: 75000 }
  ],
  'For restocking'
)
```

### Example 4: Add Loyalty Points

```typescript
import { addLoyaltyPoints } from '@/lib/actions/crm'

const result = await addLoyaltyPoints(
  BigInt(1), // memberId
  BigInt(1), // programId
  5000,      // points (100 Rupiah = 1 point)
  'Purchase discount'
)
```

---

## 🎨 NEXT STEPS: UI COMPONENTS

All Server Actions are ready. Create UI Components in appropriate folders:

### Recommended Folder Structure

```
src/app/(dashboard)/
├── toko/
│   ├── kasir/
│   │   ├── pos-client.tsx          (Existing - enhance)
│   │   ├── cash-register-modal.tsx  (NEW - open/close register)
│   │   └── multi-payment-modal.tsx  (NEW - multi-payment UI)
│   │
│   ├── inventaris/                 (NEW folder)
│   │   ├── page.tsx
│   │   ├── stock-balance-table.tsx
│   │   ├── transfer-order-form.tsx
│   │   ├── stock-opname-form.tsx
│   │   └── reorder-alerts.tsx
│   │
│   ├── konsinyasi/                 (NEW folder)
│   │   ├── page.tsx
│   │   ├── consignment-form.tsx
│   │   ├── settlement-form.tsx
│   │   └── consignment-report.tsx
│   │
│   └── loyalty/                    (NEW folder)
│       ├── page.tsx
│       ├── program-form.tsx
│       ├── member-enrollment.tsx
│       ├── points-redemption.tsx
│       └── price-tier-form.tsx
│
├── keuangan/                       (NEW folder)
│   ├── hutang-dagang/
│   │   ├── page.tsx
│   │   ├── ap-form.tsx
│   │   ├── ap-payment-form.tsx
│   │   └── aging-report.tsx
│   │
│   └── piutang-dagang/
│       ├── page.tsx
│       ├── ar-form.tsx
│       ├── ar-payment-form.tsx
│       └── aging-report.tsx
│
├── pembelian/                      (NEW folder)
│   ├── supplier/
│   │   ├── page.tsx
│   │   ├── supplier-form.tsx
│   │   └── supplier-performance.tsx
│   │
│   ├── po/
│   │   ├── page.tsx
│   │   ├── po-form.tsx
│   │   └── po-detail.tsx
│   │
│   └── gr/
│       ├── page.tsx
│       ├── gr-form.tsx
│       └── gr-detail.tsx
```

---

## 📊 DATABASE MODELS REFERENCE

### Core Transaction Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `cash_registers` | Register/Mesin Kasir | register_no, location, is_active |
| `cash_register_sessions` | Shift Management | session_date, opening_balance, closing_balance |
| `order_payments` | Multi-Payment Breakdown | payment_method, amount, payment_status |
| `order_returns` | Returns & Refunds | return_no, refund_amount, return_status |

### Inventory Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `warehouse_locations` | Multi-Location Tracking | location_code, location_type (main/branch/warehouse) |
| `stock_balances` | Real-time Stock | qty_on_hand, qty_reserved, qty_available |
| `stock_reorder_points` | Auto Alerts | reorder_point, reorder_qty, lead_time_days |
| `stock_transfer_orders` | Inter-branch Transfer | from_location_id, to_location_id, status |
| `stock_opname` | Reconciliation | opname_date, qty_system vs qty_physical |
| `product_costing` | Cost Calculation | costing_method (FIFO/LIFO/Average) |

### Financial Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `accounts_payable` | Hutang Dagang | supplier_id, invoice_no, amount_due |
| `accounts_receivable` | Piutang Dagang (Bon) | member_id, invoice_no, credit_limit |
| `tax_calculations` | PPN/Tax | tax_type, tax_percentage, tax_amount |

### Procurement Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `suppliers` | Supplier Master | supplier_code, contact_person, payment_terms |
| `purchase_orders` | PO Management | po_no, status, expected_delivery |
| `good_receipts` | GR Validation | gr_no, qty_received, qty_accepted |

### CRM Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `loyalty_programs` | Program Setup | program_code, points_per_rupiah |
| `loyalty_memberships` | Member Enrollment | membership_level (bronze/silver/gold/platinum) |
| `price_tiers` | Pricing Strategy | tier_name (retail/wholesale/vip), min_qty, price |
| `loyalty_redemptions` | Point Usage | points_redeemed, discount_amount |

---

## 🔐 ROLE-BASED ACCESS CONTROL

Integrate with existing RBAC in `src/auth.config.ts`:

```typescript
const ROLE_ROUTES = {
  kasir: ['/dashboard/toko/kasir', '/dashboard/laporan/harian'],
  pengurus: [
    '/dashboard/toko/kasir',
    '/dashboard/toko/inventaris',
    '/dashboard/keuangan',
    '/dashboard/pembelian',
    '/dashboard/toko/loyalty'
  ],
  admin: ['/*'], // Full access
}
```

---

## 💡 IMPLEMENTATION TIPS

### 1. Handle BigInt Conversion
- Always use `BigInt(id)` when passing IDs to Server Actions
- Use `Number(id)` before sending to Client Components

### 2. Real-time Updates
- Use `revalidatePath()` after mutations to refresh data
- Implement real-time notifications for refunds/returns

### 3. Transaction Safety
- Use Prisma transactions for critical operations:
  ```typescript
  await prisma.$transaction(async (tx) => {
    // Multiple operations
  })
  ```

### 4. Validation
- Validate quantities (can't sell more than stock)
- Validate payment totals match order amount
- Check member credit limits in AR

### 5. Audit Trail
- All mutations already logged to `audit_logs` table
- Use `created_by`, `processed_by` fields for tracking

---

## 🚀 QUICK START CHECKLIST

- [ ] Review database schema in `prisma/schema.prisma`
- [ ] Verify all Server Actions are imported correctly
- [ ] Create basic pages for each module
- [ ] Build forms using shadcn/ui components
- [ ] Integrate with existing sidebar navigation
- [ ] Test Server Actions with mock data
- [ ] Add permission checks in UI (optional - DB handles it)
- [ ] Set up email notifications for approvals
- [ ] Create reports/dashboards for each module
- [ ] Test production build with `npm run build`

---

## 📞 KEY CONTACTS & PATTERNS

### Payment Methods Supported
- cash
- debit_card
- credit_card
- qris
- transfer
- check (for payables)

### Statuses to Handle
- **Order**: pending → confirmed → processing → delivered
- **Return**: pending → approved → rejected → completed
- **PO**: draft → submitted → approved → partial_received → received
- **GR**: received → inspected → accepted → rejected
- **AP/AR**: open → partial → paid (or) overdue, cancelled

---

## 📝 NOTES

- All timestamps use UTC (stored in DB with Z notation)
- Prices stored as DECIMAL(15,2) for precision
- Stock quantities as INT (not Decimal)
- Tax calculations use 10% default PPN
- Loyalty points: 1 point = Rp 100 (configurable)

