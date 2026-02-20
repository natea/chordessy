const path = require('path');
const fs = require('fs');

function getBattleJsPath() {
  const possiblePaths = [
    path.join(__dirname, '../neural-arpeggiator/dist/battle.js'),
    path.join(__dirname, '../neural-arpeggiator/src/battle.js'),
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  throw new Error('Could not find battle.js');
}

const battleJsPath = getBattleJsPath();
const battleJs = fs.readFileSync(battleJsPath, 'utf8');

describe('showComboCelebration method (T055)', () => {
  test('showComboCelebration is defined as a method', () => {
    expect(battleJs).toMatch(/showComboCelebration\s*\(\s*comboCount\s*\)/);
  });

  test('creates golden particle fountain with emitter', () => {
    expect(battleJs).toMatch(/showComboCelebration[\s\S]*?this\.add\.particles\s*\([^)]*,\s*['"]particle['"]/);
  });

  test('uses golden/orange tint colors for combo particles', () => {
    expect(battleJs).toMatch(/0xffd700|0xffaa00|0xff8800|0xffcc00/);
  });

  test('particle fountain has negative gravityY for upward effect', () => {
    expect(battleJs).toMatch(/gravityY:\s*-?\d+/);
  });

  test('particle quantity is substantial (50 or more)', () => {
    expect(battleJs).toMatch(/quantity:\s*(5[0-9]|[6-9][0-9]|100)/);
  });

  test('destroys emitter after particles expire', () => {
    expect(battleJs).toMatch(/\.destroy\s*\(\)/);
  });
});

describe('Combo celebration text (T055)', () => {
  test('creates combo text with Nx COMBO! format', () => {
    expect(battleJs).toMatch(/comboCount\s*\+\s*['"]x COMBO!['"]/);
  });

  test('combo text uses large font size (64px or more)', () => {
    expect(battleJs).toMatch(/['"]\s*6[4-9]px\s*['"]/);
  });

  test('combo text uses golden color', () => {
    expect(battleJs).toMatch(/#ffd700/);
  });

  test('combo text starts at scale 0', () => {
    expect(battleJs).toMatch(/setScale\s*\(\s*0\s*\)|\.setScale\s*\(\s*0\)/);
  });
});

describe('Combo celebration tweens (T055)', () => {
  test('has scale-up tween for combo text', () => {
    expect(battleJs).toMatch(/this\.tweens\.add\([\s\S]*?scaleX:\s*1\.[12][\s\S]*?scaleY:\s*1\.[12]/);
  });

  test('scale-up tween uses Back.Out easing', () => {
    expect(battleJs).toMatch(/Back\.Out/);
  });

  test('has fade tween for combo text', () => {
    expect(battleJs).toMatch(/alpha:\s*0/);
  });

  test('fade tween moves text upward', () => {
    expect(battleJs).toMatch(/y:\s*centerY\s*-\s*\d+/);
  });

  test('destroys combo text after completion', () => {
    expect(battleJs).toMatch(/comboText\.destroy\(\)/);
  });
});

describe('onWaveCleared triggers combo celebration (T055)', () => {
  test('onWaveCleared checks for combo milestones', () => {
    expect(battleJs).toMatch(/combo\s*%\s*5\s*===\s*0/);
  });

  test('onWaveCleared calls showComboCelebration at milestones', () => {
    expect(battleJs).toMatch(/this\.showComboCelebration\s*\(/);
  });

  test('combo > 0 check prevents celebration at zero combo', () => {
    expect(battleJs).toMatch(/this\.battleState\.combo\s*>\s*0/);
  });
});