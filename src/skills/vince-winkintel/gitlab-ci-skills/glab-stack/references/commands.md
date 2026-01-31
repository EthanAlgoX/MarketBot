# glab stack help

> Help output captured from `glab stack --help`.

```

  Stacked diffs are a way of creating small changes that build upon each other to ultimately deliver a feature. This    
  kind of workflow can be used to accelerate development time by continuing to build upon your changes, while earlier   
  changes in the stack are reviewed and updated based on feedback.                                                      
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack <command> [command] [--flags]  
            
  EXAMPLES  
            
    $ glab stack create cool-new-feature      
    $ glab stack sync                         
            
  COMMANDS  
            
    amend [--flags]      Save more changes to a stacked diff. (EXPERIMENTAL)
    create               Create a new stacked diff. (EXPERIMENTAL)
    first                Moves to the first diff in the stack. (EXPERIMENTAL)
    last                 Moves to the last diff in the stack. (EXPERIMENTAL)
    list                 Lists all entries in the stack. (EXPERIMENTAL)
    move                 Moves to any selected entry in the stack. (EXPERIMENTAL)
    next                 Moves to the next diff in the stack. (EXPERIMENTAL)
    prev                 Moves to the previous diff in the stack. (EXPERIMENTAL)
    reorder              Reorder a stack of merge requests. (EXPERIMENTAL)
    save [--flags]       Save your progress within a stacked diff. (EXPERIMENTAL)
    switch <stack-name>  Switch between stacks. (EXPERIMENTAL)
    sync                 Sync and submit progress on a stacked diff. (EXPERIMENTAL)
         
  FLAGS  
         
    -h --help            Show help for this command.
    -R --repo            Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack amend

```

  Add more changes to an existing stacked diff.                                                                         
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack amend [--flags]                          
            
  EXAMPLES  
            
    $ glab stack amend modifiedfile                     
    $ glab stack amend . -m "fixed a function"          
    $ glab stack amend newfile -d "forgot to add this"  
         
  FLAGS  
         
    -d --description  A description of the change
    -h --help         Show help for this command.
    -m --message      Alias for the description flag
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack create

```

  Create a new stacked diff. Adds metadata to your `./.git/stacked` directory.                                          
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack create [--flags]           
            
  EXAMPLES  
            
    $ glab stack create cool-new-feature  
    $ glab stack new cool-new-feature     
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack first

```

  Moves to the first diff in the stack, and checks out that branch.                                                     
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack first [--flags]  
            
  EXAMPLES  
            
    $ glab stack first          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack last

```

  Moves to the last diff in the stack, and checks out that branch.                                                      
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack last [--flags]  
            
  EXAMPLES  
            
    $ glab stack last          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack list

```

  Lists all entries in the stack. To select a different revision, use a command like 'stack move'.                      
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack list [--flags]  
            
  EXAMPLES  
            
    $ glab stack list          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack move

```

  Shows a menu with a fuzzy finder to select a stack.                                                                   
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack move [--flags]  
            
  EXAMPLES  
            
    $ glab stack move          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack next

```

  Moves to the next diff in the stack, and checks out that branch.                                                      
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack next [--flags]  
            
  EXAMPLES  
            
    $ glab stack next          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack prev

```

  Moves to the previous diff in the stack, and checks out that branch.                                                  
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack prev [--flags]  
            
  EXAMPLES  
            
    $ glab stack prev          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack reorder

```

  Reorder how the current stack's merge requests are merged.                                                            
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack reorder [--flags]  
            
  EXAMPLES  
            
    $ glab stack reorder          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack save

```

  Save your current progress with a diff on the stack.                                                                  
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack save [--flags]                  
            
  EXAMPLES  
            
    $ glab stack save added_file               
    $ glab stack save . -m "added a function"  
    $ glab stack save -m "added a function"    
         
  FLAGS  
         
    -d --description  Description of the change.
    -h --help         Show help for this command.
    -m --message      Alias for the description flag.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack switch

```

  Switch between stacks to work on another stack created with "glab stack create".                                      
  To see the list of all stacks, check the `.git/stacked/` directory.                                                   
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack switch <stack-name> [--flags]  
            
  EXAMPLES  
            
    $ glab stack switch <stack-name>          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## stack sync

```

  Sync and submit progress on a stacked diff. This command runs these steps:                                            
                                                                                                                        
  1. Optional. If working in a fork, select whether to push to the fork,                                                
     or the upstream repository.                                                                                        
  1. Pushes any amended changes to their merge requests.                                                                
  1. Rebases any changes that happened previously in the stack.                                                         
  1. Removes any branches that were already merged, or with a closed merge request.                                     
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab stack sync [--flags]  
            
  EXAMPLES  
            
    $ glab stack sync          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

