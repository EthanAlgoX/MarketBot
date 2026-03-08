---
name: find-skills
description: Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities.
metadata: {"marketbot":{"emoji":"🔍","triggers":["find skill","search skill","install skill","add skill","extend capabilities"],"output":"skill-search-report","risk":"low","freshness":"reference","tools":["shell"]}}
---

# 🔍 Find Skills

This skill helps you discover and install skills from the open agent skills ecosystem to extend MarketBot's capabilities.

## When to Use This Skill

Use this skill when the user:

- Asks "how do I do X" where X might be a common task with an existing skill
- Says "find a skill for X" or "is there a skill for X"
- Asks "can you do X" where X is a specialized capability
- Expresses interest in extending agent capabilities
- Wants to search for tools, templates, or workflows

## What is the Skills CLI?

The Skills CLI (`npx skills`) is the package manager for the open agent skills ecosystem.

**Key commands:**

- `npx skills find [query]` - Search for skills
- `npx skills add <package>` - Install a skill
- `npx skills check` - Check for updates
- `npx skills update` - Update all skills

**Browse skills at:** <https://skills.sh/>

## How to Help Users Find Skills

### Step 1: Search for Skills

Run the find command with a relevant query:

```bash
npx skills find [query]
```

### Step 2: Offer to Install

If the user wants to proceed, you can install the skill for them:

```bash
npx skills add <owner/repo@skill> -g -y
```

## Common Skill Categories

| Category        | Example Queries                          |
| --------------- | ---------------------------------------- |
| Web Development | react, nextjs, typescript, css           |
| Testing         | testing, jest, playwright                |
| DevOps          | deploy, docker, kubernetes               |
| Documentation   | docs, readme, changelog                  |
| Code Quality    | review, lint, refactor                   |

---
**Note**: This skill was imported from the OpenClaw ecosystem to enhance MarketBot's extensibility.
