---
name: glab-mr
description: Use when working with glab mr commands.
---

# glab mr

## Overview

```

  Create, view, and manage merge requests.                                                                              
         
  USAGE  
         
    glab mr <command> [command] [--flags]                                 
            
  EXAMPLES  
            
    $ glab mr create --fill --label bugfix                                
    $ glab mr merge 123                                                   
    $ glab mr note -m "needs to do X before it can be merged" branch-foo  
            
  COMMANDS  
            
    approve {<id> | <branch>} [--flags]           Approve merge requests.
    approvers [<id> | <branch>] [--flags]         List eligible approvers for merge requests in any state.
    checkout [<id> | <branch> | <url>] [--flags]  Check out an open merge request.
    close [<id> | <branch>]                       Close a merge request.
    create [--flags]                              Create a new merge request.
    delete [<id> | <branch>]                      Delete a merge request.
    diff [<id> | <branch>] [--flags]              View changes in a merge request.
    for [--flags]                                 Create a new merge request for an issue.
    issues [<id> | <branch>]                      Get issues related to a particular merge request.
    list [--flags]                                List merge requests.
    merge {<id> | <branch>} [--flags]             Merge or accept a merge request.
    note [<id> | <branch>] [--flags]              Add a comment or note to a merge request.
    rebase [<id> | <branch>] [--flags]            Rebase the source branch of a merge request against its target branch.
    reopen [<id>... | <branch>...]                Reopen a merge request.
    revoke [<id> | <branch>]                      Revoke approval on a merge request.
    subscribe [<id> | <branch>]                   Subscribe to a merge request.
    todo [<id> | <branch>]                        Add a to-do item to merge request.
    unsubscribe [<id> | <branch>]                 Unsubscribe from a merge request.
    update [<id> | <branch>] [--flags]            Update a merge request.
    view {<id> | <branch>} [--flags]              Display the title, body, and other information about a merge request.
         
  FLAGS  
         
    -h --help                                     Show help for this command.
    -R --repo                                     Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## Quick start

```bash
glab mr --help
```

## Subcommands

See [references/commands.md](references/commands.md) for full `--help` output.
