# glab variable help

> Help output captured from `glab variable --help`.

```

  Manage variables for a GitLab project or group.                                                                       
         
  USAGE  
         
    glab variable [command] [--flags]  
            
  COMMANDS  
            
    delete <key> [--flags]          Delete a variable for a project or group.
    export [--flags]                Export variables from a project or group.
    get <key> [--flags]             Get a variable for a project or group.
    list [--flags]                  List variables for a project or group.
    set <key> <value> [--flags]     Create a new variable for a project or group.
    update <key> <value> [--flags]  Update an existing variable for a project or group.
         
  FLAGS  
         
    -h --help                       Show help for this command.
    -R --repo                       Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## variable delete

```

  Delete a variable for a project or group.                                                                             
         
  USAGE  
         
    glab variable delete <key> [--flags]          
            
  EXAMPLES  
            
    $ glab variable delete VAR_NAME               
    $ glab variable delete VAR_NAME --scope=prod  
    $ glab variable delete VARNAME -g mygroup     
         
  FLAGS  
         
    -g --group  Delete variable from a group.
    -h --help   Show help for this command.
    -R --repo   Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -s --scope  The 'environment_scope' of the variable. Options: all (*), or specific environments. (*)
```

## variable export

```

  Export variables from a project or group.                                                                             
         
  USAGE  
         
    glab variable export [--flags]                                      
            
  EXAMPLES  
            
    $ glab variable export                                              
    $ glab variable export --per-page 1000 --page 1                     
    $ glab variable export --group gitlab-org                           
    $ glab variable export --group gitlab-org --per-page 1000 --page 1  
    $ glab variable export --output json                                
    $ glab variable export --output env                                 
    $ glab variable export --output export                              
         
  FLAGS  
         
    -g --group     Select a group or subgroup. Ignored if a repository argument is set.
    -h --help      Show help for this command.
    -F --output    Format output as: json, export, env. (json)
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (100)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -s --scope     The environment_scope of the variables. Values: '*' (default), or specific environments. (*)
```

## variable get

```

  Get a variable for a project or group.                                                                                
         
  USAGE  
         
    glab variable get <key> [--flags]     
            
  EXAMPLES  
            
    $ glab variable get VAR_KEY           
    $ glab variable get -g GROUP VAR_KEY  
    $ glab variable get -s SCOPE VAR_KEY  
         
  FLAGS  
         
    -g --group   Get variable for a group.
    -h --help    Show help for this command.
    -F --output  Format output as: text, json. (text)
    -R --repo    Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -s --scope   The environment_scope of the variable. Values: all (*), or specific environments. (*)
```

## variable list

```

  List variables for a project or group.                                                                                
         
  USAGE  
         
    glab variable list [--flags]                            
            
  EXAMPLES  
            
    $ glab variable list                                    
    $ glab variable list -i                                 
    $ glab variable list --per-page 100 --page 1            
    $ glab variable list --group gitlab-org                 
    $ glab variable list --group gitlab-org --per-page 100  
         
  FLAGS  
         
    -g --group     Select a group or subgroup. Ignored if a repository argument is set.
    -h --help      Show help for this command.
    -i --instance  Display instance variables.
    -F --output    Format output as: text, json. (text)
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (20)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## variable set

```

  Create a new variable for a project or group.                                                                         
         
  USAGE  
         
    glab variable set <key> <value> [--flags]                                    
            
  EXAMPLES  
            
    $ glab variable set WITH_ARG "some value"                                    
    $ glab variable set WITH_DESC "some value" --description "some description"  
    $ glab variable set FROM_FLAG -v "some value"                                
    $ glab variable set FROM_ENV_WITH_ARG "${ENV_VAR}"                           
    $ glab variable set FROM_ENV_WITH_FLAG -v"${ENV_VAR}"                        
    $ glab variable set FROM_FILE < secret.txt                                   
    $ cat file.txt | glab variable set SERVER_TOKEN                              
    $ cat token.txt | glab variable set GROUP_TOKEN -g mygroup --scope=prod      
         
  FLAGS  
         
    -d --description  Set description of a variable.
    -g --group        Set variable for a group.
    -h --help         Show help for this command.
    --hidden          Whether the variable is hidden.
    -m --masked       Whether the variable is masked.
    -p --protected    Whether the variable is protected.
    -r --raw          Whether the variable is treated as a raw string.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -s --scope        The environment_scope of the variable. Values: all (*), or specific environments. (*)
    -t --type         The type of a variable: env_var, file. (env_var)
    -v --value        The value of a variable.
```

## variable update

```

  Update an existing variable for a project or group.                                                                   
         
  USAGE  
         
    glab variable update <key> <value> [--flags]                                
            
  EXAMPLES  
            
    $ glab variable update WITH_ARG "some value"                                
    $ glab variable update FROM_FLAG -v "some value"                            
    $ glab variable update FROM_ENV_WITH_ARG "${ENV_VAR}"                       
    $ glab variable update FROM_ENV_WITH_FLAG -v"${ENV_VAR}"                    
    $ glab variable update FROM_FILE < secret.txt                               
    $ cat file.txt | glab variable update SERVER_TOKEN                          
    $ cat token.txt | glab variable update GROUP_TOKEN -g mygroup --scope=prod  
         
  FLAGS  
         
    -d --description  Set description of a variable.
    -g --group        Set variable for a group.
    -h --help         Show help for this command.
    -m --masked       Whether the variable is masked.
    -p --protected    Whether the variable is protected.
    -r --raw          Whether the variable is treated as a raw string.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -s --scope        The environment_scope of the variable. Values: all (*), or specific environments. (*)
    -t --type         The type of a variable: env_var, file. (env_var)
    -v --value        The value of a variable.
```

