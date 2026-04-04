/**
 * CJA — Translation Edit Feedback Endpoint
 * 
 * Google Apps Script web app that receives POST requests from
 * the editable module on caprilaria.netlify.app and appends
 * edit data as rows in the bound Google Sheet.
 * 
 * DEPLOYMENT:
 *   1. Open the Google Sheet: CJA — Translation Edit Feedback
 *   2. Extensions > Apps Script
 *   3. Replace the default code with this file's contents
 *   4. Click Deploy > New deployment
 *   5. Type: Web app
 *   6. Execute as: Me
 *   7. Who has access: Anyone
 *   8. Click Deploy and authorize when prompted
 *   9. Copy the Web app URL — this goes into editable.js
 */

/**
 * Handle POST requests from the editable module.
 * Expects JSON body with: lang, key, before, after, url, userAgent
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
      new Date().toISOString(),           // Timestamp (server-side for consistency)
      data.lang || '',                     // Language code
      data.key || '',                      // Element key (data-editable value)
      data.before || '',                   // Original text
      data.after || '',                    // User's edited text
      data.url || '',                      // Page URL
      data.userAgent || ''                 // User agent string
    ]);
    
    // Return success response with CORS headers
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
