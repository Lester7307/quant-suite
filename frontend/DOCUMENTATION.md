# 📘 Quant Suite – Technical Documentation

**Version:** 3.0.0  
**Date:** June 2026  
**Author:** Hasmuddin  
**Contact:** hasmudin035@gmail.com  

---

## 1. Introduction

Quant Suite is a full‑stack institutional‑grade backtesting platform designed for quantitative analysis of Indian equities. It enables users to define custom investment strategies, backtest them against historical data, and visualise performance through an interactive dashboard. The system integrates data ingestion, a relational database, a Python backtest engine, and a modern React frontend.

This document provides a detailed technical overview of the project – covering module responsibilities, file structure, key assumptions, and optional features – to support both developers and business stakeholders.

---

## 2. System Architecture

### 2.1 High‑Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       Client Browser                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vite Dev Server (Port 5173)                  │
│   • Serves React application                                    │
│   • Proxies /api/* requests to backend                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Port 8000)                    │
│   • REST endpoints: /run-backtest, /symbols, /historical-data  │
│   • SSE endpoint: /stream-ticker                                │
│   • Pine Script compiler (experimental)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PostgreSQL Database                       │
│   Tables: assets, price_history, fundamentals                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

1. **Data Ingestion** – `data_loader.py` fetches daily OHLCV from Yahoo Finance and generates mock fundamentals, then populates the PostgreSQL tables.
2. **Backtest Execution** – The frontend sends a backtest request via `/api/run-backtest`; the backend runs the simulation using Pandas/NumPy and returns equity curves, drawdown, metrics, and top winners/losers.
3. **Live Streaming** – The backend exposes an SSE endpoint that streams tick data (real or synthetic) at 2‑second intervals. The frontend consumes this stream and updates the chart in real time.
4. **Historical & Intraday** – The frontend can request daily (from the database) or intraday (from Yahoo Finance) data for any symbol.

---

## 3. Module Descriptions

### 3.1 Backend Modules

#### `engine.py` – FastAPI Application & Backtest Engine
- **Core backtest logic** (`AlgorithmicBacktestHarnessEngine`):
  - Filters securities by market cap, ROCE, and PAT.
  - Applies multi‑metric ranking rules (weighted average of ranks).
  - Rebalances at user‑defined frequencies (monthly, quarterly, yearly).
  - Supports three position‑sizing methods: equal‑weight, market‑cap‑weighted, ROCE‑weighted.
  - Computes equity curve, drawdown, CAGR, Sharpe, Sortino, Win Rate, and average drawdown.
- **API endpoints**:
  - `/run-backtest` – POST request to execute a backtest.
  - `/stream-ticker` – SSE endpoint for live ticker data (with fallback to synthetic ticks).
  - `/historical-data` – returns daily OHLCV from PostgreSQL.
  - `/intraday-data` – fetches intraday OHLCV from Yahoo Finance.
  - `/symbols` – returns a list of all symbols and company names.
  - `/pine-compile` – experimental Pine Script lexer/parser.
  - `/health` – health check.
- **Database integration** – Uses a `DatabaseContextBrokerManager` to execute SQL queries safely.

#### `data_loader.py` – Data Seeder
- Contains a list of **150+ Indian tickers** with metadata (sector, market cap).
- For each symbol, it downloads historical OHLCV from Yahoo Finance (date range: 2023‑01‑01 to 2026‑01‑01).
- Generates **mock fundamentals** (ROCE, ROE, PE, PAT, revenue, assets, liabilities, cash flow) based on a deterministic seed for each symbol.
- Inserts or updates data in the `assets`, `price_history`, and `fundamentals` tables.
- Handles fallback for delisted/merged symbols (e.g., `LTIM.NS` → `LTI.NS`).

#### `test_db.py` – Database Verification Script
- A standalone script that verifies the database connection and can force‑seed a single ticker (`RELIANCE.NS`) for quick testing.
- Useful for debugging database connectivity and schema issues.

### 3.2 Frontend Modules

#### `App.jsx` – Main React Application
- Manages global state (backtest parameters, simulation results, real‑time buffers, watchlist, theme).
- Handles SSE connections for the selected ticker and watchlist symbols.
- Orchestrates UI rendering based on the selected workspace mode (`individual_company`, `strategy`, `heatmap`, `orderbook`, `help`).

#### `RealTimeChart` – Technical Chart Component
- Renders candlestick, line, bar, or area charts using Recharts.
- Aggregates ticks into OHLC candles based on the selected timeframe (1m, 5m, 15m, 1h, 4h, 1D).
- Supports zoom/pan via range sliders and a reset button.
- Displays optional indicators (Bollinger Bands, MA50).
- Integrates with the historical data view and intraday data fetching.

#### `StrategyChart` & `DrawdownChart` – Backtest Visualisation
- Display the equity curve (with benchmark) and drawdown chart.
- Include interactive controls for zoom/pan and export options.

#### `WatchlistSparkline` – Watchlist Component
- Shows a miniature sparkline for each watchlist symbol.
- Displays the latest price and percentage change.
- Allows removal of symbols via a hover‑revealed X button.

#### `HelpPage` – In‑App Documentation
- Provides a quick guide to using the application’s main features.

### 3.3 Database Schema

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `assets` | Stock metadata | `ticker_id` (PK), `symbol`, `company_name`, `sector`, `market_cap` |
| `price_history` | Daily OHLCV | `ticker_id` (FK), `date`, `open`, `high`, `low`, `close`, `volume` |
| `fundamentals` | Financial data (mock) | `ticker_id` (FK), `year`, `roce`, `roe`, `pe_ratio`, `pat`, `revenue`, `net_profit`, `total_assets`, `total_liabilities`, `operating_cash_flow` |

All tables use appropriate indexing and constraints (unique constraints on `symbol`, `(ticker_id, date)`, and `(ticker_id, year)`).

---

## 4. File Structure

```
quant-suite/
├── engine.py                 # FastAPI backend and backtest logic
├── data_loader.py            # Seeder for 150+ Indian stocks
├── test_db.py                # Database verification script
├── .env.example              # Template for environment variables
├── .gitignore                # Ignored files/folders
├── README.md                 # Project overview and quick start
├── LICENSE                   # MIT license (optional)
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React component
│   │   ├── main.jsx          # Entry point
│   │   └── index.css         # Tailwind CSS imports
│   ├── index.html            # HTML template
│   ├── package.json          # NPM dependencies and scripts
│   ├── vite.config.js        # Vite configuration (with proxy)
│   ├── tailwind.config.js    # Tailwind CSS configuration
│   └── postcss.config.js     # PostCSS configuration
└── requirements.txt          # Python dependencies (if present)
```

---

## 5. Assumptions & Limitations

1. **Fundamental Data** – The current implementation uses **mock fundamentals** generated deterministically from the symbol’s character sum. In a production environment, this data should be replaced with real financial data from a reliable source (e.g., Screener.in, Alpha Vantage, or a paid data provider).
2. **Market Data Delay** – Yahoo Finance provides **delayed** data (typically 15 minutes for Indian equities). The system is not suitable for high‑frequency trading.
3. **Intraday Data** – The intraday endpoint relies on Yahoo Finance’s `history` method, which may have rate limits and is not guaranteed for all symbols.
4. **SSE Reliability** – If the SSE connection fails, the frontend falls back to synthetic tick generation. This is intended for demonstration and development.
5. **Rebalancing** – Rebalancing is simulated as a periodic reset of portfolio weights; it does not account for market impact, taxes, or transaction costs beyond the configurable slippage factor.
6. **Synthetic Fallback** – When the database is empty or a symbol has no price data, the backtest engine returns a synthetic equity curve (sinusoidal noise) to illustrate functionality.
7. **Browser Compatibility** – The application is designed for modern Chromium‑based browsers; some features may not work in older browsers.

---

## 6. Optional Features (Bonus)

| Feature | Description |
|---------|-------------|
| **Pine Script IDE** | A basic lexer/parser that extracts parameters from a simplified Pine Script snippet. It is not a full compiler but demonstrates the concept. |
| **Watchlist with Sparklines** | Allows users to monitor up to 6 symbols simultaneously with mini line charts. |
| **SSE Fallback** | The backend automatically switches to synthetic tick generation if the real data feed fails, ensuring the UI never freezes. |
| **Historical Data View** | Toggle between real‑time and daily historical OHLCV (stored in PostgreSQL) for any symbol. |
| **CSV & Excel Export** | Export backtest results (equity curve, metrics, stock performance) to standard spreadsheet formats. |
| **Dark/Light Mode** | A theme toggle that respects user preference. |
| **Horizontal Scroll & Zoom** | Range sliders allow panning and zooming within the real‑time chart. |
| **Pause Live Updates** | A pause button freezes the chart for analysis without losing the connection. |

---

## 7. Deployment & Maintenance

### 7.1 Development Setup
- Backend: `python -m uvicorn engine:app --reload`
- Frontend: `cd frontend && npm run dev`
- Database: Ensure PostgreSQL is running and the `.env` file contains correct credentials.

### 7.2 Production Deployment
- The backend can be deployed with Uvicorn behind a reverse proxy (Nginx, Caddy) with SSL termination.
- The frontend can be built with `npm run build` and served as static files.
- Environment variables should be set in the hosting environment (e.g., Render, Heroku, or a VPS).

### 7.3 Maintenance Notes
- The `data_loader.py` script should be re‑run periodically to update price and fundamental data.
- For real production, replace mock fundamentals with a scheduled ETL pipeline.
- Monitor the SSE connection and Yahoo Finance API rate limits – consider implementing exponential backoff.

---

## 8. Conclusion

Quant Suite delivers a complete, extensible backtesting environment tailored for Indian equity markets. With its modular architecture, it can be easily enhanced with real data sources, additional analytical features, and more sophisticated strategy execution. The system is ready for both demonstration and further development.

---

**Document prepared by:** Hasmuddin  
**Date:** 2026‑06‑20  
**Version:** 1.0