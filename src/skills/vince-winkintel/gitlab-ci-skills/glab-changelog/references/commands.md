# glab changelog help

> Help output captured from `glab changelog --help`.

```

  Interact with the changelog API.                                                                                      
         
  USAGE  
         
    glab changelog <command> [command] [--flags]  
            
  COMMANDS  
            
    generate [--flags]  Generate a changelog for the repository or project.
         
  FLAGS  
         
    -h --help           Show help for this command.
```

## changelog generate

```

  Generate a changelog for the repository or project.                                                                   
         
  USAGE  
         
    glab changelog generate [--flags]  
            
  EXAMPLES  
            
    # Generate a changelog             
    $ glab changelog generate          
         
  FLAGS  
         
    --config-file  Path of the changelog configuration file in the project's Git repository. Defaults to '.gitlab/changelog_config.yml'.
    --date         Date and time of the release. Uses ISO 8601 (`2016-03-11T03:45:40Z`) format. Defaults to the current time.
    --from         Start of the range of commits (as a SHA) to use when generating the changelog. This commit itself isn't included in the list.
    -h --help      Show help for this command.
    --to           End of the range of commits (as a SHA) to use when generating the changelog. This commit is included in the list. Defaults to the HEAD of the project's default branch.
    --trailer      The Git trailer to use for including commits. Defaults to 'Changelog'.
    -v --version   Version to generate the changelog for. Must follow semantic versioning. Defaults to the version of the local checkout, like using 'git describe'.
```

