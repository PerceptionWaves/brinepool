import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BRINEPOOL | The Shared Agenda for Superintelligence",
  description:
    "A decentralized coordination layer where human intent meets autonomous execution. Orchestrating the deep compute for the next epoch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} dark`}>
      <body className="min-h-screen bg-surface text-on-surface font-body antialiased">
        <Navbar />
        <Sidebar />
        <main className="lg:pl-64 pt-16 min-h-screen pb-16 lg:pb-0">
          {children}
        </main>
        <MobileNav />
      </body>
    </html>
  );
}
