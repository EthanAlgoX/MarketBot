---
name: domain-checker
description: Check domain name availability across multiple TLDs. Fast bulk checking for domain research and brainstorming.
metadata: {"clawdbot":{"emoji":"🌐"}}
---

# Domain Checker

Check if domains are available for registration.

## Quick Check (WHOIS)

```bash
# Single domain
whois example.com 2>/dev/null | grep -iE "no match|not found|available|no data found" && echo "✅ AVAILABLE" || echo "❌ TAKEN"

# Multiple TLDs at once
for tld in com ai io co net; do
  result=$(whois "myname.$tld" 2>/dev/null | grep -iE "no match|not found|available|no data found|^No " | head -1)
  if [ -n "$result" ]; then
    echo "✅ myname.$tld - AVAILABLE"
  else
    echo "❌ myname.$tld - taken"
  fi
done
```

## Bulk Check Function

```bash
check_domains() {
  local name="$1"
  shift
  local tlds="${@:-com ai io co net org}"
  
  echo "Checking: $name"
  echo "---"
  for tld in $tlds; do
    domain="${name}.${tld}"
    # Use timeout to avoid hanging on slow WHOIS servers
    result=$(timeout 5 whois "$domain" 2>/dev/null | grep -iE "no match|not found|available|no data found|^No |status: free" | head -1)
    if [ -n "$result" ]; then
      echo "✅ $domain"
    else
      echo "❌ $domain"
    fi
  done
}

# Usage
check_domains "asklee" com ai io co bot
check_domains "myproject" com net org io
```

## Brainstorm + Check Pattern

When helping with domain research:

1. Generate 10-20 name ideas
2. Bulk check availability:
```bash
for name in idea1 idea2 idea3 brandname coolbot; do
  check_domains "$name" com ai io
  echo ""
done
```

## TLD-Specific WHOIS Quirks

| TLD | Available indicator |
|-----|---------------------|
| .com, .net, .org | "No match for" |
| .io | "is available" or "NOT FOUND" |
| .ai | "NOT FOUND" or "No Data Found" |
| .co | "No Data Found" |
| .bot | "No match for domain" |
| .app | "Domain not found" |

## Fast API Alternative (if WHOIS is slow)

```bash
# Using domainr API (no key needed for basic checks)
curl -s "https://domainr.p.rapidapi.com/v2/status?domain=example.com" \
  -H "X-RapidAPI-Key: YOUR_KEY"

# Or DNS-based check (not 100% reliable but fast)
dig +short "$domain" | grep -q . && echo "❌ Has DNS" || echo "🤔 No DNS (might be available)"
```

## Tips

- Check during off-peak hours for faster WHOIS responses
- Some premium/reserved domains show as "available" in WHOIS but aren't purchasable
- Always verify on registrar (GoDaddy, Namecheap, Porkbun) before announcing availability
- .ai domains require Anguilla presence or use a registrar that handles it
