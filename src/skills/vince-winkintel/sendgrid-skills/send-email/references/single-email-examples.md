# Single Email Examples (SendGrid)

## Node.js / TypeScript

```ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

await sgMail.send({
  from: 'Support <support@winkintel.com>',
  to: ['vince@winkintel.com'],
  subject: 'SendGrid test',
  text: 'Plain text body',
  html: '<p>HTML body</p>',
});
```

## Python

```py
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

message = Mail(
    from_email='support@winkintel.com',
    to_emails='vince@winkintel.com',
    subject='SendGrid test',
    plain_text_content='Plain text body',
    html_content='<p>HTML body</p>'
)

sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
response = sg.send(message)
```

## cURL

```bash
curl -X POST "https://api.sendgrid.com/v3/mail/send" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[{"to":[{"email":"vince@winkintel.com"}]}],"from":{"email":"support@winkintel.com"},"subject":"SendGrid test","content":[{"type":"text/plain","value":"Plain text body"},{"type":"text/html","value":"<p>HTML body</p>"}]}'
```
