import { prisma } from "@/lib/db/prisma";

// Custom stringify to handle BigInt fields safely
export function serializeCacheValue(value: any): string {
  return JSON.stringify(value, (key, val) => {
    if (typeof val === "bigint") {
      return val.toString();
    }
    return val;
  });
}
// In-memory cache Map as a fast first-layer caching to avoid database queries network latency
const memoryCache = new Map<string, { value: string; expiration: number }>();

/**
 * Mengambil data dari cache berdasarkan key.
 * Mengembalikan null jika cache tidak ditemukan atau sudah kadaluarsa.
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const now = Math.floor(Date.now() / 1000);

    // 1. Coba ambil dari in-memory cache terlebih dahulu
    const memItem = memoryCache.get(key);
    if (memItem) {
      if (memItem.expiration >= now) {
        return JSON.parse(memItem.value) as T;
      } else {
        memoryCache.delete(key);
      }
    }

    // 2. Jika tidak ada di memory, ambil dari database cache
    const item = await prisma.cache.findUnique({
      where: { key }
    });

    if (!item) return null;

    if (item.expiration < now) {
      // Hapus cache yang expired secara langsung
      await prisma.cache.delete({ where: { key } }).catch(() => {});
      return null;
    }

    // Simpan ke in-memory cache untuk query berikutnya
    memoryCache.set(key, { value: item.value, expiration: item.expiration });

    return JSON.parse(item.value) as T;
  } catch (error) {
    console.error(`[Cache Get Error] Key: ${key}`, error);
    return null;
  }
}

/**
 * Menyimpan data ke dalam cache dengan batas kadaluarsa (TTL) dalam detik.
 */
export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    const expiration = Math.floor(Date.now() / 1000) + ttlSeconds;
    const serializedValue = serializeCacheValue(value);

    // Simpan ke in-memory cache
    memoryCache.set(key, { value: serializedValue, expiration });

    // Simpan ke database cache
    await prisma.cache.upsert({
      where: { key },
      update: { value: serializedValue, expiration },
      create: { key, value: serializedValue, expiration }
    });
  } catch (error) {
    console.error(`[Cache Set Error] Key: ${key}`, error);
  }
}

/**
 * Menghapus satu atau beberapa key cache.
 */
export async function deleteCache(key: string | string[]): Promise<void> {
  try {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return;

    // Hapus dari in-memory cache
    keys.forEach(k => memoryCache.delete(k));

    // Hapus dari database cache
    await prisma.cache.deleteMany({
      where: {
        key: { in: keys }
      }
    });
  } catch (error) {
    console.error(`[Cache Delete Error] Keys: ${key}`, error);
  }
}

/**
 * Menghapus seluruh data di tabel cache.
 */
export async function clearAllCache(): Promise<{ success: boolean; count: number }> {
  try {
    memoryCache.clear();
    const result = await prisma.cache.deleteMany({});
    return { success: true, count: result.count };
  } catch (error) {
    console.error("[Cache Clear All Error]", error);
    return { success: false, count: 0 };
  }
}

/**
 * Pattern remember: Ambil dari cache, jika tidak ada, eksekusi fungsi, simpan, lalu kembalikan hasilnya.
 */
export async function remember<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const fresh = await fn();
  await setCache(key, fresh, ttlSeconds);
  return fresh;
}

/**
 * Mengambil statistik penggunaan cache untuk halaman manajemen.
 */
export async function getCacheStats(): Promise<{
  activeCount: number;
  expiredCount: number;
  keys: Array<{ key: string; isExpired: boolean; expirationDate: string }>;
}> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const items = await prisma.cache.findMany({
      select: {
        key: true,
        expiration: true
      },
      orderBy: { key: 'asc' }
    });

    const keys = items.map((item: any) => {
      const isExpired = item.expiration < now;
      const expirationDate = new Date(item.expiration * 1000).toLocaleString("id-ID");
      return {
        key: item.key,
        isExpired,
        expirationDate
      };
    });

    const activeCount = keys.filter((k: any) => !k.isExpired).length;
    const expiredCount = keys.filter((k: any) => k.isExpired).length;

    return {
      activeCount,
      expiredCount,
      keys
    };
  } catch (error) {
    console.error("[Cache Stats Error]", error);
    return { activeCount: 0, expiredCount: 0, keys: [] };
  }
}
