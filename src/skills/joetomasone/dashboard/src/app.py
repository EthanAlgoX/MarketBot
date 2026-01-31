#!/usr/bin/env python3
"""Clawd Dashboard - Agent Task Management UI"""

import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Configuration
WORKSPACE = os.environ.get('CLAWD_WORKSPACE', '/root/clawd')
DATA_DIR = Path(__file__).parent / 'data'
TASKS_FILE = DATA_DIR / 'tasks.json'
NOTES_FILE = DATA_DIR / 'notes.json'
ACTION_LOG_FILE = DATA_DIR / 'action_log.json'

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

def load_json(filepath, default=None):
    """Load JSON file or return default."""
    if default is None:
        default = {}
    try:
        if filepath.exists():
            with open(filepath) as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass
    return default

def save_json(filepath, data):
    """Save data to JSON file."""
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2, default=str)

def get_default_tasks():
    """Return default task structure."""
    return {
        'todo': [],
        'in_progress': [],
        'done': [],
        'archived': []
    }

def get_agent_status():
    """Get Clawdbot agent status."""
    try:
        result = subprocess.run(
            ['clawdbot', 'status', '--json'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            # Extract relevant status info - sessions are in .sessions.recent[]
            sessions = data.get('sessions', {}).get('recent', [])
            main_session = None
            for s in sessions:
                if 'clawd:main' in s.get('key', ''):
                    main_session = s
                    break
            
            if main_session:
                # Check if recently active (within last 60 seconds = likely thinking)
                age = main_session.get('age', 999999)  # age in ms
                state = 'thinking' if age < 60000 else 'ready'
                
                return {
                    'status': 'online',
                    'state': state,
                    'model': main_session.get('model', 'unknown'),
                    'tokens': main_session.get('totalTokens', 0),
                    'contextTokens': main_session.get('contextTokens', 0),
                    'percentUsed': main_session.get('percentUsed', 0),
                    'lastActive': main_session.get('updatedAt', 0)
                }
            return {'status': 'online', 'state': 'ready'}
        return {'status': 'offline', 'state': 'error', 'error': 'status command failed'}
    except Exception as e:
        return {'status': 'offline', 'state': 'error', 'error': str(e)}

def log_action(action, details=None):
    """Log an action to the action log."""
    log = load_json(ACTION_LOG_FILE, [])
    log.insert(0, {
        'timestamp': datetime.now().isoformat(),
        'action': action,
        'details': details
    })
    # Keep only last 100 entries
    log = log[:100]
    save_json(ACTION_LOG_FILE, log)

# Routes
@app.route('/')
def index():
    """Main dashboard page."""
    return render_template('index.html')

@app.route('/api/status')
def api_status():
    """Get agent status."""
    return jsonify(get_agent_status())

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Get all tasks."""
    tasks = load_json(TASKS_FILE, get_default_tasks())
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    """Create a new task."""
    data = request.json
    tasks = load_json(TASKS_FILE, get_default_tasks())
    
    new_task = {
        'id': datetime.now().strftime('%Y%m%d%H%M%S%f'),
        'title': data.get('title', 'Untitled'),
        'description': data.get('description', ''),
        'created': datetime.now().isoformat(),
        'column': data.get('column', 'todo')
    }
    
    column = new_task['column']
    if column not in tasks:
        tasks[column] = []
    tasks[column].append(new_task)
    
    save_json(TASKS_FILE, tasks)
    log_action('Task created', new_task['title'])
    
    return jsonify(new_task)

@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    """Update a task (including moving between columns)."""
    data = request.json
    tasks = load_json(TASKS_FILE, get_default_tasks())
    
    # Find and remove task from current column
    task = None
    old_column = None
    for col, items in tasks.items():
        for i, t in enumerate(items):
            if t['id'] == task_id:
                task = items.pop(i)
                old_column = col
                break
        if task:
            break
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    # Update task fields
    task['title'] = data.get('title', task['title'])
    task['description'] = data.get('description', task.get('description', ''))
    new_column = data.get('column', old_column)
    task['column'] = new_column
    
    # Add to new column
    if new_column not in tasks:
        tasks[new_column] = []
    
    # Insert at specified position or append
    position = data.get('position', len(tasks[new_column]))
    tasks[new_column].insert(position, task)
    
    save_json(TASKS_FILE, tasks)
    
    if old_column != new_column:
        log_action(f'Task moved to {new_column}', task['title'])
    else:
        log_action('Task updated', task['title'])
    
    return jsonify(task)

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task."""
    tasks = load_json(TASKS_FILE, get_default_tasks())
    
    for col, items in tasks.items():
        for i, t in enumerate(items):
            if t['id'] == task_id:
                deleted = items.pop(i)
                save_json(TASKS_FILE, tasks)
                log_action('Task deleted', deleted['title'])
                return jsonify({'success': True})
    
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/notes', methods=['GET'])
def get_notes():
    """Get notes for the agent."""
    notes = load_json(NOTES_FILE, {'content': ''})
    return jsonify(notes)

@app.route('/api/notes', methods=['POST'])
def save_notes():
    """Save notes for the agent."""
    data = request.json
    notes = {'content': data.get('content', ''), 'updated': datetime.now().isoformat()}
    save_json(NOTES_FILE, notes)
    log_action('Notes updated')
    return jsonify(notes)

@app.route('/api/action-log')
def get_action_log():
    """Get recent action log."""
    log = load_json(ACTION_LOG_FILE, [])
    return jsonify(log[:50])  # Return last 50 entries

@app.route('/api/deliverables')
def get_deliverables():
    """Get deliverables/folders."""
    # These could be configured or read from a file
    deliverables = [
        {'id': '1', 'name': 'Daily Notes', 'icon': '📝', 'path': f'{WORKSPACE}/memory/', 'type': 'folder'},
        {'id': '2', 'name': 'Scripts', 'icon': '⚡', 'path': f'{WORKSPACE}/scripts/', 'type': 'folder'},
        {'id': '3', 'name': 'Skills', 'icon': '🛠️', 'path': f'{WORKSPACE}/skills/', 'type': 'folder'},
        {'id': '4', 'name': 'Channel Logs', 'icon': '💬', 'path': f'{WORKSPACE}/memory/channel-logs/', 'type': 'folder'},
    ]
    return jsonify(deliverables)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)
