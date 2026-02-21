/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const battleJs = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'dist', 'battle.js'),
  'utf-8'
);

describe('BattleBridge class (T009)', () => {
  test('has BattleBridge class', () => {
    expect(battleJs).toMatch(/class BattleBridge/);
  });

  describe('constructor', () => {
    test('takes destructured parameter { scene, keyboardContainer, keyElements }', () => {
      expect(battleJs).toMatch(/constructor\s*\(\s*\{\s*scene\s*,\s*keyboardContainer\s*,\s*keyElements\s*\}\s*\)\s*\{/);
    });
  });

  describe('properties', () => {
    test('assigns scene parameter to this.scene', () => {
      expect(battleJs).toMatch(/this\.scene\s*=\s*scene/);
    });

    test('assigns keyboardContainer parameter to this.keyboardContainer', () => {
      expect(battleJs).toMatch(/this\.keyboardContainer\s*=\s*keyboardContainer/);
    });

    test('assigns keyElements parameter to this.keyElements', () => {
      expect(battleJs).toMatch(/this\.keyElements\s*=\s*keyElements/);
    });

    test('initialize keyXMap as new Map', () => {
      expect(battleJs).toMatch(/this\.keyXMap\s*=\s*new\s+Map\s*\(\s*\)/);
    });

    test('initialize heldNotes as new Set', () => {
      expect(battleJs).toMatch(/this\.heldNotes\s*=\s*new\s+Set\s*\(\s*\)/);
    });

    test('initialize targetMidi as empty array', () => {
      expect(battleJs).toMatch(/this\.targetMidi\s*=\s*\[\s*\]/);
    });

    test('initialize emitter as Phaser.Events.EventEmitter', () => {
      expect(battleJs).toMatch(/this\.emitter\s*=\s*new\s+Phaser\.Events\.EventEmitter\s*\(\s*\)/);
    });
  });
});

describe('BattleBridge buildKeyXMap() (T010)', () => {
  test('buildKeyXMap() method exists', () => {
    expect(battleJs).toMatch(/buildKeyXMap\s*\(\s*\)\s*\{/);
  });

  test('buildKeyXMap() returns early if scene, game, or keyElements is missing', () => {
    expect(battleJs).toMatch(/if\s*\(\s*!this\.scene\s*\|\|\s*!this\.scene\.game\s*\|\|\s*!this\.keyElements\s*\)\s*return/);
  });

  test('buildKeyXMap() retrieves canvas rect from scene', () => {
    expect(battleJs).toMatch(/canvasRect\s*=\s*this\.scene\.game\.canvas\.getBoundingClientRect/);
  });

  test('buildKeyXMap() iterates over keyElements', () => {
    expect(battleJs).toMatch(/this\.keyElements\.forEach\s*\(/);
  });

  test('buildKeyXMap() reads getBoundingClientRect() for each key element', () => {
    expect(battleJs).toMatch(/keyRect\s*=\s*keyEl\.getBoundingClientRect\(\s*\)/);
  });

  test('buildKeyXMap() calculates canvas-relative center x coordinate', () => {
    expect(battleJs).toMatch(/centerX\s*=\s*keyRect\.left\s*\+\s*keyRect\.width\s*\/\s*2\s*-\s*canvasRect\.left/);
  });

  test('buildKeyXMap() stores {x, width, isAccidental} per MIDI note', () => {
    expect(battleJs).toMatch(/this\.keyXMap\.set\s*\(\s*midiNote\s*,\s*\{/);
    expect(battleJs).toMatch(/x:\s*centerX\s*,/);
    expect(battleJs).toMatch(/width:\s*keyRect\.width/);
    expect(battleJs).toMatch(/isAccidental:\s*isAccidental/);
  });

  test('buildKeyXMap() detects accidental keys from class list', () => {
    expect(battleJs).toMatch(/isAccidental\s*=\s*keyEl\.classList\.contains\s*\(\s*['"]accidental['"]\s*\)/);
  });
});

describe('BattleBridge rebuildKeyXMap() (T010)', () => {
  test('rebuildKeyXMap() method exists', () => {
    expect(battleJs).toMatch(/rebuildKeyXMap\s*\(\s*\)\s*\{/);
  });

  test('rebuildKeyXMap() clears existing keyXMap', () => {
    expect(battleJs).toMatch(/this\.keyXMap\.clear\s*\(\s*\)/);
  });

  test('rebuildKeyXMap() calls buildKeyXMap()', () => {
    expect(battleJs).toMatch(/this\.buildKeyXMap\s*\(\s*\)/);
  });
});

describe('BattleBridge onBulletHit() (T012)', () => {
  test('onBulletHit() method exists', () => {
    expect(battleJs).toMatch(/onBulletHit\s*\(\s*\)\s*\{/);
  });

  test('onBulletHit() emits bulletHit event', () => {
    expect(battleJs).toMatch(/this\.emitter\.emit\s*\(\s*['\"/]bulletHit['\"/]\s*\)/);
  });
});

describe('BattleBridge onWaveCleared() (T012)', () => {
  test('onWaveCleared() method exists', () => {
    expect(battleJs).toMatch(/onWaveCleared\s*\(\s*\)\s*\{/);
  });

  test('onWaveCleared() emits waveCleared event', () => {
    expect(battleJs).toMatch(/this\.emitter\.emit\s*\(\s*['\"/]waveCleared['\"/]\s*\)/);
  });
});

describe('BattleBridge onGameOver() (T012)', () => {
  test('onGameOver() method exists', () => {
    expect(battleJs).toMatch(/onGameOver\s*\(\s*\)\s*\{/);
  });

  test('onGameOver() emits gameOver event', () => {
    expect(battleJs).toMatch(/this\.emitter\.emit\s*\(\s*['\"/]gameOver['\"/]\s*\)/);
  });
});