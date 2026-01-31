# glab cluster help

> Help output captured from `glab cluster --help`.

```

  Manage GitLab Agents for Kubernetes and their clusters.                                                               
         
  USAGE  
         
    glab cluster <command> [command] [--flags]  
            
  COMMANDS  
            
    agent <command> [command] [--flags]  Manage GitLab Agents for Kubernetes.
    graph [--flags]                      Queries the Kubernetes object graph, using the GitLab Agent for Kubernetes. (EXPERIMENTAL)
         
  FLAGS  
         
    -h --help                            Show help for this command.
    -R --repo                            Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## cluster agent

```

  Manage GitLab Agents for Kubernetes.                                                                                  
         
  USAGE  
         
    glab cluster agent <command> [command] [--flags]  
            
  COMMANDS  
            
    bootstrap agent-name [--flags]             Bootstrap a GitLab Agent for Kubernetes in a project.
    check_manifest_usage [--flags]             Check agent configuration files for built-in GitOps manifests usage. (EXPERIMENTAL)
    get-token [--flags]                        Create and return a k8s_proxy-scoped personal access token to authenticate with a GitLab Agents for Kubernetes.
    list [--flags]                             List GitLab Agents for Kubernetes in a project.
    token <command> [command] [--flags]        Manage GitLab Agents for Kubernetes tokens.
    token-cache <command> [command] [--flags]  Manage cached GitLab Agent tokens.
    update-kubeconfig [--flags]                Update selected kubeconfig.
         
  FLAGS  
         
    -h --help                                  Show help for this command.
    -R --repo                                  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## cluster graph

``` 
panic: runtime error: index out of range [0] with length 0

Note: `glab cluster graph --help` currently panics in this version of glab. The output above is the raw error from the help command.
```

