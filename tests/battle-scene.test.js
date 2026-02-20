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

  describe('onNoteOff({ midiNote }) (T020)', () => {
    test('has onNoteOff method with midiNote parameter', () => {
      expect(battleJs).toMatch(/onNoteOff\s*\(\s*\{\s*midiNote\s*\}\s*\)\s*\{/);
    });

    test('delegates to clearLaser with midiNote', () => {
      expect(battleJs).toMatch(/this\.clearLaser\s*\(\s*midiNote\s*\)/);
    });
  });

  describe('clearLaser(midiNote) (T020)', () => {
    test('has clearLaser method with midiNote parameter', () => {
      expect(battleJs).toMatch(/clearLaser\s*\(\s*midiNote\s*\)\s*\{/);
    });

    test('gets laserData from laserGroup using midiNote', () => {
      expect(battleJs).toMatch(/let\s+laserData\s*=\s*this\.laserGroup\.get\s*\(\s*midiNote\s*\)/);
    });

    test('has guard clause to check if laserData exists', () => {
      expect(battleJs).toMatch(/if\s*\(\s*laserData\s*\)\s*\{/);
    });

    test('calls destroy on outer graphics layer', () => {
      expect(battleJs).toMatch(/if\s*\(\s*laserData\.outer\s*\)\s+laserData\.outer\.destroy\s*\(\s*\)/);
    });

    test('calls destroy on middle graphics layer', () => {
      expect(battleJs).toMatch(/if\s*\(\s*laserData\.middle\s*\)\s+laserData\.middle\.destroy\s*\(\s*\)/);
    });

    test('calls destroy on inner graphics layer', () => {
      expect(battleJs).toMatch(/if\s*\(\s*laserData\.inner\s*\)\s+laserData\.inner\.destroy\s*\(\s*\)/);
    });

    test('deletes midiNote entry from laserGroup', () => {
      expect(battleJs).toMatch(/this\.laserGroup\.delete\s*\(\s*midiNote\s*\)/);
    });
  });

  describe('Bullet class (T022)', () => {
    test('extends Phaser.GameObjects.Container', () => {
      expect(battleJs).toMatch(/class Bullet extends Phaser\.GameObjects\.Container/);
    });

    test('has speed property set to 400', () => {
      expect(battleJs).toMatch(/this\.speed\s*=\s*400/);
    });

    test('has active property set to true', () => {
      expect(battleJs).toMatch(/this\.active\s*=\s*true/);
    });

    test('has core ellipse with ~6px size and red/orange color', () => {
      expect(battleJs).toMatch(/this\.core\s*=\s*scene\.add\.ellipse\s*\(\s*0\s*,\s*0\s*,\s*6\s*,\s*6\s*,\s*0xff[0-9a-f]{4}\s*\)/);
    });

    test('has glow ellipse with ~12px size and alpha 0.3', () => {
      expect(battleJs).toMatch(/this\.glow\s*=\s*scene\.add\.ellipse\s*\(\s*0\s*,\s*0\s*,\s*12\s*,\s*12\s*/);
      expect(battleJs).toMatch(/this\.glow\.setAlpha\s*\(\s*0\.3\s*\)/);
    });

    test('has particle trail emitter with short lifespan', () => {
      expect(battleJs).toMatch(/this\.trailEmitter\s*=\s*scene\.add\.particles/);
      expect(battleJs).toMatch(/lifespan:\s*200/);
    });

    test('particle trail emitter uses red/orange tint colors', () => {
      expect(battleJs).toMatch(/tint:\s*\[\s*0xff[0-9a-f]{4}\s*,\s*0xff[0-9a-f]{4}\s*\]/);
    });

    test('adds glow and core to container', () => {
      expect(battleJs).toMatch(/this\.add\s*\(\s*\[\s*this\.glow\s*,\s*this\.core\s*\]\s*\)/);
    });

    test('Bullet class is exported to window.Chordessy', () => {
      expect(battleJs).toMatch(/C\.Bullet\s*=\s*Bullet/);
    });
  });

  describe('nextWave() (T029)', () => {
    test('has nextWave method', () => {
      expect(battleJs).toMatch(/nextWave\s*\(\s*\)\s*\{/);
    });

    test('sets waveActive to true', () => {
      expect(battleJs).toMatch(/this\.waveActive\s*=\s*true/);
    });

    test('increments wave counter', () => {
      expect(battleJs).toMatch(/this\.battleState\.wave\s*\+\+/);
    });

    test('checks for level-up every 5 waves', () => {
      expect(battleJs).toMatch(/if\s*\(\s*this\.battleState\.wave\s*%\s*5\s*===\s*0\s*\)/);
    });

    test('increments level when wave % 5 === 0', () => {
      expect(battleJs).toMatch(/this\.battleState\.level\s*\+\+/);
    });

    test('creates chord variable', () => {
      expect(battleJs).toMatch(/let chord/);
    });

    test('checks progressionMode flag', () => {
      expect(battleJs).toMatch(/if\s*\(\s*this\.battleState\.progressionMode\s*\)/);
    });

    test('for progression mode: checks if currentProgression exists or is exhausted', () => {
      expect(battleJs).toMatch(/!\s*this\.battleState\.currentProgression\s*\|\|/);
      expect(battleJs).toMatch(/this\.battleState\.progressionIndex\s*>=\s*this\.battleState\.currentProgression\.chords\.length/);
    });

    test('for progression mode exhausted: gets random progression for tier', () => {
      expect(battleJs).toMatch(/C\.getRandomProgression\s*\(\s*this\.battleState\.tier\s*\)/);
    });

    test('for progression mode exhausted: assigns to currentProgression', () => {
      expect(battleJs).toMatch(/this\.battleState\.currentProgression\s*=/);
    });

    test('for progression mode exhausted: resets progressionIndex to 0', () => {
      expect(battleJs).toMatch(/this\.battleState\.progressionIndex\s*=\s*0/);
    });

    test('for progression mode: gets symbol from currentProgression using progressionIndex', () => {
      expect(battleJs).toMatch(/this\.battleState\.currentProgression\.chords\[this\.battleState\.progressionIndex\]/);
    });

    test('for progression mode: gets chord from CHORDS map', () => {
      expect(battleJs).toMatch(/C\.CHORDS\[symbol\]/);
    });

    test('for progression mode: increments progressionIndex after selecting chord', () => {
      expect(battleJs).toMatch(/this\.battleState\.progressionIndex\s*\+\+/);
    });

    test('for random mode: calls getRandomChord with tier', () => {
      expect(battleJs).toMatch(/C\.getRandomChord\s*\(\s*this\.battleState\.tier\s*\)/);
    });

    test('converts chord symbol to midi notes using chordToMidiNotes', () => {
      expect(battleJs).toMatch(/C\.chordToMidiNotes\s*\(\s*chord\.symbol\s*\)/);
    });

    test('stores midi notes in variable', () => {
      expect(battleJs).toMatch(/let midiNotes\s*=\s*C\.chordToMidiNotes/);
    });

    test('checks if midiNotes length is 0', () => {
      expect(battleJs).toMatch(/if\s*\(\s*midiNotes\.length\s*===\s*0\s*\)/);
    });

    test('handles skipped waves with _skipCount', () => {
      expect(battleJs).toMatch(/this\.battleState\._skipCount/);
    });

    test('increments _skipCount when midiNotes is empty', () => {
      expect(battleJs).toMatch(/this\.battleState\._skipCount\s*=\s*\(/);
      expect(battleJs).toMatch(/this\.battleState\._skipCount\s*\|\|\s*0\s*\)\s*\+\s*1/);
    });

    test('calls nextWave recursively if _skipCount < 20', () => {
      expect(battleJs).toMatch(/this\.battleState\._skipCount\s*<\s*20/);
      expect(battleJs).toMatch(/this\.nextWave\s*\(\s*\)\s*;\s*return/);
    });

    test('sets _skipCount to 0 on successful wave', () => {
      expect(battleJs).toMatch(/this\.battleState\._skipCount\s*=\s*0/);
    });

    test('calls bridge.setTargetChord with symbol and midiNotes', () => {
      expect(battleJs).toMatch(/this\.bridge\.setTargetChord\s*\(\s*chord\.symbol\s*,\s*midiNotes\s*\)/);
    });

    test('plays chord audio if bridge and audio exist', () => {
      expect(battleJs).toMatch(/this\.bridge\.audio\.playChord/);
    });

    test('gets chord-prompt element from DOM', () => {
      expect(battleJs).toMatch(/document\.getElementById\s*\(\s*['"]chord-prompt['"]\s*\)/);
    });

    test('updates chord-prompt textContent with chord name', () => {
      expect(battleJs).toMatch(/chordPrompt\.textContent\s*=\s*chord\.name/);
    });

    test('gets progression-info element from DOM', () => {
      expect(battleJs).toMatch(/document\.getElementById\s*\(\s*['"]progression-info['"]\s*\)/);
    });

    test('updates progression-info for progression mode', () => {
      expect(battleJs).toMatch(/if\s*\(\s*this\.battleState\.progressionMode/);
      expect(battleJs).toMatch(/progressionInfo\.textContent\s*=\s*this\.battleState\.currentProgression\.name/);
    });

    test('displays progression index and length', () => {
      expect(battleJs).toMatch(/this\.battleState\.progressionIndex\s*\/\s*this\.battleState\.currentProgression\.chords\.length/);
    });

    test('shows progression-info element in progression mode', () => {
      expect(battleJs).toMatch(/progressionInfo\.style\.display\s*=\s*[''' ]/);
    });

    test('hides progression-info element in random mode', () => {
      expect(battleJs).toMatch(/progressionInfo\.style\.display\s*=\s*['"]none['"]/);
    });

    test('calls spawnEnemies with midiNotes and level', () => {
      expect(battleJs).toMatch(/this\.spawnEnemies\s*\(\s*midiNotes\s*,\s*this\.battleState\.level\s*\)/);
    });

    test('records waveStartTime using Phaser time', () => {
      expect(battleJs).toMatch(/this\.battleState\.waveStartTime\s*=\s*this\.time\.now/);
    });

    test('schedules bullet spawn for levels <= 9', () => {
      expect(battleJs).toMatch(/if\s*\(\s*this\.battleState\.level\s*<=\s*9\s*\)/);
    });

    test('calculates lastEnemySpawnDelay', () => {
      expect(battleJs).toMatch(/let lastEnemySpawnDelay\s*=\s*\(\s*midiNotes\.length\s*-\s*1\s*\)\s*\*\s*100/);
    });

    test('uses time.delayedCall for bullet scheduling', () => {
      expect(battleJs).toMatch(/this\.time\.delayedCall/);
    });

    test('calls spawnBullet with level after delay', () => {
      expect(battleJs).toMatch(/this\.spawnBullet\s*\(\s*this\.battleState\.level\s*\)/);
    });

    test('delay for bullet is lastEnemySpawnDelay + 1000ms', () => {
      expect(battleJs).toMatch(/lastEnemySpawnDelay\s*\+\s*1000/);
    });
  });

  describe('onBulletHit() (T031)', () => {
    test('has onBulletHit method', () => {
      expect(battleJs).toMatch(/onBulletHit\s*\(\s*\)\s*\{/);
    });

    test('decrements HP', () => {
      expect(battleJs).toMatch(/this\.battleState\.hp\s*--/);
    });

    test('resets combo to 0', () => {
      expect(battleJs).toMatch(/this\.battleState\.combo\s*=\s*0/);
    });

    test('calls renderLives()', () => {
      expect(battleJs).toMatch(/this\.renderLives\s*\(\s*\)/);
    });

    test('calls updateHUD()', () => {
      expect(battleJs).toMatch(/this\.updateHUD\s*\(\s*\)/);
    });

    test('flashes screen red', () => {
      expect(battleJs).toMatch(/this\.cameras\.main\.flash\s*\(\s*200\s*,\s*255\s*,\s*0\s*,\s*0\s*\)/);
    });

    test('checks if HP <= 0', () => {
      expect(battleJs).toMatch(/if\s*\(\s*this\.battleState\.hp\s*<=\s*0\s*\)/s);
    });

    test('calls bridge.onGameOver() when HP <= 0', () => {
      expect(battleJs).toMatch(/this\.bridge\.onGameOver\s*\(\s*\)/);
    });

    test('has else branch for HP > 0', () => {
      expect(battleJs).toMatch(/}\s*else\s*{/);
    });

    test('checks level range 1-9 in else branch', () => {
      expect(battleJs).toMatch(/this\.battleState\.level\s*>=\s*1\s*&&\s*this\.battleState\.level\s*<=\s*9/);
    });

    test('sets waveActive to false at levels 1-9', () => {
      expect(battleJs).toMatch(/this\.waveActive\s*=\s*false/);
    });

    test('clears enemies by destroying alive ones at levels 1-9', () => {
      expect(battleJs).toMatch(/this\.enemies\.forEach\s*\(\s*enemy\s*=>\s*\{[\s\S]*if\s*\(\s*enemy\s*&&\s*enemy\.alive\s*\)[\s\S]*enemy\.destroy/);
    });

    test('resets enemies array at levels 1-9', () => {
      expect(battleJs).toMatch(/this\.enemies\s*=\s*\[\]/);
    });

    test('clears laserGroup by destroying graphics at levels 1-9', () => {
      expect(battleJs).toMatch(/for.*midiNote.*laserData.*of.*this\.laserGroup/);
      expect(battleJs).toMatch(/laserData\.outer.*laserData\.outer\.destroy/);
    });

    test('clears laserGroup using clear method', () => {
      expect(battleJs).toMatch(/this\.laserGroup\.clear\s*\(\s*\)/);
    });

    test('gets random chord at levels 1-9', () => {
      expect(battleJs).toMatch(/C\.getRandomChord\s*\(\s*this\.battleState\.tier\s*\)/);
    });

    test('converts chord to midi notes at levels 1-9', () => {
      expect(battleJs).toMatch(/C\.chordToMidiNotes\s*\(\s*chord\.symbol\s*\)/);
    });

    test('calls bridge.setTargetChord at levels 1-9', () => {
      expect(battleJs).toMatch(/this\.bridge\.setTargetChord\s*\(\s*chord\.symbol\s*,\s*midiNotes\s*\)/);
    });

    test('plays chord audio at levels 1-9', () => {
      expect(battleJs).toMatch(/this\.bridge\.audio\.playChord/);
    });

    test('updates chord-prompt textContent at levels 1-9', () => {
      expect(battleJs).toMatch(/chordPrompt\.textContent\s*=\s*chord\.name/);
    });

    test('calls spawnEnemies with new chord at levels 1-9', () => {
      expect(battleJs).toMatch(/this\.spawnEnemies\s*\(\s*midiNotes\s*,\s*this\.battleState\.level\s*\)/);
    });
  });

  describe('startBulletFire(level) (T034)', () => {
    test('has startBulletFire method with level parameter', () => {
      expect(battleJs).toMatch(/startBulletFire\s*\(\s*level\s*\)\s*\{/);
    });

    test('checks if level < 10', () => {
      expect(battleJs).toMatch(/if\s*\(\s*level\s*<\s*10\s*\)/);
    });

    test('for level < 10: uses time.delayedCall with 1000ms delay', () => {
      expect(battleJs).toMatch(/this\.time\.delayedCall\s*\(\s*1000/);
    });

    test('for level < 10: calls spawnBullet(level) after delay', () => {
      expect(battleJs).toMatch(/this\.spawnBullet\s*\(\s*level\s*\)/);
    });

    test('for level >= 10: initializes bulletEvents array', () => {
      expect(battleJs).toMatch(/this\.bulletEvents\s*=\s*this\.bulletEvents\s*\|\|\s*\[\]/);
    });

    test('for level >= 10: clears existing bullet events', () => {
      expect(battleJs).toMatch(/this\.bulletEvents\.forEach\s*\(\s*event\s*=>\s*event\.remove\s*\(\s*\)\s*\)/);
      expect(battleJs).toMatch(/this\.bulletEvents\s*=\s*\[\]/);
    });

    test('for level >= 10: iterates over enemies with index', () => {
      expect(battleJs).toMatch(/this\.enemies\.forEach\s*\(\s*\(\s*enemy\s*,\s*index\s*\)\s*=>\s*\{/);
    });

    test('for level >= 10: checks if enemy is alive', () => {
      expect(battleJs).toMatch(/if\s*\(\s*enemy\s*&&\s*enemy\.alive\s*\)/);
    });

    test('for level >= 10: uses time.addEvent with loop', () => {
      expect(battleJs).toMatch(/this\.time\.addEvent\s*\(\s*\{/);
      expect(battleJs).toMatch(/loop:\s*true/);
    });

    test('for level >= 10: staggered delay using index', () => {
      expect(battleJs).toMatch(/delay:\s*2000\s*\+\s*index\s*\*\s*400/);
    });

    test('for level >= 10: creates Bullet with enemy position', () => {
      expect(battleJs).toMatch(/let bullet\s*=\s*new\s*Bullet\s*\(\s*this\s*,\s*enemy\.x\s*,\s*enemy\.y\s*\)/);
    });

    test('for level >= 10: sets bullet speed based on battleState', () => {
      expect(battleJs).toMatch(/this\.battleState\.bulletSpeed\s*\+\s*this\.battleState\.level\s*\*\s*8/);
    });

    test('for level >= 10: fires bullet downward', () => {
      expect(battleJs).toMatch(/bullet\.fire\s*\(\s*0\s*,\s*1\s*\)/);
    });

    test('for level >= 10: pushes bullet to bullets array', () => {
      expect(battleJs).toMatch(/this\.bullets\.push\s*\(\s*bullet\s*\)/);
    });

    test('for level >= 10: stores event in bulletEvents array', () => {
      expect(battleJs).toMatch(/this\.bulletEvents\.push\s*\(\s*bulletEvent\s*\)/);
    });
  });
});