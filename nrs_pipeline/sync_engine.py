"""
NRS Sync Engine - Master Orchestration
Fetches daily reports from Gmail, archives them to Google Drive,
parses sales data into SQLite/Postgres DB, and updates Qilbo inventory.
"""

import os
import sys
import argparse
from datetime import datetime
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Lightweight fallback .env loader without requiring external python-dotenv
    env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

from nrs_pipeline.parser import parse_nrs_csv
from nrs_pipeline.db import (
    init_db,
    ingest_parsed_report,
    get_top_shelf_report,
    get_reorder_recommendations,
    export_qilbo_app_state,
    DEFAULT_DB_PATH
)
from nrs_pipeline.gmail_scraper import GmailNRSFetcher
from nrs_pipeline.gdrive_uploader import GoogleDriveArchiver


# Load environment variables


def run_pipeline(
    file_path: str = None,
    from_gmail: bool = False,
    report_date: str = None,
    export_json_path: str = None
):
    print("=" * 60)
    print("🚀 Qilbo NRS Daily Pipeline Ingestion Starting")
    print("=" * 60)

    init_db()

    target_file = file_path
    date_str = report_date

    # 1. Fetch from Gmail if requested
    reports_to_process = []
    if from_gmail:
        gmail_user = os.getenv("GMAIL_USER")
        gmail_pass = os.getenv("GMAIL_APP_PASSWORD")

        if not gmail_user or not gmail_pass:
            print("❌ GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env to fetch from Gmail.")
            return False

        print(f"📧 Connecting to Gmail ({gmail_user})...")
        fetcher = GmailNRSFetcher(gmail_user, gmail_pass)
        try:
            # Check latest 6 emails to catch all stores for today
            downloads = fetcher.fetch_latest_daily_reports(limit=6)
            if not downloads:
                print("ℹ️ No new NRS sales reports found in Gmail.")
                return False

            reports_to_process = downloads
            print(f"✅ Found {len(downloads)} recent report(s) from Gmail to ingest.")
        finally:
            fetcher.disconnect()
    elif target_file:
        reports_to_process = [{
            "filepath": target_file,
            "report_date": date_str,
            "filename": os.path.basename(target_file)
        }]

    if not reports_to_process:
        print(f"❌ No valid report file to process.")
        return False

    archiver = GoogleDriveArchiver()
    last_date = date_str

    for rep in reports_to_process:
        current_file = rep["filepath"]
        current_date = rep.get("report_date") or date_str
        last_date = current_date
        print(f"\n--- Processing {os.path.basename(current_file)} ({current_date}) ---")

        # Archive to Google Drive
        archive_result = archiver.upload_file(current_file)
        print(f"☁️ Google Drive Archive: {archive_result.get('status')} ({archive_result.get('mode')})")

        # Parse CSV lines
        parsed = parse_nrs_csv(current_file, report_date=current_date)
        print(f"📊 Items parsed: {len(parsed.items)} SKUs | Sold: {parsed.total_items_sold} units | Rev: ${parsed.total_revenue:.2f}")

        # Ingest into Database
        ingest_parsed_report(
            parsed,
            raw_filename=os.path.basename(current_file),
            gdrive_file_id=archive_result.get("file_id", "")
        )
    print("✅ Database updated successfully!")

    # 5. Export for Qilbo frontend
    if not export_json_path:
        export_json_path = os.path.join(
            os.path.dirname(__file__), "..", "qilbo-app", "src", "data", "live_inventory.json"
        )
    
    os.makedirs(os.path.dirname(export_json_path), exist_ok=True)
    import json
    qilbo_state = export_qilbo_app_state()
    with open(export_json_path, "w", encoding="utf-8") as f:
        json.dump(qilbo_state, f, indent=2)
    print(f"🔄 Exported live state to Qilbo: {export_json_path}")

    # 6. Display Executive Summary
    display_summary(date_str)
    return True


def display_summary(report_date: str = None):
    print("\n" + "=" * 60)
    print("🏆 TODAY'S TOP SHELF SALES & LIVE STOCK MONITOR")
    print("=" * 60)

    top_items = get_top_shelf_report(report_date)
    if not top_items:
        print("No top shelf sales recorded.")
    else:
        for item in top_items:
            stock = item["qty_on_hand"]
            stock_badge = "🟢" if stock > item["reorder_point"] else "🔴 LOW"
            print(
                f"{stock_badge} [{item['category']}] {item['product_name']} ({item['size']})\n"
                f"   Sold: {item['qty_sold']} @ ${item['unit_price']:.2f} | Revenue: ${item['total_amount']:.2f} | "
                f"Current Stock: {stock} units ({item.get('days_of_inventory', 'N/A')} days remaining)"
            )

    print("\n" + "-" * 60)
    print("⚠️ PROCUREMENT ALERTS (At or Below Reorder Point)")
    print("-" * 60)
    reorders = get_reorder_recommendations()
    if not reorders:
        print("All items currently have healthy stock.")
    else:
        for r in reorders[:10]:
            ts = "⭐ [TOP SHELF]" if r["is_top_shelf"] else ""
            print(
                f"🚨 {ts} {r['product_name']} ({r['size']}): Stock={r['qty_on_hand']} | "
                f"Reorder Point={r['reorder_point']} -> Suggested Order: {r['suggested_reorder_qty']} units"
            )
    print("=" * 60 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Qilbo NRS Ingestion Pipeline")
    parser.add_argument("--file", help="Path to local NRS CSV file")
    parser.add_argument("--fetch-gmail", action="store_true", help="Fetch latest report from Gmail")
    parser.add_argument("--date", help="Report date (YYYY-MM-DD)")
    parser.add_argument("--summary", action="store_true", help="Display top shelf summary only")

    args = parser.parse_args()

    if args.summary:
        display_summary(args.date)
    else:
        default_file = args.file or "Sample Data/nrs_sample_report_2026-10-19.csv"
        run_pipeline(
            file_path=default_file if not args.fetch_gmail else None,
            from_gmail=args.fetch_gmail,
            report_date=args.date or "2026-10-19"
        )
