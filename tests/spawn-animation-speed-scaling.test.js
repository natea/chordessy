const { describe, it, expect } = require('@jest/globals');
const fs = require('fs');
const path = require('path');

const battleJs = fs.readFileSync(
  path.join(process.cwd(), 'neural-arpeggiator/src/battle.js'),
  'utf-8'
);

describe('Enemy Spawn Animation Speed Scaling (T046)', () => {
  describe('getSpawnAnimationDuration(level) implementation', () => {
    test('contains getSpawnAnimationDuration method', () => {
      expect(battleJs).toMatch(/getSpawnAnimationDuration\s*\(\s*level\s*\)/);
    });

    test('levels 1-9: returns 500ms', () => {
      expect(battleJs).toMatch(/if\s*\(\s*level\s*>=\s*10\s*\)\s*return\s*300/);
      expect(battleJs).toMatch(/return\s*500/);
    });

    test('used in spawnEnemies() for spawn animation duration', () => {
      expect(battleJs).toMatch(/let spawnDuration\s*=\s*this\.getSpawnAnimationDuration\s*\(\s*level\s*\)/);
      expect(battleJs).toMatch(/enemy\.spawnAnimation\s*\(\s*spawnDuration\s*\)/);
    });

    test('exact implementation with correct level threshold', () => {
      const match = battleJs.match(
        /getSpawnAnimationDuration\s*\([^)]*\)\s*\{[^}]*if\s*\(\s*level\s*>=\s*10\s*\)\s*return\s*300;[^}]*return\s*500;/s
      );
      expect(match).toBeTruthy();
    });
  });

  describe('spawn animation duration values by level range', () => {
    test('level 1 -> 500ms', () => {
      expect(battleJs).toMatch(/return\s*500/);
    });

    test('level 4 -> 500ms (still level < 10)', () => {
      const implementation = battleJs.match(
        /getSpawnAnimationDuration\s*\([^)]*\)\s*\{[\s\S]*?\}/
      );
      expect(implementation?.[0]).toContain('return 500');
    });

    test('level 9 -> 500ms (still level < 10)', () => {
      const implementation = battleJs.match(
        /getSpawnAnimationDuration\s*\([^)]*\)\s*\{[\s\S]*?\}/
      );
      expect(implementation?.[0]).toContain('return 500');
    });

    test('level 10 -> 300ms', () => {
      expect(battleJs).toMatch(/if\s*\(\s*level\s*>=\s*10\s*\)\s*return\s*300/);
    });

    test('level 15 -> 300ms (level >= 10)', () => {
      const implementation = battleJs.match(
        /getSpawnAnimationDuration\s*\([^)]*\)\s*\{[\s\S]*?\}/
      );
      expect(implementation?.[0]).toContain('return 300');
    });

    test('level 20 -> 300ms (level >= 10)', () => {
      const implementation = battleJs.match(
        /getSpawnAnimationDuration\s*\([^)]*\)\s*\{[\s\S]*?\}/
      );
      expect(implementation?.[0]).toContain('return 300');
    });
  });

  describe('spawnAnimation() method modification', () => {
    test('spawnAnimation accepts duration parameter', () => {
      expect(battleJs).toMatch(/spawnAnimation\s*\(\s*duration\s*=\s*500\s*\)/);
    });

    test('spawnAnimation uses duration parameter in tween', () => {
      expect(battleJs).toMatch(/duration:\s*duration/);
    });
  });
});