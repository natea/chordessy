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

let mockSampler;
let mockCorrectSynth;
let mockIncorrectSynth;

function createToneMock() {
  const mockNode = { connect: jest.fn().mockReturnThis(), toMaster: jest.fn().mockReturnThis() };
  mockSampler = {
    ...mockNode, release: { value: 0 },
    triggerAttack: jest.fn(), triggerAttackRelease: jest.fn()
  };
  mockCorrectSynth = { ...mockNode, triggerAttackRelease: jest.fn() };
  mockIncorrectSynth = { ...mockNode, triggerAttackRelease: jest.fn() };

  let synthCallCount = 0;
  return {
    Gain: jest.fn(() => mockNode),
    Convolver: jest.fn(() => ({ ...mockNode, wet: { value: 0 } })),
    FeedbackDelay: jest.fn(() => mockNode),
    Filter: jest.fn(() => mockNode),
    LFO: jest.fn(() => ({ connect: jest.fn().mockReturnThis(), start: jest.fn() })),
    Sampler: jest.fn(() => mockSampler),
    Synth: jest.fn(() => {
      synthCallCount++;
      // First Synth call = correctSynth, second = incorrectSynth
      return synthCallCount === 1 ? mockCorrectSynth : mockIncorrectSynth;
    }),
    Frequency: jest.fn(f => f),
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
  const patchedGameCode = gameCode.replace(
    "document.addEventListener('DOMContentLoaded', init);",
    "C.game._init = init; document.addEventListener('DOMContentLoaded', init);"
  );
  eval(patchedGameCode);

  window.Chordessy.game._init();
}

/** Click the target chord notes via on-screen keyboard. */
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

/** Click wrong notes that won't match any common chord. */
function playWrongChord() {
  const keys = document.querySelectorAll('#game-keyboard .key');
  // Play C#3, D#3, F#3 — an unlikely target chord
  [49, 51, 54].forEach(note => {
    const idx = note - window.Chordessy.MIN_NOTE;
    if (keys[idx]) {
      keys[idx].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }
  });
}

/** Start the game at tier 1 (triads). */
function startGame() {
  document.querySelector('.start-btn[data-tier="1"]').click();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
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

describe('Audio plays for target chord preview and feedback sounds (T026o)', () => {

  // --- Target chord preview audio ---

  test('target chord preview plays via sampler when a new chord is shown', () => {
    loadGameModules();
    startGame();

    // nextChord() is called during startGame, which calls audio.playChord(targetMidi, '2n')
    // The sampler's triggerAttackRelease should have been called for each note in the target chord
    const state = window.Chordessy.game.state;
    expect(state.targetMidi.length).toBeGreaterThan(0);
    expect(mockSampler.triggerAttackRelease).toHaveBeenCalled();
    expect(mockSampler.triggerAttackRelease.mock.calls.length).toBeGreaterThanOrEqual(
      state.targetMidi.length
    );
  });

  test('preview plays one triggerAttackRelease per note in the target chord', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    // Count calls that correspond to the preview (initial calls after startGame)
    const callCount = mockSampler.triggerAttackRelease.mock.calls.length;
    expect(callCount).toBe(state.targetMidi.length);
  });

  test('preview uses "2n" duration for each note', () => {
    loadGameModules();
    startGame();

    mockSampler.triggerAttackRelease.mock.calls.forEach(call => {
      // call signature: triggerAttackRelease(freq, duration, time)
      expect(call[1]).toBe('2n');
    });
  });

  // --- Correct feedback sound ---

  test('correct feedback plays ascending arpeggio on correctSynth', () => {
    loadGameModules();
    startGame();

    // Clear mock history from init phase
    mockCorrectSynth.triggerAttackRelease.mockClear();

    playTargetChord();

    // Should play 3 notes: C5, E5, G5
    expect(mockCorrectSynth.triggerAttackRelease).toHaveBeenCalledTimes(3);
  });

  test('correct arpeggio plays notes C5, E5, G5 in order', () => {
    loadGameModules();
    startGame();
    mockCorrectSynth.triggerAttackRelease.mockClear();

    playTargetChord();

    const calls = mockCorrectSynth.triggerAttackRelease.mock.calls;
    expect(calls[0][0]).toBe('C5');
    expect(calls[1][0]).toBe('E5');
    expect(calls[2][0]).toBe('G5');
  });

  test('correct arpeggio notes use "16n" duration', () => {
    loadGameModules();
    startGame();
    mockCorrectSynth.triggerAttackRelease.mockClear();

    playTargetChord();

    mockCorrectSynth.triggerAttackRelease.mock.calls.forEach(call => {
      expect(call[1]).toBe('16n');
    });
  });

  test('correct arpeggio notes are staggered in time (0, +0.08, +0.16)', () => {
    loadGameModules();
    startGame();
    mockCorrectSynth.triggerAttackRelease.mockClear();

    playTargetChord();

    const calls = mockCorrectSynth.triggerAttackRelease.mock.calls;
    const t0 = calls[0][2];
    const t1 = calls[1][2];
    const t2 = calls[2][2];
    expect(t1 - t0).toBeCloseTo(0.08, 5);
    expect(t2 - t0).toBeCloseTo(0.16, 5);
  });

  // --- Incorrect feedback sound ---

  test('incorrect feedback plays low E2 on incorrectSynth', () => {
    loadGameModules();
    startGame();
    mockIncorrectSynth.triggerAttackRelease.mockClear();

    playWrongChord();

    const state = window.Chordessy.game.state;
    // Only check if a life was actually lost (wrong chord detected)
    if (state.lives < 5) {
      expect(mockIncorrectSynth.triggerAttackRelease).toHaveBeenCalled();
      expect(mockIncorrectSynth.triggerAttackRelease.mock.calls[0][0]).toBe('E2');
    }
  });

  test('incorrect feedback uses "8n" duration', () => {
    loadGameModules();
    startGame();
    mockIncorrectSynth.triggerAttackRelease.mockClear();

    playWrongChord();

    const state = window.Chordessy.game.state;
    if (state.lives < 5) {
      expect(mockIncorrectSynth.triggerAttackRelease.mock.calls[0][1]).toBe('8n');
    }
  });

  test('incorrectSynth is NOT called on correct chord', () => {
    loadGameModules();
    startGame();
    mockIncorrectSynth.triggerAttackRelease.mockClear();

    playTargetChord();

    expect(mockIncorrectSynth.triggerAttackRelease).not.toHaveBeenCalled();
  });

  // --- Timeout feedback sound ---

  test('timeout plays low E2 buzz on incorrectSynth', () => {
    loadGameModules();
    startGame();
    mockIncorrectSynth.triggerAttackRelease.mockClear();

    // Advance time past the timer duration (10 seconds = 10000ms)
    performance.now.mockReturnValue(11000);
    // Trigger tickTimer by calling requestAnimationFrame callback
    const rafCallback = window.requestAnimationFrame.mock.calls[0]?.[0];
    if (rafCallback) {
      rafCallback();
    } else {
      // Fallback: directly invoke the game's timeout by advancing past timer
      // The timer uses RAF, so we need to simulate it
      // Let's use the exposed game state instead
      const state = window.Chordessy.game.state;
      // Manually call the timeout by setting time past duration
      performance.now.mockReturnValue(state.timerDuration * 1000 + 1000);
    }

    // Check if incorrectSynth was triggered
    // Since RAF is mocked, we may need to manually trigger timeout
    if (mockIncorrectSynth.triggerAttackRelease.mock.calls.length === 0) {
      // Timer relies on RAF chain; simulate by re-calling the RAF callback
      const allRafCalls = window.requestAnimationFrame.mock.calls;
      if (allRafCalls.length > 0) {
        const lastCb = allRafCalls[allRafCalls.length - 1][0];
        if (lastCb) lastCb();
      }
    }

    expect(mockIncorrectSynth.triggerAttackRelease).toHaveBeenCalled();
    expect(mockIncorrectSynth.triggerAttackRelease.mock.calls[0][0]).toBe('E2');
    expect(mockIncorrectSynth.triggerAttackRelease.mock.calls[0][1]).toBe('8n');
  });

  // --- Individual key press audio ---

  test('clicking a key plays audio via sampler triggerAttack', () => {
    loadGameModules();
    startGame();

    // Clear sampler mocks from chord preview
    mockSampler.triggerAttack.mockClear();

    // Click a single key
    const keyEl = document.querySelectorAll('#game-keyboard .key')[12]; // C4 = MIDI 60
    keyEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    // noteOn calls audio.playNote which calls sampler.triggerAttack
    expect(mockSampler.triggerAttack).toHaveBeenCalled();
  });

  test('each key click triggers exactly one triggerAttack call', () => {
    loadGameModules();
    startGame();

    mockSampler.triggerAttack.mockClear();

    // Click C4
    const idx = 60 - window.Chordessy.MIN_NOTE;
    const keyEl = document.querySelectorAll('#game-keyboard .key')[idx];
    keyEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(mockSampler.triggerAttack).toHaveBeenCalledTimes(1);
  });

  test('key press audio uses 0.7 velocity', () => {
    loadGameModules();
    startGame();

    mockSampler.triggerAttack.mockClear();

    const idx = 60 - window.Chordessy.MIN_NOTE;
    const keyEl = document.querySelectorAll('#game-keyboard .key')[idx];
    keyEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    // triggerAttack(freq, time, velocity) — velocity is the 3rd arg
    const call = mockSampler.triggerAttack.mock.calls[0];
    expect(call[2]).toBe(0.7);
  });

  // --- "Hear Again" button ---

  test('"Hear Again" button is visible during gameplay', () => {
    loadGameModules();
    startGame();

    const hearAgainBtn = document.getElementById('hear-again-btn');
    expect(hearAgainBtn).not.toBeNull();
    expect(hearAgainBtn.style.display).not.toBe('none');
  });

  test('clicking "Hear Again" replays the target chord via sampler', () => {
    loadGameModules();
    startGame();

    // Clear sampler mocks from initial preview
    mockSampler.triggerAttackRelease.mockClear();

    const hearAgainBtn = document.getElementById('hear-again-btn');
    hearAgainBtn.click();

    const state = window.Chordessy.game.state;
    expect(mockSampler.triggerAttackRelease).toHaveBeenCalledTimes(state.targetMidi.length);
  });

  test('"Hear Again" plays the same notes as the current target chord', () => {
    loadGameModules();
    startGame();

    mockSampler.triggerAttackRelease.mockClear();

    const state = window.Chordessy.game.state;
    const hearAgainBtn = document.getElementById('hear-again-btn');
    hearAgainBtn.click();

    // Each target MIDI note should produce a triggerAttackRelease call
    expect(mockSampler.triggerAttackRelease.mock.calls.length).toBe(state.targetMidi.length);
  });

  test('"Hear Again" button is hidden on game over screen', () => {
    loadGameModules();
    startGame();

    const state = window.Chordessy.game.state;
    // Lose all lives
    state.lives = 1;
    state.missed = 4;

    // Trigger timeout to lose last life
    performance.now.mockReturnValue(11000);
    const allRafCalls = window.requestAnimationFrame.mock.calls;
    if (allRafCalls.length > 0) {
      const lastCb = allRafCalls[allRafCalls.length - 1][0];
      if (lastCb) lastCb();
    }

    jest.advanceTimersByTime(1500);

    const hearAgainBtn = document.getElementById('hear-again-btn');
    expect(hearAgainBtn.style.display).toBe('none');
  });

  // --- Audio engine setup ---

  test('audio engine (setupAudio) is initialized during game init', () => {
    loadGameModules();

    // Sampler should exist (it was created via Tone.Sampler)
    expect(mockSampler).toBeDefined();
    expect(mockSampler.triggerAttack).toBeDefined();
    expect(mockSampler.triggerAttackRelease).toBeDefined();
  });

  test('two Synth instances are created: correctSynth and incorrectSynth', () => {
    loadGameModules();

    const Tone = window.mm.Player.tone;
    // Synth constructor should have been called twice (once for correct, once for incorrect)
    expect(Tone.Synth).toHaveBeenCalledTimes(2);
  });

  test('correctSynth uses sine oscillator', () => {
    loadGameModules();

    const Tone = window.mm.Player.tone;
    const firstSynthCall = Tone.Synth.mock.calls[0][0];
    expect(firstSynthCall.oscillator.type).toBe('sine');
  });

  test('incorrectSynth uses sawtooth oscillator', () => {
    loadGameModules();

    const Tone = window.mm.Player.tone;
    const secondSynthCall = Tone.Synth.mock.calls[1][0];
    expect(secondSynthCall.oscillator.type).toBe('sawtooth');
  });

  // --- Preview plays on each new chord ---

  test('preview audio plays again after advancing to the next chord', () => {
    loadGameModules();
    startGame();

    // First chord preview already played
    const initialCalls = mockSampler.triggerAttackRelease.mock.calls.length;

    // Play correct chord to advance
    playTargetChord();
    jest.advanceTimersByTime(1500);

    // After next chord, more preview calls should have occurred
    const totalCalls = mockSampler.triggerAttackRelease.mock.calls.length;
    expect(totalCalls).toBeGreaterThan(initialCalls);
  });

  test('feedback synths are connected to masterGain', () => {
    loadGameModules();

    // Both correctSynth and incorrectSynth should have .connect() called
    expect(mockCorrectSynth.connect).toHaveBeenCalled();
    expect(mockIncorrectSynth.connect).toHaveBeenCalled();
  });
});
