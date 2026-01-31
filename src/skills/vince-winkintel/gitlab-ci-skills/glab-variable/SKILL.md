---
name: glab-variable
description: Use when working with glab variable commands.
---

# glab variable

## Overview

```

  Manage variables for a GitLab project or group.                                                                       
         
  USAGE  
         
    glab variable [command] [--flags]  
            
  COMMANDS  
            
    delete <key> [--flags]          Delete a variable for a project or group.
    export [--flags]                Export variables from a project or group.
    get <key> [--flags]             Get a variable for a project or group.
    list [--flags]                  List variables for a project or group.
    set <key> <value> [--flags]     Create a new variable for a project or group.
    update <key> <value> [--flags]  Update an existing variable for a project or group.
         
  FLAGS  
         
    -h --help                       Show help for this command.
    -R --repo                       Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## Quick start

```bash
glab variable --help
```

## Subcommands

See [references/commands.md](references/commands.md) for full `--help` output.
