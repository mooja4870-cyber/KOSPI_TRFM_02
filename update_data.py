import yfinance as yf
import pandas as pd
import json
from datetime import datetime, timedelta
import os
from pathlib import Path

# Path configuration
PROJECT_ROOT = Path("/Users/mooja/AI_Study/Project/BTC_TRFM_01")
REPORTS_DIR = PROJECT_ROOT / "reports"
FRONTEND_PUBLIC_DIR = Path("/Users/mooja/AI_Study/Project/BTC_TRFM_02/public")

def get_10y_kospi_data():
    print("Fetching 10 years of KOSPI data...")
    ticker = yf.Ticker("^KS11")
    # Fetch 10 years of data
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365 * 10)
    
    df = ticker.history(start=start_date, end=end_date)
    
    if df.empty:
        print("Failed to fetch KOSPI data. Using fallback.")
        return []
    
    # Format for chart: { date: 'YYYY-MM-DD', actual: price, forecast: null }
    history = []
    for date, row in df.iterrows():
        history.append({
            "date": date.strftime("%Y-%m-%d"),
            "actual": round(row["Close"], 2),
            "forecast": None,
            "lower68": None,
            "upper68": None,
            "lower95": None,
            "upper95": None
        })
    
    print(f"Fetched {len(history)} historical data points.")
    return history

def update_full_data():
    # 1. Get historical data
    history = get_10y_kospi_data()
    
    # 2. Get latest forecast from latest_prediction.json
    latest_pred_path = REPORTS_DIR / "latest_prediction.json"
    forecast = []
    regime_info = {}
    key_drivers = []
    milestones = {}
    confidence = {}
    current_price = history[-1]["actual"] if history else 6083.86

    if latest_pred_path.exists():
        with open(latest_pred_path, "r", encoding="utf-8") as f:
            pred_data = json.load(f)
            
            # Forecast points
            for i in range(len(pred_data["point_forecast"])):
                forecast.append({
                    "date": pred_data["forecast_dates"][i],
                    "actual": None,
                    "forecast": round(pred_data["point_forecast"][i], 2),
                    "lower68": round(pred_data["lower_68"][i], 2),
                    "upper68": round(pred_data["upper_68"][i], 2),
                    "lower95": round(pred_data["lower_95"][i], 2),
                    "upper95": round(pred_data["upper_95"][i], 2)
                })
            
            regime_info = pred_data.get("regime", {})
            key_drivers = pred_data.get("key_drivers", [])
            milestones = pred_data.get("key_milestones", {})
            confidence = pred_data.get("model_confidence", {})
            current_price = pred_data.get("current_price", current_price)

    # Calculate daily change
    daily_change = 0
    daily_pct = 0
    if len(history) >= 2:
        prev_close = history[-2]["actual"]
        current_close = history[-1]["actual"]
        daily_change = round(current_close - prev_close, 2)
        daily_pct = round((daily_change / prev_close) * 100, 2)

    # 3. Combine
    full_data = {
        "history": history,
        "forecast": forecast,
        "regime": regime_info,
        "key_drivers": key_drivers,
        "key_milestones": milestones,
        "model_confidence": confidence,
        "current_price": current_close if history else 6083.86,
        "daily_change": daily_change,
        "daily_pct": daily_pct,
        "last_update": datetime.now().isoformat()
    }
    
    # 4. Save to frontend public dir
    output_path = FRONTEND_PUBLIC_DIR / "full_prediction.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(full_data, f, indent=4, ensure_ascii=False)
    
    print(f"Saved full data to {output_path}")

if __name__ == "__main__":
    update_full_data()
