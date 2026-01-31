---
name: glab-completion
description: Use when working with glab completion commands.
---

# glab completion

## Overview

```

  This command outputs code meant to be saved to a file, or immediately                                                 
  evaluated by an interactive shell. To load completions:                                                               
                                                                                                                        
  ### Bash                                                                                                              
                                                                                                                        
  To load completions in your current shell session:                                                                    
                                                                                                                        
  ```shell                                                                                                              
  source <(glab completion -s bash)                                                                                     
  ```                                                                                                                   
                                                                                                                        
  To load completions for every new session, run this command one time:                                                 
                                                                                                                        
  #### Linux                                                                                                            
                                                                                                                        
  ```shell                                                                                                              
  glab completion -s bash > /etc/bash_completion.d/glab                                                                 
  ```                                                                                                                   
                                                                                                                        
  #### macOS                                                                                                            
                                                                                                                        
  ```shell                                                                                                              
  glab completion -s bash > /usr/local/etc/bash_completion.d/glab                                                       
  ```                                                                                                                   
                                                                                                                        
  ### Zsh                                                                                                               
                                                                                                                        
  If shell completion is not already enabled in your environment you must                                               
  enable it. Run this command one time:                                                                                 
                                                                                                                        
  ```shell                                                                                                              
  echo "autoload -U compinit; compinit" >> ~/.zshrc                                                                     
  ```                                                                                                                   
                                                                                                                        
  To load completions in your current shell session:                                                                    
                                                                                                                        
  ```shell                                                                                                              
  source <(glab completion -s zsh); compdef _glab glab                                                                  
  ```                                                                                                                   
                                                                                                                        
  To load completions for every new session, run this command one time:                                                 
                                                                                                                        
  #### Linux                                                                                                            
                                                                                                                        
  ```shell                                                                                                              
  glab completion -s zsh > "${fpath[1]}/_glab"                                                                          
  ```                                                                                                                   
                                                                                                                        
  #### macOS                                                                                                            
                                                                                                                        
  For older versions of macOS, you might need this command:                                                             
                                                                                                                        
  ```shell                                                                                                              
  glab completion -s zsh > /usr/local/share/zsh/site-functions/_glab                                                    
  ```                                                                                                                   
                                                                                                                        
  The Homebrew version of glab should install completions automatically.                                                
                                                                                                                        
  ### fish                                                                                                              
                                                                                                                        
  To load completions in your current shell session:                                                                    
                                                                                                                        
  ```shell                                                                                                              
  glab completion -s fish | source                                                                                      
  ```                                                                                                                   
                                                                                                                        
  To load completions for every new session, run this command one time:                                                 
                                                                                                                        
  ```shell                                                                                                              
  glab completion -s fish > ~/.config/fish/completions/glab.fish                                                        
  ```                                                                                                                   
                                                                                                                        
  ### PowerShell                                                                                                        
                                                                                                                        
  To load completions in your current shell session:                                                                    
                                                                                                                        
  ```shell                                                                                                              
  glab completion -s powershell | Out-String | Invoke-Expression                                                        
  ```                                                                                                                   
                                                                                                                        
  To load completions for every new session, add the output of the above command                                        
  to your PowerShell profile.                                                                                           
                                                                                                                        
  When installing glab through a package manager, however, you might not need                                           
  more shell configuration to support completions.                                                                      
  For Homebrew, see [brew shell completion](https://docs.brew.sh/Shell-Completion)                                      
                                                                                                                        
         
  USAGE  
         
    glab completion [--flags]  
         
  FLAGS  
         
    -h --help   Show help for this command.
    --no-desc   Do not include shell completion description.
    -s --shell  Shell type: bash, zsh, fish, powershell. (bash)
```

## Quick start

```bash
glab completion --help
```

## Subcommands

This command has no subcommands.