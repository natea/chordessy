/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const battleJs = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'dist', 'battle.js'),
  'utf-8'
);

// =========================================================================
//  emitDeathParticles method
// =========================================================================
describe('emitDeathParticles(x, y, tint)', () => {
  test('method exists on BattleScene', () => {
    expect(battleJs).toMatch(/emitDeathParticles\s*\(\s*x\s*,\s*y\s*,\s*tint\s*\)/);
  });

  test('generates random count between 20 and 30', () => {
    // 20 + Math.floor(Math.random() * 11) yields 20-30
    expect(battleJs).toMatch(/20\s*\+\s*Math\.floor\s*\(\s*Math\.random\s*\(\s*\)\s*\*\s*11\s*\)/);
  });

  test('creates particle emitter using particle texture', () => {
    expect(battleJs).toMatch(/this\.add\.particles\s*\(\s*x\s*,\s*y\s*,\s*['"]particle['"]/);
  });

  test('sets speed range 50-200', () => {
    expect(battleJs).toMatch(/speed\s*:\s*\{\s*min\s*:\s*50\s*,\s*max\s*:\s*200\s*\}/);
  });

  test('sets lifespan to 400ms', () => {
    expect(battleJs).toMatch(/lifespan\s*:\s*400/);
  });

  test('applies downward gravity', () => {
    expect(battleJs).toMatch(/gravityY\s*:\s*50/);
  });

  test('scales from 1.0 to 0', () => {
    expect(battleJs).toMatch(/scale\s*:\s*\{\s*start\s*:\s*1\.0\s*,\s*end\s*:\s*0\s*\}/);
  });

  test('applies tint parameter to particles', () => {
    expect(battleJs).toMatch(/tint\s*:\s*tint/);
  });

  test('emitter starts with emitting false (burst mode)', () => {
    expect(battleJs).toMatch(/emitting\s*:\s*false/);
  });

  test('calls explode with particle count', () => {
    expect(battleJs).toMatch(/emitter\.explode\s*\(\s*count\s*\)/);
  });

  test('auto-destroys emitter after particles expire', () => {
    expect(battleJs).toMatch(/this\.time\.delayedCall\s*\(\s*500/);
    expect(battleJs).toMatch(/emitter\.destroy\s*\(\s*\)/);
  });
});

// =========================================================================
//  screenShake method
// =========================================================================
describe('screenShake(duration, intensity)', () => {
  test('method exists on BattleScene', () => {
    expect(battleJs).toMatch(/screenShake\s*\(\s*duration\s*,\s*intensity\s*\)/);
  });

  test('defaults duration to 200ms', () => {
    expect(battleJs).toMatch(/duration\s*=\s*duration\s*\|\|\s*200/);
  });

  test('defaults intensity to 0.005', () => {
    expect(battleJs).toMatch(/intensity\s*=\s*intensity\s*\|\|\s*0\.005/);
  });

  test('calls cameras.main.shake with duration and intensity', () => {
    expect(battleJs).toMatch(/this\.cameras\.main\.shake\s*\(\s*duration\s*,\s*intensity\s*\)/);
  });
});

// =========================================================================
//  enemyTint helper
// =========================================================================
describe('enemyTint(chord)', () => {
  test('method exists on BattleScene', () => {
    expect(battleJs).toMatch(/enemyTint\s*\(\s*chord\s*\)/);
  });

  test('returns a default color for null/missing chord', () => {
    expect(battleJs).toMatch(/if\s*\(\s*!chord\s*\|\|\s*!chord\.symbol\s*\)\s*return\s+0xff4444/);
  });

  test('handles diminished chords', () => {
    expect(battleJs).toMatch(/includes\s*\(\s*['"]dim['"]\s*\)/);
  });

  test('handles augmented chords', () => {
    expect(battleJs).toMatch(/includes\s*\(\s*['"]aug['"]\s*\)/);
  });

  test('handles minor seventh chords', () => {
    expect(battleJs).toMatch(/includes\s*\(\s*['"]m7['"]\s*\)/);
  });

  test('handles dominant seventh chords', () => {
    expect(battleJs).toMatch(/includes\s*\(\s*['"]7['"]\s*\)/);
  });

  test('handles minor chords', () => {
    // Checks for 'm' or 'min'
    expect(battleJs).toMatch(/includes\s*\(\s*['"]m['"]\s*\)/);
  });
});

// =========================================================================
//  handleEnemyDestroy wiring
// =========================================================================
describe('handleEnemyDestroy calls death particles', () => {
  test('handleEnemyDestroy calls emitDeathParticles', () => {
    expect(battleJs).toMatch(/handleEnemyDestroy[\s\S]*?this\.emitDeathParticles\s*\(/);
  });

  test('handleEnemyDestroy calls enemyTint for particle color', () => {
    expect(battleJs).toMatch(/handleEnemyDestroy[\s\S]*?this\.enemyTint\s*\(/);
  });

  test('handleEnemyDestroy triggers screenShake for lastEnemy', () => {
    expect(battleJs).toMatch(/handleEnemyDestroy[\s\S]*?data\.lastEnemy[\s\S]*?this\.screenShake\s*\(\s*200\s*,\s*0\.005\s*\)/);
  });
});

// =========================================================================
//  onCorrectAnswer passes chord & lastEnemy to bridge
// =========================================================================
describe('onCorrectAnswer passes chord data for particles', () => {
  test('bridge.onCorrectAnswer receives chord property', () => {
    expect(battleJs).toMatch(/bridge\.onCorrectAnswer\s*\(\s*\{[^}]*chord\s*:/);
  });

  test('bridge.onCorrectAnswer receives lastEnemy property', () => {
    expect(battleJs).toMatch(/bridge\.onCorrectAnswer\s*\(\s*\{[^}]*lastEnemy/);
  });
});
