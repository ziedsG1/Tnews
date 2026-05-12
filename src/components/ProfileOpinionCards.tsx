"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { NewsArticle } from "@/lib/aggregateNews";
import { ArticleCard } from "@/components/ArticleCard";
import { opinionUuidFromArticleId } from "@/lib/publicOpinions";

export function ProfileOpinionCards({
  articles,
  showDelete,
}: {
  articles: NewsArticle[];
  showDelete?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const remove = useCallback(
    async (article: NewsArticle) => {
      const uuid = opinionUuidFromArticleId(article.id);
      if (!uuid) return;
      setBusyId(article.id);
      setErr(null);
      try {
        const res = await fetch(`/api/opinions?id=${encodeURIComponent(uuid)}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setErr(json.error || `HTTP ${res.status}`);
          return;
        }
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  if (articles.length === 0) {
    return <p className="theme-muted text-sm text-slate-500">No public opinions yet.</p>;
  }
  return (
    <div>
      {err ? <p className="mb-2 text-sm text-red-300">{err}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {articles.map((a) => (
          <li key={a.id} className="relative">
            {showDelete && a.sourceId === "public-opinion" ? (
              <button
                type="button"
                title="Delete"
                aria-label="Delete opinion"
                disabled={busyId === a.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void remove(a);
                }}
                className="absolute left-2 top-2 z-10 rounded-md border border-red-500/40 bg-red-950/80 px-2 py-0.5 text-xs font-semibold text-red-100 hover:bg-red-900/90 disabled:opacity-40"
              >
                {busyId === a.id ? "…" : "×"}
              </button>
            ) : null}
            <ArticleCard article={a} onSelect={() => {}} active={false} />
          </li>
        ))}
      </ul>
    </div>
  );
}
