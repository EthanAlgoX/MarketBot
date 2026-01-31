---
name: glab-attestation
description: Use when working with glab attestation commands.
---

# glab attestation

## Overview

```

  Manage software attestations. (EXPERIMENTAL)                                                                          
         
  USAGE  
         
    glab attestation <command> [command] [--flags]                                    
            
  EXAMPLES  
            
    # Verify attestation for the filename.txt file in the gitlab-org/gitlab project.  
    $ glab attestation verify gitlab-org/gitlab filename.txt                          
                                                                                      
    # Verify attestation for the filename.txt file in the project with ID 123.        
    $ glab attestation verify 123 filename.txt                                        
            
  COMMANDS  
            
    verify <project_id> <artifact_path>  Verify the provenance of a specific artifact or file. (EXPERIMENTAL)
         
  FLAGS  
         
    -h --help                            Show help for this command.
```

## Quick start

```bash
glab attestation --help
```

## Subcommands

See [references/commands.md](references/commands.md) for full `--help` output.
