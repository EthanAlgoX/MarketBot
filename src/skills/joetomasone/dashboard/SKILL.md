# Dashboard Skill

Build and run a Kanban-style task management dashboard for your Clawdbot agent.

## Overview

This skill creates a local web dashboard that lets you:
- Manage tasks in a Kanban board (To Do → In Progress → Done → Archived)
- Monitor agent status in real-time (Online/Thinking/Ready)
- Drop notes for the agent to check on heartbeats
- View action logs and quick-access deliverables

## Quick Start

Run the setup script to install and start the dashboard:

```bash
bash /path/to/skills/dashboard/setup.sh
```

Or have your agent run it:
> Set up and start my Clawdbot dashboard

## Manual Setup

### 1. Install Dependencies

```bash
# Ubuntu/Debian
apt-get install -y python3-flask python3-flask-cors

# Or with pip
pip3 install flask flask-cors
```

### 2. Create Dashboard Directory

```bash
mkdir -p ~/clawd-dashboard/{templates,static/css,static/js,data}
```

### 3. Copy Files

Copy these files from the skill's `src/` directory:
- `app.py` → `~/clawd-dashboard/`
- `templates/index.html` → `~/clawd-dashboard/templates/`
- `static/css/style.css` → `~/clawd-dashboard/static/css/`
- `static/js/dashboard.js` → `~/clawd-dashboard/static/js/`

### 4. Start the Dashboard

```bash
cd ~/clawd-dashboard
python3 app.py
```

Dashboard runs on **http://localhost:5050**

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAWD_WORKSPACE` | `/root/clawd` | Path to agent workspace |
| `DASHBOARD_PORT` | `5050` | Port to run dashboard on |

### Customization

Edit `app.py` to customize:
- **Deliverables**: Modify `get_deliverables()` to add your own folder shortcuts
- **Agent ID**: Change the session key pattern in `get_agent_status()` if your agent isn't named "clawd"

## Features

### Kanban Board
- **Drag & drop** tasks between columns
- **Color-coded** columns (red=todo, yellow=progress, green=done, gray=archived)
- **Click to edit** any task
- Tasks persist in `data/tasks.json`

### Agent Status
- Polls `clawdbot status --json` every 10 seconds
- Shows: Online/Offline, Thinking/Ready state
- Displays model name and token usage

### Notes Section
- Add instructions for your agent
- Agent can read these during heartbeat checks
- Saved to `data/notes.json`

### Action Log
- Tracks task creates/moves/deletes
- Timestamps all actions
- Last 100 entries stored in `data/action_log.json`

## Running as a Service

To keep the dashboard running after logout:

```bash
# Using systemd (recommended)
cat > /etc/systemd/system/clawd-dashboard.service << 'EOF'
[Unit]
Description=Clawd Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/clawd-dashboard
ExecStart=/usr/bin/python3 app.py
Restart=always
Environment=CLAWD_WORKSPACE=/root/clawd

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable clawd-dashboard
systemctl start clawd-dashboard
```

## Security Notes

- Dashboard has **no authentication** by default
- Only run on trusted networks (localhost, Tailscale, VPN)
- Do NOT expose to public internet without adding auth

## Troubleshooting

### "Status shows offline"
- Check that `clawdbot status --json` works from command line
- Verify the agent ID pattern matches your setup

### "Tasks not saving"
- Check that `data/` directory exists and is writable
- Look for errors in the terminal or `/tmp/dashboard.log`

### "Port already in use"
- Change port: `python3 app.py` then edit the `app.run()` line
- Or kill existing process: `pkill -f "python3 app.py"`

## Files Reference

```
clawd-dashboard/
├── app.py                 # Flask backend (API + routes)
├── data/
│   ├── tasks.json         # Kanban tasks
│   ├── notes.json         # Notes for agent
│   └── action_log.json    # Activity history
├── static/
│   ├── css/
│   │   └── style.css      # Dark theme styles
│   └── js/
│       └── dashboard.js   # Frontend logic
└── templates/
    └── index.html         # Main page template
```

## Credits

Inspired by the "Klaus Dashboard" from Nate Herk's Clawdbot video.
