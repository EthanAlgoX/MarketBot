---
name: vodoo
description: Query and manage Odoo ERP data (helpdesk tickets, projects, tasks, CRM leads, knowledge articles) via the vodoo CLI
---

# Vodoo - Odoo CLI Tool

Use `uvx vodoo` to interact with Odoo via XML-RPC. No installation required - uvx runs it directly.

## Important: Always Use --no-color

**ALWAYS add `--no-color` to every vodoo command.** This disables ANSI escape codes and significantly reduces token usage.

```bash
# Correct
uvx vodoo --no-color helpdesk list

# Wrong (wastes tokens on color codes)
uvx vodoo helpdesk list
```

## Commands Overview

| Module | Model | Description |
|--------|-------|-------------|
| `helpdesk` | helpdesk.ticket | Support tickets |
| `project-task` | project.task | Project tasks |
| `project` | project.project | Projects |
| `crm` | crm.lead | Leads & opportunities |
| `knowledge` | knowledge.article | Knowledge articles |
| `model` | any | Generic CRUD for any model |
| `security` | - | User & group management |

## Helpdesk Tickets

```bash
# List tickets
uvx vodoo helpdesk list
uvx vodoo helpdesk list --stage "New"
uvx vodoo helpdesk list --limit 5

# Show ticket details
uvx vodoo helpdesk show 123

# Add comment (visible to customer)
uvx vodoo helpdesk comment 123 "Your issue has been resolved"

# Add internal note (not visible to customer)
uvx vodoo helpdesk note 123 "Escalated to dev team"

# Manage tags
uvx vodoo helpdesk tags                    # List available tags
uvx vodoo helpdesk tag 123 "urgent"        # Add tag to ticket

# View history and attachments
uvx vodoo helpdesk chatter 123             # Message history
uvx vodoo helpdesk attachments 123         # List attachments
uvx vodoo helpdesk download 456            # Download attachment by ID
uvx vodoo helpdesk download-all 123        # Download all attachments

# Update fields
uvx vodoo helpdesk fields                  # List available fields
uvx vodoo helpdesk fields 123              # Show field values for ticket
uvx vodoo helpdesk set 123 priority=3      # Set field value

# Attachments and URL
uvx vodoo helpdesk attach 123 report.pdf   # Attach file
uvx vodoo helpdesk url 123                 # Get web URL
```

## Project Tasks

```bash
# List tasks
uvx vodoo project-task list
uvx vodoo project-task list --project "Website Redesign"
uvx vodoo project-task list --stage "In Progress"

# Create task
uvx vodoo project-task create "Fix login bug" --project "Website"

# Show task details
uvx vodoo project-task show 456

# Comments and notes
uvx vodoo project-task comment 456 "Started working on this"
uvx vodoo project-task note 456 "Need clarification from client"

# Tags
uvx vodoo project-task tags
uvx vodoo project-task tag 456 "backend"
uvx vodoo project-task tag-create "new-tag"
uvx vodoo project-task tag-delete "old-tag"

# Attachments and history
uvx vodoo project-task chatter 456
uvx vodoo project-task attachments 456
uvx vodoo project-task attach 456 spec.pdf

# Fields and URL
uvx vodoo project-task fields
uvx vodoo project-task set 456 priority=1
uvx vodoo project-task url 456
```

## Projects

```bash
# List projects
uvx vodoo project list

# Show project details
uvx vodoo project show 789

# Comments and notes
uvx vodoo project comment 789 "Project kickoff complete"
uvx vodoo project note 789 "Budget approved"

# History and attachments
uvx vodoo project chatter 789
uvx vodoo project attachments 789
uvx vodoo project attach 789 contract.pdf

# Fields and stages
uvx vodoo project fields
uvx vodoo project set 789 description="Updated description"
uvx vodoo project stages              # List task stages
uvx vodoo project url 789
```

## CRM Leads/Opportunities

```bash
# List leads
uvx vodoo crm list
uvx vodoo crm list --stage "Qualified"

# Show lead details
uvx vodoo crm show 321

# Comments and notes
uvx vodoo crm comment 321 "Follow-up scheduled"
uvx vodoo crm note 321 "Decision maker: John Smith"

# Tags
uvx vodoo crm tags
uvx vodoo crm tag 321 "hot-lead"

# History and attachments
uvx vodoo crm chatter 321
uvx vodoo crm attachments 321
uvx vodoo crm attach 321 proposal.pdf

# Fields and URL
uvx vodoo crm fields
uvx vodoo crm set 321 expected_revenue=50000
uvx vodoo crm url 321
```

## Knowledge Articles

```bash
# List articles
uvx vodoo knowledge list

# Show article
uvx vodoo knowledge show 111

# Comments and notes
uvx vodoo knowledge comment 111 "Updated for v2.0"
uvx vodoo knowledge note 111 "Needs review"

# History and URL
uvx vodoo knowledge chatter 111
uvx vodoo knowledge attachments 111
uvx vodoo knowledge url 111
```

## Generic Model Operations

For any Odoo model not covered by specific commands:

```bash
# Read records
uvx vodoo model read res.partner --domain "[('is_company', '=', True)]" --fields name,email
uvx vodoo model read res.partner --ids 1,2,3

# Create record
uvx vodoo model create res.partner name="ACME Corp" is_company=true

# Update record
uvx vodoo model update res.partner 123 phone="+1234567890"

# Delete record
uvx vodoo model delete res.partner 123

# Call model method
uvx vodoo model call res.partner 123 method_name
```

## Security / User Management

```bash
# Create standard Vodoo security groups
uvx vodoo security create-groups

# Create API service account
uvx vodoo security create-user "api-bot" "api-bot@example.com"

# Assign user to Vodoo API groups
uvx vodoo security assign-bot 456

# Set/reset user password
uvx vodoo security set-password 456 "new-password"
```

## Common Options

Most commands support:
- `--no-color` - **Required for AI usage** (put right after `vodoo`)
- `--limit N` - Limit results
- `--help` - Show command help

## Field Updates

The `set` command supports special operators for numerical fields:
- `field=value` - Set to value
- `field+=10` - Add to current value
- `field-=5` - Subtract from current value
- `field*=2` - Multiply current value
- `field/=2` - Divide current value

## Tips

1. Always use `--no-color` flag (saves tokens by removing ANSI codes)
2. Use `fields` command to discover available fields before updating
3. Stage names are case-sensitive and must match exactly
4. The `model` command can access any Odoo model if you know its technical name
