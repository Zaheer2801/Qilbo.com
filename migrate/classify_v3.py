import sqlite3
import re
from collections import Counter

def classify_product(name, clean_name, old_cat, old_sub):
    n = (name or "").lower()
    c = (clean_name or "").lower()
    full = f"{n} {c}"

    # 1. LOTTERY
    if old_cat == "Lottery" or "lottery" in full or "lotto" in full or n.startswith("sc-") or "scratch" in full or "crossword" in full:
        return ("Lottery", "Lottery")

    # 2. TOBACCO & SMOKING ACCESSORIES
    # Check for accessories
    if any(k in full for k in [
        "rolling paper", "raw ", "zig zag", "bugler", "grinder", "pipe", "torch", "butane",
        "clipper", "lighter", "bic ", "bic disposable", "ash tray", "ashtray", "leaf wrap",
        "fronto", "grabba", "hemp wrap", "filter tip", "loose leaf", "preroll", "pre-roll"
    ]):
        return ("Tobacco", "Accessories")

    # Check for vapes
    if any(k in full for k in ["vape", "puff", "elfbar", "hqd", "geek bar", "breeze", "disposable vape", "pod"]):
        return ("Tobacco", "Vapes")

    # Check for cigars / cigarillos
    if any(k in full for k in [
        "cigar", "black & mild", "black and mild", "swisher", "dutch master", "dutch ",
        "game cigar", "game ", "white owl", "backwoods", "cuban round", "cubanround",
        "cheyenne", "kayak", "copenhagen", "skoal", "grizzly", "dip", "snuff"
    ]):
        return ("Tobacco", "Cigars/Cigarillos")

    # Check for cigarettes
    if old_cat == "Tobacco" or any(k in full for k in [
        "cigarette", "menthol", "305's", "305 ", "seneca", "camel", "marlboro", "newport",
        "pall mall", "winston", "maverick", "l&m", "kool", "basic"
    ]):
        return ("Tobacco", "Cigarettes")

    # 3. BEER & RTD
    # RTD / Canned Cocktails / Seltzers
    if any(k in full for k in [
        "cutwater", "cut water", "clubtails", "clubtail", "buzzballz", "buzzball",
        "high noon", "cayman jack", "monaco", "beatbox", "white claw", "truly", "nutrl",
        "twisted tea", "simply spiked", "smirnoff ice", "mike's hard", "mikes hard", "mike's", "mikes",
        "seagram's escapes", "seagram escapes", "seagrams escapes", "four loko", "seltzer",
        "crown royal can", "jack daniel can", "canned cocktail", "long drink", "cantina"
    ]):
        return ("Beer & RTD", "RTD/Seltzer")

    # Beer / Malt
    if any(k in full for k in [
        "beer", "bud light", "budlight", "budweiser", "bud ", "busch", "natural ice", "natural light",
        "natty daddy", "natty ice", "natty light", "michelob", "michelo", "miller", "coors",
        "corona", "modelo", "heineken", "stella artois", "stella", "guinness", "yuengling",
        "rolling rock", "colt 45", "steel reserve", "mickey's", "mickeys", "king cobra",
        "olde english", "oe 800", "hurricane", "labatt", "dos equis", "blue moon",
        "pabst", "pbr", "warity", "icehouse", "milwaukee", "st ides", "magnum",
        "red dog", "keystone", "schlitz", "malt liquor", "ipa", "ale", "lager", "stout",
        "cider", "angry orchard", "hard cider", "pacifico", "victoria", "estrella"
    ]):
        return ("Beer & RTD", "Beer")

    # 4. WINE
    if old_cat == "Wine" or any(k in full for k in [
        "wine", "cabernet", "chardonnay", "merlot", "pinot", "sauvignon", "moscato",
        "champagne", "prosecco", "rose", "sangria", "sutter home", "barefoot",
        "yellow tail", "woodbridge", "kendall jackson", "kendall-jackson", "apothic",
        "bartenura", "stella rosa", "cupcake", "carlo rossi", "franzia", "boone",
        "wild irish rose", "md 20/20", "cisco", "manischewitz", "clos du bois",
        "robert mondavi", "josh cellars", "meomi", "la marca", "korbel", "andre",
        "dom perignon", "moet", "veuve", "chandon", "belaire", "luc belaire",
        "beringer", "lindemans", "black box", "bota box", "peter vella", "almaden"
    ]):
        return ("Wine", "Wine")

    # 5. SPIRITS - Specific Subcategories
    # Vodka
    if any(k in full for k in [
        "vodka", "amsterdam", "newamsterdam", "newamstersam", "tito", "smirnoff", "absolut",
        "grey goose", "ciroc", "ketel", "svedka", "three olives", "taaka", "popov", "burnett",
        "pinnacle", "crystal palace", "nikolai", "karkov", "deep eddy", "platinum 7x",
        "platimun 7x", "platinum", "skol", "skyy", "finlandia", "stoli", "belvedere", "chopin",
        "barton vodka", "fleischmann", "mccormick vodka", "polar ice", "sobieski", "reyka"
    ]):
        return ("Spirits", "Vodka")

    # Tequila / Mezcal
    if any(k in full for k in [
        "tequila", "don julio", "casamigos", "patron", "1800", "cuervo", "corralejo",
        "el mayor", "lunazul", "herradura", "margaritaville", "teremana", "espolon",
        "hornitos", "cazadores", "sauza", "milagro", "clase azul", "montezuma",
        "juarez", "mezcal", "reposado", "blanco", "anejo", "añejo", "silver tequila",
        "gold tequila", "tarantula", "cabo wabo", "cincoro", "margarita gold", "au"
    ]):
        return ("Spirits", "Tequila/Mezcal")

    # Whiskey / Bourbon / Scotch (Include Crown Royal bottles!)
    if any(k in full for k in [
        "whisky", "whiskey", "bourbon", "scotch", "fireball", "jack daniel", "jack daniels", "gentleman jack",
        "jim beam", "jimbeam", "jim bean", "crown royal", "crow royal", "crown royale", "jameson", "maker's mark", "makers mark",
        "woodford", "johnnie walker", "johnny walker", "macallan", "glenfiddich",
        "glenlivet", "ballantine", "buchanan", "dewar", "chivas", "wild turkey",
        "evan williams", "bulleit", "seagram's 7", "seagrams 7", "seagram 7", "7 crown",
        "southern comfort", "canadian club", "black velvet", "rich & rare", "rich and rare",
        "kentucky gentleman", "kessler", "early times", "ten high", "windsor", "old crow",
        "old forester", "knob creek", "basil hayden", "buffalo trace", "proper twelve",
        "high west", "rye", "tennessee", "irish whiskey", "single malt"
    ]):
        return ("Spirits", "Whiskey")

    # Cognac / Brandy
    if any(k in full for k in [
        "cognac", "hennessy", "remy martin", "remy", "courvoisier", "martell",
        "d'usse", "dusse", "brandy", "e&j", "e & j", "paul masson", "paul massion",
        "christian brothers", "christian bro", "raynal", "coronet", "ansac", "vsop", "xo ", "vs cognac"
    ]):
        return ("Spirits", "Cognac/Brandy")

    # Rum
    if any(k in full for k in [
        "rum", "bacardi", "captain morgan", "capt morgan", "malibu", "kraken",
        "sailor jerry", "appleton", "mount gay", "ronrico", "castillo", "calypso rum",
        "calypso spiced", "myers", "admiral nelson", "bumbu", "brugal", "flor de cana", "cruzan"
    ]):
        return ("Spirits", "Rum")

    # Gin
    if any(k in full for k in [
        "gin", "tanqueray", "bombay", "beefeater", "hendrick", "seagram's gin",
        "seagrams gin", "seagram gin", "gordon", "aviation", "gilbey", "barton gin"
    ]):
        return ("Spirits", "Gin")

    # Liqueur (Genuine liqueurs & cordials ONLY)
    if any(k in full for k in [
        "baileys", "bailey's", "kahlua", "jagermeister", "jager", "grand marnier",
        "cointreau", "disaronno", "dekuyper", "arrow", "hiram walker", "hpnotiq",
        "hypnotiq", "rumchata", "sambuca", "midori", "chambord", "campari", "aperol",
        "tequila rose", "schnapps", "triple sec", "amaretto", "creme de", "cordial",
        "curacao", "anisette", "drambuie", "frangelico", "ouzo", "benjamin banana",
        "99 brand", "99 bananas", "99 pink", "99 sour", "99 proof", "99 root", "99 apples",
        "99 peaches", "99 blackberries", "99 cherries", "99 grapes", "99 watermelons",
        "99 butterscotch", "99 whipped", "99 pineapple", "99 strawberry", "99 orange",
        "99 mango", "99 long", "99 sourberry", "99 mystery", "99 cinnamon", "99 party", "99 shooter"
    ]):
        return ("Spirits", "Liqueur")

    # 6. DRINKS & MIXERS (color: indigo)
    if any(k in full for k in [
        "coca-cola", "coca cola", "coke", "pepsi", "sprite", "mountain dew", "md 16oz", "md 12 oz", "dr pepper",
        "fanta", "crush", "ginger ale", "canada dry", "squirt", "starry", "7up", "kola champagne",
        "nehi", "root beer", "mug root", "barq", "red bull", "redbull", "redbul", "monster energy",
        "monster", "celsius", "bang energy", "reign", "alani", "bodyarmor", "body armor", "body armour",
        "gatorade", "powerade", "propel", "poland spring", "deer park", "dasani", "aquafina",
        "fiji", "smartwater", "essentia", "core water", "pure leaf", "gold peak", "golden peak",
        "arizona", "lipton", "snapple", "brisk", "peace tea", "ocean spray", "welch", "tampico",
        "sunny d", "juice", "lemonade", "punch", "margarita mix", "bloody mary", "zing zang",
        "grenadine", "tonic", "club soda", "mixer", "sweet & sour", "sour mix", "bar syrup",
        "aloe strawberry", "orange carrot", "splash mango", "4pk bevrg", "six sip", " water "
    ]) or full.endswith(" water") or " water " in full or "spring water" in full or "drinking water" in full:
        return ("Drinks & Mixers", "Drinks & Mixers")

    # 7. SNACKS & GROCERY (color: lime)
    if any(k in full for k in [
        "ice cream", "deconna", "decana", "sandwich 6oz", "sandwich 5oz", "cone 4oz",
        "chip", "doritos", "cheetos", "lays", "lay's", "pringles", "ruffles", "fritos",
        "candy", "snack", "gum", "snickers", "reese", "m&m", "skittles", "hershey",
        "cup 16oz", "cup 32oz", "cup 44oz", "cups", "ice 5lb", "ice 7lb", "ice 10lb", "ice 16lb",
        "bread", "butterbread", "milk", "cheese", "french fries", "great value", "salt 26 oz",
        "ketchup", "hunts", "honeybun", "purina", "dog food", "trojan", "condom", "dawn",
        "t shirt", "tshirt", "vneck", "5xl", "4xl", "3xl", "2xl", "mussels", "shrimp",
        "bluerhino", "rhino", "royal honey", "strong back", "hot sauce", "bc 2pk"
    ]):
        return ("Snacks & Grocery", "Snacks & Grocery")

    # 8. Unmatched Liquor / Spirits -> "Other Spirits – review"
    # If it was in Liquor department, or has spirit keywords/sizes
    return ("Spirits", "Other Spirits – review")
