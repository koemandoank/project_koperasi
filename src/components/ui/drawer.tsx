"use client"

/**
 * Drawer / BottomSheet Component
 *
 * Built on top of `vaul` — a lightweight accessible drawer primitive.
 * Exports mirror the Dialog API so components can be switched with minimal changes.
 *
 * @see https://github.com/emilkowalski/vaul
 */

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

// ─────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
)
Drawer.displayName = "Drawer"

// ─────────────────────────────────────────────
// Trigger
// ─────────────────────────────────────────────

const DrawerTrigger = DrawerPrimitive.Trigger
DrawerTrigger.displayName = "DrawerTrigger"

// ─────────────────────────────────────────────
// Portal
// ─────────────────────────────────────────────

const DrawerPortal = DrawerPrimitive.Portal

// ─────────────────────────────────────────────
// Close
// ─────────────────────────────────────────────

const DrawerClose = DrawerPrimitive.Close
DrawerClose.displayName = "DrawerClose"

// ─────────────────────────────────────────────
// Overlay
// ─────────────────────────────────────────────

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
      className
    )}
    {...props}
  />
))
DrawerOverlay.displayName = "DrawerOverlay"

// ─────────────────────────────────────────────
// Content (the sliding panel)
// ─────────────────────────────────────────────

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    /** Show close button in top-right corner */
    showClose?: boolean
  }
>(({ className, children, showClose = false, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        // Base layout
        "fixed inset-x-0 bottom-0 z-50 flex flex-col",
        // Shape & background
        "rounded-t-2xl bg-white dark:bg-slate-950",
        // Shadow
        "shadow-2xl",
        // Safe area bottom padding
        "pb-[env(safe-area-inset-bottom)]",
        // Max height
        "max-h-[90vh]",
        className
      )}
      {...props}
    >
      {/* Drag handle */}
      <div className="mx-auto mt-3 mb-1 h-1.5 w-12 flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />

      {/* Optional close button */}
      {showClose && (
        <DrawerClose className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:text-slate-600 active:bg-slate-100 transition-colors">
          <X className="h-5 w-5" />
          <span className="sr-only">Tutup</span>
        </DrawerClose>
      )}

      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"

// ─────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-1 px-4 pt-2 pb-4",
      className
    )}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

// ─────────────────────────────────────────────
// Title
// ─────────────────────────────────────────────

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-bold text-slate-900 dark:text-slate-50",
      className
    )}
    {...props}
  />
))
DrawerTitle.displayName = "DrawerTitle"

// ─────────────────────────────────────────────
// Description
// ─────────────────────────────────────────────

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-slate-500 dark:text-slate-400", className)}
    {...props}
  />
))
DrawerDescription.displayName = "DrawerDescription"

// ─────────────────────────────────────────────
// Body (scrollable area)
// ─────────────────────────────────────────────

const DrawerBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex-1 overflow-y-auto px-4 pb-4 no-scrollbar",
      className
    )}
    {...props}
  />
)
DrawerBody.displayName = "DrawerBody"

// ─────────────────────────────────────────────
// Footer (sticky at bottom)
// ─────────────────────────────────────────────

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-2 px-4 py-4 border-t border-slate-100 dark:border-slate-800",
      className
    )}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
}
