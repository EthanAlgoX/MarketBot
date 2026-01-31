#!/bin/bash
# MongoDB Atlas Admin CLI Wrapper
# Requires: ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY

set -euo pipefail

BASE_URL="https://cloud.mongodb.com/api/atlas/v2"
ACCEPT_HEADER="application/vnd.atlas.2025-03-12+json"

# Check credentials
if [[ -z "${ATLAS_PUBLIC_KEY:-}" ]] || [[ -z "${ATLAS_PRIVATE_KEY:-}" ]]; then
    echo "Error: ATLAS_PUBLIC_KEY and ATLAS_PRIVATE_KEY must be set" >&2
    exit 1
fi

# API request helper
api() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    
    local args=(
        --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}"
        --digest
        --silent
        --header "Accept: ${ACCEPT_HEADER}"
        --header "Content-Type: application/json"
        -X "$method"
    )
    
    if [[ -n "$data" ]]; then
        args+=(--data "$data")
    fi
    
    curl "${args[@]}" "${BASE_URL}${endpoint}"
}

# Commands
case "${1:-help}" in
    projects)
        case "${2:-list}" in
            list)
                api GET "/groups" | jq '.results[] | {id, name, created}'
                ;;
            get)
                api GET "/groups/${3:?Project ID required}" | jq '.'
                ;;
            create)
                api POST "/groups" "{\"name\":\"${3:?Name required}\",\"orgId\":\"${4:?Org ID required}\"}" | jq '.'
                ;;
            delete)
                api DELETE "/groups/${3:?Project ID required}"
                echo "Project deleted"
                ;;
            *)
                echo "Usage: $0 projects [list|get|create|delete] [args]"
                ;;
        esac
        ;;
        
    clusters)
        case "${2:-list}" in
            list)
                api GET "/groups/${3:?Project ID required}/clusters" | jq '.results[] | {name, clusterType, stateName, mongoDBVersion}'
                ;;
            get)
                api GET "/groups/${3:?Project ID required}/clusters/${4:?Cluster name required}" | jq '.'
                ;;
            create)
                local project_id="${3:?Project ID required}"
                local name="${4:?Cluster name required}"
                local size="${5:-M10}"
                local region="${6:-US_EAST_1}"
                local provider="${7:-AWS}"
                
                local payload
                if [[ "$size" == "M0" ]]; then
                    payload=$(cat <<EOF
{
  "name": "$name",
  "clusterType": "REPLICASET",
  "replicationSpecs": [{
    "regionConfigs": [{
      "providerName": "TENANT",
      "backingProviderName": "$provider",
      "regionName": "$region",
      "priority": 7,
      "electableSpecs": {"instanceSize": "M0", "nodeCount": 3}
    }]
  }]
}
EOF
)
                else
                    payload=$(cat <<EOF
{
  "name": "$name",
  "clusterType": "REPLICASET",
  "replicationSpecs": [{
    "regionConfigs": [{
      "providerName": "$provider",
      "regionName": "$region",
      "priority": 7,
      "electableSpecs": {"instanceSize": "$size", "nodeCount": 3}
    }]
  }]
}
EOF
)
                fi
                api POST "/groups/${project_id}/clusters" "$payload" | jq '.'
                ;;
            delete)
                api DELETE "/groups/${3:?Project ID required}/clusters/${4:?Cluster name required}"
                echo "Cluster deletion initiated"
                ;;
            pause)
                api PATCH "/groups/${3:?Project ID required}/clusters/${4:?Cluster name required}" '{"paused":true}' | jq '.stateName'
                ;;
            resume)
                api PATCH "/groups/${3:?Project ID required}/clusters/${4:?Cluster name required}" '{"paused":false}' | jq '.stateName'
                ;;
            scale)
                local project_id="${3:?Project ID required}"
                local name="${4:?Cluster name required}"
                local new_size="${5:?New instance size required}"
                
                # Get current config
                local current=$(api GET "/groups/${project_id}/clusters/${name}")
                local region=$(echo "$current" | jq -r '.replicationSpecs[0].regionConfigs[0].regionName')
                local provider=$(echo "$current" | jq -r '.replicationSpecs[0].regionConfigs[0].providerName')
                
                local payload=$(cat <<EOF
{
  "replicationSpecs": [{
    "regionConfigs": [{
      "providerName": "$provider",
      "regionName": "$region",
      "priority": 7,
      "electableSpecs": {"instanceSize": "$new_size", "nodeCount": 3}
    }]
  }]
}
EOF
)
                api PATCH "/groups/${project_id}/clusters/${name}" "$payload" | jq '.stateName'
                ;;
            *)
                echo "Usage: $0 clusters [list|get|create|delete|pause|resume|scale] <project-id> [args]"
                ;;
        esac
        ;;
        
    users)
        case "${2:-list}" in
            list)
                api GET "/groups/${3:?Project ID required}/databaseUsers" | jq '.results[] | {username, databaseName, roles}'
                ;;
            create)
                local project_id="${3:?Project ID required}"
                local username="${4:?Username required}"
                local password="${5:?Password required}"
                local role="${6:-readWriteAnyDatabase}"
                
                local payload=$(cat <<EOF
{
  "databaseName": "admin",
  "username": "$username",
  "password": "$password",
  "roles": [{"databaseName": "admin", "roleName": "$role"}]
}
EOF
)
                api POST "/groups/${project_id}/databaseUsers" "$payload" | jq '.'
                ;;
            delete)
                api DELETE "/groups/${3:?Project ID required}/databaseUsers/admin/${4:?Username required}"
                echo "User deleted"
                ;;
            *)
                echo "Usage: $0 users [list|create|delete] <project-id> [args]"
                ;;
        esac
        ;;
        
    access)
        case "${2:-list}" in
            list)
                api GET "/groups/${3:?Project ID required}/accessList" | jq '.results[] | {ipAddress, cidrBlock, comment}'
                ;;
            add)
                local project_id="${3:?Project ID required}"
                local ip="${4:?IP address required}"
                local comment="${5:-Added via CLI}"
                
                api POST "/groups/${project_id}/accessList" "[{\"ipAddress\":\"$ip\",\"comment\":\"$comment\"}]" | jq '.'
                ;;
            allow-all)
                local project_id="${3:?Project ID required}"
                api POST "/groups/${project_id}/accessList" '[{"cidrBlock":"0.0.0.0/0","comment":"Allow all - DEV ONLY"}]' | jq '.'
                ;;
            *)
                echo "Usage: $0 access [list|add|allow-all] <project-id> [args]"
                ;;
        esac
        ;;
        
    snapshots)
        case "${2:-list}" in
            list)
                api GET "/groups/${3:?Project ID required}/clusters/${4:?Cluster name required}/backup/snapshots" | jq '.results[] | {id, snapshotType, status, createdAt}'
                ;;
            create)
                local project_id="${3:?Project ID required}"
                local cluster="${4:?Cluster name required}"
                local desc="${5:-Manual snapshot}"
                local retention="${6:-7}"
                
                api POST "/groups/${project_id}/clusters/${cluster}/backup/snapshots" \
                    "{\"description\":\"$desc\",\"retentionInDays\":$retention}" | jq '.'
                ;;
            *)
                echo "Usage: $0 snapshots [list|create] <project-id> <cluster-name> [args]"
                ;;
        esac
        ;;
        
    alerts)
        case "${2:-list}" in
            list)
                api GET "/groups/${3:?Project ID required}/alerts?status=OPEN" | jq '.results[] | {id, eventTypeName, status, created}'
                ;;
            configs)
                api GET "/groups/${3:?Project ID required}/alertConfigs" | jq '.results[] | {id, eventTypeName, enabled}'
                ;;
            *)
                echo "Usage: $0 alerts [list|configs] <project-id>"
                ;;
        esac
        ;;
        
    orgs)
        case "${2:-list}" in
            list)
                api GET "/orgs" | jq '.results[] | {id, name}'
                ;;
            *)
                echo "Usage: $0 orgs [list]"
                ;;
        esac
        ;;
        
    help|*)
        cat <<EOF
MongoDB Atlas Admin CLI

Usage: $0 <command> [subcommand] [args]

Commands:
  orgs      list                           List organizations
  projects  list|get|create|delete         Manage projects
  clusters  list|get|create|delete|pause   Manage clusters
            resume|scale
  users     list|create|delete             Manage database users
  access    list|add|allow-all             Manage IP access list
  snapshots list|create                    Manage backups
  alerts    list|configs                   View alerts

Environment:
  ATLAS_PUBLIC_KEY   API public key (required)
  ATLAS_PRIVATE_KEY  API private key (required)

Examples:
  $0 projects list
  $0 clusters list 60c4fd418ebe251047c50554
  $0 clusters create 60c4fd418ebe251047c50554 my-cluster M10 US_EAST_1
  $0 users create 60c4fd418ebe251047c50554 appuser secretPass123!
  $0 access add 60c4fd418ebe251047c50554 192.168.1.1 "Office"
EOF
        ;;
esac
