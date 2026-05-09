type ThemeMode = "dark" | "light" | "newspaper";

/** Small theme-aware mark shown next to the country / brand selector. */
export function BrandLogo({ theme, className = "" }: { theme: ThemeMode; className?: string }) {
  const common = `block h-9 w-9 shrink-0 sm:h-10 sm:w-10 ${className}`;

  if (theme === "light") {
    return (
      <svg className={common} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="1" y="1" width="38" height="38" rx="10" fill="#f8fafc" stroke="#0f172a" strokeOpacity="0.12" strokeWidth="1" />
        <path d="M11 12h18v3h-6.5v14h-4V15H11v-3z" fill="#0f172a" />
        <circle cx="30" cy="13" r="2.2" fill="#0ea5e9" />
      </svg>
    );
  }

  if (theme === "newspaper") {
    return (
      <svg className={`${common} brand-logo-paper`} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="2" y="4" width="26" height="32" rx="1" fill="#faf6ee" stroke="#3d2f1f" strokeWidth="0.75" />
        <rect x="6" y="9" width="18" height="2.5" rx="0.5" fill="#1a120c" />
        <rect x="6" y="14" width="14" height="1.5" rx="0.3" fill="#5c4a3a" opacity="0.85" />
        <rect x="6" y="17" width="16" height="1.5" rx="0.3" fill="#5c4a3a" opacity="0.65" />
        <rect x="6" y="20" width="12" height="1.5" rx="0.3" fill="#5c4a3a" opacity="0.5" />
        <rect x="12" y="2" width="26" height="34" rx="1" fill="#fffdf7" stroke="#2a1f14" strokeWidth="0.85" transform="rotate(4 25 19)" />
        <rect x="16" y="8" width="18" height="3" rx="0.4" fill="#8b1a1a" transform="rotate(4 25 19)" />
        <rect x="16" y="13" width="14" height="1.8" rx="0.3" fill="#3d2f1f" opacity="0.8" transform="rotate(4 25 19)" />
        <rect x="16" y="16.5" width="16" height="1.5" rx="0.3" fill="#3d2f1f" opacity="0.55" transform="rotate(4 25 19)" />
      </svg>
    );
  }

  // dark (default)
  return (
    <svg className={common} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="brandOrb" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="55%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="rgba(15,23,42,0.85)" stroke="url(#brandOrb)" strokeWidth="1.25" />
      <path d="M11 12h18v3h-6.5v14h-4V15H11v-3z" fill="url(#brandOrb)" />
    </svg>
  );
}
