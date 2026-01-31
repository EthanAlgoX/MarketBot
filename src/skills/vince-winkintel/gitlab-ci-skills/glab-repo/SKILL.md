---
name: glab-repo
description: Use when working with glab repo commands.
---

# glab repo

## Overview

```

  Work with GitLab repositories and projects.                                                                           
         
  USAGE  
         
    glab repo <command> [command] [--flags]  
            
  COMMANDS  
            
    archive <command> [--flags]                                                                 Get an archive of the repository.
    clone <repo>               [<dir>] [-- <gitflags>...] [<dir>] [-- <gitflags>...] [--flags]  Clone a GitLab repository or project.
    glab repo clone -g <group>                                                                                                       
    contributors [--flags]                                                                      Get repository contributors list.
    create [path] [--flags]                                                                     Create a new GitLab project/repository.
    delete <NAME> [<NAMESPACE>/] [--flags]                                                      Delete an existing project on GitLab.
    fork <repo> [--flags]                                                                       Fork a GitLab repository.
    list [--flags]                                                                              Get list of repositories.
    members <command> [command] [--flags]                                                       Manage project members.
    mirror [ID | URL | PATH] [--flags]                                                          Configure mirroring on an existing project to sync with a remote repository.
    publish <command> [command] [--flags]                                                       Publishes resources in the project.
    search [--flags]                                                                            Search for GitLab repositories and projects by name.
    transfer [repo] [--flags]                                                                   Transfer a repository to a new namespace.
    update [path] [--flags]                                                                     Update an existing GitLab project or repository.
    view [repository] [--flags]                                                                 View a project or repository.
         
  FLAGS  
         
    -h --help                                                                                   Show help for this command.
```

## Quick start

```bash
glab repo --help
```

## Subcommands

See [references/commands.md](references/commands.md) for full `--help` output.
