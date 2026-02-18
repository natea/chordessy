# Chord Training Game - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a chord training game mode alongside the existing neural-arpeggiator where chords appear on screen, the pianist plays them on a MIDI keyboard, and earns points/loses lives based on accuracy.

**Architecture:** New vanilla JS game module added alongside the existing `neural-arpeggiator/src/script.js`. Reuses the existing Tone.js audio engine, WebMidi.js MIDI input, Tonal.js chord detection, and `buildKeyboard()` renderer. The game mode runs as a separate HTML page (`game.html`) sharing CSS and audio infrastructure, with its own game loop, scoring, and level system.

**Tech Stack:** Vanilla JS (matching existing codebase), Tone.js (audio/synthesis), WebMidi.js (MIDI input), Tonal.js (chord theory), HTML/CSS (keyboard UI), AudioKeys (QWERTY fallback)

---

## Existing Code Reference

The neural-arpeggiator (`neural-arpeggiator/src/script.js`) already provides:

- **Keyboard renderer**: `buildKeyboard(container)` (line 96-121) - builds HTML div-based piano from MIDI 48-84
- **MIDI input**: WebMidi.js setup with note-on/note-off handlers (line 292-563)
- **Chord detection**: `detectChord(notes)` using Tonal.js (line 124-133)
- **Audio engine**: Tone.js sampler with reverb + echo + low-pass filter (line 17-40)
- **Key animation**: `animatePlay(keyEl, note, isHuman)` (line 267-274)
- **QWERTY fallback**: AudioKeys for computer keyboard input (line 43, 284-288)
- **Constants**: `MIN_NOTE=48`, `MAX_NOTE=84`, `DEFAULT_BPM=120`

## File Structure (Final)

```
neural-arpeggiator/
  src/
    index.html          (existing - arpeggiator mode)
    script.js           (existing - arpeggiator logic)
    style.css           (existing - shared keyboard styles)
    game.html           (NEW - game mode entry point)
    game.js             (NEW - game loop, scoring, levels)
    game.css            (NEW - game-specific styles)
    shared.js           (NEW - extracted shared code: keyboard, midi, audio, chord detection)
    chords-db.js        (NEW - chord database with difficulty tiers)
```

---

## Task 1: Extract Shared Code into `shared.js`

**Files:**
- Create: `neural-arpeggiator/src/shared.js`
- Modify: `neural-arpeggiator/src/script.js`

Pull reusable functions out of `script.js` into a shared module that both the arpeggiator and game can use. Since this is a vanilla JS project loaded via `<script>` tags (no bundler), expose shared code on a global `Chordessy` namespace.

**Step 1: Create `shared.js` with extracted utilities**

```javascript
// shared.js - Shared utilities for Chordessy apps
window.Chordessy = window.Chordessy || {};

(function(C) {
  const MIN_NOTE = 48;
  const MAX_NOTE = 84;
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function isAccidental(note) {
    let pc = note % 12;
    return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
  }

  function buildKeyboard(container) {
    let nAccidentals = _.range(MIN_NOTE, MAX_NOTE + 1).filter(isAccidental).length;
    let keyWidthPercent = 100 / (MAX_NOTE - MIN_NOTE - nAccidentals + 1);
    let keyInnerWidthPercent = keyWidthPercent - 0.5;
    let gapPercent = keyWidthPercent - keyInnerWidthPercent;
    let accumulatedWidth = 0;
    return _.range(MIN_NOTE, MAX_NOTE + 1).map(note => {
      let accidental = isAccidental(note);
      let key = document.createElement('div');
      key.classList.add('key');
      key.dataset.note = note;
      if (accidental) {
        key.classList.add('accidental');
        key.style.left = `${accumulatedWidth - gapPercent - (keyWidthPercent / 2 - gapPercent) / 2}%`;
        key.style.width = `${keyWidthPercent / 2}%`;
      } else {
        key.style.left = `${accumulatedWidth}%`;
        key.style.width = `${keyInnerWidthPercent}%`;
      }
      container.appendChild(key);
      if (!accidental) accumulatedWidth += keyWidthPercent;
      return key;
    });
  }

  function midiToNoteName(midi) {
    return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  }

  function midiToPitchClass(midi) {
    return midi % 12;
  }

  function detectChord(notes) {
    let noteNames = notes.map(n => Tonal.Note.pc(Tonal.Note.fromMidi(n))).sort();
    return Tonal.PcSet.modes(noteNames)
      .map((mode, i) => {
        const tonic = Tonal.Note.name(noteNames[i]);
        const names = Tonal.Dictionary.chord.names(mode);
        return names.length ? tonic + names[0] : null;
      })
      .filter(x => x);
  }

  // Compare two sets of pitch classes (0-11) regardless of octave
  function pitchClassesMatch(midiNotesA, midiNotesB) {
    let setA = [...new Set(midiNotesA.map(n => n % 12))].sort((a, b) => a - b);
    let setB = [...new Set(midiNotesB.map(n => n % 12))].sort((a, b) => a - b);
    if (setA.length !== setB.length) return false;
    return setA.every((v, i) => v === setB[i]);
  }

  // Resolve a chord symbol (e.g. "Cmaj7") to an array of MIDI note numbers in octave 4
  function chordToMidiNotes(chordSymbol) {
    let chord = Tonal.Chord.get(chordSymbol);
    if (!chord.notes || chord.notes.length === 0) return [];
    // Place in octave 4, keep all notes within one octave span
    let rootMidi = Tonal.Note.midi(chord.notes[0] + '4');
    return chord.notes.map(n => {
      let midi = Tonal.Note.midi(n + '4');
      // Wrap notes below root up an octave
      if (midi < rootMidi) midi += 12;
      return midi;
    });
  }

  function animatePlay(keyEl, note, color) {
    let targetColor = isAccidental(note) ? 'black' : 'white';
    keyEl.animate(
      [{ backgroundColor: color }, { backgroundColor: targetColor }],
      { duration: 700, easing: 'ease-out' }
    );
  }

  // Setup WebMidi and return a promise with {onNoteOn, onNoteOff} callback setters
  function setupMidi() {
    let noteOnCallbacks = [];
    let noteOffCallbacks = [];

    return new Promise((resolve, reject) => {
      WebMidi.enable(err => {
        if (err) {
          reject(err);
          return;
        }
        function bindInput(input) {
          input.addListener('noteon', 1, e => {
            noteOnCallbacks.forEach(cb => cb(e.note.number, e.velocity));
          });
          input.addListener('noteoff', 1, e => {
            noteOffCallbacks.forEach(cb => cb(e.note.number));
          });
        }
        WebMidi.inputs.forEach(bindInput);
        WebMidi.addListener('connected', () => {
          WebMidi.inputs.forEach(bindInput);
        });

        resolve({
          onNoteOn(cb) { noteOnCallbacks.push(cb); },
          onNoteOff(cb) { noteOffCallbacks.push(cb); },
          getInputs() { return WebMidi.inputs; }
        });
      });
    });
  }

  // Setup audio engine (Tone.js sampler with effects)
  function setupAudio() {
    let Tone = mm.Player.tone;
    let masterGain = new Tone.Gain(0.6).toMaster();
    let reverb = new Tone.Convolver(
      'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/hm2_000_ortf_48k.mp3'
    ).connect(masterGain);
    reverb.wet.value = 0.1;
    let echo = new Tone.FeedbackDelay('8n.', 0.4).connect(
      new Tone.Gain(0.5).connect(reverb)
    );
    let lowPass = new Tone.Filter(5000).connect(echo).connect(reverb);
    let sampler = new Tone.Sampler({
      C3: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-c3.wav',
      'D#3': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-ds3.wav',
      'F#3': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-fs3.wav',
      A3: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-a3.wav',
      C4: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-c4.wav',
      'D#4': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-ds4.wav',
      'F#4': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-fs4.wav',
      A4: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-a4.wav',
      C5: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-c5.wav',
      'D#5': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-ds5.wav',
      'F#5': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-fs5.wav',
      A5: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-a5.wav'
    }).connect(lowPass);
    sampler.release.value = 2;

    return {
      Tone,
      sampler,
      masterGain,
      playNote(note, velocity, time) {
        let freq = Tone.Frequency(note, 'midi');
        sampler.triggerAttack(freq, time || Tone.now(), velocity || 0.7);
      },
      playChord(midiNotes, duration) {
        let now = Tone.now();
        midiNotes.forEach(note => {
          let freq = Tone.Frequency(note, 'midi');
          sampler.triggerAttackRelease(freq, duration || '2n', now);
        });
      }
    };
  }

  // Expose on namespace
  C.MIN_NOTE = MIN_NOTE;
  C.MAX_NOTE = MAX_NOTE;
  C.NOTE_NAMES = NOTE_NAMES;
  C.isAccidental = isAccidental;
  C.buildKeyboard = buildKeyboard;
  C.midiToNoteName = midiToNoteName;
  C.midiToPitchClass = midiToPitchClass;
  C.detectChord = detectChord;
  C.pitchClassesMatch = pitchClassesMatch;
  C.chordToMidiNotes = chordToMidiNotes;
  C.animatePlay = animatePlay;
  C.setupMidi = setupMidi;
  C.setupAudio = setupAudio;

})(window.Chordessy);
```

**Step 2: Verify the existing arpeggiator still works**

Open `neural-arpeggiator/src/index.html` in browser, confirm keyboard renders and MIDI input works. (The arpeggiator will be updated to use `shared.js` in a later optional refactor -- for now we just need shared.js to exist for the game.)

**Step 3: Commit**

```bash
git add neural-arpeggiator/src/shared.js
git commit -m "feat: extract shared utilities for keyboard, MIDI, audio, chord detection"
```

---

## Task 2: Create the Chord Database (`chords-db.js`)

**Files:**
- Create: `neural-arpeggiator/src/chords-db.js`

This file defines all chords organized by difficulty tier, plus common progressions for level sequences. Each chord entry has a display name, a Tonal.js-compatible symbol, and a difficulty tier.

**Step 1: Create chord database**

```javascript
// chords-db.js - Chord definitions organized by difficulty
window.Chordessy = window.Chordessy || {};

(function(C) {

  // Difficulty tiers: 1=beginner (3-note), 2=intermediate (3-note all types),
  // 3=advanced (4-note), 4=expert (5+ note)
  const CHORDS = {
    // --- TIER 1: Major triads in easy keys ---
    'C':    { symbol: 'C',    name: 'C major',     tier: 1, notes: 3 },
    'F':    { symbol: 'F',    name: 'F major',     tier: 1, notes: 3 },
    'G':    { symbol: 'G',    name: 'G major',     tier: 1, notes: 3 },
    'Am':   { symbol: 'Am',   name: 'A minor',     tier: 1, notes: 3 },
    'Dm':   { symbol: 'Dm',   name: 'D minor',     tier: 1, notes: 3 },
    'Em':   { symbol: 'Em',   name: 'E minor',     tier: 1, notes: 3 },

    // --- TIER 2: All major/minor triads + dim/aug ---
    'D':    { symbol: 'D',    name: 'D major',     tier: 2, notes: 3 },
    'E':    { symbol: 'E',    name: 'E major',     tier: 2, notes: 3 },
    'A':    { symbol: 'A',    name: 'A major',     tier: 2, notes: 3 },
    'Bb':   { symbol: 'Bb',   name: 'Bb major',    tier: 2, notes: 3 },
    'Eb':   { symbol: 'Eb',   name: 'Eb major',    tier: 2, notes: 3 },
    'Ab':   { symbol: 'Ab',   name: 'Ab major',    tier: 2, notes: 3 },
    'Cm':   { symbol: 'Cm',   name: 'C minor',     tier: 2, notes: 3 },
    'Fm':   { symbol: 'Fm',   name: 'F minor',     tier: 2, notes: 3 },
    'Gm':   { symbol: 'Gm',   name: 'G minor',     tier: 2, notes: 3 },
    'Bm':   { symbol: 'Bm',   name: 'B minor',     tier: 2, notes: 3 },
    'Bdim': { symbol: 'Bdim', name: 'B diminished', tier: 2, notes: 3 },
    'Caug': { symbol: 'Caug', name: 'C augmented',  tier: 2, notes: 3 },

    // --- TIER 3: Seventh chords (4 notes) ---
    'Cmaj7':  { symbol: 'Cmaj7',  name: 'C major 7',     tier: 3, notes: 4 },
    'Dm7':    { symbol: 'Dm7',    name: 'D minor 7',     tier: 3, notes: 4 },
    'Em7':    { symbol: 'Em7',    name: 'E minor 7',     tier: 3, notes: 4 },
    'Fmaj7':  { symbol: 'Fmaj7',  name: 'F major 7',     tier: 3, notes: 4 },
    'G7':     { symbol: 'G7',     name: 'G dominant 7',   tier: 3, notes: 4 },
    'Am7':    { symbol: 'Am7',    name: 'A minor 7',     tier: 3, notes: 4 },
    'Bm7b5':  { symbol: 'Bm7b5', name: 'B half-dim 7',  tier: 3, notes: 4 },
    'D7':     { symbol: 'D7',     name: 'D dominant 7',   tier: 3, notes: 4 },
    'A7':     { symbol: 'A7',     name: 'A dominant 7',   tier: 3, notes: 4 },
    'E7':     { symbol: 'E7',     name: 'E dominant 7',   tier: 3, notes: 4 },
    'Bb7':    { symbol: 'Bb7',    name: 'Bb dominant 7',  tier: 3, notes: 4 },

    // --- TIER 4: Extended / altered chords (5+ notes) ---
    'Cmaj9':  { symbol: 'Cmaj9',  name: 'C major 9',     tier: 4, notes: 5 },
    'Dm9':    { symbol: 'Dm9',    name: 'D minor 9',     tier: 4, notes: 5 },
    'G9':     { symbol: 'G9',     name: 'G dominant 9',   tier: 4, notes: 5 },
    'Am9':    { symbol: 'Am9',    name: 'A minor 9',     tier: 4, notes: 5 },
    'Cmaj11': { symbol: 'Cmaj11', name: 'C major 11',    tier: 4, notes: 5 },
    'G13':    { symbol: 'G13',    name: 'G dominant 13',  tier: 4, notes: 6 },
  };

  // Common progressions for level sequences (Roman numerals resolved to C major)
  // Source: Hooktheory top progressions
  const PROGRESSIONS = [
    // Beginner progressions (tier 1 chords only)
    { name: 'Pop Classic',       tier: 1, chords: ['C', 'G', 'Am', 'F'] },
    { name: 'Doo-wop',           tier: 1, chords: ['C', 'Am', 'F', 'G'] },
    { name: 'Country Road',      tier: 1, chords: ['C', 'F', 'G', 'C'] },
    { name: 'Emo Anthem',        tier: 1, chords: ['Am', 'F', 'C', 'G'] },
    { name: 'Three Chord Rock',  tier: 1, chords: ['C', 'F', 'G'] },

    // Intermediate progressions (tier 1-2 chords)
    { name: 'Minor Drama',       tier: 2, chords: ['Am', 'Dm', 'G', 'C'] },
    { name: 'Andalusian',        tier: 2, chords: ['Am', 'G', 'F', 'E'] },
    { name: 'Jazz Intro',        tier: 2, chords: ['Dm', 'G', 'C', 'Am'] },
    { name: 'Soul Train',        tier: 2, chords: ['C', 'Am', 'Dm', 'G'] },

    // Advanced progressions (tier 3 chords)
    { name: 'Jazz ii-V-I',       tier: 3, chords: ['Dm7', 'G7', 'Cmaj7'] },
    { name: 'Smooth Jazz',       tier: 3, chords: ['Cmaj7', 'Am7', 'Dm7', 'G7'] },
    { name: 'Autumn Leaves',     tier: 3, chords: ['Am7', 'D7', 'Cmaj7', 'Fmaj7'] },
    { name: 'Blues Turnaround',  tier: 3, chords: ['G7', 'C7', 'D7', 'G7'] },

    // Expert progressions (tier 4 chords)
    { name: 'Neo-Soul',          tier: 4, chords: ['Cmaj9', 'Am9', 'Dm9', 'G9'] },
    { name: 'Modern Jazz',       tier: 4, chords: ['Cmaj9', 'Dm9', 'G13', 'Cmaj9'] },
  ];

  function getChordsByTier(tier) {
    return Object.values(CHORDS).filter(c => c.tier <= tier);
  }

  function getProgressionsByTier(tier) {
    return PROGRESSIONS.filter(p => p.tier <= tier);
  }

  function getRandomChord(tier) {
    let pool = getChordsByTier(tier);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function getRandomProgression(tier) {
    let pool = getProgressionsByTier(tier);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  C.CHORDS = CHORDS;
  C.PROGRESSIONS = PROGRESSIONS;
  C.getChordsByTier = getChordsByTier;
  C.getProgressionsByTier = getProgressionsByTier;
  C.getRandomChord = getRandomChord;
  C.getRandomProgression = getRandomProgression;

})(window.Chordessy);
```

**Step 2: Commit**

```bash
git add neural-arpeggiator/src/chords-db.js
git commit -m "feat: add chord database with 4 difficulty tiers and common progressions"
```

---

## Task 3: Create the Game HTML Page (`game.html`)

**Files:**
- Create: `neural-arpeggiator/src/game.html`

This is the entry point for the chord training game. Loads the same external dependencies as `index.html` (Tone.js via Magenta, WebMidi, Tonal, lodash, AudioKeys) plus the shared module and game code.

**Step 1: Create `game.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chordessy - Chord Training Game</title>
  <link href="https://fonts.googleapis.com/css?family=Abel" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="game.css">
  <!-- Dependencies (same as neural-arpeggiator) -->
  <script src="https://cdn.jsdelivr.net/npm/@magenta/music@1.12.0/es6/core.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/webmidi"></script>
  <script src="https://cdn.jsdelivr.net/npm/tonal"></script>
  <script src="https://cdn.jsdelivr.net/npm/lodash"></script>
  <script src="https://cdn.jsdelivr.net/npm/audiokeys"></script>
</head>
<body>
  <div class="game-container">
    <!-- Top bar: Score, Lives, Level -->
    <div class="game-hud">
      <div class="hud-left">
        <span class="level-badge">Level <span id="level-num">1</span></span>
        <span class="tier-badge" id="tier-badge">Triads</span>
      </div>
      <div class="hud-center">
        <div class="score-display">
          <span id="score">0</span>
          <span class="score-label">pts</span>
        </div>
        <div class="combo-display" id="combo-display" style="display:none">
          <span id="combo-count">0</span>x combo
        </div>
      </div>
      <div class="hud-right">
        <div class="lives" id="lives-container"></div>
      </div>
    </div>

    <!-- Challenge area: shows target chord -->
    <div class="challenge-area">
      <div class="chord-name" id="chord-name">C major</div>
      <div class="chord-notes" id="chord-notes">C - E - G</div>
      <div class="timer-bar-container">
        <div class="timer-bar" id="timer-bar"></div>
      </div>
    </div>

    <!-- Feedback overlay -->
    <div class="feedback-overlay" id="feedback-overlay">
      <div class="feedback-text" id="feedback-text"></div>
      <div class="feedback-score" id="feedback-score"></div>
    </div>

    <!-- Piano keyboard -->
    <div class="game-keyboard-area">
      <div class="keyboard game-keyboard" id="game-keyboard"></div>
    </div>

    <!-- Start screen -->
    <div class="start-screen" id="start-screen">
      <h1>Chordessy</h1>
      <p>Chord Training Game</p>
      <div class="level-select">
        <button class="start-btn" data-tier="1">Beginner<br><small>Major & minor triads</small></button>
        <button class="start-btn" data-tier="2">Intermediate<br><small>All triads + dim/aug</small></button>
        <button class="start-btn" data-tier="3">Advanced<br><small>Seventh chords</small></button>
        <button class="start-btn" data-tier="4">Expert<br><small>Extended chords</small></button>
      </div>
      <p class="midi-status" id="midi-status">Detecting MIDI keyboard...</p>
      <p><a href="index.html">Switch to Neural Arpeggiator</a></p>
    </div>

    <!-- Game Over screen -->
    <div class="game-over-screen" id="game-over-screen" style="display:none">
      <h1>Game Over</h1>
      <div class="final-score">Score: <span id="final-score">0</span></div>
      <div class="final-stats">
        <div>Correct: <span id="stat-correct">0</span></div>
        <div>Missed: <span id="stat-missed">0</span></div>
        <div>Best Combo: <span id="stat-combo">0</span></div>
      </div>
      <button class="start-btn" id="play-again-btn">Play Again</button>
    </div>
  </div>

  <script src="shared.js"></script>
  <script src="chords-db.js"></script>
  <script src="game.js"></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add neural-arpeggiator/src/game.html
git commit -m "feat: add game.html entry point with HUD, challenge area, and start screen"
```

---

## Task 4: Create Game Styles (`game.css`)

**Files:**
- Create: `neural-arpeggiator/src/game.css`

**Step 1: Create game-specific CSS**

```css
/* game.css - Chord Training Game styles */

.game-container {
  width: 100%;
  height: 100%;
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
  color: white;
  font-family: 'Abel', sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* --- HUD (top bar) --- */
.game-hud {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 30px;
  background: rgba(0, 0, 0, 0.3);
  z-index: 10;
}

.level-badge {
  background: rgba(255, 255, 255, 0.15);
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 18px;
  margin-right: 10px;
}

.tier-badge {
  background: #7c4dff;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 14px;
}

.score-display {
  font-size: 36px;
  font-weight: bold;
  text-align: center;
}
.score-label {
  font-size: 16px;
  opacity: 0.6;
  margin-left: 4px;
}

.combo-display {
  text-align: center;
  font-size: 18px;
  color: #ffab40;
  animation: pulse 0.3s ease-out;
}

.lives {
  display: flex;
  gap: 8px;
}
.life {
  width: 28px;
  height: 28px;
  font-size: 24px;
  transition: transform 0.3s, opacity 0.3s;
}
.life.lost {
  opacity: 0.2;
  transform: scale(0.7);
}

/* --- Challenge area (center) --- */
.challenge-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 5;
}

.chord-name {
  font-size: 72px;
  font-weight: bold;
  text-shadow: 0 0 30px rgba(124, 77, 255, 0.5);
  transition: transform 0.2s;
}

.chord-notes {
  font-size: 24px;
  opacity: 0.7;
  margin-top: 10px;
  letter-spacing: 4px;
}

.timer-bar-container {
  width: 300px;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  margin-top: 30px;
  overflow: hidden;
}
.timer-bar {
  height: 100%;
  width: 100%;
  background: linear-gradient(to right, #7c4dff, #448aff);
  border-radius: 3px;
  transition: width 0.1s linear;
}
.timer-bar.warning {
  background: linear-gradient(to right, #ff5252, #ff9800);
}
.timer-bar.critical {
  background: #ff1744;
  animation: flash-bar 0.5s infinite;
}

/* --- Feedback overlay --- */
.feedback-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 20;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
}
.feedback-overlay.show {
  opacity: 1;
}
.feedback-text {
  font-size: 48px;
  font-weight: bold;
}
.feedback-text.correct {
  color: #69f0ae;
}
.feedback-text.incorrect {
  color: #ff5252;
}
.feedback-score {
  font-size: 28px;
  color: #ffab40;
  margin-top: 8px;
}

/* --- Keyboard --- */
.game-keyboard-area {
  height: 220px;
  position: relative;
  padding: 0 5vw;
  z-index: 5;
}
.game-keyboard {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Highlighted target keys */
.keyboard .key.target {
  background-color: #7c4dff !important;
  box-shadow: 0 0 15px rgba(124, 77, 255, 0.6);
}
.keyboard .key.accidental.target {
  background-color: #5c35cc !important;
}

/* Correct key pressed */
.keyboard .key.correct {
  background-color: #69f0ae !important;
  box-shadow: 0 0 20px rgba(105, 240, 174, 0.6);
}
.keyboard .key.accidental.correct {
  background-color: #00c853 !important;
}

/* Wrong key pressed */
.keyboard .key.wrong {
  background-color: #ff5252 !important;
  box-shadow: 0 0 15px rgba(255, 82, 82, 0.6);
}

/* Player pressed (neutral highlight) */
.keyboard .key.pressed {
  background-color: #448aff !important;
}
.keyboard .key.accidental.pressed {
  background-color: #2962ff !important;
}

/* --- Start screen --- */
.start-screen, .game-over-screen {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 12, 41, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 50;
}
.start-screen h1, .game-over-screen h1 {
  font-size: 64px;
  margin-bottom: 10px;
  background: linear-gradient(to right, #7c4dff, #448aff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.start-screen p {
  font-size: 20px;
  opacity: 0.7;
  margin-bottom: 30px;
}

.level-select {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  justify-content: center;
}

.start-btn {
  background: linear-gradient(135deg, #7c4dff, #448aff);
  border: none;
  color: white;
  padding: 20px 30px;
  font-size: 20px;
  font-family: 'Abel', sans-serif;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  min-width: 160px;
}
.start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(124, 77, 255, 0.4);
}
.start-btn small {
  display: block;
  opacity: 0.7;
  font-size: 14px;
  margin-top: 6px;
}

.midi-status {
  font-size: 14px;
  opacity: 0.5;
}

.final-score {
  font-size: 48px;
  margin: 20px 0;
  color: #ffab40;
}
.final-stats {
  display: flex;
  gap: 30px;
  font-size: 20px;
  opacity: 0.7;
  margin-bottom: 30px;
}

/* --- Animations --- */
@keyframes pulse {
  0% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
@keyframes flash-bar {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes shake {
  0%, 100% { transform: translate(-50%, -50%); }
  25% { transform: translate(-52%, -50%); }
  75% { transform: translate(-48%, -50%); }
}
@keyframes float-up {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-60px); }
}
.score-popup {
  position: absolute;
  font-size: 32px;
  font-weight: bold;
  color: #ffab40;
  animation: float-up 0.8s ease-out forwards;
  pointer-events: none;
  z-index: 30;
}
```

**Step 2: Commit**

```bash
git add neural-arpeggiator/src/game.css
git commit -m "feat: add game styles with HUD, feedback, keyboard highlights, and animations"
```

---

## Task 5: Create the Game Engine (`game.js`)

**Files:**
- Create: `neural-arpeggiator/src/game.js`

This is the core game logic: game loop, state management, chord challenges, scoring, lives, timer, and feedback.

**Step 1: Create `game.js`**

```javascript
// game.js - Chord Training Game Engine
(function() {
  const C = window.Chordessy;

  // --- Game State ---
  let state = {
    running: false,
    tier: 1,
    level: 1,
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: 5,
    maxLives: 5,
    correct: 0,
    missed: 0,
    currentChord: null,     // { symbol, name, tier, notes } from CHORDS db
    targetMidiNotes: [],    // MIDI notes the player needs to hit
    heldNotes: new Set(),   // Currently held MIDI notes
    timerHandle: null,
    timerStart: 0,
    timeLimit: 10000,       // ms per chord (decreases with level)
    roundLength: 10,        // chords per round
    roundProgress: 0,
    mode: 'random',         // 'random' or 'progression'
    progression: null,      // current progression if in progression mode
    progressionIndex: 0,
  };

  // --- DOM refs ---
  let dom = {};

  // --- Audio ---
  let audio = null;
  let builtInKeyboard = null;

  // --- Keyboard ---
  let keyboard = null; // array of key DOM elements

  // Time limit per tier/level (ms)
  function getTimeLimit(tier, level) {
    let base = { 1: 12000, 2: 10000, 3: 8000, 4: 7000 }[tier] || 10000;
    // Reduce by 500ms per level, min 2000ms
    return Math.max(2000, base - (level - 1) * 500);
  }

  // Points per correct answer
  function getBasePoints(tier) {
    return { 1: 100, 2: 150, 3: 200, 4: 300 }[tier] || 100;
  }

  // --- Initialization ---
  function init() {
    // Cache DOM refs
    dom.startScreen = document.getElementById('start-screen');
    dom.gameOverScreen = document.getElementById('game-over-screen');
    dom.chordName = document.getElementById('chord-name');
    dom.chordNotes = document.getElementById('chord-notes');
    dom.score = document.getElementById('score');
    dom.levelNum = document.getElementById('level-num');
    dom.tierBadge = document.getElementById('tier-badge');
    dom.comboDisplay = document.getElementById('combo-display');
    dom.comboCount = document.getElementById('combo-count');
    dom.livesContainer = document.getElementById('lives-container');
    dom.timerBar = document.getElementById('timer-bar');
    dom.feedbackOverlay = document.getElementById('feedback-overlay');
    dom.feedbackText = document.getElementById('feedback-text');
    dom.feedbackScore = document.getElementById('feedback-score');
    dom.midiStatus = document.getElementById('midi-status');
    dom.finalScore = document.getElementById('final-score');
    dom.statCorrect = document.getElementById('stat-correct');
    dom.statMissed = document.getElementById('stat-missed');
    dom.statCombo = document.getElementById('stat-combo');

    // Build keyboard
    let keyboardContainer = document.getElementById('game-keyboard');
    keyboard = C.buildKeyboard(keyboardContainer);

    // Setup QWERTY fallback
    builtInKeyboard = new AudioKeys({ rows: 2 });
    builtInKeyboard.down(note => onNoteOn(note.note, 0.7));
    builtInKeyboard.up(note => onNoteOff(note.note));

    // Setup MIDI
    C.setupMidi()
      .then(midi => {
        midi.onNoteOn((note, velocity) => onNoteOn(note, velocity));
        midi.onNoteOff((note) => onNoteOff(note));
        let inputs = midi.getInputs();
        if (inputs.length > 0) {
          dom.midiStatus.textContent = 'MIDI: ' + inputs.map(i => i.name).join(', ');
        } else {
          dom.midiStatus.textContent = 'No MIDI device found. Use computer keyboard (A-L keys).';
        }
      })
      .catch(() => {
        dom.midiStatus.textContent = 'MIDI not available. Use computer keyboard (A-L keys).';
      });

    // Setup audio
    audio = C.setupAudio();

    // Bind start buttons
    document.querySelectorAll('.start-btn[data-tier]').forEach(btn => {
      btn.addEventListener('click', () => {
        let tier = parseInt(btn.dataset.tier);
        startGame(tier);
      });
    });

    // Play again button
    document.getElementById('play-again-btn').addEventListener('click', () => {
      dom.gameOverScreen.style.display = 'none';
      dom.startScreen.style.display = 'flex';
    });

    // Mouse/touch on keyboard
    keyboard.forEach((keyEl, index) => {
      let note = C.MIN_NOTE + index;
      keyEl.addEventListener('mousedown', e => { onNoteOn(note, 0.7); e.preventDefault(); });
      keyEl.addEventListener('mouseup', () => onNoteOff(note));
      keyEl.addEventListener('mouseleave', () => onNoteOff(note));
    });

    // Start audio context on any click
    document.addEventListener('click', () => {
      if (audio && audio.Tone && audio.Tone.context.state !== 'running') {
        audio.Tone.context.resume();
      }
    }, { once: true });
  }

  // --- Game Flow ---
  function startGame(tier) {
    state.tier = tier;
    state.level = 1;
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.lives = state.maxLives;
    state.correct = 0;
    state.missed = 0;
    state.roundProgress = 0;
    state.running = true;

    dom.startScreen.style.display = 'none';
    dom.gameOverScreen.style.display = 'none';

    updateHUD();
    renderLives();
    nextChord();
  }

  function nextChord() {
    if (!state.running) return;

    // Check round completion
    if (state.roundProgress >= state.roundLength) {
      levelUp();
      return;
    }

    // Clear keyboard highlights
    clearKeyboardHighlights();
    state.heldNotes.clear();

    // Pick next chord
    let chord = C.getRandomChord(state.tier);
    state.currentChord = chord;
    state.targetMidiNotes = C.chordToMidiNotes(chord.symbol);
    state.roundProgress++;

    // Update display
    let noteNames = state.targetMidiNotes.map(n => C.midiToNoteName(n));
    dom.chordName.textContent = chord.name;
    dom.chordNotes.textContent = noteNames.map(n => n.replace(/\d/, '')).join(' - ');

    // Highlight target keys on keyboard
    state.targetMidiNotes.forEach(midi => {
      let idx = midi - C.MIN_NOTE;
      if (idx >= 0 && idx < keyboard.length) {
        keyboard[idx].classList.add('target');
      }
    });

    // Play the target chord so player can hear it
    if (audio) {
      audio.playChord(state.targetMidiNotes, '2n');
    }

    // Start timer
    startTimer();
  }

  function levelUp() {
    state.level++;
    state.roundProgress = 0;
    state.timeLimit = getTimeLimit(state.tier, state.level);
    dom.levelNum.textContent = state.level;

    // Brief level-up feedback
    showFeedback('Level ' + state.level + '!', '', 'correct');
    setTimeout(() => nextChord(), 1200);
  }

  function gameOver() {
    state.running = false;
    clearTimeout(state.timerHandle);

    dom.finalScore.textContent = state.score;
    dom.statCorrect.textContent = state.correct;
    dom.statMissed.textContent = state.missed;
    dom.statCombo.textContent = state.bestCombo;
    dom.gameOverScreen.style.display = 'flex';

    clearKeyboardHighlights();
  }

  // --- Timer ---
  function startTimer() {
    state.timeLimit = getTimeLimit(state.tier, state.level);
    state.timerStart = performance.now();

    dom.timerBar.style.width = '100%';
    dom.timerBar.classList.remove('warning', 'critical');

    clearTimeout(state.timerHandle);
    updateTimerBar();
  }

  function updateTimerBar() {
    if (!state.running) return;

    let elapsed = performance.now() - state.timerStart;
    let remaining = state.timeLimit - elapsed;
    let pct = Math.max(0, (remaining / state.timeLimit) * 100);

    dom.timerBar.style.width = pct + '%';

    if (pct < 20) {
      dom.timerBar.classList.add('critical');
      dom.timerBar.classList.remove('warning');
    } else if (pct < 40) {
      dom.timerBar.classList.add('warning');
      dom.timerBar.classList.remove('critical');
    }

    if (remaining <= 0) {
      onTimeout();
      return;
    }

    state.timerHandle = setTimeout(() => updateTimerBar(), 50);
  }

  function onTimeout() {
    state.missed++;
    state.combo = 0;
    state.lives--;

    showFeedback('Time\'s up!', state.currentChord.name, 'incorrect');
    renderLives();

    if (state.lives <= 0) {
      setTimeout(gameOver, 1000);
    } else {
      setTimeout(() => nextChord(), 1200);
    }
  }

  // --- Input Handling ---
  function onNoteOn(note, velocity) {
    if (!state.running) return;
    if (note < C.MIN_NOTE || note > C.MAX_NOTE) return;

    state.heldNotes.add(note);

    // Visual: highlight pressed key
    let idx = note - C.MIN_NOTE;
    if (idx >= 0 && idx < keyboard.length) {
      keyboard[idx].classList.add('pressed');
    }

    // Play the note audio
    if (audio) {
      audio.playNote(note, velocity);
    }

    // Check if enough notes are held to match the chord
    checkChord();
  }

  function onNoteOff(note) {
    if (note < C.MIN_NOTE || note > C.MAX_NOTE) return;
    state.heldNotes.delete(note);

    let idx = note - C.MIN_NOTE;
    if (idx >= 0 && idx < keyboard.length) {
      keyboard[idx].classList.remove('pressed');
    }
  }

  function checkChord() {
    if (!state.currentChord) return;

    let held = Array.from(state.heldNotes);
    let target = state.targetMidiNotes;

    // Need at least as many notes as the chord requires
    if (held.length < target.length) return;

    // Check if pitch classes match (octave-agnostic)
    if (C.pitchClassesMatch(held, target)) {
      onCorrect();
    } else if (held.length >= target.length) {
      // Player has enough notes held but they're wrong
      onIncorrect();
    }
  }

  function onCorrect() {
    clearTimeout(state.timerHandle);
    state.correct++;
    state.combo++;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;

    // Calculate score with combo multiplier and time bonus
    let elapsed = performance.now() - state.timerStart;
    let timeBonus = Math.round(Math.max(0, (1 - elapsed / state.timeLimit)) * 50);
    let comboMultiplier = Math.min(state.combo, 8); // cap at 8x
    let points = (getBasePoints(state.tier) + timeBonus) * comboMultiplier;
    state.score += points;

    // Highlight correct keys green
    state.targetMidiNotes.forEach(midi => {
      let idx = midi - C.MIN_NOTE;
      if (idx >= 0 && idx < keyboard.length) {
        keyboard[idx].classList.remove('target');
        keyboard[idx].classList.add('correct');
      }
    });

    showFeedback('Correct!', '+' + points, 'correct');
    showScorePopup(points);
    updateHUD();

    setTimeout(() => nextChord(), 800);
  }

  function onIncorrect() {
    state.missed++;
    state.combo = 0;
    state.lives--;

    // Highlight wrong notes red
    state.heldNotes.forEach(note => {
      let idx = note - C.MIN_NOTE;
      if (idx >= 0 && idx < keyboard.length) {
        if (!state.targetMidiNotes.some(t => t % 12 === note % 12)) {
          keyboard[idx].classList.add('wrong');
        }
      }
    });

    showFeedback('Wrong!', state.currentChord.name, 'incorrect');
    renderLives();

    if (state.lives <= 0) {
      clearTimeout(state.timerHandle);
      setTimeout(gameOver, 1000);
    } else {
      // Brief pause, then continue (don't clear timeout - timer keeps running)
      // Actually, move to next chord after brief pause
      clearTimeout(state.timerHandle);
      setTimeout(() => nextChord(), 1200);
    }
  }

  // --- UI Updates ---
  function updateHUD() {
    dom.score.textContent = state.score;
    dom.levelNum.textContent = state.level;
    dom.tierBadge.textContent = ['', 'Triads', 'All Triads', 'Sevenths', 'Extended'][state.tier];

    if (state.combo > 1) {
      dom.comboDisplay.style.display = 'block';
      dom.comboCount.textContent = state.combo;
      dom.comboDisplay.style.animation = 'none';
      dom.comboDisplay.offsetHeight; // reflow
      dom.comboDisplay.style.animation = 'pulse 0.3s ease-out';
    } else {
      dom.comboDisplay.style.display = 'none';
    }
  }

  function renderLives() {
    dom.livesContainer.innerHTML = '';
    for (let i = 0; i < state.maxLives; i++) {
      let life = document.createElement('div');
      life.className = 'life' + (i >= state.lives ? ' lost' : '');
      life.textContent = '\u2665'; // heart
      dom.livesContainer.appendChild(life);
    }
  }

  function showFeedback(text, subtext, type) {
    dom.feedbackText.textContent = text;
    dom.feedbackText.className = 'feedback-text ' + type;
    dom.feedbackScore.textContent = subtext;
    dom.feedbackOverlay.classList.add('show');

    setTimeout(() => {
      dom.feedbackOverlay.classList.remove('show');
    }, 800);
  }

  function showScorePopup(points) {
    let popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = '+' + points;
    popup.style.left = '50%';
    popup.style.top = '40%';
    document.querySelector('.game-container').appendChild(popup);
    setTimeout(() => popup.remove(), 900);
  }

  function clearKeyboardHighlights() {
    keyboard.forEach(key => {
      key.classList.remove('target', 'correct', 'wrong', 'pressed');
    });
  }

  // --- Boot ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
```

**Step 2: Test manually in browser**

Open `neural-arpeggiator/src/game.html` in Chrome. Expected behavior:
- Start screen shows with 4 difficulty buttons
- MIDI status shows detected keyboard (or fallback message)
- Clicking "Beginner" starts the game
- Chord name + highlighted keys appear
- Timer bar counts down
- Pressing correct keys on MIDI/QWERTY triggers "Correct!" feedback
- Wrong keys trigger "Wrong!" and lose a life
- Timeout loses a life
- 0 lives = game over screen with stats

**Step 3: Commit**

```bash
git add neural-arpeggiator/src/game.js
git commit -m "feat: add core game engine with scoring, lives, timer, and chord challenges"
```

---

## Task 6: Add Navigation Between Modes

**Files:**
- Modify: `neural-arpeggiator/src/index.html`

Add a link from the arpeggiator to the game mode.

**Step 1: Add navigation link to index.html**

Add before the closing `</div>` of `.container`:

```html
<div class="mode-switch">
  <a href="game.html">Switch to Chord Training Game</a>
</div>
```

**Step 2: Add CSS for mode-switch link**

Append to `style.css`:

```css
.mode-switch {
  position: absolute;
  bottom: 10px;
  left: 0;
  width: 100%;
  text-align: center;
  z-index: 10;
  font-size: 14px;
  opacity: 0.5;
}
.mode-switch:hover {
  opacity: 1;
}
```

**Step 3: Commit**

```bash
git add neural-arpeggiator/src/index.html neural-arpeggiator/src/style.css
git commit -m "feat: add navigation between arpeggiator and game modes"
```

---

## Task 7: Add Audio Feedback Sounds

**Files:**
- Modify: `neural-arpeggiator/src/game.js`

Add synthesized correct/incorrect sound effects using Tone.js.

**Step 1: Add feedback synths to game.js**

Add after the `audio = C.setupAudio();` line in `init()`:

```javascript
// Feedback sounds
let Tone = audio.Tone;
let correctSynth = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.2 }
}).connect(new Tone.Gain(0.3).toMaster());

let incorrectSynth = new Tone.Synth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.15 }
}).connect(new Tone.Gain(0.15).toMaster());

audio.playCorrect = function() {
  let now = Tone.now();
  correctSynth.triggerAttackRelease('C5', '16n', now);
  correctSynth.triggerAttackRelease('E5', '16n', now + 0.08);
  correctSynth.triggerAttackRelease('G5', '16n', now + 0.16);
};

audio.playIncorrect = function() {
  let now = Tone.now();
  incorrectSynth.triggerAttackRelease('E2', '8n', now);
};
```

**Step 2: Call feedback sounds in onCorrect/onIncorrect**

In `onCorrect()`, after `showFeedback(...)`:
```javascript
if (audio.playCorrect) audio.playCorrect();
```

In `onIncorrect()`, after `showFeedback(...)`:
```javascript
if (audio.playIncorrect) audio.playIncorrect();
```

In `onTimeout()`, after `showFeedback(...)`:
```javascript
if (audio.playIncorrect) audio.playIncorrect();
```

**Step 3: Commit**

```bash
git add neural-arpeggiator/src/game.js
git commit -m "feat: add synthesized correct/incorrect audio feedback"
```

---

## Task 8: Add Progression Mode

**Files:**
- Modify: `neural-arpeggiator/src/game.js`
- Modify: `neural-arpeggiator/src/game.html`

Allow players to play through chord progressions instead of random chords.

**Step 1: Add progression mode toggle to game.html**

In the `.level-select` div, after the tier buttons:

```html
<div class="mode-toggle" style="width:100%; text-align:center; margin-top:15px;">
  <label>
    <input type="checkbox" id="progression-mode"> Play chord progressions
  </label>
</div>
```

**Step 2: Add progression logic to game.js**

In `startGame()`, read the toggle:
```javascript
state.mode = document.getElementById('progression-mode').checked ? 'progression' : 'random';
```

Replace `nextChord()` chord selection logic:
```javascript
// Pick next chord
let chord;
if (state.mode === 'progression') {
  if (!state.progression || state.progressionIndex >= state.progression.chords.length) {
    state.progression = C.getRandomProgression(state.tier);
    state.progressionIndex = 0;
  }
  let symbol = state.progression.chords[state.progressionIndex];
  chord = C.CHORDS[symbol] || { symbol: symbol, name: symbol, tier: state.tier, notes: 3 };
  state.progressionIndex++;
} else {
  chord = C.getRandomChord(state.tier);
}
```

**Step 3: Commit**

```bash
git add neural-arpeggiator/src/game.js neural-arpeggiator/src/game.html
git commit -m "feat: add chord progression mode as alternative to random chords"
```

---

## Task 9: Polish & Edge Cases

**Files:**
- Modify: `neural-arpeggiator/src/game.js`

**Step 1: Handle sustain pedal (MIDI CC 64)**

In `setupMidi()` within `shared.js`, or directly in game.js's MIDI setup, add:

```javascript
// Clear held notes when sustain pedal is released
// (Prevents stuck notes from counting toward chord detection)
```

**Step 2: Prevent duplicate incorrect triggers**

Add a `cooldown` flag so `onIncorrect()` can't fire multiple times per chord:

```javascript
let incorrectCooldown = false;

function onIncorrect() {
  if (incorrectCooldown) return;
  incorrectCooldown = true;
  setTimeout(() => { incorrectCooldown = false; }, 1200);
  // ... rest of onIncorrect
}
```

**Step 3: Add "hear chord again" button**

In `game.html` challenge area:
```html
<button class="hear-again-btn" id="hear-again-btn" title="Hear chord again">&#x1f50a;</button>
```

In `game.js`:
```javascript
document.getElementById('hear-again-btn').addEventListener('click', () => {
  if (state.targetMidiNotes.length > 0 && audio) {
    audio.playChord(state.targetMidiNotes, '2n');
  }
});
```

**Step 4: Commit**

```bash
git add neural-arpeggiator/src/game.js neural-arpeggiator/src/game.html
git commit -m "fix: add cooldown, sustain pedal handling, and hear-again button"
```

---

## Task 10: Final Integration Test

**Step 1: Open game.html in Chrome with a MIDI keyboard connected**

Verify:
- [ ] Start screen renders correctly
- [ ] MIDI keyboard is detected
- [ ] Clicking a difficulty tier starts the game
- [ ] Chord name and highlighted keys appear
- [ ] Timer bar counts down smoothly
- [ ] Playing correct chord triggers green feedback + score
- [ ] Playing wrong notes triggers red feedback + life lost
- [ ] Combo counter shows and multiplies score
- [ ] Timer running out loses a life
- [ ] Losing all lives shows game over screen with stats
- [ ] "Play Again" returns to start screen
- [ ] Progression mode works when toggled
- [ ] QWERTY keyboard fallback works (A-L keys)
- [ ] On-screen keyboard clicks work
- [ ] Audio plays for target chord preview and feedback sounds
- [ ] Navigation link from arpeggiator to game works
- [ ] Navigation link from game to arpeggiator works

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete chord training game v1 with scoring, levels, and MIDI input"
```

---

## Future Enhancements (Not in This Plan)

- **Phase 2**: Computer vision for finger placement (MediaPipe Hands)
- **Spaced repetition**: SM-2 algorithm for personalized chord review
- **Leaderboard**: Local storage high scores
- **VexFlow notation**: Show chords on a staff at higher levels
- **Import from Chordonomicon**: Parse full chord database CSV for richer content
- **Inversion detection**: Check specific voicings, not just pitch classes
- **Mobile support**: Touch-optimized keyboard layout
