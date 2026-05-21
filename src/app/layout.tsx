import type { Metadata } from "next";
import { Newsreader, Noto_Sans_Arabic, UnifrakturMaguntia } from "next/font/google";
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

/** Arabic shaping for UI and share preview. */
const arabicUi = Noto_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-arabic-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tnews — Tunisie & monde en 3D",
  description:
    "Agrégation automatique des grandes voix tunisiennes et fils internationaux, présentés dans une scène 3D interactive.",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    title: "Tnews",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${heritageDisplay.variable} ${heritageSerif.variable} ${arabicUi.variable}`}>
      <body className={`min-h-screen antialiased ${arabicUi.className}`}>{children}</body>
    </html>
  );
}
