# eBay Trading API Skill

Create, manage, and research eBay listings for trading cards and collectibles.

## When to Use

Use this skill when:
- Creating eBay listings from photos or item descriptions
- Looking up sold prices (comps) for pricing decisions
- Managing existing listings (revise, end)
- Building photo-to-listing automation workflows

## Quick Start

### Create a Listing
```bash
cd ~/clawd/ebay && python3 trading_api.py --create
```

### Verify Without Listing (Dry Run)
```bash
cd ~/clawd/ebay && python3 trading_api.py
```

### Check Sold Comps
```bash
cd ~/clawd/ebay && python3 comps.py "2024 Topps Chrome Mike Trout"
```

## API Calls Available

| Call | Purpose | Script |
|------|---------|--------|
| `AddItem` | Create new listing | `trading_api.py` |
| `VerifyAddItem` | Validate without listing | `trading_api.py` |
| `ReviseItem` | Edit existing listing | `revise.py` (TODO) |
| `EndItem` | End/delete listing | `end.py` (TODO) |
| `GetItem` | Fetch listing details | `get_item.py` (TODO) |
| `findCompletedItems` | Sold price research | `comps.py` ✅ |

## Card Conditions

### Ungraded Cards (Condition ID: 4000)
| Condition | Descriptor ID |
|-----------|---------------|
| Near Mint or Better | 400010 |
| Excellent | 400011 |
| Very Good | 400012 |
| Poor | 400013 |

### Graded Cards (Condition ID: 2750)
Supported graders: PSA, BGS, SGC, CGC, CSG, BVG, BCCG, KSA, GMA, HGA

Grades: 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, Authentic

## Configuration

### Required Environment Variables
Set in `~/.env.ebay` or export directly:

```bash
EBAY_DEV_ID=your-dev-id
EBAY_APP_ID=your-app-id  
EBAY_CERT_ID=your-cert-id
```

### OAuth Tokens
Stored in `~/clawd/ebay/.tokens.json` (auto-managed):
```json
{
  "access_token": "v^1.1#i^1#...",
  "refresh_token": "v^1.1#i^1#...",
  "expires_at": 1706644800
}
```

Run `oauth_setup.py` to initialize tokens, or `refresh_token.py` to refresh expired tokens.

## Usage Examples

### Python: Create Sports Card Listing
```python
from trading_api import load_credentials, create_sports_card_listing

creds = load_credentials()

card_info = {
    "title": "2024 Topps Chrome Mike Trout #1 Refractor",
    "player": "Mike Trout",
    "year": "2024",
    "set_name": "Topps Chrome",
    "card_number": "1",
    "parallel": "Refractor",
    "sport": "Baseball",
    "manufacturer": "Topps",
    "condition": "Near Mint or Better",
    "graded": False
}

item_id = create_sports_card_listing(creds, card_info, price="29.99")
print(f"Listed: https://www.ebay.com/itm/{item_id}")
```

### Python: Graded Card
```python
card_info = {
    "title": "2020 Panini Prizm LaMelo Ball RC PSA 10",
    "player": "LaMelo Ball",
    "year": "2020",
    "set_name": "Panini Prizm",
    "card_number": "278",
    "sport": "Basketball",
    "manufacturer": "Panini",
    "graded": True,
    "grader": "PSA",
    "grade": "10",
    "cert_number": "12345678"
}

item_id = create_sports_card_listing(creds, card_info, price="199.99")
```

## Rate Limits

| API | Daily Limit | Reset Time |
|-----|-------------|------------|
| Trading API | 5,000 calls | Midnight PT |
| Finding API | 5,000 calls | Midnight PT |

**Best practices:**
- Use `VerifyAddItem` for testing (counts toward limit)
- Implement exponential backoff on 503 errors
- Cache comp results to reduce Finding API calls

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Auth token is hard expired` | Access token expired (2hr) | Run `oauth_setup.py` |
| `Invalid refresh token` | Refresh token expired (18mo) | Full OAuth re-auth via `oauth_setup.py` |
| `exceeded the number of times` | eBay rate limited | Wait 1hr or check eBay developer dashboard |
| `Invalid App ID` | Wrong credentials | Check `.env.ebay` has `EBAY_PROD_APP_ID` |
| `Category not found` | Bad category ID | Use category names: `basketball`, `baseball` |
| `Missing item specifics` | Required fields empty | Add player, year, set, card_number |
| `No items found` | Too specific query | Broaden search terms |
| `Connection timeout` | eBay API slow | Retry in 30 seconds |
| `503 Service Unavailable` | API overloaded | Wait and retry with backoff |

## Security Notes

### 🔑 Token Management
- Tokens stored in `.tokens.json` — **ensure 600 permissions**: `chmod 600 .tokens.json`
- Access tokens expire after 2 hours (auto-refresh via refresh_token)
- Refresh tokens expire after 18 months — calendar reminder recommended
- If refresh fails, re-run `oauth_setup.py` to re-authenticate

### 🔒 Credential Safety
- Never commit `.tokens.json` or `.env.ebay` to git
- Add to `.gitignore`: `.tokens.json`, `.env.ebay`, `*.log`
- Use environment variables, not hardcoded values
- Rotate tokens immediately if exposed
- API credentials (Dev/App/Cert IDs) are **not** secret but treat as private

### ✅ Input Validation
- All user input is HTML-escaped via `html.escape()` before API calls
- Titles limited to 80 characters (eBay max)
- Description wrapped in CDATA to prevent XML injection
- Card numbers, grades sanitized to alphanumeric

### 📋 Audit Trail
- Failed listings logged to `~/clawd/ebay/errors.log`
- Successful listings logged with ItemID, timestamp, and price
- Keep logs for 90 days minimum (eBay dispute window)

### 🛡️ API Response Handling
- Never log full API responses (may contain PII)
- Mask ItemIDs in non-debug logs: `1234***789`
- Sanitize error messages before displaying to users
- Strip buyer/seller info from any logged responses

## Sandbox vs Production

Toggle with `sandbox` parameter:
```python
# Sandbox (testing)
response = call_trading_api(creds, "AddItem", xml, sandbox=True)

# Production (real listings)
response = call_trading_api(creds, "AddItem", xml, sandbox=False)
```

Sandbox URL: `https://api.sandbox.ebay.com/ws/api.dll`
Production URL: `https://api.ebay.com/ws/api.dll`

## File Structure

```
~/clawd/ebay/
├── .env.ebay          # API credentials (gitignored)
├── .tokens.json       # OAuth tokens (gitignored)
├── trading_api.py     # Core Trading API wrapper
├── description_template.py  # HTML listing templates
├── oauth_setup.py     # Initial OAuth flow
├── exchange_token.py  # Token refresh
├── create_listing.py  # Inventory API approach
└── pending.json       # Pending listings queue
```

## TODO

- [x] `comps.py` — findCompletedItems wrapper for price research ✅
- [ ] `revise.py` — ReviseItem for editing listings
- [ ] `end.py` — EndItem for ending listings
- [ ] `upload.py` — eBay Picture Services integration
- [ ] Rate limiting with exponential backoff
- [ ] Structured error logging

## Known Limitations

### Rate Limits
- **Finding API:** ~5,000 calls/day (may be lower for new apps)
- **Trading API:** ~5,000 calls/day
- If rate limited, `comps.py` returns `fallback: true` — use manual pricing
- Limits reset at midnight Pacific Time
- New apps may have stricter burst limits initially

### Token Expiry
- **Access tokens** expire after ~2 hours (auto-refreshed)
- **Refresh tokens** last 18 months — set a calendar reminder!
- If refresh fails, re-run `oauth_setup.py` to re-authenticate

### Finding API Requires Production Credentials
The Finding API (`findCompletedItems`) does **not** have a sandbox environment. You must use production eBay credentials to look up sold prices. Add `EBAY_PROD_APP_ID` to your `.env.ebay` file.

## References

- [eBay Trading API Docs](https://developer.ebay.com/Devzone/XML/docs/Reference/eBay/index.html)
- [AddItem Call Reference](https://developer.ebay.com/Devzone/XML/docs/Reference/eBay/AddItem.html)
- [Finding API (Comps)](https://developer.ebay.com/Devzone/finding/Concepts/FindingAPIGuide.html)
- [Condition Descriptors](https://developer.ebay.com/devzone/finding/callref/Enums/conditionIdList.html)

---

*Skill created by Clawd 🐾 & Electron 🦞 for Text2List.app*
