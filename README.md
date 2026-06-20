## 📊 Quant Suite – Institutional‑Grade Backtesting Platform

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-green)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-blueviolet)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

**Quant Suite** is an end‑to‑end quantitative backtesting platform designed for Indian equities. It combines a powerful Python backtest engine with an intuitive React dashboard, giving you complete control over strategy definition, simulation, and analysis.

---

## 🎯 Key Features

### 🔬 Backtest Engine
- Custom **date range** and **rebalancing frequency** (monthly, quarterly, yearly)
- **Portfolio filters**: market cap, ROCE, PAT
- **Multi‑metric ranking** (ROE, PE, ROCE, etc.) with custom weights
- **Position sizing** methods: equal‑weight, market‑cap‑weighted, ROCE‑weighted
- **Compounding** with slippage cost and leverage

### 📈 Data Coverage
- **150+ Indian stocks** (NSE) with daily OHLCV
- **Fundamentals** (P&L, Balance Sheet, Cash Flow) – mocked for demonstration (easily replaceable with real data)
- **Intraday data** (1m, 5m, 15m, 1h) via Yahoo Finance

### 🖥️ Interactive Frontend
- **Real‑time candlestick chart** with multiple timeframes and indicators (Bollinger Bands, MA50)
- **Watchlist** with sparklines for quick monitoring
- **Backtest configuration** panel with intuitive controls
- **Strategy metrics** dashboard showing:
  - Equity curve (with Nifty 50 benchmark)
  - Drawdown chart
  - Top winners/losers
  - CAGR, Sharpe Ratio, Sortino Ratio, Win Rate, Max Drawdown
- **One‑click export** to CSV and Excel
- **Dark/Light mode** toggle
- **Pine Script IDE** (experimental)

### ⚙️ API & Data Streaming
- **SSE (Server‑Sent Events)** for live ticker updates (with fallback to synthetic ticks)
- **REST endpoints** for backtesting, historical data, and symbol lists
- **PostgreSQL** database with normalized schema for fast queries

---

## 🛠 Technology Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Python 3.11+, FastAPI, Uvicorn, Pandas, NumPy, yfinance |
| **Database** | PostgreSQL (with psycopg2) |
| **Frontend** | React 19, Vite, Tailwind CSS, Recharts, Lucide Icons, XLSX |
| **Data Sources** | Yahoo Finance API (real‑time and intraday), Mock fundamentals |
| **Dev Tools** | Git, VS Code (recommended) |

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Browser                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vite Dev Server (Port 5173)                  │
│   • Serves React app                                            │
│   • Proxies /api/* requests to backend                          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                 FastAPI Backend (Port 8000)                     │
│   • REST endpoints: /run-backtest, /symbols, /historical-data  │
│   • SSE endpoint: /stream-ticker                                │
│   • Pine Script compiler (experimental)                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PostgreSQL Database                       │
│   Tables: assets, price_history, fundamentals                   │
│   ~150 stocks × 3 years of daily data                          │
└─────────────────────────────────────────────────────────────────┘
```

- The frontend communicates with the backend via **relative URLs** (`/api/...`) – the Vite proxy forwards these to the backend.
- The backend fetches data from Yahoo Finance (or the database) and processes backtests using Pandas/NumPy.
- SSE streams are used for real‑time tick updates; if the connection fails, the frontend falls back to simulated ticks.

---

## 📦 Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/Lester7307/quant-suite.git
cd quant-suite
```

### 2. Set up environment variables
Create a `.env` file in the root directory with your database credentials:
```env
DB_HOST=localhost
DB_NAME=quant_db
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_PORT=5432
```

A template file `.env.example` is provided – copy it to `.env` and fill in your values.

### 3. Install Python dependencies
```bash
pip install -r requirements.txt
```
If `requirements.txt` is missing, install manually:
```bash
pip install fastapi uvicorn psycopg2-binary pandas numpy yfinance python-multipart python-dotenv
```

### 4. Set up PostgreSQL
- Install PostgreSQL (if not already) and start the service.
- Create the database:
  ```bash
  psql -U postgres -c "CREATE DATABASE quant_db;"
  ```

### 5. Seed the database
Run the data loader to fetch OHLCV and mock fundamentals:
```bash
python data_loader.py
```
This will download data for ~150 stocks (may take a few minutes) and insert them into the `assets`, `price_history`, and `fundamentals` tables.

### 6. Install frontend dependencies
```bash
cd frontend
npm install
```

---

## 🚀 Running the Application

### Start the Backend
From the project root:
```bash
python -m uvicorn engine:app --reload --host 127.0.0.1 --port 8000
```
The API will be available at `http://localhost:8000`. You can test it with:
```bash
curl http://localhost:8000/health
```
Expected response: `{"status":"OK","version":"3.0.0"}`

### Start the Frontend
In a new terminal, from the `frontend/` folder:
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

---

## 🧪 Usage Guide

### 🔍 Technical Chart
- Use the dropdown to select any of the **150+ stocks**.
- Choose a **timeframe** (1m, 5m, 15m, 1h, 4h, 1D) and **chart type** (candlestick, line, bar, area).
- Toggle indicators: **Bollinger Bands** and **MA50**.
- Use the **Zoom** and **Offset** sliders to focus on specific periods.
- Click **Pause** to freeze real‑time updates (useful for analysis).
- Click **Historical** to view daily OHLCV from your database.

### 📋 Watchlist
- Click **+ Add Current** to add the selected stock to the watchlist.
- Each watchlist card shows a mini sparkline and the percentage change.
- Click any card to switch the main chart to that symbol.
- Hover and click the **X** to remove a symbol.

### 📊 Backtest
- In the left panel, configure:
  - **Date range** (start/end)
  - **Filters**: market cap range, minimum ROCE
  - **Ranking rules**: add metrics (ROE, PE, ROCE, etc.) with weights and sort direction
  - **Position sizing**: equal, market‑cap‑weighted, or ROCE‑weighted
  - **Rebalancing frequency**: monthly, quarterly, yearly
  - **Initial capital**, **slippage**, and **leverage** factors
- Click **Compute Matrix Engine**.
- The **Strategy Metrics** tab will display:
  - **Equity curve** (with Nifty 50 benchmark)
  - **Drawdown chart**
  - **Top Winners & Losers**
  - **Performance metrics**: CAGR, Sharpe Ratio, Sortino Ratio, Win Rate, Max Drawdown, Average Drawdown
- Export results as **CSV** or **Excel** using the buttons on the strategy view.

### 🧩 Other Tabs
- **Heatmap**: Visual sector allocation (static sample data).
- **Order Depth**: Simulated bid/ask order book for the selected symbol.
- **Pine Script IDE**: Write and compile experimental Pine‑style scripts (basic lexer/parser).
- **Groww Calculator**: SIP/Lump sum wealth projection with inflation adjustment.
- **Help**: In‑app quick guide.

---

## 📡 API Endpoints (Selected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/run-backtest` | Run a backtest with the provided parameters. Returns equity curve, drawdown, metrics, and stock performance. |
| `GET` | `/api/stream-ticker?symbol=X` | Server‑Sent Events stream for live ticker data (with fallback). |
| `GET` | `/api/historical-data?symbol=X` | Daily OHLCV from the PostgreSQL database. |
| `GET` | `/api/intraday-data?symbol=X&interval=1m` | Intraday OHLCV from Yahoo Finance (supports 1m, 5m, 15m, 1h). |
| `GET` | `/api/symbols` | List of all symbols and company names (used for the dropdown). |
| `POST` | `/api/pine-compile` | Compile a Pine Script snippet (experimental). |
| `GET` | `/api/health` | Health check – returns `{"status":"OK"}`. |

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Backend fails to start** | Check that PostgreSQL is running and the `.env` credentials are correct. Run `python -c "import psycopg2; psycopg2.connect(host='localhost', database='quant_db', user='postgres', password='...')"` to test. |
| **Frontend shows “No realtime data yet”** | The SSE stream may be disconnected – check the backend console. The frontend will fall back to synthetic data after 5 seconds. |
| **Dropdown empty** | Ensure the backend is running and the `/symbols` endpoint is accessible. Also verify that the `assets` table has data (run `data_loader.py`). |
| **Backtest returns no results** | Your filters may be too strict – try widening them (e.g., lower ROCE threshold, larger market cap range). Check that the `fundamentals` table has data for the selected period. |
| **“No historical data” message** | Make sure the `price_history` table is populated for the selected symbol. Run `data_loader.py` if needed. |

---

## 🧩 Future Improvements

- **Real fundamental data**: Replace mock data with real P&L, balance sheet, and cash flow from an API (e.g., Screener.in, Alpha Vantage).
- **Multi‑chart dashboard**: Show multiple stocks simultaneously.
- **Strategy comparison**: Compare multiple backtest runs side‑by‑side.
- **User authentication**: Save strategies per user.
- **More indicators**: Add RSI, MACD, Stochastic, etc., to the technical chart.
- **Export to PDF**: Generate a professional report.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [issues page](https://github.com/Lester7307/quant-suite/issues) or submit a pull request.

## 📄 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.

## 👤 Creator

**Hasmuddin**  
- GitHub: [Lester7307](https://github.com/Lester7307)  
- Email: [hasmudin035@gmail.com](mailto:hasmudin035@gmail.com)  
- Website: [www.lesterelite.tech](https://www.lesterelite.tech)

## 🙏 Acknowledgements

- [Yahoo Finance](https://finance.yahoo.com/) for providing free market data.
- [Recharts](https://recharts.org/) for the beautiful charting library.
- [Tailwind CSS](https://tailwindcss.com/) for the utility‑first CSS framework.
- [FastAPI](https://fastapi.tiangolo.com/) for the high‑performance API framework.

---

*Built with ❤️ by Hasmuddin – Quant, Code & Coffee.*
