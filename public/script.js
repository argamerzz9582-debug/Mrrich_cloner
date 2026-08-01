const socket = io();
const form = document.getElementById('clonerForm');
const logContent = document.getElementById('logContent');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const startBtn = document.getElementById('startBtn');

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

    logContent.innerHTML = '';
    progressBar.style.width = '0%';
    progressText.innerText = '0% Complete';
    startBtn.innerText = 'Syncing Data...';
    startBtn.disabled = true;

    socket.emit('start_clone', { userToken, sourceId, targetId, options });
});

socket.on('log', (msg) => {
    const div = document.createElement('div');
    div.innerText = `> ${msg}`;
    div.style.marginBottom = '6px';
    div.style.opacity = '0.9';
    logContent.appendChild(div);
    const terminal = document.getElementById('terminal');
    terminal.scrollTop = terminal.scrollHeight;
});

socket.on('progress', (percent) => {
    progressBar.style.width = `${percent}%`;
    progressText.innerText = `${percent}% Complete`;
    if (percent === 100) {
        startBtn.innerText = 'Initiate New Sync';
        startBtn.disabled = false;
    }
});
