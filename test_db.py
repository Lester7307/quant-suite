import psycopg2

DB_SETTINGS = {
    "host": "localhost",
    "database": "quant_db",
    "user": "postgres",
    "password": "password123"
}

def verify_and_force_seed():
    print("Connecting to PostgreSQL...")
    try:
        conn = psycopg2.connect(**DB_SETTINGS)
        cursor = conn.cursor()
        
        # 1. Clean verify checks
        cursor.execute("SELECT COUNT(*) FROM assets;")
        assets_count = cursor.fetchone()[0]
        print(f"Current assets count: {assets_count}")
        
        # 2. Insert absolute fallback seed row to verify the graph immediately
        print("Inserting forced backtesting baseline components...")
        
        cursor.execute("""
            INSERT INTO assets (symbol, company_name, sector, market_cap)
            VALUES ('RELIANCE.NS', 'Reliance Industries', 'Energy', 150000.00)
            ON CONFLICT (symbol) DO UPDATE SET market_cap = EXCLUDED.market_cap
            RETURNING ticker_id;
        """)
        ticker_id = cursor.fetchone()[0]
        
        # Fixed execution tuple args matching placeholders exactly
        cursor.execute("""
            INSERT INTO fundamentals (ticker_id, year, roce, roe, pe_ratio, pat)
            VALUES (%s, 2023, 25.5, 22.1, 15.4, 5000.00),
                   (%s, 2024, 26.2, 23.4, 14.8, 6200.00),
                   (%s, 2025, 27.1, 24.0, 16.2, 7100.00)
            ON CONFLICT (ticker_id, year) DO NOTHING;
        """, (ticker_id, ticker_id, ticker_id))
        
        # Seed continuous daily price rows so the backtester has entries for every single step
        print("Injecting chronological pricing timelines...")
        
        # Generate a dense daily series from 2023 through 2025 to satisfy the backtest dataframe range
        start_date = "2023-01-01"
        end_date = "2026-01-01"
        date_series = pd.date_range(start=start_date, end=end_date, freq='D') if 'pd' in locals() else None
        
        # Fallback dense manual date injection block if pandas isn't imported in test script
        import datetime
        start = datetime.date(2023, 1, 1)
        end = datetime.date(2026, 1, 1)
        delta = datetime.timedelta(days=1)
        
        price_baseline = 2000.00
        current_date = start
        idx = 0
        price_rows = []
        
        while current_date <= end:
            # Gradually increase price to simulate an upward equity curve vector
            current_price = price_baseline + (idx * 0.4) 
            date_str = current_date.strftime('%Y-%m-%d')
            price_rows.append((
                ticker_id, date_str, current_price - 5, current_price + 8, 
                current_price - 10, current_price, 100000
            ))
            current_date += delta
            idx += 1

        from psycopg2.extras import execute_values
        execute_values(cursor, """
            INSERT INTO price_history (ticker_id, date, open, high, low, close, volume)
            VALUES %s ON CONFLICT (ticker_id, date) DO NOTHING;
        """, price_rows)
            
        conn.commit()
        
        cursor.execute("SELECT COUNT(*) FROM price_history;")
        prices_count = cursor.fetchone()[0]
        print(f"🎉 Success! Total daily price rows now active in database: {prices_count}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Database error: {e}")

if __name__ == "__main__":
    verify_and_force_seed()
    