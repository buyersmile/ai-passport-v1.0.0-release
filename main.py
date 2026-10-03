import requests
import time
from datetime import datetime

def get_binance_data(symbol="BTCUSDT"):
    try:
        url_price = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
        current = float(requests.get(url_price).json()['price'])
        
        url_klines = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval=1h&limit=30"
        response = requests.get(url_klines).json()
        closes = [float(entry[4]) for entry in response]
        return current, closes
    except:
        return 0.0, []

def calculate_bollinger_bands(data, period=20, num_std=2.0):
    if len(data) < period:
        return None, None, None
    window = data[-period:]
    sma = sum(window) / period
    variance = sum((x - sma) ** 2 for x in window) / period
    std_dev = variance ** 0.5
    return sma + (num_std * std_dev), sma, sma - (num_std * std_dev)

def check_time_window(start_hour=14, end_hour=23):
    current_hour = datetime.now().hour
    if start_hour <= current_hour <= end_hour:
        return "ช่วงเวลาหวังผลสูง (High Probability)"
    else:
        return "นอกช่วงเวลาหลัก (โอกาสหวังผลน้อยลง)"

def run_dual_strategy_bot(symbol="BTCUSDT", balance=50.0, leverage=10, fixed_target=85800.0, fixed_tp=86300.0, fixed_sl_trig=85250.0, fixed_sl_lim=85200.0):
    current, closes = get_binance_data(symbol)
    if current == 0.0 or not closes:
        return

    time_status = check_time_window(14, 23)
    margin_allocated = balance * 0.15
    notional_value = margin_allocated * leverage

    # --- 1. กลยุทธ์อันแรก (Fixed Target Strategy) ---
    fixed_side = "SELL" if current > fixed_target else "BUY"
    fixed_size = notional_value / fixed_target

    # --- 2. โบลลิงเจอร์แบรนด์ (Bollinger Bands Strategy) ---
    upper, middle, lower = calculate_bollinger_bands(closes, 20, 2.0)
    if upper is not None:
        if current <= lower:
            bb_side = "BUY"
            bb_target = lower
            bb_tp = middle
            bb_sl_trig = lower * 0.992
            bb_sl_lim = bb_sl_trig * 0.999
        elif current >= upper:
            bb_side = "SELL"
            bb_target = upper
            bb_tp = middle
            bb_sl_trig = upper * 1.008
            bb_sl_lim = bb_sl_trig * 1.001
        else:
            bb_side = "BUY" if (current - lower) < (upper - current) else "SELL"
            bb_target = lower if bb_side == "BUY" else upper
            bb_tp = middle
            bb_sl_trig = bb_target * 0.992 if bb_side == "BUY" else bb_target * 1.008
            bb_sl_lim = bb_sl_trig * 0.999 if bb_side == "BUY" else bb_sl_trig * 1.001
        bb_size = notional_value / bb_target
    else:
        bb_side, bb_target, bb_tp, bb_sl_trig, bb_sl_lim, bb_size = "BUY", current, current, current, current, 0

    print(f"\n[{time.strftime('%H:%M:%S')}]สถานะเวลา: {time_status}")
    
    # แสดงผลหัวข้อที่ 1: กลยุทธ์อันแรก
    print(f"=== กลยุทธ์อันแรก (Fixed Target) ===")
    print(f"พอร์ต: {balance} USDT | Leverage: {leverage}x (Isolated)")
    print(f"ราคาตลาดปัจจุบัน: {current:.2f}")
    print(f"คำแนะนำ: {fixed_side} LIMIT")
    print(f"ทุน Margin: {margin_allocated:.2f} USDT (Size: {fixed_size:.4f} BTC)")
    print(f"ราคาเปิดออเดอร์: {fixed_target:.2f}")
    print(f"TP Limit: {fixed_tp:.2f}")
    print(f"SL Trigger: {fixed_sl_trig:.2f}")
    print(f"SL Limit: {fixed_sl_lim:.2f}")
    print("=" * 45)

    # แสดงผลหัวข้อที่ 2: โบลลิงเจอร์แบรนด์
    print(f"=== โบลลิงเจอร์แบรนด์ (Bollinger Bands) ===")
    print(f"พอร์ต: {balance} USDT | Leverage: {leverage}x (Isolated)")
    print(f"ราคาตลาดปัจจุบัน: {current:.2f}")
    print(f"BB Upper: {upper:.2f} | Middle: {middle:.2f} | Lower: {lower:.2f}")
    print(f"คำแนะนำ: {bb_side} LIMIT")
    print(f"ทุน Margin: {margin_allocated:.2f} USDT (Size: {bb_size:.4f} BTC)")
    print(f"ราคาเปิดออเดอร์: {bb_target:.2f}")
    print(f"TP Limit: {bb_tp:.2f}")
    print(f"SL Trigger: {bb_sl_trig:.2f}")
    print(f"SL Limit: {bb_sl_lim:.2f}")
    print("=" * 45)

BALANCE = 50.0
LEVERAGE = 10

try:
    while True:
        run_dual_strategy_bot("BTCUSDT", BALANCE, LEVERAGE)
        time.sleep(30)
except KeyboardInterrupt:
    print("\nหยุดการทำงานระบบเรียบร้อย")

