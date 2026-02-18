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

/** Simulate pressing the exact target chord notes via QWERTY-equivalent noteOn. */
function playTargetChord() {
  const state = window.Chordessy.game.state;
  const targetMidi = state.targetMidi;
  // Dispatch keydown events for notes that map to the target pitch classes
  // We use the MIDI notes directly since the game tracks heldNotes by MIDI number
  targetMidi.forEach(note => {
    // Simulate noteOn by adding to heldNotes and triggering checkChord via keyboard click
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

describe('Playing correct chord triggers green feedback + score (T026f)', () => {

  // --- Green feedback text ---

  test('feedback overlay shows "Correct!" text after playing the correct chord', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playTargetChord();

    const feedbackText = document.getElementById('feedback-text');
    expect(feedbackText.textContent).toBe('Correct!');
  });

  test('feedback text has the "correct" CSS class (green styling)', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playTargetChord();

    const feedbackText = document.getElementById('feedback-text');
    expect(feedbackText.classList.contains('correct')).toBe(true);
  });

  test('feedback overlay becomes visible (has "show" class)', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playTargetChord();

    const overlay = document.getElementById('feedback-overlay');
    expect(overlay.classList.contains('show')).toBe(true);
  });

  // --- Score increases ---

  test('score increases from 0 after playing the correct chord', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const scoreBefore = window.Chordessy.game.state.score;
    expect(scoreBefore).toBe(0);

    playTargetChord();

    expect(window.Chordessy.game.state.score).toBeGreaterThan(0);
  });

  test('HUD score display updates after correct chord', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playTargetChord();

    const scoreEl = document.getElementById('score');
    const displayedScore = parseInt(scoreEl.textContent, 10);
    expect(displayedScore).toBeGreaterThan(0);
    expect(displayedScore).toBe(window.Chordessy.game.state.score);
  });

  test('feedback-score element shows the points earned (e.g. "+150")', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playTargetChord();

    const feedbackScore = document.getElementById('feedback-score');
    expect(feedbackScore.textContent).toMatch(/^\+\d+$/);
  });

  // --- Score calculation ---

  test('base score is at least 100 points for a correct chord', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playTargetChord();

    expect(window.Chordessy.game.state.score).toBeGreaterThanOrEqual(100);
  });

  test('time bonus increases score when answered quickly', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Answer immediately (0 seconds elapsed = max time bonus)
    performance.now.mockReturnValue(0);
    playTargetChord();
    const fastScore = window.Chordessy.game.state.score;

    // fastScore should include base (100) + full time bonus (50) * combo(1) = 150
    expect(fastScore).toBe(150);
  });

  test('score is lower when more time has elapsed', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Answer near end of timer (9 seconds of 10 elapsed)
    performance.now.mockReturnValue(9000);
    playTargetChord();
    const slowScore = window.Chordessy.game.state.score;

    // With only 1s remaining out of 10s, time bonus should be small
    // Base 100 + round(1/10 * 50) = 100 + 5 = 105 * combo(1) = 105
    expect(slowScore).toBe(105);
  });

  // --- Correct counter ---

  test('correct counter increments after each correct chord', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    expect(window.Chordessy.game.state.correct).toBe(0);

    playTargetChord();

    expect(window.Chordessy.game.state.correct).toBe(1);
  });

  // --- Keyboard key turns green ---

  test('target keys get "correct" class (green) after playing the right chord', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const targetMidi = window.Chordessy.game.state.targetMidi;
    playTargetChord();

    targetMidi.forEach(note => {
      const idx = note - window.Chordessy.MIN_NOTE;
      const keyEl = document.querySelectorAll('#game-keyboard .key')[idx];
      expect(keyEl.classList.contains('correct')).toBe(true);
    });
  });

  // --- Score popup ---

  test('a score popup element is added to the DOM after correct chord', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playTargetChord();

    const popup = document.querySelector('.score-popup');
    expect(popup).not.toBeNull();
    expect(popup.textContent).toMatch(/^\+\d+$/);
  });

  // --- Timer stops on correct answer ---

  test('timer is cancelled after correct chord (no further RAF scheduling)', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playTargetChord();

    // cancelAnimationFrame should have been called
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  // --- Combo system ---

  test('combo increments on consecutive correct chords', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    expect(window.Chordessy.game.state.combo).toBe(0);

    // First correct chord
    playTargetChord();
    expect(window.Chordessy.game.state.combo).toBe(1);

    // Advance to next chord
    jest.runAllTimers();

    // Second correct chord
    playTargetChord();
    expect(window.Chordessy.game.state.combo).toBe(2);
  });

  test('combo multiplier increases score for consecutive correct answers', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // First correct chord at t=0
    performance.now.mockReturnValue(0);
    playTargetChord();
    const firstScore = window.Chordessy.game.state.score;

    // Advance to next chord
    jest.runAllTimers();

    // Second correct chord at t=0 relative (timer restarted)
    performance.now.mockReturnValue(0);
    // nextChord resets timerStart, but we need to re-mock performance.now to
    // what it was when nextChord was called; the state.timerStart is set there
    playTargetChord();
    const secondScore = window.Chordessy.game.state.score - firstScore;

    // secondScore should be (100 + 50) * 2 = 300 due to combo = 2
    expect(secondScore).toBe(300);
  });
});
