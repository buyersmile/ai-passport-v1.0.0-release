import requests
import time

def get_current_price(symbol):
    try:
        url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
        return float(requests.get(url).json()['price'])
    except:
        return 0.0

def run_trading_bot(symbol, target_price, tp_price, sl_trigger, sl_limit):
    current = get_current_price(symbol)
    if current == 0.0: return
    
    # วิเคราะห์ทิศทาง
    side = "SELL" if current > target_price else "BUY"
    
    print(f"\n[{time.strftime('%H:%M:%S')}] กลยุทธ์: {side} LIMIT")
    print(f"ราคาตลาด: {current:.2f}")
    print(f"ราคาเปิดออเดอร์: {target_price:.2f}")
    print(f"TP Limit: {tp_price:.2f}")
    print(f"SL Trigger: {sl_trigger:.2f}")
    print(f"SL Limit: {sl_limit:.2f}")
    print("="*40)

# --- ใส่ค่าที่ต้องการที่นี่ ---
TARGET = 81000.00
TP = 79380.00
SL_TRIG = 81810.00
SL_LIM = 81850.00 # ใส่ค่า SL Limit ที่คุณต้องการตรงนี้

try:
    while True:
        run_trading_bot("BTCUSDT", TARGET, TP, SL_TRIG, SL_LIM)
        time.sleep(30)
except KeyboardInterrupt:
    print("\nหยุดการทำงาน")
