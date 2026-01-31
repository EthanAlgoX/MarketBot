---
name: google-sheets
description: Read and write Google Sheets data. Create spreadsheets, update cells, and manage worksheets via Sheets API.
metadata: {"clawdbot":{"emoji":"📊","requires":{"env":["GOOGLE_ACCESS_TOKEN"]}}}
---

# Google Sheets

Spreadsheet automation.

## Environment

```bash
export GOOGLE_ACCESS_TOKEN="ya29.xxxxxxxxxx"
```

## Read Sheet Data

```bash
curl "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/Sheet1!A1:D10" \
  -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN"
```

## Write to Cells

```bash
curl -X PUT "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/Sheet1!A1:B2?valueInputOption=USER_ENTERED" \
  -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"values": [["Name", "Score"], ["Alice", 95]]}'
```

## Append Rows

```bash
curl -X POST "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/Sheet1!A:D:append?valueInputOption=USER_ENTERED" \
  -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"values": [["New", "Row", "Data", "Here"]]}'
```

## Create Spreadsheet

```bash
curl -X POST "https://sheets.googleapis.com/v4/spreadsheets" \
  -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"properties": {"title": "My New Sheet"}}'
```

## Get Spreadsheet Metadata

```bash
curl "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}" \
  -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN"
```

## Clear Range

```bash
curl -X POST "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/Sheet1!A1:Z100:clear" \
  -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN"
```

## Links
- Console: https://console.cloud.google.com/apis/library/sheets.googleapis.com
- Docs: https://developers.google.com/sheets/api/reference/rest
