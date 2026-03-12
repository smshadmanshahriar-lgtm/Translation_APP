// Web Speech API initialization
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

// DOM Elements
const micBtn = document.getElementById('mic-btn');
const micStatus = document.getElementById('mic-status');
const inputTextDisplay = document.getElementById('input-text');
const outputTextDisplay = document.getElementById('output-text');
const langToggle = document.getElementById('lang-toggle-checkbox');
const langLabelLeft = document.getElementById('lang-label-left');
const langLabelRight = document.getElementById('lang-label-right');
const copyBtn = document.getElementById('copy-btn');
const clearBtn = document.getElementById('clear-btn');
const waveContainer = document.getElementById('wave-container');
const video = document.getElementById('video');
const subtitleText = document.getElementById('subtitle-text');
const recordBtn = document.getElementById('record-btn');
const recordStatus = document.getElementById('record-status');

let mediaRecorder;
let recordedChunks = [];
let stream;

let isListening = false;
let sourceLang = 'en-US';
let targetLang = 'fi-FI';
let langPair = 'en|fi';

// Check for Support
if (!recognition) {
    micStatus.innerText = "Speech not supported";
    micBtn.disabled = true;
    alert("Speech Recognition is not supported in this browser. Please use Chrome or Edge.");
} else {
    recognition.continuous = true;
    recognition.interimResults = true;
}

// Language Toggle Logic
langToggle.addEventListener('change', () => {
    if (langToggle.checked) {
        // FI -> EN
        sourceLang = 'fi-FI';
        targetLang = 'en-US';
        langPair = 'fi|en';
        langLabelLeft.style.opacity = '0.5';
        langLabelRight.style.opacity = '1';
    } else {
        // EN -> FI
        sourceLang = 'en-US';
        targetLang = 'fi-FI';
        langPair = 'en|fi';
        langLabelLeft.style.opacity = '1';
        langLabelRight.style.opacity = '0.5';
    }
    
    // Restart recognition if listening to apply new language
    if (isListening) {
        recognition.stop();
        setTimeout(() => recognition.start(), 100);
    }
});

// Mic Button Click
micBtn.addEventListener('click', () => {
    if (!isListening) {
        startListening();
    } else {
        stopListening();
    }
});

// Copy Feature
copyBtn.addEventListener('click', () => {
    const text = outputTextDisplay.innerText;
    if (text && text !== "...") {
        navigator.clipboard.writeText(text);
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#00ff00" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>';
        setTimeout(() => {
            copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>';
        }, 2000);
    }
});

// Clear Feature
clearBtn.addEventListener('click', () => {
    inputTextDisplay.innerText = "...";
    outputTextDisplay.innerText = "...";
    subtitleText.innerText = "Translation will appear here...";
});

function startListening() {
    recognition.lang = sourceLang;
    recognition.start();
    isListening = true;
    micBtn.classList.add('listening');
    micStatus.innerText = "Stop Listening";
    inputTextDisplay.innerText = "Listening...";
    outputTextDisplay.innerText = "...";
    recordBtn.disabled = false;
    recordBtn.title = "Record this session";
}

function stopListening() {
    recognition.stop();
    isListening = false;
    micBtn.classList.remove('listening');
    micStatus.innerText = "Start Listening";
    
    // Stop recording if active
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        stopRecording();
    }
    recordBtn.disabled = true;
}

// Recording Logic
recordBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
    } else {
        startRecording();
    }
});

function startRecording() {
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `translated-session-${new Date().getTime()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    };

    mediaRecorder.start();
    recordBtn.classList.add('recording');
    recordStatus.innerText = "Stop Recording";
}

function stopRecording() {
    mediaRecorder.stop();
    recordBtn.classList.remove('recording');
    recordStatus.innerText = "Record Session";
}

// Recognition Result
recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
        } else {
            interimTranscript += event.results[i][0].transcript;
        }
    }

    const currentText = finalTranscript || interimTranscript;
    inputTextDisplay.innerText = currentText;

    if (currentText.trim()) {
        translateText(currentText);
    }
};

recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopListening();
};

recognition.onend = () => {
    if (isListening) {
        recognition.start(); // Keep listening unless manually stopped
    }
};

// Camera Initialization
async function initCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            }, 
            audio: true 
        });
        video.srcObject = stream;
    } catch (error) {
        console.error('Error accessing camera/mic:', error);
        subtitleText.innerText = "Camera or Mic access denied.";
    }
}

// Call camera init on load
window.addEventListener('load', initCamera);

// Translation Logic
let translationTimeout;
async function translateText(text) {
    if (!text.trim()) return;

    outputTextDisplay.innerText = "Translating...";
    subtitleText.innerText = "...";
    subtitleText.style.opacity = "0.5";
    
    // Clear previous timeout to debounce if multiple final results come fast
    clearTimeout(translationTimeout);
    
    translationTimeout = setTimeout(async () => {
        try {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.responseData) {
                const translatedText = data.responseData.translatedText;
                outputTextDisplay.innerText = translatedText;
                // Update subtitles
                subtitleText.innerText = translatedText;
                subtitleText.style.opacity = "1";
            } else {
                outputTextDisplay.innerText = "Translation error.";
            }
        } catch (error) {
            console.error('Translation error:', error);
            outputTextDisplay.innerText = "Error in translation service.";
        }
    }, 300); // 300ms debounce for live feel
}
