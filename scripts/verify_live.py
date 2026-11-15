import urllib.request
import json
import http.cookiejar

pwd = None
with open('.dev.vars') as f:
    for line in f:
        if line.startswith('DASHBOARD_PASSWORD='):
            pwd = line.strip().split('=', 1)[1].strip('\"\'')
            break

base = 'https://discount-liquor.zshaik2801.workers.dev'
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/json'
}

# Login
login_data = json.dumps({'password': pwd}).encode('utf-8')
req = urllib.request.Request(f'{base}/login', data=login_data, headers=headers)
with opener.open(req) as resp:
    pass

# 1. Check suggestions (defaults to pending)
req = urllib.request.Request(f'{base}/api/categories/suggestions', headers={'User-Agent': headers['User-Agent']})
with opener.open(req) as resp:
    data = json.loads(resp.read().decode())
    print(f'Live API Pending Suggestions Count: {len(data.get("suggestions", []))}')

# 2. Check 11/5 sales
req = urllib.request.Request(f'{base}/api/sales?start=2026-11-05&end=2026-11-05', headers={'User-Agent': headers['User-Agent']})
with opener.open(req) as resp:
    data = json.loads(resp.read().decode())
    sales_amt = data.get('store_sales')
    print(f'Live API 11/5 Store Sales: ${sales_amt:.2f}')

# 3. Check Lottery items count in inventory
req = urllib.request.Request(f'{base}/api/inventory?category=Lottery&all=1', headers={'User-Agent': headers['User-Agent']})
with opener.open(req) as resp:
    items = json.loads(resp.read().decode())
    print(f'Live API Lottery Inventory Count: {len(items)}')

# 4. Check Other Spirits – review count in inventory
req = urllib.request.Request(f'{base}/api/inventory?category=Spirits&sub_category=Other%20Spirits%20%E2%80%93%20review&all=1', headers={'User-Agent': headers['User-Agent']})
with opener.open(req) as resp:
    items = json.loads(resp.read().decode())
    print(f'Live API Other Spirits – review Inventory Count: {len(items)}')
