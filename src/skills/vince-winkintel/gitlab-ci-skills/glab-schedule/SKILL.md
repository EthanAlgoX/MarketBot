---
name: glab-schedule
description: Use when working with glab schedule commands.
---

# glab schedule

## Overview

```

  Work with GitLab CI/CD schedules.                                                                                     
         
  USAGE  
         
    glab schedule <command> [command] [--flags]  
            
  COMMANDS  
            
    create [--flags]       Schedule a new pipeline.
    delete <id> [--flags]  Delete the schedule with the specified ID.
    list [--flags]         Get the list of schedules.
    run <id>               Run the specified scheduled pipeline.
    update <id> [--flags]  Update a pipeline schedule.
         
  FLAGS  
         
    -h --help              Show help for this command.
    -R --repo              Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## Quick start

```bash
glab schedule --help
```

## Subcommands

See [references/commands.md](references/commands.md) for full `--help` output.
