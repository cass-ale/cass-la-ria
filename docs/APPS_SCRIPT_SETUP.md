# Apps Script Endpoint — Setup Guide

This guide walks you through deploying the Google Apps Script web app that receives translation edit feedback from the site and logs it to the Google Sheet.

**Time required:** ~2 minutes

---

## Step 1: Open the Script Editor

1. Open the Google Sheet: [CJA — Translation Edit Feedback](https://docs.google.com/spreadsheets/d/1dtYb5b_2DNpFJnZf23rfnQAJWVnE9hwnHLjZTn4XvT8/edit)
2. Click **Extensions** in the menu bar
3. Click **Apps Script**

This opens the Apps Script editor in a new tab, with a blank `Code.gs` file.

## Step 2: Paste the Code

1. **Select all** the default code in `Code.gs` and **delete** it
2. Copy the entire contents of [`apps-script-endpoint.js`](apps-script-endpoint.js)
3. **Paste** it into the editor
4. Press **Ctrl+S** (or Cmd+S) to save

## Step 3: Deploy as a Web App

1. Click the blue **Deploy** button (top right)
2. Select **New deployment**
3. Click the gear icon next to "Select type" and choose **Web app**
4. Fill in the settings:
   - **Description:** `Translation edit feedback v1`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
5. Click **Deploy**
6. Google will ask you to **authorize** the script — click through the prompts:
   - Click "Review permissions"
   - Select your Google account
   - If you see "Google hasn't verified this app," click "Advanced" then "Go to CJA (unsafe)"
   - Click "Allow"
7. **Copy the Web app URL** that appears — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

## Step 4: Share the URL

Send me the Web app URL and I will:

1. Add it to `editable.js` so the module sends edits to the sheet
2. Test the full pipeline end-to-end
3. Push the update to the live site

---

## Verification

After deployment, you can test the endpoint by visiting the Web app URL in your browser. You should see:

```json
{"status":"ok","message":"CJA Translation Edit Feedback endpoint is active."}
```

## Security Notes

The endpoint only accepts POST requests with a specific JSON structure. It does not expose any data from the sheet — it only appends rows. The "Anyone" access setting means the endpoint URL itself acts as the authentication token. As long as the URL is only embedded in the site's JavaScript (not shared publicly), access is effectively restricted to site visitors.

If you ever need to revoke access, go to the Apps Script editor, click **Deploy > Manage deployments**, and either archive or delete the deployment.
