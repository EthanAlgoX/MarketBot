# glab opentofu help

> Help output captured from `glab opentofu --help`.

```

  Work with the OpenTofu or Terraform integration.                                                                      
         
  USAGE  
         
    glab opentofu <command> [command] [--flags]  
            
  COMMANDS  
            
    init <state> [--flags]               Initialize OpenTofu or Terraform.
    state <command> [command] [--flags]  Work with the OpenTofu or Terraform states.
         
  FLAGS  
         
    -h --help                            Show help for this command.
    -R --repo                            Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## opentofu init

```

  Initialize OpenTofu or Terraform.                                                                                     
         
  USAGE  
         
    glab opentofu init <state> [--flags]                              
            
  EXAMPLES  
            
    # Initialize state with name production in working directory      
    $ glab opentofu init production                                   
                                                                      
    # Initialize state with name production in infra/ directory       
    $ glab opentofu init production -d infra/                         
                                                                      
    # Initialize state with name production with Terraform            
    $ glab opentofu init production -b terraform                      
                                                                      
    # Initialize state with name production with reconfiguring state  
    $ glab opentofu init production -- -reconfigure                   
         
  FLAGS  
         
    -b --binary     Name or path of the OpenTofu or Terraform binary to use for the initialization. (tofu)
    -d --directory  Directory of the OpenTofu or Terraform project to initialize. (.)
    -h --help       Show help for this command.
    -R --repo       Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## opentofu state

```

  Work with the OpenTofu or Terraform states.                                                                           
         
  USAGE  
         
    glab opentofu state <command> [command] [--flags]  
            
  COMMANDS  
            
    delete <state> [<serial>] [--flags]  Delete the given state or if the serial is provided only that version of the given state.
    download <state> [<serial>]          Download the given state and output as JSON to stdout.
    list                                 List states.
    lock <state>                         Lock the given state.
    unlock <state>                       Unlock the given state.
         
  FLAGS  
         
    -h --help                            Show help for this command.
    -R --repo                            Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

