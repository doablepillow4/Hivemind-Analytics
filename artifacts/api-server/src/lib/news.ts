// artifacts/api-server/src/lib/news.ts
import { cachedWithRefresh } from "./cache.js";

export async function getNews() {
  return cachedWithRefresh("news:all", 5 * 60 * 1000, async () => {
    return [
      {
        id: "1",
        title: "Bitcoin breaks new resistance level",
        description: "Market sentiment turning bullish...",
        url: "#",
        source: "Reuters",
        publishedAt: new Date().toISOString(),
        sentiment: "bullish" as const
      }
    ];
  });
}
