# glab gpg-key help

> Help output captured from `glab gpg-key --help`.

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

## gpg-key add

```

  Creates a new GPG key owned by the currently authenticated user.                                                      
                                                                                                                        
         
  USAGE  
         
    glab gpg-key add [key-file] [--flags]               
            
  EXAMPLES  
            
    # Read GPG key from stdin and upload.               
    $ glab gpg-key add                                  
                                                        
    # Read GPG key from specified key file and upload.  
    $ glab gpg-key add ~/.gnupg/pubkey.asc              
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## gpg-key delete

```

  Deletes a single GPG key specified by the ID.                                                                         
         
  USAGE  
         
    glab gpg-key delete <key-id> [--flags]  
            
  EXAMPLES  
            
    # Delete GPG key with ID as argument    
    $ glab gpg-key delete 7750633           
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## gpg-key get

```

  Returns a single GPG key specified by the ID.                                                                         
         
  USAGE  
         
    glab gpg-key get <key-id> [--flags]  
            
  EXAMPLES  
            
    # Get GPG key with ID as argument    
    $ glab gpg-key get 7750633           
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## gpg-key list

```

  Get a list of GPG keys for the currently authenticated user.                                                          
         
  USAGE  
         
    glab gpg-key list [--flags]  
            
  EXAMPLES  
            
    $ glab gpg-key list          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --show-id  Shows IDs of GPG keys.
```

