# glab label help

> Help output captured from `glab label --help`.

```

  Manage labels on remote.                                                                                              
         
  USAGE  
         
    glab label <command> [command] [--flags]  
            
  COMMANDS  
            
    create [--flags]  Create labels for a repository or project.
    delete [--flags]  Delete labels for a repository or project.
    edit [--flags]    Edit group or project label.
    get <label-id>    Returns a single label specified by the ID.
    list [--flags]    List labels in the repository.
         
  FLAGS  
         
    -h --help         Show help for this command.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## label create

```

  Create labels for a repository or project.                                                                            
         
  USAGE  
         
    glab label create [--flags]        
            
  EXAMPLES  
            
    $ glab label create                
    $ glab label new                   
    $ glab label create -R owner/repo  
         
  FLAGS  
         
    -c --color        Color of the label, in plain or HEX code. (#428BCA)
    -d --description  Label description.
    -h --help         Show help for this command.
    -n --name         Name of the label.
    -p --priority     Label priority.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## label delete

```

  Delete labels for a repository or project.                                                                            
         
  USAGE  
         
    glab label delete [--flags]            
            
  EXAMPLES  
            
    $ glab label delete foo                
    $ glab label delete -R owner/repo foo  
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## label edit

```

  Edit group or project label.                                                                                          
         
  USAGE  
         
    glab label edit [--flags]        
            
  EXAMPLES  
            
    $ glab label edit                
    $ glab label edit -R owner/repo  
         
  FLAGS  
         
    -c --color        The color of the label given in 6-digit hex notation with leading ‘#’ sign.
    -d --description  Label description.
    -h --help         Show help for this command.
    -l --label-id     The label ID we are updating.
    -n --new-name     The new name of the label.
    -p --priority     Label priority.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## label get

```

  Returns a single label specified by the ID.                                                                           
         
  USAGE  
         
    glab label get <label-id> [--flags]            
            
  EXAMPLES  
            
    # Get label info using label 1234 as argument  
    $ glab label get 1234                          
                                                   
    # Get info about a label in another project    
    $ glab label get 1234 -R owner/repo            
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## label list

```

  List labels in the repository.                                                                                        
         
  USAGE  
         
    glab label list [--flags]              
            
  EXAMPLES  
            
    $ glab label list                      
    $ glab label ls                        
    $ glab label list -R owner/repository  
    $ glab label list -g mygroup           
         
  FLAGS  
         
    -g --group     List labels for a group.
    -h --help      Show help for this command.
    -F --output    Format output as: text, json. (text)
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (30)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

