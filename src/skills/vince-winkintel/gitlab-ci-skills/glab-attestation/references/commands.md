# glab attestation help

> Help output captured from `glab attestation --help`.

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

## attestation verify

```

  This command is experimental.                                                                                         
                                                                                                                        
  For more information about attestations, see:                                                                         
                                                                                                                        
  - [Attestations API](https://docs.gitlab.com/api/attestations/)                                                       
  - [SLSA provenance specification](https://docs.gitlab.com/ci/pipeline_security/slsa/provenance_v1/)                   
  - [SLSA Software attestations](https://slsa.dev/attestation-model)                                                    
                                                                                                                        
  This command requires the cosign binary. To install it, see, [Cosign                                                  
  installation](https://docs.sigstore.dev/cosign/system_config/installation/).                                          
                                                                                                                        
  This command works with GitLab.com only.                                                                              
                                                                                                                        
         
  USAGE  
         
    glab attestation verify <project_id> <artifact_path> [--flags]                    
            
  EXAMPLES  
            
    # Verify attestation for the filename.txt file in the gitlab-org/gitlab project.  
    $ glab attestation verify gitlab-org/gitlab filename.txt                          
                                                                                      
    # Verify attestation for the filename.txt file in the project with ID 123.        
    $ glab attestation verify 123 filename.txt                                        
         
  FLAGS  
         
    -h --help  Show help for this command.
```

