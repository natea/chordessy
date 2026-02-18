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

// --- Mock WebMidi ---

function createMockInput(name) {
  return {
    name,
    id: name.toLowerCase().replace(/\s+/g, '-'),
    addListener: jest.fn()
  };
}

function createWebMidiMock({ inputs = [], enableError = null } = {}) {
  const listeners = {};
  return {
    inputs,
    enable: jest.fn(callback => {
      callback(enableError);
    }),
    addListener: jest.fn((event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }),
    _emit(event, data) {
      (listeners[event] || []).forEach(fn => fn(data));
    }
  };
}

beforeEach(() => {
  const bodyContent = getBodyContent(gameHtml)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  document.body.innerHTML = bodyContent;
  injectStyles(gameCss);
});

afterEach(() => {
  delete window.WebMidi;
  delete window.Chordessy;
});

describe('MIDI keyboard detection (T026b)', () => {

  // --- Pre-init: DOM defaults ---

  test('MIDI status element exists in the DOM', () => {
    const el = document.getElementById('midi-status');
    expect(el).not.toBeNull();
  });

  test('MIDI status shows "Detecting MIDI keyboard..." before init', () => {
    const el = document.getElementById('midi-status');
    expect(el.textContent).toBe('Detecting MIDI keyboard...');
  });

  // --- setupMidi with a connected keyboard ---

  test('setupMidi resolves with callback setters when WebMidi enables', async () => {
    window.WebMidi = createWebMidiMock({ inputs: [] });
    // Load shared.js into the jsdom environment
    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};
    eval(sharedCode);

    const midi = await window.Chordessy.setupMidi();
    expect(midi).toBeDefined();
    expect(typeof midi.onNoteOn).toBe('function');
    expect(typeof midi.onNoteOff).toBe('function');
    expect(typeof midi.onSustain).toBe('function');
    expect(typeof midi.getInputs).toBe('function');
  });

  test('setupMidi binds listeners to all available inputs', async () => {
    const input1 = createMockInput('Arturia KeyStep');
    const input2 = createMockInput('MIDI Through');
    window.WebMidi = createWebMidiMock({ inputs: [input1, input2] });

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};
    eval(sharedCode);

    await window.Chordessy.setupMidi();

    // Each input should have 'noteon', 'noteoff', 'controlchange' listeners
    expect(input1.addListener).toHaveBeenCalledWith('noteon', 1, expect.any(Function));
    expect(input1.addListener).toHaveBeenCalledWith('noteoff', 1, expect.any(Function));
    expect(input1.addListener).toHaveBeenCalledWith('controlchange', 1, expect.any(Function));
    expect(input2.addListener).toHaveBeenCalledWith('noteon', 1, expect.any(Function));
    expect(input2.addListener).toHaveBeenCalledWith('noteoff', 1, expect.any(Function));
    expect(input2.addListener).toHaveBeenCalledWith('controlchange', 1, expect.any(Function));
  });

  test('getInputs returns the list of connected MIDI inputs', async () => {
    const input1 = createMockInput('KeyLab Essential');
    window.WebMidi = createWebMidiMock({ inputs: [input1] });

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};
    eval(sharedCode);

    const midi = await window.Chordessy.setupMidi();
    const inputs = midi.getInputs();
    expect(inputs).toHaveLength(1);
    expect(inputs[0].name).toBe('KeyLab Essential');
  });

  // --- setupMidi with no keyboards ---

  test('setupMidi resolves with empty inputs when no MIDI devices found', async () => {
    window.WebMidi = createWebMidiMock({ inputs: [] });

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};
    eval(sharedCode);

    const midi = await window.Chordessy.setupMidi();
    expect(midi.getInputs()).toHaveLength(0);
  });

  // --- setupMidi when WebMidi fails ---

  test('setupMidi rejects when WebMidi is not supported', async () => {
    const error = new Error('WebMidi is not supported');
    window.WebMidi = createWebMidiMock({ enableError: error });

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};
    eval(sharedCode);

    await expect(window.Chordessy.setupMidi()).rejects.toThrow('WebMidi is not supported');
  });

  // --- Callback routing ---

  test('noteOn callbacks are invoked when MIDI input fires noteon', async () => {
    const input = createMockInput('Test KB');
    window.WebMidi = createWebMidiMock({ inputs: [input] });

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};
    eval(sharedCode);

    const midi = await window.Chordessy.setupMidi();

    const handler = jest.fn();
    midi.onNoteOn(handler);

    // Simulate the input firing a noteon event
    const noteOnCb = input.addListener.mock.calls.find(c => c[0] === 'noteon')[2];
    noteOnCb({ note: { number: 60 }, velocity: 0.8 });

    expect(handler).toHaveBeenCalledWith(60, 0.8);
  });

  test('noteOff callbacks are invoked when MIDI input fires noteoff', async () => {
    const input = createMockInput('Test KB');
    window.WebMidi = createWebMidiMock({ inputs: [input] });

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};
    eval(sharedCode);

    const midi = await window.Chordessy.setupMidi();

    const handler = jest.fn();
    midi.onNoteOff(handler);

    const noteOffCb = input.addListener.mock.calls.find(c => c[0] === 'noteoff')[2];
    noteOffCb({ note: { number: 60 } });

    expect(handler).toHaveBeenCalledWith(60);
  });

  test('sustain callbacks are invoked for CC 64 controlchange', async () => {
    const input = createMockInput('Test KB');
    window.WebMidi = createWebMidiMock({ inputs: [input] });

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};
    eval(sharedCode);

    const midi = await window.Chordessy.setupMidi();

    const handler = jest.fn();
    midi.onSustain(handler);

    const ccCb = input.addListener.mock.calls.find(c => c[0] === 'controlchange')[2];
    // Sustain down (value >= 64)
    ccCb({ controller: { number: 64 }, value: 127 });
    expect(handler).toHaveBeenCalledWith(true);

    // Sustain up (value < 64)
    ccCb({ controller: { number: 64 }, value: 0 });
    expect(handler).toHaveBeenCalledWith(false);
  });

  test('non-sustain CC messages are ignored', async () => {
    const input = createMockInput('Test KB');
    window.WebMidi = createWebMidiMock({ inputs: [input] });

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};
    eval(sharedCode);

    const midi = await window.Chordessy.setupMidi();

    const handler = jest.fn();
    midi.onSustain(handler);

    const ccCb = input.addListener.mock.calls.find(c => c[0] === 'controlchange')[2];
    // CC 1 = modulation wheel — should not trigger sustain
    ccCb({ controller: { number: 1 }, value: 127 });
    expect(handler).not.toHaveBeenCalled();
  });

  // --- Dynamic device connection ---

  test('WebMidi registers a connected listener for hot-plugged devices', async () => {
    window.WebMidi = createWebMidiMock({ inputs: [] });

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};
    eval(sharedCode);

    await window.Chordessy.setupMidi();

    expect(window.WebMidi.addListener).toHaveBeenCalledWith('connected', expect.any(Function));
  });

  test('hot-plugged device gets listeners bound on connect event', async () => {
    const newInput = createMockInput('Hot-Plugged KB');
    window.WebMidi = createWebMidiMock({ inputs: [] });

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};
    eval(sharedCode);

    await window.Chordessy.setupMidi();

    // Simulate a new device being connected
    window.WebMidi.inputs.push(newInput);
    window.WebMidi._emit('connected');

    expect(newInput.addListener).toHaveBeenCalledWith('noteon', 1, expect.any(Function));
    expect(newInput.addListener).toHaveBeenCalledWith('noteoff', 1, expect.any(Function));
    expect(newInput.addListener).toHaveBeenCalledWith('controlchange', 1, expect.any(Function));
  });

  // --- Game init MIDI status messages ---

  test('game init shows keyboard name when MIDI device is connected', async () => {
    const input = createMockInput('Arturia MiniLab');
    window.WebMidi = createWebMidiMock({ inputs: [input] });

    // Provide stubs for dependencies that game.js/shared.js need
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.mm = { Player: { tone: createToneMock() } };
    window.Tonal = { Note: { pc: jest.fn(), fromMidi: jest.fn(), midi: jest.fn() }, Chord: { notes: jest.fn(() => []) } };
    window.Chordessy = window.Chordessy || {};

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    eval(sharedCode);

    // Simulate what game.js init does (lines 108-116)
    const midi = await window.Chordessy.setupMidi();
    const midiStatus = document.getElementById('midi-status');
    const inputs = midi.getInputs();
    if (inputs.length > 0) {
      midiStatus.textContent = 'MIDI keyboard connected: ' + inputs[0].name;
    }

    expect(midiStatus.textContent).toBe('MIDI keyboard connected: Arturia MiniLab');
  });

  test('game init shows fallback when no MIDI device is found', async () => {
    window.WebMidi = createWebMidiMock({ inputs: [] });
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    eval(sharedCode);

    const midi = await window.Chordessy.setupMidi();
    const midiStatus = document.getElementById('midi-status');
    const inputs = midi.getInputs();
    if (inputs.length === 0) {
      midiStatus.textContent = 'No MIDI keyboard found. Use QWERTY or click keys.';
    }

    expect(midiStatus.textContent).toBe('No MIDI keyboard found. Use QWERTY or click keys.');
  });

  test('game init shows not-supported message when WebMidi fails', async () => {
    const error = new Error('Not supported');
    window.WebMidi = createWebMidiMock({ enableError: error });
    window._ = { range: (a, b) => Array.from({ length: b - a }, (_, i) => a + i) };
    window.Chordessy = window.Chordessy || {};

    const sharedCode = fs.readFileSync(
      path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'shared.js'),
      'utf-8'
    );
    eval(sharedCode);

    const midiStatus = document.getElementById('midi-status');
    try {
      await window.Chordessy.setupMidi();
    } catch {
      midiStatus.textContent = 'MIDI not supported. Use QWERTY or click keys.';
    }

    expect(midiStatus.textContent).toBe('MIDI not supported. Use QWERTY or click keys.');
  });
});

// --- Tone.js minimal mock ---

function createToneMock() {
  const mockNode = { connect: jest.fn().mockReturnThis(), toMaster: jest.fn().mockReturnThis() };
  return {
    Gain: jest.fn(() => mockNode),
    Convolver: jest.fn(() => ({ ...mockNode, wet: { value: 0 } })),
    FeedbackDelay: jest.fn(() => mockNode),
    Filter: jest.fn(() => mockNode),
    Sampler: jest.fn(() => ({ ...mockNode, release: { value: 0 }, triggerAttack: jest.fn(), triggerAttackRelease: jest.fn() })),
    Synth: jest.fn(() => ({ ...mockNode })),
    Frequency: jest.fn(),
    now: jest.fn(() => 0)
  };
}
