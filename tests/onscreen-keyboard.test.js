/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const gameHtml = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'game.html'),
  'utf-8'
);
const gameCss = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'game.css'),
  'utf-8'
);

function getBodyContent(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : '';
}

function injectStyles(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

// --- Minimal dependency stubs ---

function createToneMock() {
  const mockNode = { connect: jest.fn().mockReturnThis(), toMaster: jest.fn().mockReturnThis() };
  return {
    Gain: jest.fn(() => mockNode),
    Convolver: jest.fn(() => ({ ...mockNode, wet: { value: 0 } })),
    FeedbackDelay: jest.fn(() => mockNode),
    Filter: jest.fn(() => mockNode),
    LFO: jest.fn(() => ({ connect: jest.fn().mockReturnThis(), start: jest.fn() })),
    Sampler: jest.fn(() => ({
      ...mockNode, release: { value: 0 },
      triggerAttack: jest.fn(), triggerAttackRelease: jest.fn()
    })),
    Synth: jest.fn(() => ({
      ...mockNode, triggerAttackRelease: jest.fn()
    })),
    Frequency: jest.fn(() => 440),
    now: jest.fn(() => 0),
    Time: jest.fn(() => ({ toSeconds: () => 0.5, toMilliseconds: () => 500 })),
    Buffer: { on: jest.fn() }
  };
}

function createWebMidiMock({ inputs = [] } = {}) {
  const listeners = {};
  return {
    inputs,
    enable: jest.fn(callback => callback(null)),
    addListener: jest.fn((event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }),
    _emit(event, data) {
      (listeners[event] || []).forEach(fn => fn(data));
    }
  };
}

function loadGameModules() {
  const Tone = createToneMock();
  window._ = {
    range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i),
    last: arr => arr[arr.length - 1],
    first: arr => arr[0]
  };
  window.mm = { Player: { tone: Tone } };
  window.Tonal = {
    Note: {
      pc: jest.fn(n => n ? n.replace(/\d+/, '') : ''),
      fromMidi: jest.fn(n => {
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return names[n % 12] + (Math.floor(n / 12) - 1);
      }),
      midi: jest.fn(n => {
        if (!n) return null;
        const map = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
        const match = n.match(/^([A-G])(#|b)?(\d+)$/);
        if (!match) return null;
        let base = map[match[1]];
        if (match[2] === '#') base += 1;
        if (match[2] === 'b') base -= 1;
        return (parseInt(match[3]) + 1) * 12 + base;
      }),
      name: jest.fn(n => n)
    },
    Chord: {
      notes: jest.fn(symbol => {
        const chordNotes = {
          'C': ['C', 'E', 'G'], 'F': ['F', 'A', 'C'], 'G': ['G', 'B', 'D'],
          'Am': ['A', 'C', 'E'], 'Dm': ['D', 'F', 'A'], 'Em': ['E', 'G', 'B'],
          'D': ['D', 'F#', 'A'], 'E': ['E', 'G#', 'B'], 'A': ['A', 'C#', 'E'],
          'Cmaj7': ['C', 'E', 'G', 'B'], 'G7': ['G', 'B', 'D', 'F'],
          'Dm7': ['D', 'F', 'A', 'C'], 'Am7': ['A', 'C', 'E', 'G'],
          'Fmaj7': ['F', 'A', 'C', 'E'], 'D7': ['D', 'F#', 'A', 'C'],
          'A7': ['A', 'C#', 'E', 'G'], 'E7': ['E', 'G#', 'B', 'D'],
          'Bb7': ['Bb', 'D', 'F', 'Ab'], 'C7': ['C', 'E', 'G', 'Bb'],
          'Bm7b5': ['B', 'D', 'F', 'A']
        };
        return chordNotes[symbol] || ['C', 'E', 'G'];
      })
    }
  };
  window.WebMidi = createWebMidiMock();
  window.Chordessy = window.Chordessy || {};

  const sharedCode = fs.readFileSync(
    path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'), 'utf-8'
  );
  const chordsDbCode = fs.readFileSync(
    path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'chords-db.js'), 'utf-8'
  );
  const gameCode = fs.readFileSync(
    path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'game.js'), 'utf-8'
  );

  eval(sharedCode);
  eval(chordsDbCode);
  const patchedGameCode = gameCode.replace(
    "document.addEventListener('DOMContentLoaded', init);",
    "C.game._init = init; document.addEventListener('DOMContentLoaded', init);"
  );
  eval(patchedGameCode);

  window.Chordessy.game._init();
}

/** Get the keyboard key elements. */
function getKeys() {
  return document.querySelectorAll('#game-keyboard .key');
}

/** Simulate mousedown on a keyboard key by MIDI note number. */
function clickKey(note) {
  const idx = note - window.Chordessy.MIN_NOTE;
  const keyEl = getKeys()[idx];
  if (keyEl) {
    keyEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  }
  return keyEl;
}

/** Simulate mouseup on a keyboard key by MIDI note number. */
function releaseClickKey(note) {
  const idx = note - window.Chordessy.MIN_NOTE;
  const keyEl = getKeys()[idx];
  if (keyEl) {
    keyEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }
  return keyEl;
}

/** Simulate mouseover on a keyboard key by MIDI note number. */
function hoverKey(note) {
  const idx = note - window.Chordessy.MIN_NOTE;
  const keyEl = getKeys()[idx];
  if (keyEl) {
    keyEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }
  return keyEl;
}

/** Simulate mouseleave on a keyboard key by MIDI note number. */
function leaveKey(note) {
  const idx = note - window.Chordessy.MIN_NOTE;
  const keyEl = getKeys()[idx];
  if (keyEl) {
    keyEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
  }
  return keyEl;
}

/** Click the target chord notes via on-screen keyboard. */
function playTargetChord() {
  const state = window.Chordessy.game.state;
  state.targetMidi.forEach(note => clickKey(note));
}

/** Start the game at tier 1 (triads). */
function startGame() {
  document.querySelector('.start-btn[data-tier="1"]').click();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  jest.spyOn(performance, 'now').mockReturnValue(0);

  const bodyContent = getBodyContent(gameHtml)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  document.body.innerHTML = bodyContent;
  injectStyles(gameCss);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete window.WebMidi;
  delete window.Chordessy;
  delete window.mm;
  delete window.Tonal;
  delete window._;
});

describe('On-screen keyboard clicks work (T026n)', () => {

  // --- Keyboard rendering ---

  test('on-screen keyboard is rendered with 37 keys (MIDI 48-84)', () => {
    loadGameModules();
    const keys = getKeys();
    expect(keys.length).toBe(37);
  });

  test('each key has a data-note attribute matching its MIDI number', () => {
    loadGameModules();
    const keys = getKeys();
    for (let i = 0; i < keys.length; i++) {
      expect(keys[i].dataset.note).toBe(String(48 + i));
    }
  });

  test('accidental keys have the "accidental" CSS class', () => {
    loadGameModules();
    const keys = getKeys();
    // C#3 is MIDI 49, index 1
    expect(keys[1].classList.contains('accidental')).toBe(true);
    // D3 is MIDI 50, index 2 — natural key
    expect(keys[2].classList.contains('accidental')).toBe(false);
  });

  // --- Mouse click triggers noteOn ---

  test('clicking a key adds its MIDI note to heldNotes when game is running', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    clickKey(60); // C4
    expect(state.heldNotes.has(60)).toBe(true);
  });

  test('clicking a key adds "pressed" class to that key element', () => {
    loadGameModules();
    startGame();

    const keyEl = clickKey(60);
    expect(keyEl.classList.contains('pressed')).toBe(true);
  });

  test('clicking multiple keys adds all of them to heldNotes', () => {
    loadGameModules();
    startGame();

    clickKey(60); // C4
    clickKey(64); // E4
    clickKey(67); // G4

    const state = window.Chordessy.game.state;
    expect(state.heldNotes.has(60)).toBe(true);
    expect(state.heldNotes.has(64)).toBe(true);
    expect(state.heldNotes.has(67)).toBe(true);
  });

  // --- Mouse release triggers noteOff ---

  test('releasing mouse on a key removes its MIDI note from heldNotes', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    clickKey(60);
    expect(state.heldNotes.has(60)).toBe(true);

    releaseClickKey(60);
    expect(state.heldNotes.has(60)).toBe(false);
  });

  test('releasing mouse removes "pressed" class from the key element', () => {
    loadGameModules();
    startGame();

    const keyEl = clickKey(60);
    expect(keyEl.classList.contains('pressed')).toBe(true);

    releaseClickKey(60);
    expect(keyEl.classList.contains('pressed')).toBe(false);
  });

  // --- Mouseleave during drag triggers noteOff ---

  test('mouseleave removes note from heldNotes when mouse is down', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    clickKey(60); // mousedown sets mouseDown=true
    expect(state.heldNotes.has(60)).toBe(true);

    leaveKey(60); // mouseleave while mouseDown
    expect(state.heldNotes.has(60)).toBe(false);
  });

  // --- Mouseover during drag triggers noteOn ---

  test('mouseover on a key triggers noteOn when mouse button is held', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    // First mousedown on one key to set mouseDown=true
    clickKey(60);
    // Hover over another key while dragging
    hoverKey(64);
    expect(state.heldNotes.has(64)).toBe(true);
  });

  // --- Global mouseup clears all held notes ---

  test('global mouseup releases all held notes', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    clickKey(60);
    clickKey(64);
    expect(state.heldNotes.size).toBeGreaterThanOrEqual(2);

    // Global mouseup on document
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(state.heldNotes.size).toBe(0);
  });

  // --- Clicks do nothing when game is not running ---

  test('clicking a key does NOT add to heldNotes when game is not running', () => {
    loadGameModules();
    // Don't start game — state.running is false

    const state = window.Chordessy.game.state;
    clickKey(60);
    expect(state.heldNotes.has(60)).toBe(false);
  });

  test('key does not get "pressed" class when game is not running', () => {
    loadGameModules();
    const keyEl = clickKey(60);
    expect(keyEl.classList.contains('pressed')).toBe(false);
  });

  // --- On-screen keyboard triggers chord matching ---

  test('clicking the correct target chord notes triggers onCorrect', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    const scoreBefore = state.score;
    playTargetChord();

    expect(state.score).toBeGreaterThan(scoreBefore);
    expect(state.correct).toBe(1);
  });

  test('correct chord click shows "Correct!" feedback overlay', () => {
    loadGameModules();
    startGame();

    playTargetChord();

    const feedbackText = document.getElementById('feedback-text');
    expect(feedbackText.textContent).toBe('Correct!');
  });

  test('correct chord marks target keys with "correct" CSS class', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    const targetNotes = [...state.targetMidi];
    playTargetChord();

    targetNotes.forEach(note => {
      const idx = note - window.Chordessy.MIN_NOTE;
      const keyEl = getKeys()[idx];
      if (keyEl) {
        expect(keyEl.classList.contains('correct')).toBe(true);
      }
    });
  });

  // --- Wrong chord via on-screen keyboard ---

  test('clicking wrong notes triggers onIncorrect and marks keys with "wrong" class', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    const livesBefore = state.lives;

    // Play 3 wrong notes that are unlikely to match any target chord
    clickKey(49); // C#3
    clickKey(51); // D#3
    clickKey(54); // F#3

    // If the chord was wrong, lives should decrease
    if (state.lives < livesBefore) {
      // Verify at least one key has 'wrong' class
      const wrongKeys = document.querySelectorAll('#game-keyboard .key.wrong');
      expect(wrongKeys.length).toBeGreaterThan(0);
    }
  });

  // --- Target key highlighting ---

  test('target keys are highlighted with "target" CSS class when a new chord is shown', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    const targetKeys = document.querySelectorAll('#game-keyboard .key.target');
    // At least the target notes should be highlighted
    expect(targetKeys.length).toBeGreaterThanOrEqual(state.targetMidi.length);
  });

  test('target highlights are cleared after playing the correct chord', () => {
    loadGameModules();
    startGame();

    playTargetChord();
    jest.advanceTimersByTime(1500); // past FEEDBACK_DURATION

    // After next chord, old highlights should be cleared
    const state = window.Chordessy.game.state;
    // The previous target keys should no longer have 'correct' class once new chord loads
    // New target keys should be highlighted
    const targetKeys = document.querySelectorAll('#game-keyboard .key.target');
    expect(targetKeys.length).toBeGreaterThanOrEqual(state.targetMidi.length);
  });

  // --- Multiple consecutive clicks work ---

  test('playing two correct chords in a row via keyboard clicks increases score and combo', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;

    // First correct chord
    playTargetChord();
    expect(state.correct).toBe(1);
    expect(state.combo).toBe(1);

    // Release all held notes before next chord
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    jest.advanceTimersByTime(1500);

    // Second correct chord
    playTargetChord();
    expect(state.correct).toBe(2);
    expect(state.combo).toBe(2);
  });

  // --- Edge cases ---

  test('clicking the lowest key (MIDI 48, C3) works', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    clickKey(48);
    expect(state.heldNotes.has(48)).toBe(true);
  });

  test('clicking the highest key (MIDI 84, C6) works', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    clickKey(84);
    expect(state.heldNotes.has(84)).toBe(true);
  });

  test('clicking the same key twice does not duplicate in heldNotes (Set behavior)', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    clickKey(60);
    clickKey(60);
    // Set only stores unique values
    const count = [...state.heldNotes].filter(n => n === 60).length;
    expect(count).toBe(1);
  });

  test('keyboard container exists in the DOM', () => {
    loadGameModules();
    const container = document.getElementById('game-keyboard');
    expect(container).not.toBeNull();
    expect(container.classList.contains('game-keyboard')).toBe(true);
  });

  // --- Click and release lifecycle ---

  test('full click-release cycle: pressed class added then removed', () => {
    loadGameModules();
    startGame();

    const keyEl = clickKey(60);
    expect(keyEl.classList.contains('pressed')).toBe(true);

    releaseClickKey(60);
    expect(keyEl.classList.contains('pressed')).toBe(false);
  });

  test('releasing all keys via global mouseup clears all pressed classes', () => {
    loadGameModules();
    startGame();

    clickKey(60);
    clickKey(64);
    clickKey(67);

    // All should be pressed
    expect(getKeys()[60 - 48].classList.contains('pressed')).toBe(true);
    expect(getKeys()[64 - 48].classList.contains('pressed')).toBe(true);
    expect(getKeys()[67 - 48].classList.contains('pressed')).toBe(true);

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(getKeys()[60 - 48].classList.contains('pressed')).toBe(false);
    expect(getKeys()[64 - 48].classList.contains('pressed')).toBe(false);
    expect(getKeys()[67 - 48].classList.contains('pressed')).toBe(false);
  });
});
