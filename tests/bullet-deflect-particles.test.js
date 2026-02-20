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
//  deflect method - Bullet Deflect Particles (T050)
// =========================================================================
describe('Bullet deflect() - T050', () => {
  test('method exists on Bullet class', () => {
    expect(battleJs).toMatch(/deflect\s*\(\s*\)\s*\{/);
  });

  test('creates flash ellipse with cyan color', () => {
    expect(battleJs).toMatch(/add\.ellipse\s*\([^)]*\b0x00ffff\b/);
  });

  test('flash ellipse starts with scale 0', () => {
    expect(battleJs).toMatch(/setScale\s*\(\s*0\s*\)/);
  });

  test('flash ellipse starts with alpha 1', () => {
    expect(battleJs).toMatch(/setAlpha\s*\(\s*1\s*\)/);
  });

  test('flash ellipse scale tween from 0 to 2', () => {
    expect(battleJs).toMatch(/scaleX\s*:\s*2\s*,\s*scaleY\s*:\s*2/);
  });

  test('flash ellipse alpha tween from 1 to 0', () => {
    expect(battleJs).toMatch(/alpha\s*:\s*0/);
  });

  test('flash ellipse tween duration is 200ms', () => {
    expect(battleJs).toMatch(/duration\s*:\s*200/);
  });

  test('creates particle burst white/cyan colors', () => {
    expect(battleJs).toMatch(/tint\s*:\s*\[\s*0xffffff\s*,\s*0x00ffff\s*\]/);
  });

  test('particle count is 8 (fewer than death)', () => {
    expect(battleJs).toMatch(/quantity\s*:\s*8/);
    expect(battleJs).toMatch(/explode\s*\(\s*8\s*\)/);
  });

  test('particle burst uses particle texture', () => {
    expect(battleJs).toMatch(/add\.particles\s*\([^)]*,\s*['"]particle['"]/);
  });

  test('flash ellipse destroyed after tween', () => {
    expect(battleJs).toMatch(/flashEllipse\.destroy\s*\(\s*\)/);
  });

  test('burst emitter destroyed after 400ms', () => {
    expect(battleJs).toMatch(/time\.delayedCall\s*\(\s*400/);
    expect(battleJs).toMatch(/burstEmitter\.destroy/);
  });

  test('bullet destroyed after deflect', () => {
    expect(battleJs).toMatch(/this\.destroy\s*\(\s*\)/);
  });
});