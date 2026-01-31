# glab ssh-key help

> Help output captured from `glab ssh-key --help`.

```

  Manage SSH keys registered with your GitLab account.                                                                  
         
  USAGE  
         
    glab ssh-key <command> [command] [--flags]  
            
  COMMANDS  
            
    add [key-file] [--flags]   Add an SSH key to your GitLab account.
    delete <key-id> [--flags]  Deletes a single SSH key specified by the ID.
    get <key-id> [--flags]     Returns a single SSH key specified by the ID.
    list [--flags]             Get a list of SSH keys for the currently authenticated user.
         
  FLAGS  
         
    -h --help                  Show help for this command.
    -R --repo                  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ssh-key add

```

  Creates a new SSH key owned by the currently authenticated user.                                                      
                                                                                                                        
  Requires the '--title' flag.                                                                                          
                                                                                                                        
         
  USAGE  
         
    glab ssh-key add [key-file] [--flags]                                                         
            
  EXAMPLES  
            
    # Read ssh key from stdin and upload.                                                         
    $ glab ssh-key add -t "my title"                                                              
                                                                                                  
    # Read ssh key from specified key file, upload and set the ssh key type to "authentication".  
    $ glab ssh-key add ~/.ssh/id_ed25519.pub -t "my title" --usage-type "auth"                    
         
  FLAGS  
         
    -e --expires-at  The expiration date of the SSH key. Uses ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ.
    -h --help        Show help for this command.
    -R --repo        Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -t --title       New SSH key's title.
    -u --usage-type  Usage scope for the key. Possible values: 'auth', 'signing' or 'auth_and_signing'. Default value: 'auth_and_signing'. (auth_and_signing)
```

## ssh-key delete

```

  Deletes a single SSH key specified by the ID.                                                                         
         
  USAGE  
         
    glab ssh-key delete <key-id> [--flags]  
            
  EXAMPLES  
            
    # Delete SSH key with ID as argument    
    $ glab ssh-key delete 7750633           
                                            
    # Interactive                           
    $ glab ssh-key delete                   
                                            
    # Interactive, with pagination          
    $ glab ssh-key delete -P 50 -p 2        
         
  FLAGS  
         
    -h --help      Show help for this command.
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (30)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ssh-key get

```

  Returns a single SSH key specified by the ID.                                                                         
         
  USAGE  
         
    glab ssh-key get <key-id> [--flags]  
            
  EXAMPLES  
            
    # Get ssh key with ID as argument    
    $ glab ssh-key get 7750633           
                                         
    # Interactive                        
    $ glab ssh-key get                   
                                         
    # Interactive, with pagination       
    $ glab ssh-key get -P 50 -p 2        
         
  FLAGS  
         
    -h --help      Show help for this command.
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (20)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ssh-key list

```

  Get a list of SSH keys for the currently authenticated user.                                                          
         
  USAGE  
         
    glab ssh-key list [--flags]  
            
  EXAMPLES  
            
    $ glab ssh-key list          
         
  FLAGS  
         
    -h --help      Show help for this command.
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (30)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --show-id      Shows IDs of SSH keys.
```

