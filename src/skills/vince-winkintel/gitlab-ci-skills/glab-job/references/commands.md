# glab job help

> Help output captured from `glab job --help`.

```

  Work with GitLab CI/CD jobs.                                                                                          
         
  USAGE  
         
    glab job <command> [command] [--flags]  
            
  COMMANDS  
            
    artifact <refName> <jobName> [--flags]  Download all artifacts from the last pipeline.
         
  FLAGS  
         
    -h --help                               Show help for this command.
    -R --repo                               Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## job artifact

```

  Download all artifacts from the last pipeline.                                                                        
         
  USAGE  
         
    glab job artifact <refName> <jobName> [--flags]      
            
  EXAMPLES  
            
    $ glab job artifact main build                       
    $ glab job artifact main deploy --path="artifacts/"  
    $ glab job artifact main deploy --list-paths         
         
  FLAGS  
         
    -h --help        Show help for this command.
    -l --list-paths  Print the paths of downloaded artifacts.
    -p --path        Path to download the artifact files. (./)
    -R --repo        Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

