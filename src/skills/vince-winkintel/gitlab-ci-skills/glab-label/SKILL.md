---
name: glab-label
description: Use when working with glab label commands.
---

# glab label

## Overview

```

  Manage labels on remote.                                                                                              
         
  USAGE  
         
    glab label <command> [command] [--flags]  
            
  COMMANDS  
            
    create [--flags]  Create labels for a repository or project.
    delete [--flags]  Delete labels for a repository or project.
    edit [--flags]    Edit group or project label.
    get <label-id>    Returns a single label specified by the ID.
    list [--flags]    List labels in the repository.
         
  FLAGS  
         
    -h --help         Show help for this command.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## Quick start

```bash
glab label --help
```

## Subcommands

See [references/commands.md](references/commands.md) for full `--help` output.
