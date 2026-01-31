# glab release help

> Help output captured from `glab release --help`.

```

  Manage GitLab releases.                                                                                               
         
  USAGE  
         
    glab release <command> [command] [--flags]  
            
  COMMANDS  
            
    create <tag> [<files>...] [--flags]  Create a new GitLab release, or update an existing one.
    delete <tag> [--flags]               Delete a GitLab release.
    download <tag> [--flags]             Download asset files from a GitLab release.
    list [--flags]                       List releases in a repository.
    upload <tag> [<files>...] [--flags]  Upload release asset files or links to a GitLab release.
    view <tag> [--flags]                 View information about a GitLab release.
         
  FLAGS  
         
    -h --help                            Show help for this command.
    -R --repo                            Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## release create

```

  Create a new GitLab release for a repository, or                                                                      
  update an existing one. Requires at least the Developer role.                                                         
                                                                                                                        
  An existing release is updated with the new information you provide.                                                  
                                                                                                                        
  To create a release from an annotated Git tag:                                                                        
                                                                                                                        
  1. Create the tag locally with Git, and push the tag to GitLab.                                                       
  2. Run this command.                                                                                                  
  3. If the Git tag you specify doesn't exist, the command creates a                                                    
     release from the latest state of the default branch, and tags it                                                   
     with the tag name you specify.                                                                                     
                                                                                                                        
     To override this behavior, use `--ref`. The `ref`                                                                  
     can be a commit SHA, another tag name, or a branch name.                                                           
  4. Optional. To fetch the new tag locally after the release, run                                                      
     `git fetch --tags origin`.                                                                                         
                                                                                                                        
         
  USAGE  
         
    glab release create <tag> [<files>...] [--flags]                                                 
            
  EXAMPLES  
            
    # Create a release interactively                                                                 
    $ glab release create v1.0.1                                                                     
                                                                                                     
    # Create a release non-interactively by specifying a note                                        
    $ glab release create v1.0.1 --notes "bugfix release"                                            
                                                                                                     
    # Use release notes from a file                                                                  
    $ glab release create v1.0.1 -F changelog.md                                                     
                                                                                                     
    # Upload a release asset with a display name (type will default to 'other')                      
    $ glab release create v1.0.1 '/path/to/asset.zip#My display label'                               
                                                                                                     
    # Upload a release asset with a display name and type                                            
    $ glab release create v1.0.1 '/path/to/asset.png#My display label#image'                         
                                                                                                     
    # Upload all assets in a specified folder (types default to 'other')                             
    $ glab release create v1.0.1 ./dist/*                                                            
                                                                                                     
    # Upload all tarballs in a specified folder (types default to 'other')                           
    $ glab release create v1.0.1 ./dist/*.tar.gz                                                     
                                                                                                     
    # Create a release with assets specified as JSON object                                          
    $ glab release create v1.0.1 --assets-links='                                                    
    [                                                                                                
    {                                                                                                
    "name": "Asset1",                                                                                
    "url":"https://<domain>/some/location/1",                                                        
    "link_type": "other",                                                                            
    "direct_asset_path": "path/to/file"                                                              
    }                                                                                                
    ]'                                                                                               
                                                                                                     
    # (EXPERIMENTAL) Create a release and publish it to the GitLab CI/CD catalog                     
    # Requires the feature flag `ci_release_cli_catalog_publish_option` to be enabled                
    # for this project in your GitLab instance. Do NOT run this manually. Use it as part             
    # of a CI/CD pipeline with the "release" keyword:                                                
    #                                                                                                
    # - It retrieves components from the current repository by searching for                         
    #   `yml` files within the "templates" directory and its subdirectories.                         
    # - It fails if the feature flag `ci_release_cli_catalog_publish_option`                         
    #   is not enabled for this project in your GitLab instance.                                     
                                                                                                     
    # Components can be defined:                                                                     
                                                                                                     
    # - In single files ending in `.yml` for each component, like `templates/secret-detection.yml`.  
    # - In subdirectories containing `template.yml` files as entry points,                           
    #   for components that bundle together multiple related files. For example,                     
    #   `templates/secret-detection/template.yml`.                                                   
                                                                                                     
    $ glab release create v1.0.1 --publish-to-catalog                                                
         
  FLAGS  
         
    -a --assets-links       Json string representation of assets links. See documentation for example.
    -h --help               Show help for this command.
    -m --milestone          The title of each milestone the release is associated with. Multiple milestones can be comma-separated or specified by repeating the flag.
    -n --name               The release name or title.
    --no-close-milestone    Prevent closing milestones after creating the release.
    --no-update             Prevent updating the existing release.
    -N --notes              The release notes or description. Accepts Markdown.
    -F --notes-file         Read release notes 'file'. To read from stdin, use '-'.
    --package-name          The package name, when uploading assets to the generic package release with --use-package-registry. (release-assets)
    --publish-to-catalog    (Experimental) Publish the release to the GitLab CI/CD catalog.
    -r --ref                If the specified tag doesn't exist, create a release from the ref and tag it with the specified tag name. Accepts a commit SHA, tag name, or branch name.
    -D --released-at        Iso 8601 datetime when the release was ready. Defaults to the current datetime.
    -R --repo               Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -T --tag-message        Message to use if creating a new annotated tag.
    --use-package-registry  Upload release assets to the generic package registry of the project. Overrides the GITLAB_RELEASE_ASSETS_USE_PACKAGE_REGISTRY environment variable.
```

## release delete

```

  Delete release assets to GitLab release. Requires the Maintainer role or higher.                                      
                                                                                                                        
  Deleting a release does not delete the associated tag, unless you specify `--with-tag`.                               
                                                                                                                        
         
  USAGE  
         
    glab release delete <tag> [--flags]              
            
  EXAMPLES  
            
    # Delete a release (with a confirmation prompt)  
    $ glab release delete v1.1.0                     
                                                     
    # Skip the confirmation prompt and force delete  
    $ glab release delete v1.0.1 -y                  
                                                     
    # Delete release and associated tag              
    $ glab release delete v1.0.1 --with-tag          
         
  FLAGS  
         
    -h --help      Show help for this command.
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -t --with-tag  Delete the associated tag.
    -y --yes       Skip the confirmation prompt.
```

## release download

```

  Download asset files from a GitLab release.                                                                           
                                                                                                                        
  If no tag is specified, downloads assets from the latest release.                                                     
  To specify a file name to download from the release assets, use `--asset-name`.                                       
  `--asset-name` flag accepts glob patterns.                                                                            
                                                                                                                        
         
  USAGE  
         
    glab release download <tag> [--flags]                    
            
  EXAMPLES  
            
    # Download all assets from the latest release            
    $ glab release download                                  
                                                             
    # Download all assets from the specified release tag     
    $ glab release download v1.1.0                           
                                                             
    # Download assets with names matching the glob pattern   
    $ glab release download v1.10.1 --asset-name="*.tar.gz"  
         
  FLAGS  
         
    -n --asset-name  Download only assets that match the name or a glob pattern.
    -D --dir         Directory to download the release assets to. (.)
    -h --help        Show help for this command.
    -R --repo        Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## release list

```

  List releases in a repository.                                                                                        
         
  USAGE  
         
    glab release list [--flags]  
         
  FLAGS  
         
    -h --help      Show help for this command.
    -p --page      Page number. (1)
    -P --per-page  Number of items to list per page. (30)
    -R --repo      Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## release upload

```

  Upload release assets to a GitLab release.                                                                            
                                                                                                                        
  Define the display name by appending '#' after the filename.                                                          
  The link type comes after the display name, like this: 'myfile.tar.gz#My display name#package'                        
                                                                                                                        
         
  USAGE  
         
    glab release upload <tag> [<files>...] [--flags]                           
            
  EXAMPLES  
            
    # Upload a release asset with a display name. 'Type' defaults to 'other'.  
    $ glab release upload v1.0.1 '/path/to/asset.zip#My display label'         
                                                                               
    # Upload a release asset with a display name and type.                     
    $ glab release upload v1.0.1 '/path/to/asset.png#My display label#image'   
                                                                               
    # Upload all assets in a specified folder. 'Type' defaults to 'other'.     
    $ glab release upload v1.0.1 ./dist/*                                      
                                                                               
    # Upload all tarballs in a specified folder. 'Type' defaults to 'other'.   
    $ glab release upload v1.0.1 ./dist/*.tar.gz                               
                                                                               
    # Upload release assets links specified as JSON string                     
    $ glab release upload v1.0.1 --assets-links='                              
    [                                                                          
    {                                                                          
    "name": "Asset1",                                                          
    "url":"https://<domain>/some/location/1",                                  
    "link_type": "other",                                                      
    "direct_asset_path": "path/to/file"                                        
    }                                                                          
    ]'                                                                         
         
  FLAGS  
         
    -a --assets-links       `Json` string representation of assets links, like: `--assets-links='[{"name": "Asset1", "url":"https://<domain>/some/location/1", "link_type": "other", "direct_asset_path": "path/to/file"}]'.`
    -h --help               Show help for this command.
    --package-name          The package name to use when uploading the assets to the generic package release with --use-package-registry. (release-assets)
    -R --repo               Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --use-package-registry  Upload release assets to the generic package registry of the project. Alternatively to this flag you may also set the GITLAB_RELEASE_ASSETS_USE_PACKAGE_REGISTRY environment variable to either the value true or 1. The flag takes precedence over this environment variable.
```

## release view

```

  View information about a GitLab release.                                                                              
                                                                                                                        
  Without an explicit tag name argument, shows the latest release in the project.                                       
                                                                                                                        
         
  USAGE  
         
    glab release view <tag> [--flags]                 
            
  EXAMPLES  
            
    # View the latest release of a GitLab repository  
    $ glab release view                               
                                                      
    # View a release with specified tag name          
    $ glab release view v1.0.1                        
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -w --web   Open the release in the browser.
```

