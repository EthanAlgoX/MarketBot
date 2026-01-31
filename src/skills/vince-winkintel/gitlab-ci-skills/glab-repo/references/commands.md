# glab repo help

> Help output captured from `glab repo --help`.

```

  Work with GitLab repositories and projects.                                                                           
         
  USAGE  
         
    glab repo <command> [command] [--flags]  
            
  COMMANDS  
            
    archive <command> [--flags]                                                                 Get an archive of the repository.
    clone <repo>               [<dir>] [-- <gitflags>...] [<dir>] [-- <gitflags>...] [--flags]  Clone a GitLab repository or project.
    glab repo clone -g <group>                                                                                                       
    contributors [--flags]                                                                      Get repository contributors list.
    create [path] [--flags]                                                                     Create a new GitLab project/repository.
    delete <NAME> [<NAMESPACE>/] [--flags]                                                      Delete an existing project on GitLab.
    fork <repo> [--flags]                                                                       Fork a GitLab repository.
    list [--flags]                                                                              Get list of repositories.
    members <command> [command] [--flags]                                                       Manage project members.
    mirror [ID | URL | PATH] [--flags]                                                          Configure mirroring on an existing project to sync with a remote repository.
    publish <command> [command] [--flags]                                                       Publishes resources in the project.
    search [--flags]                                                                            Search for GitLab repositories and projects by name.
    transfer [repo] [--flags]                                                                   Transfer a repository to a new namespace.
    update [path] [--flags]                                                                     Update an existing GitLab project or repository.
    view [repository] [--flags]                                                                 View a project or repository.
         
  FLAGS  
         
    -h --help                                                                                   Show help for this command.
```

## repo archive

```

  Clone supports these shorthand references:                                                                            
                                                                                                                        
  - repo                                                                                                                
  - namespace/repo                                                                                                      
  - namespace/group/repo                                                                                                
                                                                                                                        
         
  USAGE  
         
    glab repo archive <command> [--flags]                     
            
  EXAMPLES  
            
    $ glab repo archive profclems/glab                        
                                                              
    # Downloads zip file of current repository                
    $ glab repo archive                                       
                                                              
    # Downloads repo zip file into mydirectory                
    $ glab repo archive profclems/glab mydirectory            
                                                              
    # Finds repo for current user and download in ZIP format  
    $ glab repo archive profclems/glab --format=zip           
         
  FLAGS  
         
    -f --format  Optional. Specify format if you want a downloaded archive: tar.gz, tar.bz2, tbz, tbz2, tb2, bz2, tar, zip. (zip)
    -h --help    Show help for this command.
    -s --sha     The commit SHA to download. A tag, branch reference, or SHA can be used. Defaults to the tip of the default branch if not specified.
```

## repo clone

```

  Clone supports these shorthand references:                                                                            
                                                                                                                        
  - repo                                                                                                                
  - namespace/repo                                                                                                      
  - org/group/repo                                                                                                      
  - project ID                                                                                                          
                                                                                                                        
         
  USAGE  
         
    glab repo clone <repo> glab repo clone -g <group> [<dir>] [-- <gitflags>...] [<dir>] [-- <gitflags>...] [--       
    flags]                                                                                                            
            
  EXAMPLES  
            
    # Clones repository into current directory                                                                        
    $ glab repo clone gitlab-org/cli                                                                                  
    $ glab repo clone https://gitlab.com/gitlab-org/cli                                                               
                                                                                                                      
    # Clones repository into 'mydirectory'                                                                            
    $ glab repo clone gitlab-org/cli mydirectory                                                                      
                                                                                                                      
    # Clones repository 'glab' for current user                                                                       
    $ glab repo clone glab                                                                                            
                                                                                                                      
    # Finds the project by the ID provided and clones it                                                              
    $ glab repo clone 4356677                                                                                         
                                                                                                                      
    # Clones all repos in a group                                                                                     
    $ glab repo clone -g everyonecancontribute --paginate                                                             
                                                                                                                      
    # Clones all non-archived repos in a group                                                                        
    $ glab repo clone -g everyonecancontribute --archived=false --paginate                                            
                                                                                                                      
    # Clones only active projects in a group                                                                          
    $ glab repo clone -g everyonecancontribute --active=true --paginate                                               
                                                                                                                      
    # Clones from a GitLab Self-Managed or GitLab Dedicated instance                                                  
    $ GITLAB_HOST=salsa.debian.org glab repo clone myrepo                                                             
         
  FLAGS  
         
    -g --group                Specify the group to clone repositories from.
    -p --preserve-namespace   Clone the repository in a subdirectory based on namespace.
    --active                  Limit by project status. When true, returns active projects. When false, returns projects that are archived or marked for deletion. Used with the --group flag.
    -a --archived             Limit by archived status. Use with '-a=false' to exclude archived repositories. Used with the --group flag.
    -G --include-subgroups    Include projects in subgroups of this group. Default is true. Used with the --group flag. (true)
    -m --mine                 Limit by projects in the group owned by the current authenticated user. Used with the --group flag.
    -v --visibility           Limit by visibility: public, internal, private. Used with the --group flag.
    -I --with-issues-enabled  Limit by projects with the issues feature enabled. Default is false. Used with the --group flag.
    -M --with-mr-enabled      Limit by projects with the merge request feature enabled. Default is false. Used with the --group flag.
    -S --with-shared          Include projects shared to this group. Default is true. Used with the --group flag. (true)
    --paginate                Make additional HTTP requests to fetch all pages of projects before cloning. Respects --per-page.
    --page                    Page number. (1)
    --per-page                Number of items to list per page. (30)
    -h --help                 Show help for this command.
```

## repo glab

```

  Work with GitLab repositories and projects.                                                                           
         
  USAGE  
         
    glab repo <command> [command] [--flags]  
            
  COMMANDS  
            
    archive <command> [--flags]                                                                 Get an archive of the repository.
    clone <repo>               [<dir>] [-- <gitflags>...] [<dir>] [-- <gitflags>...] [--flags]  Clone a GitLab repository or project.
    glab repo clone -g <group>                                                                                                       
    contributors [--flags]                                                                      Get repository contributors list.
    create [path] [--flags]                                                                     Create a new GitLab project/repository.
    delete <NAME> [<NAMESPACE>/] [--flags]                                                      Delete an existing project on GitLab.
    fork <repo> [--flags]                                                                       Fork a GitLab repository.
    list [--flags]                                                                              Get list of repositories.
    members <command> [command] [--flags]                                                       Manage project members.
    mirror [ID | URL | PATH] [--flags]                                                          Configure mirroring on an existing project to sync with a remote repository.
    publish <command> [command] [--flags]                                                       Publishes resources in the project.
    search [--flags]                                                                            Search for GitLab repositories and projects by name.
    transfer [repo] [--flags]                                                                   Transfer a repository to a new namespace.
    update [path] [--flags]                                                                     Update an existing GitLab project or repository.
    view [repository] [--flags]                                                                 View a project or repository.
         
  FLAGS  
         
    -h --help                                                                                   Show help for this command.
```

## repo contributors

```

  Get repository contributors list.                                                                                     
         
  USAGE  
         
    glab repo contributors [--flags]                       
            
  EXAMPLES  
            
    # List contributors for the current repository         
    $ glab repo contributors                               
                                                           
    # List contributors for a specific repository          
    $ glab repo contributors -R gitlab-com/www-gitlab-com  
         
  FLAGS  
         
    -h --help      Show help for this command.
    -o --order     Return contributors ordered by name, email, or commits (orders by commit date) fields. (commits)
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (30)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -s --sort      Sort direction for --order field: asc or desc.
```

## repo create

```

  Creates the new project with your first configured host in your `glab`                                                
  configuration. The host defaults to `GitLab.com` if not set. To set a host,                                           
  provide either:                                                                                                       
                                                                                                                        
  - A `GITLAB_HOST` environment variable.                                                                               
  - A full URL for the project.                                                                                         
                                                                                                                        
         
  USAGE  
         
    glab repo create [path] [--flags]                                           
            
  EXAMPLES  
            
    # Create a repository under your account using the current directory name.  
    $ glab repo create                                                          
                                                                                
    # Create a repository under a group using the current directory name.       
    $ glab repo create --group glab-cli                                         
                                                                                
    # Create a repository with a specific name.                                 
    $ glab repo create my-project                                               
                                                                                
    # Create a repository for a group.                                          
    $ glab repo create glab-cli/my-project                                      
                                                                                
    # Create on a host other than gitlab.com.                                   
    $ GITLAB_HOST=example.com glab repo create                                  
    $ glab repo create <host>/path/to/repository                                
         
  FLAGS  
         
    --defaultBranch   Default branch of the project. Defaults to `master` if not provided.
    -d --description  Description of the new project. Set to "-" to open an editor.
    -g --group        Namespace or group for the new project. Defaults to the current user's namespace.
    -h --help         Show help for this command.
    --internal        Make project internal: visible to any authenticated user. Default.
    -n --name         Name of the new project.
    -p --private      Make project private: visible only to project members.
    -P --public       Make project public: visible without any authentication.
    --readme          Initialize project with `README.md`.
    --remoteName      Remote name for the Git repository you're in. Defaults to `origin` if not provided. (origin)
    -s --skipGitInit  Skip run 'git init'.
    -t --tag          The list of tags for the project.
```

## repo delete

```

  Delete an existing project on GitLab.                                                                                 
                                                                                                                        
  This permanently deletes the entire project, including:                                                               
                                                                                                                        
  - The Git repository.                                                                                                 
  - Issues and merge requests.                                                                                          
  - Wiki pages.                                                                                                         
  - CI/CD pipelines and job artifacts.                                                                                  
  - Other project content and settings.                                                                                 
                                                                                                                        
  This action cannot be undone.                                                                                         
                                                                                                                        
         
  USAGE  
         
    glab repo delete <NAME> [<NAMESPACE>/] [--flags]          
            
  EXAMPLES  
            
    # Delete a personal project.                              
    $ glab repo delete dotfiles                               
                                                              
    # Delete a project in a GitLab group, or another project  
    # you have write access to:                               
    $ glab repo delete mygroup/dotfiles                       
    $ glab repo delete myorg/mynamespace/dotfiles             
         
  FLAGS  
         
    -h --help  Show help for this command.
    -y --yes   Skip the confirmation prompt and immediately delete the project.
```

## repo fork

```

  Fork a GitLab repository.                                                                                             
         
  USAGE  
         
    glab repo fork <repo> [--flags]          
            
  EXAMPLES  
            
    $ glab repo fork                         
    $ glab repo fork namespace/repo          
    $ glab repo fork namespace/repo --clone  
         
  FLAGS  
         
    -c --clone  Clone the fork. Options: true, false.
    -h --help   Show help for this command.
    -n --name   The name assigned to the new project after forking.
    -p --path   The path assigned to the new project after forking.
    --remote    Add a remote for the fork. Options: true, false.
```

## repo list

```

  Get list of repositories.                                                                                             
         
  USAGE  
         
    glab repo list [--flags]  
            
  EXAMPLES  
            
    $ glab repo list          
         
  FLAGS  
         
    -a --all                List all projects on the instance.
    --archived              Limit by archived status. Use 'false' to exclude archived repositories. Used with the '--group' flag.
    -g --group              Return repositories in only the given group.
    -h --help               Show help for this command.
    -G --include-subgroups  Include projects in subgroups of this group. Default is false. Used with the '--group' flag.
    --member                List only projects of which you are a member.
    -m --mine               List only projects you own. Default if no filters are provided.
    -o --order              Return repositories ordered by id, name, path, created_at, updated_at, similarity, star_count, last_activity_at. (last_activity_at)
    -F --output             Format output as: text, json. (text)
    -p --page               Page number. (1)
    -P --per-page           Number of items to list per page. (30)
    -s --sort               Sort direction for --order field: asc or desc.
    --starred               List only starred projects.
    -u --user               List user projects.
```

## repo members

```

  Add or remove members from a GitLab project.                                                                          
                                                                                                                        
         
  USAGE  
         
    glab repo members <command> [command] [--flags]  
            
  COMMANDS  
            
    add [--flags]     Add a member to the project.
    remove [--flags]  Remove a member from the project.
         
  FLAGS  
         
    -h --help         Show help for this command.
```

## repo mirror

```

  Configure repository mirroring for an existing GitLab project.                                                        
                                                                                                                        
  The GitLab project must already exist. This command configures mirroring                                              
  on existing projects but does not create new projects.                                                                
                                                                                                                        
  Mirror types:                                                                                                         
                                                                                                                        
  - Pull mirror: Syncs changes from an external repository to your GitLab project. The external repository is the source
  of truth. Use pull mirrors to sync from GitHub, Bitbucket, or other GitLab instances.                                 
  - Push mirror: Syncs changes from your GitLab project to an external repository. Your GitLab project is the source of 
  truth. Use push mirrors to sync to GitHub, Bitbucket, or other GitLab instances.                                      
                                                                                                                        
  Authentication:                                                                                                       
                                                                                                                        
  - For pull mirrors from private repositories, embed credentials in the URL:                                           
  `https://username:token@gitlab.example.com/org/repo`                                                                  
  - For push mirrors to private repositories, configure credentials in the GitLab UI or use SSH URLs with deploy keys.  
                                                                                                                        
         
  USAGE  
         
    glab repo mirror [ID | URL | PATH] [--flags]                                                                      
            
  EXAMPLES  
            
    # Create a project, then configure pull mirroring                                                                 
    $ glab repo create mygroup/myproject --public                                                                     
    $ glab repo mirror mygroup/myproject --direction=pull --url="https://gitlab.example.com/org/repo"                 
                                                                                                                      
    # Configure pull mirroring from a private repository                                                              
    $ glab repo mirror mygroup/myproject --direction=pull --url="https://username:token@gitlab.example.com/org/priv…  
                                                                                                                      
    # Configure pull mirroring for protected branches only                                                            
    $ glab repo mirror mygroup/myproject --direction=pull --url="https://gitlab.example.com/org/repo" --protected-b…  
                                                                                                                      
    # Configure push mirroring to another GitLab instance                                                             
    $ glab repo mirror mygroup/myproject --direction=push --url="https://gitlab-backup.example.com/backup/myproject"  
                                                                                                                      
    # Configure push mirroring and allow divergent refs                                                               
    $ glab repo mirror mygroup/myproject --direction=push --url="https://gitlab-backup.example.com/backup/repo" --a…  
         
  FLAGS  
         
    --allow-divergence         Determines if divergent refs are skipped.
    --direction                Mirror direction. Options: pull, push. (pull)
    --enabled                  Determines if the mirror is enabled. (true)
    -h --help                  Show help for this command.
    --protected-branches-only  Determines if only protected branches are mirrored.
    --url                      The target URL to which the repository is mirrored.
```

## repo publish

```

  Publishes resources in the project.                                                                                   
                                                                                                                        
  Currently only supports publishing CI/CD components to the catalog.                                                   
                                                                                                                        
         
  USAGE  
         
    glab repo publish <command> [command] [--flags]  
            
  COMMANDS  
            
    catalog <tag-name>  [Experimental] Publishes CI/CD components to the catalog.
         
  FLAGS  
         
    -h --help           Show help for this command.
```

## repo search

```

  Search for GitLab repositories and projects by name.                                                                  
         
  USAGE  
         
    glab repo search [--flags]        
            
  EXAMPLES  
            
    $ glab project search -s "title"  
    $ glab repo search -s "title"     
    $ glab project find -s "title"    
    $ glab project lookup -s "title"  
         
  FLAGS  
         
    -h --help      Show help for this command.
    -F --output    Format output as: text, json. (text)
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (20)
    -s --search    A string contained in the project name.
```

## repo transfer

```

  Transfer a repository to a new namespace.                                                                             
         
  USAGE  
         
    glab repo transfer [repo] [--flags]                                  
            
  EXAMPLES  
            
    $ glab repo transfer profclems/glab --target-namespace notprofclems  
         
  FLAGS  
         
    -h --help              Show help for this command.
    -t --target-namespace  The namespace where your project should be transferred to.
    -y --yes               Warning: Skip confirmation prompt and force transfer operation. Transfer cannot be undone.
```

## repo update

```

  Update an existing GitLab project or repository.                                                                      
         
  USAGE  
         
    glab repo update [path] [--flags]                                    
            
  EXAMPLES  
            
    # Update the description for my-project.                             
    $ glab repo update my-project --description "This project is cool."  
                                                                         
    # Update the default branch for my-project.                          
    $ glab repo update my-project --defaultBranch main                   
                                                                         
    # Archive my-project.                                                
    $ glab repo update my-project --archive                              
    $ glab repo update my-project --archive=true                         
                                                                         
    # Unarchive my-project.                                              
    $ glab repo update my-project --archive=false                        
         
  FLAGS  
         
    --archive         Whether the project should be archived.
    --defaultBranch   New default branch for the project.
    -d --description  New description for the project.
    -h --help         Show help for this command.
```

## repo view

```

  Display the description and README of a project, or open it in the browser.                                           
                                                                                                                        
         
  USAGE  
         
    glab repo view [repository] [--flags]                      
            
  EXAMPLES  
            
    # View project information for the current directory.      
    # Must be a Git repository.                                
    $ glab repo view                                           
                                                               
    # View project information of specified name.              
    # glab repo view my-project                                
    $ glab repo view user/repo                                 
    $ glab repo view group/namespace/repo                      
                                                               
    # Specify repository by full [Git] URL.                    
    $ glab repo view git@gitlab.com:user/repo.git              
    $ glab repo view https://gitlab.company.org/user/repo      
    $ glab repo view https://gitlab.company.org/user/repo.git  
         
  FLAGS  
         
    -b --branch  View a specific branch of the repository.
    -h --help    Show help for this command.
    -F --output  Format output as: text, json. (text)
    -w --web     Open a project in the browser.
```

