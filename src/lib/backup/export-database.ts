import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync, readdirSync } from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

type DbUrlParts = {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
};

function parseDatabaseUrl(url: string): DbUrlParts | null {
  try {
    if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) return null;
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, "").replace(/\?.*$/, ""),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
  } catch {
    return null;
  }
}

function findPgDump(): string {
  const fromEnv = process.env.PG_DUMP_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const laragonRoots = [
    "C:\\laragon\\bin\\postgresql",
    "D:\\laragon\\bin\\postgresql",
  ];

  for (const root of laragonRoots) {
    if (!existsSync(root)) continue;
    try {
      const versions = readdirSync(root).sort().reverse();
      for (const ver of versions) {
        const candidate = path.join(root, ver, "bin", "pg_dump.exe");
        if (existsSync(candidate)) return candidate;
      }
    } catch { /* skip */ }
  }

  return "pg_dump";
}

export async function exportDatabase(): Promise<Buffer> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL tidak dikonfigurasi");

  const db = parseDatabaseUrl(databaseUrl);
  if (!db) throw new Error("Format DATABASE_URL tidak valid – harus postgresql://");

  const pgDump = findPgDump();
  const env = { ...process.env, PGPASSWORD: db.password };

  const args = [
    "-h", db.host,
    "-p", db.port,
    "-U", db.user,
    "-d", db.database,
    "--no-owner",
    "--no-acl",
    "-F", "p",
  ];

  try {
    const { stdout } = await execFileAsync(pgDump, args, {
      env,
      maxBuffer: 512 * 1024 * 1024,
      windowsHide: true,
    });
    return Buffer.from(stdout, "utf-8");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/ENOENT|not found/i.test(msg)) {
      throw new Error(
        "pg_dump tidak ditemukan. Set env PG_DUMP_PATH ke lokasi pg_dump.exe " +
        "(Laragon: D:\\laragon\\bin\\postgresql\\postgresql-16\\bin\\pg_dump.exe)"
      );
    }
    throw new Error(`Gagal mengekspor database: ${msg}`);
  }
}
