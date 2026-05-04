/** Topic hints from headlines; labels adapt to UI locale. */

export type TopicKey =
  | "sport"
  | "economy"
  | "politics"
  | "culture"
  | "world"
  | "tunisia"
  | "general";

const RULES: { key: TopicKey; patterns: RegExp[] }[] = [
  {
    key: "sport",
    patterns: [/sport/i, /football/i, /liga/i, /club\s+africain/i, /stade/i, /match/i, /كرة/i, /الرابطة/i, /استحقاق/i],
  },
  {
    key: "economy",
    patterns: [/économ/i, /banque/i, /finance/i, /dinar/i, /bourse/i, /invest/i, /اقتصاد/i, /دينار/i, /بنك/i],
  },
  {
    key: "politics",
    patterns: [/président/i, /gouvern/i, /élection/i, /parlement/i, /minist/i, /état/i, /حكوم/i, /رئاس/i, /وزير/i],
  },
  {
    key: "culture",
    patterns: [/culture/i, /livre/i, /musée/i, /cinéma/i, /concert/i, /théâtre/i, /ثقاف/i, /معرض/i],
  },
  {
    key: "world",
    patterns: [/international/i, /monde/i, /états-unis/i, /europe/i, /chine/i, /غزة/i, /أمريك/i, /عالم/i],
  },
  {
    key: "tunisia",
    patterns: [/tunisi/i, /tunis\b/i, /sfax/i, /mahdia/i, /autoroute/i, /طقس/i, /تونس/i, /صفاقس/i, /سوسة/i],
  },
];

const FR: Record<TopicKey, string> = {
  sport: "Sport",
  economy: "Économie",
  politics: "Politique",
  culture: "Culture",
  world: "International",
  tunisia: "Tunisie",
  general: "Général",
};

const AR: Record<TopicKey, string> = {
  sport: "رياضة",
  economy: "اقتصاد",
  politics: "سياسة",
  culture: "ثقافة",
  world: "عالمي",
  tunisia: "تونس",
  general: "عام",
};

export function inferTopicKey(title: string): TopicKey {
  const t = title.trim();
  for (const { key, patterns } of RULES) {
    if (patterns.some((p) => p.test(t))) return key;
  }
  return "general";
}

export function topicLabel(title: string, locale: "ar" | "fr"): string {
  const key = inferTopicKey(title);
  return locale === "ar" ? AR[key] : FR[key];
}

/** Four coarse filter bands used by the UI toggles (ON = include this band). */
export type TopicFilterGroup = 1 | 2 | 3 | 4;

export function topicFilterGroup(key: TopicKey): TopicFilterGroup {
  if (key === "sport") return 1;
  if (key === "economy" || key === "politics") return 2;
  if (key === "culture" || key === "world") return 3;
  return 4;
}
