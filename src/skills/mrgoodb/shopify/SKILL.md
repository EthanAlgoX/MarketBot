---
name: shopify
description: Manage Shopify stores - products, orders, customers, and inventory via Admin API.
metadata: {"clawdbot":{"emoji":"🛒","requires":{"env":["SHOPIFY_STORE","SHOPIFY_ACCESS_TOKEN"]}}}
---

# Shopify

Manage e-commerce stores.

## Environment

```bash
export SHOPIFY_STORE="your-store.myshopify.com"
export SHOPIFY_ACCESS_TOKEN="shpat_xxxxxxxxxx"
```

## List Products

```bash
curl "https://$SHOPIFY_STORE/admin/api/2024-01/products.json" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN"
```

## Create Product

```bash
curl -X POST "https://$SHOPIFY_STORE/admin/api/2024-01/products.json" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product": {
      "title": "New Product",
      "body_html": "<p>Description</p>",
      "vendor": "My Brand",
      "product_type": "Clothing",
      "variants": [{"price": "29.99", "sku": "SKU123"}]
    }
  }'
```

## List Orders

```bash
curl "https://$SHOPIFY_STORE/admin/api/2024-01/orders.json?status=any" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN"
```

## Get Order Details

```bash
curl "https://$SHOPIFY_STORE/admin/api/2024-01/orders/{order_id}.json" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN"
```

## Update Inventory

```bash
curl -X POST "https://$SHOPIFY_STORE/admin/api/2024-01/inventory_levels/set.json" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location_id": 123, "inventory_item_id": 456, "available": 100}'
```

## Links
- Admin: https://admin.shopify.com
- Docs: https://shopify.dev/docs/api/admin-rest
