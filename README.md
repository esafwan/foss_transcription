# FOSS Transcription - Chrome Extension

A free and open-source Chrome extension that allows you to record your screen and microphone audio simultaneously using WebRTC technology, perfect for transcription purposes.

## Features

- Screen recording with system audio
- Microphone audio recording
- Combined audio streams
- Real-time recording status and file size monitoring
- Downloads recordings in WebM format

## Installation

### Developer Mode Installation

1. **Download or Clone the Repository**
   ```bash
   git clone git@github.com:esafwan/foss_transcription.git
   cd foss_transcription
   ```

2. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Go to `chrome://extensions/`
   - Or navigate through: Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle ON the "Developer mode" switch in the top right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the directory containing the extension files
   - Make sure the directory contains `manifest.json`

## Usage

1. **Start Recording**
   - Click the extension icon in your Chrome toolbar
   - Click the "Start Recording" button
   - Select the screen/window/tab you want to record


2. **During Recording**
   - A new tab will open while recording status is active
   - The extension popup will display recording file size
   - You can minimize the recording tab but don't close it

3. **Stop Recording**
   - Click the extension icon again
   - Click the "Stop Recording" button
   - The recording will be processed and automatically downloaded
   - Choose where to save your recording


## Development

The extension is built using:
- HTML/CSS/JavaScript
- Chrome Extension APIs
- WebRTC APIs
- MediaRecorder API

## License
AGPL-3.0