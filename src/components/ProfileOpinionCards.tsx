"use client";

import type { NewsArticle } from "@/lib/aggregateNews";
import { ArticleCard } from "@/components/ArticleCard";

export function ProfileOpinionCards({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) {
    return <p className="theme-muted text-sm text-slate-500">No public opinions yet.</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {articles.map((a) => (
        <li key={a.id}>
          <ArticleCard article={a} onSelect={() => {}} active={false} />
        </li>
      ))}
    </ul>
  );
}
