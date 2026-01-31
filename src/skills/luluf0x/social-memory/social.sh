#!/bin/bash
# Social Memory - Track relationships and interactions
set -e

SOCIAL_DIR="${HOME}/.local/share/social-memory"
GRAPH_FILE="${SOCIAL_DIR}/graph.json"

# Ensure graph exists
mkdir -p "$SOCIAL_DIR"
if [[ ! -f "$GRAPH_FILE" ]]; then
    echo '{"entities":{}}' > "$GRAPH_FILE"
fi

action="${1:-list}"

case "$action" in
    add)
        username="$2"
        platform="$3"
        notes="$4"
        
        if [[ -z "$username" ]]; then
            echo "Usage: $0 add <username> [platform] [notes]"
            exit 1
        fi
        
        platform="${platform:-unknown}"
        notes="${notes:-}"
        now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        
        # Check if exists
        exists=$(jq -r --arg u "$username" '.entities[$u] // empty' "$GRAPH_FILE")
        
        if [[ -n "$exists" ]]; then
            # Update existing - add platform if new
            jq --arg u "$username" \
               --arg p "$platform" \
               --arg n "$notes" \
               --arg now "$now" \
               '
               .entities[$u].platforms = ((.entities[$u].platforms + [$p]) | unique) |
               .entities[$u].last_interaction = $now |
               if $n != "" then .entities[$u].notes = $n else . end
               ' "$GRAPH_FILE" > "${GRAPH_FILE}.tmp" && mv "${GRAPH_FILE}.tmp" "$GRAPH_FILE"
            echo "✓ Updated: $username"
        else
            # Create new
            jq --arg u "$username" \
               --arg p "$platform" \
               --arg n "$notes" \
               --arg now "$now" \
               '.entities[$u] = {
                   platforms: [$p],
                   first_seen: $now,
                   last_interaction: $now,
                   notes: $n,
                   tags: [],
                   interactions: [],
                   trust_level: "unknown"
               }' "$GRAPH_FILE" > "${GRAPH_FILE}.tmp" && mv "${GRAPH_FILE}.tmp" "$GRAPH_FILE"
            echo "✓ Added: $username ($platform)"
        fi
        ;;
        
    log)
        username="$2"
        note="$3"
        
        if [[ -z "$username" || -z "$note" ]]; then
            echo "Usage: $0 log <username> <note>"
            exit 1
        fi
        
        now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        
        # Check if exists
        exists=$(jq -r --arg u "$username" '.entities[$u] // empty' "$GRAPH_FILE")
        
        if [[ -z "$exists" ]]; then
            echo "Unknown: $username (use 'add' first)"
            exit 1
        fi
        
        jq --arg u "$username" \
           --arg note "$note" \
           --arg now "$now" \
           '
           .entities[$u].interactions += [{date: $now, note: $note}] |
           .entities[$u].last_interaction = $now
           ' "$GRAPH_FILE" > "${GRAPH_FILE}.tmp" && mv "${GRAPH_FILE}.tmp" "$GRAPH_FILE"
        
        echo "✓ Logged interaction with $username"
        ;;
        
    get)
        username="$2"
        
        if [[ -z "$username" ]]; then
            echo "Usage: $0 get <username>"
            exit 1
        fi
        
        entity=$(jq -r --arg u "$username" '.entities[$u] // empty' "$GRAPH_FILE")
        
        if [[ -z "$entity" ]]; then
            echo "Unknown: $username"
            exit 1
        fi
        
        echo "=== $username ==="
        jq -r --arg u "$username" '.entities[$u] | 
            "Platforms: \(.platforms | join(", "))",
            "First seen: \(.first_seen)",
            "Last interaction: \(.last_interaction)",
            "Trust: \(.trust_level)",
            "Notes: \(.notes)",
            "",
            "Tags: \(.tags | join(", "))",
            "",
            "Recent interactions:",
            (.interactions | .[-5:] | .[] | "  [\(.date)] \(.note)")
        ' "$GRAPH_FILE"
        ;;
        
    trust)
        username="$2"
        level="$3"
        
        if [[ -z "$username" || -z "$level" ]]; then
            echo "Usage: $0 trust <username> <unknown|low|medium|high>"
            exit 1
        fi
        
        if [[ ! "$level" =~ ^(unknown|low|medium|high)$ ]]; then
            echo "Invalid trust level. Use: unknown, low, medium, high"
            exit 1
        fi
        
        jq --arg u "$username" --arg l "$level" \
           '.entities[$u].trust_level = $l' "$GRAPH_FILE" > "${GRAPH_FILE}.tmp" && mv "${GRAPH_FILE}.tmp" "$GRAPH_FILE"
        
        echo "✓ Set trust for $username: $level"
        ;;
        
    tag)
        username="$2"
        tag="$3"
        
        if [[ -z "$username" || -z "$tag" ]]; then
            echo "Usage: $0 tag <username> <tag>"
            exit 1
        fi
        
        jq --arg u "$username" --arg t "$tag" \
           '.entities[$u].tags = ((.entities[$u].tags + [$t]) | unique)' \
           "$GRAPH_FILE" > "${GRAPH_FILE}.tmp" && mv "${GRAPH_FILE}.tmp" "$GRAPH_FILE"
        
        echo "✓ Tagged $username: $tag"
        ;;
        
    list)
        count=$(jq '.entities | length' "$GRAPH_FILE")
        
        if [[ "$count" == "0" ]]; then
            echo "No entities tracked yet"
        else
            echo "=== Social Graph ($count entities) ==="
            jq -r '.entities | to_entries | sort_by(.value.last_interaction) | reverse | .[] |
                "[\(.value.trust_level | .[0:1] | ascii_upcase)] \(.key) (\(.value.platforms | join(", "))) - \(.value.notes | .[0:50])"
            ' "$GRAPH_FILE"
        fi
        ;;
        
    search)
        query="$2"
        
        if [[ -z "$query" ]]; then
            echo "Usage: $0 search <query>"
            exit 1
        fi
        
        echo "=== Search: $query ==="
        jq -r --arg q "$query" '
            .entities | to_entries | .[] |
            select(
                (.key | ascii_downcase | contains($q | ascii_downcase)) or
                (.value.notes | ascii_downcase | contains($q | ascii_downcase)) or
                (.value.interactions[].note | ascii_downcase | contains($q | ascii_downcase))
            ) |
            "\(.key): \(.value.notes)"
        ' "$GRAPH_FILE"
        ;;
        
    *)
        echo "Usage: $0 {add|log|get|trust|tag|list|search}"
        echo ""
        echo "Commands:"
        echo "  add <user> [platform] [notes]  - Add/update entity"
        echo "  log <user> <note>              - Log interaction"
        echo "  get <user>                     - Show entity details"
        echo "  trust <user> <level>           - Set trust (unknown/low/medium/high)"
        echo "  tag <user> <tag>               - Add tag"
        echo "  list                           - List all entities"
        echo "  search <query>                 - Search notes"
        exit 1
        ;;
esac
