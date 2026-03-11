import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

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
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">
        <Navbar />
        <main className="pt-18">
          {children}
        </main>
      </body>
    </html>
  );
}
