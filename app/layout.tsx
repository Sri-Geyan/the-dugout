import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800', '900'] });

export const metadata: Metadata = {
  title: "The Dugout — Where Decisions Win Matches",
  description: "A multiplayer IPL-style cricket management simulator. Build your squad, dominate the auction, and lead your team to glory.",
  keywords: "cricket, IPL, simulator, multiplayer, auction, team management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased min-h-screen ${inter.className}`}>
        <Navbar />
        <main className="pt-18">
          {children}
        </main>
      </body>
    </html>
  );
}
