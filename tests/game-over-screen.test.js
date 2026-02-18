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

/** Play the wrong chord by pressing keys that don't match the target. */
function playWrongChord() {
  const state = window.Chordessy.game.state;
  const targetPcs = new Set(state.targetMidi.map(n => n % 12));
  const keys = document.querySelectorAll('#game-keyboard .key');
  const needed = state.targetMidi.length;
  let played = 0;
  // Walk from the top of the keyboard down to find notes whose pitch class
  // doesn't match the target, ensuring we trigger onIncorrect.
  for (let i = keys.length - 1; i >= 0 && played < needed; i--) {
    const midi = window.Chordessy.MIN_NOTE + i;
    if (!targetPcs.has(midi % 12)) {
      keys[i].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      played++;
    }
  }
}

/** Play the correct chord by pressing the target MIDI notes. */
function playTargetChord() {
  const state = window.Chordessy.game.state;
  state.targetMidi.forEach(note => {
    const idx = note - window.Chordessy.MIN_NOTE;
    const keyEl = document.querySelectorAll('#game-keyboard .key')[idx];
    if (keyEl) {
      keyEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }
  });
}

/** Release all held keys. */
function releaseAllKeys() {
  const state = window.Chordessy.game.state;
  [...state.heldNotes].forEach(note => {
    const idx = note - window.Chordessy.MIN_NOTE;
    const keyEl = document.querySelectorAll('#game-keyboard .key')[idx];
    if (keyEl) {
      keyEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }
  });
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

describe('Losing all lives shows game over screen with stats (T026j)', () => {

  // --- Game over screen visibility ---

  test('game over screen is visible after losing all lives via timeouts', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    const gameOverScreen = document.getElementById('game-over-screen');
    expect(gameOverScreen.style.display).not.toBe('none');
  });

  test('game over screen is hidden during active gameplay', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const gameOverScreen = document.getElementById('game-over-screen');
    expect(gameOverScreen.style.display).toBe('none');
  });

  // --- Stats display: score ---

  test('final score displays the accumulated score', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Play one correct chord to build some score
    playTargetChord();
    jest.runAllTimers();

    const scoreAfterCorrect = window.Chordessy.game.state.score;
    expect(scoreAfterCorrect).toBeGreaterThan(0);

    // Now lose all remaining lives via timeouts (4 lives left)
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

    const finalScore = document.getElementById('final-score');
    expect(finalScore.textContent).toBe(String(scoreAfterCorrect));
  });

  test('final score shows 0 when no correct chords were played', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    const finalScore = document.getElementById('final-score');
    expect(finalScore.textContent).toBe('0');
  });

  // --- Stats display: correct count ---

  test('stat-correct shows number of correct chords played', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Play one correct chord
    playTargetChord();
    jest.runAllTimers();

    // Lose remaining 4 lives
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

    const statCorrect = document.getElementById('stat-correct');
    expect(statCorrect.textContent).toBe('1');
  });

  test('stat-correct shows 0 when no correct chords were played', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    const statCorrect = document.getElementById('stat-correct');
    expect(statCorrect.textContent).toBe('0');
  });

  // --- Stats display: missed count ---

  test('stat-missed shows 5 when all lives lost via timeouts', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    const statMissed = document.getElementById('stat-missed');
    expect(statMissed.textContent).toBe('5');
  });

  test('stat-missed reflects only missed chords, not correct ones', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Play one correct chord then release keys
    playTargetChord();
    releaseAllKeys();

    // Advance past feedback to load next chord
    performance.now.mockReturnValue(1300);
    jest.runAllTimers();
    // Flush any RAF from next chord's startTimer
    flushRAF();

    expect(window.Chordessy.game.state.correct).toBe(1);
    expect(window.Chordessy.game.state.missed).toBe(0);

    // Now lose all 4 remaining lives via timeout (lives=5, lost 0 so far, need 4 timeouts + game over should show after 5th loss? No: we still have 5 lives, correct doesn't lose a life)
    // After 1 correct: lives=5, correct=1, missed=0
    // Need to lose all 5 lives via timeout = 5 timeouts for 5 missed
    // But we want to show that correct count is 1 and missed is 5 (total chords = 6)
    // Actually: the task says "losing all lives" - correct chords don't cost lives
    // So after 1 correct, still have 5 lives, need 5 timeouts to game over
    let baseTime = 1300;
    for (let i = 0; i < 5; i++) {
      baseTime += 10001;
      performance.now.mockReturnValue(baseTime);
      flushRAF();

      if (i < 4) {
        baseTime += 1200;
        performance.now.mockReturnValue(baseTime);
        jest.runAllTimers();
      }
    }
    jest.runAllTimers();

    const statCorrect = document.getElementById('stat-correct');
    const statMissed = document.getElementById('stat-missed');
    expect(statCorrect.textContent).toBe('1');
    expect(statMissed.textContent).toBe('5');
  });

  // --- Stats display: best combo ---

  test('stat-combo shows 0 when no correct chords were played', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    const statCombo = document.getElementById('stat-combo');
    expect(statCombo.textContent).toBe('0');
  });

  test('stat-combo shows best combo achieved during the game', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Play two correct chords to build a combo of 2
    playTargetChord();
    jest.runAllTimers();
    playTargetChord();
    jest.runAllTimers();

    expect(window.Chordessy.game.state.bestCombo).toBe(2);

    // Now lose remaining 3 lives via timeout (combo resets but bestCombo stays)
    let baseTime = 4000;
    for (let i = 0; i < 3; i++) {
      performance.now.mockReturnValue(baseTime + 10001);
      flushRAF();

      if (i < 2) {
        baseTime += 10001 + 1200;
        performance.now.mockReturnValue(baseTime);
        jest.runAllTimers();
      }
    }
    jest.runAllTimers();

    const statCombo = document.getElementById('stat-combo');
    expect(statCombo.textContent).toBe('2');
  });

  // --- Game state after game over ---

  test('game state running is false after game over', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    expect(window.Chordessy.game.state.running).toBe(false);
  });

  test('lives are 0 after game over', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    expect(window.Chordessy.game.state.lives).toBe(0);
  });

  // --- Play Again button ---

  test('play again button hides game over screen and shows start screen', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    loseAllLivesViaTimeout();

    const gameOverScreen = document.getElementById('game-over-screen');
    const startScreen = document.getElementById('start-screen');
    expect(gameOverScreen.style.display).not.toBe('none');

    document.getElementById('play-again-btn').click();

    expect(gameOverScreen.style.display).toBe('none');
    expect(startScreen.style.display).toBe('');
  });

  // --- Game over via wrong chords ---

  test('game over screen shows after losing all lives via wrong chords', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    for (let i = 0; i < 5; i++) {
      playWrongChord();

      // Clear cooldown and advance to allow next wrong attempt
      jest.runAllTimers();
      releaseAllKeys();
    }

    const gameOverScreen = document.getElementById('game-over-screen');
    expect(gameOverScreen.style.display).not.toBe('none');
  });

  test('stats are correct after losing all lives via wrong chords', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    for (let i = 0; i < 5; i++) {
      playWrongChord();
      jest.runAllTimers();
      releaseAllKeys();
    }

    expect(document.getElementById('final-score').textContent).toBe('0');
    expect(document.getElementById('stat-correct').textContent).toBe('0');
    expect(document.getElementById('stat-missed').textContent).toBe('5');
    expect(document.getElementById('stat-combo').textContent).toBe('0');
  });
});
