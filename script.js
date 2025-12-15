class IntervalTester {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();

        this.isReady = false; 
        this.isPlaying = false;
        this.currentTestIntervalName = null;
        this.currentStreak = 0;
        this.highStrek = 0

        this.settings = { 
            rootFrequency: 261.63,
            Intervals: [
                'Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 
                'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 
                'Minor 7th', 'Major 7th', 'Octave'
            ],
            intervalsInUse: [],
            noteDuration: 0.75, // in seconds
            mode: 'melodic', // 'melodic' or 'harmonic'

            playIncorrectGuess: true, //when you get it wrong, play what you though the correct interval was (to show you how far off you were)
            autoProceedOnCorrectGuess: true
        };
        this.settings.intervalsInUse = this.settings.Intervals;

        this.intervalMap = this.buildIntervalMap(); 
        this.dom = this.fetchDom()
        
        this.renderIntervalGuessAndDisableButtons();
        this.attachEventListeners();
    }

    buildIntervalMap() {
        return {
            'Unison': 0,
            'Minor 2nd': 1,
            'Major 2nd': 2,
            'Minor 3rd': 3,
            'Major 3rd': 4,
            'Perfect 4th': 5,
            'Tritone': 6,
            'Perfect 5th': 7,
            'Minor 6th': 8,
            'Major 6th': 9,
            'Minor 7th': 10,
            'Major 7th': 11,
            'Octave': 12
        };
    }

    fetchDom() {
        return {
            status: document.getElementById('status-message'),
            playButton: document.getElementById('play-button'),
            replayButton: document.getElementById('replay-button'),
            guessGrid: document.getElementById('interval-guess-grid'),
            feedback: document.getElementById('feedback-area'),
            disableIntervalsGrid: document.getElementById("interval-disable-grid"),

            modeSelect: document.getElementById('mode-select'),
            rootNoteSelect: document.getElementById('root-note-select'),
            durationInput: document.getElementById('duration-input'),

            PlayGuessedInterval: document.getElementById("play-incorrect-guess"),
            autoProceedOnCorrectGuess: document.getElementById("auto-proceed-on-correct-guess"),

            statsPanel: document.getElementById('stats-panel'),
            currentStreak: document.getElementById('current-streak-p'),
            highStreak: document.getElementById('high-streak-p'),
        };
    }

    renderIntervalGuessAndDisableButtons() {
        this.dom.guessGrid.innerHTML = ''; 
        this.settings.Intervals.forEach(displayIntervalName => {
            const guessButton = document.createElement('button');
            guessButton.dataset.interval = displayIntervalName;
            guessButton.textContent = displayIntervalName;
            guessButton.className = 'interval-button bg-gray-700 hover:bg-indigo-600 text-white font-semibold w-full h-12 rounded-lg shadow-md flex items-center justify-center text-xs sm:text-sm';
            this.dom.guessGrid.appendChild(guessButton);


            const disableButton = document.createElement('button');
            disableButton.dataset.interval = displayIntervalName;
            disableButton.dataset.enabled = "true";
            disableButton.textContent = displayIntervalName;
            disableButton.className = 'interval-button select-interval-button px-4 py-3 bg-indigo-800 text-gray-300 font-bold rounded-xl shadow-lg flex-1';
            this.dom.disableIntervalsGrid.appendChild(disableButton);
        });
    }

    attachEventListeners() {
        document.addEventListener('click', () => this.unlockAudioContext(), { once: true });

        this.dom.playButton.addEventListener('click', () => this.playTest(true));
        this.dom.replayButton.addEventListener('click', () => this.playTest(false));
        
        this.dom.modeSelect.addEventListener('change', (e) => this.settings.mode = e.target.value);
        this.dom.rootNoteSelect.addEventListener('change', (e) => this.settings.rootFrequency = parseFloat(e.target.value));
        this.dom.durationInput.addEventListener("change", (e) => {
            const targetValue = parseFloat(e.target.value);
            let finalDuration

            if (targetValue < 0.1) {
                finalDuration = 0.1
            } else if (targetValue > 2.0) {
                finalDuration = 2.0
            } else {
                finalDuration = targetValue
            }
        
            this.settings.noteDuration = finalDuration
            e.target.value = finalDuration.toFixed(2)
        });

        this.dom.PlayGuessedInterval.addEventListener("change", (e) => {
            const targetValue = e.target.value
            let change

            if (targetValue === "true") {
                change = true
            } else {
                change = false
            }

            this.settings.playIncorrectGuess = change
        });

        this.dom.autoProceedOnCorrectGuess.addEventListener("change", (e) => {
            const targetValue = e.target.value
            let change

            if (targetValue === "true") {
                change = true
            } else {
                change = false
            }

            this.settings.autoProceedOnCorrectGuess = change
        });
        
        this.dom.guessGrid.addEventListener('click', (e) => {
            const button = e.target.closest('.interval-button');
            // Only allow guessing if a test is currently active and not playing
            if (button && this.currentTestIntervalName && !this.isPlaying) {
                this.checkAnswer(button.dataset.interval);
            }
        });

        this.dom.disableIntervalsGrid.addEventListener('click', (e) => {
            const button = e.target.closest('.interval-button');
            if (!button) {return}

            let intervalsInUse = this.settings.intervalsInUse

            const interval = button.dataset.interval
            const isIntervalEnabledBeforeClick = (button.dataset.enabled === "true")

            const correspondingGuessButton = document.querySelector(`#interval-guess-grid button[data-interval="${interval}"]`);

            if (isIntervalEnabledBeforeClick) {
                button.classList = "interval-button select-interval-button px-4 py-3 bg-gray-800 text-gray-300 font-bold rounded-xl shadow-lg flex-1"
                button.dataset.enabled = false

                const indexToRemove = intervalsInUse.findIndex(
                    (item) => item === interval
                );

                if (indexToRemove !== -1) {
                    intervalsInUse.splice(indexToRemove, 1);
                }

                correspondingGuessButton.classList.add("hidden")
            } else {
                button.classList = "interval-button select-interval-button px-4 py-3 bg-indigo-800 text-gray-300 font-bold rounded-xl shadow-lg flex-1"
                button.dataset.enabled = true

                intervalsInUse.push(interval);
                correspondingGuessButton.classList.remove("hidden")
            }

            if (this.settings.intervalsInUse.length === 0) {
                this.toggleButtons(true)
                this.updateFeedback("Please select at least 1 interval to begin the test!", "incorrect")
            } else if (!this.isPlaying && intervalsInUse.length > 0) {
                this.toggleButtons(false)
                this.updateFeedback("Ready to test!", 'info');
            }
        });
    }
    
    unlockAudioContext() {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().then(() => {
                this.dom.status.className = 'text-center p-3 mb-6 rounded-lg bg-green-900/50 text-green-300 font-medium';
                this.dom.status.innerText = 'Audio Context Active. Ready to Play!';
            });
        }

        this.isReady = true;
        this.dom.playButton.disabled = false;
        this.dom.playButton.classList.remove('disabled-button');
    }

    playTest(isNewTest) {
        if (!this.isReady || this.isPlaying) return;

        this.isPlaying = true;
        this.toggleButtons(true);
        
        const rootFreq = this.settings.rootFrequency;
        let intervalFreq;

        if (isNewTest) {
            const newInterval = this.selectRandomInterval()
            this.currentTestIntervalName = newInterval
            intervalFreq = this.getIntervalFrequency(rootFreq, newInterval);
            // this.updateFeedback("Listen carefully to the interval!", 'info');

        } else {
            intervalFreq = this.getIntervalFrequency(rootFreq, this.currentTestIntervalName)
            this.updateFeedback("Replaying the last interval...", 'info');
        }
        
        const totalPlayTime = this.playIntervalsTogether(intervalFreq)
        
        setTimeout(() => {
            this.isPlaying = false;
            this.toggleButtons(false); 
        }, totalPlayTime * 1000 + 200);
    }

    toggleButtons(state) {
        this.dom.playButton.disabled = state;
        this.dom.replayButton.disabled = state;

        if (state) {
            this.dom.playButton.classList.add('disabled-button');
            this.dom.replayButton.classList.add('disabled-button');
        } else {
            this.dom.playButton.classList.remove('disabled-button');
            if (this.currentTestIntervalName !== null) {
                this.dom.replayButton.classList.remove('disabled-button');
            }
        }
    }

    selectRandomInterval() {
        const intervals = this.settings.intervalsInUse;
        const randomIndex = Math.floor(Math.random() * intervals.length);
        return intervals[randomIndex];
    }

    getIntervalFrequency(rootFrequency, intervalName) {
        const halfSteps = this.intervalMap[intervalName];
        if (halfSteps === undefined) {
            return rootFrequency;
        }
        // Formula for frequency based on half steps (f * 2^(n/12))
        return rootFrequency * Math.pow(2, halfSteps / 12); 
    }

    updateFeedback(message, type) {
        this.dom.feedback.classList.remove('hidden', 'bg-red-900/50', 'bg-green-900/50', 'bg-blue-900/50', 'text-green-300', 'text-red-300', 'text-blue-300');
        this.dom.feedback.textContent = message;

        if (type === 'correct') {
            this.dom.feedback.classList.add('bg-green-900/50', 'text-green-300');
        } else if (type === 'incorrect') {
            this.dom.feedback.classList.add('bg-red-900/50', 'text-red-300');
        } else if (type === "info") {
            this.dom.feedback.classList.add('bg-blue-900/50', 'text-blue-300');
        }
    }

    playIntervalsTogether(intervalFreq) {
        const duration = parseFloat(this.settings.noteDuration); 
        const now = this.audioCtx.currentTime;
        let totalPlayTime = 0;

        // Play notes based on mode setting
        if (this.settings.mode === 'melodic') {
            this.playNote(this.settings.rootFrequency, now, duration);
            this.playNote(intervalFreq, now + duration, duration);
            totalPlayTime = duration * 2;
        } else { // harmonic
            this.playNote(this.settings.rootFrequency, now, duration);
            this.playNote(intervalFreq, now, duration);
            totalPlayTime = duration;
        }

        return totalPlayTime
    }

    playNote(frequency, startTime, duration) {
        if (this.audioCtx.state === 'suspended') return;
        
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        // Envelope for fade in/out (to prevent clicks)
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.01); // Quick fade in
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration + 0.05); // Fade out

        oscillator.type = "sine"; // Sine wave for a clean sound
        //"sine", "square", "sawtooth", "triangle" and "custom"
        oscillator.frequency.setValueAtTime(frequency, startTime); 
        
        oscillator.connect(gainNode).connect(this.audioCtx.destination);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration + 0.1); // Stop slightly after fade out ends
    }

    checkAnswer(guess) {
        if (this.isPlaying) return; 

        const correctInterval = this.currentTestIntervalName;
        if (!correctInterval) {
            this.updateFeedback("Please play an interval first!", 'info');
            return;
        }

        const isAnswerdCorrectly = (guess === correctInterval)
        if (isAnswerdCorrectly) {
            this.currentTestIntervalName = null;
            
            if (this.settings.autoProceedOnCorrectGuess) {
                this.updateFeedback(`Correct! You heard a ${correctInterval}.`, 'correct');
                this.playTest(true)
            } else {
                this.updateFeedback(`Correct! You heard a ${correctInterval}. Click 'Play Test Interval' for a new challenge!`, 'correct');
            }

        } else {
            this.updateFeedback(`Oops! You guessed ${guess}, but it was a ${correctInterval}. Try replaying it or start a new test!`, 'incorrect');
            if (this.settings.playIncorrectGuess) {
                this.playIntervalsTogether(this.getIntervalFrequency(this.settings.rootFrequency, guess))
            }
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

document.addEventListener('DOMContentLoaded', () => {
    window.intervalTesterApp = new IntervalTester();
});