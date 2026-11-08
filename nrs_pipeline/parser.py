"""
NRS (National Retail Solutions) Daily Sales Report Parser
Extracts line items, calculates unit prices, detects top-shelf spirits,
and handles department summaries.
"""

import csv
import re
from dataclasses import dataclass, asdict
from typing import List, Optional, Tuple, Dict, Any


# Keywords indicating premium / top-shelf spirits or high-value items
TOP_SHELF_KEYWORDS = [
    "cognac", "hennessy", "remy martin", "courvoisier", "martell",
    "tequila", "don julio", "patron", "corralejo", "casamigos", "clase azul",
    "el mayor", "lunazul", "herradura", "1800",
    "scotch", "whisky", "whiskey", "bourbon", "macallan", "glenfiddich",
    "woodford", "johnnie walker", "crown royal", "makers mark", "jim beam",
    "grey goose", "ciroc", "belvedere", "chopin"
]

# Price threshold where any 375ml+ or 750ml bottle above this amount is top-shelf
TOP_SHELF_PRICE_THRESHOLD = 18.00


@dataclass
class NRSSaleItem:
    upc: str
    raw_name: str
    clean_name: str
    size: str
    qty_sold: int
    total_amount: float
    unit_price: float
    is_top_shelf: bool
    department: str
    sub_category: str


@dataclass
class NRSSummaryItem:
    department: str
    qty_sold: int
    total_amount: float


@dataclass
class ParsedNRSReport:
    report_date: Optional[str]
    store_name: Optional[str]
    store_id: Optional[str]
    items: List[NRSSaleItem]
    department_summaries: List[NRSSummaryItem]
    total_items_sold: int
    total_revenue: float
    top_shelf_revenue: float
    top_shelf_units: int
    department_breakdown: Dict[str, Dict[str, Any]]


def extract_size_and_clean_name(name: str) -> Tuple[str, str]:
    """
    Extracts package size (e.g., '750ml', '50ml', '6-pack', '24 oz') from the name.
    """
    size_pattern = r'(\b\d+(?:\.\d+)?\s*(?:ml|lt|l|oz|fl\s*oz|ct|pk|pack)\b|\b\d+[- ](?:pack|pk)\b)'
    matches = list(re.finditer(size_pattern, name, re.IGNORECASE))
    if matches:
        last_match = matches[-1]
        size = last_match.group(0).strip()
        clean = name[:last_match.start()] + name[last_match.end():]
        clean = re.sub(r'\s+', ' ', clean).strip(" ,-:")
        return clean or name, size
    return name, "unit"


def classify_product(name: str, unit_price: float) -> Tuple[str, str]:
    """
    Classifies a product into Department and granular Sub-Category:
    Departments: Liquor, Beer, Tobacco, Beverages, Wine, Lottery, General Merchandise
    Liquor Sub-Categories: Whiskey & Bourbon, Tequila, Cognac & Brandy, Vodka, Rum, Gin, Cutwaters & RTD, Cordials & Shooters
    """
    lower = name.lower()

    # 1. Ready-to-Drink Cocktails / Cutwaters
    if any(k in lower for k in ["cutwater", "cut water", "clubtails", "buzzballz", "high noon", "cayman jack", "monaco", "beatbox", "tiki rum", "white russian"]):
        return "Liquor", "Cutwaters & Ready-to-Drink"

    # 2. Tequila
    if any(k in lower for k in ["tequila", "don julio", "patron", "corralejo", "casamigos", "el mayor", "lunazul", "margaritaville", "cuervo", "herradura", "1800", "reposado", "blanco", "anejo", "añejo"]):
        return "Liquor", "Tequila"

    # 3. Cognac & Brandy
    if any(k in lower for k in ["cognac", "hennessy", "remy martin", "courvoisier", "martell", "brandy", "e&j", "paul masson"]):
        return "Liquor", "Cognac & Brandy"

    # 4. Whiskey & Bourbon
    if any(k in lower for k in ["whisky", "whiskey", "bourbon", "scotch", "fireball", "jim beam", "crown royal", "jack daniel", "makers mark", "woodford", "jameson"]):
        return "Liquor", "Whiskey & Bourbon"

    # 5. Vodka
    if any(k in lower for k in ["vodka", "amsterdam", "crystal palace", "tito", "grey goose", "ciroc", "smirnoff", "absolut", "ketel"]):
        return "Liquor", "Vodka"

    # 6. Rum
    if any(k in lower for k in ["rum", "bacardi", "captain morgan", "malibu"]):
        return "Liquor", "Rum"

    # 7. Gin
    if any(k in lower for k in ["gin", "tanqueray", "bombay", "beefeater", "hendrick"]):
        return "Liquor", "Gin"

    # 8. Cordials, Shooters, & 99s
    if any(k in lower for k in ["99 ", "99 pink", "99 sour", "99 proof", "schnapps", "baileys", "kahlua", "jagermeister", "benjamin banana"]):
        return "Liquor", "Cordials & Shooters"

    # 9. Beer & Malt Beverages
    if any(k in lower for k in ["beer", "bud", "busch", "modelo", "corona", "heineken", "miller", "rolling rock", "natural ice", "colt 45", "chelada", "twisted tea", "warity"]):
        return "Beer", "Beer & Malt"

    # 10. Tobacco & Cigars
    if any(k in lower for k in ["cigar", "cigarette", "menthol", "305", "seneca", "camel", "dutch masters", "tobacco", "newport", "marlboro"]):
        return "Tobacco", "Tobacco & Cigars"

    # 11. Beverages (Non-Alcoholic)
    if any(k in lower for k in ["soda", "cola", "tea", "water", "pepsi", "coca", "fanta", "red bull", "powerade", "welch", "sunkist", "ginger beer", "alani", "saratoga", "lipton"]):
        return "Beverages", "Non-Alcoholic"

    # 12. Wine & Sangria
    if any(k in lower for k in ["wine", "sangria", "crimes", "rossi", "chardonnay", "cabernet", "moscato", "san antonio"]):
        return "Wine", "Wine & Sangria"

    # 13. Lottery / Scratchers
    if any(k in lower for k in ["lottery", "scratch", "cash", "blowout", "bingo", "power 20", "black pearls", "lucky buks", "wild 9s", "100 x", "spectaculer"]):
        return "Lottery", "Scratch-Off"

    # Fallback
    if unit_price >= 12.00:
        return "Liquor", "Other Spirits"
    return "General Merchandise", "General"


def is_top_shelf_item(name: str, department: str, sub_category: str, unit_price: float) -> bool:
    """
    Flags premium items:
    1. Bottles over $25
    2. Cognac, Tequila, Whiskey over $15
    3. Explicit top shelf spirit keywords
    """
    lower = name.lower()
    if unit_price >= 25.00:
        return True
    
    if department == "Liquor" and sub_category in ["Cognac & Brandy", "Tequila", "Whiskey & Bourbon"] and unit_price >= TOP_SHELF_PRICE_THRESHOLD:
        return True
        
    for kw in TOP_SHELF_KEYWORDS:
        if kw in lower and unit_price >= 14.00:
            return True
            
    return False


def parse_nrs_csv(file_path_or_content: str, is_content: bool = False, report_date: Optional[str] = None) -> ParsedNRSReport:
    """
    Parses an NRS Daily Sales Report CSV file.
    Extracts item rows, departments, sub-categories, and summary rows.
    """
    if is_content:
        lines = file_path_or_content.strip().splitlines()
    else:
        with open(file_path_or_content, 'r', encoding='utf-8', errors='replace') as f:
            lines = [line.strip() for line in f if line.strip()]

    reader = csv.reader(lines)
    header = next(reader, None)

    items: List[NRSSaleItem] = []
    summaries: List[NRSSummaryItem] = []

    for row in reader:
        if not row or len(row) < 4:
            continue
        
        upc_raw, name_raw, qty_raw, amt_raw = row[0].strip(), row[1].strip(), row[2].strip(), row[3].strip()

        try:
            qty = int(float(qty_raw))
        except ValueError:
            qty = 0

        try:
            total_amt = round(float(amt_raw), 2)
        except ValueError:
            total_amt = 0.0

        # Department summary rows have blank UPC
        if not upc_raw:
            summaries.append(NRSSummaryItem(department=name_raw, qty_sold=qty, total_amount=total_amt))
            continue

        unit_price = round(total_amt / qty, 2) if qty > 0 else 0.0
        clean_name, size = extract_size_and_clean_name(name_raw)
        dept, sub_cat = classify_product(name_raw, unit_price)
        top_shelf = is_top_shelf_item(name_raw, dept, sub_cat, unit_price)

        items.append(
            NRSSaleItem(
                upc=upc_raw,
                raw_name=name_raw,
                clean_name=clean_name,
                size=size,
                qty_sold=qty,
                total_amount=total_amt,
                unit_price=unit_price,
                is_top_shelf=top_shelf,
                department=dept,
                sub_category=sub_cat
            )
        )

    total_items = sum(i.qty_sold for i in items)
    total_rev = round(sum(i.total_amount for i in items), 2)
    top_shelf_items = [i for i in items if i.is_top_shelf]
    top_shelf_rev = round(sum(i.total_amount for i in top_shelf_items), 2)
    top_shelf_qty = sum(i.qty_sold for i in top_shelf_items)

    # Compute department & sub-category totals
    breakdown: Dict[str, Dict[str, Any]] = {}
    for it in items:
        if it.department not in breakdown:
            breakdown[it.department] = {
                "units": 0,
                "revenue": 0.0,
                "sub_categories": {}
            }
        breakdown[it.department]["units"] += it.qty_sold
        breakdown[it.department]["revenue"] = round(breakdown[it.department]["revenue"] + it.total_amount, 2)

        sub_map = breakdown[it.department]["sub_categories"]
        if it.sub_category not in sub_map:
            sub_map[it.sub_category] = {"units": 0, "revenue": 0.0}
        sub_map[it.sub_category]["units"] += it.qty_sold
        sub_map[it.sub_category]["revenue"] = round(sub_map[it.sub_category]["revenue"] + it.total_amount, 2)

    return ParsedNRSReport(
        report_date=report_date,
        store_name=None,
        store_id=None,
        items=items,
        department_summaries=summaries,
        total_items_sold=total_items,
        total_revenue=total_rev,
        top_shelf_revenue=top_shelf_rev,
        top_shelf_units=top_shelf_qty,
        department_breakdown=breakdown
    )


if __name__ == "__main__":
    import sys
    test_file = sys.argv[1] if len(sys.argv) > 1 else "Sample Data/nrs_sample_report_2026-10-19.csv"
    report = parse_nrs_csv(test_file, report_date="2026-10-19")
    print(f"--- NRS Daily Sales Report: {report.report_date} ---")
    print(f"Total Line Items: {len(report.items)}")
    print(f"Total Units Sold: {report.total_items_sold}")
    print(f"Total Revenue: ${report.total_revenue:.2f}")
    print(f"Top-Shelf Units: {report.top_shelf_units}")
    print(f"Top-Shelf Revenue: ${report.top_shelf_revenue:.2f}")
    print("\nTop Shelf Highlights:")
    for item in [i for i in report.items if i.is_top_shelf]:
        print(f"  ⭐ [{item.category}] {item.clean_name} ({item.size}) - {item.qty_sold} sold @ ${item.unit_price:.2f} = ${item.total_amount:.2f}")
    print("\nDepartment Summaries:")
    for s in report.department_summaries:
        print(f"  📁 {s.department}: {s.qty_sold} units, ${s.total_amount:.2f}")
