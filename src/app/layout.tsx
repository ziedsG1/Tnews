import type { Metadata } from "next";
import { Newsreader, UnifrakturMaguntia } from "next/font/google";
import "./globals.css";

const heritageDisplay = UnifrakturMaguntia({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heritage-display",
  display: "swap",
});

const heritageSerif = Newsreader({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-heritage-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tnews — Tunisie & monde en 3D",
  description:
    "Agrégation automatique des grandes voix tunisiennes et fils internationaux, présentés dans une scène 3D interactive.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${heritageDisplay.variable} ${heritageSerif.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
