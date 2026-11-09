import sqlite3
import re
from collections import Counter

def classify(name, clean, old_cat, old_sub, old_dept):
    n = (name or '').lower()
    c = (clean or '').lower()
    full = f'{n} {c}'
    
    # 1. LOTTERY
    if (old_dept == 'Lottery' or old_cat == 'Lottery' or 
        'lottery' in full or 'lotto' in full or n.startswith('sc-') or 
        'scratch' in full or 'crossword' in full or 'cashword' in full):
        return ('Lottery', 'Lottery')
        
    # 2. TOBACCO & SMOKING ACCESSORIES
    # Accessories
    if any(k in full for k in [
        'rolling paper', 'raw ', 'zig zag', 'bugler', 'grinder', 'pipe', 'torch', 'butane',
        'clipper', 'lighter', 'bic ', 'ash tray', 'ashtray', 'leaf wrap', 'fronto', 'grabba',
        'hemp wrap', 'filter tip', 'loose leaf', 'preroll', 'pre-roll'
    ]):
        return ('Tobacco', 'Accessories')
    # Vapes
    if any(k in full for k in ['vape', 'puff', 'elfbar', 'hqd', 'geek bar', 'breeze', 'disposable vape', 'pod', 'fume', 'raz']):
        return ('Tobacco', 'Vapes')
    # Cigars / Cigarillos
    if any(k in full for k in [
        'black & mild', 'black and mild', 'swisher', 'dutch master', 'dutch ', 'game cigar',
        'game ', 'white owl', 'backwoods', 'cuban round', 'cubanround', 'cheyenne', 'kayak',
        'copenhagen', 'skoal', 'grizzly', 'cigar', 'cigarillo', 'dip ', 'snuff', 'zone wintergreen'
    ]):
        return ('Tobacco', 'Cigars/Cigarillos')
    # Cigarettes
    if old_dept == 'Tobacco' or any(k in full for k in [
        'cigarette', 'menthol', '305\'s', '305 ', 'seneca', 'camel', 'marlboro', 'newport',
        'pall mall', 'winston', 'maverick', 'l&m', 'kool', 'basic', 'filtered cigars'
    ]):
        return ('Tobacco', 'Cigarettes')

    # 3. BEER & RTD
    # RTD / Seltzers / Canned cocktails (Crown Royal cans -> RTD!)
    if any(k in full for k in [
        'cutwater', 'cut water', 'clubtails', 'clubtail', 'buzzballz', 'buzzball',
        'high noon', 'cayman jack', 'monaco', 'beatbox', 'white claw', 'truly', 'nutrl',
        'twisted tea', 'simply spiked', 'smirnoff ice', 'mike\'s hard', 'mikes hard', 'mike\'s', 'mikes',
        'seagram\'s escapes', 'seagram escapes', 'seagrams escapes', 'four loko', 'seltzer',
        'crown royal can', 'jack daniel can', 'canned cocktail', 'long drink', 'cantina',
        'seagrams blueberry acai lemonade', 'extreme twisted rea'
    ]):
        return ('Beer & RTD', 'RTD/Seltzer')

    # Beer / Malt
    if any(k in full for k in [
        'beer', 'bud light', 'budlight', 'budweiser', 'bud ', 'busch', 'bush apple', 'natural ice', 'natural light',
        'natty daddy', 'natty ice', 'natty light', 'michelob', 'michelo', 'miller', 'coors',
        'corona', 'modelo', 'heineken', 'stella artois', 'stella', 'guinness', 'yuengling',
        'rolling rock', 'colt 45', 'steel reserve', 'mickey\'s', 'mickeys', 'king cobra',
        'olde english', 'oe 800', 'hurricane', 'labatt', 'dos equis', 'blue moon',
        'pabst', 'pbr', 'warity', 'icehouse', 'milwaukee', 'st ides', 'magnum',
        'red dog', 'keystone', 'schlitz', 'malt liquor', 'ipa', 'ale', 'lager', 'stout',
        'cider', 'angry orchard', 'hard cider', 'pacifico', 'victoria', 'estrella'
    ]):
        return ('Beer & RTD', 'Beer')

    # 4. WINE
    if old_dept == 'Wine' or any(k in full for k in [
        'wine', 'cabernet', 'chardonnay', 'merlot', 'pinot', 'sauvignon', 'moscato',
        'champagne', 'prosecco', 'rose', 'sangria', 'sutter home', 'barefoot',
        'yellow tail', 'woodbridge', 'kendall jackson', 'kendall-jackson', 'apothic',
        'bartenura', 'stella rosa', 'cupcake', 'carlo rossi', 'franzia', 'boone',
        'wild irish rose', 'md 20/20', 'cisco', 'manischewitz', 'clos du bois',
        'robert mondavi', 'josh cellars', 'meomi', 'la marca', 'korbel', 'andre',
        'dom perignon', 'moet', 'veuve', 'chandon', 'belaire', 'luc belaire',
        'beringer', 'lindemans', 'black box', 'bota box', 'peter vella', 'almaden'
    ]):
        return ('Wine', 'Wine')

    # 5. DRINKS & MIXERS (indigo)
    if any(k in full for k in [
        'coca-cola', 'coca cola', 'coke', 'pepsi', 'sprite', 'mountain dew', 'dr pepper',
        'fanta', 'crush', 'ginger ale', 'canada dry', 'squirt', 'starry', '7up', 'kola champagne',
        'nehi', 'root beer', 'mug root', 'barq', 'red bull', 'redbull', 'redbul', 'monster energy',
        'monster', 'celsius', 'bang energy', 'reign', 'alani', 'bodyarmor', 'body armor',
        'gatorade', 'powerade', 'electrolit', 'propel', 'poland spring', 'deer park', 'dasani',
        'aquafina', 'fiji', 'smartwater', 'essentia', 'core water', 'pure leaf', 'gold peak',
        'golden peak', 'arizona', 'lipton', 'snapple', 'brisk', 'peace tea', 'ocean spray',
        'welch', 'tampico', 'sunny d', 'juice', 'lemonade', 'punch', 'margarita mix', 'bloody mary',
        'zing zang', 'grenadine', 'tonic', 'club soda', 'mixer', 'sweet & sour', 'sour mix',
        'bar syrup', 'aloe strawberry', 'orange carrot', 'splash mango', '4pk bevrg', 'six sip',
        'aloe vera drink', 'md 16oz', 'md 12 oz', 'md 20.00 oz', 'tropical vibe 12oz', 'red devil'
    ]) or full.endswith(' water') or ' water ' in full or 'spring water' in full or 'drinking water' in full:
        return ('Drinks & Mixers', 'Drinks & Mixers')

    # 6. SNACKS & GROCERY (lime)
    if any(k in full for k in [
        'french fries', 'great value', 'iodized salt', 'bluerhino', 'blue rhino', 'purina', 'friskies',
        'ketchup', 'honeybun', 'wonder classic', 'hamburguer bun', 'tyson chicken', 'condom', 'trojan',
        'ice 5lb', 'ice 7lb', 'ice 10lb', 'ice 16lb', 'ice 20lb', 'ice cream', 'deconna', 'sandwich 6oz',
        'sandwich 5oz', 'cone 4oz', 'doritos', 'cheetos', 'lays', 'lay\'s', 'pringles', 'ruffles', 'fritos',
        'candy', 'snickers', 'reese', 'm&m', 'skittles', 'hershey', 'cup 16oz', 'cup 32oz', 'cup 44oz',
        'cups', 'bread', 'butterbread', 'milk', 'cheese', 'dawn', 't shirt', 'tshirt', 'vneck', '5xl',
        '4xl', '3xl', '2xl', 'bc 2pk', 'bc 6pk', 'rhino one', 'urban s', 'pure kings', 'city life diamond'
    ]):
        return ('Snacks & Grocery', 'Snacks & Grocery')

    # 7. SPIRITS
    # Gin (word boundary check so "original" does not match)
    if re.search(r'\bgin\b', full) and not 'ginger' in full:
        return ('Spirits', 'Gin')
    if any(k in full for k in ['tanqueray', 'bombay', 'beefeater', 'hendrick', 'gordon', 'aviation', 'gilbey']):
        return ('Spirits', 'Gin')

    # Vodka
    if any(k in full for k in [
        'vodka', 'tito', 'smirnoff', 'absolut', 'grey goose', 'gray goose', 'ciroc', 'ketel',
        'svedka', 'three olives', 'taaka', 'popov', 'burnett', 'pinnacle', 'crystal palace',
        'nikolai', 'karkov', 'deep eddy', 'platinum 7x', 'platinum 10x', 'platimun 7x', 'skol',
        'skyy', 'finlandia', 'stoli', 'belvedere', 'chopin', 'barton vodka', 'fleischmann',
        'mccormick vodka', 'polar ice', 'sobieski', 'reyka', 'meili', 'new amsterdam', 'new amsterdan',
        'newamstersam', 'amsterdam'
    ]):
        return ('Spirits', 'Vodka')

    # Tequila / Mezcal
    if any(k in full for k in [
        'tequila', 'don julio', 'casamigos', 'patron', '1800', 'cuervo', 'corralejo',
        'el mayor', 'lunazul', 'herradura', 'margaritaville', 'teremana', 'espolon',
        'hornitos', 'cazadores', 'sauza', 'milagro', 'clase azul', 'montezuma',
        'juarez', 'mezcal', 'reposado', 'blanco', 'anejo', 'añejo', 'tarantula',
        'cabo wabo', 'cincoro', 'margarita gold', 'tequila rose'
    ]):
        return ('Spirits', 'Tequila/Mezcal')

    # Whiskey / Bourbon / Scotch (Crown Royal bottles -> Whiskey!)
    if any(k in full for k in [
        'whisky', 'whiskey', 'bourbon', 'scotch', 'fireball', 'jack daniel', 'jack daniels', 'gentleman jack',
        'jim beam', 'jimbeam', 'jim bean', 'crown royal', 'crow royal', 'crown royale', 'jameson',
        'maker\'s mark', 'makers mark', 'woodford', 'johnnie walker', 'johnny walker', 'macallan',
        'glenfiddich', 'glenlivet', 'ballantine', 'buchanan', 'dewar', 'chivas', 'wild turkey',
        'evan williams', 'bulleit', 'seagram\'s 7', 'seagrams 7', 'seagram 7', '7 crown',
        'southern comfort', 'canadian club', 'black velvet', 'rich & rare', 'rich and rare',
        'kentucky gentleman', 'kessler', 'early times', 'ten high', 'windsor', 'old crow',
        'old forester', 'knob creek', 'basil hayden', 'buffalo trace', 'proper twelve',
        'high west', 'rye'
    ]):
        return ('Spirits', 'Whiskey')

    # Cognac / Brandy
    if any(k in full for k in [
        'cognac', 'hennessy', 'remy martin', 'remy', 'courvoisier', 'martell',
        'd\'usse', 'dusse', 'brandy', 'e&j', 'e & j', 'paul masson', 'paul massion',
        'christian brothers', 'christian bro', 'raynal', 'coronet', 'ansac', 'vsop', 'xo '
    ]):
        return ('Spirits', 'Cognac/Brandy')

    # Rum
    if any(k in full for k in [
        'rum', 'bacardi', 'captain morgan', 'capt morgan', 'malibu', 'kraken',
        'sailor jerry', 'appleton', 'mount gay', 'ronrico', 'castillo', 'calypso rum',
        'calypso spiced', 'myers', 'admiral nelson', 'bumbu', 'brugal', 'flor de cana',
        'flor de caña', 'cruzan'
    ]):
        return ('Spirits', 'Rum')

    # Liqueur (Genuine liqueurs & cordials ONLY)
    if any(k in full for k in [
        'baileys', 'bailey\'s', 'kahlua', 'jagermeister', 'jager', 'grand marnier',
        'cointreau', 'disaronno', 'dekuyper', 'arrow', 'hiram walker', 'hpnotiq',
        'hypnotiq', 'rumchata', 'sambuca', 'midori', 'chambord', 'campari', 'aperol',
        'schnapps', 'triple sec', 'amaretto', 'creme de', 'cordial',
        'curacao', 'anisette', 'drambuie', 'frangelico', 'ouzo', '99 '
    ]) or n.startswith('99 '):
        return ('Spirits', 'Liqueur')

    # Unmatched liquor -> Other Spirits – review
    return ('Spirits', 'Other Spirits – review')

def main():
    conn = sqlite3.connect('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9925c04bd7ea3b0affe4411c7bcbd6ba9e4907d2a17ad0fd2d4a2f660155cd6b.sqlite')
    c = conn.cursor()
    c.execute('SELECT id, name, clean_name, category, sub_category, department FROM products ORDER BY id')
    rows = c.fetchall()

    sql_statements = []
    cat_counts = Counter()
    sub_counts = Counter()

    for pid, name, clean, old_cat, old_sub, old_dept in rows:
        cat, sub = classify(name, clean, old_cat, old_sub, old_dept)
        cat_counts[cat] += 1
        sub_counts[f"{cat} -> {sub}"] += 1
        
        c_esc = cat.replace("'", "''")
        s_esc = sub.replace("'", "''")
        sql_statements.append(f"UPDATE products SET category='{c_esc}', sub_category='{s_esc}' WHERE id={pid};")

    print(f"Total products classified: {len(rows)}")
    print("\n=== 7 GROUPS (category) ===")
    for cat, cnt in sorted(cat_counts.items()):
        print(f"  {cat:<20}: {cnt:>4} items")

    print("\n=== SUB-CATEGORIES (sub_category) ===")
    for pair, cnt in sorted(sub_counts.items()):
        print(f"  {pair:<35}: {cnt:>4} items")

    with open('migrate/v3_categories.sql', 'w') as f:
        f.write("-- V3 Taxonomy Update: 7 Groups & Clean Sub-categories\n")
        f.write("\n".join(sql_statements) + "\n")

    print("\nWrote migrate/v3_categories.sql successfully.")

if __name__ == '__main__':
    main()
