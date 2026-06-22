/**
 * Shared skeleton components for Suspense fallback UI.
 * Used across dashboard, laporan, and other heavy-data pages.
 */

import { cn } from "@/lib/utils"

// ─── Primitive ────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-100 dark:bg-slate-800",
        className
      )}
    />
  )
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-3 py-2.5">
                <Skeleton className="h-3.5 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Card Grid ────────────────────────────────────────────────────────────────

export function CardGridSkeleton({ count = 6, cols = 3 }: { count?: number; cols?: number }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 2 && "grid-cols-2",
        cols === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm"
        >
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Stats */}
      <StatsGridSkeleton count={4} />

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      </div>

      {/* Table */}
      <TableSkeleton rows={6} cols={5} />
    </div>
  )
}

// ─── Laporan ──────────────────────────────────────────────────────────────────

export function LaporanSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap">
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>

      {/* Table */}
      <TableSkeleton rows={10} cols={6} />
    </div>
  )
}

// ─── Page-level Loading ───────────────────────────────────────────────────────

/** Full-page skeleton: header + content area */
export function PageSkeleton({ title }: { title?: string }) {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        {title ? (
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        ) : (
          <Skeleton className="h-8 w-56" />
        )}
        <Skeleton className="h-4 w-72" />
      </div>
      <LaporanSkeleton />
    </div>
  )
}
