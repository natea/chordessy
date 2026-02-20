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
//  createDeathBurst(x, y, tint) method
// =========================================================================
describe('createDeathBurst(x, y, tint)', () => {
  test('method exists on BattleScene', () => {
    expect(battleJs).toMatch(/createDeathBurst\s*\(\s*x\s*,\s*y\s*,\s*tint\s*\)/);
  });

  test('generates random count between 20 and 30', () => {
    expect(battleJs).toMatch(/20\s*\+\s*Math\.floor\s*\(\s*Math\.random\s*\(\s*\)\s*\*\s*11\s*\)/);
  });

  test('creates particle emitter using particle texture', () => {
    expect(battleJs).toMatch(/this\.add\.particles\s*\(\s*x\s*,\s*y\s*,\s*['"]particle['"]/);
  });

  test('sets speed range 50-200', () => {
    expect(battleJs).toMatch(/speed\s*:\s*\{\s*min\s*:\s*50\s*,\s*max\s*:\s*200\s*\}/);
  });

  test('sets lifespan to 400ms', () => {
    expect(battleJs).toContain('lifespan: 400');
  });

  test('applies downward slight gravity', () => {
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

  test('destroys emitter after particles expire', () => {
    expect(battleJs).toMatch(/this\.time\.delayedCall\s*\(\s*500/);
    expect(battleJs).toMatch(/emitter\.destroy\s*\(\s*\)/);
  });

  test('emitDeathParticles calls createDeathBurst', () => {
    const pattern = /emitDeathParticles\s*\([^)]*\)\s*{[\s\S]*?this\.createDeathBurst\s*\(/;
    expect(battleJs).toMatch(pattern);
  });
});