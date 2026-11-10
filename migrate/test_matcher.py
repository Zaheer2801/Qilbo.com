import sqlite3, re

con = sqlite3.connect('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9925c04bd7ea3b0affe4411c7bcbd6ba9e4907d2a17ad0fd2d4a2f660155cd6b.sqlite')
cur = con.cursor()

# Known brand catalogue
known_brands = cur.execute('''
SELECT brand, category, sub_category, count(*) as cnt
FROM products
WHERE brand IS NOT NULL AND sub_category != 'Other Spirits – review'
GROUP BY brand, category, sub_category
ORDER BY cnt DESC
''').fetchall()

# Brand dict: normalized name -> {brand, category, sub_category}
brand_map = {}
for b, cat, sub, cnt in known_brands:
    norm = re.sub(r'[^a-z0-9]', '', b.lower())
    if norm and norm not in brand_map:
        brand_map[norm] = {'brand': b, 'category': cat, 'sub_category': sub}

# Add special known canonicals mentioned by user or common in inventory
additional = [
    ('jackdaniel', "Jack Daniel's", 'Spirits', 'Whiskey'),
    ('jimbean', 'Jim Beam', 'Spirits', 'Whiskey'),
    ('hennesy', 'Hennessy', 'Spirits', 'Cognac/Brandy'),
    ('paummassion', 'Paul Masson', 'Spirits', 'Cognac/Brandy'),
    ('paulmassion', 'Paul Masson', 'Spirits', 'Cognac/Brandy'),
    ('micgelab', 'Michelob', 'Beer & RTD', 'Beer'),
    ('michelo', 'Michelob', 'Beer & RTD', 'Beer'),
    ('sunkist', 'Sunkist', 'Drinks & Mixers', 'Drinks & Mixers'),
    ('rccola', 'RC Cola', 'Drinks & Mixers', 'Drinks & Mixers'),
    ('starbucks', 'Starbucks', 'Drinks & Mixers', 'Drinks & Mixers'),
    ('bluebird', 'Bluebird', 'Drinks & Mixers', 'Drinks & Mixers'),
    ('premierprotein', 'Premier Protein', 'Drinks & Mixers', 'Drinks & Mixers'),
    ('clubtail', 'Clubtails', 'Beer & RTD', 'RTD/Seltzer'),
    ('buzzball', 'BuzzBallz', 'Beer & RTD', 'RTD/Seltzer'),
    ('buzzballz', 'BuzzBallz', 'Beer & RTD', 'RTD/Seltzer'),
    ('bigsipz', 'Big Sipz', 'Beer & RTD', 'RTD/Seltzer'),
    ('md2020', 'MD 20/20', 'Wine', 'Wine'),
    ('pinkwhitney', 'Pink Whitney', 'Spirits', 'Vodka'),
    ('benjaminbanana', 'Benjamin Banana', 'Spirits', 'Liqueur'),
    ('99shot', '99 Brand', 'Spirits', 'Liqueur'),
    ('99brand', '99 Brand', 'Spirits', 'Liqueur'),
    ('canadianmist', 'Canadian Mist', 'Spirits', 'Whiskey'),
    ('proper12', 'Proper Twelve', 'Spirits', 'Whiskey'),
    ('properno12', 'Proper Twelve', 'Spirits', 'Whiskey'),
    ('propernotwelve', 'Proper Twelve', 'Spirits', 'Whiskey'),
    ('propertwelve', 'Proper Twelve', 'Spirits', 'Whiskey'),
    ('coronita', 'Corona', 'Beer & RTD', 'Beer'),
    ('calypso', 'Calypso', 'Spirits', 'Rum'),
    ('taylorport', 'Taylor', 'Wine', 'Wine'),
    ('topochico', 'Topo Chico', 'Drinks & Mixers', 'Drinks & Mixers'),
    ('vitaminwater', 'VitaminWater', 'Drinks & Mixers', 'Drinks & Mixers'),
    ('jarritos', 'Jarritos', 'Drinks & Mixers', 'Drinks & Mixers'),
    ('minutemaid', 'Minute Maid', 'Drinks & Mixers', 'Drinks & Mixers'),
    ('deconna', 'Deconna', 'Snacks & Grocery', 'Snacks & Grocery'),
    ('decana', 'Deconna', 'Snacks & Grocery', 'Snacks & Grocery'),
    ('moonpie', 'Moon Pie', 'Snacks & Grocery', 'Snacks & Grocery'),
    ('crystalhot', 'Crystal', 'Snacks & Grocery', 'Snacks & Grocery'),
    ('nestle', 'Nestle', 'Snacks & Grocery', 'Snacks & Grocery'),
    ('backwood', 'Backwoods', 'Tobacco', 'Cigars/Cigarillos'),
    ('bobmarley', 'Bob Marley', 'Tobacco', 'Accessories'),
]

for norm, b, cat, sub in additional:
    brand_map[norm] = {'brand': b, 'category': cat, 'sub_category': sub}

def levenshtein(s1, s2):
    if abs(len(s1) - len(s2)) > 2:
        return 99
    if s1 == s2: return 0
    d = [[0] * (len(s2) + 1) for _ in range(len(s1) + 1)]
    for i in range(len(s1) + 1): d[i][0] = i
    for j in range(len(s2) + 1): d[0][j] = j
    for i in range(1, len(s1) + 1):
        for j in range(1, len(s2) + 1):
            cost = 0 if s1[i-1] == s2[j-1] else 1
            d[i][j] = min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost)
    return d[len(s1)][len(s2)]

def match_product(name, clean_name, dept, brand):
    text = f"{name or ''} {clean_name or ''} {brand or ''}".lower()
    norm_text = re.sub(r'[^a-z0-9]', '', text)

    # 1. Exact or substring match on normalized brand
    for norm_brand, info in brand_map.items():
        if len(norm_brand) >= 4 and norm_brand in norm_text:
            return (info['category'], info['sub_category'], info['brand'], 0.98, f"matched brand {info['brand']}")

    # 2. Token-level typo-tolerant fuzzy match (Levenshtein <= 1 for 5-7 chars, <= 2 for 8+ chars)
    words = re.findall(r'[a-z0-9]+', text)
    # Also check adjacent pairs (e.g. "club tail", "buzz ball", "paum massion")
    pairs = [words[i] + words[i+1] for i in range(len(words)-1)] if len(words) > 1 else []
    all_tokens = words + pairs

    for tok in all_tokens:
        if len(tok) < 5: continue
        for norm_brand, info in brand_map.items():
            if abs(len(tok) - len(norm_brand)) <= 2:
                dist = levenshtein(tok, norm_brand)
                max_d = 2 if min(len(tok), len(norm_brand)) >= 8 else 1
                if dist <= max_d:
                    conf = 0.95 if dist == 1 else 0.90
                    return (info['category'], info['sub_category'], info['brand'], conf, f"fuzzy brand {info['brand']} (dist {dist})")

    # 3. Department-specific rules
    if dept == 'Beverages' or any(k in text for k in ['soda', 'cola', 'tea', 'juice', 'water', 'punch', 'lemonade', 'frappuccino', 'energy']):
        # Non-alcoholic drink check
        if not any(k in text for k in ['vodka', 'rum', 'gin', 'tequila', 'whiskey', 'bourbon', 'cognac', 'beer', 'wine', 'liqueur', 'ale', 'lager', 'ipa']):
            return ('Drinks & Mixers', 'Drinks & Mixers', brand or 'Generic', 0.95, "Beverages department / soft drink")

    # 4. Snacks / grocery in General Merchandise
    if dept == 'General Merchandise':
        if any(k in text for k in [
            'chip', 'doritos', 'cheetos', 'lays', 'candy', 'snack', 'chocolate', 'pie', 'cookie',
            'mussels', 'shrimp', 'sauce', 'detergent', 'peanut', 'seasoning', 'hot sauce',
            'ice cream', 'ice bar', 'cone', 'cup', 'cups', 'condom', 'trojan', 'honey', 'patch'
        ]):
            return ('Snacks & Grocery', 'Snacks & Grocery', brand or 'Generic', 0.95, "General Merchandise food/grocery")
        if any(k in text for k in ['wrap', 'hemp', 'rolling paper', 'leaf', 'grinder', 'pipe', 'lighter', 'butane', 'torch', 'ashtray']):
            return ('Tobacco', 'Accessories', brand or 'Generic', 0.95, "Smoking accessories")
        if any(k in text for k in ['cigar', 'cigarillo', 'swisher', 'backwood', 'dutch', 'game', 'white owl']):
            return ('Tobacco', 'Cigars/Cigarillos', brand or 'Generic', 0.95, "Cigars/Cigarillos")

    return None

items = cur.execute('SELECT id, name, clean_name, size, department, brand, price FROM products WHERE sub_category = ?', ('Other Spirits – review',)).fetchall()

matched = []
unmatched = []

for item in items:
    pid, name, clean, size, dept, brand, price = item
    res = match_product(name, clean, dept, brand)
    if res:
        matched.append((item, res))
    else:
        unmatched.append(item)

print(f"Total: {len(items)}")
print(f"Rule/Brand Matched: {len(matched)}")
print(f"Unmatched: {len(unmatched)}")
