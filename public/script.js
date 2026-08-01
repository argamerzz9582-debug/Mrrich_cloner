const socket = io();
const form = document.getElementById('clonerForm');
const logContent = document.getElementById('logContent');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const startBtn = document.getElementById('startBtn');

// 🎨 Real-Time Theme Applicator
socket.on('apply_theme', (theme) => {
    document.documentElement.style.setProperty('--bg-grad-1', theme.bg1);
    document.documentElement.style.setProperty('--bg-grad-2', theme.bg2);
    document.documentElement.style.setProperty('--primary', theme.primary);
    
    document.getElementById('appTitle').innerText = theme.title;
    document.getElementById('appDesc').innerText = theme.desc;
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const userToken = document.getElementById('userToken').value;
    const sourceId = document.getElementById('sourceId').value;
    const targetId = document.getElementById('targetId').value;
    
    const options = {
        cloneRoles: document.getElementById('cloneRoles').checked,
        cloneChannels: document.getElementById('cloneChannels').checked,
        cloneMessages: document.getElementById('cloneMessages').checked,
        msgLimit: document.getElementById('msgLimit').value
    };

    logContent.innerHTML = 'root@roxy-scraper:~# Initializing scraping sequence...\n';
    progressBar.style.width = '0%';
    progressText.innerText = '0%';
    startBtn.innerText = 'SYNCING DATA...';
    startBtn.disabled = true;

    socket.emit('start_clone', { userToken, sourceId, targetId, options });
});

// Hacker Style Real-time Terminal Logging
socket.on('log', (msg) => {
    const div = document.createElement('div');
    // Prepend hacker prefix to every new log
    div.innerText = `root@roxy-scraper:~# ${msg}`;
    div.style.marginBottom = '4px';
    logContent.appendChild(div);
    
    // Auto-scroll terminal to bottom
    const terminal = document.getElementById('terminal');
    terminal.scrollTop = terminal.scrollHeight;
});

socket.on('progress', (percent) => {
    progressBar.style.width = `${percent}%`;
    progressText.innerText = `${percent}%`;
    if (percent === 100) {
        startBtn.innerText = 'START NEW SEQUENCE';
        startBtn.disabled = false;
    }
});
