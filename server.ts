import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import YahooFinanceClass from 'yahoo-finance2';

const yahooFinance = new (YahooFinanceClass as any)();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to fetch BIST stocks from TradingView Scanner
  app.get("/api/bist-stocks", async (req, res) => {
    try {
      const response = await fetch("https://scanner.tradingview.com/turkey/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "columns": ["ticker-view", "close", "change", "volume"],
          "filter": [{ "left": "is_primary", "operation": "equal", "right": true }],
          "ignore_unknown_fields": false,
          "options": { "lang": "tr" },
          "range": [0, 1000],
          "sort": { "sortBy": "market_cap_basic", "sortOrder": "desc" },
          "markets": ["turkey"],
          "filter2": {
            "operator": "and",
            "operands": [
              {
                "operation": {
                  "operator": "or",
                  "operands": [
                    { "operation": { "operator": "and", "operands": [{ "expression": { "left": "type", "operation": "equal", "right": "stock" } }, { "expression": { "left": "typespecs", "operation": "has", "right": ["common"] } }] } },
                    { "operation": { "operator": "and", "operands": [{ "expression": { "left": "type", "operation": "equal", "right": "stock" } }, { "expression": { "left": "typespecs", "operation": "has", "right": ["preferred"] } }] } },
                    { "operation": { "operator": "and", "operands": [{ "expression": { "left": "type", "operation": "equal", "right": "dr" } }] } },
                    { "operation": { "operator": "and", "operands": [{ "expression": { "left": "type", "operation": "equal", "right": "fund" } }, { "expression": { "left": "typespecs", "operation": "has_none_of", "right": ["etf"] } }] } }
                  ]
                }
              },
              { "expression": { "left": "typespecs", "operation": "has_none_of", "right": ["pre-ipo"] } }
            ]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`TradingView API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      if (!data || !data.data || !Array.isArray(data.data)) {
        console.warn("TradingView returned empty or malformed data:", data);
        return res.json([]);
      }

      const formatted = data.data.map((item: any) => {
        if (!item || !item.d || !Array.isArray(item.d)) return null;
        
        // d[0] is the ticker-view object
        const tickerInfo = item.d[0];
        const close = item.d[1];
        const change = item.d[2];
        const volume = item.d[3];

        if (!tickerInfo || !tickerInfo.name) return null;
        
        const symbol = tickerInfo.name;
        const description = tickerInfo.description || symbol;
        const logoid = tickerInfo.logoid || null;
        
        // Ensure it has .IS suffix for Yahoo Finance compatibility
        const finalSymbol = symbol.endsWith(".IS") ? symbol : `${symbol}.IS`;
        
        return {
          symbol: finalSymbol,
          name: description,
          last_price: typeof close === 'number' ? close : 0,
          daily_change: typeof change === 'number' ? change : 0,
          logoid: logoid,
          volume: volume || 0
        };
      }).filter((item: any) => item !== null);

      console.log(`Fetched ${formatted.length} stocks from TradingView using advanced filters.`);
      res.json(formatted);
    } catch (error: any) {
      console.error("TradingView Data Fetch Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Search for BIST stocks
  app.get("/api/search-bist", async (req, res) => {
    try {
      const { q } = req.query;
      const result = await yahooFinance.search(q as string || '.IS');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
