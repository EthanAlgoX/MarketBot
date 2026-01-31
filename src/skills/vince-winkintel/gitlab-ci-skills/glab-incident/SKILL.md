---
name: glab-incident
description: Use when working with glab incident commands.
---

# glab incident

## Overview

```

  Work with GitLab incidents.                                                                                           
         
  USAGE  
         
    glab incident [command] [--flags]  
            
  EXAMPLES  
            
    $ glab incident list               
            
  COMMANDS  
            
    close [<id> | <url>] [--flags]   Close an incident.
    list [--flags]                   List project incidents.
    note <incident-id> [--flags]     Comment on an incident in GitLab.
    reopen [<id> | <url>] [--flags]  Reopen a resolved incident.
    subscribe <id>                   Subscribe to an incident.
    unsubscribe <id>                 Unsubscribe from an incident.
    view <id> [--flags]              Display the title, body, and other information about an incident.
         
  FLAGS  
         
    -h --help                        Show help for this command.
    -R --repo                        Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## Quick start

```bash
glab incident --help
```

## Subcommands

See [references/commands.md](references/commands.md) for full `--help` output.
