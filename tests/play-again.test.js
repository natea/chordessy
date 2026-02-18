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

let rafCallbacks = [];
let rafId = 0;

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

/** Flush all queued RAF callbacks once, simulating one animation frame. */
function flushRAF() {
  const pending = rafCallbacks.slice();
  rafCallbacks = [];
  pending.forEach(cb => cb());
}

/** Lose all 5 lives via timeouts and trigger game over screen. */
function loseAllLivesViaTimeout() {
  let baseTime = 0;
  for (let i = 0; i < 5; i++) {
    performance.now.mockReturnValue(baseTime + 10001);
    flushRAF();

    if (i < 4) {
      baseTime += 10001 + 1200;
      performance.now.mockReturnValue(baseTime);
      jest.runAllTimers();
    }
  }
  // Flush feedback timeout to trigger gameOver()
  jest.runAllTimers();
}

beforeEach(() => {
  jest.useFakeTimers();
  rafId = 0;
  rafCallbacks = [];
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    rafCallbacks.push(cb);
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

describe('Play Again returns to start screen (T026k)', () => {

  // --- Core behavior: Play Again hides game-over and shows start screen ---

  test('clicking Play Again hides game-over screen', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    const gameOverScreen = document.getElementById('game-over-screen');
    expect(gameOverScreen.style.display).not.toBe('none');

    document.getElementById('play-again-btn').click();

    expect(gameOverScreen.style.display).toBe('none');
  });

  test('clicking Play Again shows start screen', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    const startScreen = document.getElementById('start-screen');
    expect(startScreen.style.display).toBe('none');

    document.getElementById('play-again-btn').click();

    expect(startScreen.style.display).toBe('');
  });

  // --- Start screen is fully interactive after Play Again ---

  test('start screen difficulty buttons are clickable after Play Again', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    document.getElementById('play-again-btn').click();

    // Click a different tier to start a new game
    document.querySelector('.start-btn[data-tier="2"]').click();

    const state = window.Chordessy.game.state;
    expect(state.running).toBe(true);
    expect(state.tier).toBe(2);
  });

  test('can start a new game with same tier after Play Again', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    document.getElementById('play-again-btn').click();

    document.querySelector('.start-btn[data-tier="1"]').click();

    const state = window.Chordessy.game.state;
    expect(state.running).toBe(true);
    expect(state.tier).toBe(1);
  });

  // --- State resets on new game after Play Again ---

  test('score resets to 0 when starting new game after Play Again', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Play a correct chord to accumulate score
    const state = window.Chordessy.game.state;
    state.targetMidi.forEach(note => {
      const idx = note - window.Chordessy.MIN_NOTE;
      const keyEl = document.querySelectorAll('#game-keyboard .key')[idx];
      if (keyEl) keyEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    jest.runAllTimers();

    expect(state.score).toBeGreaterThan(0);

    // Lose remaining lives
    let baseTime = 2000;
    for (let i = 0; i < 4; i++) {
      performance.now.mockReturnValue(baseTime + 10001);
      flushRAF();
      if (i < 3) {
        baseTime += 10001 + 1200;
        performance.now.mockReturnValue(baseTime);
        jest.runAllTimers();
      }
    }
    jest.runAllTimers();

    document.getElementById('play-again-btn').click();
    document.querySelector('.start-btn[data-tier="1"]').click();

    expect(state.score).toBe(0);
  });

  test('lives reset to 5 when starting new game after Play Again', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    expect(window.Chordessy.game.state.lives).toBe(0);

    document.getElementById('play-again-btn').click();
    document.querySelector('.start-btn[data-tier="1"]').click();

    expect(window.Chordessy.game.state.lives).toBe(5);
  });

  test('combo resets to 0 when starting new game after Play Again', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    document.getElementById('play-again-btn').click();
    document.querySelector('.start-btn[data-tier="1"]').click();

    expect(window.Chordessy.game.state.combo).toBe(0);
    expect(window.Chordessy.game.state.bestCombo).toBe(0);
  });

  test('level resets to 1 when starting new game after Play Again', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    document.getElementById('play-again-btn').click();
    document.querySelector('.start-btn[data-tier="1"]').click();

    expect(window.Chordessy.game.state.level).toBe(1);
  });

  // --- Game-over screen stays hidden during new game ---

  test('game-over screen remains hidden after starting new game via Play Again', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    document.getElementById('play-again-btn').click();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const gameOverScreen = document.getElementById('game-over-screen');
    expect(gameOverScreen.style.display).toBe('none');
  });

  test('start screen is hidden after starting new game via Play Again', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    document.getElementById('play-again-btn').click();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const startScreen = document.getElementById('start-screen');
    expect(startScreen.style.display).toBe('none');
  });
});
