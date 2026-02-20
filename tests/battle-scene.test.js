/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const battleJs = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'dist', 'battle.js'),
  'utf-8'
);

describe('BattleScene class (T005)', () => {
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
});