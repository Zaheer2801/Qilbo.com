"""
Gmail Scraper for NRS Daily Sales Reports
Connects to Gmail via IMAP over SSL using an App Password.
Searches for emails from no-reply@nrsplus.com, parses the subject date,
and downloads the attached daily sales CSV.
"""

import os
import re
import email
import imaplib
from email.header import decode_header
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any


DOWNLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "downloads")


def parse_email_metadata_from_subject(subject: str) -> Dict[str, Optional[str]]:
    """
    Extracts date string, store name, and store ID from subject lines like:
    'Daily Sales Report Oct 19, 2026 for Discount Liquor (87287)'
    'Daily Sales Report July 01, 2026 for Discount Liquor (83954)'
    """
    # 1. Extract Store ID and Store Name
    store_name = "Discount Liquor"
    store_id = None
    store_pattern = r'for\s+(.*?)\s*\(([\w\d]+)\)'
    store_match = re.search(store_pattern, subject, re.IGNORECASE)
    if store_match:
        store_name = store_match.group(1).strip()
        store_id = store_match.group(2).strip()

    # 2. Extract Date
    report_date = None
    month_name_pattern = r'([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})'
    match = re.search(month_name_pattern, subject)
    if match:
        month_str, day_str, year_str = match.groups()
        try:
            parsed = datetime.strptime(f"{month_str[:3]} {day_str} {year_str}", "%b %d %Y")
            report_date = parsed.strftime("%Y-%m-%d")
        except ValueError:
            pass

    if not report_date:
        numeric_pattern = r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})'
        match = re.search(numeric_pattern, subject)
        if match:
            m, d, y = match.groups()
            try:
                parsed = datetime.strptime(f"{m}-{d}-{y}", "%m-%d-%Y")
                report_date = parsed.strftime("%Y-%m-%d")
            except ValueError:
                pass

    return {
        "report_date": report_date or datetime.now().strftime("%Y-%m-%d"),
        "store_name": store_name,
        "store_id": store_id or "default"
    }


def parse_date_from_subject(subject: str) -> Optional[str]:
    meta = parse_email_metadata_from_subject(subject)
    return meta["report_date"]


class GmailNRSFetcher:
    def __init__(self, email_address: str, app_password: str, host: str = "imap.gmail.com", port: int = 993):
        self.email_address = email_address
        self.app_password = app_password.replace(" ", "")  # Clean up spaces from Google App Password
        self.host = host
        self.port = port
        self.imap = None

    def connect(self):
        """Connects and logs in to Gmail."""
        self.imap = imaplib.IMAP4_SSL(self.host, self.port)
        self.imap.login(self.email_address, self.app_password)
        self.imap.select("INBOX")

    def disconnect(self):
        """Logs out safely."""
        if self.imap:
            try:
                self.imap.close()
            except Exception:
                pass
            try:
                self.imap.logout()
            except Exception:
                pass

    def search_nrs_emails(self, search_criteria: str = '(FROM "no-reply@nrsplus.com")') -> List[str]:
        """Searches for NRS report emails."""
        if not self.imap:
            self.connect()
        
        status, messages = self.imap.search(None, search_criteria)
        if status != "OK":
            return []
        
        msg_ids = messages[0].split()
        return [m.decode() for m in msg_ids]

    def download_report(self, msg_id: str, dest_dir: str = DOWNLOADS_DIR) -> Optional[Dict[str, Any]]:
        """
        Fetches an email by ID, locates the CSV attachment, and saves it.
        Returns metadata dict with report_date, filename, filepath, and content.
        """
        if not self.imap:
            self.connect()

        os.makedirs(dest_dir, exist_ok=True)
        status, data = self.imap.fetch(msg_id, "(RFC822)")
        if status != "OK" or not data or not data[0]:
            return None

        raw_email = data[0][1]
        msg = email.message_from_bytes(raw_email)

        # Decode Subject
        subject_header = msg.get("Subject", "")
        decoded_subject = ""
        for part, encoding in decode_header(subject_header):
            if isinstance(part, bytes):
                decoded_subject += part.decode(encoding or "utf-8", errors="replace")
            else:
                decoded_subject += str(part)

        meta = parse_email_metadata_from_subject(decoded_subject)
        report_date = meta["report_date"]
        store_name = meta["store_name"]
        store_id = meta["store_id"]

        safe_filename = f"nrs_sales_{store_id}_{report_date}.csv"
        save_path = os.path.join(dest_dir, safe_filename)

        # Cache check: if already downloaded, return existing file
        if os.path.exists(save_path) and os.path.getsize(save_path) > 100:
            try:
                with open(save_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                return {
                    "msg_id": msg_id,
                    "subject": decoded_subject,
                    "report_date": report_date,
                    "store_name": store_name,
                    "store_id": store_id,
                    "filename": safe_filename,
                    "filepath": save_path,
                    "raw_content": content
                }
            except Exception:
                pass

        # Walk parts to find CSV attachment
        for part in msg.walk():
            content_disposition = str(part.get("Content-Disposition", ""))
            content_type = part.get_content_type()
            filename = part.get_filename()

            if filename:
                for dec_name, enc in decode_header(filename):
                    if isinstance(dec_name, bytes):
                        filename = dec_name.decode(enc or "utf-8", errors="replace")
                    else:
                        filename = str(dec_name)

            is_csv = (
                (filename and filename.lower().endswith(".csv")) or
                content_type in ["text/csv", "application/csv", "application/vnd.ms-excel"]
            )

            if is_csv:
                payload = part.get_payload(decode=True)
                if not payload:
                    continue

                safe_filename = f"nrs_sales_{store_id}_{report_date}.csv"
                save_path = os.path.join(dest_dir, safe_filename)

                with open(save_path, "wb") as f:
                    f.write(payload)

                return {
                    "msg_id": msg_id,
                    "subject": decoded_subject,
                    "report_date": report_date,
                    "store_name": store_name,
                    "store_id": store_id,
                    "filename": safe_filename,
                    "filepath": save_path,
                    "raw_content": payload.decode("utf-8", errors="replace")
                }

        return None

    def fetch_all_historical_reports(self, dest_dir: str = DOWNLOADS_DIR, store_filter: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Scans all matching emails and downloads all CSV attachments.
        Caches already downloaded files by filename to avoid re-downloading.
        """
        msg_ids = self.search_nrs_emails('(SUBJECT "Daily Sales Report")')
        results = []
        os.makedirs(dest_dir, exist_ok=True)

        print(f"📥 Found {len(msg_ids)} Daily Sales Report emails in inbox. Processing...")

        for idx, mid in enumerate(msg_ids):
            try:
                rep = self.download_report(mid, dest_dir=dest_dir)
                if not rep:
                    continue

                if store_filter and rep["store_id"] not in store_filter:
                    continue

                results.append(rep)
                print(f"  [{idx+1}/{len(msg_ids)}] Downloaded: {rep['store_name']} ({rep['store_id']}) - {rep['report_date']}")
            except Exception as e:
                print(f"  [{idx+1}/{len(msg_ids)}] Error processing email {mid}: {e}")

        return results

    def fetch_latest_daily_reports(self, limit: int = 5, dest_dir: str = DOWNLOADS_DIR) -> List[Dict[str, Any]]:
        """
        Finds and downloads recent NRS sales reports (to handle multiple stores on the same day).
        Returns a list of downloaded report dicts.
        """
        msg_ids = self.search_nrs_emails('(SUBJECT "Daily Sales Report")')
        if not msg_ids:
            msg_ids = self.search_nrs_emails()

        if not msg_ids:
            return []

        # Take the most recent 'limit' emails
        recent_ids = msg_ids[-limit:] if len(msg_ids) > limit else msg_ids
        downloaded = []
        os.makedirs(dest_dir, exist_ok=True)

        for mid in reversed(recent_ids):
            try:
                rep = self.download_report(mid, dest_dir=dest_dir)
                if rep:
                    downloaded.append(rep)
            except Exception as e:
                print(f"Error downloading report for message {mid}: {e}")

        return downloaded

    def fetch_latest_daily_report(self, dest_dir: str = DOWNLOADS_DIR) -> Optional[Dict[str, Any]]:
        """Finds and downloads the single most recent NRS sales report."""
        reports = self.fetch_latest_daily_reports(limit=1, dest_dir=dest_dir)
        return reports[0] if reports else None
