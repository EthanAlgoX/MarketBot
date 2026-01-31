# Installation (SendGrid SDK)

## Node.js / TypeScript

```bash
pnpm add @sendgrid/mail
```

```ts
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
```

## Python

```bash
pip install sendgrid
```

```py
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
```

## Go

```bash
go get github.com/sendgrid/sendgrid-go
```

```go
import (
  "os"
  "github.com/sendgrid/sendgrid-go"
  "github.com/sendgrid/sendgrid-go/helpers/mail"
)

sg := sendgrid.NewSendClient(os.Getenv("SENDGRID_API_KEY"))
```

## PHP

```bash
composer require sendgrid/sendgrid
```

## Ruby

```bash
gem install sendgrid-ruby
```

## Java

```xml
<dependency>
  <groupId>com.sendgrid</groupId>
  <artifactId>sendgrid-java</artifactId>
  <version>4.10.3</version>
</dependency>
```

## C# (.NET)

```bash
dotnet add package SendGrid
```

## cURL

```bash
curl -X POST "https://api.sendgrid.com/v3/mail/send" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[{"to":[{"email":"vince@winkintel.com"}]}],"from":{"email":"support@winkintel.com"},"subject":"Hello","content":[{"type":"text/plain","value":"Hi"}]}'
```
