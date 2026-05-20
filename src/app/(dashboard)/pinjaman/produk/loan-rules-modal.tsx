"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { RulesClient } from "../rules/rules-client"

/**
 * Modal untuk konfigurasi Loan Rules.
 * RulesClient fetch data sendiri dari /api/loan-rules setiap kali modal dibuka.
 */
export function LoanRulesModal({ products }: {
  products: { id: number; name: string; is_active: boolean }[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Trigger tombol terpisah dari Dialog untuk menghindari nested <button> */}
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" />
        Rule Pinjaman
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pengaturan Aturan (Rule) Pinjaman</DialogTitle>
          </DialogHeader>
          {open && (
            <RulesClient
              products={products}
              onSaved={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

