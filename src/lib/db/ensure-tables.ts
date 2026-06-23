import { prisma } from "./prisma";

let ensured = false;

export async function ensureTables() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS rat_attendances (
        id          BIGSERIAL PRIMARY KEY,
        member_id   BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        year        INTEGER NOT NULL,
        is_present  BOOLEAN NOT NULL DEFAULT false,
        voted       BOOLEAN NOT NULL DEFAULT false,
        attended_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT now(),
        updated_at  TIMESTAMPTZ DEFAULT now(),
        UNIQUE(member_id, year)
      );
      CREATE INDEX IF NOT EXISTS idx_rat_attendances_year ON rat_attendances(year);
    `);
    ensured = true;
    console.log("[DB] rat_attendances table ensured");
  } catch (e: any) {
    console.warn("[DB] Cannot ensure rat_attendances table (pooled conn?):", e?.message);
  }
}
