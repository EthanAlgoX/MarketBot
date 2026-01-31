# glab schedule help

> Help output captured from `glab schedule --help`.

```

  Work with GitLab CI/CD schedules.                                                                                     
         
  USAGE  
         
    glab schedule <command> [command] [--flags]  
            
  COMMANDS  
            
    create [--flags]       Schedule a new pipeline.
    delete <id> [--flags]  Delete the schedule with the specified ID.
    list [--flags]         Get the list of schedules.
    run <id>               Run the specified scheduled pipeline.
    update <id> [--flags]  Update a pipeline schedule.
         
  FLAGS  
         
    -h --help              Show help for this command.
    -R --repo              Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## schedule create

```

  Schedule a new pipeline.                                                                                              
         
  USAGE  
         
    glab schedule create [--flags]                                                                                    
            
  EXAMPLES  
            
    # Create a scheduled pipeline that runs every hour                                                                
    $ glab schedule create --cron "0 * * * *" --description "Describe your pipeline here" --ref "main" --variable "…  
    > Created schedule                                                                                                
         
  FLAGS  
         
    --active        Whether or not the schedule is active. (true)
    --cron          Cron interval pattern.
    --cronTimeZone  Cron timezone. (UTC)
    --description   Description of the schedule.
    -h --help       Show help for this command.
    --ref           Target branch or tag.
    -R --repo       Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --variable      Pass variables to schedule in the format <key>:<value>. Repeat flag for multiple variables.
```

## schedule delete

```

  Delete the schedule with the specified ID.                                                                            
         
  USAGE  
         
    glab schedule delete <id> [--flags]       
            
  EXAMPLES  
            
    # Delete a scheduled pipeline with ID 10  
    $ glab schedule delete 10                 
    > Deleted schedule with ID 10             
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## schedule list

```

  Get the list of schedules.                                                                                            
         
  USAGE  
         
    glab schedule list [--flags]                    
            
  EXAMPLES  
            
    # List all scheduled pipelines                  
    $ glab schedule list                            
    > Showing schedules for project gitlab-org/cli  
    > ID Description Cron Ref Active                
    > 1 Daily build 0 0 * * * main true             
    > 2 Weekly deployment 0 0 * * 0 main true       
         
  FLAGS  
         
    -h --help      Show help for this command.
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (30)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## schedule run

```

  Run the specified scheduled pipeline.                                                                                 
         
  USAGE  
         
    glab schedule run <id> [--flags]      
            
  EXAMPLES  
            
    # Run a scheduled pipeline with ID 1  
    $ glab schedule run 1                 
    > Started schedule with ID 1          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## schedule update

```

  Update a pipeline schedule.                                                                                           
         
  USAGE  
         
    glab schedule update <id> [--flags]                                                                               
            
  EXAMPLES  
            
    # Update a scheduled pipeline with ID 10                                                                          
    $ glab schedule update 10 --cron "0 * * * *" --description "Describe your pipeline here" --ref "main" --create-…  
    > Updated schedule with ID 10                                                                                     
         
  FLAGS  
         
    --active           Whether or not the schedule is active. (to not change)
    --create-variable  Pass new variables to schedule in format <key>:<value>.
    --cron             Cron interval pattern.
    --cronTimeZone     Cron timezone.
    --delete-variable  Pass variables you want to delete from schedule in format <key>.
    --description      Description of the schedule.
    -h --help          Show help for this command.
    --ref              Target branch or tag.
    -R --repo          Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --update-variable  Pass updated variables to schedule in format <key>:<value>.
```

