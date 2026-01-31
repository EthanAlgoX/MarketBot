---
name: glab-api
description: Use when working with glab api commands.
---

# glab api

## Overview

```

  Makes an authenticated HTTP request to the GitLab API, and prints the response.                                       
  The endpoint argument should either be a path of a GitLab API v4 endpoint, or                                         
  `graphql` to access the GitLab GraphQL API.                                                                           
                                                                                                                        
  - [GitLab REST API documentation](https://docs.gitlab.com/api/)                                                       
  - [GitLab GraphQL documentation](https://docs.gitlab.com/api/graphql/)                                                
                                                                                                                        
  If the current directory is a Git directory, uses the GitLab authenticated host in the current                        
  directory. Otherwise, `gitlab.com` will be used.                                                                      
  To override the GitLab hostname, use `--hostname`.                                                                    
                                                                                                                        
  These placeholder values, when used in the endpoint argument, are                                                     
  replaced with values from the repository of the current directory:                                                    
                                                                                                                        
  - `:branch`                                                                                                           
  - `:fullpath`                                                                                                         
  - `:group`                                                                                                            
  - `:id`                                                                                                               
  - `:namespace`                                                                                                        
  - `:repo`                                                                                                             
  - `:user`                                                                                                             
  - `:username`                                                                                                         
                                                                                                                        
  Methods: the default HTTP request method is `GET`, if no parameters are added,                                        
  and `POST` otherwise. Override the method with `--method`.                                                            
                                                                                                                        
  Pass one or more `--raw-field` values in `key=value` format to add                                                    
  JSON-encoded string parameters to the `POST` body.                                                                    
                                                                                                                        
  The `--field` flag behaves like `--raw-field` with magic type conversion based                                        
  on the format of the value:                                                                                           
                                                                                                                        
  - Literal values `true`, `false`, `null`, and integer numbers are converted to                                        
    appropriate JSON types.                                                                                             
  - Placeholder values `:namespace`, `:repo`, and `:branch` are populated with values                                   
    from the repository of the current directory.                                                                       
  - If the value starts with `@`, the rest of the value is interpreted as a                                             
    filename to read the value from. Pass `-` to read from standard input.                                              
                                                                                                                        
  For GraphQL requests, all fields other than `query` and `operationName` are                                           
  interpreted as GraphQL variables.                                                                                     
                                                                                                                        
  Raw request body can be passed from the outside via a file specified by `--input`.                                    
  Pass `-` to read from standard input. In this mode, parameters specified with                                         
  `--field` flags are serialized into URL query parameters.                                                             
                                                                                                                        
  In `--paginate` mode, all pages of results are requested sequentially until                                           
  no more pages of results remain. For GraphQL requests:                                                                
                                                                                                                        
  - The original query must accept an `$endCursor: String` variable.                                                    
  - The query must fetch the `pageInfo{ hasNextPage, endCursor }` set of fields from a collection.                      
                                                                                                                        
  The `--output` flag controls the output format:                                                                       
                                                                                                                        
  - `json` (default): Pretty-printed JSON. Arrays are output as a single JSON array.                                    
  - `ndjson`: Newline-delimited JSON (also known as JSONL or JSON Lines). Each array element                            
    or object is output on a separate line. This format is more memory-efficient for large datasets                     
    and works well with tools like `jq`. See https://github.com/ndjson/ndjson-spec and                                  
    https://jsonlines.org/ for format specifications.                                                                   
                                                                                                                        
         
  USAGE  
         
    glab api <endpoint> [--flags]                                                   
            
  EXAMPLES  
            
    $ glab api projects/:fullpath/releases                                          
    $ glab api projects/gitlab-com%2Fwww-gitlab-com/issues                          
    $ glab api issues --paginate                                                    
    $ glab api issues --paginate --output ndjson                                    
    $ glab api issues --paginate --output ndjson | jq 'select(.state == "opened")'  
    $ glab api graphql -f query="query { currentUser { username } }"                
    $ glab api graphql -f query='                                                   
    query {                                                                         
    project(fullPath: "gitlab-org/gitlab-docs") {                                   
    name                                                                            
    forksCount                                                                      
    statistics {                                                                    
    wikiSize                                                                        
    }                                                                               
    issuesEnabled                                                                   
    boards {                                                                        
    nodes {                                                                         
    id                                                                              
    name                                                                            
    }                                                                               
    }                                                                               
    }                                                                               
    }                                                                               
    '                                                                               
                                                                                    
    $ glab api graphql --paginate -f query='                                        
    query($endCursor: String) {                                                     
    project(fullPath: "gitlab-org/graphql-sandbox") {                               
    name                                                                            
    issues(first: 2, after: $endCursor) {                                           
    edges {                                                                         
    node {                                                                          
    title                                                                           
    }                                                                               
    }                                                                               
    pageInfo {                                                                      
    endCursor                                                                       
    hasNextPage                                                                     
    }                                                                               
    }                                                                               
    }                                                                               
    }'                                                                              
         
  FLAGS  
         
    -F --field      Add a parameter of inferred type. Changes the default HTTP method to "POST".
    -H --header     Add an additional HTTP request header.
    -h --help       Show help for this command.
    --hostname      The GitLab hostname for the request. Defaults to 'gitlab.com', or the authenticated host in the current Git directory.
    -i --include    Include HTTP response headers in the output.
    --input         The file to use as the body for the HTTP request.
    -X --method     The HTTP method for the request. (GET)
    --output        Format output as: json, ndjson. (json)
    --paginate      Make additional HTTP requests to fetch all pages of results.
    -f --raw-field  Add a string parameter.
    --silent        Do not print the response body.
```

## Quick start

```bash
glab api --help
```

## Subcommands

This command has no subcommands.