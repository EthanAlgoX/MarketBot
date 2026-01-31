# glab iteration help

> Help output captured from `glab iteration --help`.

```

  Retrieve iteration information.                                                                                       
         
  USAGE  
         
    glab iteration <command> [command] [--flags]  
            
  COMMANDS  
            
    list [--flags]  List project iterations
         
  FLAGS  
         
    -h --help       Show help for this command.
    -R --repo       Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## iteration list

```

  List project iterations                                                                                               
         
  USAGE  
         
    glab iteration list [--flags]              
            
  EXAMPLES  
            
    - glab iteration list                      
    - glab iteration ls                        
    - glab iteration list -R owner/repository  
    - glab iteration list -g mygroup           
         
  FLAGS  
         
    -g --group     List iterations for a group.
    -h --help      Show help for this command.
    -F --output    Format output as: text, json. (text)
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (30)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

