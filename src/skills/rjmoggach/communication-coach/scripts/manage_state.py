#!/usr/bin/env python3
"""
State management for communication training.
Keeps context minimal by storing state in JSON files outside context window.
"""

import json
import os
import sys
import argparse
from datetime import datetime
from pathlib import Path

# State file locations (relative to skill directory or absolute)
STATE_FILE = "state.json"
BASELINE_FILE = "baseline.json"
HISTORY_DIR = "history"
SAMPLES_DIR = "samples"

def ensure_dirs():
    """Create necessary directories if they don't exist."""
    Path(HISTORY_DIR).mkdir(exist_ok=True)
    Path(SAMPLES_DIR).mkdir(exist_ok=True)

def load_state():
    """Load current training state."""
    if not os.path.exists(STATE_FILE):
        # Initialize new state
        return {
            "level": 1,
            "points": 0,
            "dimensions": {
                "clarity": {"current": 0, "baseline": None, "samples": 0},
                "vocal_control": {"current": 0, "baseline": None, "samples": 0},
                "presence": {"current": 0, "baseline": None, "samples": 0},
                "persuasion": {"current": 0, "baseline": None, "samples": 0},
                "boundary_setting": {"current": 0, "baseline": None, "samples": 0}
            },
            "active_challenges": [],
            "last_updated": datetime.now().isoformat()
        }
    
    with open(STATE_FILE, 'r') as f:
        return json.load(f)

def save_state(state):
    """Save state to file."""
    state["last_updated"] = datetime.now().isoformat()
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

def update_dimension(dimension, score, modality="email-formal"):
    """
    Update a dimension score and check if baseline is established.
    
    Args:
        dimension: Name of dimension (clarity, vocal_control, etc.)
        score: New score (0-10)
        modality: Communication type
    
    Returns:
        Dict with update status and whether baseline is established
    """
    state = load_state()
    
    if dimension not in state["dimensions"]:
        return {"error": f"Unknown dimension: {dimension}"}
    
    dim_state = state["dimensions"][dimension]
    dim_state["current"] = score
    dim_state["samples"] += 1
    
    # Baseline establishment logic
    baseline_threshold = {
        "email-formal": 10,
        "email-casual": 10,
        "slack": 15,
        "sms": 15,
        "presentation": 5,
        "conversation": 10
    }
    
    threshold = baseline_threshold.get(modality, 10)
    
    if dim_state["baseline"] is None and dim_state["samples"] >= threshold:
        # Calculate baseline as average of all samples so far
        dim_state["baseline"] = score  # Simplified: use current as baseline anchor
        baseline_established = True
    else:
        baseline_established = False
    
    # Award points for improvement
    points_earned = 0
    if dim_state["baseline"] is not None:
        improvement = score - dim_state["baseline"]
        if improvement > 0:
            points_earned = int(improvement * 2)  # 2 points per point improvement
            state["points"] += points_earned
    
    save_state(state)
    
    return {
        "dimension": dimension,
        "score": score,
        "baseline": dim_state["baseline"],
        "baseline_established": baseline_established,
        "samples": dim_state["samples"],
        "points_earned": points_earned,
        "total_points": state["points"]
    }

def get_weakest_dimension():
    """Identify the dimension with lowest current score."""
    state = load_state()
    
    dimensions = state["dimensions"]
    weakest = None
    lowest_score = 11  # Start above max
    
    for dim, data in dimensions.items():
        if data["baseline"] is not None:  # Only consider established baselines
            if data["current"] < lowest_score:
                lowest_score = data["current"]
                weakest = dim
    
    return {
        "weakest_dimension": weakest,
        "score": lowest_score if weakest else None
    }

def save_sample(text, modality, scores):
    """Save analyzed sample for future baseline calculations."""
    ensure_dirs()
    
    timestamp = datetime.now().isoformat()
    filename = f"{SAMPLES_DIR}/{timestamp.replace(':', '-')}.json"
    
    sample = {
        "timestamp": timestamp,
        "modality": modality,
        "text": text,
        "scores": scores
    }
    
    with open(filename, 'w') as f:
        json.dump(sample, f, indent=2)

def archive_to_history():
    """Archive current month's data to history."""
    ensure_dirs()
    
    state = load_state()
    now = datetime.now()
    month_file = f"{HISTORY_DIR}/{now.year}-{now.month:02d}.json"
    
    history_entry = {
        "month": f"{now.year}-{now.month:02d}",
        "archived_at": now.isoformat(),
        "state_snapshot": state
    }
    
    # Load existing history if present
    if os.path.exists(month_file):
        with open(month_file, 'r') as f:
            history = json.load(f)
    else:
        history = []
    
    history.append(history_entry)
    
    with open(month_file, 'w') as f:
        json.dump(history, f, indent=2)

def main():
    parser = argparse.ArgumentParser(description='Manage communication training state')
    parser.add_argument('--load', action='store_true', help='Load and display current state')
    parser.add_argument('--update', action='store_true', help='Update a dimension score')
    parser.add_argument('--dimension', type=str, help='Dimension to update')
    parser.add_argument('--score', type=float, help='New score (0-10)')
    parser.add_argument('--modality', type=str, default='email-formal', help='Communication modality')
    parser.add_argument('--weakest', action='store_true', help='Get weakest dimension')
    parser.add_argument('--archive', action='store_true', help='Archive current state to history')
    parser.add_argument('--reset', action='store_true', help='Reset state (WARNING: destructive)')
    
    args = parser.parse_args()
    
    if args.load:
        state = load_state()
        print(json.dumps(state, indent=2))
    
    elif args.update:
        if not args.dimension or args.score is None:
            print("Error: --update requires --dimension and --score")
            sys.exit(1)
        
        result = update_dimension(args.dimension, args.score, args.modality)
        print(json.dumps(result, indent=2))
    
    elif args.weakest:
        result = get_weakest_dimension()
        print(json.dumps(result, indent=2))
    
    elif args.archive:
        archive_to_history()
        print("State archived to history")
    
    elif args.reset:
        if os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
        print("State reset")
    
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
