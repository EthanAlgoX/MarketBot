---
name: glab-token
description: Use when working with glab token commands.
---

# glab token

## Overview

```

  Manage personal, project, or group tokens                                                                             
         
  USAGE  
         
    glab token [command] [--flags]  
            
  COMMANDS  
            
    create <name> [--flags]                 Creates user, group, or project access tokens.
    list [--flags]                          List user, group, or project access tokens.
    revoke <token-name|token-id> [--flags]  Revoke user, group or project access tokens
    rotate <token-name|token-id> [--flags]  Rotate user, group, or project access tokens
         
  FLAGS  
         
    -h --help                               Show help for this command.
    -R --repo                               Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## Quick start

```bash
glab token --help
```

## Subcommands

See [references/commands.md](references/commands.md) for full `--help` output.
