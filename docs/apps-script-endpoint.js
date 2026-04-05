/**
 * CJA — Translation Edit Feedback Endpoint
 * 
 * Google Apps Script web app that receives POST requests from
 * the editable module on caprilaria.netlify.app and appends
 * edit data as rows in the bound Google Sheet.
 * 
 * SHEET COLUMNS (in order):
 *   A: Timestamp    — server-side ISO 8601 timestamp
 *   B: Language     — language code (en, es, pt, fr, ja, ko, id, zh)
 *   C: Key          — element key (data-editable value)
 *   D: Before       — original text
 *   E: After        — user's edited text
 *   F: URL          — page URL path
 *   G: User Agent   — browser user agent string
 *   H: Flags        — comma-separated spam/troll flags (empty = clean)
 *                      Possible values: PROFANITY, GIBBERISH,
 *                      LENGTH_LONG, LENGTH_SHORT, LINK_INJECT,
 *                      RATE_FLOOD, DUPLICATE
 * 
 * TIP: To filter flagged edits in the sheet, add a filter on
 *      column H and exclude rows where Flags is not empty.
 * 
 * DEPLOYMENT:
 *   1. Open the Google Sheet: CJA — Translation Edit Feedback
 *   2. Extensions > Apps Script
 *   3. Replace the default code with this file's contents
 *   4. Click Deploy > Manage deployments > Edit (pencil icon)
 *   5. Set version to "New version"
 *   6. Click Deploy
 *   7. The existing URL stays the same — no need to update editable.js
 * 
 * FIRST-TIME SETUP (if no deployment exists yet):
 *   1. Click Deploy > New deployment
 *   2. Type: Web app
 *   3. Execute as: Me
 *   4. Who has access: Anyone
 *   5. Click Deploy and authorize when prompted
 *   6. Copy the Web app URL — this goes into editable.js as REMOTE_ENDPOINT
 */

/**
 * Handle POST requests from the editable module.
 * Expects JSON body with: lang, key, before, after, url, userAgent, flags
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Edits');
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    }
    
    // Append the edit as a new row
    sheet.appendRow([
      new Date().toISOString(),           // A: Timestamp (server-side)
      data.lang || '',                     // B: Language code
      data.key || '',                      // C: Element key
      data.before || '',                   // D: Original text
      data.after || '',                    // E: User's edited text
      data.url || '',                      // F: Page URL
      data.userAgent || '',                // G: User agent string
      data.flags || ''                     // H: Spam/troll flags
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for testing the endpoint is live).
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: 'ok', 
      message: 'CJA Translation Edit Feedback endpoint is active.' 
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
