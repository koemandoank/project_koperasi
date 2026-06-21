import type { Metadata } from "next";
import { Rubik, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AppUpdateChecker } from "@/components/shared/app-update-checker";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Koperasi Sulfindo",
  description: "Transformasi Digital Koperasi Sulfindo melalui platform web.",
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
      className={`${rubik.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster />
        <AppUpdateChecker />
      </body>
    </html>
  );
}

