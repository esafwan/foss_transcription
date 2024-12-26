let recorder, stream;
const statusDisplay = document.createElement('p');
document.body.appendChild(statusDisplay);

function updateStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = type; // 'error', 'success', or default
}

let startTime = null;
let timerInterval = null;

document.getElementById('start').addEventListener('click', async () => {
    try {
        updateStatus('Initializing recording...', 'info');
        
        const response = await chrome.runtime.sendMessage({ action: "startRecording" });
        console.log('Initial response:', response);
        
        if (response.success) {
            updateStatus('Please select a source in the new tab...', 'info');
            document.getElementById('start').disabled = true;
            document.getElementById('stop').disabled = false;
        } else {
            throw new Error(response.error || 'Failed to initialize recording');
        }
    } catch (error) {
        console.error('Recording error:', error);
        updateStatus(`Failed to start recording: ${error.message}`, 'error');
    }
});

document.getElementById('stop').addEventListener('click', () => {
    try {
        chrome.runtime.sendMessage({ action: "stopRecording" });
        document.getElementById('start').disabled = false;
        document.getElementById('stop').disabled = true;
        updateStatus('Recording stopped. Processing file...');
    } catch (error) {
        updateStatus(`Failed to stop recording: ${error.message}`, 'error');
    }
});

// Listen for recording started message
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'recordingStarted') {
        console.log('Recording started at:', message.startTime); // Debug log
        startTime = message.startTime;
        startTimer();
        document.getElementById('stop').disabled = false;
    } else if (message.type === 'recordingProgress') {
        const sizeMB = (message.size / (1024 * 1024)).toFixed(2);
        const timeElapsed = getElapsedTime();
        console.log('Time elapsed:', timeElapsed); // Debug log
        updateStatus(
            `Recording... ${timeElapsed} (${sizeMB} MB)`,
            'success'
        );
    } else if (message.type === 'processingStart') {
        
        stopTimer();
        updateStatus('Processing recording... Please wait...', 'info');
    } else if (message.type === 'recordingComplete') {
        const sizeMB = (message.size / (1024 * 1024)).toFixed(2);
        updateStatus(
            `Processing complete! Size: ${sizeMB} MB. Preparing to save...`,
            'success'
        );
    } else if (message.type === 'savingComplete') {
        updateStatus(message.message, 'success');
        document.getElementById('start').disabled = false;
        document.getElementById('stop').disabled = true;
    } else if (message.type === 'processingError') {
        updateStatus(message.error, 'error');
        document.getElementById('start').disabled = false;
        document.getElementById('stop').disabled = true;
    } else if (message.type === 'savingError') {
        updateStatus(message.error, 'error');
        document.getElementById('start').disabled = false;
        document.getElementById('stop').disabled = true;
    } else if (message.type === 'streamError') {
        stopTimer();
        updateStatus(`Error: ${message.error}`, 'error');
        document.getElementById('start').disabled = false;
        document.getElementById('stop').disabled = true;
    }
});

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const timeElapsed = getElapsedTime();
        const sizeMB = recorder && recorder.size ? (recorder.size / (1024 * 1024)).toFixed(2) : '0.00';
        updateStatus(
            `Recording... ${timeElapsed} (${sizeMB} MB)`,
            'success'
        );
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Check recording state when popup opens
window.addEventListener('load', async () => {
    const state = await chrome.runtime.sendMessage({ action: "getRecordingState" });
    if (state.isRecording) {
        document.getElementById('start').disabled = true;
        document.getElementById('stop').disabled = false;
    }
});

function downloadRecording(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = "recording.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function getElapsedTime() {
    if (!startTime) return "0:00";
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}