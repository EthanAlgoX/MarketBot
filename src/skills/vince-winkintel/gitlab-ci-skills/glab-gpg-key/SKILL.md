---
name: glab-gpg-key
description: Use when working with glab gpg-key commands.
---

# glab gpg-key

## Overview

```

  Manage GPG keys registered with your GitLab account.                                                                  
         
  USAGE  
         
    glab gpg-key <command> [command] [--flags]  
            
  COMMANDS  
            
    add [key-file]   Add a GPG key to your GitLab account.
    delete <key-id>  Deletes a single GPG key specified by the ID.
    get <key-id>     Returns a single GPG key specified by the ID.
    list [--flags]   Get a list of GPG keys for the currently authenticated user.
         
  FLAGS  
         
    -h --help        Show help for this command.
    -R --repo        Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## Quick start

```bash
glab gpg-key --help
```

## Subcommands

See [references/commands.md](references/commands.md) for full `--help` output.
