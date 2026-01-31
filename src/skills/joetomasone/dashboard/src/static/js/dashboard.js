// Clawd Dashboard - Frontend Logic

const API_BASE = '';
let tasks = { todo: [], in_progress: [], done: [], archived: [] };
let draggedTask = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadStatus();
    loadTasks();
    loadNotes();
    loadDeliverables();
    loadActionLog();
    
    // Refresh data periodically
    setInterval(loadStatus, 10000);  // Every 10 seconds
    setInterval(loadActionLog, 30000);  // Every 30 seconds
    
    // Setup drag and drop
    setupDragDrop();
});

// API Helpers
async function api(endpoint, options = {}) {
    const response = await fetch(API_BASE + endpoint, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    return response.json();
}

// Status
async function loadStatus() {
    try {
        const status = await api('/api/status');
        updateStatusDisplay(status);
    } catch (e) {
        console.error('Failed to load status:', e);
        updateStatusDisplay({ status: 'offline', state: 'error' });
    }
}

function updateStatusDisplay(status) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const badge = document.getElementById('onlineBadge');
    const detail = document.getElementById('statusDetail');
    const syncEl = document.getElementById('lastSync');
    
    // Update status dot
    dot.className = 'status-dot ' + (status.status === 'online' ? status.state || 'online' : 'offline');
    
    // Update status text
    const stateMap = {
        'ready': 'Ready',
        'thinking': 'Thinking...',
        'working': 'Working...',
        'idle': 'Idle',
        'error': 'Error'
    };
    text.textContent = stateMap[status.state] || status.state || 'Unknown';
    
    // Update badge
    if (status.status === 'online') {
        badge.textContent = '● Online';
        badge.className = 'online-badge';
    } else {
        badge.textContent = '● Offline';
        badge.className = 'online-badge offline';
    }
    
    // Update detail
    if (status.model) {
        const tokens = status.tokens || 0;
        const ctx = status.contextTokens || 200000;
        const pct = Math.round((tokens / ctx) * 100);
        detail.textContent = `${status.model.split('/').pop()} • ${Math.round(tokens/1000)}k/${Math.round(ctx/1000)}k (${pct}%)`;
    }
    
    // Update sync time
    syncEl.textContent = 'Last sync: ' + new Date().toLocaleTimeString();
}

// Tasks
async function loadTasks() {
    try {
        tasks = await api('/api/tasks');
        renderTasks();
    } catch (e) {
        console.error('Failed to load tasks:', e);
    }
}

function renderTasks() {
    const columns = ['todo', 'in_progress', 'done', 'archived'];
    
    columns.forEach(col => {
        const list = document.getElementById(col + 'List');
        const count = document.getElementById(col + 'Count');
        const items = tasks[col] || [];
        
        list.innerHTML = items.map(task => `
            <div class="task-card" draggable="true" data-id="${task.id}" onclick="editTask('${task.id}')">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-date">${formatDate(task.created)}</div>
                ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
            </div>
        `).join('');
        
        count.textContent = items.length;
    });
    
    // Re-attach drag listeners
    setupDragDrop();
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add Task
function showAddTask(column) {
    document.getElementById('newTaskColumn').value = column;
    document.getElementById('newTaskTitle').value = '';
    document.getElementById('newTaskDesc').value = '';
    document.getElementById('addTaskModal').classList.add('active');
    document.getElementById('newTaskTitle').focus();
}

function hideAddTask() {
    document.getElementById('addTaskModal').classList.remove('active');
}

async function addTask() {
    const title = document.getElementById('newTaskTitle').value.trim();
    const desc = document.getElementById('newTaskDesc').value.trim();
    const column = document.getElementById('newTaskColumn').value;
    
    if (!title) return;
    
    try {
        await api('/api/tasks', {
            method: 'POST',
            body: JSON.stringify({ title, description: desc, column })
        });
        hideAddTask();
        loadTasks();
        loadActionLog();
    } catch (e) {
        console.error('Failed to add task:', e);
    }
}

// Edit Task
function editTask(taskId) {
    // Find task
    let task = null;
    let column = null;
    for (const [col, items] of Object.entries(tasks)) {
        const found = items.find(t => t.id === taskId);
        if (found) {
            task = found;
            column = col;
            break;
        }
    }
    
    if (!task) return;
    
    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTaskColumn').value = column;
    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskDesc').value = task.description || '';
    document.getElementById('editTaskModal').classList.add('active');
    document.getElementById('editTaskTitle').focus();
}

function hideEditTask() {
    document.getElementById('editTaskModal').classList.remove('active');
}

async function updateTask() {
    const id = document.getElementById('editTaskId').value;
    const title = document.getElementById('editTaskTitle').value.trim();
    const desc = document.getElementById('editTaskDesc').value.trim();
    const column = document.getElementById('editTaskColumn').value;
    
    if (!title) return;
    
    try {
        await api(`/api/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ title, description: desc, column })
        });
        hideEditTask();
        loadTasks();
        loadActionLog();
    } catch (e) {
        console.error('Failed to update task:', e);
    }
}

async function deleteTask() {
    const id = document.getElementById('editTaskId').value;
    
    if (!confirm('Delete this task?')) return;
    
    try {
        await api(`/api/tasks/${id}`, { method: 'DELETE' });
        hideEditTask();
        loadTasks();
        loadActionLog();
    } catch (e) {
        console.error('Failed to delete task:', e);
    }
}

// Drag and Drop
function setupDragDrop() {
    const cards = document.querySelectorAll('.task-card');
    const lists = document.querySelectorAll('.task-list');
    
    cards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });
    
    lists.forEach(list => {
        list.addEventListener('dragover', handleDragOver);
        list.addEventListener('drop', handleDrop);
        list.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedTask = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedTask = null;
    
    // Remove all drop indicators
    document.querySelectorAll('.task-list').forEach(list => {
        list.style.background = '';
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.style.background = 'rgba(96, 165, 250, 0.1)';
}

function handleDragLeave(e) {
    e.currentTarget.style.background = '';
}

async function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.style.background = '';
    
    const taskId = e.dataTransfer.getData('text/plain');
    const targetColumn = e.currentTarget.closest('.kanban-column').dataset.column;
    
    try {
        await api(`/api/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify({ column: targetColumn })
        });
        loadTasks();
        loadActionLog();
    } catch (e) {
        console.error('Failed to move task:', e);
    }
}

// Notes
async function loadNotes() {
    try {
        const notes = await api('/api/notes');
        document.getElementById('notesContent').value = notes.content || '';
    } catch (e) {
        console.error('Failed to load notes:', e);
    }
}

async function saveNotes() {
    const content = document.getElementById('notesContent').value;
    
    try {
        await api('/api/notes', {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        loadActionLog();
        
        // Show save confirmation
        const btn = document.querySelector('.save-btn');
        btn.textContent = 'Saved!';
        setTimeout(() => btn.textContent = 'Save Notes', 1500);
    } catch (e) {
        console.error('Failed to save notes:', e);
    }
}

// Deliverables
async function loadDeliverables() {
    try {
        const items = await api('/api/deliverables');
        const grid = document.getElementById('deliverablesList');
        
        grid.innerHTML = items.map(d => `
            <div class="deliverable-card" onclick="openDeliverable('${d.path}')">
                <div class="icon">${d.icon}</div>
                <div class="name">${d.name}</div>
                <div class="type">${d.type}</div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load deliverables:', e);
    }
}

function openDeliverable(path) {
    // Could open in file manager or show contents
    alert('Path: ' + path);
}

// Action Log
async function loadActionLog() {
    try {
        const log = await api('/api/action-log');
        const list = document.getElementById('actionLogList');
        
        list.innerHTML = log.slice(0, 20).map(item => {
            const time = new Date(item.timestamp).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            const date = new Date(item.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
            
            return `
                <div class="action-log-item">
                    <span class="timestamp">${date}, ${time}</span>
                    <span class="action">${item.action}</span>
                    ${item.details ? `<div class="details">${escapeHtml(item.details)}</div>` : ''}
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Failed to load action log:', e);
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hideAddTask();
        hideEditTask();
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
        if (document.getElementById('addTaskModal').classList.contains('active')) {
            addTask();
        } else if (document.getElementById('editTaskModal').classList.contains('active')) {
            updateTask();
        }
    }
});

// Close modals on background click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});
