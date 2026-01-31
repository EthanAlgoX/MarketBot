---
name: docusign
description: Send documents for electronic signature via DocuSign API. Create envelopes, track signing status, and download signed documents.
metadata: {"clawdbot":{"emoji":"✍️","requires":{"env":["DOCUSIGN_ACCESS_TOKEN","DOCUSIGN_ACCOUNT_ID"]}}}
---

# DocuSign

Electronic signatures.

## Environment

```bash
export DOCUSIGN_ACCESS_TOKEN="xxxxxxxxxx"
export DOCUSIGN_ACCOUNT_ID="xxxxxxxxxx"
export DOCUSIGN_BASE="https://demo.docusign.net/restapi"  # Use na1.docusign.net for prod
```

## Send Document for Signature

```bash
curl -X POST "$DOCUSIGN_BASE/v2.1/accounts/$DOCUSIGN_ACCOUNT_ID/envelopes" \
  -H "Authorization: Bearer $DOCUSIGN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "emailSubject": "Please sign this document",
    "documents": [{
      "documentBase64": "'$(base64 -w0 document.pdf)'",
      "name": "Contract.pdf",
      "documentId": "1"
    }],
    "recipients": {
      "signers": [{
        "email": "signer@example.com",
        "name": "John Doe",
        "recipientId": "1",
        "tabs": {"signHereTabs": [{"documentId": "1", "pageNumber": "1", "xPosition": "100", "yPosition": "700"}]}
      }]
    },
    "status": "sent"
  }'
```

## List Envelopes

```bash
curl "$DOCUSIGN_BASE/v2.1/accounts/$DOCUSIGN_ACCOUNT_ID/envelopes?from_date=2024-01-01" \
  -H "Authorization: Bearer $DOCUSIGN_ACCESS_TOKEN"
```

## Get Envelope Status

```bash
curl "$DOCUSIGN_BASE/v2.1/accounts/$DOCUSIGN_ACCOUNT_ID/envelopes/{envelope_id}" \
  -H "Authorization: Bearer $DOCUSIGN_ACCESS_TOKEN"
```

## Download Signed Document

```bash
curl "$DOCUSIGN_BASE/v2.1/accounts/$DOCUSIGN_ACCOUNT_ID/envelopes/{envelope_id}/documents/combined" \
  -H "Authorization: Bearer $DOCUSIGN_ACCESS_TOKEN" \
  -o signed_document.pdf
```

## Links
- Console: https://apps.docusign.com
- Docs: https://developers.docusign.com
