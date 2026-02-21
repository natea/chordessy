# Chordessy Battle Mode - Implementation Plan

**Date:** 2026-02-19
**Design doc:** `docs/plans/2026-02-19-battle-mode-design.md`
**Target files:** `neural-arpeggiator/dist/battle.html`, `battle.js`, `battle.css`
**Reused files:** `shared.js`, `chords-db.js`

---

## Milestone 0: File Scaffolding

**Goal:** Create the three new files with their skeleton structure, load all dependencies, and confirm the page loads without errors.

### Files created
- `neural-arpeggiator/dist/battle.html`
- `neural-arpeggiator/dist/battle.js`
- `neural-arpeggiator/dist/battle.css`

### Files modified
- None yet (navigation links come in Milestone 11)

### battle.html structure

```
DOCTYPE, meta, viewport
<link> Abel font, style.css (shared keyboard styles), battle.css
CDN scripts (same as game.html):
  lodash, magentamusic, web-animations, webmidi, audiokeys, startaudiocontext, tonal
NEW: Phaser 3 CDN (<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js">)

<body>
  <div id="battle-container">
    <!-- HUD bar (HTML, not Phaser) -->
    <div id="battle-hud">
      <div class="hud-left">
        <span class="level-badge">Wave <span id="wave-num">1</span></span>
        <span class="tier-badge" id="tier-badge">Triads</span>
      </div>
      <div class="hud-center">
        <div class="score-display"><span id="score">0</span> <span class="score-label">pts</span></div>
        <div class="combo-display" id="combo-display" style="display:none">
          <span id="combo-count">0</span>x combo
        </div>
      </div>
      <div class="hud-right">
        <div id="hp-bar-container"><div id="hp-bar"></div></div>
        <div id="hp-text">5 / 5</div>
      </div>
    </div>

    <!-- Phaser canvas mount point -->
    <div id="phaser-container"></div>

    <!-- Chord prompt area (HTML, between canvas and keyboard) -->
    <div id="chord-prompt">
      <div id="prompt-chord-name"></div>
      <div id="prompt-chord-notes"></div>
      <div id="progression-info" style="display:none"></div>
    </div>

    <!-- Piano keyboard (HTML, existing shared.js buildKeyboard) -->
    <div class="battle-keyboard-area">
      <div class="keyboard battle-keyboard" id="battle-keyboard"></div>
    </div>

    <!-- Start screen overlay -->
    <div id="battle-start-screen"> ... tier buttons, progression toggle, MIDI status ... </div>

    <!-- Game over overlay -->
    <div id="battle-game-over" style="display:none"> ... score, stats, play again ... </div>
  </div>

  <script src="shared.js"></script>
  <script src="chords-db.js"></script>
  <script src="battle.js"></script>
</body>
```

### battle.css skeleton

```css
/* Layout: flexbox column, 4 zones */
#battle-container { display: flex; flex-direction: column; height: 100vh; }
#battle-hud       { flex: 0 0 auto; /* ~50px */ }
#phaser-container  { flex: 1 1 auto; /* fills remaining */ }
#chord-prompt      { flex: 0 0 auto; /* ~80px */ }
.battle-keyboard-area { flex: 0 0 220px; }
```

### battle.js skeleton

```javascript
window.Chordessy = window.Chordessy || {};

(function(C) {
  'use strict';

  // --- Constants ---
  // --- State ---
  // --- Phaser Config & Scene stubs ---
  // --- BattleBridge class (empty) ---
  // --- DOMContentLoaded -> init() ---

})(window.Chordessy);
```

### Key functions/classes
- `init()` -- build keyboard, setup audio, setup MIDI, instantiate Phaser game
- Phaser config object with `parent: 'phaser-container'`, `type: Phaser.AUTO`, `transparent: true`

### Dependencies on previous milestones
- None (this is the first milestone)

### Success criteria
- `battle.html` loads in browser without console errors
- Phaser canvas appears (even if blank/black) in the `#phaser-container` div
- HTML piano keyboard renders below it with correct styling
- HUD bar and chord prompt areas visible with placeholder text
- Page layout is 4-zone vertical split (HUD / canvas / prompt / keyboard)

---

## Milestone 1: Phaser 3 Scene Setup and Canvas Integration

**Goal:** Create the Phaser game instance with a single `BattleScene`, properly sized to fit between the HUD and the chord prompt. Background star field scrolls.

### Files modified
- `battle.js` -- add Phaser config, `BattleScene` class
- `battle.css` -- canvas sizing rules

### Key functions/classes

**`BattleScene extends Phaser.Scene`**
- `preload()` -- no assets to load (all procedural/geometric), but reserve for future
- `create()` -- set world bounds, create star field particle emitter, store scene dimensions
- `update(time, delta)` -- star field scroll tick

**`createPhaserGame()`**
- Reads `#phaser-container` dimensions via `getBoundingClientRect()`
- Creates Phaser.Game with `width` and `height` from the container
- `scale.mode = Phaser.Scale.RESIZE` to handle window resize
- `transparent: true` background (CSS gradient shows through) OR solid dark background matching theme

**Canvas resize handler**
- `window.addEventListener('resize', ...)` recalculates container size
- Calls `game.scale.resize(width, height)` and notifies bridge to remap key positions

**Star field**
- Phaser graphics: ~100 small white circles at random positions
- Each star has a random speed; stars that scroll off bottom respawn at top
- Alternatively use Phaser's built-in particle emitter with a tiny white dot texture generated via `this.textures.createCanvas()`

### Dependencies
- Milestone 0 (page loads, Phaser CDN present)

### Success criteria
- Phaser canvas fills exactly the space between HUD bar and chord prompt
- Star field animates smoothly in the background
- Resizing the browser window resizes the canvas proportionally
- No overlap between canvas and HTML elements (keyboard, HUD, prompt)

---

## Milestone 2: BattleBridge Event System

**Goal:** Build the bridge layer that connects the HTML piano keyboard and MIDI/QWERTY input system to Phaser scene events. This is the critical integration layer.

### Files modified
- `battle.js` -- add `BattleBridge` class, wire input handlers

### Key functions/classes

**`class BattleBridge`**

Constructor takes: `{ scene, keyboardContainer, keyElements }`

**Properties:**
- `keyXMap: Map<midiNote, { x, width, isAccidental }>` -- maps each MIDI note to its pixel x-position (center) relative to the Phaser canvas
- `heldNotes: Set<number>` -- currently held MIDI notes
- `targetMidi: number[]` -- current target chord's MIDI notes
- `emitter: Phaser.Events.EventEmitter` -- internal event bus

**Methods:**
- `buildKeyXMap()` -- iterates all `.key` elements in the keyboard container, reads `getBoundingClientRect()`, converts to Phaser canvas-relative x coordinates. Accounts for the offset between the keyboard container's left edge and the Phaser canvas left edge. Stores `{ x: centerX, width, isAccidental }` per MIDI note.
- `rebuildKeyXMap()` -- called on resize
- `getKeyX(midiNote)` -- returns the x pixel position in Phaser canvas coords for a given MIDI note. For notes not physically on the keyboard (out of range), interpolates/extrapolates from nearest keys.
- `noteOn(midiNote)` -- adds to `heldNotes`, emits `'noteOn'` event with `{ midiNote, x, isCorrect }`
- `noteOff(midiNote)` -- removes from `heldNotes`, emits `'noteOff'` event with `{ midiNote }`
- `setTargetChord(chordSymbol, midiNotes)` -- stores target, emits `'newTarget'`
- `checkChord()` -- uses `C.pitchClassesMatch()` to compare held notes vs target. If match, emits `'chordComplete'`. Also checks for wrong notes (held notes not in target pitch classes) and emits `'wrongNote'`.
- `onBulletHit()` -- called from Phaser side, emits `'bulletHit'`
- `onWaveCleared()` -- called from Phaser side, emits `'waveCleared'`
- `onGameOver()` -- called from Phaser side, emits `'gameOver'`

**Input wiring in `init()`:**
- MIDI: `midi.onNoteOn(note => bridge.noteOn(note))` / `onNoteOff`
- QWERTY: same `QWERTY_MAP` as game.js, `keydown`/`keyup` handlers call `bridge.noteOn`/`noteOff`
- Mouse/touch: same pattern as game.js `setupMouseInput()`, calls `bridge.noteOn`/`noteOff`
- All input also triggers `audio.playNote()` and keyboard visual feedback (`.pressed` class)

**Coordinate mapping detail:**
- The keyboard's left edge in viewport coords: `keyboardContainer.getBoundingClientRect().left`
- The Phaser canvas left edge: `phaserContainer.getBoundingClientRect().left`
- For each key: `canvasRelativeX = keyRect.left + keyRect.width/2 - canvasRect.left`
- The y-coordinate for enemy/laser origin is determined by the Phaser scene (top of canvas = enemies, bottom of canvas = laser origin)

### Dependencies
- Milestone 0 (keyboard built, input wired)
- Milestone 1 (Phaser scene exists to receive events)

### Success criteria
- `bridge.buildKeyXMap()` produces a correct mapping: for MIDI note 60 (C4), the x-position matches the center of the C4 key element
- Pressing a key on the HTML keyboard (via MIDI, QWERTY, or mouse) logs `noteOn` events on the bridge emitter with correct `{ midiNote, x }` data
- Releasing a key logs `noteOff`
- `bridge.checkChord()` correctly detects when held notes match a target chord
- Resizing the window and calling `rebuildKeyXMap()` produces updated positions

---

## Milestone 3: Enemy Spawning and Key-Aligned Positioning

**Goal:** Enemies spawn in the Phaser canvas at x-positions aligned with their corresponding piano keys. White-key enemies sit in one row, black-key enemies in a higher row.

### Files modified
- `battle.js` -- add `Enemy` class, enemy spawning logic in `BattleScene`

### Key functions/classes

**`class Enemy extends Phaser.GameObjects.Container`**

Constructor takes: `scene, midiNote, x, y, isAccidental`

**Child objects (all Phaser primitives):**
- `glow: Phaser.GameObjects.Ellipse` -- outer glow circle, alpha 0.3, larger radius
- `body: Phaser.GameObjects.Ellipse` or `Phaser.GameObjects.Polygon` (hexagon) -- main shape
  - White-key enemies: radius ~20px, full brightness cyan/white tint
  - Black-key enemies: radius ~16px, purple/magenta tint
- `label: Phaser.GameObjects.Text` -- note name text (hidden by default, shown at level 15+)

**Properties:**
- `midiNote: number`
- `isAccidental: boolean`
- `alive: boolean`

**Methods:**
- `spawnAnimation()` -- tween: fade in alpha 0->1, y drops from off-screen to target row position over ~500ms with `Phaser.Math.Easing.Back.Out`
- `die()` -- triggers death particle burst, sets `alive = false`, destroys after animation
- `showLabel()` -- makes the note name text visible (for level 15+ random positioning)

**Enemy row positioning:**
- White-key row: `canvasHeight * 0.35` (about 1/3 from top)
- Black-key row: `canvasHeight * 0.20` (higher, mimicking piano layout)
- x-position: read from `bridge.getKeyX(midiNote)`

**`BattleScene.spawnEnemies(midiNotes, level)`**
- Clears any existing enemies
- For each MIDI note in the target chord:
  - If level < 15: x = `bridge.getKeyX(midiNote)`, y = row based on accidental
  - If level >= 15: x = random position within canvas width (with padding), y = random within top 40% of canvas, label visible
- Creates `Enemy` instances, stores in `this.enemies[]` array
- Staggers spawn animations by ~100ms per enemy

### Dependencies
- Milestone 2 (bridge provides `getKeyX()` mapping)

### Success criteria
- When a chord is set as target (e.g., "C major" = C4, E4, G4), three enemies appear above the C, E, and G keys
- White-key enemies (C, E, G) appear at the standard row height
- Black-key enemies (e.g., in Bb chord: Bb is accidental) appear at the higher row
- Enemies animate into position with a drop-in effect
- At simulated level 15+, enemies appear at random x-positions with note labels visible

---

## Milestone 4: Laser Rendering

**Goal:** When a player presses a correct note, a persistent neon laser beam draws from the key's position at the bottom of the canvas up to the corresponding enemy. Wrong notes flash red.

### Files modified
- `battle.js` -- add `Laser` management in `BattleScene`, respond to bridge `noteOn`/`noteOff`

### Key functions/classes

**Laser rendering approach:**
- Use `Phaser.GameObjects.Graphics` for each active laser beam
- OR use `Phaser.GameObjects.Line` with glow effect via pipeline/shader or layered semi-transparent lines

**Recommended: layered line approach for glow**
- Outer line: wide (6px), low alpha (0.2), neon cyan color `0x00ffff`
- Middle line: medium (3px), medium alpha (0.5), brighter cyan
- Inner line: thin (1px), full alpha (1.0), white

**`BattleScene.laserGroup: Map<midiNote, { outer, middle, inner }>`**

**`BattleScene.onNoteOn(midiNote, x, isCorrect)`**
- If `isCorrect` (midiNote's pitch class is in the target chord's pitch classes):
  - Find the matching enemy for this pitch class
  - Calculate laser start: `{ x: bridge.getKeyX(midiNote), y: canvasHeight }` (bottom of canvas, aligned with key)
  - Calculate laser end: `{ x: enemy.x, y: enemy.y }` (the enemy position)
  - Create three layered lines from start to end
  - Store in `laserGroup` keyed by midiNote
  - Add subtle pulsing tween on alpha of outer line
- If `!isCorrect`:
  - Brief red flash column at that x-position (vertical red rectangle, alpha tween 0.5->0 over 300ms)

**`BattleScene.onNoteOff(midiNote)`**
- Remove laser lines for that midiNote from `laserGroup`
- Destroy the game objects

**`BattleScene.onChordComplete()`**
- All active lasers pulse to maximum brightness (tween alpha to 1.0 briefly)
- After 200ms, trigger enemy death sequence (Milestone 3 `enemy.die()`)
- Clear all lasers

**Note about pitch-class matching for lasers:**
- Player may press C4 or C5, both should fire a laser to the "C" enemy
- Laser x-position comes from the actual key pressed (bridge provides this)
- Laser end-point is the enemy whose pitch class matches, regardless of octave

### Dependencies
- Milestone 2 (bridge events: `noteOn`, `noteOff`, `chordComplete`)
- Milestone 3 (enemies exist at known positions)

### Success criteria
- Pressing C4 when "C major" is the target draws a cyan laser from the C4 key to the C enemy
- Pressing E4 draws a second laser to the E enemy
- Both lasers persist simultaneously while keys are held
- Releasing C4 removes only the C laser; E laser remains
- Pressing a wrong note (e.g., F4) flashes a red column at the F key position, no laser drawn
- When all three notes of C major are held, `chordComplete` fires and all lasers pulse bright before enemies explode

---

## Milestone 5: Bullet Mechanics

**Goal:** Enemies fire bullets downward. The player must play the correct chord before bullets reach the bottom. Correct chord destroys all bullets. Missed bullets deal damage.

### Files modified
- `battle.js` -- add `Bullet` class, bullet spawning/updating in `BattleScene`

### Key functions/classes

**`class Bullet extends Phaser.GameObjects.Container`**

Constructor takes: `scene, x, y, speed`

**Child objects:**
- `core: Phaser.GameObjects.Ellipse` -- small red/orange circle, radius ~6px
- `glow: Phaser.GameObjects.Ellipse` -- outer glow, radius ~12px, alpha 0.3
- `trail: Phaser.GameObjects.Particles.ParticleEmitter` -- small particle trail following the bullet (red/orange particles, short lifespan)

**Properties:**
- `speed: number` -- pixels per second
- `active: boolean`

**Methods:**
- `update(delta)` -- move `y += speed * delta / 1000`; if `y > canvasHeight`, emit `'bulletHit'`
- `deflect()` -- particle burst (shatter effect), set `active = false`, destroy
- `destroy()` -- clean up particles

**Bullet spawning logic in `BattleScene`:**

**Levels 1-9 (single bullet, real-time pressure):**
- After enemies spawn and a brief ~1000ms "ready beat" delay:
- Pick a random enemy from the current wave
- Create a `Bullet` at that enemy's position
- Bullet speed: `baseSpeed + (level * speedIncrement)` where `baseSpeed = 40px/s`, `speedIncrement = 8px/s`
- Only one bullet active at a time

**Level 10+ (continuous assault):**
- After the ready beat, each enemy fires independently on a staggered timer
- `fireInterval = Math.max(800, 2500 - (level - 10) * 200)` milliseconds between shots per enemy
- Multiple bullets can be active simultaneously
- All stored in `this.bullets[]` array

**`BattleScene.update(time, delta)` bullet loop:**
```
for each bullet in this.bullets:
  bullet.update(delta)
  if bullet.y > canvasHeight:
    bridge.onBulletHit()
    bullet.destroy()
    remove from array
```

**On `chordComplete`:**
- All active bullets call `deflect()` (shatter animation)
- Clear `this.bullets[]`
- All enemies call `die()`

**On `bulletHit` (reached bottom):**
- Bridge emits event, game state handler decrements HP
- Screen flash red (CSS class on `#battle-container`, removed after 300ms)
- Current wave stays active (new chord does NOT spawn -- same enemies remain)
- At level 10+, additional bullets keep coming

### Dependencies
- Milestone 3 (enemies exist to fire from)
- Milestone 2 (bridge events for `chordComplete`, `bulletHit`)

### Success criteria
- At level 1, one bullet fires from a random enemy ~1s after enemies spawn
- Bullet drifts downward at a visible, steady speed
- Playing the correct chord before bullet reaches bottom destroys the bullet with a shatter effect
- Letting the bullet reach the bottom triggers the `bulletHit` event
- At simulated level 10+, multiple bullets fire from different enemies at staggered intervals
- All active bullets are destroyed when the chord is completed

---

## Milestone 6: HP System, Scoring, Combo, and Wave Progression

**Goal:** Implement the complete game state management: HP tracking, score calculation with speed bonus and combo multiplier, wave counter, and level-up logic.

### Files modified
- `battle.js` -- add state management, HUD update functions

### Key functions/classes

**Game state object:**
```javascript
const battleState = {
  running: false,
  tier: 1,
  wave: 0,
  level: 1,
  score: 0,
  hp: 5,
  maxHp: 5,
  combo: 0,
  bestCombo: 0,
  wavesCleared: 0,
  wavesMissed: 0,
  waveStartTime: 0,
  progressionMode: false,
  currentProgression: null,
  progressionIndex: 0,
  bulletSpeed: 40
};
```

**`startBattle(tier)`**
- Reset all state
- Read progression mode checkbox
- Hide start screen, show HUD
- Call `nextWave()`

**`nextWave()`**
- Increment `battleState.wave`
- Check level-up: every 5 waves, `battleState.level++`
- Pick chord (random or progression -- see Milestone 8)
- Set `bridge.setTargetChord(symbol, midiNotes)`
- Update chord prompt display
- Tell scene to spawn enemies
- Record `battleState.waveStartTime = performance.now()`
- After ready beat delay, tell scene to start bullet fire

**`onWaveCleared()`** (bridge event handler)
- Calculate score:
  - `basePoints = 100`
  - `timeElapsed = performance.now() - battleState.waveStartTime`
  - `speedBonus = Math.max(0, Math.round(50 * (1 - timeElapsed / maxTime)))` where `maxTime` depends on bullet travel time
  - `comboMultiplier = Math.min(battleState.combo + 1, 10)`
  - `totalPoints = (basePoints + speedBonus) * comboMultiplier`
- `battleState.score += totalPoints`
- `battleState.combo++`
- `battleState.wavesCleared++`
- Update HUD (score, combo display, wave number)
- Show floating score popup
- After 500ms celebration delay, call `nextWave()`

**`onBulletHit()`** (bridge event handler)
- `battleState.hp--`
- `battleState.combo = 0`
- Update HP bar and combo display
- If `battleState.hp <= 0`: call `onGameOver()`
- Else: at levels 1-9, clear current wave and spawn new chord after delay; at level 10+, keep going (enemies and remaining bullets stay)

**`onGameOver()`**
- `battleState.running = false`
- Stop all scene activity (clear enemies, bullets, lasers)
- Bridge emits `gameOver`
- Show game over overlay with final stats

**HUD update functions:**
- `updateScoreDisplay()` -- sets `#score` text
- `updateHPBar()` -- sets `#hp-bar` width as percentage of `hp/maxHp`, adds color class (green > 60%, yellow > 20%, red <= 20%)
- `updateComboDisplay()` -- shows/hides combo badge, animates pulse
- `updateWaveDisplay()` -- sets `#wave-num` text

### Dependencies
- Milestone 5 (bullets fire and can hit)
- Milestone 4 (chord completion triggers wave clear)

### Success criteria
- Starting a game sets HP to 5, score to 0, wave to 1
- Completing a wave awards correct score (100 base + speed bonus * combo)
- Combo increments on each successful wave, resets on bullet hit
- HP decreases by 1 per bullet hit; HP bar updates visually
- HP reaching 0 shows game over screen with accurate stats
- Level increments every 5 waves

---

## Milestone 7: Levels 1-9 vs 10+ Bullet Behavior Split

**Goal:** Implement the two distinct difficulty modes. Levels 1-9 have single-bullet real-time pressure with wave-based progression. Level 10+ switches to continuous multi-bullet assault.

### Files modified
- `battle.js` -- modify bullet spawning logic in `BattleScene`, adjust `onBulletHit` behavior

### Key functions/classes

**`BattleScene.startBulletFire(level)`**
```javascript
if (level < 10) {
  // Single bullet mode
  this.time.delayedCall(1000, () => {
    const randomEnemy = Phaser.Utils.Array.GetRandom(this.enemies.filter(e => e.alive));
    if (randomEnemy) this.fireBullet(randomEnemy);
  });
} else {
  // Continuous assault mode
  this.enemies.forEach((enemy, i) => {
    const delay = 1000 + i * 400; // stagger start
    this.time.addEvent({
      delay: this.getFireInterval(level),
      callback: () => { if (enemy.alive) this.fireBullet(enemy); },
      loop: true,
      startAt: delay
    });
  });
}
```

**`BattleScene.getFireInterval(level)`**
- `return Math.max(800, 2500 - (level - 10) * 200)`
- Level 10: 2500ms, Level 15: 1500ms, Level 19+: 800ms floor

**`BattleScene.getBulletSpeed(level)`**
- `return 40 + level * 8` (px/sec)
- Level 1: 48, Level 5: 80, Level 10: 120, Level 15: 160

**Level 1-9 `onBulletHit` behavior:**
- Damage taken, current enemies removed
- Immediately spawn next wave/chord (penalty is losing HP + combo break)

**Level 10+ `onBulletHit` behavior:**
- Damage taken, but enemies and remaining bullets persist
- More bullets keep firing from surviving enemies
- Only `chordComplete` ends the wave

### Dependencies
- Milestone 5 (base bullet system)
- Milestone 6 (level tracking)

### Success criteria
- At level 3: one bullet fires after the ready beat, travels at moderate speed
- At level 10: all enemies fire independently on a loop
- At level 10: missing a bullet deals damage but does NOT advance to next wave
- At level 15: fire interval is noticeably faster than level 10
- Completing the chord at any level destroys all bullets and enemies

---

## Milestone 8: Chord Progression Integration

**Goal:** When progression mode is enabled, waves follow chord progression sequences from `chords-db.js`. Multi-wave encounters play through an entire progression with bonus points for flawless completion.

### Files modified
- `battle.js` -- modify `nextWave()` to support progression mode

### Key functions/classes

**Progression state tracking:**
```javascript
battleState.progressionMode = false;
battleState.currentProgression = null; // { name, tier, chords }
battleState.progressionIndex = 0;
battleState.progressionDamaged = false; // track if player took damage during this progression
battleState.breatherWavesRemaining = 0; // random chords between progressions
```

**`nextWave()` modified logic:**
```
if (!progressionMode) {
  // Pure random mode: pick random chord from tier
  chord = C.getRandomChord(tier)
} else {
  if (breatherWavesRemaining > 0) {
    // Random chord as breather between progressions
    chord = C.getRandomChord(tier)
    breatherWavesRemaining--
  } else if (!currentProgression || progressionIndex >= currentProgression.chords.length) {
    // Just finished a progression (or haven't started one)
    if (currentProgression && !progressionDamaged) {
      // Progression completion bonus
      awardProgressionBonus(200)
      showProgressionComplete(currentProgression.name)
      playProgressionReplay(currentProgression) // play all chords in sequence as audio
    }
    // Pick next progression
    currentProgression = C.getRandomProgression(tier)
    progressionIndex = 0
    progressionDamaged = false
    // Insert 1-2 breather waves (fewer at higher levels)
    breatherWavesRemaining = level >= 10 ? 0 : Phaser.Math.Between(1, 2)
    if (breatherWavesRemaining > 0) {
      chord = C.getRandomChord(tier)
      breatherWavesRemaining--
    } else {
      chord = C.CHORDS[currentProgression.chords[progressionIndex++]]
    }
  } else {
    // Continue current progression
    chord = C.CHORDS[currentProgression.chords[progressionIndex++]]
  }
}
```

**`showProgressionComplete(name)`**
- Banner text in Phaser scene: "Progression Complete!" with the progression name
- Tween: scale up, hold 1s, fade out

**`playProgressionReplay(progression)`**
- Uses `audio.playChord()` to replay each chord in the progression sequentially with ~400ms gaps
- Purely cosmetic/musical payoff

**Progression HUD display:**
- `#progression-info` text: e.g., "Jazz ii-V-I (2/3)"
- Updated each wave when in progression mode

### Dependencies
- Milestone 6 (wave progression, scoring)
- `chords-db.js` (PROGRESSIONS array, `getRandomProgression()`)

### Success criteria
- With progression mode enabled, chords follow the progression sequence (e.g., Dm7 -> G7 -> Cmaj7)
- `#progression-info` shows the progression name and position (e.g., "Jazz ii-V-I 2/3")
- Completing a full progression without damage awards +200 bonus points
- "Progression Complete!" banner appears after completing a full sequence
- Taking damage during a progression clears the bonus but does not skip remaining chords
- Breather waves (1-2 random chords) appear between progressions at levels < 10
- At level 10+, progressions chain back-to-back with no breathers

---

## Milestone 9: Difficulty Scaling and Level 15+ Random Positioning

**Goal:** Implement the full difficulty curve from beginner to expert. Bullet speed, fire rate, and enemy positioning all scale with level. At level 15+, enemies decouple from key positions.

### Files modified
- `battle.js` -- modify `spawnEnemies()`, bullet speed/rate calculations

### Key functions/classes

**Difficulty scaling table:**

| Level | Bullet Speed (px/s) | Fire Mode | Fire Interval | Enemy Position | Tier Chord Pool |
|-------|---------------------|-----------|---------------|----------------|-----------------|
| 1-4   | 48-80               | Single    | N/A           | Key-aligned    | Selected tier   |
| 5-9   | 80-112              | Single    | N/A           | Key-aligned    | Selected tier   |
| 10-14 | 120-152             | Continuous| 2500-1700ms   | Key-aligned    | Selected tier   |
| 15-19 | 160-192             | Continuous| 1500-700ms    | Random + labels| Selected tier   |
| 20+   | 200 (cap)           | Continuous| 700ms (floor) | Random + labels| Selected tier   |

**`BattleScene.spawnEnemies(midiNotes, level)` updated:**
```javascript
const useRandomPositions = level >= 15;

midiNotes.forEach((note, i) => {
  let x, y;
  if (useRandomPositions) {
    // Random positions with padding (avoid edges)
    const padding = 40;
    x = Phaser.Math.Between(padding, this.canvasWidth - padding);
    y = Phaser.Math.Between(this.canvasHeight * 0.1, this.canvasHeight * 0.4);
  } else {
    // Key-aligned positioning
    x = this.bridge.getKeyX(note);
    y = C.isAccidental(note) ? this.canvasHeight * 0.20 : this.canvasHeight * 0.35;
  }
  const enemy = new Enemy(this, note, x, y, C.isAccidental(note));
  if (useRandomPositions) enemy.showLabel();
  this.enemies.push(enemy);
});
```

**Ready beat scaling:**
- Levels 1-4: 1500ms ready beat before first bullet
- Levels 5-9: 1000ms
- Levels 10+: 800ms
- Levels 15+: 500ms

**Enemy spawn animation speed scaling:**
- Lower levels: 500ms drop-in
- Higher levels: 300ms drop-in (enemies appear faster)

### Dependencies
- Milestone 3 (enemy spawning)
- Milestone 5 (bullet speed)
- Milestone 7 (level 10+ fire mode)

### Success criteria
- At level 1, bullet speed is slow enough to comfortably play a triad
- At level 10, multiple bullets fire and the pace feels significantly harder
- At level 15, enemies appear at random positions with note labels (e.g., "E", "G", "B")
- Bullet speed caps at 200px/s and fire interval floors at 700ms (never impossible)
- Tier selection at start screen correctly limits the chord pool throughout

---

## Milestone 10: Visual Effects

**Goal:** Add particle effects, screen shake, glow effects, and visual polish that make combat feel impactful.

### Files modified
- `battle.js` -- add particle systems, screen shake, glow rendering
- `battle.css` -- screen flash, HP crack animation

### Key functions/classes

**Particle textures (procedurally generated):**
```javascript
// In BattleScene.create():
// Create a 4x4 white pixel texture for particles
const particleCanvas = this.textures.createCanvas('particle', 4, 4);
const ctx = particleCanvas.getContext();
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, 4, 4);
particleCanvas.refresh();
```

**Enemy death particles:**
- `BattleScene.createDeathBurst(x, y, tint)`
- Phaser particle emitter: 20-30 particles, speed 50-200, lifespan 400ms, tint matching enemy color
- Gravity: slight downward pull
- Scale: start 1.0, end 0
- On last enemy of wave: also trigger screen shake

**Bullet trail particles:**
- Attached to each `Bullet` instance
- Emitter follows bullet position
- Red/orange tint, small particles, short lifespan (200ms)
- 5-8 particles per frame

**Bullet deflect particles:**
- Similar to death burst but white/cyan, fewer particles
- Small flash (Phaser.GameObjects.Ellipse, scale tween 0->2, alpha 1->0, 200ms)

**Screen shake:**
- `BattleScene.shakeCamera(intensity, duration)`
- `this.cameras.main.shake(duration, intensity)`
- On wave clear (last enemy death): shake(200, 0.005)
- On bullet hit: shake(150, 0.008)

**Screen flash (CSS-based for whole page effect):**
- On bullet hit: add class `.damage-flash` to `#battle-container`
  ```css
  .damage-flash { animation: damageFlash 300ms ease-out; }
  @keyframes damageFlash { 0% { background-color: rgba(255,0,0,0.3); } 100% { background-color: transparent; } }
  ```
- Remove class after animation ends

**Laser glow enhancement:**
- Add a very faint `Phaser.FX.Glow` or simply a fourth, even wider semi-transparent line layer beneath the existing three

**HP crack animation:**
- When HP decreases, the HP bar briefly shakes (CSS animation)
- HP text flashes red

**Combo celebration:**
- At combo milestones (5x, 10x), brief golden particle fountain from score display position
- Text "5x COMBO!" appears in Phaser scene, tweens scale up then fades

### Dependencies
- Milestone 3 (enemy death triggers)
- Milestone 4 (laser rendering)
- Milestone 5 (bullet destruction)
- Milestone 6 (HP/combo system)

### Success criteria
- Enemy death produces a visible particle burst of 20+ particles
- Last enemy of a wave causes the camera to shake briefly
- Bullet hit causes screen flash red and camera shake
- Bullet trail particles follow the bullet smoothly
- Chord completion causes lasers to pulse bright before the explosion
- Combo milestones (5x, 10x) show a visual celebration
- All effects perform at 60fps (no frame drops from particle count)

---

## Milestone 11: Start Screen and Game Over Screen

**Goal:** Implement the full start screen (tier selection, progression toggle, MIDI status) and game over screen (stats, replay) as HTML overlays matching the existing game's visual style.

### Files modified
- `battle.html` -- finalize start screen and game over screen HTML
- `battle.css` -- styles for overlays
- `battle.js` -- wire up start/game-over logic

### Key functions/classes

**Start screen (`#battle-start-screen`):**
- Title: "Chordessy" (gradient text, same as game.html)
- Subtitle: "Battle Mode"
- Four tier buttons (Beginner / Intermediate / Advanced / Expert) with the same design as game.html
- Progression mode checkbox: "Play chord progressions"
- MIDI status text (same logic as game.js: detect MIDI on load, show status)
- Click handler: `startBattle(tier)` hides overlay, starts game

**Game over screen (`#battle-game-over`):**
- Title: "Game Over" (gradient text)
- Final score (large, orange)
- Stats row: Waves Cleared, Damage Taken, Best Combo, Level Reached
- "Play Again" button -> shows start screen
- Optional: "Try Chord Trainer" link to game.html

**Screen transitions:**
- Start screen fades out (CSS `opacity` transition, 300ms)
- Game over screen fades in (CSS `opacity` transition, 300ms)
- Phaser scene pauses while overlays are visible

**State management:**
- Phaser game is created once on page load but scene is paused until game starts
- `startBattle()` resumes scene, resets all state
- `onGameOver()` pauses scene, shows overlay

### Dependencies
- Milestone 0 (HTML structure)
- Milestone 6 (game state, start/end logic)

### Success criteria
- Page loads with start screen visible, Phaser canvas hidden/paused behind it
- Clicking a tier button starts the game and hides the start screen
- Progression checkbox state is read correctly when starting
- MIDI status shows correct detection message
- Game over screen shows accurate final stats
- "Play Again" returns to start screen cleanly (no state leaks from previous game)
- Starting a second game after game over works correctly

---

## Milestone 12: Navigation Links Between All Three Modes

**Goal:** Add navigation links so users can switch between the Neural Arpeggiator, Chord Training Game, and Battle Mode from any page.

### Files modified
- `neural-arpeggiator/dist/index.html` -- update `.mode-switch` div
- `neural-arpeggiator/dist/game.html` -- update navigation link at bottom of start screen
- `neural-arpeggiator/dist/battle.html` -- add navigation link
- `neural-arpeggiator/dist/style.css` -- (possibly) update `.mode-switch` styles for multi-link layout

### Changes per file

**`index.html` (arpeggiator):**
Current:
```html
<div class="mode-switch">
  <a href="game.html">Switch to Chord Training Game</a>
</div>
```
Updated:
```html
<div class="mode-switch">
  <a href="game.html">Chord Trainer</a> | <a href="battle.html">Battle Mode</a>
</div>
```

**`game.html` (chord trainer):**
Current:
```html
<p><a href="index.html">Switch to Neural Arpeggiator</a></p>
```
Updated:
```html
<p>
  <a href="index.html">Neural Arpeggiator</a> | <a href="battle.html">Battle Mode</a>
</p>
```
Also add to game over screen:
```html
<p><a href="index.html">Neural Arpeggiator</a> | <a href="battle.html">Battle Mode</a></p>
```

**`battle.html` (battle mode):**
Add to both start screen and game over screen:
```html
<p class="mode-switch">
  <a href="index.html">Neural Arpeggiator</a> | <a href="game.html">Chord Trainer</a>
</p>
```

### Dependencies
- Milestone 0 (battle.html exists)
- Milestone 11 (start and game over screens finalized)

### Success criteria
- From the arpeggiator page, links to both Chord Trainer and Battle Mode are visible and work
- From the chord trainer start screen, links to both Arpeggiator and Battle Mode work
- From the battle mode start screen, links to both Arpeggiator and Chord Trainer work
- All links also present on game over screens where applicable
- Link styling is consistent across all three pages

---

## Dependency Graph

```
M0 (Scaffolding)
 |
 +-- M1 (Phaser scene + canvas)
 |    |
 |    +-- M2 (BattleBridge)
 |         |
 |         +-- M3 (Enemy spawning)
 |         |    |
 |         |    +-- M4 (Lasers)
 |         |    |    |
 |         |    |    +-- M6 (HP/Score/Combo/Waves)
 |         |    |         |
 |         |    |         +-- M7 (Level 1-9 vs 10+ split)
 |         |    |         |    |
 |         |    |         |    +-- M9 (Difficulty scaling + level 15+)
 |         |    |         |
 |         |    |         +-- M8 (Progression integration)
 |         |    |
 |         |    +-- M5 (Bullets)
 |         |         |
 |         |         +-- M6 (HP/Score/Combo/Waves)
 |         |
 |         +-- M10 (Visual effects) -- depends on M3, M4, M5, M6
 |
 +-- M11 (Start/Game Over screens) -- depends on M0, M6
 |
 +-- M12 (Navigation links) -- depends on M0, M11
```

## Suggested Implementation Order

The dependency graph allows some parallelism, but the recommended linear order for a single developer is:

1. **M0** -- Scaffolding (30 min)
2. **M1** -- Phaser scene + star field (1 hr)
3. **M2** -- BattleBridge (1.5 hr)
4. **M3** -- Enemy spawning (1 hr)
5. **M4** -- Lasers (1.5 hr)
6. **M5** -- Bullets (1.5 hr)
7. **M6** -- HP/Score/Combo/Waves (1.5 hr)
8. **M7** -- Level split (45 min)
9. **M8** -- Progression integration (1 hr)
10. **M9** -- Difficulty scaling + level 15+ (45 min)
11. **M10** -- Visual effects (2 hr)
12. **M11** -- Start/Game Over screens (1 hr)
13. **M12** -- Navigation links (15 min)

**Estimated total: ~13 hours**

---

## Key Technical Decisions

### 1. Phaser canvas coordinates vs DOM coordinates

The bridge must translate between two coordinate systems:
- **DOM coordinates**: `element.getBoundingClientRect()` returns viewport-relative positions
- **Phaser canvas coordinates**: origin at top-left of the canvas element

Translation: `phaserX = domX - canvasRect.left`, `phaserY = domY - canvasRect.top`

The keyboard sits _below_ the Phaser canvas, so laser origins are at `y = canvasHeight` (bottom edge of canvas). The bridge only needs x-coordinates from the keyboard; y is always the canvas bottom.

### 2. Pitch class matching vs exact MIDI note matching

The existing `pitchClassesMatch()` function in `shared.js` compares pitch classes (0-11) regardless of octave. This is the correct approach for battle mode because:
- The player can press C in any octave to match a "C" in the target chord
- Enemies represent pitch classes, not specific octave instances
- Lasers fire from whichever specific key the player presses

### 3. Phaser transparent background

Setting `transparent: true` in the Phaser config allows the CSS gradient background to show through. The star field particles render on top of this. This avoids having to recreate the gradient in Phaser and keeps the visual consistent with other pages.

### 4. No build step

All three pages (arpeggiator, game, battle) load scripts directly via `<script>` tags with CDN dependencies. Battle mode follows this pattern exactly. Phaser 3 is loaded from jsDelivr CDN. No webpack, rollup, or other bundler is involved.

### 5. Audio reuse

`shared.js` provides `setupAudio()` which returns a Tone.js sampler with reverb/echo chain. Battle mode uses this identically for note playback. Additional sound effects (explosions, bullet sounds) can be synthesized via Tone.js oscillators (same pattern as `correctSynth`/`incorrectSynth` in game.js).

### 6. Input handling reuse

Battle mode reuses the exact same input patterns from game.js:
- MIDI via `shared.js` `setupMidi()` with `onNoteOn`/`onNoteOff` callbacks
- QWERTY via the same `QWERTY_MAP` object
- Mouse/touch via the same event delegation pattern on keyboard elements

The only difference is that these callbacks route through `BattleBridge` instead of directly into game state.

### 7. Enemy-to-note mapping for lasers at level 15+

When enemies are at random positions (level 15+), the laser still needs to connect the pressed key to the correct enemy. The mapping is by pitch class: pressing any C key fires a laser to whichever enemy represents the C note, regardless of where that enemy is positioned on screen.
