/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const battleJs = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'dist', 'battle.js'),
  'utf-8'
);

describe('BattleScene class (T005, T017)', () => {
  test('extends Phaser.Scene', () => {
    expect(battleJs).toMatch(/class BattleScene extends Phaser\.Scene/);
  });

  describe('constructor', () => {
    test('passes scene key to parent constructor', () => {
      expect(battleJs).toMatch(/super\(SCENE_KEYS\.BATTLE\)/);
    });
  });

  describe('preload()', () => {
    test('has preload method', () => {
      expect(battleJs).toMatch(/preload\s*\(\s*\)\s*\{/);
    });
  });

  describe('create()', () => {
    test('has create method', () => {
      expect(battleJs).toMatch(/create\s*\(\s*\)\s*\{/);
    });

    test('sets world bounds using physics.world.setBounds', () => {
      expect(battleJs).toMatch(/this\.physics\.world\.setBounds/);
    });

    test('stores scene width in this.sceneWidth', () => {
      expect(battleJs).toMatch(/this\.sceneWidth\s*=\s*width/);
    });

    test('stores scene height in this.sceneHeight', () => {
      expect(battleJs).toMatch(/this\.sceneHeight\s*=\s*height/);
    });

    test('creates star array', () => {
      expect(battleJs).toMatch(/this\.stars\s*=\s*\[\]/);
    });

    test('creates 100 stars', () => {
      expect(battleJs).toMatch(/starCount\s*=\s*100/);
      expect(battleJs).toMatch(/for\s*\([^)]*i\s*<\s*starCount[^)]*\)/);
    });

    test('creates stars using this.add.circle with white color', () => {
      expect(battleJs).toMatch(/this\.add\.circle\s*\([^)]*,\s*0xffffff/);
    });

    test('stores speed on star object', () => {
      expect(battleJs).toMatch(/star\.starSpeed\s*=\s*speed/);
    });

    test('pushes star to stars array', () => {
      expect(battleJs).toMatch(/this\.stars\.push\s*\(\s*star\s*\)/);
    });
  });

  describe('update(time, delta)', () => {
    test('has update method with time and delta parameters', () => {
      expect(battleJs).toMatch(/update\s*\(\s*time\s*,\s*delta\s*\)\s*\{/);
    });

    test('iterates over stars array', () => {
      expect(battleJs).toMatch(/this\.stars\.forEach\s*\(\s*star\s*=>\s*\{/);
    });

    test('increases star y position by speed', () => {
      expect(battleJs).toMatch(/star\.y\s*\+=\s*star\.starSpeed/);
    });

    test('wraps star to top when it exceeds scene height', () => {
      expect(battleJs).toMatch(/if\s*\(\s*star\.y\s*>\s*this\.sceneHeight\s*\)/);
      expect(battleJs).toMatch(/star\.y\s*=\s*0/);
    });

    test('randomizes star x position when wrapping', () => {
      expect(battleJs).toMatch(/star\.x\s*=\s*Phaser\.Math\.Between\s*\(\s*0\s*,\s*this\.sceneWidth\s*\)/);
    });
  });

  describe('spawnEnemies(midiNotes, level) (T017)', () => {
    test('has spawnEnemies method with midiNotes and level parameters', () => {
      expect(battleJs).toMatch(/spawnEnemies\s*\(\s*midiNotes\s*,\s*level\s*\)\s*\{/);
    });

    test('clears existing enemies by iterating this.enemies array', () => {
      expect(battleJs).toMatch(/this\.enemies\.forEach\s*\(\s*enemy\s*=>\s*\{/);
    });

    test('destroys alive enemies', () => {
      expect(battleJs).toMatch(/if\s*\(\s*enemy\s*&&\s*enemy\.alive\s*\)/);
      expect(battleJs).toMatch(/enemy\.destroy\s*\(\s*\)/);
    });

    test('resets enemies array to empty', () => {
      expect(battleJs).toMatch(/this\.enemies\s*=\s*\[\]/);
    });

    test('gets keyXMap from bridge', () => {
      expect(battleJs).toMatch(/let keyXMap\s*=\s*this\.bridge\.keyXMap/);
    });

    test('iterates over midiNotes with index', () => {
      expect(battleJs).toMatch(/midiNotes\.forEach\s*\(\s*\(\s*midiNote\s*,\s*index\s*\)\s*=>\s*\{/);
    });

    test('creates x, y, isAccidental variables', () => {
      expect(battleJs).toMatch(/let\s+x\s*,\s*y\s*,\s*isAccidental/);
    });

    test('checks if level < 15 for positioning mode', () => {
      expect(battleJs).toMatch(/if\s*\(\s*level\s*<\s*15\s*\)\s*\{/);
    });

    test('for level < 15: gets keyInfo from keyXMap by midiNote', () => {
      expect(battleJs).toMatch(/let keyInfo\s*=\s*keyXMap\.get\s*\(\s*midiNote\s*\)/);
    });

    test('for level < 15: uses keyX for x position when available', () => {
      expect(battleJs).toMatch(/x\s*=\s*keyInfo\s*\?\s*keyInfo\.x\s*:\s*Phaser\.Math\.Between\s*\(\s*50\s*,\s*this\.sceneWidth\s*-\s*50\s*\)/);
    });

    test('for level < 15: gets isAccidental from keyInfo', () => {
      expect(battleJs).toMatch(/isAccidental\s*=\s*keyInfo\s*\?\s*keyInfo\.isAccidental\s*:\s*false/);
    });

    test('for level < 15: uses Phaser.Math.Between for y position', () => {
      expect(battleJs).toMatch(/y\s*=\s*Phaser\.Math\.Between\s*\(\s*50\s*,\s*this\.sceneHeight\s*-\s*150\s*\)/);
    });

    test('for level >= 15: uses random x position', () => {
      expect(battleJs).toMatch(/x\s*=\s*Phaser\.Math\.Between\s*\(\s*50\s*,\s*this\.sceneWidth\s*-\s*50\s*\)/);
    });

    test('for level >= 15: uses random y position', () => {
      expect(battleJs).toMatch(/y\s*=\s*Phaser\.Math\.Between\s*\(\s*50\s*,\s*this\.sceneHeight\s*-\s*150\s*\)/);
    });

    test('for level >= 15: sets isAccidental to false', () => {
      expect(battleJs).toMatch(/isAccidental\s*=\s*false/);
    });

    test('creates new Enemy with scene, midiNote, x, y, isAccidental', () => {
      expect(battleJs).toMatch(/let enemy\s*=\s*new\s+Enemy\s*\(\s*this\.scene\s*,\s*midiNote\s*,\s*x\s*,\s*y\s*,\s*isAccidental\s*\)/);
    });

    test('pushes enemy to enemies array', () => {
      expect(battleJs).toMatch(/this\.enemies\.push\s*\(\s*enemy\s*\)/);
    });

    test('checks if level >= 15 to show label', () => {
      expect(battleJs).toMatch(/if\s*\(\s*level\s*>=\s*15\s*\)\s*\{/);
    });

    test('shows label when level >= 15', () => {
      expect(battleJs).toMatch(/enemy\.showLabel\s*\(\s*\)/);
    });

    test('staggered spawn animation using time.delayedCall with index * 100ms', () => {
      expect(battleJs).toMatch(/this\.time\.delayedCall\s*\(\s*index\s*\*\s*100\s*/);
    });

    test('checks if enemy is alive before spawnAnimation', () => {
      expect(battleJs).toMatch(/if\s*\(\s*enemy\s*&&\s*enemy\.alive\s*\)/);
    });

    test('calls spawnAnimation on enemy', () => {
      expect(battleJs).toMatch(/enemy\.spawnAnimation\s*\(\s*\)/);
    });
  });
});