import { prisma } from "@/lib/db/prisma";
import { serializeCacheValue } from "@/lib/cache";

export type SettingsExport = {
  exportedAt: string;
  app_settings: unknown;
  cache_config: unknown[];
  promotions: unknown[];
  ppob_settings: unknown;
};

export async function exportSettings(): Promise<Buffer> {
  const appSettings = await (prisma as any).app_settings?.findFirst?.().catch(() => null);

  const cacheItems = await prisma.cache
    .findMany({
      where: {
        key: {
          notIn: ["backup_config", "backup_history"],
        },
      },
      select: { key: true, value: true, expiration: true },
    })
    .catch(() => []);

  const promotions = await (prisma as any).promotions
    ?.findMany?.()
    .catch(() => []);

  const ppobSettings = await (prisma as any).ppob_settings
    ?.findFirst?.()
    .catch(() => null);

  const payload: SettingsExport = {
    exportedAt: new Date().toISOString(),
    app_settings: appSettings,
    cache_config: cacheItems,
    promotions: promotions ?? [],
    ppob_settings: ppobSettings,
  };

  return Buffer.from(serializeCacheValue(payload), "utf-8");
}
