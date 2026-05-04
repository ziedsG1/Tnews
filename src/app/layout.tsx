import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
