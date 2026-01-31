---
name: sendgrid
description: Use when working with SendGrid email platform - routes to sub-skills for sending email.
license: MIT
metadata:
  author: winkintel
  version: "0.1.0"
---

# SendGrid

## Overview

SendGrid is an email platform for developers. This skill routes to feature-specific sub-skills.

## Sub-Skills

| Feature | Skill | Use When |
|---------|-------|----------|
| **Sending emails** | `send-email` | Transactional emails, notifications, simple sends |

## Common Setup

### API Key

Store in environment variable:
```bash
export SENDGRID_API_KEY=SG.xxxxxxxxx
```

### SDK Installation

See `send-email` skill for installation instructions across supported languages.

## Resources

- [SendGrid Documentation](https://docs.sendgrid.com)
- [SendGrid Node SDK](https://github.com/sendgrid/sendgrid-nodejs)
- [Email API v3 Reference](https://docs.sendgrid.com/api-reference/mail-send/mail-send)
