// game.js - Chordessy chord training game engine
window.Chordessy = window.Chordessy || {};

(function(C) {
  'use strict';

  // --- Constants ---
  const INITIAL_LIVES = 5;
  const BASE_TIMER_SECONDS = 10;
  const MIN_TIMER_SECONDS = 4;
  const TIMER_DECREASE_PER_LEVEL = 0.5;
  const CHORDS_PER_LEVEL = 5;
  const BASE_SCORE = 100;
  const TIME_BONUS_MAX = 50;
  const FEEDBACK_DURATION = 1200;
  const WRONG_COOLDOWN = 1200;
  const TIER_NAMES = { 1: 'Triads', 2: 'All Triads', 3: 'Sevenths', 4: 'Extended' };

  // QWERTY key-to-note mapping (A=C4, W=C#4, S=D4, ... across two rows)
  const QWERTY_MAP = {
    'a': 60, 'w': 61, 's': 62, 'e': 63, 'd': 64, 'f': 65,
    't': 66, 'g': 67, 'y': 68, 'h': 69, 'u': 70, 'j': 71,
    'k': 72, 'o': 73, 'l': 74, 'p': 75, ';': 76
  };

  // --- Game state ---
  let state = {
    running: false,
    tier: 1,
    level: 1,
    score: 0,
    lives: INITIAL_LIVES,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    missed: 0,
    currentChord: null,
    targetMidi: [],
    heldNotes: new Set(),
    timerStart: 0,
    timerDuration: BASE_TIMER_SECONDS,
    timerRAF: null,
    wrongCooldown: false,
    feedbackTimeout: null,
    progressionMode: false,
    currentProgression: null,
    progressionIndex: 0
  };

  // --- DOM refs ---
  let dom = {};
  let keyboard = [];
  let audio = null;
  let midi = null;
  let correctSynth = null;
  let incorrectSynth = null;

  // --- Initialization ---
  function init() {
    dom = {
      startScreen: document.getElementById('start-screen'),
      gameOverScreen: document.getElementById('game-over-screen'),
      levelNum: document.getElementById('level-num'),
      tierBadge: document.getElementById('tier-badge'),
      score: document.getElementById('score'),
      comboDisplay: document.getElementById('combo-display'),
      comboCount: document.getElementById('combo-count'),
      livesContainer: document.getElementById('lives-container'),
      chordName: document.getElementById('chord-name'),
      chordNotes: document.getElementById('chord-notes'),
      timerBar: document.getElementById('timer-bar'),
      feedbackOverlay: document.getElementById('feedback-overlay'),
      feedbackText: document.getElementById('feedback-text'),
      feedbackScore: document.getElementById('feedback-score'),
      finalScore: document.getElementById('final-score'),
      statCorrect: document.getElementById('stat-correct'),
      statMissed: document.getElementById('stat-missed'),
      statCombo: document.getElementById('stat-combo'),
      midiStatus: document.getElementById('midi-status'),
      playAgainBtn: document.getElementById('play-again-btn'),
      keyboardContainer: document.getElementById('game-keyboard'),
      progressionInfo: document.getElementById('progression-info'),
      hearAgainBtn: document.getElementById('hear-again-btn')
    };

    // Build piano keyboard
    keyboard = C.buildKeyboard(dom.keyboardContainer);

    // Setup audio
    audio = C.setupAudio();

    // Create feedback synths using Tone.js from the audio engine
    let Tone = audio.Tone;

    // Correct feedback: sine wave, ascending C5-E5-G5 arpeggio
    correctSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.3 }
    }).connect(audio.masterGain);

    // Incorrect feedback: sawtooth wave, low E2
    incorrectSynth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.4 }
    }).connect(audio.masterGain);

    // Setup MIDI
    C.setupMidi()
      .then(m => {
        midi = m;
        let inputs = m.getInputs();
        if (inputs.length > 0) {
          dom.midiStatus.textContent = 'MIDI keyboard connected: ' + inputs[0].name;
        } else {
          dom.midiStatus.textContent = 'No MIDI keyboard found. Use QWERTY or click keys.';
        }
        m.onNoteOn(onMidiNoteOn);
        m.onNoteOff(onMidiNoteOff);
        m.onSustain(onMidiSustain);
      })
      .catch(() => {
        dom.midiStatus.textContent = 'MIDI not supported. Use QWERTY or click keys.';
      });

    // Start screen buttons
    document.querySelectorAll('.start-btn[data-tier]').forEach(btn => {
      btn.addEventListener('click', () => {
        let tier = parseInt(btn.dataset.tier, 10);
        startGame(tier);
      });
    });

    // Play again button
    dom.playAgainBtn.addEventListener('click', () => {
      dom.gameOverScreen.style.display = 'none';
      dom.startScreen.style.display = '';
    });

    // Hear chord again button
    dom.hearAgainBtn.addEventListener('click', () => {
      if (state.running && state.targetMidi.length > 0) {
        audio.playChord(state.targetMidi, '2n');
      }
    });

    // QWERTY keyboard input
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Mouse/touch input on piano keys
    setupMouseInput();
  }

  // --- Game loop ---
  function startGame(tier) {
    // Clear any pending feedback/timer from previous game
    if (state.feedbackTimeout) {
      clearTimeout(state.feedbackTimeout);
      state.feedbackTimeout = null;
    }
    cancelTimer();

    state.running = true;
    state.tier = tier;
    state.level = 1;
    state.score = 0;
    state.lives = INITIAL_LIVES;
    state.combo = 0;
    state.bestCombo = 0;
    state.correct = 0;
    state.missed = 0;
    state.heldNotes.clear();
    state.wrongCooldown = false;
    state.awaitingNext = false;

    // Read progression mode toggle
    let progressionCheckbox = document.getElementById('progression-mode');
    state.progressionMode = progressionCheckbox && progressionCheckbox.checked;
    state.currentProgression = null;
    state.progressionIndex = 0;

    dom.startScreen.style.display = 'none';
    dom.gameOverScreen.style.display = 'none';

    updateHUD();
    renderLives();
    nextChord();
  }

  function nextChord() {
    if (!state.running) return;

    // Clear previous state
    state.awaitingNext = false;
    state.heldNotes.clear();
    state.wrongCooldown = false;
    clearKeyboardHighlights();

    // Pick the next chord: progression sequence or random
    let chord;
    if (state.progressionMode) {
      // Start a new progression if we don't have one or finished the current one
      if (!state.currentProgression || state.progressionIndex >= state.currentProgression.chords.length) {
        state.currentProgression = C.getRandomProgression(state.tier);
        state.progressionIndex = 0;
      }
      let symbol = state.currentProgression.chords[state.progressionIndex];
      chord = C.CHORDS[symbol] || { symbol: symbol, name: symbol, tier: state.tier, notes: 0 };
      state.progressionIndex++;
    } else {
      chord = C.getRandomChord(state.tier);
    }
    state.currentChord = chord;
    state.targetMidi = C.chordToMidiNotes(chord.symbol);

    if (state.targetMidi.length === 0) {
      // Fallback: skip chord if Tonal can't resolve it (limit retries to prevent infinite loop)
      state._skipCount = (state._skipCount || 0) + 1;
      if (state._skipCount < 20) {
        nextChord();
      } else {
        state._skipCount = 0;
        gameOver();
      }
      return;
    }
    state._skipCount = 0;

    // Calculate timer duration based on level
    state.timerDuration = Math.max(
      MIN_TIMER_SECONDS,
      BASE_TIMER_SECONDS - (state.level - 1) * TIMER_DECREASE_PER_LEVEL
    );

    // Update display
    dom.chordName.textContent = chord.name;
    let noteNames = state.targetMidi.map(n => C.NOTE_NAMES[n % 12]);
    dom.chordNotes.textContent = noteNames.join(' - ');

    // Show progression info if in progression mode
    if (dom.progressionInfo) {
      if (state.progressionMode && state.currentProgression) {
        dom.progressionInfo.textContent = state.currentProgression.name +
          ' (' + state.progressionIndex + '/' + state.currentProgression.chords.length + ')';
        dom.progressionInfo.style.display = '';
      } else {
        dom.progressionInfo.style.display = 'none';
      }
    }

    // Show hear-again button
    dom.hearAgainBtn.style.display = '';

    // Highlight target keys on keyboard
    highlightTargetKeys();

    // Play target chord audio preview
    audio.playChord(state.targetMidi, '2n');

    // Start timer
    startTimer();
  }

  function levelUp() {
    state.level++;
    updateHUD();
  }

  function gameOver() {
    state.running = false;
    state.awaitingNext = false;
    cancelTimer();
    clearKeyboardHighlights();
    dom.hearAgainBtn.style.display = 'none';
    if (dom.progressionInfo) dom.progressionInfo.style.display = 'none';

    dom.finalScore.textContent = state.score;
    dom.statCorrect.textContent = state.correct;
    dom.statMissed.textContent = state.missed;
    dom.statCombo.textContent = state.bestCombo;

    dom.gameOverScreen.style.display = '';
  }

  // --- Timer system ---
  function startTimer() {
    cancelTimer();
    state.timerStart = performance.now();
    dom.timerBar.style.width = '100%';
    dom.timerBar.classList.remove('warning', 'critical');
    tickTimer();
  }

  function tickTimer() {
    if (!state.running) return;

    let elapsed = (performance.now() - state.timerStart) / 1000;
    let remaining = state.timerDuration - elapsed;
    let pct = Math.max(0, (remaining / state.timerDuration) * 100);

    dom.timerBar.style.width = pct + '%';

    // Timer color states
    let ratio = remaining / state.timerDuration;
    if (ratio <= 0.2) {
      dom.timerBar.classList.add('critical');
      dom.timerBar.classList.remove('warning');
    } else if (ratio <= 0.4) {
      dom.timerBar.classList.add('warning');
      dom.timerBar.classList.remove('critical');
    } else {
      dom.timerBar.classList.remove('warning', 'critical');
    }

    if (remaining <= 0) {
      onTimeout();
      return;
    }

    state.timerRAF = requestAnimationFrame(tickTimer);
  }

  function cancelTimer() {
    if (state.timerRAF) {
      cancelAnimationFrame(state.timerRAF);
      state.timerRAF = null;
    }
  }

  function getTimeRemaining() {
    let elapsed = (performance.now() - state.timerStart) / 1000;
    return Math.max(0, state.timerDuration - elapsed);
  }

  // --- Input handling ---

  // MIDI
  function onMidiNoteOn(note, velocity) {
    if (!state.running) return;
    noteOn(note);
  }

  function onMidiNoteOff(note) {
    if (!state.running) return;
    noteOff(note);
  }

  function onMidiSustain(isDown) {
    if (!state.running) return;
    // When sustain pedal is released, clear all held notes to prevent stuck notes
    if (!isDown) {
      [...state.heldNotes].forEach(n => noteOff(n));
    }
  }

  // QWERTY
  function onKeyDown(e) {
    if (!state.running) return;
    if (e.repeat) return;
    let note = QWERTY_MAP[e.key.toLowerCase()];
    if (note !== undefined) {
      e.preventDefault();
      noteOn(note);
    }
  }

  function onKeyUp(e) {
    if (!state.running) return;
    let note = QWERTY_MAP[e.key.toLowerCase()];
    if (note !== undefined) {
      noteOff(note);
    }
  }

  // Mouse/touch
  function setupMouseInput() {
    let mouseDown = false;

    keyboard.forEach((keyEl, index) => {
      let note = C.MIN_NOTE + index;

      keyEl.addEventListener('mousedown', e => {
        e.preventDefault();
        mouseDown = true;
        if (state.running) noteOn(note);
      });

      keyEl.addEventListener('mouseover', () => {
        if (mouseDown && state.running) noteOn(note);
      });

      keyEl.addEventListener('mouseup', () => {
        if (state.running) noteOff(note);
      });

      keyEl.addEventListener('mouseleave', () => {
        if (mouseDown && state.running) noteOff(note);
      });
    });

    document.addEventListener('mouseup', () => {
      mouseDown = false;
      if (state.running) {
        [...state.heldNotes].forEach(n => noteOff(n));
      }
    });

    // Touch support
    dom.keyboardContainer.addEventListener('touchstart', handleTouch, { passive: false });
    dom.keyboardContainer.addEventListener('touchmove', handleTouch, { passive: false });
    dom.keyboardContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
  }

  function handleTouch(e) {
    if (!state.running) return;
    e.preventDefault();
    let touchedNotes = new Set();
    for (let touch of Array.from(e.touches)) {
      let el = document.elementFromPoint(touch.clientX, touch.clientY);
      let idx = keyboard.indexOf(el);
      if (idx >= 0) {
        touchedNotes.add(C.MIN_NOTE + idx);
      }
    }
    // Note on for new touches
    touchedNotes.forEach(n => {
      if (!state.heldNotes.has(n)) noteOn(n);
    });
    // Note off for released touches
    [...state.heldNotes].forEach(n => {
      if (!touchedNotes.has(n)) noteOff(n);
    });
  }

  function handleTouchEnd(e) {
    if (!state.running) return;
    e.preventDefault();
    if (e.touches.length === 0) {
      [...state.heldNotes].forEach(n => noteOff(n));
    } else {
      handleTouch(e);
    }
  }

  // --- Core note on/off ---
  function noteOn(note) {
    state.heldNotes.add(note);

    // Visual feedback on keyboard
    let idx = note - C.MIN_NOTE;
    if (idx >= 0 && idx < keyboard.length) {
      keyboard[idx].classList.add('pressed');
    }

    // Play audio
    audio.playNote(note, 0.7);

    // Check chord match
    checkChord();
  }

  function noteOff(note) {
    state.heldNotes.delete(note);

    // Remove visual feedback
    let idx = note - C.MIN_NOTE;
    if (idx >= 0 && idx < keyboard.length) {
      keyboard[idx].classList.remove('pressed');
    }
  }

  // --- Chord checking ---
  function checkChord() {
    if (!state.running || !state.targetMidi.length || state.awaitingNext) return;

    let heldArray = Array.from(state.heldNotes);
    if (heldArray.length < state.targetMidi.length) return;

    // Check if held notes match target using pitch class comparison
    if (C.pitchClassesMatch(heldArray, state.targetMidi)) {
      onCorrect();
    } else if (heldArray.length >= state.targetMidi.length) {
      onIncorrect();
    }
  }

  // --- Correct/incorrect/timeout handlers ---
  function onCorrect() {
    cancelTimer();
    state.awaitingNext = true;
    state.correct++;
    state.combo++;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;

    // Calculate score: base + time bonus * combo multiplier
    let timeRemaining = getTimeRemaining();
    let timeBonus = Math.round((timeRemaining / state.timerDuration) * TIME_BONUS_MAX);
    let comboMultiplier = Math.min(state.combo, 10);
    let points = (BASE_SCORE + timeBonus) * comboMultiplier;
    state.score += points;

    // Mark correct keys
    state.targetMidi.forEach(n => {
      let idx = n - C.MIN_NOTE;
      if (idx >= 0 && idx < keyboard.length) {
        keyboard[idx].classList.add('correct');
      }
    });

    // Play ascending C5-E5-G5 arpeggio
    let now = audio.Tone.now();
    correctSynth.triggerAttackRelease('C5', '16n', now);
    correctSynth.triggerAttackRelease('E5', '16n', now + 0.08);
    correctSynth.triggerAttackRelease('G5', '16n', now + 0.16);

    // Show feedback
    showFeedback('correct', 'Correct!', '+' + points);
    showScorePopup(points);

    // Check level up
    if (state.correct % CHORDS_PER_LEVEL === 0) {
      levelUp();
    }

    updateHUD();

    // Next chord after feedback
    state.feedbackTimeout = setTimeout(() => {
      if (state.running) nextChord();
    }, FEEDBACK_DURATION);
  }

  function onIncorrect() {
    if (state.wrongCooldown) return;
    state.wrongCooldown = true;

    state.combo = 0;
    state.lives--;
    state.missed++;

    // Mark wrong keys
    let heldArray = Array.from(state.heldNotes);
    heldArray.forEach(n => {
      let idx = n - C.MIN_NOTE;
      if (idx >= 0 && idx < keyboard.length) {
        keyboard[idx].classList.add('wrong');
      }
    });

    // Play low E2 buzz
    incorrectSynth.triggerAttackRelease('E2', '8n');

    showFeedback('incorrect', 'Wrong!', '');

    updateHUD();
    renderLives();

    if (state.lives <= 0) {
      cancelTimer();
      state.feedbackTimeout = setTimeout(() => {
        gameOver();
      }, FEEDBACK_DURATION);
      return;
    }

    // Reset cooldown after delay
    setTimeout(() => {
      state.wrongCooldown = false;
      clearWrongHighlights();
    }, WRONG_COOLDOWN);
  }

  function onTimeout() {
    state.awaitingNext = true;
    state.combo = 0;
    state.lives--;
    state.missed++;

    // Play low E2 buzz
    incorrectSynth.triggerAttackRelease('E2', '8n');

    showFeedback('incorrect', 'Time\'s up!', '');

    updateHUD();
    renderLives();

    if (state.lives <= 0) {
      state.feedbackTimeout = setTimeout(() => {
        gameOver();
      }, FEEDBACK_DURATION);
      return;
    }

    state.feedbackTimeout = setTimeout(() => {
      if (state.running) nextChord();
    }, FEEDBACK_DURATION);
  }

  // --- UI updates ---
  function updateHUD() {
    dom.levelNum.textContent = state.level;
    dom.tierBadge.textContent = TIER_NAMES[state.tier] || 'Tier ' + state.tier;
    dom.score.textContent = state.score;

    if (state.combo > 1) {
      dom.comboDisplay.style.display = '';
      dom.comboCount.textContent = state.combo;
      dom.comboDisplay.style.animation = 'none';
      // Force reflow to restart animation
      void dom.comboDisplay.offsetWidth;
      dom.comboDisplay.style.animation = '';
    } else {
      dom.comboDisplay.style.display = 'none';
    }
  }

  function renderLives() {
    dom.livesContainer.innerHTML = '';
    for (let i = 0; i < INITIAL_LIVES; i++) {
      let life = document.createElement('span');
      life.classList.add('life');
      if (i >= state.lives) life.classList.add('lost');
      life.textContent = '\u2665'; // heart character
      dom.livesContainer.appendChild(life);
    }
  }

  function showFeedback(type, text, scoreText) {
    // Clear previous feedback
    if (state.feedbackTimeout) {
      clearTimeout(state.feedbackTimeout);
    }

    dom.feedbackText.textContent = text;
    dom.feedbackText.className = 'feedback-text ' + type;
    dom.feedbackScore.textContent = scoreText;
    dom.feedbackOverlay.classList.add('show');

    setTimeout(() => {
      dom.feedbackOverlay.classList.remove('show');
    }, FEEDBACK_DURATION - 200);
  }

  function showScorePopup(points) {
    let popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = '+' + points;
    document.querySelector('.game-container').appendChild(popup);
    setTimeout(() => popup.remove(), 800);
  }

  // --- Keyboard highlights ---
  function highlightTargetKeys() {
    state.targetMidi.forEach(midiNote => {
      // Highlight all octave instances of each pitch class within keyboard range
      let pc = midiNote % 12;
      for (let n = C.MIN_NOTE; n <= C.MAX_NOTE; n++) {
        if (n % 12 === pc) {
          let idx = n - C.MIN_NOTE;
          if (idx >= 0 && idx < keyboard.length) {
            keyboard[idx].classList.add('target');
          }
        }
      }
    });
  }

  function clearKeyboardHighlights() {
    keyboard.forEach(key => {
      key.classList.remove('target', 'correct', 'wrong', 'pressed');
    });
  }

  function clearWrongHighlights() {
    keyboard.forEach(key => {
      key.classList.remove('wrong');
    });
  }

  // --- Expose for later tasks (progression mode, audio feedback, etc.) ---
  C.game = {
    state,
    startGame,
    nextChord,
    getTimeRemaining
  };

  // --- Boot ---
  document.addEventListener('DOMContentLoaded', init);

})(window.Chordessy);
