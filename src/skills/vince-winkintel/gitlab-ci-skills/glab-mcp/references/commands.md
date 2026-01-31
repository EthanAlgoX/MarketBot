# glab mcp help

> Help output captured from `glab mcp --help`.

```

  Manage Model Context Protocol server features for GitLab integration.                                                 
                                                                                                                        
  The MCP server exposes GitLab features as tools for use by                                                            
  AI assistants (like Claude Code) to interact with GitLab projects, issues,                                            
  merge requests, pipelines, and other resources.                                                                       
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab mcp <command> [command] [--flags]  
            
  EXAMPLES  
            
    $ glab mcp serve                        
            
  COMMANDS  
            
    serve      Start a MCP server with stdio transport. (EXPERIMENTAL)
         
  FLAGS  
         
    -h --help  Show help for this command.
```

## mcp serve

```

  Start a Model Context Protocol server to expose GitLab features                                                       
  as tools for AI assistants like Claude Code.                                                                          
                                                                                                                        
  The server uses stdio (standard input and output) transport for                                                       
  communication, and provides tools to:                                                                                 
                                                                                                                        
  - Manage issues (list, create, update, close, add notes)                                                              
  - Manage merge requests (list, create, update, merge, add notes)                                                      
  - Manage projects (list, get details)                                                                                 
  - Manage CI/CD pipelines and jobs                                                                                     
                                                                                                                        
  To configure this server in Claude Code, add this code to your                                                        
  MCP settings:                                                                                                         
                                                                                                                        
  ```json                                                                                                               
  {                                                                                                                     
    "mcpServers": {                                                                                                     
      "glab": {                                                                                                         
        "type": "stdio",                                                                                                
        "command": "glab",                                                                                              
        "args": ["mcp", "serve"]                                                                                        
      }                                                                                                                 
    }                                                                                                                   
  }                                                                                                                     
  ```                                                                                                                   
                                                                                                                        
  This feature is experimental. It might be broken or removed without any prior notice.                                 
  Read more about what experimental features mean at                                                                    
  https://docs.gitlab.com/policy/development_stages_support/                                                            
                                                                                                                        
  Use experimental features at your own risk.                                                                           
                                                                                                                        
         
  USAGE  
         
    glab mcp serve [--flags]  
            
  EXAMPLES  
            
    $ glab mcp serve          
         
  FLAGS  
         
    -h --help  Show help for this command.
```

