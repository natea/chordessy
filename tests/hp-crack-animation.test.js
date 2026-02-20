/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const battleJs = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'battle.js'),
  'utf-8'
);

const battleCss = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'battle.css'),
  'utf-8'
);

describe('HP crack animation (T054)', () => {
  describe('CSS Animation for HP bar shake', () => {
    test('HP bar has shake class defined', () => {
      expect(battleCss).toMatch(/\.hp-bar\.shake/);
    });

    test('hpShake keyframe animation is defined', () => {
      expect(battleCss).toMatch(/@keyframes hpShake/);
    });

    test('hpShake animation includes shake movement', () => {
      expect(battleCss).toMatch(/transform:\s*translateX\([^)]*\)/);
    });

    test('hpShake animation duration is 0.3s', () => {
      expect(battleCss).toMatch(/animation:\s*hpShake\s+0\.3s/);
    });

    test('hpShake animation shakes left and right', () => {
      expect(battleCss).toMatch(/transform:\s*translateX\(-3px\)/);
      expect(battleCss).toMatch(/transform:\s*translateX\(\s*3px\)/);
    });
  });

  describe('CSS Animation for HP text flash red', () => {
    test('lives-display has flash-red class defined', () => {
      expect(battleCss).toMatch(/#lives-display\.flash-red/);
    });

    test('hpFlashRed keyframe animation is defined', () => {
      expect(battleCss).toMatch(/@keyframes hpFlashRed/);
    });

    test('hpFlashRed animation starts with red color', () => {
      expect(battleCss).toMatch(/color:\s*#ff0000/);
      expect(battleCss).toMatch(/text-shadow:[^}]*rgba\(255,\s*0,\s*0/);
    });

    test('hpFlashRed animation ends with white color', () => {
      expect(battleCss).toMatch(/color:\s*#fff/);
      expect(battleCss).toMatch(/text-shadow:[^}]*rgba\(255,\s*255,\s*255/);
    });

    test('hpFlashRed animation includes text-shadow glow', () => {
      expect(battleCss).toMatch(/text-shadow:\s*0\s+0\s+15px/);
    });
  });

  describe('JavaScript - onBulletHit method', () => {
    test('onBulletHit method exists in BattleScene', () => {
      expect(battleJs).toMatch(/onBulletHit\s*\(\s*\)\s*\{/);
    });

    test('onBulletHit decrements HP', () => {
      expect(battleJs).toMatch(/this\.battleState\.hp--/);
    });

    test('onBulletHit resets combo to 0', () => {
      expect(battleJs).toMatch(/this\.battleState\.combo\s*=\s*0/);
    });

    test('onBulletHit calls updateHUD', () => {
      expect(battleJs).toMatch(/this\.updateHUD\s*\(\s*\)/);
    });

    test('onBulletHit triggers HP animation', () => {
      expect(battleJs).toMatch(/this\.triggerHPAnimation\s*\(\s*\)/);
    });

    test('onBulletHit checks for game over when HP hits 0', () => {
      expect(battleJs).toMatch(/if\s*\(\s*this\.battleState\.hp\s*<=\s*0\s*\)/);
      expect(battleJs).toMatch(/this\.onGameOver\s*\(\s*\)/);
    });
  });

  describe('JavaScript - triggerHPAnimation method', () => {
    test('triggerHPAnimation method exists in BattleScene', () => {
      expect(battleJs).toMatch(/triggerHPAnimation\s*\(\s*\)\s*\{/);
    });

    test('triggerHPAnimation gets HP bar element', () => {
      expect(battleJs).toMatch(/let hpBar\s*=\s*document\.getElementById\(['"]hp-bar['"]\)/);
    });

    test('triggerHPAnimation gets lives display element', () => {
      expect(battleJs).toMatch(/let livesDisplay\s*=\s*document\.getElementById\(['"]lives-display['"]\)/);
    });

    test('triggerHPAnimation adds shake class to HP bar', () => {
      expect(battleJs).toMatch(/hpBar\.classList\.add\(['"]shake['"]\)/);
    });

    test('triggerHPAnimation removes and re-adds shake class to restart animation', () => {
      expect(battleJs).toMatch(/hpBar\.classList\.remove\(['"]shake['"]\)/);
      expect(battleJs).toMatch(/hpBar\.classList\.add\(['"]shake['"]\)/);
    });

    test('triggerHPAnimation uses void offsetWidth to force reflow', () => {
      expect(battleJs).toMatch(/void\s+hpBar\.offsetWidth/);
    });

    test('triggerHPAnimation adds flash-red class to lives display', () => {
      expect(battleJs).toMatch(/livesDisplay\.classList\.add\(['"]flash-red['"]\)/);
    });

    test('triggerHPAnimation removes and re-adds flash-red class to restart animation', () => {
      expect(battleJs).toMatch(/livesDisplay\.classList\.remove\(['"]flash-red['"]\)/);
      expect(battleJs).toMatch(/livesDisplay\.classList\.add\(['"]flash-red['"]\)/);
    });

    test('triggerHPAnimation uses void offsetWidth for lives display', () => {
      expect(battleJs).toMatch(/void\s+livesDisplay\.offsetWidth/);
    });

    test('triggerHPAnimation gets battle-container element', () => {
      expect(battleJs).toMatch(/let\s+.*\s*=\s*document\.getElementById\(['"]battle-container['"]\)/);
    });

    test('triggerHPAnimation adds damage-flash class to container', () => {
      expect(battleJs).toMatch(/classList\.add\(['"]damage-flash['"]\)/);
    });

    test('triggerHPAnimation removes damage-flash class after delay', () => {
      expect(battleJs).toMatch(/classList\.remove\(['"]damage-flash['"]\)/);
      expect(battleJs).toMatch(/this\.time\.delayedCall\(\s*300/);
    });
  });

  describe('Integration - bullet hit triggers animations', () => {
    test('onBulletHit is called when bullet hits bottom of screen', () => {
      expect(battleJs).toMatch(/if\s*\(\s*bullet\.y\s*>\s*this\.sceneHeight\s*\)\s*\{[\s\S]*this\.onBulletHit\(\s*\)/);
    });
  });

  describe('damage-flash animation', () => {
    test('battle-container has damage-flash class defined', () => {
      expect(battleCss).toMatch(/#battle-container\.damage-flash/);
    });

    test('damageFlash keyframe animation is defined', () => {
      expect(battleCss).toMatch(/@keyframes damageFlash/);
    });

    test('damageFlash animation shows red background overlay', () => {
      expect(battleCss).toMatch(/background-color:\s*rgba\(255,\s*0,\s*0,\s*0\.3\)/);
    });

    test('damageFlash animation fades to transparent', () => {
      expect(battleCss).toMatch(/background-color:\s*transparent/);
    });

    test('damageFlash animation duration matches the delay (300ms)', () => {
      expect(battleCss).toMatch(/animation:\s*damageFlash\s+300ms/);
    });
  });
});