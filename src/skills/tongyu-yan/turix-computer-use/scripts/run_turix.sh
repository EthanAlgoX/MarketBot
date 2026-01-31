#!/bin/bash
# Helper script to run TuriX-CUA with dynamic task injection

PROJECT_DIR="/Users/tonyyan/Desktop/TuriX-CUA/TuriX-CUA"
CONFIG_FILE="$PROJECT_DIR/examples/config.json"
CONDA_PATH="/opt/anaconda3/bin/conda"
ENV_NAME="mlx_env1"

# Ensure system paths are included
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH"

# If a task is provided as an argument, inject it into config.json
if [ $# -gt 0 ]; then
    TASK_DESCRIPTION="$*"
    echo "Injected Task: $TASK_DESCRIPTION"
    
    # Use python to safely update the JSON file (more reliable than sed for multiline/nested JSON)
    python3 -c "
import json
import sys

path = '$CONFIG_FILE'
with open(path, 'r') as f:
    data = json.load(f)

data['agent']['task'] = sys.argv[1]

with open(path, 'w') as f:
    json.dump(data, f, indent=2)
" "$TASK_DESCRIPTION"
fi

cd "$PROJECT_DIR" || exit 1

# Run TuriX
"$CONDA_PATH" run -n "$ENV_NAME" python examples/main.py
