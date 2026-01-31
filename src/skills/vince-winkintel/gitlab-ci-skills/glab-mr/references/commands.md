# glab mr help

> Help output captured from `glab mr --help`.

```

  Create, view, and manage merge requests.                                                                              
         
  USAGE  
         
    glab mr <command> [command] [--flags]                                 
            
  EXAMPLES  
            
    $ glab mr create --fill --label bugfix                                
    $ glab mr merge 123                                                   
    $ glab mr note -m "needs to do X before it can be merged" branch-foo  
            
  COMMANDS  
            
    approve {<id> | <branch>} [--flags]           Approve merge requests.
    approvers [<id> | <branch>] [--flags]         List eligible approvers for merge requests in any state.
    checkout [<id> | <branch> | <url>] [--flags]  Check out an open merge request.
    close [<id> | <branch>]                       Close a merge request.
    create [--flags]                              Create a new merge request.
    delete [<id> | <branch>]                      Delete a merge request.
    diff [<id> | <branch>] [--flags]              View changes in a merge request.
    for [--flags]                                 Create a new merge request for an issue.
    issues [<id> | <branch>]                      Get issues related to a particular merge request.
    list [--flags]                                List merge requests.
    merge {<id> | <branch>} [--flags]             Merge or accept a merge request.
    note [<id> | <branch>] [--flags]              Add a comment or note to a merge request.
    rebase [<id> | <branch>] [--flags]            Rebase the source branch of a merge request against its target branch.
    reopen [<id>... | <branch>...]                Reopen a merge request.
    revoke [<id> | <branch>]                      Revoke approval on a merge request.
    subscribe [<id> | <branch>]                   Subscribe to a merge request.
    todo [<id> | <branch>]                        Add a to-do item to merge request.
    unsubscribe [<id> | <branch>]                 Unsubscribe from a merge request.
    update [<id> | <branch>] [--flags]            Update a merge request.
    view {<id> | <branch>} [--flags]              Display the title, body, and other information about a merge request.
         
  FLAGS  
         
    -h --help                                     Show help for this command.
    -R --repo                                     Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## mr approve

```

  Approve merge requests.                                                                                               
         
  USAGE  
         
    glab mr approve {<id> | <branch>} [--flags]                     
            
  EXAMPLES  
            
    $ glab mr approve 235                                           
    $ glab mr approve 123 345                                       
    $ glab mr approve branch-1                                      
    $ glab mr approve branch-2 branch-3                             
                                                                    
    # Finds open merge request from current branch and approves it  
    $ glab mr approve                                               
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -s --sha   Sha, which must match the SHA of the HEAD commit of the merge request.
```

## mr approvers

```

  List eligible approvers for merge requests in any state.                                                              
         
  USAGE  
         
    glab mr approvers [<id> | <branch>] [--flags]  
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## mr checkout

```

  Check out an open merge request.                                                                                      
         
  USAGE  
         
    glab mr checkout [<id> | <branch> | <url>] [--flags]                        
            
  EXAMPLES  
            
    $ glab mr checkout 1                                                        
    $ glab mr checkout branch                                                   
    $ glab mr checkout 12 --branch todo-fix                                     
    $ glab mr checkout new-feature --set-upstream-to=upstream/main              
    $ glab mr checkout https://gitlab.com/gitlab-org/cli/-/merge_requests/1234  
                                                                                
    # Uses the checked-out branch                                               
    $ glab mr checkout                                                          
         
  FLAGS  
         
    -b --branch           Check out merge request with name <branch>.
    -h --help             Show help for this command.
    -R --repo             Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -u --set-upstream-to  Set tracking of checked-out branch to [REMOTE/]BRANCH.
```

## mr close

```

  Close a merge request.                                                                                                
         
  USAGE  
         
    glab mr close [<id> | <branch>] [--flags]  
            
  EXAMPLES  
            
    $ glab mr close 1                          
                                               
    # Close multiple merge requests at once    
    $ glab mr close 1 2 3 4                    
                                               
    # Use the checked-out branch               
    $ glab mr close                            
                                               
    $ glab mr close branch                     
    $ glab mr close username:branch            
    $ glab mr close branch -R another/repo     
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## mr create

```

  Create a new merge request.                                                                                           
         
  USAGE  
         
    glab mr create [--flags]                            
            
  EXAMPLES  
            
    $ glab mr new                                       
    $ glab mr create -a username -t "fix annoying bug"  
    $ glab mr create -f --draft --label RFC             
    $ glab mr create --fill --web                       
    $ glab mr create --fill --fill-commit-body --yes    
         
  FLAGS  
         
    --allow-collaboration   Allow commits from other members.
    -a --assignee           Assign merge request to people by their `usernames`. Multiple usernames can be comma-separated or specified by repeating the flag.
    --copy-issue-labels     Copy labels from issue to the merge request. Used with --related-issue.
    --create-source-branch  Create a source branch if it does not exist.
    -d --description        Supply a description for the merge request. Set to "-" to open an editor.
    --draft                 Mark merge request as a draft.
    -f --fill               Do not prompt for title or description, and just use commit info. Sets `push` to `true`, and pushes the branch.
    --fill-commit-body      Fill description with each commit body when multiple commits. Can only be used with --fill.
    -H --head               Select another head repository using the `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format, the project ID, or the full URL.
    -h --help               Show help for this command.
    -l --label              Add label by name. Multiple labels can be comma-separated or specified by repeating the flag.
    -m --milestone          The global ID or title of a milestone to assign.
    --no-editor             Don't open editor to enter a description. If true, uses prompt. Defaults to false.
    --push                  Push committed changes after creating merge request. Make sure you have committed changes.
    --recover               Save the options to a file if the merge request creation fails. If the file exists, the options are loaded from the recovery file. (EXPERIMENTAL)
    -i --related-issue      Create a merge request for an issue. If --title is not provided, uses the issue title.
    --remove-source-branch  Remove source branch on merge.
    -R --repo               Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --reviewer              Request review from users by their `usernames`. Multiple usernames can be comma-separated or specified by repeating the flag.
    --signoff               Append a DCO signoff to the merge request description.
    -s --source-branch      Create a merge request from this branch. Default is the current branch.
    --squash-before-merge   Squash commits into a single commit when merging.
    -b --target-branch      The target or base branch into which you want your code merged into.
    -t --title              Supply a title for the merge request.
    -w --web                Continue merge request creation in a browser.
    --wip                   Mark merge request as a draft. Alternative to --draft.
    -y --yes                Skip submission confirmation prompt. Use --fill to skip all optional prompts.
```

## mr delete

```

  Delete a merge request.                                                                                               
         
  USAGE  
         
    glab mr delete [<id> | <branch>] [--flags]              
            
  EXAMPLES  
            
    $ glab mr delete 123                                    
                                                            
    # Delete multiple merge requests by ID and branch name  
    $ glab mr delete 123 branch-name 789                    
                                                            
    # Delete merge requests !1, !2, !3, !4, !5              
    $ glab mr delete 1,2,branch-related-to-mr-3,4,5         
                                                            
    $ glab mr del 123                                       
    $ glab mr delete branch                                 
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## mr diff

```

  View changes in a merge request.                                                                                      
         
  USAGE  
         
    glab mr diff [<id> | <branch>] [--flags]  
            
  EXAMPLES  
            
    $ glab mr diff 123                        
    $ glab mr diff branch                     
                                              
    # Get merge request from current branch   
    $ glab mr diff                            
                                              
    $ glab mr diff 123 --color=never          
         
  FLAGS  
         
    --color    Use color in diff output: always, never, auto. (auto)
    -h --help  Show help for this command.
    --raw      Use raw diff format that can be piped to commands
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## mr for

```
Command "for" is deprecated, use `glab mr create --related-issue <issueID>`

  Create a new merge request for an issue.                                                                              
         
  USAGE  
         
    glab mr for [--flags]                                             
            
  EXAMPLES  
            
    # Create merge request for issue 34                               
    $ glab mr for 34                                                  
                                                                      
    # Create merge request for issue 34 and mark as work in progress  
    $ glab mr for 34 --wip                                            
                                                                      
    $ glab mr new-for 34                                              
    $ glab mr create-for 34                                           
         
  FLAGS  
         
    --allow-collaboration   Allow commits from other members.
    -a --assignee           Assign merge request to people by their IDs. Multiple values should be comma-separated.
    --draft                 Mark merge request as a draft. (true)
    -h --help               Show help for this command.
    -l --label              Add label by name. Multiple labels should be comma-separated.
    -m --milestone          Add milestone by <id> for this merge request. (-1)
    --remove-source-branch  Remove source branch on merge.
    -R --repo               Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -b --target-branch      The target or base branch into which you want your code merged.
    --wip                   Mark merge request as a work in progress. Overrides --draft.
    --with-labels           Copy labels from issue to the merge request.
```

## mr issues

```

  Get issues related to a particular merge request.                                                                     
         
  USAGE  
         
    glab mr issues [<id> | <branch>] [--flags]  
            
  EXAMPLES  
            
    # List issues for merge request 46          
    $ glab mr issues 46                         
    $ glab mr issues branch                     
                                                
    # Use the checked-out branch                
    $ glab mr issues                            
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## mr list

```

  List merge requests.                                                                                                  
         
  USAGE  
         
    glab mr list [--flags]                                              
            
  EXAMPLES  
            
    $ glab mr list --all                                                
    $ glab mr ls -a                                                     
    $ glab mr list --assignee=@me                                       
    $ glab mr list --reviewer=@me                                       
    $ glab mr list --source-branch=new-feature                          
    $ glab mr list --target-branch=main                                 
    $ glab mr list --search "this adds feature X"                       
    $ glab mr list --label needs-review                                 
    $ glab mr list --not-label waiting-maintainer-feedback,subsystem-x  
    $ glab mr list -M --per-page 10                                     
    $ glab mr list --draft                                              
    $ glab mr list --not-draft                                          
         
  FLAGS  
         
    -A --all            Get all merge requests.
    -a --assignee       Get only merge requests assigned to users. Multiple users can be comma-separated or specified by repeating the flag.
    --author            Filter merge request by author <username>.
    -c --closed         Get only closed merge requests.
    --created-after     Filter merge requests created after a certain date (ISO 8601 format).
    --created-before    Filter merge requests created after a certain date (ISO 8601 format).
    -d --draft          Filter by draft merge requests.
    -g --group          Select a group/subgroup. This option is ignored if a repo argument is set.
    -h --help           Show help for this command.
    -l --label          Filter merge request by label <name>. Multiple labels can be comma-separated or specified by repeating the flag.
    -M --merged         Get only merged merge requests.
    -m --milestone      Filter merge request by milestone <id>.
    --not-draft         Filter by non-draft merge requests.
    --not-label         Filter merge requests by not having label <name>. Multiple labels can be comma-separated or specified by repeating the flag.
    -o --order          Order merge requests by <field>. Order options: created_at, updated_at, merged_at, title, priority, label_priority, milestone_due, and popularity.
    -F --output         Format output as: text, json. (text)
    -p --page           Page number. (1)
    -P --per-page       Number of items to list per page. (30)
    -R --repo           Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -r --reviewer       Get only merge requests with users as reviewer. Multiple users can be comma-separated or specified by repeating the flag.
    --search            Filter by <string> in title and description.
    -S --sort           Sort direction for --order field: asc or desc.
    -s --source-branch  Filter by source branch <name>.
    -t --target-branch  Filter by target branch <name>.
```

## mr merge

```

  Merge or accept a merge request.                                                                                      
         
  USAGE  
         
    glab mr merge {<id> | <branch>} [--flags]       
            
  EXAMPLES  
            
    # Merge a merge request                         
    $ glab mr merge 235                             
    $ glab mr accept 235                            
                                                    
    # Finds open merge request from current branch  
    $ glab mr merge                                 
         
  FLAGS  
         
    --auto-merge               Set auto-merge. (true)
    -h --help                  Show help for this command.
    -m --message               Custom merge commit message.
    -r --rebase                Rebase the commits onto the base branch.
    -d --remove-source-branch  Remove source branch on merge.
    -R --repo                  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --sha                      Merge only if the HEAD of the source branch matches this SHA. Use to ensure that only reviewed commits are merged.
    -s --squash                Squash commits on merge.
    --squash-message           Custom squash commit message.
    -y --yes                   Skip submission confirmation prompt.
```

## mr note

```

  Add a comment or note to a merge request.                                                                             
         
  USAGE  
         
    glab mr note [<id> | <branch>] [--flags]                     
            
  EXAMPLES  
            
    # Add a comment to merge request with ID 123                 
    $ glab mr note 123 -m "Looks good to me!"                    
                                                                 
    # Add a comment to the merge request for the current branch  
    $ glab mr note -m "LGTM"                                     
                                                                 
    # Open your editor to compose a multi-line comment           
    $ glab mr note 123                                           
         
  FLAGS  
         
    -h --help     Show help for this command.
    -m --message  Comment or note message.
    -R --repo     Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --unique      Don't create a comment or note if it already exists.
```

## mr rebase

```

  If you don't have permission to push to the merge request's source branch, you'll get a 403 Forbidden response.       
                                                                                                                        
         
  USAGE  
         
    glab mr rebase [<id> | <branch>] [--flags]  
            
  EXAMPLES  
            
    # Rebase merge request 123                  
    $ glab mr rebase 123                        
                                                
    # Rebase current branch                     
    $ glab mr rebase                            
                                                
    # Rebase merge request from branch          
    $ glab mr rebase branch                     
    $ glab mr rebase branch --skip-ci           
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --skip-ci  Rebase merge request while skipping CI/CD pipeline.
```

## mr reopen

```

  Reopen a merge request.                                                                                               
         
  USAGE  
         
    glab mr reopen [<id>... | <branch>...] [--flags]             
            
  EXAMPLES  
            
    # Reopen merge request 123                                   
    $ glab mr reopen 123                                         
                                                                 
    # Reopen merge requests 123, 456, and 789                    
    $ glab mr reopen 123 456 789                                 
                                                                 
    # Reopen merge requests from branches branch-1 and branch-2  
    $ glab mr reopen branch-1 branch-2                           
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## mr revoke

```

  Revoke approval on a merge request.                                                                                   
         
  USAGE  
         
    glab mr revoke [<id> | <branch>] [--flags]             
            
  EXAMPLES  
            
    # Revoke approval on a merge request                   
    $ glab mr revoke 123                                   
    $ glab mr unapprove 123                                
    $ glab mr revoke branch                                
                                                           
    # Revoke approval on the currently checked out branch  
    $ glab mr revoke                                       
    # Revoke approval on merge request 123 on branch 456   
    $ glab mr revoke 123 branch 456                        
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## mr subscribe

```

  Subscribe to a merge request.                                                                                         
         
  USAGE  
         
    glab mr subscribe [<id> | <branch>] [--flags]  
            
  EXAMPLES  
            
    # Subscribe to a merge request                 
    $ glab mr subscribe 123                        
    $ glab mr sub 123                              
    $ glab mr subscribe branch                     
                                                   
    # Subscribe to multiple merge requests         
    $ glab mr subscribe 123 branch                 
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## mr todo

```

  Add a to-do item to merge request.                                                                                    
         
  USAGE  
         
    glab mr todo [<id> | <branch>] [--flags]  
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## mr unsubscribe

```

  Unsubscribe from a merge request.                                                                                     
         
  USAGE  
         
    glab mr unsubscribe [<id> | <branch>] [--flags]  
            
  EXAMPLES  
            
    # Unsubscribe from a merge request               
    $ glab mr unsubscribe 123                        
    $ glab mr unsub 123                              
    $ glab mr unsubscribe branch                     
                                                     
    # Unsubscribe from multiple merge requests       
    $ glab mr unsubscribe 123 branch                 
         
  FLAGS  
         
    -h --help  Show help for this command.
    -R --repo  Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
```

## mr update

```

  Update a merge request.                                                                                               
         
  USAGE  
         
    glab mr update [<id> | <branch>] [--flags]           
            
  EXAMPLES  
            
    # Mark a merge request as ready                      
    $ glab mr update 23 --ready                          
                                                         
    # Mark a merge request as draft                      
    $ glab mr update 23 --draft                          
                                                         
    # Updates the merge request for the current branch   
    $ glab mr update --draft                             
                                                         
    # Update merge request with commit information       
    $ glab mr update 23 --fill --fill-commit-body --yes  
         
  FLAGS  
         
    -a --assignee           Assign users via username. Prefix with '!' or '-' to remove from existing assignees, '+' to add. Otherwise, replace existing assignees with given users. Multiple usernames can be comma-separated or specified by repeating the flag.
    -d --description        Merge request description. Set to "-" to open an editor.
    --draft                 Mark merge request as a draft.
    -f --fill               Do not prompt for title or body, and just use commit info.
    --fill-commit-body      Fill body with each commit body when multiple commits. Can only be used with --fill.
    -h --help               Show help for this command.
    -l --label              Add labels.
    --lock-discussion       Lock discussion on merge request.
    -m --milestone          Title of the milestone to assign. Set to "" or 0 to unassign.
    -r --ready              Mark merge request as ready to be reviewed and merged.
    --remove-source-branch  Toggles the removal of the source branch on merge.
    -R --repo               Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    --reviewer              Request review from users by their usernames. Prefix with '!' or '-' to remove from existing reviewers, '+' to add. Otherwise, replace existing reviewers with given users. Multiple usernames can be comma-separated or specified by repeating the flag.
    --squash-before-merge   Toggles the option to squash commits into a single commit when merging.
    --target-branch         Set target branch.
    -t --title              Title of merge request.
    --unassign              Unassign all users.
    -u --unlabel            Remove labels.
    --unlock-discussion     Unlock discussion on merge request.
    --wip                   Mark merge request as a work in progress. Alternative to --draft.
    -y --yes                Skip confirmation prompt.
```

## mr view

```

  Display the title, body, and other information about a merge request.                                                 
         
  USAGE  
         
    glab mr view {<id> | <branch>} [--flags]  
         
  FLAGS  
         
    -c --comments     Show merge request comments and activities.
    -h --help         Show help for this command.
    -F --output       Format output as: text, json. (text)
    -p --page         Page number.
    -P --per-page     Number of items to list per page. (20)
    -R --repo         Select another repository. Can use either `OWNER/REPO` or `GROUP/NAMESPACE/REPO` format. Also accepts full URL or Git URL.
    -s --system-logs  Show system activities and logs.
    -w --web          Open merge request in a browser. Uses default browser or browser specified in BROWSER variable.
```

