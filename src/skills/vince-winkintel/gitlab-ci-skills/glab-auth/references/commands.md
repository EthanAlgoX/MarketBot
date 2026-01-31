# glab auth subcommands

Source: <https://docs.gitlab.com/cli/auth/>

> Help output captured from `glab auth <subcommand> --help`.

## login

```
Authenticate with a GitLab instance.
  You can pass in a token on standard input by using `--stdin`.
  The minimum required scopes for the token are: `api`, `write_repository`.
  Configuration and credentials are stored in the global configuration file (default `~/.config/glab-cli/config.yml`)

  When running in interactive mode inside a Git repository, `glab` will automatically detect
  GitLab instances from your Git remotes and present them as options, saving you from having to
  manually type the hostname.


  USAGE

    glab auth login [--flags]

  EXAMPLES

    # Start interactive setup
    # (If in a Git repository, glab will detect and suggest GitLab instances from remotes)
    $ glab auth login

    # Authenticate against `gitlab.com` by reading the token from a file
    $ glab auth login --stdin < myaccesstoken.txt

    # Authenticate with GitLab Self-Managed or GitLab Dedicated
    $ glab auth login --hostname salsa.debian.org

    # Non-interactive setup
    $ glab auth login --hostname gitlab.example.org --token glpat-xxx --api-host gitlab.example.org:3443 --api-prot…

    # Non-interactive setup reading token from a file
    $ glab auth login --hostname gitlab.example.org --api-host gitlab.example.org:3443 --api-protocol https --git-p…

    # Non-interactive CI/CD setup
    $ glab auth login --hostname $CI_SERVER_HOST --job-token $CI_JOB_TOKEN

  FLAGS

    -a --api-host      Api host url.
    -p --api-protocol  Api protocol: https, http
    -g --git-protocol  Git protocol: ssh, https, http
    -h --help          Show help for this command.
    --hostname         The hostname of the GitLab instance to authenticate with.
    -j --job-token     Ci job token.
    --stdin            Read token from standard input.
    -t --token         Your GitLab access token.
    --use-keyring      Store token in your operating system's keyring.
```

## logout

```
Logout from a GitLab instance.
  Configuration and credentials are stored in the global configuration file (default `~/.config/glab-cli/config.yml`)


  USAGE

    glab auth logout [--flags]

  EXAMPLES

    Logout of a specific instance
    - glab auth logout --hostname gitlab.example.com

  FLAGS

    -h --help   Show help for this command.
    --hostname  The hostname of the GitLab instance.
```

## status

```
Verifies and displays information about your authentication state.

  By default, this command checks the authentication state of the GitLab instance
  determined by your current context (`git remote`, `GITLAB_HOST` environment variable,
  or configuration). Use `--all` to check all configured instances, or `--hostname` to
  check a specific instance.


  USAGE

    glab auth status [--flags]

  FLAGS

    -a --all         Check all configured instances.
    -h --help        Show help for this command.
    --hostname       Check a specific instance's authentication status.
    -t --show-token  Display the authentication token.
```

## configure-docker

```
Register glab as a Docker credential helper

  USAGE

    glab auth configure-docker [--flags]

  FLAGS

    -h --help  Show help for this command.
```

## docker-helper

```
A Docker credential helper for GitLab container registries

  USAGE

    glab auth docker-helper [--flags]

  FLAGS

    -h --help  Show help for this command.
```

## dpop-gen

```
Demonstrating-proof-of-possession (DPoP) is a technique to
  cryptographically bind personal access tokens to their owners. This command provides
  the tools to manage the client aspects of DPoP. It generates a DPoP proof JWT
  (JSON Web Token).

  Prerequisites:

  - You must have a SSH key pair in RSA, ed25519, or ECDSA format.
  - You have enabled DPoP for your account, as described in the [GitLab
  documentation.](https://docs.gitlab.com/user/profile/personal_access_tokens/#require-dpop-headers-with-personal-
  access-tokens)

  Use the JWT in combination with a Personal Access Token (PAT) to authenticate to
  the GitLab API. Your JWT remains valid for 5 minutes. After it expires, you must
  generate another token. Your SSH private key is then used to sign the JWT.

  This feature is experimental. It might be broken or removed without any prior notice.
  Read more about what experimental features mean at
  https://docs.gitlab.com/policy/development_stages_support/

  Use experimental features at your own risk.


  USAGE

    glab auth dpop-gen [--flags]

  EXAMPLES

    # Generate a DPoP JWT for authentication to GitLab
    $ glab auth dpop-gen [flags]
    $ glab auth dpop-gen --private-key "~/.ssh/id_rsa" --pat "glpat-xxxxxxxxxxxxxxxxxxxx"

    # No PAT required if you previously used the 'glab auth login' command with a PAT
    $ glab auth dpop-gen --private-key "~/.ssh/id_rsa"

    # Generate a DPoP JWT for a different GitLab instance
    $ glab auth dpop-gen --private-key "~/.ssh/id_rsa" --hostname "https://gitlab.com"

  FLAGS

    -h --help         Show help for this command.
    --hostname        The hostname of the GitLab instance to authenticate with. Defaults to 'gitlab.com'. (gitlab.com)
    --pat             Personal Access Token (PAT) to generate a DPoP proof for. Defaults to the token set with 'glab auth login'. Returns an error if both are empty.
    -p --private-key  Location of the private SSH key on the local system.
```
