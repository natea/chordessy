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
  eval(gameCode);

  document.dispatchEvent(new Event('DOMContentLoaded'));
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

describe('Progression mode works when toggled (T026l)', () => {

  // --- Toggling ON: progression state is initialized ---

  test('enabling progression mode sets a current progression on game start', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const state = window.Chordessy.game.state;
    expect(state.progressionMode).toBe(true);
    expect(state.currentProgression).not.toBeNull();
    expect(state.currentProgression.chords).toBeInstanceOf(Array);
    expect(state.currentProgression.chords.length).toBeGreaterThan(0);
  });

  test('progression info element is visible when progression mode is on', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const info = document.getElementById('progression-info');
    expect(info.style.display).not.toBe('none');
  });

  test('progression info shows progression name and position', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const info = document.getElementById('progression-info');
    const state = window.Chordessy.game.state;
    // Should show "Name (1/N)" format
    expect(info.textContent).toContain(state.currentProgression.name);
    expect(info.textContent).toMatch(/\(1\/\d+\)/);
  });

  test('first chord comes from the progression sequence', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const state = window.Chordessy.game.state;
    const firstChordSymbol = state.currentProgression.chords[0];
    expect(state.currentChord.symbol).toBe(firstChordSymbol);
  });

  test('progressionIndex advances to 1 after first chord is set', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const state = window.Chordessy.game.state;
    expect(state.progressionIndex).toBe(1);
  });

  // --- Toggling OFF: random mode, no progression info ---

  test('disabling progression mode uses random chords', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = false;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const state = window.Chordessy.game.state;
    expect(state.progressionMode).toBe(false);
    expect(state.currentProgression).toBeNull();
  });

  test('progression info is hidden when progression mode is off', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = false;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const info = document.getElementById('progression-info');
    expect(info.style.display).toBe('none');
  });

  // --- Progression-selected chords belong to correct tier ---

  test('progression selected for tier 1 only contains tier 1 chords', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const state = window.Chordessy.game.state;
    // All tier-1 progressions use tier-1 chord symbols
    const tier1Symbols = ['C', 'F', 'G', 'Am', 'Dm', 'Em'];
    state.currentProgression.chords.forEach(symbol => {
      expect(tier1Symbols).toContain(symbol);
    });
  });

  test('progression selected for tier 3 has a valid tier', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="3"]').click();

    const state = window.Chordessy.game.state;
    expect(state.currentProgression.tier).toBeLessThanOrEqual(3);
  });

  // --- Progression advances through chords in order ---

  test('answering correctly advances to the next chord in progression', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const state = window.Chordessy.game.state;
    const progression = state.currentProgression;
    const secondChordSymbol = progression.chords[1];

    // Simulate a correct answer by playing the right notes
    state.targetMidi.forEach(note => state.heldNotes.add(note));
    // Trigger checkChord via the exposed nextChord after correct
    // Instead, directly simulate the correct flow:
    // The game checks on noteOn, so we simulate the match
    window.Chordessy.game.nextChord();

    // After nextChord, progressionIndex should advance
    if (progression.chords.length > 1) {
      expect(state.currentChord.symbol).toBe(secondChordSymbol);
      expect(state.progressionIndex).toBe(2);
    }
  });

  // --- Progression wraps around when exhausted ---

  test('new progression starts when current one is exhausted', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const state = window.Chordessy.game.state;
    const firstProgression = state.currentProgression;

    // Exhaust all chords in current progression by calling nextChord
    for (let i = 1; i < firstProgression.chords.length; i++) {
      window.Chordessy.game.nextChord();
    }

    // Now call nextChord one more time to trigger a new progression
    window.Chordessy.game.nextChord();

    // A new progression should have been selected (or the same one re-selected)
    expect(state.currentProgression).not.toBeNull();
    expect(state.progressionIndex).toBe(1); // just played the first chord of the new one
  });

  // --- Progression info updates on each chord ---

  test('progression info updates position on each chord', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const info = document.getElementById('progression-info');
    const state = window.Chordessy.game.state;
    const total = state.currentProgression.chords.length;

    // After start, should show "1/N"
    expect(info.textContent).toContain('1/' + total);

    // Advance to next chord
    window.Chordessy.game.nextChord();
    expect(info.textContent).toContain('2/' + total);
  });

  // --- Progression info hidden on game over ---

  test('progression info is hidden after game over', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const info = document.getElementById('progression-info');
    expect(info.style.display).not.toBe('none');

    // Lose all lives via timeouts
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

    expect(info.style.display).toBe('none');
  });

  // --- Toggling between modes across games ---

  test('switching from progression to random mode between games works', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');

    // First game: progression on
    checkbox.checked = true;
    document.querySelector('.start-btn[data-tier="1"]').click();
    expect(window.Chordessy.game.state.progressionMode).toBe(true);
    expect(window.Chordessy.game.state.currentProgression).not.toBeNull();

    // Lose all lives
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

    // Go back to start screen
    document.getElementById('play-again-btn').click();

    // Second game: progression off
    checkbox.checked = false;
    performance.now.mockReturnValue(0);
    document.querySelector('.start-btn[data-tier="1"]').click();

    const state = window.Chordessy.game.state;
    expect(state.progressionMode).toBe(false);
    expect(state.currentProgression).toBeNull();
    expect(document.getElementById('progression-info').style.display).toBe('none');
  });

  test('switching from random to progression mode between games works', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');

    // First game: progression off
    checkbox.checked = false;
    document.querySelector('.start-btn[data-tier="1"]').click();
    expect(window.Chordessy.game.state.progressionMode).toBe(false);

    // Lose all lives
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

    document.getElementById('play-again-btn').click();

    // Second game: progression on
    checkbox.checked = true;
    performance.now.mockReturnValue(0);
    document.querySelector('.start-btn[data-tier="1"]').click();

    const state = window.Chordessy.game.state;
    expect(state.progressionMode).toBe(true);
    expect(state.currentProgression).not.toBeNull();
    expect(document.getElementById('progression-info').style.display).not.toBe('none');
  });

  // --- Progression name comes from the database ---

  test('progression has a valid name from the database', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    document.querySelector('.start-btn[data-tier="1"]').click();

    const state = window.Chordessy.game.state;
    const validNames = window.Chordessy.PROGRESSIONS.map(p => p.name);
    expect(validNames).toContain(state.currentProgression.name);
  });
});
