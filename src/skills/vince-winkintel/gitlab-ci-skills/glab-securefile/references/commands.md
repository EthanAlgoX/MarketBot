# glab securefile help

> Help output captured from `glab securefile --help`.

```

  Store up to 100 files for secure use in CI/CD pipelines. Secure files are                                             
  stored outside of your project's repository, not in version control.                                                  
  It is safe to store sensitive information in these files. Both plain text                                             
  and binary files are supported, but they must be smaller than 5 MB.                                                   
                                                                                                                        
         
  USAGE  
         
    glab securefile <command> [command] [--flags]  
            
  COMMANDS  
            
    create <fileName> <inputFilePath>  Create a new project secure file.
    download <fileID> [--flags]        Download a secure file for a project.
    get <fileID>                       Get details of a project secure file. (GitLab 18.0 and later)
    list [--flags]                     List secure files for a project.
    remove <fileID> [--flags]          Remove a secure file.
         
  FLAGS  
         
    -h --help                          Show help for this command.
    -R --repo                          Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## securefile create

```

  Create a new project secure file.                                                                                     
         
  USAGE  
         
    glab securefile create <fileName> <inputFilePath> [--flags]                               
            
  EXAMPLES  
            
    # Create a project secure file with the given name using the contents of the given path.  
    $ glab securefile create "newfile.txt" "securefiles/localfile.txt"                        
                                                                                              
    # Create a project secure file using the 'upload' alias.                                  
    $ glab securefile upload "newfile.txt" "securefiles/localfile.txt"                        
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## securefile download

```

  Download a secure file for a project.                                                                                 
         
  USAGE  
         
    glab securefile download <fileID> [--flags]                                                  
            
  EXAMPLES  
            
    # Download a project's secure file using the file's ID by argument or flag.                  
    $ glab securefile download 1                                                                 
    $ glab securefile download --id 1                                                            
                                                                                                 
    # Download a project's secure file using the file's ID to a given path.                      
    $ glab securefile download 1 --path="securefiles/file.txt"                                   
                                                                                                 
    # Download a project's secure file without verifying its checksum.                           
    $ glab securefile download 1 --no-verify                                                     
                                                                                                 
    # Download a project's secure file even if checksum verification fails.                      
    $ glab securefile download 1 --force-download                                                
                                                                                                 
    # Download a project's secure file using the file's name to the current directory.           
    $ glab securefile download --name my-secure-file.pem                                         
                                                                                                 
    # Download a project's secure file using the file's name to a given path.                    
    $ glab securefile download --name my-secure-file.pem --path=securefiles/some-other-name.pem  
                                                                                                 
    # Download all (limit 100) of a project's secure files.                                      
    $ glab securefile download --all                                                             
                                                                                                 
    # Download all (limit 100) of a project's secure files to a given directory.                 
    $ glab securefile download --all --output-dir secure_files/                                  
         
  FLAGS  
         
    --all             Download all (limit 100) of a project's secure files. Files are downloaded with their original name and file extension.
    --force-download  Force download file(s) even if checksum verification fails. Warning: when enabled, this setting allows the download of files that are corrupt or tampered with.
    -h --help         Show help for this command.
    --id              Id of the secure file to download.
    --name            Name of the secure file to download. Saves the file with this name, or to the path specified by --path.
    --no-verify       Do not verify the checksum of the downloaded file(s). Warning: when enabled, this setting allows the download of files that are corrupt or tampered with.
    --output-dir      Output directory for files downloaded with --all. (.)
    -p --path         Path to download the secure file to, including filename and extension. (./downloaded.tmp)
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## securefile get

```

  Get details of a project secure file. (GitLab 18.0 and later)                                                         
         
  USAGE  
         
    glab securefile get <fileID> [--flags]                            
            
  EXAMPLES  
            
    # Get details of a project's secure file using the file ID.       
    $ glab securefile get 1                                           
                                                                      
    # Get details of a project's secure file using the 'show' alias.  
    $ glab securefile show 1                                          
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## securefile list

```

  List secure files for a project.                                                                                      
         
  USAGE  
         
    glab securefile list [--flags]                                  
            
  EXAMPLES  
            
    List all secure files.                                          
    - glab securefile list                                          
                                                                    
    List all secure files with 'cmd' alias.                         
    - glab securefile ls                                            
                                                                    
    List a specific page of secure files.                           
    - glab securefile list --page 2                                 
                                                                    
    List a specific page of secure files, with a custom page size.  
    - glab securefile list --page 2 --per-page 10                   
         
  FLAGS  
         
    -h --help      Show help for this command.
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (30)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## securefile remove

```

  Remove a secure file.                                                                                                 
         
  USAGE  
         
    glab securefile remove <fileID> [--flags]            
            
  EXAMPLES  
            
    Remove a project's secure file using the file's ID.  
    - glab securefile remove 1                           
                                                         
    Skip the confirmation prompt and force delete.       
    - glab securefile remove 1 -y                        
                                                         
    Remove a project's secure file with 'rm' alias.      
    - glab securefile rm 1                               
                                                         
    Remove a project's secure file with 'delete' alias.  
    - glab securefile delete 1                           
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -y --yes   Skip the confirmation prompt.
```

