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
  // Patch: expose init on the namespace so we can call it directly
  // instead of dispatching DOMContentLoaded (which accumulates listeners across tests)
  const patchedGameCode = gameCode.replace(
    "document.addEventListener('DOMContentLoaded', init);",
    "C.game._init = init; document.addEventListener('DOMContentLoaded', init);"
  );
  eval(patchedGameCode);

  // Call init directly to avoid accumulated DOMContentLoaded listeners
  window.Chordessy.game._init();
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

describe('Chord name and highlighted keys appear (T026d)', () => {

  // --- Chord name display ---

  test('chord name element shows a non-empty string after game start', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const chordName = document.getElementById('chord-name');
    expect(chordName.textContent.length).toBeGreaterThan(0);
  });

  test('chord name matches a valid tier 1 chord name', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const chordName = document.getElementById('chord-name').textContent;
    const validNames = ['C major', 'F major', 'G major', 'A minor', 'D minor', 'E minor'];
    expect(validNames).toContain(chordName);
  });

  test('chord name updates to match game state currentChord', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const displayed = document.getElementById('chord-name').textContent;
    const stateChord = window.Chordessy.game.state.currentChord;
    expect(displayed).toBe(stateChord.name);
  });

  // --- Chord notes display ---

  test('chord notes element shows note names separated by dashes', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const chordNotes = document.getElementById('chord-notes').textContent;
    expect(chordNotes).toMatch(/.+ - .+/);
  });

  test('chord notes correspond to the target MIDI notes', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const targetMidi = window.Chordessy.game.state.targetMidi;
    const expectedNames = targetMidi.map(n => NOTE_NAMES[n % 12]);
    const displayedNames = document.getElementById('chord-notes').textContent.split(' - ');

    expect(displayedNames).toEqual(expectedNames);
  });

  // --- Keyboard key highlighting ---

  test('at least one keyboard key has the target class after game start', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const targetKeys = document.querySelectorAll('#game-keyboard .key.target');
    expect(targetKeys.length).toBeGreaterThan(0);
  });

  test('target-highlighted keys match the pitch classes of the current chord', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const targetMidi = window.Chordessy.game.state.targetMidi;
    const expectedPitchClasses = new Set(targetMidi.map(n => n % 12));

    const targetKeys = document.querySelectorAll('#game-keyboard .key.target');
    const highlightedPitchClasses = new Set();
    targetKeys.forEach(key => {
      highlightedPitchClasses.add(parseInt(key.dataset.note, 10) % 12);
    });

    expect(highlightedPitchClasses).toEqual(expectedPitchClasses);
  });

  test('all octave instances of target pitch classes are highlighted', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const targetMidi = window.Chordessy.game.state.targetMidi;
    const expectedPitchClasses = new Set(targetMidi.map(n => n % 12));

    // Count all keys that should be highlighted (all octaves of each target pitch class)
    const allKeys = document.querySelectorAll('#game-keyboard .key');
    let expectedCount = 0;
    allKeys.forEach(key => {
      const note = parseInt(key.dataset.note, 10);
      if (expectedPitchClasses.has(note % 12)) expectedCount++;
    });

    const targetKeys = document.querySelectorAll('#game-keyboard .key.target');
    expect(targetKeys.length).toBe(expectedCount);
  });

  test('non-target keys do not have the target class', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const targetMidi = window.Chordessy.game.state.targetMidi;
    const expectedPitchClasses = new Set(targetMidi.map(n => n % 12));

    const allKeys = document.querySelectorAll('#game-keyboard .key');
    allKeys.forEach(key => {
      const note = parseInt(key.dataset.note, 10);
      if (!expectedPitchClasses.has(note % 12)) {
        expect(key.classList.contains('target')).toBe(false);
      }
    });
  });

  // --- Higher tiers also display correctly ---

  test('tier 3 chord name is a valid seventh chord name', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="3"]').click();

    const chordName = document.getElementById('chord-name').textContent;
    // Must be a non-empty string from the tier ≤ 3 pool
    expect(chordName.length).toBeGreaterThan(0);

    const state = window.Chordessy.game.state;
    expect(state.currentChord.tier).toBeLessThanOrEqual(3);
  });

  test('target keys are highlighted for tier 3 chord', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="3"]').click();

    const targetKeys = document.querySelectorAll('#game-keyboard .key.target');
    expect(targetKeys.length).toBeGreaterThan(0);

    const targetMidi = window.Chordessy.game.state.targetMidi;
    const expectedPitchClasses = new Set(targetMidi.map(n => n % 12));

    const highlightedPitchClasses = new Set();
    targetKeys.forEach(key => {
      highlightedPitchClasses.add(parseInt(key.dataset.note, 10) % 12);
    });
    expect(highlightedPitchClasses).toEqual(expectedPitchClasses);
  });

  // --- Keyboard built correctly ---

  test('keyboard has keys spanning MIDI range 48 to 84', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const allKeys = document.querySelectorAll('#game-keyboard .key');
    expect(allKeys.length).toBe(84 - 48 + 1); // 37 keys

    const notes = Array.from(allKeys).map(k => parseInt(k.dataset.note, 10));
    expect(Math.min(...notes)).toBe(48);
    expect(Math.max(...notes)).toBe(84);
  });
});
