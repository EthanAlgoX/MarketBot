```
   ____ _ _   _          _        ____ _     ___   ____  _    _ _ _     
  / ___(_) |_| |    __ _| |__    / ___| |   |_ _| / ___|| | _(_) | |___ 
 | |  _| | __| |   / _` | '_ \  | |   | |    | |  \___ \| |/ / | | / __|
 | |_| | | |_| |__| (_| | |_) | | |___| |___ | |   ___) |   <| | | \__ \
  \____|_|\__|_____\__,_|_.__/   \____|_____|___| |____/|_|\_\_|_|_|___/
                                                                        
```

# GitLab CLI Skills

A collection of skills for AI coding agents following the Agent Skills format. These skills enable AI agents to use the GitLab CLI (`glab`) effectively.

## Available Skills

### Available Skills

- [`glab-auth`](./glab-auth)
- [`glab-alias`](./glab-alias)
- [`glab-api`](./glab-api)
- [`glab-attestation`](./glab-attestation)
- [`glab-changelog`](./glab-changelog)
- [`glab-check-update`](./glab-check-update)
- [`glab-ci`](./glab-ci)
- [`glab-cluster`](./glab-cluster)
- [`glab-completion`](./glab-completion)
- [`glab-config`](./glab-config)
- [`glab-deploy-key`](./glab-deploy-key)
- [`glab-duo`](./glab-duo)
- [`glab-gpg-key`](./glab-gpg-key)
- [`glab-help`](./glab-help)
- [`glab-incident`](./glab-incident)
- [`glab-issue`](./glab-issue)
- [`glab-iteration`](./glab-iteration)
- [`glab-job`](./glab-job)
- [`glab-label`](./glab-label)
- [`glab-mcp`](./glab-mcp)
- [`glab-milestone`](./glab-milestone)
- [`glab-mr`](./glab-mr)
- [`glab-opentofu`](./glab-opentofu)
- [`glab-release`](./glab-release)
- [`glab-repo`](./glab-repo)
- [`glab-schedule`](./glab-schedule)
- [`glab-securefile`](./glab-securefile)
- [`glab-snippet`](./glab-snippet)
- [`glab-ssh-key`](./glab-ssh-key)
- [`glab-stack`](./glab-stack)
- [`glab-token`](./glab-token)
- [`glab-user`](./glab-user)
- [`glab-variable`](./glab-variable)
- [`glab-version`](./glab-version)

## Installation

```bash
npx skills add vince-winkintel/gitlab-cli-skills
```

## Usage

Skills are automatically activated when relevant tasks are detected. Example prompts:

- "Log into GitLab CLI"
- "Check glab auth status"
- "Configure GitLab Docker auth"

## Prerequisites

- GitLab CLI installed (`glab`)
- GitLab access token or browser auth

## Install glab (Homebrew)

```bash
brew install glab
```

## License

MIT
