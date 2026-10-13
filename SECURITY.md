<!-- Modified for marketbot on 2026-10-13; see MODIFICATIONS.md. -->
# Security

## Reporting vulnerabilities

Report a suspected vulnerability privately to the maintainer of the deployment
you use. A public security contact for this development project has not yet
been configured. The release operator must supply a private reporting channel
before distributing a release.

Do not open a public issue or post reproduction details for an unfixed
vulnerability. Include reproduction steps, expected impact and whether the issue
is already public in the private report. Never include tokens, passwords,
personal holdings or production databases.

## Scope

This policy covers MarketBot's application code, authentication, financial
bridge, authorization, command recovery, secret handling and deployment tools.
Third-party models, data providers and external services are operated separately;
report provider defects through their own private channels. Operator
misconfiguration still needs to be corrected, including exposed credentials,
open databases and weak passwords.

## Development and release status

The current version is a local development build. Review dependency advisories,
configured provider access, HTTPS, backups and account isolation before a public
release. Model research, stock data, device delivery and continuous operation
remain subject to their documented acceptance gates.

There is no bug bounty program or published support address at this time.
