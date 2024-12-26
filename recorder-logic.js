let mediaRecorder;
let recordedChunks = [];

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
                const url = URL.createObjectURL(blob);
                
                chrome.runtime.sendMessage({ 
                    type: 'recordingComplete',
                    size: blob.size
                });

                // Create a valid filename
                const timestamp = new Date()
                    .toISOString()
                    .replace(/[:.]/g, '-')  // Replace invalid characters
                    .slice(0, 19);  // Take only the date and time part
                
                // Save the file
                try {
                    await chrome.downloads.download({
                        url: url,
                        filename: `recording_${timestamp}.webm`,
                        saveAs: true
                    });
                    
                    chrome.runtime.sendMessage({ 
                        type: 'savingComplete',
                        message: 'Recording saved successfully! Check your downloads folder.'
                    });
                } catch (saveError) {
                    chrome.runtime.sendMessage({ 
                        type: 'savingError',
                        error: `Failed to save: ${saveError.message}`
                    });
                }
                
                // Clean up
                URL.revokeObjectURL(url);
                
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