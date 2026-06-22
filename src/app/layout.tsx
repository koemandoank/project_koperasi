import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AppUpdateChecker } from "@/components/shared/app-update-checker";

export const metadata: Metadata = {
  title: "Koperasi Digital Sulfindo",
  description: "Portal Koperasi Digital Sulfindo",
};

/**
 * Root layout component for the entire application.
 * Mounts standard font variables, sets up metadata, and displays global components like Toaster.
 * 
 * @param {Readonly<{ children: React.ReactNode }>} props - Component properties containing children.
 * @returns {React.ReactElement} The root HTML wrapper.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}

