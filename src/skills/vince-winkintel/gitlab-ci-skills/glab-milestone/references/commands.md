# glab milestone help

> Help output captured from `glab milestone --help`.

```

  Manage group or project milestones.                                                                                   
         
  USAGE  
         
    glab milestone <command> [command] [--flags]  
            
  COMMANDS  
            
    create [--flags]  Create a group or project milestone.
    delete [--flags]  Delete a group or project milestone.
    edit [--flags]    Edit a group or project milestone.
    get [--flags]     Get a milestones via an ID for a project or group.
    list [--flags]    Get a list of milestones for a project or group.
         
  FLAGS  
         
    -h --help         Show help for this command.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## milestone create

```

  Create a group or project milestone.                                                                                  
         
  USAGE  
         
    glab milestone create [--flags]                                                                  
            
  EXAMPLES  
            
    # Create milestone for the current project                                                       
    $ glab milestone create --title='Example title' --due-date='2025-12-16'                          
                                                                                                     
    # Create milestone for the specified project                                                     
    $ glab milestone create --title='Example group milestone' --due-date='2025-12-16' --project 123  
                                                                                                     
    # Create milestone for the specified group                                                       
    $ glab milestone create --title='Example group milestone' --due-date='2025-12-16' --group 456    
         
  FLAGS  
         
    --description  Description of the milestone.
    --due-date     Due date for the milestone. Expected in ISO 8601 format (2025-04-15T08:00:00Z).
    --group        The ID or URL-encoded path of the group.
    -h --help      Show help for this command.
    --project      The ID or URL-encoded path of the project.
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --start-date   Start date for the milestone. Expected in ISO 8601 format (2025-04-15T08:00:00Z).
    --title        Title of the milestone.
```

## milestone delete

```

  Delete a group or project milestone.                                                                                  
         
  USAGE  
         
    glab milestone delete [--flags]                     
            
  EXAMPLES  
            
    # Delete milestone for the current project          
    $ glab milestone delete 123                         
                                                        
    # Delete milestone for the specified project        
    $ glab milestone delete 123 --project project-name  
                                                        
    # Delete milestone for the specified group          
    $ glab milestone delete 123 --group group-name      
         
  FLAGS  
         
    --group    The ID or URL-encoded path of the group.
    -h --help  Show help for this command.
    --project  The ID or URL-encoded path of the project.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## milestone edit

```

  Edit a group or project milestone.                                                                                    
         
  USAGE  
         
    glab milestone edit [--flags]                                                                                     
            
  EXAMPLES  
            
    # Edit milestone for the current project                                                                          
    $ glab milestone edit 123 --title='Example title' --due-date='2025-12-16'                                         
                                                                                                                      
    # Edit milestone for the specified project                                                                        
    $ glab milestone edit 123 --title='Example group milestone' --due-date='2025-12-16' --project example-path/proj…  
                                                                                                                      
    # Edit milestone for the specified group                                                                          
    $ glab milestone edit 123 --title='Example group milestone' --due-date='2025-12-16' --group 789                   
         
  FLAGS  
         
    --description  Description of the milestone.
    --due-date     Due date for the milestone. Expected in ISO 8601 format (2025-04-15T08:00:00Z).
    --group        The ID or URL-encoded path of the group.
    -h --help      Show help for this command.
    --project      The ID or URL-encoded path of the project.
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --start-date   Start date for the milestone. Expected in ISO 8601 format (2025-04-15T08:00:00Z).
    --state        State of the milestone. Can be 'activate' or 'close'.
    --title        Title of the milestone.
```

## milestone get

```

  Get a milestones via an ID for a project or group.                                                                    
         
  USAGE  
         
    glab milestone get [--flags]                     
            
  EXAMPLES  
            
    # Get milestone for the current project          
    $ glab milestone get 123                         
                                                     
    # Get milestone for the specified project        
    $ glab milestone get 123 --project project-name  
                                                     
    # Get milestone for the specified group          
    $ glab milestone get 123 --group group-name      
         
  FLAGS  
         
    --group    The ID or URL-encoded path of the group.
    -h --help  Show help for this command.
    --project  The ID or URL-encoded path of the project.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## milestone list

```

  Get a list of milestones for a project or group.                                                                      
         
  USAGE  
         
    glab milestone list [--flags]                               
            
  EXAMPLES  
            
    # List milestones for a given project                       
    $ glab milestone list --project 123                         
    $ glab milestone list --project example-group/project-path  
                                                                
    # List milestones for a group                               
    $ glab milestone list --group example-group                 
                                                                
    # List only active milestones for a given group             
    $ glab milestone list --group example-group --state active  
         
  FLAGS  
         
    --group              The ID or URL-encoded path of the group.
    -h --help            Show help for this command.
    --include-ancestors  Include milestones from all parent groups.
    -p --page            Page number. (1)
    -P --per-page        Number of items to list per page. (20)
    --project            The ID or URL-encoded path of the project.
    -R --repo            Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --search             Return only milestones with a title or description matching the provided string.
    --show-id            Show IDs in table output.
    --state              Return only 'active' or 'closed' milestones.
    --title              Return only the milestones having the given title.
```

