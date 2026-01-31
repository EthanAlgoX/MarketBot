---
name: glab-issue
description: Use when working with glab issue commands.
---

# glab issue

## Overview

```

  Work with GitLab issues.                                                                                              
         
  USAGE  
         
    glab issue [command] [--flags]                                         
            
  EXAMPLES  
            
    $ glab issue list                                                      
    $ glab issue create --label --confidential                             
    $ glab issue view --web 123                                            
    $ glab issue note -m "closing because !123 was merged" <issue number>  
            
  COMMANDS  
            
    board [command] [--flags]        Work with GitLab issue boards in the given project.
    close [<id> | <url>] [--flags]   Close an issue.
    create [--flags]                 Create an issue.
    delete <id>                      Delete an issue.
    list [--flags]                   List project issues.
    note <issue-id> [--flags]        Comment on an issue in GitLab.
    reopen [<id> | <url>] [--flags]  Reopen a closed issue.
    subscribe <id>                   Subscribe to an issue.
    unsubscribe <id>                 Unsubscribe from an issue.
    update <id> [--flags]            Update issue
    view <id> [--flags]              Display the title, body, and other information about an issue.
         
  FLAGS  
         
    -h --help                        Show help for this command.
    -R --repo                        Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## Quick start

```bash
glab issue --help
```

## Subcommands

See [references/commands.md](references/commands.md) for full `--help` output.
