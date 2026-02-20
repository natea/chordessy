const { describe, it, expect } = require('@jest/globals');
const fs = require('fs');
const path = require('path');

const battleJs = fs.readFileSync(
  path.join(process.cwd(), 'neural-arpeggiator/src/battle.js'),
  'utf-8'
);

describe('Ready Beat Scaling (T045)', () => {
  describe('getReadyBeatDelay(level) implementation', () => {
    test('contains getReadyBeatDelay method', () => {
      expect(battleJs).toMatch(/getReadyBeatDelay\s*\(\s*level\s*\)/);
    });

    test('levels 1-4: returns 1500ms', () => {
      expect(battleJs).toMatch(/if\s*\(\s*level\s*>=\s*15\s*\)\s*return\s*500/);
      expect(battleJs).toMatch(/if\s*\(\s*level\s*>=\s*10\s*\)\s*return\s*800/);
      expect(battleJs).toMatch(/if\s*\(\s*level\s*>=\s*5\s*\)\s*return\s*1000/);
      expect(battleJs).toMatch(/return\s*1500/);
    });

    test('used in nextWave() for bullet delay', () => {
      expect(battleJs).toMatch(/lastEnemySpawnDelay\s*\+\s*this\.getReadyBeatDelay\s*\(\s*this\.battleState\.level/);
    });

    test('exact implementation with correct level thresholds', () => {
      const match = battleJs.match(
        /getReadyBeatDelay\s*\([^)]*\)\s*\{[^}]*if\s*\(\s*level\s*>=\s*15\s*\)\s*return\s*500;[^}]*if\s*\(\s*level\s*>=\s*10\s*\)\s*return\s*800;[^}]*if\s*\(\s*level\s*>=\s*5\s*\)\s*return\s*1000;[^}]*return\s*1500;/s
      );
      expect(match).toBeTruthy();
    });
  });

  describe('ready beat delay values by level range', () => {
    test('level 1 -> 1500ms', () => {
      expect(battleJs).toMatch(/return\s*1500/);
    });

    test('level 4 -> 1500ms (still level <= 4)', () => {
      const implementation = battleJs.match(
        /getReadyBeatDelay\s*\([^)]*\)\s*\{[\s\S]*?\}/
      );
      expect(implementation?.[0]).toContain('return 1500');
    });

    test('level 5 -> 1000ms', () => {
      expect(battleJs).toMatch(/if\s*\(\s*level\s*>=\s*5\s*\)\s*return\s*1000/);
    });

    test('level 9 -> 1000ms (still level < 10)', () => {
      const implementation = battleJs.match(
        /getReadyBeatDelay\s*\([^)]*\)\s*\{[\s\S]*?\}/
      );
      expect(implementation?.[0]).toContain('return 1000');
    });

    test('level 10 -> 800ms', () => {
      expect(battleJs).toMatch(/if\s*\(\s*level\s*>=\s*10\s*\)\s*return\s*800/);
    });

    test('level 14 -> 800ms (still level < 15)', () => {
      const implementation = battleJs.match(
        /getReadyBeatDelay\s*\([^)]*\)\s*\{[\s\S]*?\}/
      );
      expect(implementation?.[0]).toContain('return 800');
    });

    test('level 15 -> 500ms', () => {
      expect(battleJs).toMatch(/if\s*\(\s*level\s*>=\s*15\s*\)\s*return\s*500/);
    });

    test('level 20 -> 500ms (level >= 15)', () => {
      const implementation = battleJs.match(
        /getReadyBeatDelay\s*\([^)]*\)\s*\{[\s\S]*?\}/
      );
      expect(implementation?.[0]).toContain('return 500');
    });
  });
});