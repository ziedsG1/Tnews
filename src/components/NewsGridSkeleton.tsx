export function NewsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.06]"
          aria-hidden
        />
      ))}
    </ul>
  );
}
