# Security Architecture - Role-Based Access Control (RBAC)

**Last Updated:** June 18, 2026  
**Version:** 3.0 - Post-Migration  
**Status:** ✅ Production Ready

---

## Overview

This document describes the security architecture and role-based access control (RBAC) system used throughout the Koperasi Sulfindo digital platform. The system implements a centralized, unified approach to role verification across all server actions.

---

## Role Hierarchy

The system defines five role levels with hierarchical privileges:

```
┌─────────────────────────────────────────────┐
│  SUPERADMIN (Full System Access)            │
├─────────────────────────────────────────────┤
│  KETUA (Leadership - Cooperative Head)      │
├─────────────────────────────────────────────┤
│  PENGURUS (Management - Board Members)      │
├─────────────────────────────────────────────┤
│  ADMIN (Administrative Functions)           │
├─────────────────────────────────────────────┤
│  MEMBER (End User - Limited Access)         │
└─────────────────────────────────────────────┘
```

### Role Definitions

| Role | Level | Permissions | Use Case |
|------|-------|-----------|----------|
| **superadmin** | 5 | Full system access, all operations | System administrator |
| **ketua** | 4 | Leadership decisions, financial approvals | Cooperative chairman |
| **pengurus** | 3 | Management functions, member oversight | Board members |
| **admin** | 2 | System administration, data management | Admin staff |
| **member** | 1 | Limited access, personal transactions | Cooperative members |

---

## Authentication & Authorization Flow

### 1. Session Verification
- User logs in via NextAuth.js authentication
- Session contains user ID, email, and assigned roles
- Session persists across requests via NextAuth middleware

### 2. Protected Action Execution
```typescript
// Protected server action pattern
export async function protectedAction(params: Type) {
  try {
    // 1. Verify session and check role
    const session = await checkRole(["superadmin", "admin"]);
    
    // 2. Extract authenticated user ID
    const userId = session.user.id;
    
    // 3. Execute business logic with authorization
    const result = await prisma.table.operation();
    
    // 4. Log audit trail
    await logAudit({
      action: "UPDATE",
      modelType: "table_name",
      modelId: result.id,
      newValues: result
    });
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error:", error);
    return { success: false, error: error?.message };
  }
}
```

### 3. Role Check Implementation

**Before (Deprecated):**
```typescript
const session = await verifySessionAndRole(["superadmin", "admin"]);
```

**After (Current - Unified Pattern):**
```typescript
await checkRole(["superadmin", "admin"]);
```

**Benefits of Unified Pattern:**
- Single source of truth for role verification
- Consistent error handling across all actions
- Easier to maintain and update
- Better logging and debugging
- Improved performance through centralization

---

## Protected Operations by Module

### User Management (src/lib/actions/users.ts)
- ✅ getUserByEmail - `["superadmin", "admin", "pengurus"]`
- ✅ getAllUsers - `["superadmin", "admin"]`
- ✅ createUser - `["superadmin", "admin"]`
- ✅ updateUser - `["superadmin", "admin"]`
- ✅ deleteUser - `["superadmin"]`
- ✅ updateUserRole - `["superadmin"]`
- ✅ toggleUserStatus - `["superadmin", "admin"]`
- ✅ setUserPassword - `["superadmin", "admin"]`

### Savings Management (src/lib/actions/saving-types.ts)
- ✅ createSavingType - `["superadmin", "ketua"]`
- ✅ updateSavingType - `["superadmin", "ketua"]`
- ✅ toggleSavingTypeStatus - `["superadmin", "ketua"]`

### Cache Management (src/lib/actions/cache-actions.ts)
- ✅ clearAllCacheAction - `["superadmin", "admin"]`
- ✅ deleteCacheKeyAction - `["superadmin", "admin"]`
- ✅ getCacheStatsAction - `["superadmin", "admin"]`

### Reporting (src/lib/actions/laporan-po-konsinyasi.ts)
- ✅ getPOReport - `["superadmin", "admin", "pengurus"]`
- ✅ getConsignmentReport - `["superadmin", "admin", "pengurus"]`

### Payroll Processing (src/lib/actions/payroll.ts)
- ✅ processMonthlyPayrollBatch - `["superadmin", "ketua", "pengurus", "admin"]`

### PPOB Settings (src/lib/actions/ppob-settings.ts)
- ✅ updatePpobSettings - `["superadmin", "admin", "pengurus"]`

### SHU Calculation (src/lib/actions/shu-calculation.ts)
- ✅ saveShuConfig - `["superadmin", "ketua"]`

### Application Settings (src/lib/actions/settings.ts)
- ✅ updateAppSettings - `["superadmin", "ketua"]`
- ✅ setMemberDashboardConfig - `["superadmin", "admin", "pengurus"]`
- ✅ saveReportTemplateConfig - `["superadmin", "admin", "pengurus"]`

---

## Audit Logging

All protected operations are logged for compliance and debugging:

```typescript
await logAudit({
  action: "CREATE" | "UPDATE" | "DELETE",
  modelType: "table_name",
  modelId: record_id,
  oldValues: previous_data,
  newValues: updated_data
});
```

**Logged Information:**
- User ID performing action
- Action type (CREATE, READ, UPDATE, DELETE)
- Model affected and record ID
- Previous and new values
- Timestamp
- Session information

---

## Error Handling & Security

### Authorization Failures
```typescript
// When user lacks required role:
throw new Error("Insufficient permissions: Required roles [admin, superadmin]");
```

### Session Timeouts
```typescript
// When session is invalid or expired:
throw new Error("Session expired. Please log in again.");
```

### Best Practices Implemented
✅ Role checks before ANY database operation  
✅ Consistent error messages (no sensitive info leaked)  
✅ Audit trails for all state-changing operations  
✅ Try-catch blocks on all actions  
✅ Proper error response formatting  
✅ No hardcoded credentials in code  

---

## Middleware Protection

### NextAuth Middleware (src/middleware.ts)
- Protects dashboard routes from unauthenticated access
- Redirects to login if session missing
- Validates session on every request

### Route-Level Protection (App Router)
- Dashboard routes require authentication
- Admin routes require specific roles
- Member routes accessible to authenticated users

---

## Migration History

### Phase 1: Initial Implementation
- Created `verifySessionAndRole()` helper
- Applied to 41 core functions
- Established role hierarchy

### Phase 2: Enhanced Security
- Added comprehensive audit logging
- Implemented role-based route protection
- Added session timeout handling

### Phase 3: Architecture Consolidation ✅
- Migrated from `verifySessionAndRole()` to `checkRole()`
- Updated 30+ functions across 8 files
- Achieved 100% consistency
- Simplified role verification pattern

**Timeline:**
- Phase 1: Initial rollout
- Phase 2: Security enhancements  
- Phase 3: June 18, 2026 - Architecture consolidation complete

---

## Testing & Validation

### Manual Testing Checklist
- [ ] Login with superadmin account - verify all operations accessible
- [ ] Login with ketua account - verify leadership operations accessible
- [ ] Login with pengurus account - verify management operations accessible
- [ ] Login with admin account - verify admin operations accessible
- [ ] Login with member account - verify limited access enforced
- [ ] Test expired session - verify redirect to login
- [ ] Test invalid token - verify rejection
- [ ] Verify audit logs created for all operations

### Automated Testing (Recommended)
```bash
# Test role-based access
npm run test -- auth-helpers.test.ts

# Test protected actions
npm run test -- actions/*.test.ts

# Test middleware
npm run test -- middleware.test.ts
```

---

## Security Recommendations

### Short-term (Completed ✅)
- ✅ Consolidate role verification pattern
- ✅ Remove deprecated helper functions
- ✅ Add comprehensive logging

### Medium-term (Next Sprint)
- [ ] Implement rate limiting on auth endpoints
- [ ] Add MFA (Multi-Factor Authentication) support
- [ ] Enhance session timeout handling
- [ ] Add IP whitelisting for admin access

### Long-term (Q3-Q4)
- [ ] Implement RBAC groups for easier management
- [ ] Add permission matrix UI for role management
- [ ] Implement OAuth2 for external integrations
- [ ] Add security event alerting

---

## Troubleshooting

### Issue: "Insufficient permissions" error
**Solution:** Verify user role assignment in database
```sql
SELECT user_id, role FROM user_roles WHERE user_id = ?;
```

### Issue: Session expired unexpectedly
**Solution:** Check session timeout settings in `.env`
```
NEXTAUTH_COOKIE_EXPIRES = 7 days (default)
```

### Issue: Audit logs not created
**Solution:** Verify logAudit function is called and database is accessible

---

## References

- NextAuth.js Docs: https://next-auth.js.org
- Role-Based Access Control: https://en.wikipedia.org/wiki/Role-based_access_control
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org

---

**Document Status:** ✅ Approved for Production  
**Last Reviewed:** June 18, 2026  
**Next Review:** June 25, 2026
