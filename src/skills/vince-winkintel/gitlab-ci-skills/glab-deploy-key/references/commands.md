# glab deploy-key help

> Help output captured from `glab deploy-key --help`.

```

  Manage deploy keys.                                                                                                   
         
  USAGE  
         
    glab deploy-key <command> [command] [--flags]  
            
  COMMANDS  
            
    add [key-file] [--flags]  Add a deploy key to a GitLab project.
    delete <key-id>           Deletes a single deploy key specified by the ID.
    get <key-id>              Returns a single deploy key specified by the ID.
    list [--flags]            Get a list of deploy keys for the current project.
         
  FLAGS  
         
    -h --help                 Show help for this command.
    -R --repo                 Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## deploy-key add

```

  Creates a new deploy key.                                                                                             
                                                                                                                        
  Requires the '--title' flag.                                                                                          
                                                                                                                        
         
  USAGE  
         
    glab deploy-key add [key-file] [--flags]                                         
            
  EXAMPLES  
            
    # Read deploy key from stdin and upload.                                         
    $ glab deploy-key add -t "my title"                                              
                                                                                     
    # Read deploy key from specified key file and upload                             
    $ cat ~/.ssh/id_ed25519.pub | glab deploy-key add --title='test' -               
                                                                                     
    # Read deploy key from specified key file, upload and set "can push" attribute.  
    $ glab deploy-key add ~/.ssh/id_ed25519.pub -t "my title" --can-push true        
         
  FLAGS  
         
    -c --can-push    If true, deploy keys can be used for pushing code to the repository.
    -e --expires-at  The expiration date of the deploy key, using the ISO-8601 format: YYYY-MM-DDTHH:MM:SSZ.
    -h --help        Show help for this command.
    -R --repo        Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -t --title       New deploy key's title.
```

## deploy-key delete

```

  Deletes a single deploy key specified by the ID.                                                                      
         
  USAGE  
         
    glab deploy-key delete <key-id> [--flags]  
            
  EXAMPLES  
            
    # Delete SSH key with ID as argument       
    $ glab deploy-key delete 1234              
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## deploy-key get

```

  Returns a single deploy key specified by the ID.                                                                      
         
  USAGE  
         
    glab deploy-key get <key-id> [--flags]  
            
  EXAMPLES  
            
    # Get deploy key with ID as argument    
    $ glab deploy-key get 1234              
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## deploy-key list

```

  Get a list of deploy keys for the current project.                                                                    
         
  USAGE  
         
    glab deploy-key list [--flags]  
            
  EXAMPLES  
            
    - glab deploy-key list          
         
  FLAGS  
         
    -h --help      Show help for this command.
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (30)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --show-id      Shows IDs of deploy keys.
```

