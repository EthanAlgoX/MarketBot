# glab token help

> Help output captured from `glab token --help`.

```

  Manage personal, project, or group tokens                                                                             
         
  USAGE  
         
    glab token [command] [--flags]  
            
  COMMANDS  
            
    create <name> [--flags]                 Creates user, group, or project access tokens.
    list [--flags]                          List user, group, or project access tokens.
    revoke <token-name|token-id> [--flags]  Revoke user, group or project access tokens
    rotate <token-name|token-id> [--flags]  Rotate user, group, or project access tokens
         
  FLAGS  
         
    -h --help                               Show help for this command.
    -R --repo                               Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## token create

```

  Creates a new access token for a user, group, or project. Defaults to a                                               
  project access token, unless user or group name is specified.                                                         
                                                                                                                        
  The expiration date of the token is calculated by adding the duration                                                 
  (default: 30 days) to the current date, with expiration occurring at midnight                                         
  UTC on the calculated date. You can specify a different duration using days (d),                                      
  weeks (w), or hours (h), or provide an explicit end date.                                                             
                                                                                                                        
  The name of the token must be unique. The token is printed to stdout.                                                 
                                                                                                                        
  Administrators can create full-featured personal access tokens for themselves and for other users.                    
                                                                                                                        
  Non-administrators can create personal access tokens only for                                                         
  themselves (@me). These tokens must use the scope 'k8s_proxy'. For more                                               
  information, see the GitLab documentation for the                                                                     
  [User tokens API](https://docs.gitlab.com/api/user_tokens/#create-a-personal-access-token).                           
                                                                                                                        
         
  USAGE  
         
    glab token create <name> [--flags]                                                                           
            
  EXAMPLES  
            
    # Create project access token for current project (default 30 days)                                          
    $ glab token create --access-level developer --scope read_repository --scope read_registry my-project-token  
                                                                                                                 
    # Create project access token with 7 day lifetime                                                            
    $ glab token create --repo user/my-repo --access-level owner --scope api my-project-token --duration 7d      
                                                                                                                 
    # Create a group access token expiring in 2 weeks                                                            
    $ glab token create --group group/sub-group --access-level owner --scope api my-group-token --duration 2w    
                                                                                                                 
    # Create a personal access token for current user with 90 day lifetime                                       
    $ glab token create --user @me --scope k8s_proxy my-personal-token --duration 90d                            
                                                                                                                 
    # (administrator only) Create a personal access token for another user                                       
    $ glab token create --user johndoe --scope api johns-personal-token --duration 180d                          
                                                                                                                 
    # Create a token with explicit expiration date                                                               
    $ glab token create --access-level developer --scope api my-token --expires-at 2025-12-31                    
                                                                                                                 
         
  FLAGS  
         
    -A --access-level  Access level of the token: one of 'guest', 'reporter', 'developer', 'maintainer', 'owner'. (no)
    --description      Sets the token's description.
    -D --duration      Sets the token lifetime in days. Accepts: days (30d), weeks (4w), or hours in multiples of 24 (24h, 168h, 720h). Maximum: 365d. The token expires at midnight UTC on the calculated date. (30d)
    -E --expires-at    Sets the token's expiration date and time, in YYYY-MM-DD format. If not specified, --duration is used. (0001-01-01)
    -g --group         Create a group access token. Ignored if a user or repository argument is set.
    -h --help          Show help for this command.
    -F --output        Format output as 'text' for the token value, 'json' for the actual API token structure. (text)
    -R --repo          Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -S --scope         Scopes for the token. Multiple scopes can be comma-separated or specified by repeating the flag. For a list, see https://docs.gitlab.com/user/profile/personal_access_tokens/#personal-access-token-scopes. ([read_repository])
    -U --user          Create a personal access token. For the current user, use @me.
```

## token list

```

  List all tokens of a user, group, or project.                                                                         
                                                                                                                        
  The output contains the token's meta information, not the actual token value. The output format                       
  can be "JSON" or "text". The access level property is printed in human-readable form in the text                      
  output, but displays the integer value in JSON.                                                                       
                                                                                                                        
  Administrators can list tokens of other users.                                                                        
                                                                                                                        
         
  USAGE  
         
    glab token list [--flags]                                               
            
  EXAMPLES  
            
    # List the current project's access tokens                              
    $ glab token list                                                       
    $ glab token list --output json                                         
                                                                            
    # List the project access tokens of a specific project                  
    $ glab token list --repo user/my-repo                                   
                                                                            
    # List group access tokens                                              
    $ glab token list --group group/sub-group                               
                                                                            
    # List my personal access tokens                                        
    $ glab token list --user @me                                            
                                                                            
    # Administrators only: list the personal access tokens of another user  
    $ glab token list --user johndoe                                        
         
  FLAGS  
         
    -a --active  List only the active tokens.
    -g --group   List group access tokens. Ignored if a user or repository argument is set.
    -h --help    Show help for this command.
    -F --output  Format output as: text, json. text provides a readable table, json outputs the tokens with metadata. (text)
    -R --repo    Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -U --user    List personal access tokens. Use @me for the current user.
```

## token revoke

```

  Revoke an user, group or project access token. If multiple tokens with the same name exist, you can specify           
  the ID of the token.                                                                                                  
                                                                                                                        
  The output format can be either "JSON" or "text". The JSON output will show the meta information of the               
  revoked token. The normal text output is a description of the revoked token name and ID.                              
                                                                                                                        
  Administrators can revoke personal access tokens belonging to other users.                                            
                                                                                                                        
         
  USAGE  
         
    glab token revoke <token-name|token-id> [--flags]                      
            
  EXAMPLES  
            
    # Revoke a project access token of current project                     
    $ glab token revoke my-project-token                                   
                                                                           
    # Revoke a project access token of a specific project                  
    $ glab token revoke --repo user/my-repo my-project-token               
                                                                           
    # Revoke a group access token                                          
    $ glab token revoke --group group/sub-group my-group-token             
                                                                           
    # Revoke my personal access token                                      
    $ glab token revoke --user @me my-personal-token                       
                                                                           
    # Revoke a personal access token of another user (administrator only)  
    $ glab token revoke --user johndoe johns-personal-token                
                                                                           
         
  FLAGS  
         
    -g --group   Revoke group access token. Ignored if a user or repository argument is set.
    -h --help    Show help for this command.
    -F --output  Format output as: text, json. 'text' provides the name and ID of the revoked token; 'json' outputs the token with metadata. (text)
    -R --repo    Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -U --user    Revoke personal access token. Use @me for the current user.
```

## token rotate

```

  Rotate user, group, or project access token, then print the new token on stdout. If multiple tokens with              
  the same name exist, you can specify the ID of the token.                                                             
                                                                                                                        
  The expiration date of the token will be calculated by adding the duration (default 30 days) to the                   
  current date, with expiration occurring at midnight UTC on the calculated date. Alternatively you can                 
  specify a different duration using days (d), weeks (w), or hours (h), or provide an explicit end date.                
                                                                                                                        
  The output format can be either "JSON" or "text". The JSON output will show the meta information of the               
  rotated token.                                                                                                        
                                                                                                                        
  Administrators can rotate personal access tokens belonging to other users.                                            
                                                                                                                        
         
  USAGE  
         
    glab token rotate <token-name|token-id> [--flags]                              
            
  EXAMPLES  
            
    # Rotate project access token of current project (default 30 days)             
    $ glab token rotate my-project-token                                           
                                                                                   
    # Rotate project access token with explicit expiration date                    
    $ glab token rotate --repo user/repo my-project-token --expires-at 2025-08-08  
                                                                                   
    # Rotate group access token with 7 day lifetime                                
    $ glab token rotate --group group/sub-group my-group-token --duration 7d       
                                                                                   
    # Rotate personal access token with 2 week lifetime                            
    $ glab token rotate --user @me my-personal-token --duration 2w                 
                                                                                   
    # Rotate a personal access token of another user (administrator only)          
    $ glab token rotate --user johndoe johns-personal-token --duration 90d         
         
  FLAGS  
         
    -D --duration    Sets the token lifetime in days. Accepts: days (30d), weeks (4w), or hours in multiples of 24 (24h, 168h, 720h). Maximum: 365d. The token expires at midnight UTC on the calculated date. (30d)
    -E --expires-at  Sets the token's expiration date and time, in YYYY-MM-DD format. If not specified, --duration is used. (0001-01-01)
    -g --group       Rotate group access token. Ignored if a user or repository argument is set.
    -h --help        Show help for this command.
    -F --output      Format output as: text, json. 'text' provides the new token value; 'json' outputs the token with metadata. (text)
    -R --repo        Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -U --user        Rotate personal access token. Use @me for the current user.
```

