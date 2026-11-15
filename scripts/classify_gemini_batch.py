import sqlite3
import json
import urllib.request
import urllib.error
import re

# Load GEMINI_API_KEY from .dev.vars
key = None
with open('.dev.vars') as f:
    for line in f:
        if line.startswith('GEMINI_API_KEY='):
            key = line.strip().split('=', 1)[1].strip('\"\'')
            break

if not key:
    raise ValueError("GEMINI_API_KEY not found in .dev.vars")

# Load existing matcher results from migrate/test_matcher.py or src/classify.js
import sys
sys.path.insert(0, 'migrate')
from test_matcher import match_product

db_path = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9925c04bd7ea3b0affe4411c7bcbd6ba9e4907d2a17ad0fd2d4a2f660155cd6b.sqlite'
con = sqlite3.connect(db_path)
cur = con.cursor()

items = cur.execute('SELECT id, name, clean_name, size, department, brand, price FROM products WHERE sub_category = ?', ('Other Spirits – review',)).fetchall()
print(f"Total Other Spirits items: {len(items)}")

brand_matched = []
unmatched = []

for item in items:
    pid, name, clean, size, dept, brand, price = item
    res = match_product(name, clean, dept, brand)
    if res:
        brand_matched.append({
            'product_id': pid,
            'name': name,
            'clean_name': clean,
            'size': size,
            'department': dept,
            'current_category': 'Spirits',
            'current_sub_category': 'Other Spirits – review',
            'suggested_category': res[0],
            'suggested_sub_category': res[1],
            'suggested_brand': res[2],
            'confidence': res[3],
            'reason': res[4],
            'source': 'brand_match'
        })
    else:
        unmatched.append({
            'id': pid,
            'name': name,
            'size': size or '',
            'department': dept or '',
            'price': price or 0
        })

print(f"Brand/Rule Matched: {len(brand_matched)}")
print(f"Items to send to Gemini: {len(unmatched)}")

# Chunk unmatched into batches of up to 50
BATCH_SIZE = 50
batches = [unmatched[i:i + BATCH_SIZE] for i in range(0, len(unmatched), BATCH_SIZE)]
print(f"Number of Gemini batches: {len(batches)}")

model = "gemini-3.5-flash"

SYSTEM_PROMPT = """You are an expert liquor, beer, wine, beverage, and grocery retail taxonomy assistant for a liquor and convenience store in Florida.
Categorize the following retail products into the store's taxonomy.

Available Groups and Sub-Categories:
1. Spirits: "Vodka", "Tequila/Mezcal", "Whiskey", "Cognac/Brandy", "Rum", "Gin", "Liqueur", "Other Spirits – review"
2. Beer & RTD: "Beer", "RTD/Seltzer"
3. Wine: "Wine"
4. Drinks & Mixers: "Drinks & Mixers"
5. Snacks & Grocery: "Snacks & Grocery"
6. Tobacco: "Cigarettes", "Cigars/Cigarillos", "Vapes", "Accessories"
7. Lottery: "Lottery"

Guidelines:
- Adult novelties, male enhancement (e.g. Rhino, V_gra, Kitty Kat, Gman, Strong Back), condoms, rolling trays, grocery/candy -> "Snacks & Grocery"
- Rolling papers, wraps, hemp, lighters, torches -> "Tobacco" / "Accessories"
- Cigars, cigarillos, blunt wraps -> "Tobacco" / "Cigars/Cigarillos"
- Vapes, e-cigs, disposables, carts, THC/delta8 hemp -> "Tobacco" / "Vapes"
- Soft drinks, juices, energy drinks, waters -> "Drinks & Mixers"
- RTD cocktails, seltzers, malt beverages -> "Beer & RTD" / "RTD/Seltzer"
- Wine, sangria, port, sparkling wine -> "Wine" / "Wine"
- If a product is truly an unidentified spirit/liquor, use "Spirits" / "Other Spirits – review".

Return a valid JSON array of objects with fields:
- "id": integer
- "group": string (one of the 7 groups above)
- "sub_category": string (valid sub_category for the group)
- "brand": string (clean canonical brand name)
- "confidence": float between 0.0 and 1.0
- "reason": string (short 3-6 word explanation)
"""

total_prompt_tokens = 0
total_candidate_tokens = 0
gemini_results = []

import time

for idx, batch in enumerate(batches, 1):
    print(f"\n--- Calling Gemini for Batch {idx}/{len(batches)} ({len(batch)} items) ---")
    user_content = "Classify these products:\n" + json.dumps(batch, indent=2)

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": SYSTEM_PROMPT + "\n\n" + user_content}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }

    models_to_try = [model, "gemini-3.5-flash-lite", "gemini-3.8-flash"]
    batch_done = False

    for attempt in range(5):
        for m in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={key}"
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            try:
                with urllib.request.urlopen(req) as resp:
                    data = json.loads(resp.read().decode())
                    usage = data.get('usageMetadata', {})
                    p_tok = usage.get('promptTokenCount', 0)
                    c_tok = usage.get('candidatesTokenCount', 0)
                    t_tok = usage.get('totalTokenCount', 0)
                    total_prompt_tokens += p_tok
                    total_candidate_tokens += c_tok
                    print(f"Batch {idx} ({m}) tokens: Prompt={p_tok}, Candidate={c_tok}, Total={t_tok}")

                    candidate = data.get('candidates', [{}])[0]
                    text = candidate.get('content', {}).get('parts', [{}])[0].get('text', '')
                    parsed = json.loads(text)
                    print(f"Received {len(parsed)} classifications")
                    gemini_results.extend(parsed)
                    batch_done = True
                    break
            except urllib.error.HTTPError as e:
                err_text = e.read().decode()
                print(f"Model {m} HTTP {e.code}: {err_text[:120]}")
                if e.code in (503, 429):
                    time.sleep(2)
                    continue
                else:
                    break
        if batch_done:
            break
        print(f"Retrying batch {idx} (attempt {attempt + 1})...")
        time.sleep(3)
    if not batch_done:
        raise RuntimeError(f"Failed to process batch {idx} after retries")

print("\n================ GEMINI USAGE STATS ================")
print(f"Total Gemini Calls: {len(batches)}")
print(f"Prompt Tokens: {total_prompt_tokens}")
print(f"Candidate Tokens: {total_candidate_tokens}")
total_tokens = total_prompt_tokens + total_candidate_tokens
print(f"Total Tokens: {total_tokens}")
# Gemini 3.5 Flash pricing: $0.075 / 1M prompt, $0.30 / 1M output
cost = (total_prompt_tokens / 1_000_000 * 0.075) + (total_candidate_tokens / 1_000_000 * 0.30)
print(f"Estimated Cost: ${cost:.6f}")
print("====================================================\n")

# Map Gemini results by id
gemini_map = {r['id']: r for r in gemini_results}

# Build full suggestion list
all_suggestions = []
all_suggestions.extend(brand_matched)

item_dict = {it[0]: it for it in items}
for g in gemini_results:
    pid = g['id']
    orig = item_dict.get(pid)
    if orig:
        all_suggestions.append({
            'product_id': pid,
            'name': orig[1],
            'clean_name': orig[2],
            'size': orig[3],
            'department': orig[4],
            'current_category': 'Spirits',
            'current_sub_category': 'Other Spirits – review',
            'suggested_category': g['group'],
            'suggested_sub_category': g['sub_category'],
            'suggested_brand': g.get('brand') or orig[5] or 'Generic',
            'confidence': float(g.get('confidence', 0.85)),
            'reason': g.get('reason', 'Gemini AI classification'),
            'source': 'gemini_ai'
        })

print(f"Total Suggestions Generated: {len(all_suggestions)}")

# Save to JSON file
with open('migrate/category_review_suggestions.json', 'w') as f:
    json.dump({
        'stats': {
            'calls': len(batches),
            'prompt_tokens': total_prompt_tokens,
            'candidate_tokens': total_candidate_tokens,
            'total_tokens': total_tokens,
            'cost_usd': cost
        },
        'suggestions': all_suggestions
    }, f, indent=2)

print("Saved to migrate/category_review_suggestions.json")
