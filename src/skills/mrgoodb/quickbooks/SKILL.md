---
name: quickbooks
description: Manage QuickBooks Online accounting - invoices, customers, payments, and reports via Intuit API.
metadata: {"clawdbot":{"emoji":"💰","requires":{"env":["QUICKBOOKS_ACCESS_TOKEN","QUICKBOOKS_REALM_ID"]}}}
---

# QuickBooks Online

Small business accounting.

## Environment

```bash
export QUICKBOOKS_ACCESS_TOKEN="xxxxxxxxxx"
export QUICKBOOKS_REALM_ID="123456789"  # Company ID
export QB_BASE="https://quickbooks.api.intuit.com/v3/company"
```

## List Customers

```bash
curl "$QB_BASE/$QUICKBOOKS_REALM_ID/query?query=select * from Customer" \
  -H "Authorization: Bearer $QUICKBOOKS_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

## Create Invoice

```bash
curl -X POST "$QB_BASE/$QUICKBOOKS_REALM_ID/invoice" \
  -H "Authorization: Bearer $QUICKBOOKS_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "CustomerRef": {"value": "1"},
    "Line": [{
      "Amount": 100.00,
      "DetailType": "SalesItemLineDetail",
      "SalesItemLineDetail": {"ItemRef": {"value": "1"}}
    }]
  }'
```

## List Invoices

```bash
curl "$QB_BASE/$QUICKBOOKS_REALM_ID/query?query=select * from Invoice" \
  -H "Authorization: Bearer $QUICKBOOKS_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

## Get Company Info

```bash
curl "$QB_BASE/$QUICKBOOKS_REALM_ID/companyinfo/$QUICKBOOKS_REALM_ID" \
  -H "Authorization: Bearer $QUICKBOOKS_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

## Create Payment

```bash
curl -X POST "$QB_BASE/$QUICKBOOKS_REALM_ID/payment" \
  -H "Authorization: Bearer $QUICKBOOKS_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "CustomerRef": {"value": "1"},
    "TotalAmt": 100.00,
    "Line": [{"Amount": 100.00, "LinkedTxn": [{"TxnId": "123", "TxnType": "Invoice"}]}]
  }'
```

## Links
- Dashboard: https://quickbooks.intuit.com
- Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account
