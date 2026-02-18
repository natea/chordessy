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

/** Play notes that do NOT match the target chord — guaranteed wrong. */
function playWrongNotes() {
  const state = window.Chordessy.game.state;
  const targetPitchClasses = new Set(state.targetMidi.map(n => n % 12));
  const allKeys = document.querySelectorAll('#game-keyboard .key');

  // Gather notes that are NOT in the target pitch classes
  const wrongNotes = [];
  allKeys.forEach(keyEl => {
    const note = parseInt(keyEl.dataset.note, 10);
    if (!targetPitchClasses.has(note % 12)) {
      wrongNotes.push({ note, el: keyEl });
    }
  });

  // Press enough wrong notes to match the target length (triggers checkChord)
  const count = state.targetMidi.length;
  for (let i = 0; i < count && i < wrongNotes.length; i++) {
    wrongNotes[i].el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  }
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

describe('Playing wrong notes triggers red feedback + life lost (T026g)', () => {

  // --- Red feedback text ---

  test('feedback overlay shows "Wrong!" text after playing wrong notes', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playWrongNotes();

    const feedbackText = document.getElementById('feedback-text');
    expect(feedbackText.textContent).toBe('Wrong!');
  });

  test('feedback text has the "incorrect" CSS class (red styling)', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playWrongNotes();

    const feedbackText = document.getElementById('feedback-text');
    expect(feedbackText.classList.contains('incorrect')).toBe(true);
  });

  test('feedback overlay becomes visible (has "show" class) after wrong notes', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playWrongNotes();

    const overlay = document.getElementById('feedback-overlay');
    expect(overlay.classList.contains('show')).toBe(true);
  });

  // --- Life lost ---

  test('lives decrease by 1 after playing wrong notes', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const livesBefore = window.Chordessy.game.state.lives;
    expect(livesBefore).toBe(5);

    playWrongNotes();

    expect(window.Chordessy.game.state.lives).toBe(4);
  });

  test('lives container renders one heart with "lost" class after a wrong answer', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playWrongNotes();

    const lostHearts = document.querySelectorAll('#lives-container .life.lost');
    expect(lostHearts.length).toBe(1);
  });

  test('total hearts rendered always equals INITIAL_LIVES (5)', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playWrongNotes();

    const allHearts = document.querySelectorAll('#lives-container .life');
    expect(allHearts.length).toBe(5);
  });

  // --- Missed counter ---

  test('missed counter increments after wrong notes', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    expect(window.Chordessy.game.state.missed).toBe(0);

    playWrongNotes();

    expect(window.Chordessy.game.state.missed).toBe(1);
  });

  // --- Combo reset ---

  test('combo resets to 0 after wrong notes', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Manually set combo to simulate streak
    window.Chordessy.game.state.combo = 3;

    playWrongNotes();

    expect(window.Chordessy.game.state.combo).toBe(0);
  });

  // --- Score unchanged ---

  test('score does not change after playing wrong notes', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const scoreBefore = window.Chordessy.game.state.score;

    playWrongNotes();

    expect(window.Chordessy.game.state.score).toBe(scoreBefore);
  });

  // --- Wrong key highlights ---

  test('pressed wrong keys get the "wrong" CSS class (red highlight)', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playWrongNotes();

    const wrongKeys = document.querySelectorAll('#game-keyboard .key.wrong');
    expect(wrongKeys.length).toBeGreaterThan(0);
  });

  test('wrong key highlights are only on the pressed keys, not target keys', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const targetPitchClasses = new Set(
      window.Chordessy.game.state.targetMidi.map(n => n % 12)
    );

    playWrongNotes();

    const wrongKeys = document.querySelectorAll('#game-keyboard .key.wrong');
    wrongKeys.forEach(key => {
      const note = parseInt(key.dataset.note, 10);
      // Wrong-highlighted keys should NOT be target pitch classes
      expect(targetPitchClasses.has(note % 12)).toBe(false);
    });
  });

  // --- Wrong cooldown ---

  test('wrong cooldown prevents multiple life losses from rapid wrong presses', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playWrongNotes();
    expect(window.Chordessy.game.state.lives).toBe(4);

    // Release notes and press wrong again immediately (within cooldown)
    const allKeys = document.querySelectorAll('#game-keyboard .key');
    allKeys.forEach(k => k.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));

    playWrongNotes();
    // Should still be 4 because of cooldown protection
    expect(window.Chordessy.game.state.lives).toBe(4);
  });

  test('wrongCooldown flag is set after incorrect answer', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playWrongNotes();

    expect(window.Chordessy.game.state.wrongCooldown).toBe(true);
  });

  // --- Feedback score is empty for wrong answers ---

  test('feedback-score element is empty after wrong notes (no points shown)', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    playWrongNotes();

    const feedbackScore = document.getElementById('feedback-score');
    expect(feedbackScore.textContent).toBe('');
  });

  // --- Game over after all lives lost ---

  test('game over triggers when all 5 lives are lost', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Lose all 5 lives
    for (let i = 0; i < 5; i++) {
      window.Chordessy.game.state.wrongCooldown = false;
      playWrongNotes();
    }

    expect(window.Chordessy.game.state.lives).toBe(0);

    // Game over screen appears after feedback timeout
    jest.runAllTimers();

    const gameOverScreen = document.getElementById('game-over-screen');
    expect(gameOverScreen.style.display).not.toBe('none');
  });

  test('game stops running after all lives are lost', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    for (let i = 0; i < 5; i++) {
      window.Chordessy.game.state.wrongCooldown = false;
      playWrongNotes();
    }

    jest.runAllTimers();

    expect(window.Chordessy.game.state.running).toBe(false);
  });
});
