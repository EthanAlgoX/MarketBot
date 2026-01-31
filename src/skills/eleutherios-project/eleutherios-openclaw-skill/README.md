# Eleutherios Skill for OpenClaw

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Query epistemic knowledge graphs from WhatsApp, Telegram, Discord, Slack, and more. Detect suppression patterns, coordination signatures, and get multi-perspective analysis on contested topics.

## What It Does

Eleutherios transforms document collections into knowledge graphs, then runs detection algorithms to surface patterns that traditional search misses:

- **Suppression Detection**: Funding cuts, career impacts, publication obstacles, institutional marginalization
- **Coordination Signatures**: Timing patterns, shared language, citation network anomalies  
- **Multi-Perspective Clustering**: See all sides of contested topics
- **Source Topology Analysis**: Citation networks and trust relationships

All processing happens locally. Your documents never leave your machine.

## Quick Install

### Prerequisites

Eleutherios must be running locally first:

```bash
git clone https://github.com/Eleutherios-project/Eleutherios-docker.git
cd Eleutherios-docker
docker-compose up -d



# Verify MCP server is running
curl http://localhost:8100/health
```

### Install the Skill

**Via ClawHub CLI:**
```bash
clawhub install eleutherios
```

**Manual installation:**
```bash
mkdir -p ~/.openclaw/skills/eleutherios
curl -o ~/.openclaw/skills/eleutherios/SKILL.md \
  https://github.com/Eleutherios-project/Eleutherios_OpenClaw_skill/blob/main/SKILL.md
openclaw gateway restart
```

## Usage Examples

From any connected chat platform (WhatsApp, Telegram, Discord, etc.):

**Suppression Analysis:**

You: What suppression patterns exist for Thomas Paine?
Assistant: Analyzing Thomas Paine in your knowledge graph...

Suppression Score: 0.831 (CRITICAL)

Key indicators:
- Credential inversion despite Founding Father status
- Evidence avoidance (character attacks vs argument engagement)
- Institutional exclusion from monuments, currency, education


## Available Tools

- **analyze_topic**: Run suppression/coordination detection
- **get_perspectives**: Cluster claims by viewpoint
- **assess_source**: Analyze source topology position
- **get_claim_context**: Deep dive on specific claims
- **list_domains**: Show corpus statistics

See SKILL.md for full documentation.

## Links

- **Eleutherios**: https://github.com/Eleutherios-project/Eleutherios-docker
- **Documentation**: https://eleutherios.io
- **Issues**: https://github.com/Eleutherios-project/Eleutherios-docker/issues

## License

MIT License - See LICENSE file.

## About

Created by Cedrus Strategic LLC. Eleutherios (from Zeus Eleutherios, god of freedom) is open-source epistemic defense infrastructure for researchers investigating topics where institutional gatekeepers cannot be trusted.
