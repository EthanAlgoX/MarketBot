# glab alias help

> Help output captured from `glab alias --help`.

```

  Create, list, and delete aliases.                                                                                     
         
  USAGE  
         
    glab alias [command] [--flags]  
            
  COMMANDS  
            
    delete <alias name> [--flags]           Delete an alias.
    list [--flags]                          List the available aliases.
    set <alias name> '<command>' [--flags]  Set an alias for a longer command.
         
  FLAGS  
         
    -h --help                               Show help for this command.
```

## alias delete

```

  Delete an alias.                                                                                                      
         
  USAGE  
         
    glab alias delete <alias name> [--flags]  
         
  FLAGS  
         
    -h --help  Show help for this command.
```

## alias list

```

  List the available aliases.                                                                                           
         
  USAGE  
         
    glab alias list [--flags]  
         
  FLAGS  
         
    -h --help  Show help for this command.
```

## alias set

```

  Declare a word as an alias for a longer command.                                                                      
                                                                                                                        
  Your expansion might include arguments and flags. If your expansion                                                   
  includes positional placeholders such as `$1` or `$2`, any extra                                                      
  arguments that follow the invocation of an alias are inserted                                                         
  appropriately.                                                                                                        
                                                                                                                        
  Specify `--shell` in your alias to run it through `sh`, a shell                                                       
  converter. Shell conversion enables you to compose commands with `|`                                                  
  or redirect with `>`, with these caveats:                                                                             
                                                                                                                        
  - Any extra arguments following the alias are not passed to the                                                       
    expanded expression arguments by default.                                                                           
  - You must explicitly accept the arguments using `$1`, `$2`, and so on.                                               
  - Use `$@` to accept all arguments.                                                                                   
                                                                                                                        
  For Windows users only:                                                                                               
                                                                                                                        
  - On Windows, shell aliases are executed with `sh` as installed by                                                    
    Git For Windows. If you installed Git in some other way in Windows,                                                 
    shell aliases might not work for you.                                                                               
  - Always use quotation marks when defining a command, as in the examples.                                             
                                                                                                                        
         
  USAGE  
         
    glab alias set <alias name> '<command>' [--flags]                            
            
  EXAMPLES  
            
    $ glab alias set mrv 'mr view'                                               
    $ glab mrv -w 123                                                            
    > glab mr view -w 123                                                        
                                                                                 
    $ glab alias set createissue 'glab create issue --title "$1"'                
    $ glab createissue "My Issue" --description "Something is broken."           
    > glab create issue --title "My Issue" --description "Something is broken."  
                                                                                 
    $ glab alias set --shell igrep 'glab issue list --assignee="$1" | grep $2'   
    $ glab igrep user foo                                                        
    > glab issue list --assignee="user" | grep "foo"                             
         
  FLAGS  
         
    -h --help   Show help for this command.
    -s --shell  Declare an alias to be passed through a shell interpreter.
```

