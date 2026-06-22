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
    <div className="flex items-center justify-between py-4">
      <p className="text-sm text-muted-foreground">
        Halaman <span className="font-semibold">{page}</span> dari{" "}
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
          Sebelumnya
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages || loading}
          onClick={() => onPageChange(page + 1)}
        >
          Berikutnya
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
