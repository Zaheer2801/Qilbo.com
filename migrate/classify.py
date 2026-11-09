import sqlite3
import re
from collections import Counter

# Canonical Brand Definitions (Display Name, list of pattern strings)
KNOWN_BRANDS = [
    # Top Brands
    ("Don Julio", ["don julio"]),
    ("Casamigos", ["casamigos"]),
    ("Patron", ["patron"]),
    ("1800", ["1800"]),
    ("Jose Cuervo", ["jose cuervo", "cuervo"]),
    ("Corralejo", ["corralejo"]),
    ("El Mayor", ["el mayor"]),
    ("Lunazul", ["lunazul"]),
    ("Herradura", ["herradura"]),
    ("Margaritaville", ["margaritaville"]),
    ("Teremana", ["teremana"]),
    ("Espolon", ["espolon"]),
    ("Hornitos", ["hornitos"]),
    ("Cazadores", ["cazadores"]),
    ("Sauza", ["sauza"]),
    ("Milagro", ["milagro"]),
    ("Clase Azul", ["clase azul"]),
    ("Montezuma", ["montezuma"]),
    ("Juarez", ["juarez"]),
    ("Tarantula", ["tarantula"]),
    ("Hennessy", ["hennessy"]),
    ("Remy Martin", ["remy martin", "remy"]),
    ("Courvoisier", ["courvoisier"]),
    ("Martell", ["martell"]),
    ("D'Usse", ["d'usse", "dusse"]),
    ("E&J", ["e&j", "e & j"]),
    ("Paul Masson", ["paul masson", "paul massion", "masson"]),
    ("Christian Brothers", ["christian brothers", "christian bro"]),
    ("Raynal", ["raynal"]),
    ("Jack Daniel's", ["jack daniel", "jack daniels", "gentleman jack"]),
    ("Jim Beam", ["jim beam", "jimbeam", "jim bean"]),
    ("Crown Royal", ["crown royal", "crow royal", "crown"]),
    ("Fireball", ["fireball"]),
    ("Jameson", ["jameson"]),
    ("Maker's Mark", ["maker's mark", "makers mark", "maker's"]),
    ("Woodford Reserve", ["woodford reserve", "woodford"]),
    ("Johnnie Walker", ["johnnie walker", "johnny walker", "red label", "black label", "blue label"]),
    ("Macallan", ["macallan"]),
    ("Glenfiddich", ["glenfiddich"]),
    ("Glenlivet", ["glenlivet"]),
    ("Ballantine's", ["ballantine's", "ballantines", "ballantine"]),
    ("Buchanan's", ["buchanan's", "buchanans", "buchanan"]),
    ("Dewar's", ["dewar's", "dewars", "dewar"]),
    ("Chivas Regal", ["chivas regal", "chivas"]),
    ("Wild Turkey", ["wild turkey"]),
    ("Evan Williams", ["evan williams"]),
    ("Bulleit", ["bulleit"]),
    ("Seagram's 7", ["seagram's 7", "seagrams 7", "seagram 7", "7 crown"]),
    ("Southern Comfort", ["southern comfort", "soco"]),
    ("Canadian Club", ["canadian club"]),
    ("Black Velvet", ["black velvet"]),
    ("Rich & Rare", ["rich & rare", "rich and rare"]),
    ("Kentucky Gentleman", ["kentucky gentleman"]),
    ("Kessler", ["kessler"]),
    ("Early Times", ["early times"]),
    ("Ten High", ["ten high"]),
    ("Windsor", ["windsor"]),
    ("Old Crow", ["old crow"]),
    ("Old Forester", ["old forester"]),
    ("Knob Creek", ["knob creek"]),
    ("Basil Hayden", ["basil hayden"]),
    ("Buffalo Trace", ["buffalo trace"]),
    ("Proper Twelve", ["proper twelve", "proper no. twelve"]),
    ("High West", ["high west"]),
    ("Tito's", ["tito's", "titos", "tito"]),
    ("New Amsterdam", ["new amsterdam", "new amsterdan", "newamsterdam", "newamstersam", "amsterdam"]),
    ("Smirnoff", ["smirnoff"]),
    ("Absolut", ["absolut"]),
    ("Grey Goose", ["grey goose"]),
    ("Ciroc", ["ciroc"]),
    ("Ketel One", ["ketel one", "ketel"]),
    ("Svedka", ["svedka"]),
    ("Three Olives", ["three olives"]),
    ("Taaka", ["taaka"]),
    ("Popov", ["popov"]),
    ("Burnett's", ["burnett's", "burnetts"]),
    ("Pinnacle", ["pinnacle"]),
    ("Crystal Palace", ["crystal palace"]),
    ("Nikolai", ["nikolai"]),
    ("Karkov", ["karkov"]),
    ("Deep Eddy", ["deep eddy"]),
    ("Platinum 7X", ["platinum 7x", "platimun 7x", "platinum"]),
    ("Skol", ["skol"]),
    ("Skyy", ["skyy"]),
    ("Finlandia", ["finlandia"]),
    ("Stolichnaya", ["stolichnaya", "stoli"]),
    ("Belvedere", ["belvedere"]),
    ("Chopin", ["chopin"]),
    ("Barton", ["barton"]),
    ("Fleischmann's", ["fleischmann's", "fleischmann"]),
    ("McCormick", ["mccormick"]),
    ("Bacardi", ["bacardi"]),
    ("Captain Morgan", ["captain morgan", "capt morgan", "morgan"]),
    ("Malibu", ["malibu"]),
    ("Kraken", ["kraken"]),
    ("Sailor Jerry", ["sailor jerry"]),
    ("Appleton", ["appleton"]),
    ("Mount Gay", ["mount gay"]),
    ("Ronrico", ["ronrico"]),
    ("Castillo", ["castillo"]),
    ("Calypso Rum", ["calypso spiced", "calypso rum"]),
    ("Myers's", ["myers's", "myer's", "myers"]),
    ("Admiral Nelson", ["admiral nelson"]),
    ("Bumbu", ["bumbu"]),
    ("Tanqueray", ["tanqueray"]),
    ("Bombay Sapphire", ["bombay sapphire", "bombay"]),
    ("Beefeater", ["beefeater"]),
    ("Hendrick's", ["hendrick's", "hendricks"]),
    ("Seagram's Gin", ["seagram's gin", "seagrams gin", "seagram gin"]),
    ("Gordon's", ["gordon's", "gordons"]),
    ("Aviation", ["aviation"]),
    ("99 Brand", ["99 brand", "99 bananas", "99 pink", "99 sour", "99 proof", "99 root", "99 apples", "99 peaches", "99 blackberries", "99 cherries", "99 grapes", "99 watermelons", "99 butterscotch", "99 whipped", "99 pineapple", "99 strawberry", "99 orange", "99 mango", "99 long", "99 sourberry", "99 mystery", "99 cinnamon", "99 party", "99 shooter"]),
    ("Baileys", ["baileys", "bailey's"]),
    ("Kahlua", ["kahlua"]),
    ("Jagermeister", ["jagermeister", "jager"]),
    ("Grand Marnier", ["grand marnier"]),
    ("Cointreau", ["cointreau"]),
    ("Disaronno", ["disaronno"]),
    ("DeKuyper", ["dekuyper"]),
    ("Arrow", ["arrow"]),
    ("Hiram Walker", ["hiram walker"]),
    ("Hpnotiq", ["hpnotiq", "hypnotiq"]),
    ("RumChata", ["rumchata"]),
    ("Sambuca", ["sambuca"]),
    ("Midori", ["midori"]),
    ("Chambord", ["chambord"]),
    ("Campari", ["campari"]),
    ("Aperol", ["aperol"]),
    ("Benjamin Banana", ["benjamin banana"]),
    ("Bud Light", ["bud light", "budlight"]),
    ("Budweiser", ["budweiser", "bud "]),
    ("Busch", ["busch light", "busch"]),
    ("Natural Ice", ["natural ice", "natty ice"]),
    ("Natural Light", ["natural light", "natty light"]),
    ("Natty Daddy", ["natty daddy"]),
    ("Michelob", ["michelob ultra", "michelo ultra", "michelob"]),
    ("Miller", ["miller lite", "miller high life", "miller"]),
    ("Coors", ["coors light", "coors"]),
    ("Corona", ["corona extra", "corona premier", "corona"]),
    ("Modelo", ["modelo especial", "modelo negra", "modelo"]),
    ("Heineken", ["heineken"]),
    ("Stella Artois", ["stella artois", "stella"]),
    ("Guinness", ["guinness"]),
    ("Yuengling", ["yuengling"]),
    ("Rolling Rock", ["rolling rock"]),
    ("Colt 45", ["colt 45"]),
    ("Steel Reserve", ["steel reserve"]),
    ("Mickey's", ["mickey's", "mickeys"]),
    ("King Cobra", ["king cobra"]),
    ("Olde English", ["olde english", "oe 800"]),
    ("Hurricane", ["hurricane"]),
    ("Labatt Blue", ["labatt blue", "labatt"]),
    ("Dos Equis", ["dos equis", "xx "]),
    ("Blue Moon", ["blue moon"]),
    ("Pabst", ["pabst blue ribbon", "pabst", "pbr"]),
    ("Warity", ["warity"]),
    ("Cutwater", ["cutwater", "cut water"]),
    ("Clubtails", ["clubtails", "clubtail", "club tail"]),
    ("BuzzBallz", ["buzzballz", "buzzball"]),
    ("High Noon", ["high noon"]),
    ("Cayman Jack", ["cayman jack"]),
    ("Monaco", ["monaco"]),
    ("BeatBox", ["beatbox"]),
    ("Nutrl", ["nutrl"]),
    ("White Claw", ["white claw"]),
    ("Truly", ["truly"]),
    ("Twisted Tea", ["twisted tea"]),
    ("Simply Spiked", ["simply spiked"]),
    ("Smirnoff Ice", ["smirnoff ice"]),
    ("Mike's", ["mike's hard", "mikes hard", "mike's", "mikes"]),
    ("Seagram's Escapes", ["seagram's escapes", "seagram escapes", "seagrams escapes"]),
    ("Four Loko", ["four loko"]),
    ("Wild Irish Rose", ["wild irish rose", "richards wild irish rose"]),
    ("MD 20/20", ["md 20/20", "20/20"]),
    ("Cisco", ["cisco"]),
    ("Barefoot", ["barefoot"]),
    ("Sutter Home", ["sutter home"]),
    ("Yellow Tail", ["yellow tail"]),
    ("Woodbridge", ["woodbridge"]),
    ("Kendall-Jackson", ["kendall-jackson", "kendall jackson"]),
    ("Stella Rosa", ["stella rosa"]),
    ("Franzia", ["franzia"]),
    ("Carlo Rossi", ["carlo rossi"]),
    ("Bartenura", ["bartenura"]),
    ("Apothic", ["apothic"]),
    ("Cupcake", ["cupcake"]),
    ("Newport", ["newport"]),
    ("Marlboro", ["marlboro"]),
    ("Camel", ["camel"]),
    ("Pall Mall", ["pall mall"]),
    ("Seneca", ["seneca"]),
    ("305", ["305's", "305"]),
    ("Cheyenne", ["cheyenne"]),
    ("Dutch Masters", ["dutch masters", "dutch"]),
    ("Swisher Sweets", ["swisher sweets", "swisher"]),
    ("Black & Mild", ["black & mild", "black and mild"]),
    ("Game", ["game cigar", "game "]),
    ("White Owl", ["white owl"]),
    ("Backwoods", ["backwoods"]),
    ("Cuban Rounds", ["cubanrounds", "cuban rounds"]),
    ("HQD", ["hqd"]),
    ("Kayak", ["kayak"]),
    ("Copenhagen", ["copenhagen"]),
    ("Skoal", ["skoal"]),
    ("Grizzly", ["grizzly"]),
    ("Bob Marley", ["bob marley"]),
    ("RAW", ["raw "]),
    ("Bic", ["bic "]),
    ("Coca-Cola", ["coca-cola", "coke"]),
    ("Pepsi", ["pepsi"]),
    ("Sprite", ["sprite"]),
    ("Mountain Dew", ["mountain dew", "md 16oz", "md 12 oz"]),
    ("Dr Pepper", ["dr pepper"]),
    ("Tequila Rose", ["tequila rose"]),
    ("BodyArmor", ["body armour", "bodyarmor", "body armor"]),
    ("Red Bull", ["red bull", "redbull", "redbul"]),
    ("Monster", ["monster energy", "monster"]),
    ("Arizona", ["arizona"]),
    ("Snapple", ["snapple"]),
    ("Brisk", ["brisk"]),
    ("Pure Leaf", ["pure leaf"]),
    ("Gold Peak", ["gold peak", "golden peak"]),
    ("Lipton", ["lipton"]),
    ("Topo Chico", ["topo chico"]),
    ("Canada Dry", ["canada dry"]),
    ("Deconna", ["deconna", "decana"]),
    ("Nature's Own", ["nature's own"]),
    ("Great Value", ["great value"]),
    ("Lay's", ["lay's", "lays"]),
    ("Doritos", ["doritos"]),
    ("Cheetos", ["cheetos"]),
    ("Pringles", ["pringles"]),
    ("Gatorade", ["gatorade"]),
    ("Propel", ["propel"]),
    ("Dawn", ["dawn"]),
    ("Trojan", ["trojan"])
]

def extract_brand(name, category):
    n = (name or "").lower()
    for brand_name, syns in KNOWN_BRANDS:
        for s in syns:
            if s in n:
                return brand_name
    words = (name or "").split()
    if not words:
        return "Unknown"
    if len(words) >= 2 and len(words[0]) <= 3:
        return f"{words[0]} {words[1]}"
    return words[0]

def classify_product_cat(name, old_cat, old_sub):
    n = (name or "").lower()

    # 1. Lottery
    if old_cat == "Lottery" or "lottery" in n or "lotto" in n or n.startswith("sc-") or "draw" in n or "crossword" in n or "scratch" in n:
        return "Lottery"

    # 2. RTD / Canned Cocktails / Flavored Malt Cocktails (PRIORITY OVER FRUIT/BEVERAGE)
    if any(k in n for k in [
        "cutwater", "cut water", "clubtails", "clubtail", "club tail", "buzzballz", "buzzball",
        "high noon", "cayman jack", "monaco", "beatbox", "white claw", "truly", "nutrl",
        "twisted tea", "simply spiked", "smirnoff ice", "mike's hard", "mikes hard", "mike's", "mikes",
        "seagram's escapes", "seagram escapes", "seagrams escapes", "four loko", "jack daniel can",
        "crown royal can", "seltzer", "canned cocktail", "cocktail in a can", "long drink", "tiptop", "cantina"
    ]):
        return "RTD/Seltzer"

    # 3. Tobacco & Smoking accessories
    if old_cat == "Tobacco" or any(k in n for k in [
        "cigar", "cigarette", "menthol", "305", "seneca", "camel", "dutch",
        "swisher", "black & mild", "game ", "white owl", "backwoods", "cubanrounds",
        "cuban rounds", "kayak", "copenhagen", "skoal", "grizzly", "cheyenne", "pall mall",
        "marlboro", "newport", "tobacco", "preroll", "prerolls", "hemp", "wrap", "wraps",
        "rolling paper", "bob marley", "raw ", "zig zag", "bugler", "grinder",
        "pipe", "torch", "butane", "vape", "puff", "elfbar", "hqd",
        "geek bar", "breeze", "hookah", "shisha", "charcoal", "leaf", "loose leaf",
        "fronto", "grabba", "og kusj", "kush"
    ]):
        return "Tobacco"

    # 4. Beer & Malt Beverages
    if old_cat == "Beer/RTD" or any(k in n for k in [
        "beer", "bud light", "budlight", "budweiser", "bud ", "busch", "natural ice", "natural light",
        "natty daddy", "natty ice", "natty light", "michelob", "michelo", "miller", "coors",
        "corona", "modelo", "heineken", "stella artois", "stella", "guinness", "yuengling",
        "rolling rock", "colt 45", "steel reserve", "mickey's", "mickeys", "king cobra",
        "olde english", "oe 800", "hurricane", "labatt", "dos equis", "blue moon",
        "pabst", "pbr", "warity", "icehouse", "milwaukee", "st ides", "magnum",
        "red dog", "keystone", "schlitz", "malt liquor", "ipa", "ale", "lager", "stout",
        "cider", "angry orchard", "hard cider", "pacifico", "victoria", "estrella"
    ]):
        return "Beer/Malt"

    # 4.5 Tequila Rose (Strawberry cream liqueur)
    if "tequila rose" in n:
        return "Liqueur/Cordials"

    # 5. Wine & Fortified Wines
    if old_cat == "Wine" or any(k in n for k in [
        "wine", "cabernet", "chardonnay", "merlot", "pinot", "sauvignon", "moscato",
        "champagne", "prosecco", "rose", "sangria", "sutter home", "barefoot",
        "yellow tail", "woodbridge", "kendall jackson", "kendall-jackson", "apothic",
        "bartenura", "stella rosa", "cupcake", "carlo rossi", "franzia", "boone",
        "wild irish rose", "md 20/20", "cisco", "manischewitz", "clos du bois",
        "robert mondavi", "josh cellars", "meomi", "la marca", "korbel", "andre",
        "dom perignon", "moet", "veuve", "chandon", "belaire", "luc belaire",
        "beringer", "lindemans", "black box", "bota box", "peter vella", "almaden"
    ]):
        return "Wine"

    # 6. Tequila Rose (Liqueur)
    if "tequila rose" in n:
        return "Liqueur/Cordials"

    # 6. Tequila & Mezcal
    if any(k in n for k in [
        "tequila", "don julio", "casamigos", "patron", "1800", "cuervo", "corralejo",
        "el mayor", "lunazul", "herradura", "margaritaville", "teremana", "espolon",
        "hornitos", "cazadores", "sauza", "milagro", "clase azul", "montezuma",
        "juarez", "mezcal", "reposado", "blanco", "anejo", "añejo", "silver tequila",
        "gold tequila", "tarantula", "cabo wabo", "avion", "gran centenario", "cenote",
        "two fingers", "los arango", "tres agaves", "dulce vida", "cincoro"
    ]):
        return "Tequila/Mezcal"

    # 7. Cognac & Brandy
    if any(k in n for k in [
        "cognac", "hennessy", "remy martin", "remy", "courvoisier", "martell",
        "d'usse", "dusse", "brandy", "e&j", "e & j", "paul masson", "paul massion",
        "christian brothers", "christian bro", "raynal", "coronet", "ansac", "vsop", "xo ", "vs cognac"
    ]):
        return "Cognac/Brandy"

    # 8. Whiskey / Bourbon / Scotch
    if any(k in n for k in [
        "whisky", "whiskey", "bourbon", "scotch", "fireball", "jack daniel", "jack daniels", "gentleman jack",
        "jim beam", "jimbeam", "jim bean", "crown royal", "crow royal", "jameson", "maker's mark", "makers mark", "maker's",
        "woodford", "johnnie walker", "johnny walker", "macallan", "glenfiddich",
        "glenlivet", "ballantine", "buchanan", "dewar", "chivas", "wild turkey",
        "evan williams", "bulleit", "seagram's 7", "seagrams 7", "seagram 7", "7 crown",
        "southern comfort", "canadian club", "black velvet", "rich & rare", "rich and rare",
        "kentucky gentleman", "kessler", "early times", "ten high", "windsor", "old crow",
        "old forester", "old grand dad", "knob creek", "basil hayden", "buffalo trace",
        "proper twelve", "high west", "rye", "tennessee", "irish whiskey", "single malt",
        "blended whiskey", "bourbon whiskey", "red stag", "tullamore", "bushmills",
        "powers", "monkey shoulder", "famous grouse", "j&b", "cutty sark", "laphroaig",
        "talisker", "ardbeg", "lagavulin", "balvenie", "glenmorangie"
    ]):
        return "Whiskey/Bourbon/Scotch"

    # 9. Vodka
    if any(k in n for k in [
        "vodka", "amsterdam", "newamsterdam", "tito", "smirnoff", "absolut", "grey goose", "ciroc",
        "ketel", "svedka", "three olives", "taaka", "popov", "burnett", "pinnacle",
        "crystal palace", "nikolai", "karkov", "deep eddy", "platinum 7x", "platimun 7x", "platinum",
        "skol", "skyy", "finlandia", "stoli", "belvedere", "chopin", "barton vodka",
        "fleischmann", "mccormick vodka", "polar ice", "sobieski", "reyka", "luksusowa",
        "effen", "kavka", "beluga", "russian standard"
    ]):
        return "Vodka"

    # 10. Rum
    if any(k in n for k in [
        "rum", "bacardi", "captain morgan", "capt morgan", "malibu", "kraken",
        "sailor jerry", "appleton", "mount gay", "ronrico", "castillo", "calypso rum",
        "calypso spiced", "myers", "admiral nelson", "bumbu", "brugal", "flor de cana", "cruzan",
        "goslings", "rhum", "cachaca", "spiced rum", "white rum", "dark rum",
        "coconut rum", "silver rum", "gold rum"
    ]):
        return "Rum"

    # 11. Gin
    if any(k in n for k in [
        "gin", "tanqueray", "bombay", "beefeater", "hendrick", "seagram's gin",
        "seagrams gin", "seagram gin", "gordon", "aviation", "gilbey", "barton gin",
        "booth's", "booths", "plymouth", "botanist", "empress", "monkey 47", "malfy",
        "citadelle", "ford's gin", "fords gin", "hayman"
    ]):
        return "Gin"

    # 12. Grocery / Convenience / Non-alcoholic
    if old_cat == "Grocery" or any(k in n for k in [
        "deconna", "decana", "ice cream", "sandwich 6oz", "sandwich 5oz", "cone 4oz",
        "lipton", "snapple", "brisk", "pure leaf", "gold peak", "golden peak", "peace tea",
        "topo chico", "arizona", "coke", "coca-cola", "pepsi", "sprite", "soda", "water",
        "red bull", "redbull", "redbul", "monster", "body armour", "body armor", "bodyarmor", "juice", "milk", "butterbread", "bread",
        "cheese", "peanut patch", "soup", "chip", "doritos", "cheetos", "lays",
        "candy", "snack", "gum", "lighter", "bic ", "clipper", "cup", "ice 10lb",
        "ice 7lb", "ice 5lb", "ice 16lb", "cup 16oz", "cup 32oz", "cup 44oz",
        "kola champagne", "nehi", "hawaiian punch", "grace:cock", "ginger ale",
        "canada dry", "squirt", "ocean spray", "welch", "tampico", "sunny d",
        "powerade", "gatorade", "starbucks", "bang energy", "reign", "celsius",
        "alani", "starry", "fanta", "crush", "mug root", "barq", "minute maid",
        "v8", "nestle", "fiji", "smartwater", "essentia", "deer park", "poland spring",
        "dasani", "aquafina", "core water", "propel", "twang", "hot sauce", "kitty kat",
        "royal honey", "shrip", "shrimp", "t shirt", "vneck", "5xl", "2xl", "3xl", "4xl",
        "dawn", "trojan", "condom", "mussels", "savoritz", "moon pie", "pringles",
        "strong back", "six sip", "vrox", "gman", "bc 2pk", "4pk bevrg"
    ]):
        return "Grocery/Other"

    # 13. Liqueur / Cordials (All remaining flavored cordials, schnapps, cream liqueurs, shots)
    return "Liqueur/Cordials"

if __name__ == "__main__":
    con = sqlite3.connect(':memory:')
    with open('schema.sql') as f: con.executescript(f.read())
    with open('migrate/merged.sql') as f: con.executescript(f.read())

    rows = con.execute('SELECT id, name, clean_name, category, sub_category, cost, price FROM products').fetchall()
    results = []
    cat_counts = Counter()
    brand_counts = Counter()

    for r in rows:
        pid, name, clean, cat, sub, cost, price = r
        new_cat = classify_product_cat(name, cat, sub)
        brand = extract_brand(name, new_cat)
        cat_counts[new_cat] += 1
        brand_counts[brand] += 1
        results.append((pid, name, new_cat, brand))

    print("==================================================")
    print("CATEGORIES BREAKDOWN (1,540 total products)")
    print("==================================================")
    for c, cnt in cat_counts.most_common():
        pct = (cnt / len(rows)) * 100
        print(f"  {c:<25} : {cnt:>4} items ({pct:>4.1f}%)")

    print("\n==================================================")
    print("TOP 20 BRANDS")
    print("==================================================")
    for b, cnt in brand_counts.most_common(20):
        print(f"  {b:<25} : {cnt:>3} items")

    print("\n==================================================")
    print("20 SAMPLE CLASSIFICATIONS")
    print("==================================================")
    sample_indices = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400]
    for idx in sample_indices:
        pid, name, new_cat, brand = results[idx]
        print(f"  [{new_cat:<22}] Brand: {brand:<18} | {name}")
