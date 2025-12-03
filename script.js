class IntervalTester {
    constructor() {
        // 1. Audio Context Setup
        // Check for AudioContext compatibility
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();

        // 2. State and Settings
        this.isReady = false; 
        this.isPlaying = false;
        this.currentTestIntervalName = null;
        this.lastPlayedFrequencies = [];
        this.currentStreak = 0;
        this.highStrek = 0

        this.settings = { 
            rootFrequency: 261.63, // C4 frequency
            Intervals: [
                'Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 
                'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 
                'Minor 7th', 'Major 7th', 'Octave'
            ],
            noteDuration: 0.75, // in seconds
            mode: 'melodic' // 'melodic' or 'harmonic'
        };
        this.settings.intervalsInUse = this.settings.Intervals;

        // 3. Mapping Interval Names to Half-Steps
        this.intervalMap = this.buildIntervalMap(); 
        
        // 4. DOM Elements
        this.dom = {
            status: document.getElementById('status-message'),
            playButton: document.getElementById('play-button'),
            replayButton: document.getElementById('replay-button'),
            guessGrid: document.getElementById('interval-guess-grid'),
            feedback: document.getElementById('feedback-area'),
            modeSelect: document.getElementById('mode-select'),
            rootNoteSelect: document.getElementById('root-note-select'),
            durationInput: document.getElementById('duration-input'),

            statsPanel: document.getElementById('stats-panel'),
            currentStreak: document.getElementById('current-streak-p'),
            highStreak: document.getElementById('high-streak-p'),
        };
        
        this.renderGuessButtons();
        this.attachEventListeners();
    }

    // --- Core Data and Setup Methods ---
    
    buildIntervalMap() {
        // Maps interval names to the number of half-steps (semitones)
        return {
            'Unison': 0,
            'Minor 2nd': 1,
            'Major 2nd': 2,
            'Minor 3rd': 3,
            'Major 3rd': 4,
            'Perfect 4th': 5,
            'Tritone': 6,
            'Augmented 4th': 6, // Tritone can have multiple names
            'Diminished 5th': 6,
            'Perfect 5th': 7,
            'Minor 6th': 8,
            'Major 6th': 9,
            'Minor 7th': 10,
            'Major 7th': 11,
            'Octave': 12
        };
    }

    attachEventListeners() {
        // Unlock audio context on first click for browser compatibility
        document.addEventListener('click', () => this.unlockAudioContext(), { once: true });
        this.dom.playButton.addEventListener('click', () => this.playTest(true));
        this.dom.replayButton.addEventListener('click', () => this.playTest(false));
        
        // Settings listeners
        this.dom.modeSelect.addEventListener('change', (e) => this.settings.mode = e.target.value);
        this.dom.rootNoteSelect.addEventListener('change', (e) => this.settings.rootFrequency = parseFloat(e.target.value));
        this.dom.durationInput.addEventListener('change', (e) => {
            const value = parseFloat(e.target.value);
            if (value >= 0.1 && value <= 2.0) {
                this.settings.noteDuration = value;
            }
        });
        
        // Guess button listener
        this.dom.guessGrid.addEventListener('click', (e) => {
            const button = e.target.closest('.interval-button');
            // Only allow guessing if a test is currently active and not playing
            if (button && this.currentTestIntervalName && !this.isPlaying) {
                this.checkAnswer(button.dataset.interval);
            }
        });
    }
    
    unlockAudioContext() {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().then(() => {
                this.isReady = true;
                this.dom.status.className = 'text-center p-3 mb-6 rounded-lg bg-green-900/50 text-green-300 font-medium';
                this.dom.status.innerText = 'Audio Context Active. Ready to Play!';
                this.dom.playButton.disabled = false;
                this.dom.playButton.classList.remove('disabled-button');
            });
        } else {
            this.isReady = true;
            this.dom.playButton.disabled = false;
            this.dom.playButton.classList.remove('disabled-button');
        }
    }


    // --- UI and Feedback Methods ---

    renderGuessButtons() {
        this.dom.guessGrid.innerHTML = ''; 
        this.settings.Intervals.forEach(displayIntervalName => {
            const button = document.createElement('button');
            button.dataset.interval = displayIntervalName;
            button.textContent = displayIntervalName;
            button.className = 'interval-button bg-gray-700 hover:bg-indigo-600 text-white font-semibold w-full h-10 rounded-lg shadow-md flex items-center justify-center text-xs sm:text-sm';
            this.dom.guessGrid.appendChild(button);
        });
    }

    updateFeedback(message, type) {
        // Reset classes
        this.dom.feedback.classList.remove('hidden', 'bg-red-900/50', 'bg-green-900/50', 'bg-blue-900/50', 'text-green-300', 'text-red-300', 'text-blue-300');
        this.dom.feedback.textContent = message;

        // Apply new classes based on message type
        if (type === 'correct') {
            this.dom.feedback.classList.add('bg-green-900/50', 'text-green-300');
        } else if (type === 'incorrect') {
            this.dom.feedback.classList.add('bg-red-900/50', 'text-red-300');
        } else { // info
            this.dom.feedback.classList.add('bg-blue-900/50', 'text-blue-300');
        }
    }


    // --- Audio Playback Methods ---

    playNote(frequency, startTime, duration) {
        if (this.audioCtx.state === 'suspended') return;
        
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        // Envelope for fade in/out (to prevent clicks)
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.01); // Quick fade in
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration + 0.05); // Fade out

        oscillator.type = 'sine'; // Sine wave for a clean sound
        oscillator.frequency.setValueAtTime(frequency, startTime); 
        
        oscillator.connect(gainNode).connect(this.audioCtx.destination);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration + 0.1); // Stop slightly after fade out ends
    }

    getIntervalFrequency(rootFrequency, intervalName) {
        const halfSteps = this.intervalMap[intervalName];
        if (halfSteps === undefined) {
            return rootFrequency;
        }
        // Formula for frequency based on half steps (f * 2^(n/12))
        return rootFrequency * Math.pow(2, halfSteps / 12); 
    }

    // --- Test Execution and State Management ---

    selectRandomInterval() {
        const intervals = this.settings.intervalsInUse;
        const randomIndex = Math.floor(Math.random() * intervals.length);
        return intervals[randomIndex];
    }
    
    toggleButtons(state) {
        this.dom.playButton.disabled = state;
        this.dom.replayButton.disabled = state;

        if (state) {
            this.dom.playButton.classList.add('disabled-button');
            this.dom.replayButton.classList.add('disabled-button');
        } else {
            this.dom.playButton.classList.remove('disabled-button');
            // Only enable replay if an interval has been played
            if (this.currentTestIntervalName !== null) {
                this.dom.replayButton.classList.remove('disabled-button');
            }
        }
    }


    playTest(isNewTest) {
        if (!this.isReady || this.isPlaying) return;

        this.isPlaying = true;
        this.toggleButtons(true);
        
        let rootFreq;
        let intervalFreq;

        if (isNewTest) {
            // New test: select interval and generate frequencies
            this.currentTestIntervalName = this.selectRandomInterval();
            rootFreq = this.settings.rootFrequency;
            intervalFreq = this.getIntervalFrequency(rootFreq, this.currentTestIntervalName);
            this.lastPlayedFrequencies = [rootFreq, intervalFreq];
            this.updateFeedback("Listen carefully to the interval!", 'info');

        } else {
            // Replay: use stored frequencies
            if (this.lastPlayedFrequencies.length === 0) {
                this.isPlaying = false;
                this.toggleButtons(false);
                this.updateFeedback("Please play a new test first.", 'info');
                return;
            }
            rootFreq = this.lastPlayedFrequencies[0];
            intervalFreq = this.lastPlayedFrequencies[1];
            this.updateFeedback("Replaying the last interval...", 'info');
        }
        
        const duration = parseFloat(this.settings.noteDuration); 
        const now = this.audioCtx.currentTime;
        let totalPlayTime = 0;

        // Play notes based on mode setting
        if (this.settings.mode === 'melodic') {
            this.playNote(rootFreq, now, duration);
            this.playNote(intervalFreq, now + duration, duration);
            totalPlayTime = duration * 2;
        } else { // harmonic
            this.playNote(rootFreq, now, duration);
            this.playNote(intervalFreq, now, duration);
            totalPlayTime = duration;
        }
        
        // Wait for playback to finish before re-enabling buttons
        setTimeout(() => {
            this.isPlaying = false;
            this.toggleButtons(false); 
        }, totalPlayTime * 1000 + 200);
    }
    
    checkAnswer(guess) {
        if (this.isPlaying) return; 

        const correctInterval = this.currentTestIntervalName;
        if (!correctInterval) {
             this.updateFeedback("Please play an interval first!", 'info');
             return;
        }

        const isAnswerdCorrectly = guess === correctInterval
        
        if (isAnswerdCorrectly) {
            this.updateFeedback(`Correct! You heard a ${correctInterval}. Click 'Play Test Interval' for a new challenge!`, 'correct');
            this.currentTestIntervalName = null;
            
        } else {
            this.updateFeedback(`Oops! You guessed ${guess}, but it was a ${correctInterval}. Try replaying it or start a new test!`, 'incorrect');
        }

        this.updateStreaks(isAnswerdCorrectly)
    }

    updateStreaks(isAnswerdCorrectly) {
        if (isAnswerdCorrectly) {
            this.currentStreak += 1;

            if (this.currentStreak > this.highStrek) {
                this.highStrek = this.currentStreak
                this.dom.highStreak.textContent = "Your current high streak: " + this.highStrek
            }
        } else {
            this.currentStreak = 0
        }
        
        this.dom.currentStreak.textContent = "Your current streak: " + this.currentStreak
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.intervalTesterApp = new IntervalTester();
});