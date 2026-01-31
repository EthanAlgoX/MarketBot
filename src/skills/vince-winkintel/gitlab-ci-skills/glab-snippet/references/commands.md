# glab snippet help

> Help output captured from `glab snippet --help`.

```

  Create, view and manage snippets.                                                                                     
         
  USAGE  
         
    glab snippet <command> [command] [--flags]                                 
            
  EXAMPLES  
            
    $ glab snippet create --title "Title of the snippet" --filename "main.go"  
            
  COMMANDS  
            
    create  -t <title> <file1>                                        [<file2>...] [--flags]  Create a new snippet.
    glab snippet create  -t <title> -f <filename>  # reads from stdin                                              
         
  FLAGS  
         
    -h --help                                                                                 Show help for this command.
    -R --repo                                                                                 Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## snippet create

```

  Create a new snippet.                                                                                                 
         
  USAGE  
         
    glab snippet create -t <title> <file1> glab snippet create -t <title> -                                           
    f <filename> # reads from stdin [<file2>...] [--flags]                                                            
            
  EXAMPLES  
            
    $ glab snippet create script.py --title "Title of the snippet"                                                    
    $ echo "package main" | glab snippet new --title "Title of the snippet" --filename "main.go"                      
    $ glab snippet create -t Title -f "different.go" -d Description main.go                                           
    $ glab snippet create -t Title -f "different.go" -d Description --filename different.go main.go                   
    $ glab snippet create --personal --title "Personal snippet" script.py                                             
         
  FLAGS  
         
    -d --description  Description of the snippet. Set to "-" to open an editor.
    -f --filename     Filename of the snippet in GitLab.
    -h --help         Show help for this command.
    -p --personal     Create a personal snippet.
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -t --title        (Required) Title of the snippet.
    -v --visibility   Limit by visibility: 'public', 'internal', or 'private' (private)
```

## snippet glab

```

  Create, view and manage snippets.                                                                                     
         
  USAGE  
         
    glab snippet <command> [command] [--flags]                                 
            
  EXAMPLES  
            
    $ glab snippet create --title "Title of the snippet" --filename "main.go"  
            
  COMMANDS  
            
    create  -t <title> <file1>                                        [<file2>...] [--flags]  Create a new snippet.
    glab snippet create  -t <title> -f <filename>  # reads from stdin                                              
         
  FLAGS  
         
    -h --help                                                                                 Show help for this command.
    -R --repo                                                                                 Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

