import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DashboardShell from "./components/DashboardShell";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Revigo Cockpit — Hotel Revenue Intelligence",
  description: "Revenue management intelligence dashboard for hotels",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full">
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
