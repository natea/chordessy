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
          'Dm7': ['D', 'F', 'A', 'C'], 'Am7': ['A', 'C', 'E', 'G']
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

/** Simulate pressing the exact target chord notes via mouse click on keyboard keys. */
function playTargetChord() {
  const state = window.Chordessy.game.state;
  const targetMidi = state.targetMidi;
  targetMidi.forEach(note => {
    const idx = note - window.Chordessy.MIN_NOTE;
    const keyEl = document.querySelectorAll('#game-keyboard .key')[idx];
    if (keyEl) {
      keyEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  let rafId = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    return ++rafId;
  });
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

describe('Combo counter shows and multiplies score (T026h)', () => {

  // --- Combo display visibility ---

  test('combo display is hidden when combo is 0 (game start)', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const comboDisplay = document.getElementById('combo-display');
    expect(comboDisplay.style.display).toBe('none');
  });

  test('combo display is hidden after first correct chord (combo = 1)', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playTargetChord();

    const comboDisplay = document.getElementById('combo-display');
    expect(comboDisplay.style.display).toBe('none');
  });

  test('combo display becomes visible after second consecutive correct chord (combo = 2)', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // First correct chord
    playTargetChord();
    jest.runAllTimers();

    // Second correct chord
    playTargetChord();

    const comboDisplay = document.getElementById('combo-display');
    expect(comboDisplay.style.display).toBe('');
  });

  test('combo count text shows the current combo number', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // First correct
    playTargetChord();
    jest.runAllTimers();

    // Second correct
    playTargetChord();

    const comboCount = document.getElementById('combo-count');
    expect(comboCount.textContent).toBe('2');
  });

  test('combo count updates to 3 after three consecutive correct chords', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    for (let i = 0; i < 3; i++) {
      playTargetChord();
      if (i < 2) jest.runAllTimers();
    }

    const comboCount = document.getElementById('combo-count');
    expect(comboCount.textContent).toBe('3');
  });

  // --- Combo resets ---

  test('combo display hides after an incorrect chord breaks the streak', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Build a combo of 2
    playTargetChord();
    jest.runAllTimers();
    playTargetChord();
    expect(document.getElementById('combo-display').style.display).toBe('');

    // Advance to next chord
    jest.runAllTimers();

    // Play wrong notes to break combo
    const wrongNote = 60; // Just press a single note (won't match any chord fully)
    const idx = wrongNote - window.Chordessy.MIN_NOTE;
    const keys = document.querySelectorAll('#game-keyboard .key');
    // Press enough wrong notes to trigger onIncorrect (need >= targetMidi.length)
    const targetLen = window.Chordessy.game.state.targetMidi.length;
    const wrongNotes = [];
    for (let i = 0; i < targetLen; i++) {
      // Pick notes that definitely don't match target pitch classes
      const note = 61 + i; // C#4, D4, D#4 - unlikely to match a chord target
      wrongNotes.push(note);
      const keyIdx = note - window.Chordessy.MIN_NOTE;
      if (keys[keyIdx]) {
        keys[keyIdx].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      }
    }

    expect(window.Chordessy.game.state.combo).toBe(0);
    expect(document.getElementById('combo-display').style.display).toBe('none');
  });

  // --- Score multiplication ---

  test('first correct chord scores base + time bonus with 1x multiplier', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Answer immediately for max time bonus
    performance.now.mockReturnValue(0);
    playTargetChord();

    // combo=1, so multiplier=1: (100 + 50) * 1 = 150
    expect(window.Chordessy.game.state.score).toBe(150);
  });

  test('second consecutive correct chord scores with 2x multiplier', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    performance.now.mockReturnValue(0);
    playTargetChord();
    const firstScore = window.Chordessy.game.state.score; // 150

    jest.runAllTimers();

    performance.now.mockReturnValue(0);
    playTargetChord();
    const secondPoints = window.Chordessy.game.state.score - firstScore;

    // combo=2, so multiplier=2: (100 + 50) * 2 = 300
    expect(secondPoints).toBe(300);
  });

  test('third consecutive correct chord scores with 3x multiplier', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    performance.now.mockReturnValue(0);
    playTargetChord();
    jest.runAllTimers();

    performance.now.mockReturnValue(0);
    playTargetChord();
    const scoreAfterTwo = window.Chordessy.game.state.score;
    jest.runAllTimers();

    performance.now.mockReturnValue(0);
    playTargetChord();
    const thirdPoints = window.Chordessy.game.state.score - scoreAfterTwo;

    // combo=3, so multiplier=3: (100 + 50) * 3 = 450
    expect(thirdPoints).toBe(450);
  });

  test('combo multiplier is capped at 10x', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Play 11 consecutive correct chords
    let prevScore = 0;
    for (let i = 0; i < 11; i++) {
      performance.now.mockReturnValue(0);
      playTargetChord();
      if (i < 10) jest.runAllTimers();
    }

    // After 11th chord, combo=11 but multiplier capped at 10
    const scoreAfterTen = (() => {
      // Calculate expected total: sum of (150 * min(i, 10)) for i=1..11
      let total = 0;
      for (let i = 1; i <= 11; i++) {
        total += 150 * Math.min(i, 10);
      }
      return total;
    })();

    expect(window.Chordessy.game.state.combo).toBe(11);
    expect(window.Chordessy.game.state.score).toBe(scoreAfterTen);
  });

  // --- Score display integration ---

  test('HUD score reflects combo-multiplied score after consecutive correct chords', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    performance.now.mockReturnValue(0);
    playTargetChord();
    jest.runAllTimers();

    performance.now.mockReturnValue(0);
    playTargetChord();

    // Total: 150 + 300 = 450
    const scoreEl = document.getElementById('score');
    expect(parseInt(scoreEl.textContent, 10)).toBe(450);
  });

  test('feedback-score popup shows combo-multiplied points', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    performance.now.mockReturnValue(0);
    playTargetChord();
    jest.runAllTimers();

    performance.now.mockReturnValue(0);
    playTargetChord();

    // Second chord should show +300
    const feedbackScore = document.getElementById('feedback-score');
    expect(feedbackScore.textContent).toBe('+300');
  });

  // --- Best combo tracking ---

  test('bestCombo tracks the highest combo reached', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Build combo to 3
    for (let i = 0; i < 3; i++) {
      playTargetChord();
      jest.runAllTimers();
    }

    expect(window.Chordessy.game.state.bestCombo).toBe(3);
  });

  test('bestCombo is preserved after combo resets', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Build combo to 2
    playTargetChord();
    jest.runAllTimers();
    playTargetChord();
    jest.runAllTimers();

    expect(window.Chordessy.game.state.bestCombo).toBe(2);

    // Break combo with wrong notes
    const keys = document.querySelectorAll('#game-keyboard .key');
    const targetLen = window.Chordessy.game.state.targetMidi.length;
    for (let i = 0; i < targetLen; i++) {
      const note = 61 + i;
      const keyIdx = note - window.Chordessy.MIN_NOTE;
      if (keys[keyIdx]) {
        keys[keyIdx].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      }
    }

    // combo resets but bestCombo stays
    expect(window.Chordessy.game.state.combo).toBe(0);
    expect(window.Chordessy.game.state.bestCombo).toBe(2);
  });

  // --- Combo with time bonus interaction ---

  test('combo multiplier applies to both base score and time bonus', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // First chord: answer at 5s of 10s (half time = 25 time bonus)
    performance.now.mockReturnValue(5000);
    playTargetChord();
    const firstScore = window.Chordessy.game.state.score;
    // combo=1: (100 + 25) * 1 = 125
    expect(firstScore).toBe(125);

    // nextChord is scheduled via setTimeout; set time so timerStart = 10000
    performance.now.mockReturnValue(10000);
    jest.runAllTimers();

    // Answer second chord 5s into its timer (timerStart=10000, now=15000)
    performance.now.mockReturnValue(15000);
    playTargetChord();
    const secondPoints = window.Chordessy.game.state.score - firstScore;
    // combo=2: (100 + 25) * 2 = 250
    expect(secondPoints).toBe(250);
  });
});
