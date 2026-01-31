# glab ci help

> Help output captured from `glab ci --help`.

```

  Work with GitLab CI/CD pipelines and jobs.                                                                            
         
  USAGE  
         
    glab ci <command> [command] [--flags]  
            
  COMMANDS  
            
    artifact <refName> <jobName> [--flags]  Download all artifacts from the last pipeline.
    cancel <command> [command]              Cancel a running pipeline or job.
    config <command> [command] [--flags]    Work with GitLab CI/CD configuration.
    delete <id> [--flags]                   Delete CI/CD pipelines.
    get [--flags]                           Get JSON of a running CI/CD pipeline on the current or other specified branch.
    lint [--flags]                          Checks if your `.gitlab-ci.yml` file is valid.
    list [--flags]                          Get the list of CI/CD pipelines.
    retry <job-id> [--flags]                Retry a CI/CD job.
    run [--flags]                           Create or run a new CI/CD pipeline.
    run-trig [--flags]                      Run a CI/CD pipeline trigger.
    status [--flags]                        View a running CI/CD pipeline on current or other branch specified.
    trace [<job-id>] [--flags]              Trace a CI/CD job log in real time.
    trigger <job-id> [--flags]              Trigger a manual CI/CD job.
    view [branch/tag] [--flags]             View, run, trace, log, and cancel CI/CD job's current pipeline.
         
  FLAGS  
         
    -h --help                               Show help for this command.
    -R --repo                               Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ci artifact

```
Command "artifact" is deprecated, use 'glab job artifact' instead.

  Download all artifacts from the last pipeline.                                                                        
         
  USAGE  
         
    glab ci artifact <refName> <jobName> [--flags]               
            
  EXAMPLES  
            
    # Download all artifacts from the main branch and build job  
    $ glab ci artifact main build                                
    $ glab ci artifact main deploy --path="artifacts/"           
         
  FLAGS  
         
    -h --help  Show help for this command.
    -p --path  Path to download the artifact files. (./)
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ci cancel

```

  Cancel a running pipeline or job.                                                                                     
         
  USAGE  
         
    glab ci cancel <command> [command] [--flags]  
            
  COMMANDS  
            
    job <id> [--flags]       Cancel CI/CD jobs.
    pipeline <id> [--flags]  Cancel CI/CD pipelines.
         
  FLAGS  
         
    -h --help                Show help for this command.
    -R --repo                Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ci config

```

  Work with GitLab CI/CD configuration.                                                                                 
         
  USAGE  
         
    glab ci config <command> [command] [--flags]  
            
  COMMANDS  
            
    compile    View the fully expanded CI/CD configuration.
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ci delete

```

  Delete CI/CD pipelines.                                                                                               
         
  USAGE  
         
    glab ci delete <id> [--flags]                      
            
  EXAMPLES  
            
    $ glab ci delete 34                                
    $ glab ci delete 12,34,2                           
    $ glab ci delete --source=api                      
    $ glab ci delete --status=failed                   
    $ glab ci delete --older-than 24h                  
    $ glab ci delete --older-than 24h --status=failed  
         
  FLAGS  
         
    --dry-run     Simulate process, but do not delete anything.
    -h --help     Show help for this command.
    --older-than  Filter pipelines older than the given duration. Valid units: h, m, s, ms, us, ns. (0s)
    --page        Page number.
    --paginate    Make additional HTTP requests to fetch all pages of projects before cloning. Respects '--per-page'.
    --per-page    Number of items to list per page.
    -R --repo     Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --source      Filter pipelines by source: api, chat, external, external_pull_request_event, merge_request_event, ondemand_dast_scan, ondemand_dast_validation, parent_pipeline, pipeline, push, schedule, security_orchestration_policy, trigger, web, webide.
    -s --status   Delete pipelines by status: running, pending, success, failed, canceled, skipped, created, manual.
```

## ci get

```

  Get JSON of a running CI/CD pipeline on the current or other specified branch.                                        
         
  USAGE  
         
    glab ci get [--flags]               
            
  EXAMPLES  
            
    $ glab ci get                       
    $ glab ci -R some/project -p 12345  
         
  FLAGS  
         
    -b --branch            Check pipeline status for a branch. (default current branch)
    -h --help              Show help for this command.
    -F --output            Format output. Options: text, json. (text)
    -p --pipeline-id       Provide pipeline ID.
    -R --repo              Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -d --with-job-details  Show extended job information.
    --with-variables       Show variables in pipeline. Requires the Maintainer role.
```

## ci lint

```

  Checks if your `.gitlab-ci.yml` file is valid.                                                                        
         
  USAGE  
         
    glab ci lint [--flags]                          
            
  EXAMPLES  
            
    # Uses .gitlab-ci.yml in the current directory  
    $ glab ci lint                                  
    $ glab ci lint .gitlab-ci.yml                   
    $ glab ci lint path/to/.gitlab-ci.yml           
         
  FLAGS  
         
    --dry-run       Run pipeline creation simulation.
    -h --help       Show help for this command.
    --include-jobs  Response includes the list of jobs that would exist in a static check or pipeline simulation.
    --ref           When 'dry-run' is true, sets the branch or tag context for validating the CI/CD YAML configuration.
    -R --repo       Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ci list

```

  Get the list of CI/CD pipelines.                                                                                      
         
  USAGE  
         
    glab ci list [--flags]          
            
  EXAMPLES  
            
    $ glab ci list                  
    $ glab ci list --status=failed  
         
  FLAGS  
         
    -h --help            Show help for this command.
    -n --name            Return only pipelines with the given name.
    -o --order           Order pipelines by this field. Options: id, status, ref, updated_at, user_id. (id)
    -F --output          Format output. Options: text, json. (text)
    -p --page            Page number. (1)
    -P --per-page        Number of items to list per page. (30)
    -r --ref             Return only pipelines for given ref.
    -R --repo            Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --scope              Return only pipelines with the given scope: {running|pending|finished|branches|tags}
    --sha                Return only pipelines with the given SHA.
    --sort               Sort direction for --order field: asc or desc. (desc)
    --source             Return only pipelines triggered via the given source. See https://docs.gitlab.com/ci/jobs/job_rules/#ci_pipeline_source-predefined-variable for full list. Commonly used options: {merge_request_event|parent_pipeline|pipeline|push|trigger}
    -s --status          Get pipeline with this status. Options: running, pending, success, failed, canceled, skipped, created, manual, waiting_for_resource, preparing, scheduled
    -a --updated-after   Return only pipelines updated after the specified date. Expected in ISO 8601 format (2019-03-15T08:00:00Z).
    -b --updated-before  Return only pipelines updated before the specified date. Expected in ISO 8601 format (2019-03-15T08:00:00Z).
    -u --username        Return only pipelines triggered by the given username.
    -y --yaml-errors     Return only pipelines with invalid configurations.
```

## ci retry

```

  Retry a CI/CD job.                                                                                                    
         
  USAGE  
         
    glab ci retry <job-id> [--flags]       
            
  EXAMPLES  
            
    # Interactively select a job to retry  
    $ glab ci retry                        
                                           
    # Retry job with ID 224356863          
    $ glab ci retry 224356863              
                                           
    # Retry job with the name 'lint'       
    $ glab ci retry lint                   
         
  FLAGS  
         
    -b --branch       The branch to search for the job. (default current branch)
    -h --help         Show help for this command.
    -p --pipeline-id  The pipeline ID to search for the job.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ci run

```

  The `--branch` option is available for all pipeline types.                                                            
                                                                                                                        
  The options for variables are incompatible with merge request pipelines.                                              
  If used with merge request pipelines, the command fails with a message like `ERROR: if any flags in the group [output 
  output-format] are set none of the others can be`                                                                     
                                                                                                                        
  Specify one or more pipeline inputs using the `-i` or `--input` flag for each                                         
  input. Each input flag uses the format `key:value`.                                                                   
                                                                                                                        
  The values are typed and will default to `string` unless a type is explicitly                                         
  specified. To specify a type, use the `type(value)` syntax. For example,                                              
  `key:string(value)` will pass the string `value` as the input.                                                        
                                                                                                                        
  Valid types are:                                                                                                      
                                                                                                                        
  - `string`: A string value. This is the default type. For example, `key:string(value)`.                               
  - `int`: An integer value. For example, `key:int(42)`.                                                                
  - `float`: A floating-point value. For example, `key:float(3.14)`.                                                    
  - `bool`: A boolean value. For example, `key:bool(true)`.                                                             
  - `array`: An array of strings. For example, `key:array(foo,bar)`.                                                    
                                                                                                                        
  An array of strings can be specified with a trailing comma. For example,                                              
  `key:array(foo,bar,)` will pass the array `[foo, bar]`. `array()` specifies an                                        
  empty array. To pass an array with the empty string, use `array(,)`.                                                  
                                                                                                                        
  Value arguments containing parentheses should be escaped from the shell with                                          
  quotes. For example, `--input key:array(foo,bar)` should be written as                                                
  `--input 'key:array(foo,bar)'`.                                                                                       
                                                                                                                        
         
  USAGE  
         
    glab ci run [--flags]                                                                                             
            
  EXAMPLES  
            
    $ glab ci run                                                                                                     
    $ glab ci run --variables \"key1:value,with,comma\"                                                               
    $ glab ci run -b main                                                                                             
    $ glab ci run --web                                                                                               
    $ glab ci run --mr                                                                                                
                                                                                                                      
    # Specify CI variables                                                                                            
    $ glab ci run -b main --variables-env key1:val1                                                                   
    $ glab ci run -b main --variables-env key1:val1,key2:val2                                                         
    $ glab ci run -b main --variables-env key1:val1 --variables-env key2:val2                                         
    $ glab ci run -b main --variables-file MYKEY:file1 --variables KEY2:some_value                                    
                                                                                                                      
    # Specify CI inputs                                                                                               
    $ glab ci run -b main --input key1:val1 --input key2:val2                                                         
    $ glab ci run -b main --input "replicas:int(3)" --input "debug:bool(false)" --input "regions:array(us-east,eu-w…  
                                                                                                                      
    // For an example of 'glab ci run -f' with a variables file, see                                                  
    // [Run a CI/CD pipeline with variables from a file](https://docs.gitlab.com/editor_extensions/gitlab_cli/#run-…  
    // in the GitLab documentation.                                                                                   
         
  FLAGS  
         
    -b --branch          Create pipeline on branch/ref <string>.
    -h --help            Show help for this command.
    -i --input           Pass inputs to pipeline in format '<key>:<value>'. Cannot be used for merge request pipelines. See documentation for examples.
    --mr                 Run merge request pipeline instead of branch pipeline.
    -R --repo            Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --variables          Pass variables to pipeline in format <key>:<value>. Cannot be used for MR pipelines.
    --variables-env      Pass variables to pipeline in format <key>:<value>. Cannot be used for MR pipelines.
    --variables-file     Pass file contents as a file variable to pipeline in format <key>:<filename>. Cannot be used for MR pipelines.
    -f --variables-from  Json file with variables for pipeline execution. Expects array of hashes, each with at least 'key' and 'value'. Cannot be used for MR pipelines.
    -w --web             Open pipeline in a browser. Uses default browser, or browser specified in BROWSER environment variable.
```

## ci run-trig

```

  Specify one or more pipeline inputs using the `-i` or `--input` flag for each                                         
  input. Each input flag uses the format `key:value`.                                                                   
                                                                                                                        
  The values are typed and will default to `string` unless a type is explicitly                                         
  specified. To specify a type, use the `type(value)` syntax. For example,                                              
  `key:string(value)` will pass the string `value` as the input.                                                        
                                                                                                                        
  Valid types are:                                                                                                      
                                                                                                                        
  - `string`: A string value. This is the default type. For example, `key:string(value)`.                               
  - `int`: An integer value. For example, `key:int(42)`.                                                                
  - `float`: A floating-point value. For example, `key:float(3.14)`.                                                    
  - `bool`: A boolean value. For example, `key:bool(true)`.                                                             
  - `array`: An array of strings. For example, `key:array(foo,bar)`.                                                    
                                                                                                                        
  An array of strings can be specified with a trailing comma. For example,                                              
  `key:array(foo,bar,)` will pass the array `[foo, bar]`. `array()` specifies an                                        
  empty array. To pass an array with the empty string, use `array(,)`.                                                  
                                                                                                                        
  Value arguments containing parentheses should be escaped from the shell with                                          
  quotes. For example, `--input key:array(foo,bar)` should be written as                                                
  `--input 'key:array(foo,bar)'`.                                                                                       
                                                                                                                        
         
  USAGE  
         
    glab ci run-trig [--flags]                                                                                        
            
  EXAMPLES  
            
    $ glab ci run-trig -t xxxx                                                                                        
    $ glab ci run-trig -t xxxx -b main                                                                                
                                                                                                                      
    # Specify CI variables                                                                                            
    $ glab ci run-trig -t xxxx -b main --variables key1:val1                                                          
    $ glab ci run-trig -t xxxx -b main --variables key1:val1,key2:val2                                                
    $ glab ci run-trig -t xxxx -b main --variables key1:val1 --variables key2:val2                                    
                                                                                                                      
    # Specify CI inputs                                                                                               
    $ glab ci run-trig -t xxxx -b main --input key1:val1 --input key2:val2                                            
    $ glab ci run-trig -t xxxx -b main --input "replicas:int(3)" --input "debug:bool(false)" --input "regions:array…  
         
  FLAGS  
         
    -b --branch  Create pipeline on branch or reference <string>.
    -h --help    Show help for this command.
    -i --input   Pass inputs to pipeline in format '<key>:<value>'. Cannot be used for merge request pipelines. See documentation for examples.
    -R --repo    Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -t --token   Pipeline trigger token. Can be omitted only if the `CI_JOB_TOKEN` environment variable is set.
    --variables  Pass variables to pipeline in the format <key>:<value>. Multiple variables can be comma-separated or specified by repeating the flag.
```

## ci status

```

  View a running CI/CD pipeline on current or other branch specified.                                                   
         
  USAGE  
         
    glab ci status [--flags]                   
            
  EXAMPLES  
            
    $ glab ci status --live                    
                                               
    # A more compact view                      
    $ glab ci status --compact                 
                                               
    # Get the pipeline for the main branch     
    $ glab ci status --branch=main             
                                               
    # Get the pipeline for the current branch  
    $ glab ci status                           
         
  FLAGS  
         
    -b --branch   Check pipeline status for a branch. (default current branch)
    -c --compact  Show status in compact format.
    -h --help     Show help for this command.
    -l --live     Show status in real time until the pipeline ends.
    -R --repo     Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ci trace

```

  Trace a CI/CD job log in real time.                                                                                   
         
  USAGE  
         
    glab ci trace [<job-id>] [--flags]     
            
  EXAMPLES  
            
    # Interactively select a job to trace  
    $ glab ci trace                        
                                           
    # Trace job with ID 224356863          
    $ glab ci trace 224356863              
                                           
    # Trace job with the name 'lint'       
    $ glab ci trace lint                   
         
  FLAGS  
         
    -b --branch       The branch to search for the job. (default current branch)
    -h --help         Show help for this command.
    -p --pipeline-id  The pipeline ID to search for the job.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ci trigger

```

  Trigger a manual CI/CD job.                                                                                           
         
  USAGE  
         
    glab ci trigger <job-id> [--flags]       
            
  EXAMPLES  
            
    # Interactively select a job to trigger  
    $ glab ci trigger                        
                                             
    # Trigger manual job with id 224356863   
    $ glab ci trigger 224356863              
                                             
    # Trigger manual job with name lint      
    $ glab ci trigger lint                   
         
  FLAGS  
         
    -b --branch       The branch to search for the job. (default current branch)
    -h --help         Show help for this command.
    -p --pipeline-id  The pipeline ID to search for the job.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## ci view

```

  Supports viewing, running, tracing, and canceling jobs.                                                               
                                                                                                                        
  Use arrow keys to navigate jobs and logs.                                                                             
                                                                                                                        
  - `Enter` to toggle through a job's logs / traces, or display a child pipeline.                                       
    Trigger jobs are marked with a `»`.                                                                                 
  - `Esc` or `q` to close the logs or trace, or return to the parent pipeline.                                          
  - `Ctrl+R`, `Ctrl+P` to run, retry, or play a job. Use `Tab` or arrow keys to                                         
    navigate the modal, and `Enter` to confirm.                                                                         
  - `Ctrl+D` to cancel a job. If the selected job isn't running or pending,                                             
    quits the CI/CD view.                                                                                               
  - `Ctrl+Q` to quit the CI/CD view.                                                                                    
  - `Ctrl+Space` to suspend application and view the logs. Similar to `glab pipeline ci trace`.                         
  - Supports `vi` style bindings and arrow keys for navigating jobs and logs.                                           
                                                                                                                        
         
  USAGE  
         
    glab ci view [branch/tag] [--flags]                           
            
  EXAMPLES  
            
    # Uses current branch                                         
    $ glab pipeline ci view                                       
                                                                  
    # Get latest pipeline on main branch                          
    $ glab pipeline ci view main                                  
                                                                  
    # Just like the second example                                
    $ glab pipeline ci view -b main                               
                                                                  
    # Get latest pipeline on main branch of myusername/glab repo  
    $ glab pipeline ci view -b main -R myusername/glab            
         
  FLAGS  
         
    -b --branch      Check pipeline status for a branch or tag. Defaults to the current branch.
    -h --help        Show help for this command.
    -p --pipelineid  Check pipeline status for a specific pipeline ID.
    -R --repo        Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -w --web         Open pipeline in a browser. Uses default browser, or browser specified in BROWSER variable.
```

