"""
Batch Fetcher: Scrapes all historical NRS Daily Sales Reports from Gmail
for Discount Liquor (87287) and Discount Liquor (83954).
"""

import os
import sys
import json
from datetime import datetime

from nrs_pipeline.gmail_scraper import GmailNRSFetcher
from nrs_pipeline.gdrive_uploader import GoogleDriveArchiver
from nrs_pipeline.parser import parse_nrs_csv
from nrs_pipeline.db import init_db, ingest_parsed_report, export_qilbo_app_state


def batch_fetch_all_reports(store_filter=None, max_reports=None):
    print("=" * 65)
    print("🚀 NRS BATCH INGESTION: ALL HISTORICAL EMAILS FROM GMAIL")
    print("=" * 65)

    init_db()

    # Load credentials
    env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

    gmail_user = os.environ.get("GMAIL_USER")
    gmail_pass = os.environ.get("GMAIL_APP_PASSWORD")

    if not gmail_user or not gmail_pass:
        print("❌ GMAIL_USER and GMAIL_APP_PASSWORD must be configured in .env")
        return

    print(f"📧 Connecting to Gmail ({gmail_user})...")
    fetcher = GmailNRSFetcher(gmail_user, gmail_pass)
    archiver = GoogleDriveArchiver()

    try:
        fetcher.connect()
        # Search all emails matching Daily Sales Report
        msg_ids = fetcher.search_nrs_emails('(SUBJECT "Daily Sales Report")')
        print(f"✅ Found {len(msg_ids)} total Daily Sales Report emails.")

        if max_reports:
            msg_ids = msg_ids[-max_reports:]
            print(f"Limiting to latest {max_reports} reports as requested.")

        downloads_dir = os.path.join(os.path.dirname(__file__), "..", "downloads")
        os.makedirs(downloads_dir, exist_ok=True)

        successful_reports = 0
        total_items_ingested = 0
        total_revenue_ingested = 0.0

        for idx, mid in enumerate(msg_ids):
            try:
                rep = fetcher.download_report(mid, dest_dir=downloads_dir)
                if not rep:
                    continue

                store_id = rep.get("store_id", "87287")
                store_name = rep.get("store_name", "Discount Liquor")
                report_date = rep.get("report_date")

                if store_filter and store_id not in store_filter:
                    continue

                # 1. Archive to Google Drive
                archiver.upload_file(rep["filepath"])

                # 2. Parse CSV lines
                parsed = parse_nrs_csv(rep["filepath"], report_date=report_date)

                # 3. Ingest into Database
                ingest_parsed_report(
                    parsed,
                    raw_filename=rep["filename"],
                    store_id=store_id,
                    store_name=store_name
                )

                successful_reports += 1
                total_items_ingested += parsed.total_items_sold
                total_revenue_ingested += parsed.total_revenue

                print(
                    f"[{idx+1}/{len(msg_ids)}] Ingested: {store_name} ({store_id}) | "
                    f"Date: {report_date} | {len(parsed.items)} SKUs | "
                    f"{parsed.total_items_sold} units | ${parsed.total_revenue:.2f}"
                )

            except Exception as e:
                print(f"[{idx+1}/{len(msg_ids)}] Error on email {mid}: {e}")

        print("\n" + "=" * 65)
        print("🎉 ALL REPORTS INGESTION COMPLETE")
        print("=" * 65)
        print(f"Reports successfully ingested: {successful_reports}")
        print(f"Total units sold recorded: {total_items_ingested}")
        print(f"Total sales volume recorded: ${total_revenue_ingested:.2f}")

        # Export live state for Qilbo frontend
        export_path = os.path.join(
            os.path.dirname(__file__), "..", "qilbo-app", "src", "data", "live_inventory.json"
        )
        live_state = export_qilbo_app_state()
        with open(export_path, "w", encoding="utf-8") as f:
            json.dump(live_state, f, indent=2)

        print(f"🔄 Exported {len(live_state['sales'])} sales records to Qilbo live dashboard!")

    finally:
        fetcher.disconnect()


if __name__ == "__main__":
    # Ingest all reports across both stores 87287 and 83954
    batch_fetch_all_reports()
