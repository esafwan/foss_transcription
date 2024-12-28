let mediaRecorder;
let recordedChunks = [];
let directoryHandle = null;

// Function to store directory handle
async function storeDirHandle(handle) {
    try {
        // Convert directory handle to serializable format
        const serializedHandle = await handle.requestPermission({ mode: 'readwrite' });
        await chrome.storage.local.set({
            'fossTranscriptionDirHandle': handle,
            'lastPermissionTime': Date.now()
        });
        directoryHandle = handle;
    } catch (error) {
        console.error('Failed to store directory handle:', error);
    }
}

// Function to get stored directory handle
async function getStoredDirHandle() {
    try {
        const result = await chrome.storage.local.get(['fossTranscriptionDirHandle', 'lastPermissionTime']);
        if (result.fossTranscriptionDirHandle) {
            const handle = result.fossTranscriptionDirHandle;
            // Check if permission is still valid
            const permission = await handle.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                directoryHandle = handle;
                return handle;
            }
        }
        return null;
    } catch (error) {
        console.error('Failed to get stored directory handle:', error);
        return null;
    }
}

// Function to get or create directory handle
async function getDirectoryHandle() {
    // Try to get stored handle first
    const storedHandle = await getStoredDirHandle();
    if (storedHandle) {
        return storedHandle;
    }

    try {
        // Request root directory access
        const rootHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents',
            id: 'fossTranscription' // Add a unique ID for the picker
        });

        // Try to get or create FOSSTranscription directory
        try {
            directoryHandle = await rootHandle.getDirectoryHandle('FOSSTranscription', {
                create: true
            });
            // Store the handle for future use
            await storeDirHandle(directoryHandle);
            return directoryHandle;
        } catch (error) {
            console.error('Failed to create FOSSTranscription directory:', error);
            // Store the root handle as fallback
            await storeDirHandle(rootHandle);
            return rootHandle;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            return null; // User cancelled directory picker
        }
        throw error;
    }
}

// Modified save function to use directory handle
async function saveRecordingToFile(blob, suggestedName) {
    try {
        const dirHandle = await getDirectoryHandle();
        if (!dirHandle) {
            throw new Error('No directory access');
        }

        // Create file in the directory
        const fileHandle = await dirHandle.getFileHandle(suggestedName, {
            create: true
        });

        // Write the file
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        return fileHandle;
    } catch (error) {
        console.error('Save error:', error);
        throw error;
    }
}

async function initializeRecording() {
    try {
        console.log('Requesting display media...');
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });

        console.log('Got display media, requesting microphone...');
        const micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true 
        });

        const combinedStream = new MediaStream([
            ...displayStream.getTracks(),
            ...micStream.getAudioTracks()
        ]);

        // Store stream for later cleanup
        window.recordingStream = combinedStream;

        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(combinedStream);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
                // Send progress update
                const totalSize = recordedChunks.reduce((size, chunk) => size + chunk.size, 0);
                chrome.runtime.sendMessage({ 
                    type: 'recordingProgress',
                    size: totalSize
                });
            }
        };

        mediaRecorder.onstop = async () => {
            try {
                chrome.runtime.sendMessage({ type: 'processingStart' });
                
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                
                chrome.runtime.sendMessage({ 
                    type: 'recordingComplete',
                    size: blob.size
                });

                const timestamp = new Date()
                    .toISOString()
                    .replace(/[:.]/g, '-')
                    .slice(0, 19);
                const suggestedName = `recording_${timestamp}.webm`;

                try {
                    const fileHandle = await saveRecordingToFile(blob, suggestedName);
                    
                    if (fileHandle) {
                        chrome.runtime.sendMessage({ 
                            type: 'savingComplete',
                            message: 'Recording saved to FOSSTranscription folder!'
                        });
                    } else {
                        // Fallback to chrome.downloads
                        const url = URL.createObjectURL(blob);
                        await chrome.downloads.download({
                            url: url,
                            filename: `FOSSTranscription/${suggestedName}`
                        });
                        URL.revokeObjectURL(url);
                        
                        chrome.runtime.sendMessage({ 
                            type: 'savingComplete',
                            message: 'Recording saved to downloads/FOSSTranscription folder!'
                        });
                    }
                } catch (saveError) {
                    // Fallback to default download if file system access fails
                    const url = URL.createObjectURL(blob);
                    await chrome.downloads.download({
                        url: url,
                        filename: `FOSSTranscription/${suggestedName}`
                    });
                    URL.revokeObjectURL(url);
                    
                    chrome.runtime.sendMessage({ 
                        type: 'savingComplete',
                        message: 'Recording saved to downloads/FOSSTranscription folder!'
                    });
                }
                
            } catch (error) {
                chrome.runtime.sendMessage({ 
                    type: 'processingError',
                    error: `Failed to process: ${error.message}`
                });
            }
        };

        mediaRecorder.start(1000); // Capture chunks every second
        chrome.runtime.sendMessage({ 
            type: 'streamReady',
            success: true
        });

    } catch (error) {
        console.error('Media capture error:', error);
        chrome.runtime.sendMessage({ 
            type: 'streamError',
            success: false,
            error: error.message 
        });
    }
}

// Listen for stop command
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'stopRecording' && mediaRecorder) {
        mediaRecorder.stop();
        // Don't stop tracks until saving is complete
    }
});

document.addEventListener('DOMContentLoaded', initializeRecording); 