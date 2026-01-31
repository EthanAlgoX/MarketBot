# glab config help

> Help output captured from `glab config --help`.

```

  Manage key/value strings.                                                                                             
                                                                                                                        
  Current respected settings:                                                                                           
                                                                                                                        
  - browser: If unset, uses the default browser. Override with environment variable $BROWSER.                           
  - check_update: If true, notifies of new versions of glab. Defaults to true. Override with environment variable       
  $GLAB_CHECK_UPDATE.                                                                                                   
  - display_hyperlinks: If true, and using a TTY, outputs hyperlinks for issues and merge request lists. Defaults to    
  false.                                                                                                                
  - editor: If unset, uses the default editor. Override with environment variable $EDITOR.                              
  - glab_pager: Your desired pager command to use, such as 'less -R'.                                                   
  - glamour_style: Your desired Markdown renderer style. Options are dark, light, notty. Custom styles are available    
  using [glamour](https://github.com/charmbracelet/glamour#styles).                                                     
  - host: If unset, defaults to `https://gitlab.com`.                                                                   
  - token: Your GitLab access token. Defaults to environment variables.                                                 
  - visual: Takes precedence over 'editor'. If unset, uses the default editor. Override with environment variable       
  $VISUAL.                                                                                                              
                                                                                                                        
         
  USAGE  
         
    glab config [command] [--flags]  
            
  COMMANDS  
            
    edit [--flags]               Opens the glab configuration file.
    get <key> [--flags]          Prints the value of a given configuration key.
    set <key> <value> [--flags]  Updates configuration with the value of a given key.
         
  FLAGS  
         
    -g --global                  Use global config file.
    -h --help                    Show help for this command.
```

## config edit

```

  Opens the glab configuration file.                                                                                    
  The command uses the following order when choosing the editor to use:                                                 
                                                                                                                        
  1. 'glab_editor' field in the configuration file                                                                      
  2. 'VISUAL' environment variable                                                                                      
  3. 'EDITOR' environment variable                                                                                      
                                                                                                                        
         
  USAGE  
         
    glab config edit [--flags]                                        
            
  EXAMPLES  
            
    Open the configuration file with the default editor               
    - glab config edit                                                
                                                                      
    Open the configuration file with vim                              
    - EDITOR=vim glab config edit                                     
                                                                      
    Set vim to be used for all future 'glab config edit' invocations  
    - glab config set editor vim                                      
    - glab config edit                                                
                                                                      
    Open the local configuration file with the default editor         
    - glab config edit -l                                             
         
  FLAGS  
         
    -h --help   Show help for this command.
    -l --local  Open '.git/glab-cli/config.yml' file instead of the global '~/.config/glab-cli/config.yml' file.
```

## config get

```

  Prints the value of a given configuration key.                                                                        
         
  USAGE  
         
    glab config get <key> [--flags]  
            
  EXAMPLES  
            
    $ glab config get editor         
    > vim                            
                                     
    $ glab config get glamour_style  
    > notty                          
         
  FLAGS  
         
    -g --global  Read from global config file (~/.config/glab-cli/config.yml). (default checks 'Environment variables → Local → Global')
    -h --help    Show help for this command.
    --host       Get per-host setting.
```

## config set

```

  Update the configuration by setting a key to a value.                                                                 
  Use 'glab config set --global' to set a global config.                                                                
  Specifying the '--host' flag also saves in the global configuration file.                                             
                                                                                                                        
         
  USAGE  
         
    glab config set <key> <value> [--flags]          
            
  EXAMPLES  
            
    - glab config set editor vim                     
    - glab config set token xxxxx --host gitlab.com  
    - glab config set check_update false --global    
         
  FLAGS  
         
    -g --global  Write to global '~/.config/glab-cli/config.yml' file rather than the repository's '.git/glab-cli/config.yml' file.
    -h --help    Show help for this command.
    --host       Set per-host setting.
```

