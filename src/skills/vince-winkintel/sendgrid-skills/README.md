```
 ____  _____ _   _ ____   ____ ____  ___ ____     ____  _  _____ _     _     ____
/ ___|| ____| \ | |  _ \ / ___|  _ \|_ _/ ___|   / ___|| |/ /_ _| |   | |   / ___|
\___ \|  _| |  \| | | | | |  _| |_) || |\___ \   \___ \| ' / | || |   | |   \___ \
 ___) | |___| |\  | |_| | |_| |  _ < | | ___) |   ___) | . \ | || |___| |___ ___) |
|____/|_____|_| \_|____/ \____|_| \_\___|____/   |____/|_|\_\___|_____|_____|____/
```

# SendGrid Skills

A collection of skills for AI coding agents following the Agent Skills format. These skills enable AI agents to send emails using the [SendGrid](https://sendgrid.com) v3 Web API.

## Available Skills

### [`send-email`](./send-email)
Send emails using SendGrid's Mail Send API. Supports simple transactional sends with text/HTML and optional attachments.

## Installation

```bash
npx skills add winkintel/sendgrid-skills
```

## Usage

Skills are automatically activated when relevant tasks are detected. Example prompts:

- "Send a welcome email to new users"
- "Send a password reset email"

## Supported SDKs

- Node.js / TypeScript
- Python
- Go
- PHP
- Ruby
- Java
- C# (.NET)
- cURL

## Prerequisites

- A SendGrid account with a verified sender identity/domain
- API key stored in `SENDGRID_API_KEY` environment variable

Get your API key at <https://app.sendgrid.com/settings/api_keys>

## License

MIT
