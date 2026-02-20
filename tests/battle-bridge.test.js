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