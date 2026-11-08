/**
 * ==============================================================================
 * QILBO AUTOMATED DAILY SALES REPORT -> GOOGLE DRIVE SYNC
 * ==============================================================================
 * Target Google Drive Folder: Discount_Liquors_2026 > Daily_reports
 * Folder ID: 1gAbnMOPg6v42wzxWrzB57a-4-m8Igpwm
 * Folder URL: https://drive.google.com/drive/folders/1gAbnMOPg6v42wzxWrzB57a-4-m8Igpwm
 *
 * HOW IT WORKS:
 * 1. Runs 100% in the cloud inside your Google account (script.google.com).
 * 2. Does NOT require your computer to be turned on or running anything.
 * 3. Every morning at 8:30 AM, it checks Gmail for new NRS Daily Sales Reports.
 * 4. Extracts the CSV attachment and saves it directly to your Google Drive folder.
 * 5. Prevents duplicate uploads by tracking existing filenames.
 * ==============================================================================
 */

// Target Google Drive Folder ID provided by user
const GDRIVE_FOLDER_ID = "1gAbnMOPg6v42wzxWrzB57a-4-m8Igpwm";

/**
 * 1. DAILY AUTOMATION FUNCTION (Runs every morning at 8:30 AM)
 * Fetches today's incoming NRS reports and pushes them to your Google Drive.
 */
function autoSyncDailySalesReports() {
  Logger.log("🚀 Starting Daily NRS Sales Report Cloud Sync...");
  
  const folder = DriveApp.getFolderById(GDRIVE_FOLDER_ID);
  if (!folder) {
    throw new Error("Could not find Google Drive Folder with ID: " + GDRIVE_FOLDER_ID);
  }
  
  // Search for recent Daily Sales Report emails from NRS
  const query = 'from:no-reply@nrsplus.com subject:"Daily Sales Report" has:attachment newer_than:2d';
  const threads = GmailApp.search(query, 0, 15);
  
  Logger.log(`Found ${threads.length} recent thread(s) matching query: "${query}"`);
  
  // Pre-fetch existing file names in Drive folder to avoid duplicate uploads
  const existingFiles = getExistingFilenames(folder);
  let uploadedCount = 0;
  
  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];
      const subject = message.getSubject();
      const attachments = message.getAttachments();
      
      for (let k = 0; k < attachments.length; k++) {
        const attachment = attachments[k];
        const originalName = attachment.getName();
        
        if (originalName.toLowerCase().endsWith(".csv") || attachment.getContentType() === "text/csv") {
          // Format a clean, unique filename based on subject and store ID
          const cleanName = formatCleanFilename(subject, originalName);
          
          if (existingFiles.has(cleanName) || existingFiles.has(originalName)) {
            Logger.log(`⏭️ File already exists in Drive: "${cleanName}" - Skipping.`);
            continue;
          }
          
          // Create file in the target Google Drive folder
          const file = folder.createFile(attachment.copyBlob().setName(cleanName));
          Logger.log(`✅ Uploaded to Google Drive: "${cleanName}" (ID: ${file.getId()})`);
          existingFiles.add(cleanName);
          uploadedCount++;
        }
      }
    }
  }
  
  Logger.log(`🎉 Daily sync finished! ${uploadedCount} new report(s) pushed to Google Drive.`);
}

/**
 * 2. ONE-TIME HISTORICAL BACKFILL FUNCTION
 * Scans your entire Gmail inbox from July onwards and pushes all 114+ historical
 * NRS reports into your Google Drive folder in one go!
 */
function backfillAllHistoricalReports() {
  Logger.log("📦 Starting Complete Historical Backfill to Google Drive...");
  
  const folder = DriveApp.getFolderById(GDRIVE_FOLDER_ID);
  const existingFiles = getExistingFilenames(folder);
  
  // Search all NRS Daily Sales Report emails
  const query = 'from:no-reply@nrsplus.com subject:"Daily Sales Report" has:attachment';
  let startIndex = 0;
  const pageSize = 50;
  let totalUploaded = 0;
  
  while (true) {
    const threads = GmailApp.search(query, startIndex, pageSize);
    if (!threads || threads.length === 0) break;
    
    Logger.log(`Processing threads ${startIndex} to ${startIndex + threads.length}...`);
    
    for (let i = 0; i < threads.length; i++) {
      const messages = threads[i].getMessages();
      for (let j = 0; j < messages.length; j++) {
        const message = messages[j];
        const subject = message.getSubject();
        const attachments = message.getAttachments();
        
        for (let k = 0; k < attachments.length; k++) {
          const attachment = attachments[k];
          const originalName = attachment.getName();
          
          if (originalName.toLowerCase().endsWith(".csv") || attachment.getContentType() === "text/csv") {
            const cleanName = formatCleanFilename(subject, originalName);
            
            if (existingFiles.has(cleanName) || existingFiles.has(originalName)) {
              continue;
            }
            
            folder.createFile(attachment.copyBlob().setName(cleanName));
            existingFiles.add(cleanName);
            totalUploaded++;
            Logger.log(`[${totalUploaded}] Pushed to Drive: ${cleanName}`);
          }
        }
      }
    }
    
    startIndex += pageSize;
    if (threads.length < pageSize) break;
  }
  
  Logger.log(`🎉 Backfill complete! Successfully uploaded ${totalUploaded} historical reports to Google Drive.`);
}

/**
 * 3. ONE-CLICK 8:30 AM DAILY CLOUD TRIGGER SETUP
 * Run this function once in the Google Apps Script editor.
 * It registers an automated daily trigger that fires every morning at 8:30 AM forever!
 */
function setupDaily830AmTrigger() {
  // Clear any old triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "autoSyncDailySalesReports") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Create the new daily trigger at 8:30 AM
  ScriptApp.newTrigger("autoSyncDailySalesReports")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .nearMinute(30)
    .create();
    
  Logger.log("✅ 8:30 AM Daily Cloud Trigger successfully registered!");
  Logger.log("The cloud algorithm will now execute automatically every morning at 8:30 AM.");
}

/**
 * Helper: Helper to read existing filenames in the Drive folder
 */
function getExistingFilenames(folder) {
  const filenames = new Set();
  const files = folder.getFiles();
  while (files.hasNext()) {
    filenames.add(files.next().getName());
  }
  return filenames;
}

/**
 * Helper: Formats a standardized, human-readable filename
 * E.g. "Daily_Sales_Report_87287_2026-10-19.csv"
 */
function formatCleanFilename(subject, fallbackName) {
  // Extract store id: e.g. "(87287)" or "(83954)"
  let storeId = "Store";
  const storeMatch = subject.match(/\((\d{5,6})\)/);
  if (storeMatch) {
    storeId = storeMatch[1];
  }
  
  // Extract date: e.g. "Oct 19, 2026" or "July 01, 2026"
  const dateMatch = subject.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (dateMatch) {
    const monthStr = dateMatch[1].slice(0, 3).toLowerCase();
    const dayStr = ("0" + dateMatch[2]).slice(-2);
    const yearStr = dateMatch[3];
    
    const months = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const mm = months[monthStr] || "00";
    return `Daily_Sales_Report_${storeId}_${yearStr}-${mm}-${dayStr}.csv`;
  }
  
  return fallbackName;
}
