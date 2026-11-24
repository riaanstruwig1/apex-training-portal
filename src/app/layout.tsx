import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apex Flight Hub",
  description: "Student & instructor training folio for Apex Adventures", // batch 106: Apex only (Riaan, 24 Nov 2026)
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
