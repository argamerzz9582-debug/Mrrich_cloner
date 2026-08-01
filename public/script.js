const socket = io();
const form = document.getElementById('clonerForm');
const logContent = document.getElementById('logContent');
const progressBar = document.getElementById('progressBar');
const startBtn = document.getElementById('startBtn');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const userToken = document.getElementById('userToken').value;
    const sourceId = document.getElementById('sourceId').value;
    const targetId = document.getElementById('targetId').value;

    logContent.innerHTML = '';
    progressBar.style.width = '0%';
    startBtn.innerText = 'Cloning in progress... ⚙️';
    startBtn.disabled = true;

    socket.emit('start_clone', { userToken, sourceId, targetId });
});

socket.on('log', (msg) => {
    const div = document.createElement('div');
    div.innerText = `> ${msg}`;
    div.style.marginBottom = '4px';
    logContent.appendChild(div);
    const terminal = document.getElementById('terminal');
    terminal.scrollTop = terminal.scrollHeight; // Auto-scroll
});

socket.on('progress', (percent) => {
    progressBar.style.width = `${percent}%`;
    if (percent === 100) {
        startBtn.innerText = 'Start Cloning Process';
        startBtn.disabled = false;
    }
});

