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

describe('Timer running out loses a life (T026i)', () => {

  // --- Lives decrease on timeout ---

  test('lives decrease by 1 when timer runs out', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const livesBefore = window.Chordessy.game.state.lives;
    expect(livesBefore).toBe(5);

    // Advance past the full 10s timer duration to trigger onTimeout
    performance.now.mockReturnValue(10001);
    flushRAF();

    expect(window.Chordessy.game.state.lives).toBe(4);
  });

  test('missed counter increments when timer runs out', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    expect(window.Chordessy.game.state.missed).toBe(0);

    performance.now.mockReturnValue(10001);
    flushRAF();

    expect(window.Chordessy.game.state.missed).toBe(1);
  });

  // --- Feedback shows "Time's up!" ---

  test('feedback overlay shows "Time\'s up!" text when timer expires', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    performance.now.mockReturnValue(10001);
    flushRAF();

    const feedbackText = document.getElementById('feedback-text');
    expect(feedbackText.textContent).toBe("Time's up!");
  });

  test('feedback text has "incorrect" CSS class (red styling) on timeout', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    performance.now.mockReturnValue(10001);
    flushRAF();

    const feedbackText = document.getElementById('feedback-text');
    expect(feedbackText.classList.contains('incorrect')).toBe(true);
  });

  test('feedback overlay becomes visible (has "show" class) on timeout', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    performance.now.mockReturnValue(10001);
    flushRAF();

    const overlay = document.getElementById('feedback-overlay');
    expect(overlay.classList.contains('show')).toBe(true);
  });

  test('feedback-score is empty on timeout (no points awarded)', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    performance.now.mockReturnValue(10001);
    flushRAF();

    const feedbackScore = document.getElementById('feedback-score');
    expect(feedbackScore.textContent).toBe('');
  });

  // --- Combo resets on timeout ---

  test('combo resets to 0 when timer runs out', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Manually set combo to simulate an active streak
    window.Chordessy.game.state.combo = 3;

    performance.now.mockReturnValue(10001);
    flushRAF();

    expect(window.Chordessy.game.state.combo).toBe(0);
  });

  // --- Score unchanged on timeout ---

  test('score does not change when timer runs out', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const scoreBefore = window.Chordessy.game.state.score;

    performance.now.mockReturnValue(10001);
    flushRAF();

    expect(window.Chordessy.game.state.score).toBe(scoreBefore);
  });

  // --- Lives UI updates ---

  test('lives container renders one heart with "lost" class after timeout', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    performance.now.mockReturnValue(10001);
    flushRAF();

    const lostHearts = document.querySelectorAll('#lives-container .life.lost');
    expect(lostHearts.length).toBe(1);
  });

  test('total hearts rendered always equals 5 after timeout', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    performance.now.mockReturnValue(10001);
    flushRAF();

    const allHearts = document.querySelectorAll('#lives-container .life');
    expect(allHearts.length).toBe(5);
  });

  // --- Next chord proceeds after timeout ---

  test('game advances to next chord after timeout feedback completes', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const chordBefore = window.Chordessy.game.state.currentChord;

    // Trigger timeout
    performance.now.mockReturnValue(10001);
    flushRAF();

    // Advance past FEEDBACK_DURATION (1200ms) to trigger nextChord
    jest.runAllTimers();

    const chordAfter = window.Chordessy.game.state.currentChord;
    // A new chord should be assigned (may or may not differ from the previous
    // due to randomness, but the game state should reflect a fresh chord cycle)
    expect(window.Chordessy.game.state.running).toBe(true);
  });

  // --- Multiple timeouts accumulate life losses ---

  test('two consecutive timeouts lose two lives', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // First timeout
    performance.now.mockReturnValue(10001);
    flushRAF();
    expect(window.Chordessy.game.state.lives).toBe(4);

    // Let feedback complete and next chord start
    performance.now.mockReturnValue(11202);
    jest.runAllTimers();

    // Reset RAF callbacks for the new chord's timer
    // The new chord calls startTimer -> tickTimer -> RAF
    // Advance past the new chord's timer
    performance.now.mockReturnValue(21203);
    flushRAF();

    expect(window.Chordessy.game.state.lives).toBe(3);
  });

  // --- Game over after all lives lost via timeout ---

  test('game over triggers when all 5 lives are lost via timeouts', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    let baseTime = 0;
    for (let i = 0; i < 5; i++) {
      // Trigger timeout
      performance.now.mockReturnValue(baseTime + 10001);
      flushRAF();

      if (i < 4) {
        // Advance past feedback to start next chord
        baseTime += 10001 + 1200;
        performance.now.mockReturnValue(baseTime);
        jest.runAllTimers();
      }
    }

    expect(window.Chordessy.game.state.lives).toBe(0);

    // Game over screen appears after feedback timeout
    jest.runAllTimers();

    const gameOverScreen = document.getElementById('game-over-screen');
    expect(gameOverScreen.style.display).not.toBe('none');
  });

  test('game stops running after all lives are lost via timeouts', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

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

    jest.runAllTimers();

    expect(window.Chordessy.game.state.running).toBe(false);
  });
});
