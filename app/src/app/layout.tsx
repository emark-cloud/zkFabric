import type { Metadata } from "next";
import { JetBrains_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/NavBar";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "zkFabric — Zero-Knowledge Identity for HashKey Chain",
  description:
    "Selective-disclosure identity system using Groth16 ZK proofs on HashKey Chain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased dark ${jetbrains.variable} ${dmSans.variable}`}>
      <body className="min-h-full flex flex-col bg-[#050505] text-gray-100 font-body">
        <div className="noise-bg fixed inset-0 pointer-events-none z-[100]" />
        <Providers>
          <NavBar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
