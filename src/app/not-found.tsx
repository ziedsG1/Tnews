import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold text-white">404</h1>
      <p className="theme-muted text-slate-400">Page introuvable.</p>
      <Link href="/" className="text-sm text-amber-300 underline-offset-2 hover:underline">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
