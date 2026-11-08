"""
Google Drive Uploader for NRS Daily Reports
Supports:
1. Google Drive API (via Service Account credentials.json or OAuth)
2. Local Google Drive folder sync fallback
"""

import os
import shutil
from datetime import datetime
from typing import Optional, Dict, Any


class GoogleDriveArchiver:
    def __init__(self, credentials_path: Optional[str] = None, local_sync_folder: Optional[str] = None, folder_id: Optional[str] = None):
        self.credentials_path = credentials_path or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        self.local_sync_folder = local_sync_folder or os.getenv("GDRIVE_LOCAL_SYNC_PATH")
        self.folder_id = folder_id or os.getenv("GDRIVE_FOLDER_ID")
        self.service = None

    def upload_file(self, local_file_path: str, remote_filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Uploads or copies the report file to Google Drive.
        """
        if not os.path.exists(local_file_path):
            raise FileNotFoundError(f"Local report file not found: {local_file_path}")

        filename = remote_filename or os.path.basename(local_file_path)

        # Mode 1: Local desktop Google Drive sync folder
        if self.local_sync_folder and os.path.exists(self.local_sync_folder):
            target_dir = os.path.join(self.local_sync_folder, "Qilbo_NRS_Reports")
            os.makedirs(target_dir, exist_ok=True)
            dest_path = os.path.join(target_dir, filename)
            shutil.copy2(local_file_path, dest_path)
            return {
                "status": "success",
                "mode": "local_sync",
                "destination": dest_path,
                "file_id": filename
            }

        # Mode 2: Google Drive API (if credentials provided)
        if self.credentials_path and os.path.exists(self.credentials_path):
            try:
                from googleapiclient.discovery import build
                from googleapiclient.http import MediaFileUpload
                from google.oauth2 import service_account

                creds = service_account.Credentials.from_service_account_file(
                    self.credentials_path,
                    scopes=['https://www.googleapis.com/auth/drive.file']
                )
                service = build('drive', 'v3', credentials=creds)

                file_metadata = {'name': filename}
                if self.folder_id:
                    file_metadata['parents'] = [self.folder_id]

                media = MediaFileUpload(local_file_path, mimetype='text/csv', resumable=True)
                uploaded = service.files().create(body=file_metadata, media_body=media, fields='id, name, webViewLink').execute()

                return {
                    "status": "success",
                    "mode": "api",
                    "file_id": uploaded.get('id'),
                    "webViewLink": uploaded.get('webViewLink')
                }
            except Exception as e:
                return {
                    "status": "error",
                    "mode": "api",
                    "error": str(e)
                }

        # Mode 3: Local Staging / Cloud Archive ready
        archive_dir = os.path.join(os.path.dirname(__file__), "..", "google_drive_archive")
        os.makedirs(archive_dir, exist_ok=True)
        dest_path = os.path.join(archive_dir, filename)
        shutil.copy2(local_file_path, dest_path)
        return {
            "status": "staged_locally",
            "mode": "staging",
            "destination": dest_path,
            "message": "Saved to google_drive_archive directory. Add credentials.json or GDRIVE_LOCAL_SYNC_PATH to sync directly."
        }
