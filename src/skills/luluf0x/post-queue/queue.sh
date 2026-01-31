#!/bin/bash
# Post Queue - Rate-limit aware post queuing
set -e

QUEUE_DIR="${HOME}/.local/share/post-queue"
QUEUE_FILE="${QUEUE_DIR}/queue.json"
MOLTBOOK_CREDS="${HOME}/.config/moltbook/credentials.json"
COOLDOWN_MINUTES=30

# Ensure queue exists
mkdir -p "$QUEUE_DIR"
if [[ ! -f "$QUEUE_FILE" ]]; then
    echo '{"posts":[],"cooldowns":{}}' > "$QUEUE_FILE"
fi

action="${1:-list}"

case "$action" in
    add)
        platform="$2"
        title="$3"
        content="$4"
        submolt="${5:-general}"
        
        if [[ -z "$platform" || -z "$title" || -z "$content" ]]; then
            echo "Usage: $0 add <platform> <title> <content> [submolt]"
            exit 1
        fi
        
        id=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)
        added_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        
        # Add to queue
        jq --arg id "$id" \
           --arg platform "$platform" \
           --arg title "$title" \
           --arg content "$content" \
           --arg submolt "$submolt" \
           --arg added_at "$added_at" \
           '.posts += [{
               id: $id,
               platform: $platform,
               title: $title,
               content: $content,
               submolt: $submolt,
               added_at: $added_at,
               status: "pending"
           }]' "$QUEUE_FILE" > "${QUEUE_FILE}.tmp" && mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
        
        echo "✓ Queued: $title"
        echo "  ID: $id"
        ;;
        
    list)
        count=$(jq '.posts | length' "$QUEUE_FILE")
        if [[ "$count" == "0" ]]; then
            echo "Queue empty"
        else
            echo "=== Post Queue ($count) ==="
            jq -r '.posts[] | "[\(.status)] \(.platform): \(.title)"' "$QUEUE_FILE"
            
            # Show cooldowns
            echo ""
            echo "=== Cooldowns ==="
            jq -r '.cooldowns | to_entries[] | "\(.key): \(.value)"' "$QUEUE_FILE"
        fi
        ;;
        
    process)
        # Get first pending post
        post=$(jq -r '.posts[] | select(.status == "pending") | @base64' "$QUEUE_FILE" | head -1)
        
        if [[ -z "$post" ]]; then
            echo "No pending posts"
            exit 0
        fi
        
        # Decode post
        platform=$(echo "$post" | base64 -d | jq -r '.platform')
        title=$(echo "$post" | base64 -d | jq -r '.title')
        content=$(echo "$post" | base64 -d | jq -r '.content')
        submolt=$(echo "$post" | base64 -d | jq -r '.submolt')
        post_id=$(echo "$post" | base64 -d | jq -r '.id')
        
        # Check cooldown
        cooldown_end=$(jq -r ".cooldowns.${platform} // empty" "$QUEUE_FILE")
        if [[ -n "$cooldown_end" ]]; then
            cooldown_ts=$(date -d "$cooldown_end" +%s 2>/dev/null || echo 0)
            now_ts=$(date +%s)
            if [[ $now_ts -lt $cooldown_ts ]]; then
                remaining=$(( (cooldown_ts - now_ts) / 60 ))
                echo "⏳ Cooldown active for $platform: ${remaining}m remaining"
                exit 0
            fi
        fi
        
        # Post based on platform
        case "$platform" in
            moltbook)
                api_key=$(jq -r '.api_key' "$MOLTBOOK_CREDS")
                response=$(curl -sL "https://www.moltbook.com/api/v1/posts" \
                    -H "Authorization: Bearer $api_key" \
                    -H "Content-Type: application/json" \
                    -d "$(jq -n --arg t "$title" --arg c "$content" --arg s "$submolt" \
                        '{title: $t, content: $c, submolt: $s}')" 2>&1)
                
                if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
                    url=$(echo "$response" | jq -r '.post.url')
                    echo "✓ Posted: $title"
                    echo "  URL: https://moltbook.com$url"
                    
                    # Update cooldown
                    new_cooldown=$(date -u -d "+${COOLDOWN_MINUTES} minutes" +%Y-%m-%dT%H:%M:%SZ)
                    jq --arg cd "$new_cooldown" '.cooldowns.moltbook = $cd' "$QUEUE_FILE" > "${QUEUE_FILE}.tmp" && mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
                    
                    # Mark as done
                    jq --arg id "$post_id" '(.posts[] | select(.id == $id)).status = "done"' "$QUEUE_FILE" > "${QUEUE_FILE}.tmp" && mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
                else
                    error=$(echo "$response" | jq -r '.error // .message // "Unknown error"')
                    hint=$(echo "$response" | jq -r '.hint // empty')
                    echo "✗ Failed: $error"
                    [[ -n "$hint" ]] && echo "  Hint: $hint"
                    
                    # If rate limited, set cooldown
                    if echo "$response" | grep -q "30 minutes"; then
                        retry_min=$(echo "$response" | jq -r '.retry_after_minutes // 30')
                        new_cooldown=$(date -u -d "+${retry_min} minutes" +%Y-%m-%dT%H:%M:%SZ)
                        jq --arg cd "$new_cooldown" '.cooldowns.moltbook = $cd' "$QUEUE_FILE" > "${QUEUE_FILE}.tmp" && mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
                        echo "  Cooldown set: ${retry_min}m"
                    fi
                fi
                ;;
            *)
                echo "Unknown platform: $platform"
                exit 1
                ;;
        esac
        ;;
        
    clear)
        echo '{"posts":[],"cooldowns":{}}' > "$QUEUE_FILE"
        echo "✓ Queue cleared"
        ;;
        
    *)
        echo "Usage: $0 {add|list|process|clear}"
        exit 1
        ;;
esac
