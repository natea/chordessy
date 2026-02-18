# Chord Training Game — SPARC-GOAP Implementation Plan

> **Methodology**: SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) + GOAP (Goal-Oriented Action Planning)

**Goal:** Build an interactive chord training game within the existing neural-arpeggiator vanilla JS project, with MIDI keyboard input, difficulty tiers, scoring, and lives system.

**Architecture:** New game page (`game.html`) alongside existing arpeggiator (`index.html`), sharing utilities via a `shared.js` module on the `window.Chordessy` namespace. No build tools, no framework — CDN-loaded vanilla JS matching the existing stack.

**Tech Stack:** Tone.js (audio), WebMidi.js (MIDI input), AudioKeys (QWERTY fallback), Tonal.js (chord theory reference), vanilla JS/CSS/HTML

---

## Phase S: Specification (Current State → Goal State)

### Current State
```javascript
current_state = {
  project: 'neural-arpeggiator',
  mode: 'arpeggiator_only',
  input: ['MIDI', 'QWERTY', 'on-screen'],
  chord_detection: 'basic (Tonal.Chord.detect)',
  game_mechanics: null,
  scoring: null,
  difficulty_tiers: null,
  chord_database: null,
  audio_feedback: 'synth_playback_only',
  navigation: 'single_page'
}
```

### Goal State
```javascript
goal_state = {
  project: 'neural-arpeggiator',
  mode: ['arpeggiator', 'chord_training_game'],
  input: ['MIDI', 'QWERTY', 'on-screen_keyboard'],
  chord_detection: 'pitch_class_matching (octave-agnostic)',
  game_mechanics: {
    challenge_display: true,
    timer_countdown: true,
    lives_system: { max: 5, lose_on: ['wrong_chord', 'timeout'] },
    combo_multiplier: { max: 8 },
    level_progression: { chords_per_level: 10, time_reduces: true }
  },
  scoring: {
    base_points_by_tier: [0, 100, 150, 200, 300],
    time_bonus: 'up_to_50',
    combo_multiplier: 'up_to_8x'
  },
  difficulty_tiers: {
    1: { name: 'Beginner', chords: '6 major/minor triads', notes: 3, time: '8s' },
    2: { name: 'Intermediate', chords: '+12 triads/dim/aug', notes: 3, time: '7s' },
    3: { name: 'Advanced', chords: '+11 seventh chords', notes: 4, time: '6s' },
    4: { name: 'Expert', chords: '+6 extended chords', notes: '5-6', time: '5s' }
  },
  chord_database: '35 chords with hardcoded pitch classes, 16 progressions',
  audio_feedback: ['chord_preview', 'correct_chime', 'incorrect_buzz'],
  navigation: 'bidirectional (arpeggiator <-> game)'
}
```

### Pre-flight Analysis (Milestone 0)

**CDN Version Alignment** — The game MUST use the exact same CDN library versions as the existing project. From `dist/index.html`:
```
lodash@4.17.4, @magenta/music@1.1.11, web-animations-js@2.3.1,
webmidi@2.0.0, audiokeys@0.1.1, startaudiocontext@1.2.1,
tonal (rawgit v1.x: cdn.rawgit.com/danigb/tonal/9b6b1663)
```

**Tonal.js Limitation** — The rawgit CDN version is Tonal v1.x which lacks `Chord.get()`. All chord data must be hardcoded pitch classes, not resolved at runtime.

**Tone.js Access** — Tone.js is bundled inside `@magenta/music` and accessed via `mm.Player.tone`. No separate Tone.js CDN import needed.

---

## Phase P: Pseudocode (Game Loop)

```
GAME_LOOP:
  1. Player selects difficulty tier (1-4) on start screen
  2. Initialize: score=0, lives=5, level=1, combo=0
  3. ROUND:
     a. Pick chord (random from tier pool, or next in progression)
     b. Convert chord pitch classes to MIDI notes in playable octave range (48-84)
     c. Display chord name + highlight target keys on virtual keyboard
     d. Play chord audio preview (Tone.js PolySynth)
     e. Start countdown timer (tier-dependent, reduces with level)
     f. WAIT FOR INPUT:
        - On noteOn: add to heldNotes set, highlight key blue
        - On noteOff: remove from heldNotes, unhighlight
        - After each noteOn, check if held pitch classes match target:
          * Match: onCorrect() → score += (base + timeBonus) * combo, combo++, green flash, chime, next chord after 800ms
          * Mismatch (enough notes held): onIncorrect() → lives--, combo=0, red flash, buzz, next chord after 1200ms
        - Timer expires: onTimeout() → lives--, combo=0, "Time's up!", next chord after 1200ms
     g. If lives <= 0: GAME_OVER
     h. If correct_count % 10 == 0: LEVEL_UP (reduce time limits)
     i. Go to ROUND

PITCH_CLASS_MATCH(held, target):
  heldPC = sorted unique set of (note % 12) for each held note
  targetPC = sorted unique set of (note % 12) for each target note
  return heldPC equals targetPC

CHORD_TO_MIDI(pitchClasses, baseOctave=4):
  for each pc in pitchClasses:
    midi = baseOctave * 12 + pc
    if midi < 48: midi += 12  // ensure in keyboard range
    if midi > 84: midi -= 12
  return sorted midi notes
```

---

## Phase A: Architecture

### System Components

```
┌──────────────────────────────────────────────────┐
│                  game.html                        │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐ │
│  │  HUD     │  │  Challenge │  │  Keyboard    │ │
│  │ score    │  │  chord name│  │  37 keys     │ │
│  │ lives    │  │  note names│  │  target/held │ │
│  │ level    │  │  timer bar │  │  highlights  │ │
│  │ combo    │  │            │  │              │ │
│  └──────────┘  └────────────┘  └──────────────┘ │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ Start Screen│  │  Game Over Screen         │  │
│  │ tier select │  │  final score + stats      │  │
│  │ mode toggle │  │  play again button        │  │
│  └─────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────┘
         │              │              │
    ┌────┴────┐   ┌────┴────┐   ┌────┴─────┐
    │shared.js│   │chords-  │   │ game.js  │
    │Chordessy│   │db.js    │   │ engine   │
    │namespace│   │CHORDS   │   │ state    │
    │keyboard │   │PROGRESS │   │ logic    │
    │MIDI     │   │query fn │   │ UI       │
    │audio    │   │         │   │          │
    └─────────┘   └─────────┘   └──────────┘
```

### Data Flow

```
MIDI Keyboard → WebMidi.js → noteOn callback → heldNotes Set → checkChord()
QWERTY Keys  → AudioKeys  → noteOn callback ↗                      ↓
On-screen    → click handler → noteOn callback ↗           pitchClassesMatch()
                                                                    ↓
                                                    onCorrect() / onIncorrect()
                                                                    ↓
                                                    updateHUD() + showFeedback()
```

### File Map

| File | Purpose | Dependencies | Lines |
|------|---------|-------------|-------|
| `shared.js` | Chordessy namespace: keyboard, MIDI, audio, utilities | webmidi, audiokeys, tonal, magenta | ~230 |
| `chords-db.js` | Chord definitions + progressions + query functions | shared.js (namespace) | ~150 |
| `game.html` | Game entry point HTML | CDN libs, shared.js, chords-db.js, game.js | ~90 |
| `game.css` | Game-specific styles + animations | — | ~200 |
| `game.js` | Game engine (state, logic, UI) | shared.js, chords-db.js | ~310 |

---

## GOAP Milestones

### Milestone 0: Pre-flight Verification

**Goal**: Confirm CDN versions and existing code compatibility.

**Actions**: Read `dist/index.html` to extract exact CDN URLs. Verify WebMidi v2.0.0 API (`addListener` syntax), Tonal rawgit v1.x API surface, and `mm.Player.tone` Tone.js access.

**Success Criteria**: CDN URLs documented. API compatibility confirmed.

---

### Milestone 1: Shared Utilities (`shared.js`)

**Goal**: Extract reusable code into a `window.Chordessy` namespace.

**Preconditions**: CDN versions confirmed (M0)

**File**: `neural-arpeggiator/src/shared.js`

**Deliverables**:
- `Chordessy.MIN_NOTE = 48`, `MAX_NOTE = 84`
- `Chordessy.NOTE_NAMES = ['C','C#','D',...]`
- `Chordessy.isAccidental(note)` — returns true for black keys
- `Chordessy.buildKeyboard(container)` — creates 37-key piano DOM, returns key element array
- `Chordessy.setupAudio()` — creates Tone.js PolySynth via `mm.Player.tone`, returns `{synth, Tone, playChord(notes, dur)}`
- `Chordessy.setupMidi()` — returns Promise resolving to `{onNoteOn(cb), onNoteOff(cb), getInputs()}`
- `Chordessy.setupQWERTY()` — creates AudioKeys instance, returns `{onNoteOn(cb), onNoteOff(cb)}`
- `Chordessy.pitchClassesMatch(heldNotes, targetNotes)` — octave-agnostic pitch class set comparison
- `Chordessy.chordToMidiNotes(chord, baseOctave)` — converts pitch classes to MIDI note numbers in range

**Key implementation for `pitchClassesMatch`**:
```javascript
function pitchClassesMatch(held, target) {
  let setA = [...new Set(held.map(n => n % 12))].sort((a,b) => a-b);
  let setB = [...new Set(target.map(n => n % 12))].sort((a,b) => a-b);
  if (setA.length !== setB.length) return false;
  return setA.every((v, i) => v === setB[i]);
}
```

**Key implementation for `setupMidi`**:
```javascript
function setupMidi() {
  let noteOnCallbacks = [];
  let noteOffCallbacks = [];
  return new Promise((resolve, reject) => {
    WebMidi.enable(err => {
      if (err) { reject(err); return; }
      function bindInput(input) {
        input.addListener('noteon', 1, e => {
          noteOnCallbacks.forEach(cb => cb(e.note.number, e.velocity));
        });
        input.addListener('noteoff', 1, e => {
          noteOffCallbacks.forEach(cb => cb(e.note.number));
        });
      }
      WebMidi.inputs.forEach(bindInput);
      WebMidi.addListener('connected', () => WebMidi.inputs.forEach(bindInput));
      resolve({
        onNoteOn(cb) { noteOnCallbacks.push(cb); },
        onNoteOff(cb) { noteOffCallbacks.push(cb); },
        getInputs() { return WebMidi.inputs; }
      });
    });
  });
}
```

**Success Criteria**:
- `shared.js` loads without errors in browser console
- `window.Chordessy` namespace populated with all expected functions
- `Chordessy.buildKeyboard()` renders a 37-key keyboard
- `Chordessy.pitchClassesMatch([60,64,67], [72,76,79])` returns `true` (C major in different octaves)
- `Chordessy.pitchClassesMatch([60,64,67], [60,64,68])` returns `false`
- Existing arpeggiator (`index.html`) still works (shared.js is NOT loaded by it)

---

### Milestone 2: Chord Database (`chords-db.js`)

**Goal**: Create a comprehensive chord database with difficulty tiers, pitch class data, and musical progressions.

**Preconditions**: `shared.js` exists (M1)

**File**: `neural-arpeggiator/src/chords-db.js`

**Chord pitch class reference** (all relative to C=0):

```javascript
// Tier 1: Easy triads (6 chords)
'C':    { pitchClasses: [0, 4, 7] },      // C-E-G
'F':    { pitchClasses: [5, 9, 0] },      // F-A-C
'G':    { pitchClasses: [7, 11, 2] },     // G-B-D
'Am':   { pitchClasses: [9, 0, 4] },      // A-C-E
'Dm':   { pitchClasses: [2, 5, 9] },      // D-F-A
'Em':   { pitchClasses: [4, 7, 11] },     // E-G-B

// Tier 2: More triads + dim/aug (+12 chords)
'D':    { pitchClasses: [2, 6, 9] },      // D-F#-A
'E':    { pitchClasses: [4, 8, 11] },     // E-G#-B
'A':    { pitchClasses: [9, 1, 4] },      // A-C#-E
'Bb':   { pitchClasses: [10, 2, 5] },     // Bb-D-F
'Eb':   { pitchClasses: [3, 7, 10] },     // Eb-G-Bb
'Ab':   { pitchClasses: [8, 0, 3] },      // Ab-C-Eb
'Cm':   { pitchClasses: [0, 3, 7] },      // C-Eb-G
'Fm':   { pitchClasses: [5, 8, 0] },      // F-Ab-C
'Gm':   { pitchClasses: [7, 10, 2] },     // G-Bb-D
'Bm':   { pitchClasses: [11, 2, 6] },     // B-D-F#
'Bdim': { pitchClasses: [11, 2, 5] },     // B-D-F
'Caug': { pitchClasses: [0, 4, 8] },      // C-E-G#

// Tier 3: Seventh chords (+11 chords)
'Cmaj7':  { pitchClasses: [0, 4, 7, 11] },  // C-E-G-B
'Dm7':    { pitchClasses: [2, 5, 9, 0] },   // D-F-A-C
'Em7':    { pitchClasses: [4, 7, 11, 2] },  // E-G-B-D
'Fmaj7':  { pitchClasses: [5, 9, 0, 4] },   // F-A-C-E
'G7':     { pitchClasses: [7, 11, 2, 5] },  // G-B-D-F
'Am7':    { pitchClasses: [9, 0, 4, 7] },   // A-C-E-G
'Bm7b5':  { pitchClasses: [11, 2, 5, 9] },  // B-D-F-A
'D7':     { pitchClasses: [2, 6, 9, 0] },   // D-F#-A-C
'A7':     { pitchClasses: [9, 1, 4, 7] },   // A-C#-E-G
'E7':     { pitchClasses: [4, 8, 11, 2] },  // E-G#-B-D
'C7':     { pitchClasses: [0, 4, 7, 10] },  // C-E-G-Bb

// Tier 4: Extended chords (+6 chords)
'Cmaj9':  { pitchClasses: [0, 4, 7, 11, 2] },   // C-E-G-B-D
'Dm9':    { pitchClasses: [2, 5, 9, 0, 4] },     // D-F-A-C-E
'G9':     { pitchClasses: [7, 11, 2, 5, 9] },    // G-B-D-F-A
'Am9':    { pitchClasses: [9, 0, 4, 7, 11] },    // A-C-E-G-B
'Cmaj11': { pitchClasses: [0, 4, 7, 11, 2, 5] }, // C-E-G-B-D-F
'G13':    { pitchClasses: [7, 11, 2, 5, 9, 4] }, // G-B-D-F-A-E
```

**Progressions** (16 total across 4 tiers):
- Tier 1: I-V-vi-IV (C-G-Am-F), I-IV-V-I (C-F-G-C), vi-IV-I-V (Am-F-C-G), I-vi-IV-V (C-Am-F-G)
- Tier 2: I-V-vi-iii-IV (C-G-Am-Em-F), ii-V-I (Dm-G-C), I-IV-vi-V (C-F-Am-G), I-bVII-IV-I (C-Bb-F-C)
- Tier 3: Imaj7-vi7-ii7-V7 (Cmaj7-Am7-Dm7-G7), IVmaj7-V7-iii7-vi7 (Fmaj7-G7-Em7-Am7), ii7-V7-Imaj7 (Dm7-G7-Cmaj7), I7-IV7-I7-V7 (C7-F-C7-G7)
- Tier 4: Imaj9-ii9-V9 (Cmaj9-Dm9-G9), Imaj9-vi9-ii7-V7 (Cmaj9-Am9-Dm7-G7), Imaj9-IVmaj7-V9-I (Cmaj9-Fmaj7-G9-C), Imaj11-V13-Imaj9 (Cmaj11-G13-Cmaj9)

**Query functions**:
- `Chordessy.getChordsByTier(tier)` — returns array of chords up to and including the given tier
- `Chordessy.getRandomChord(tier)` — returns a random chord from the tier pool
- `Chordessy.getProgressionsByTier(tier)` — returns progressions for the given tier
- `Chordessy.getRandomProgression(tier)` — returns a random progression for the given tier

**Success Criteria**:
- `chords-db.js` loads after `shared.js` without errors
- `Chordessy.getChordsByTier(1)` returns 6 chords
- `Chordessy.getChordsByTier(2)` returns 18 chords (6 + 12)
- `Chordessy.getChordsByTier(3)` returns 29 chords (18 + 11)
- `Chordessy.getChordsByTier(4)` returns 35 chords (29 + 6)
- Every chord symbol referenced in PROGRESSIONS exists in CHORDS

---

### Milestone 3: Game UI Shell (`game.html` + `game.css`)

**Goal**: Create the visual structure for the game with HUD, challenge area, keyboard, start/game-over screens.

**Preconditions**: CDN dependency versions identified (M0), Keyboard styles exist in `style.css`

**Files**: `neural-arpeggiator/src/game.html`, `neural-arpeggiator/src/game.css`

**Critical CDN version alignment** (must match `dist/index.html` exactly):
```html
<script src='https://cdn.jsdelivr.net/npm/lodash@4.17.4/lodash.min.js'></script>
<script src='https://cdn.jsdelivr.net/npm/@magenta/music@1.1.11/dist/magentamusic.min.js'></script>
<script src='https://cdn.jsdelivr.net/npm/web-animations-js@2.3.1/web-animations.min.js'></script>
<script src='https://cdn.jsdelivr.net/npm/webmidi@2.0.0/webmidi.min.js'></script>
<script src='https://cdn.jsdelivr.net/npm/audiokeys@0.1.1/dist/audiokeys.min.js'></script>
<script src='https://cdn.jsdelivr.net/npm/startaudiocontext@1.2.1/StartAudioContext.min.js'></script>
<script src='https://cdn.rawgit.com/danigb/tonal/9b6b1663/dist/tonal.min.js'></script>
```

**HTML Structure**:
```
game-container
  +-- game-hud (score, lives, level, tier, combo)
  +-- challenge-area (chord name, note names, timer bar)
  +-- feedback-overlay (correct/incorrect text + score popup)
  +-- game-keyboard-area (piano keyboard)
  +-- start-screen (title, tier select buttons, progression toggle, midi status, arpeggiator link)
  +-- game-over-screen (final score, stats, play again button)
```

**CSS Architecture**:
- `.game-container`: Full viewport fixed, dark gradient background
- `.game-hud`: Flex row, top bar with score/lives/level
- `.challenge-area`: Flex column center, chord display
- `.keyboard .key.target`: Purple highlight for target keys
- `.keyboard .key.correct`: Green highlight for matched keys
- `.keyboard .key.wrong`: Red highlight for wrong keys
- `.keyboard .key.pressed`: Blue highlight for currently held keys
- `.timer-bar`: Width transition + color states (normal → warning → critical)
- `.start-screen`, `.game-over-screen`: Absolute overlay, centered content
- Animations: `pulse`, `flash-bar`, `shake`, `float-up`

**Success Criteria**:
- `game.html` opens in browser without console errors
- Start screen renders with 4 difficulty buttons and progression toggle
- Keyboard container exists (empty until `buildKeyboard` is called by JS)
- CSS transitions/animations defined and functional
- Responsive layout fills viewport

---

### Milestone 4: Game Engine (`game.js`)

**Goal**: Implement the core game loop with all gameplay mechanics.

**Preconditions**: M1 (shared.js), M2 (chords-db.js), M3 (game.html + game.css)

**File**: `neural-arpeggiator/src/game.js`

**Module structure** (single IIFE, ~310 lines):
```javascript
(function() {
  const C = window.Chordessy;

  // State object (lines ~5-25)
  // DOM cache (lines ~26-30)
  // Audio + keyboard refs (lines ~31-35)

  // Configuration functions (lines ~36-45)
  //   getTimeLimit(tier, level)
  //   getBasePoints(tier)

  // init() (lines ~46-100)
  //   Cache DOM, build keyboard, setup QWERTY, setup MIDI, setup audio
  //   Create feedback synths (correct sine, incorrect sawtooth)
  //   Bind event listeners

  // Game flow (lines ~101-140)
  //   startGame(tier), nextChord(), levelUp(), gameOver()

  // Timer system (lines ~141-175)
  //   startTimer(), updateTimerBar(), onTimeout()

  // Input handling (lines ~176-210)
  //   onNoteOn(note, velocity), onNoteOff(note), checkChord()

  // Result handlers (lines ~211-260)
  //   onCorrect(), onIncorrect()
  //   incorrectCooldown debounce

  // UI updates (lines ~261-310)
  //   updateHUD(), renderLives(), showFeedback(), showScorePopup()
  //   clearKeyboardHighlights()

  // Boot (lines ~311-315)
  //   DOMContentLoaded -> init()
})();
```

**Audio feedback implementation**:
```javascript
// Access Tone via the audio setup (which gets it from mm.Player.tone)
let Tone = audio.Tone;

// Correct sound: ascending C-E-G sine chime
let correctSynth = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.2 }
}).connect(new Tone.Gain(0.3).toMaster());

audio.playCorrect = function() {
  let now = Tone.now();
  correctSynth.triggerAttackRelease('C5', '16n', now);
  correctSynth.triggerAttackRelease('E5', '16n', now + 0.08);
  correctSynth.triggerAttackRelease('G5', '16n', now + 0.16);
};

// Incorrect sound: low sawtooth buzz
let incorrectSynth = new Tone.Synth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.15 }
}).connect(new Tone.Gain(0.15).toMaster());

audio.playIncorrect = function() {
  incorrectSynth.triggerAttackRelease('E2', '8n', Tone.now());
};
```

**Chord matching implementation**:
```javascript
function checkChord() {
  if (!state.currentChord) return;
  let held = Array.from(state.heldNotes);
  let targetPCs = state.currentChord.pitchClasses;

  // Need at least as many distinct pitch classes as the chord
  let heldPCs = [...new Set(held.map(n => n % 12))];
  if (heldPCs.length < targetPCs.length) return;

  if (C.pitchClassesMatch(held, state.targetMidiNotes)) {
    onCorrect();
  } else if (heldPCs.length >= targetPCs.length) {
    onIncorrect();
  }
}
```

**Success Criteria**:
- Game starts when clicking a tier button
- Start screen hides, HUD appears with score=0, level=1, 5 hearts
- Chord name + highlighted keys displayed
- Timer bar counts down smoothly
- MIDI input triggers `onNoteOn`
- Playing correct pitch classes triggers `onCorrect()` flow
- Playing wrong notes triggers `onIncorrect()` flow
- Timer expiry triggers `onTimeout()` flow
- Combo counter shows on 2+ consecutive correct
- Level-up occurs after 10 correct chords
- Game over screen shows after losing all 5 lives
- Play Again returns to start screen
- Progression mode toggle changes chord selection behavior
- Audio feedback sounds play on correct/incorrect

---

### Milestone 5: Navigation and Integration

**Goal**: Add bidirectional navigation between arpeggiator and game modes.

**Preconditions**: Game mode fully functional (M1-M4)

**Modifications**:

`neural-arpeggiator/src/index.html` — add before closing `</div>` of `.container`:
```html
<div class="mode-switch">
  <a href="game.html">Switch to Chord Training Game</a>
</div>
```

`neural-arpeggiator/src/style.css` — append:
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

`game.html` already includes a link back to `index.html` in the start screen.

**Success Criteria**:
- Arpeggiator page shows game link at bottom
- Game start screen shows arpeggiator link
- Both navigate correctly
- Existing arpeggiator functionality unaffected

---

### Milestone 6: Polish and Edge Case Handling

**Goal**: Harden the game against edge cases and improve UX.

**Preconditions**: All core functionality working (M1-M5)

**Actions**:
1. Add incorrect cooldown debounce (1200ms)
2. Add "hear chord again" button
3. Defensive chord selection (skip if chordToMidiNotes returns empty)
4. Clear held notes on chord transition
5. Ensure AudioContext resumes on first click

**Cooldown implementation**:
```javascript
let incorrectCooldown = false;

function onIncorrect() {
  if (incorrectCooldown) return;
  incorrectCooldown = true;
  setTimeout(() => { incorrectCooldown = false; }, 1200);
  // ... rest of handler
}
```

**Defensive chord selection**:
```javascript
function nextChord() {
  let chord = C.getRandomChord(state.tier);
  let midiNotes = C.chordToMidiNotes(chord);
  let attempts = 0;
  while (midiNotes.length === 0 && attempts < 10) {
    chord = C.getRandomChord(state.tier);
    midiNotes = C.chordToMidiNotes(chord);
    attempts++;
  }
  if (midiNotes.length === 0) {
    console.warn('Could not resolve any chord for tier', state.tier);
    return;
  }
  // ... continue with this chord
}
```

**Success Criteria**:
- Rapid wrong key presses only count as one life lost
- "Hear again" button replays the target chord
- No console errors for any chord in the database
- AudioContext resumes on first user interaction

---

### Milestone 7: End-to-End Validation

**Goal**: Comprehensive manual testing of all game features.

**Test Matrix** (25 tests):

| # | Test Case | Input | Expected Result |
|---|-----------|-------|-----------------|
| T01 | Start screen renders | Open game.html | 4 tier buttons, MIDI status, arpeggiator link visible |
| T02 | MIDI detection | Connect MIDI keyboard | Status shows device name |
| T03 | No MIDI fallback | No MIDI device | Status shows "Use computer keyboard" |
| T04 | Start game (Tier 1) | Click "Beginner" | HUD shows, chord + keyboard highlights appear |
| T05 | Correct chord (MIDI) | Play C major on MIDI | Green flash, "+N" popup, combo increments |
| T06 | Correct chord (QWERTY) | Press A+F+J keys | Same as T05 |
| T07 | Correct chord (mouse) | Click C+E+G keys | Same as T05 |
| T08 | Wrong chord | Play wrong notes | Red flash, "Wrong!" text, life lost |
| T09 | Timer expiry | Wait for countdown | "Time's up!" text, life lost |
| T10 | Combo multiplier | 3 correct in a row | "3x combo" display, score multiplied |
| T11 | All lives lost | Miss 5 times | Game Over screen with stats |
| T12 | Play Again | Click "Play Again" | Returns to start screen |
| T13 | Level up | Complete 10 chords | "Level 2!" feedback, timer shorter |
| T14 | Tier 2 chords | Start as Intermediate | Pool includes dim/aug chords |
| T15 | Tier 3 chords | Start as Advanced | Seventh chords with 4-note targets |
| T16 | Tier 4 chords | Start as Expert | Extended chords with 5+ note targets |
| T17 | Progression mode | Toggle + start | Chords follow progression sequence |
| T18 | Octave agnostic | Play C major in octave 5 | Still matches C major target |
| T19 | Note doubling | Play C3+C4+E4+G4 | Still matches C major (dedup pitch classes) |
| T20 | Hear again button | Click speaker button | Target chord replays |
| T21 | Navigate to arpeggiator | Click link in game | Opens index.html |
| T22 | Navigate to game | Click link in arpeggiator | Opens game.html |
| T23 | Arpeggiator still works | Play chord in arpeggiator | RNN generates arpeggiation |
| T24 | Audio context | Click any button | Audio plays (not blocked) |
| T25 | Timer visual states | Watch timer | Purple → orange (40%) → red flash (20%) |

---

## Milestone Dependency Graph

```
M0 (Pre-flight)
 |
 v
M1 (shared.js)
 |
 v
M2 (chords-db.js)    M3 (game.html + game.css)
 \                   /
  \                 /    [M2 + M3 can be parallel, both depend on M1]
   \               /
    v             v
    M4 (game.js) ---- depends on M1, M2, M3
     |
     v
    M5 (Navigation)    M6 (Polish)
     \                /    [M5 + M6 can be parallel, both depend on M4]
      \              /
       v            v
       M7 (Validation) -- depends on M5, M6
```

**Critical path**: M0 → M1 → M2 → M3 → M4 → M6 → M7

---

## File Inventory

### Files to CREATE

| File | Path | Lines | Purpose |
|------|------|-------|---------|
| `shared.js` | `neural-arpeggiator/src/shared.js` | ~230 | Chordessy namespace with reusable utilities |
| `chords-db.js` | `neural-arpeggiator/src/chords-db.js` | ~150 | Chord definitions, progressions, query functions |
| `game.html` | `neural-arpeggiator/src/game.html` | ~90 | Game entry point HTML |
| `game.css` | `neural-arpeggiator/src/game.css` | ~200 | Game-specific styles |
| `game.js` | `neural-arpeggiator/src/game.js` | ~310 | Game engine |

### Files to MODIFY

| File | Path | Change |
|------|------|--------|
| `index.html` | `neural-arpeggiator/src/index.html` | Add `.mode-switch` link div |
| `style.css` | `neural-arpeggiator/src/style.css` | Add `.mode-switch` styles |

### Files NOT MODIFIED

| File | Path | Reason |
|------|------|--------|
| `script.js` | `neural-arpeggiator/src/script.js` | Arpeggiator logic untouched |
| `dist/*` | `neural-arpeggiator/dist/` | Distribution files unchanged |

---

## Commit Plan

| # | Message | Files | Milestone |
|---|---------|-------|-----------|
| 1 | `feat: extract shared utilities for keyboard, MIDI, audio, chord detection` | `shared.js` | M1 |
| 2 | `feat: add chord database with 4 difficulty tiers and pitch class data` | `chords-db.js` | M2 |
| 3 | `feat: add game HTML entry point and CSS styles` | `game.html`, `game.css` | M3 |
| 4 | `feat: add core game engine with scoring, lives, timer, and chord matching` | `game.js` | M4 |
| 5 | `feat: add navigation links between arpeggiator and game modes` | `index.html`, `style.css` | M5 |
| 6 | `fix: add cooldown debounce, defensive chord selection, hear-again button` | `game.js`, `game.html` | M6 |
| 7 | `chore: final integration verification` | (no file changes if clean) | M7 |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Tonal.js v1.x API incompatibility | High | Hardcode all pitch classes instead of runtime resolution |
| Tone.js API differences via Magenta bundle | Medium | Test `mm.Player.tone` access pattern in browser before building game engine |
| WebMidi v2 event binding race | Medium | Bind on `connected` event + initial scan |
| CDN rawgit deprecation | Low | URLs still resolve; migrate to jsDelivr in future |
| Chord matching false positives | Medium | Comprehensive test matrix (T18, T19) verifies edge cases |
| AudioContext blocked by browser | Low | `StartAudioContext` library + user click gate |

---

## Open Questions (Resolved During Planning)

1. **Q: Use Tonal.js runtime chord resolution or hardcoded pitch classes?**
   A: Hardcoded pitch classes. The rawgit CDN version of Tonal is v1.x and lacks `Chord.get()`.

2. **Q: Modify `script.js` to use `shared.js`?**
   A: No. The arpeggiator works as-is. `shared.js` re-implements the same functions independently.

3. **Q: Use the same CDN versions as the existing project?**
   A: Yes. `game.html` uses the exact same CDN URLs as `dist/index.html`.

## Future Enhancements (Not in This Plan)

- **Phase 2**: Computer vision for finger placement (MediaPipe Hands)
- **Spaced repetition**: SM-2 algorithm for personalized chord review
- **Leaderboard**: LocalStorage high scores
- **VexFlow notation**: Show chords on a musical staff at higher levels
- **Import from Chordonomicon**: Parse full chord database CSV for richer content
- **Inversion detection**: Check specific voicings, not just pitch classes
- **Mobile support**: Touch-optimized keyboard layout
- **Sustain pedal handling**: MIDI CC 64 to clear held notes
- **Key transposition**: Show chords in all 12 keys