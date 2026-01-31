# glab duo help

> Help output captured from `glab duo --help`.

```

  Work with GitLab Duo, our AI-native assistant for the command line.                                                   
                                                                                                                        
  GitLab Duo for the CLI integrates AI capabilities directly into your terminal                                         
  workflow. It helps you retrieve forgotten Git commands and offers guidance on                                         
  Git operations. You can accomplish specific tasks without switching contexts.                                         
                                                                                                                        
         
  USAGE  
         
    glab duo <command> prompt [command] [--flags]  
            
  COMMANDS  
            
    ask <prompt> [--flags]  Generate Git commands from natural language.
         
  FLAGS  
         
    -h --help               Show help for this command.
```

## duo ask

```

  Generate Git commands from natural language using AI assistance.                                                      
                                                                                                                        
  Describe what you want to do in plain language, and GitLab Duo suggests the                                           
  appropriate Git commands. The AI provides both the commands and an explanation.                                       
                                                                                                                        
  After you receive the suggested commands, you can execute them directly from                                          
  the CLI. You must confirm each command before it runs.                                                                
                                                                                                                        
  Use this command to:                                                                                                  
                                                                                                                        
  - Retrieve forgotten Git commands.                                                                                    
  - Learn how to accomplish specific Git operations.                                                                    
  - Get guidance on complex Git workflows.                                                                              
  - Reduce context switching during development.                                                                        
                                                                                                                        
         
  USAGE  
         
    glab duo ask <prompt> [--flags]                                                                                   
            
  EXAMPLES  
            
    $ glab duo ask list last 10 commit titles                                                                         
    > A list of Git commands to show the titles of the latest 10 commits with an explanation and an option to execu…  
                                                                                                                      
    $ glab duo ask how do I undo my last commit                                                                       
    > Suggestions for undoing the last commit with explanations of different approaches.                              
                                                                                                                      
    $ glab duo ask show me files changed in the last commit                                                           
    > Commands to display files modified in the most recent commit.                                                   
         
  FLAGS  
         
    --git      Ask a question about Git. (true)
    -h --help  Show help for this command.
```

