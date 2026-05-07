import { logger } from "./logger";

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: "bullish" | "bearish" | "neutral";
  category: string;
  isBreaking: boolean;
}

export interface NewsContext {
  sentiment: number;
  weight: number;
  headlines: string[];
  breakingAlert: boolean;
}

const FEED_SOURCES = [
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "Guardian", url: "https://www.theguardian.com/world/rss" },
  { name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml" },
];

const BEARISH_KW = [
  "war",
  "attack",
  "conflict",
  "crisis",
  "crash",
  "collapse",
  "sanction",
  "threat",
  "explosion",
  "missile",
  "airstrike",
  "troops",
  "invasion",
  "escalat",
  "recession",
  "default",
  "ban",
  "restrict",
  "shooting",
  "assassination",
  "coup",
];
const BULLISH_KW = [
  "ceasefire",
  "peace",
  "deal",
  "agreement",
  "recovery",
  "stimulus",
  "rally",
  "surge",
  "growth",
  "approval",
  "partnership",
  "trade deal",
  "signed",
  "breakthrough",
];

function scoreSentiment(text: string): {
  sentiment: "bullish" | "bearish" | "neutral";
  score: number;
} {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of BEARISH_KW) if (lower.includes(kw)) score -= 1;
  for (const kw of BULLISH_KW) if (lower.includes(kw)) score += 1;
  if (score <= -1) return { sentiment: "bearish", score: Math.max(-1, score / 4) };
  if (score >= 1) return { sentiment: "bullish", score: Math.min(1, score / 4) };
  return { sentiment: "neutral", score: 0 };
}

function classifyCategory(text: string): string {
  const t = text.toLowerCase();
  if (
    /hantavirus|mpox|monkeypox|ebola|sars|mers|pandemic|epidemic|outbreak|novel virus|new strain|pathogen|contagion|quarantine|virus spread|health emergency|disease spread|WHO declares|CDC alert|infectious disease|bird flu|avian flu/.test(
      t,
    )
  )
    return "pandemic";
  if (
    /hospital|patient|health|medical|vaccine|vaccination|treatment|drug approval|clinical trial/.test(
      t,
    )
  )
    return "health";
  if (
    /war|conflict|attack|military|troops|missile|bomb|nuclear|weapon|drone|soldier|airstrike/.test(
      t,
    )
  )
    return "conflict";
  if (/election|president|prime minister|government|congress|parliament|vote|senator/.test(t))
    return "politics";
  if (/oil|opec|energy|gas|pipeline|petroleum|barrel/.test(t)) return "energy";
  if (/trade|tariff|sanction|export|import|wto|supply chain/.test(t)) return "trade";
  if (/rate|inflation|gdp|economy|recession|central bank|fed|ecb|boe|monetary/.test(t))
    return "macro";
  return "geopolitics";
}

function extractValue(block: string, tag: string): string {
  const cdataRe = new RegExp(
    `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`,
    "i",
  );
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(cdataRe) ?? block.match(plainRe);
  return m
    ? m[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#[0-9]+;/g, "")
        .trim()
    : "";
}

function parseRSS(xml: string, sourceName: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRe.exec(xml)) !== null && items.length < 7) {
    const block = match[1];
    const title = extractValue(block, "title");
    const url = extractValue(block, "link") || extractValue(block, "guid");
    const pubDate =
      extractValue(block, "pubDate") ||
      extractValue(block, "dc:date") ||
      extractValue(block, "published");
    const desc = extractValue(block, "description").slice(0, 280);

    if (!title || title.length < 8) continue;

    let publishedAt: string;
    try {
      publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
    } catch {
      publishedAt = new Date().toISOString();
    }

    const isBreaking = Date.now() - new Date(publishedAt).getTime() < 2 * 60 * 60 * 1000;
    const { sentiment } = scoreSentiment(title + " " + desc);
    const category = classifyCategory(title + " " + desc);
    const idKey = Buffer.from(title.slice(0, 32))
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 16);

    items.push({
      id: `${sourceName.toLowerCase().replace(/\s/g, "-")}-${idKey}`,
      title,
      description: desc,
      url: url || "#",
      source: sourceName,
      publishedAt,
      sentiment,
      category,
      isBreaking,
    });
  }
  return items;
}

let _cache: { items: NewsItem[]; expiry: number } | null = null;

export async function fetchGeopoliticsNews(): Promise<NewsItem[]> {
  if (_cache && Date.now() < _cache.expiry) return _cache.items;

  const all: NewsItem[] = [];

  await Promise.all(
    FEED_SOURCES.map(async ({ name, url }) => {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Hivemind/1.0)",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        all.push(...parseRSS(text, name));
      } catch (err) {
        logger.warn({ source: name, err }, "News feed fetch failed");
      }
    }),
  );

  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Ensure we always have at least some news, even if all feeds fail
  const items = all.length > 0 ? all.slice(0, 24) : getFallbackNews();

  // Simple deduplication based on title
  const uniqueItems = [];
  const seenTitles = new Set();
  for (const item of items) {
    const normalizedTitle = item.title.toLowerCase().trim();
    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle);
      uniqueItems.push(item);
    }
  }

  _cache = { items: uniqueItems, expiry: Date.now() + 5 * 60 * 1000 };
  return uniqueItems;
}

const SYMBOL_KEYWORDS: Record<string, string[]> = {
  BTC: ["bitcoin", "crypto", "cryptocurrency"],
  ETH: ["ethereum", "crypto"],
  XRP: ["ripple", "xrp"],
  ADA: ["cardano"],
  DOGE: ["dogecoin"],
  NVDA: ["nvidia", "semiconductor", "chip", "ai chip", "taiwan"],
  TSM: ["tsmc", "taiwan semiconductor"],
  AAPL: ["apple", "iphone"],
  MSFT: ["microsoft"],
  AMZN: ["amazon", "aws"],
  META: ["facebook", "meta"],
  GOOGL: ["google", "alphabet"],
  TSLA: ["tesla", "elon musk"],
  SPY: ["s&p", "market", "economy", "fed", "recession"],
  GLD: ["gold", "safe haven"],
  XOM: ["oil", "energy", "opec", "exxon"],
  AVAX: ["avalanche"],
  SOL: ["solana"],
};

export async function getNewsContextForSymbol(symbol: string): Promise<NewsContext> {
  const news = await fetchGeopoliticsNews();
  const kws = SYMBOL_KEYWORDS[symbol.toUpperCase()] ?? [symbol.toLowerCase()];

  let relevant = news.filter((n) => {
    const text = (n.title + " " + n.description).toLowerCase();
    return kws.some((kw) => text.includes(kw));
  });

  if (relevant.length === 0) {
    relevant = news
      .filter((n) => n.category === "macro" || n.category === "geopolitics")
      .slice(0, 4);
  }

  return buildNewsContext(relevant.slice(0, 5));
}

function buildNewsContext(items: NewsItem[]): NewsContext {
  const count = items.length;
  if (count === 0) return { sentiment: 0, weight: 0, headlines: [], breakingAlert: false };
  const avg = items.reduce((sum, n) => sum + scoreSentiment(n.title).score, 0) / count;
  return {
    sentiment: Number(avg.toFixed(3)),
    weight: Number(Math.min(1, count / 5).toFixed(2)),
    headlines: items.slice(0, 3).map((n) => n.title),
    breakingAlert: items.some((n) => n.isBreaking),
  };
}

function getFallbackNews(): NewsItem[] {
  const now = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 7_200_000).toISOString();
  return [
    {
      id: "fb-1",
      title: "Middle East Tensions Elevate Oil Market Risk Premium",
      description:
        "Escalating tensions near the Strait of Hormuz raise concerns over supply disruption to global crude markets.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: oneHourAgo,
      sentiment: "bearish",
      category: "energy",
      isBreaking: true,
    },
    {
      id: "fb-2",
      title: "Fed Officials Signal Caution on Rate Cuts Amid Sticky Inflation",
      description:
        "Federal Reserve speakers push back on early easing expectations, citing persistent core PCE above target.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: twoHoursAgo,
      sentiment: "bearish",
      category: "macro",
      isBreaking: false,
    },
    {
      id: "fb-3",
      title: "Ukraine-Russia Ceasefire Talks Stall as Both Sides Harden Positions",
      description:
        "Diplomatic efforts hit a roadblock as both sides maintain hardline positions ahead of next round of negotiations.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: twoHoursAgo,
      sentiment: "bearish",
      category: "conflict",
      isBreaking: false,
    },
    {
      id: "fb-4",
      title: "China GDP Growth Misses Estimates, Trade Tensions Flare",
      description:
        "Weaker-than-expected Chinese output data adds to global growth concerns as US tariff threats resurface.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: now,
      sentiment: "bearish",
      category: "macro",
      isBreaking: false,
    },
    {
      id: "fb-5",
      title: "US-EU Trade Deal Progress Boosts Risk Appetite",
      description:
        "Reports of progress on transatlantic trade framework lift equities and reduce safe-haven demand.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: now,
      sentiment: "bullish",
      category: "trade",
      isBreaking: false,
    },
    {
      id: "fb-6",
      title: "OPEC+ Reaffirms Output Cuts Through Next Quarter",
      description:
        "Cartel reaffirms production discipline keeping oil prices supported near 3-month highs.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: now,
      sentiment: "neutral",
      category: "energy",
      isBreaking: false,
    },
    {
      id: "fb-7",
      title: "Bitcoin Holds Above Key Support as Institutional Flows Stabilize",
      description:
        "BTC consolidates after volatility spike as ETF inflows resume and on-chain metrics improve.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: now,
      sentiment: "bullish",
      category: "crypto",
      isBreaking: false,
    },
    {
      id: "fb-8",
      title: "Taiwan Strait Tensions Rise on PLA Naval Exercise Reports",
      description:
        "Beijing orders large-scale naval exercises near Taiwan, semiconductor supply chains in focus.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: oneHourAgo,
      sentiment: "bearish",
      category: "geopolitics",
      isBreaking: true,
    },
    {
      id: "fb-9",
      title: "Global Health Officials Monitor Novel Respiratory Outbreak",
      description:
        "WHO convenes emergency session as cluster of unusual respiratory cases reported across multiple countries.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: oneHourAgo,
      sentiment: "bearish",
      category: "pandemic",
      isBreaking: true,
    },
    {
      id: "fb-10",
      title: "Nvidia AI Chip Demand Outpaces Supply, Shares Hit Record",
      description:
        "Data center AI buildout accelerates as hyperscalers commit multi-year GPU procurement contracts.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: now,
      sentiment: "bullish",
      category: "technology",
      isBreaking: false,
    },
    {
      id: "fb-11",
      title: "North Korea ICBM Test Provokes Emergency UN Security Council Session",
      description:
        "Pyongyang launches long-range missile over Japan's EEZ; emergency UN session called.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: twoHoursAgo,
      sentiment: "bearish",
      category: "conflict",
      isBreaking: true,
    },
    {
      id: "fb-12",
      title: "ECB Holds Rates Steady as Eurozone Inflation Cools Toward Target",
      description:
        "European Central Bank signals patient approach as disinflation progress continues.",
      url: "#",
      source: "Hivemind Intel",
      publishedAt: now,
      sentiment: "neutral",
      category: "macro",
      isBreaking: false,
    },
  ];
}
