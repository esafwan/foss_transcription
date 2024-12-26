console.log('Background service worker is active.');

let recorder, recordingTab;
let isRecording = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startRecording") {
        // Create a tab to handle the media request
        chrome.tabs.create({ url: 'recorder.html', active: true }, (tab) => {
            recordingTab = tab.id;
            sendResponse({ success: true, message: "Initializing recording..." });
        });
        return true;
    } else if (message.action === "stopRecording") {
        if (recordingTab) {
            chrome.tabs.sendMessage(recordingTab, { action: "stopRecording" });
        }
        sendResponse({ success: true });
        return true;
    } else if (message.action === "getRecordingState") {
        sendResponse({ isRecording });
        return true;
    } else if (message.type === 'savingComplete') {
        // Only close the tab after saving is complete
        if (recordingTab) {
            chrome.tabs.remove(recordingTab);
            recordingTab = null;
        }
        isRecording = false;
    }
});

// Listen for messages from recorder.html
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'streamReady') {
        console.log('Stream ready');
        isRecording = true;
        // Notify popup that recording has started
        chrome.runtime.sendMessage({ 
            type: 'recordingStarted',
            startTime: Date.now()
        });
    } else if (message.type === 'streamError') {
        console.error('Stream error:', message.error);
        isRecording = false;
        // Close the recorder tab on error
        if (recordingTab) {
            chrome.tabs.remove(recordingTab);
            recordingTab = null;
        }
    }
});

function stopRecording() {
    if (recordingTab) {
        chrome.scripting.executeScript({
            target: { tabId: recordingTab },
            func: () => {
                if (window.recordingStream) {
                    window.recordingStream.getTracks().forEach(track => track.stop());
                }
            }
        });
        chrome.tabs.remove(recordingTab);
        recordingTab = null;
        isRecording = false;
    }
}