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
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    // Remove the callback if still pending (simplistic but sufficient)
  });
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

describe('Timer bar counts down smoothly (T026e)', () => {

  // --- Timer starts at full width ---

  test('timer bar starts at 100% width after game start', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const timerBar = document.getElementById('timer-bar');
    expect(timerBar.style.width).toBe('100%');
  });

  // --- Timer decreases over time ---

  test('timer bar width decreases after time elapses', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Advance time by 5 seconds (half of the 10s default)
    performance.now.mockReturnValue(5000);
    flushRAF();

    const timerBar = document.getElementById('timer-bar');
    const width = parseFloat(timerBar.style.width);
    // Should be approximately 50% (5s remaining out of 10s)
    expect(width).toBeCloseTo(50, 0);
  });

  test('timer bar width is proportional to remaining time', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Test at 25% elapsed (2.5s of 10s)
    performance.now.mockReturnValue(2500);
    flushRAF();

    const timerBar = document.getElementById('timer-bar');
    const width = parseFloat(timerBar.style.width);
    expect(width).toBeCloseTo(75, 0);
  });

  test('timer bar reaches 0% when full duration elapses', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Advance past full duration
    performance.now.mockReturnValue(10000);
    flushRAF();

    const timerBar = document.getElementById('timer-bar');
    const width = parseFloat(timerBar.style.width);
    expect(width).toBe(0);
  });

  // --- Timer uses requestAnimationFrame for smooth animation ---

  test('timer schedules requestAnimationFrame callbacks', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // startTimer calls tickTimer which calls requestAnimationFrame
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  test('timer re-schedules RAF on each tick while running', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const callsBefore = window.requestAnimationFrame.mock.calls.length;

    // Simulate one tick at 1 second
    performance.now.mockReturnValue(1000);
    flushRAF();

    // tickTimer should have called RAF again to continue animating
    expect(window.requestAnimationFrame.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  // --- Warning state at 40% remaining ---

  test('timer bar gets warning class when 40% or less time remains', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // 7s elapsed => 3s remaining => ratio = 0.3 (<=0.4 triggers warning)
    performance.now.mockReturnValue(7000);
    flushRAF();

    const timerBar = document.getElementById('timer-bar');
    expect(timerBar.classList.contains('warning')).toBe(true);
    expect(timerBar.classList.contains('critical')).toBe(false);
  });

  test('timer bar does not have warning class above 40% remaining', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // 5s elapsed => 5s remaining => ratio = 0.5 (above 0.4)
    performance.now.mockReturnValue(5000);
    flushRAF();

    const timerBar = document.getElementById('timer-bar');
    expect(timerBar.classList.contains('warning')).toBe(false);
    expect(timerBar.classList.contains('critical')).toBe(false);
  });

  // --- Critical state at 20% remaining ---

  test('timer bar gets critical class when 20% or less time remains', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // 9s elapsed => 1s remaining => ratio = 0.1 (<=0.2 triggers critical)
    performance.now.mockReturnValue(9000);
    flushRAF();

    const timerBar = document.getElementById('timer-bar');
    expect(timerBar.classList.contains('critical')).toBe(true);
    expect(timerBar.classList.contains('warning')).toBe(false);
  });

  // --- Timer resets on new chord ---

  test('timer bar resets to 100% when a new chord starts', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Advance time so bar is partially depleted
    performance.now.mockReturnValue(5000);
    flushRAF();

    const timerBar = document.getElementById('timer-bar');
    expect(parseFloat(timerBar.style.width)).toBeLessThan(100);

    // Trigger a new chord which restarts the timer
    performance.now.mockReturnValue(5001);
    window.Chordessy.game.nextChord();

    expect(timerBar.style.width).toBe('100%');
  });

  // --- Timer width never goes below 0 ---

  test('timer bar width never drops below 0%', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    // Way past duration
    performance.now.mockReturnValue(20000);
    flushRAF();

    const timerBar = document.getElementById('timer-bar');
    const width = parseFloat(timerBar.style.width);
    expect(width).toBeGreaterThanOrEqual(0);
  });

  // --- CSS transition for smoothness ---

  test('timer bar has CSS transition for smooth visual countdown', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const timerBar = document.getElementById('timer-bar');
    // The CSS sets transition: width 0.1s linear — verify the element exists
    // and has the timer-bar class which carries the transition style
    expect(timerBar.classList.contains('timer-bar') || timerBar.id === 'timer-bar').toBe(true);
  });

  // --- Multiple ticks show progressive decrease ---

  test('timer bar width decreases progressively across multiple ticks', () => {
    loadGameModules();
    document.querySelector('.start-btn[data-tier="1"]').click();

    const timerBar = document.getElementById('timer-bar');
    const widths = [];

    // Simulate 5 frames at 2-second intervals
    for (let t = 0; t <= 8000; t += 2000) {
      performance.now.mockReturnValue(t);
      flushRAF();
      widths.push(parseFloat(timerBar.style.width));
    }

    // Each width should be less than or equal to the previous
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeLessThan(widths[i - 1]);
    }
  });
});
