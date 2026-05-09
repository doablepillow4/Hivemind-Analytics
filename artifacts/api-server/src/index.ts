// artifacts/api-server/src/index.ts
import express from "express";
import cors from "cors";
import { getMarketPrices, getMarketHistory, getQuote } from "./lib/market.js";
import { getNews } from "./lib/news.js";
import { runLattice } from "./lib/lattice.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

app.use(cors());
app.use(express.json());

// Health Check
app.get("/api/healthz", (_req, res) => {
  res.json({ 
    status: "ok", 
    uptime: Math.floor(process.uptime()), 
    port: PORT,
    message: "Hivemind backend running (Test2 core)"
  });
});

// Market
app.get("/api/market/prices", async (_req, res) => {
  try {
    const prices = await getMarketPrices();
    res.json(prices);
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: "Market data unavailable" });
  }
});

app.get("/api/market/quote/:symbol", async (req, res) => {
  try {
    const quote = await getQuote(req.params.symbol.toUpperCase());
    res.json(quote || {});
  } catch (err) {
    res.status(503).json({ error: "Quote unavailable" });
  }
});

app.get("/api/market/history/:symbol", async (req, res) => {
  try {
    const data = await getMarketHistory(req.params.symbol.toUpperCase());
    res.json({ symbol: req.params.symbol.toUpperCase(), data });
  } catch (err) {
    res.status(503).json({ error: "History unavailable" });
  }
});

// News
app.get("/api/news", async (_req, res) => {
  try {
    const items = await getNews();
    res.json(items);
  } catch (err) {
    res.json([]);
  }
});

// Fear & Greed
app.get("/api/fear-greed", async (_req, res) => {
  try {
    const prices = await getMarketPrices();
    const cryptos = prices.filter((p: any) => p.type === "crypto");
    const avgChange = cryptos.reduce((s: number, p: any) => s + (p.changePercent || 0), 0) / (cryptos.length || 1);
    const value = Math.min(100, Math.max(0, Math.round(50 + avgChange * 6)));
    const label = value >= 75 ? "Extreme Greed" : value >= 55 ? "Greed" : value >= 45 ? "Neutral" : value >= 25 ? "Fear" : "Extreme Fear";
    res.json({ value, label, updatedAt: new Date().toISOString() });
  } catch {
    res.json({ value: 50, label: "Neutral", updatedAt: new Date().toISOString() });
  }
});

// Lattice
app.post("/api/lattice/run", async (req, res) => {
  try {
    const { symbol = "BTC", timeframeDays = 30 } = req.body;
    const prediction = await runLattice(symbol, timeframeDays);
    res.json(prediction);
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: "Lattice prediction unavailable" });
  }
});

// Monte Carlo (keep your version or simplify)
app.post("/api/simulator/monte-carlo", async (req, res) => {
  // ... keep your existing implementation or I can give you a simple one
  res.json({ message: "Monte Carlo endpoint ready" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Frontend should proxy /api → this server`);
});
