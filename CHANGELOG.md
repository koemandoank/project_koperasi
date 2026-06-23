# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-06-22

### Fixed
- Map singular properties to plural models in Prisma client extension (`prisma.user` to `prisma.users`, `prisma.member` to `prisma.members`, `prisma.unit` to `prisma.units`, `prisma.auditLog` to `prisma.audit_logs`) to fix undefined runtime model crashes.
- Fixed Vercel build schema validation by removing unneeded `PrismaAdapter` in `src/auth.ts` (JWT session strategy is used instead).
- Configure Postgres Neon database variables for production deployment.
