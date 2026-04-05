# Apps Script Endpoint — Setup Guide

This guide walks you through deploying (or updating) the Google Apps Script web app that receives translation edit feedback from the site and logs it to the Google Sheet.

**Time required:** ~2 minutes

---

## Sheet Columns

The endpoint writes one row per edit with these columns:

| Column | Header | Description |
|---|---|---|
| A | Timestamp | Server-side ISO 8601 timestamp |
| B | Language | Language code (en, es, pt, fr, ja, ko, id, zh) |
| C | Key | Element key (`data-editable` value) |
| D | Before | Original text |
| E | After | User's edited text |
| F | URL | Page URL path |
| G | User Agent | Browser user agent string |
| H | Flags | Comma-separated spam/troll flags (empty = clean) |

### Spam Flag Values

| Flag | Meaning |
|---|---|
| `PROFANITY` | Edit contains profanity or spam keywords |
| `GIBBERISH` | >60% non-letter characters (keyboard mashing) |
| `LENGTH_LONG` | Edit is >5x the original text length |
| `LENGTH_SHORT` | Edit is <0.1x the original text length |
| `LINK_INJECT` | Edit contains a URL (http://, https://, www.) |
| `RATE_FLOOD` | User submitted >10 edits in 5 minutes |
| `DUPLICATE` | Identical text already submitted for this key+lang |

**Tip:** Add a filter on column H in the sheet. Filter for non-empty values to review flagged edits, or exclude non-empty values to see only clean edits.

---

## First-Time Setup

### Step 1: Open the Script Editor

1. Open the Google Sheet: [CJA — Translation Edit Feedback](https://docs.google.com/spreadsheets/d/1dtYb5b_2DNpFJnZf23rfnQAJWVnE9hwnHLjZTn4XvT8/edit)
2. Click **Extensions** in the menu bar
3. Click **Apps Script**

This opens the Apps Script editor in a new tab, with a blank `Code.gs` file.

### Step 2: Paste the Code

1. **Select all** the default code in `Code.gs` and **delete** it
2. Copy the entire contents of [`apps-script-endpoint.js`](apps-script-endpoint.js)
3. **Paste** it into the editor
4. Press **Ctrl+S** (or Cmd+S) to save

### Step 3: Deploy as a Web App

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

### Step 4: Wire Up the URL

Add the Web app URL to `js/editable.js` as the `REMOTE_ENDPOINT` constant (line 71).

---

## Updating an Existing Deployment

When the endpoint code changes (e.g., new columns added), you need to publish a new version:

1. Open the Apps Script editor (Extensions > Apps Script)
2. Replace the code in `Code.gs` with the latest [`apps-script-endpoint.js`](apps-script-endpoint.js)
3. Press **Ctrl+S** to save
4. Click **Deploy** > **Manage deployments**
5. Click the **pencil icon** (Edit) on the active deployment
6. Set **Version** to **New version**
7. Click **Deploy**

The URL stays the same — no changes needed in `editable.js`.

---

## Verification

After deployment, visit the Web app URL in your browser. You should see:

```json
{"status":"ok","message":"CJA Translation Edit Feedback endpoint is active."}
```

## Security Notes

The endpoint only accepts POST requests with a specific JSON structure. It does not expose any data from the sheet — it only appends rows. The "Anyone" access setting means the endpoint URL itself acts as the authentication token. As long as the URL is only embedded in the site's JavaScript (not shared publicly), access is effectively restricted to site visitors.

If you ever need to revoke access, go to the Apps Script editor, click **Deploy > Manage deployments**, and either archive or delete the deployment.
