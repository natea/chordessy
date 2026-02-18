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
        // Simple note name to MIDI: C4=60, D4=62, E4=64, F4=65, G4=67, A4=69, B4=71
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
        // Return note names for common chords used in tier 1
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

  // Load shared.js, chords-db.js, and game.js in order
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

  // Trigger DOMContentLoaded to run game init()
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

beforeEach(() => {
  jest.useFakeTimers();
  // Mock requestAnimationFrame / cancelAnimationFrame
  let rafId = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    return ++rafId;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  // Mock performance.now
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

describe('Clicking a difficulty tier starts the game (T026c)', () => {

  // --- Start screen hides when a tier button is clicked ---

  test('clicking tier 1 button hides the start screen', () => {
    loadGameModules();
    const startScreen = document.getElementById('start-screen');
    expect(startScreen.style.display).not.toBe('none');

    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    expect(startScreen.style.display).toBe('none');
  });

  test('clicking tier 2 button hides the start screen', () => {
    loadGameModules();
    const startScreen = document.getElementById('start-screen');

    const btn = document.querySelector('.start-btn[data-tier="2"]');
    btn.click();

    expect(startScreen.style.display).toBe('none');
  });

  test('clicking tier 3 button hides the start screen', () => {
    loadGameModules();
    const startScreen = document.getElementById('start-screen');

    const btn = document.querySelector('.start-btn[data-tier="3"]');
    btn.click();

    expect(startScreen.style.display).toBe('none');
  });

  test('clicking tier 4 button hides the start screen', () => {
    loadGameModules();
    const startScreen = document.getElementById('start-screen');

    const btn = document.querySelector('.start-btn[data-tier="4"]');
    btn.click();

    expect(startScreen.style.display).toBe('none');
  });

  // --- Game state is initialized on start ---

  test('game state is running after clicking a tier button', () => {
    loadGameModules();
    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    expect(window.Chordessy.game.state.running).toBe(true);
  });

  test('score resets to 0 on game start', () => {
    loadGameModules();
    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    expect(window.Chordessy.game.state.score).toBe(0);
    expect(document.getElementById('score').textContent).toBe('0');
  });

  test('lives are set to 5 on game start', () => {
    loadGameModules();
    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    expect(window.Chordessy.game.state.lives).toBe(5);
  });

  test('level starts at 1', () => {
    loadGameModules();
    const btn = document.querySelector('.start-btn[data-tier="2"]');
    btn.click();

    expect(window.Chordessy.game.state.level).toBe(1);
    expect(document.getElementById('level-num').textContent).toBe('1');
  });

  test('combo starts at 0', () => {
    loadGameModules();
    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    expect(window.Chordessy.game.state.combo).toBe(0);
  });

  // --- Tier is set correctly ---

  test.each([
    [1, 'Triads'],
    [2, 'All Triads'],
    [3, 'Sevenths'],
    [4, 'Extended'],
  ])('clicking tier %i sets tier badge to "%s"', (tier, badgeText) => {
    loadGameModules();
    const btn = document.querySelector(`.start-btn[data-tier="${tier}"]`);
    btn.click();

    expect(window.Chordessy.game.state.tier).toBe(tier);
    expect(document.getElementById('tier-badge').textContent).toBe(badgeText);
  });

  // --- Lives are rendered as hearts ---

  test('5 heart elements are rendered in lives container on start', () => {
    loadGameModules();
    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    const hearts = document.querySelectorAll('#lives-container .life');
    expect(hearts.length).toBe(5);
    // None should be lost initially
    const lostHearts = document.querySelectorAll('#lives-container .life.lost');
    expect(lostHearts.length).toBe(0);
  });

  // --- Chord challenge is presented after start ---

  test('chord name is displayed after starting the game', () => {
    loadGameModules();
    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    const chordName = document.getElementById('chord-name');
    // Should show a valid chord name from the tier 1 pool
    expect(chordName.textContent).not.toBe('');
    const validTier1Names = ['C major', 'F major', 'G major', 'A minor', 'D minor', 'E minor'];
    expect(validTier1Names).toContain(chordName.textContent);
  });

  test('chord notes are displayed after starting the game', () => {
    loadGameModules();
    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    const chordNotes = document.getElementById('chord-notes');
    // Should contain note names separated by ' - '
    expect(chordNotes.textContent).toMatch(/.+ - .+/);
  });

  test('hear-again button is visible after starting the game', () => {
    loadGameModules();
    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    const hearAgain = document.getElementById('hear-again-btn');
    expect(hearAgain.style.display).not.toBe('none');
  });

  // --- Game-over screen stays hidden on start ---

  test('game-over screen remains hidden on game start', () => {
    loadGameModules();
    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    const gameOver = document.getElementById('game-over-screen');
    expect(gameOver.style.display).toBe('none');
  });

  // --- Progression mode respects checkbox ---

  test('progression mode is off when checkbox is unchecked', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = false;

    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    expect(window.Chordessy.game.state.progressionMode).toBe(false);
  });

  test('progression mode is on when checkbox is checked', () => {
    loadGameModules();
    const checkbox = document.getElementById('progression-mode');
    checkbox.checked = true;

    const btn = document.querySelector('.start-btn[data-tier="1"]');
    btn.click();

    expect(window.Chordessy.game.state.progressionMode).toBe(true);
  });
});
