# Chordessy Battle Mode Design

## Overview

A new game mode that turns chord practice into a Space Invaders-style shooter. Enemies are positioned above the piano keys that correspond to the target chord. Playing the correct chord fires lasers from the keys, destroying enemies. Enemies fire back — the only defense is playing the right notes.

## Architecture & Layout

**Screen layout (top to bottom):**
- HUD bar (~5%) — Score, HP bar, wave counter, level
- Phaser 3 canvas (~60%) — Combat arena with enemies, lasers, bullets
- Chord prompt (~10%) — Target chord name + note names
- HTML piano keyboard (~25%) — Existing keyboard, unchanged

**Tech stack:**
- Phaser 3 via CDN (no bundler, matches existing pattern)
- Phaser canvas sized to the top portion of the screen
- Bridge layer connects existing chord/input system to Phaser via events

**New files:**
- `battle.html` — new page
- `battle.js` — Phaser scene, enemy/laser/bullet logic, bridge
- `battle.css` — split-view layout

**Reused files:**
- `shared.js` — piano keyboard, audio, MIDI/QWERTY input
- `chords-db.js` — chord definitions, progressions, tier system

## Core Game Loop

1. Wave begins — enemies spawn at key-aligned positions (drop-in animation)
2. Chord name + notes appear in the prompt area
3. After ~1 second ready beat, enemies begin firing a bullet downward
4. Player plays the chord. Each correct note fires a laser from that key upward
5. When all notes held simultaneously — enemies explode, bullet destroyed
6. Short celebration (~0.5s), next wave spawns

## Combat Mechanics

### Bullet Behavior

**Levels 1-9 (real-time pressure):**
- One bullet fires from a random enemy, traveling downward at steady speed
- Player has the bullet's full travel time to play the correct chord
- Correct chord before bullet reaches bottom = bullet deflected, enemies die
- Bullet reaches bottom = player takes 1 HP damage, new chord spawns

**Level 10+ (continuous assault):**
- Multiple enemies fire independently at staggered intervals
- Correct chord destroys ALL active bullets + kills all enemies in one shot
- Miss = multiple bullets can hit in quick succession

### Partial Feedback
- Each correct note held = persistent laser beam (immediate visual feedback)
- Wrong notes flash red, no laser fires
- 2 of 3 correct notes = 2 lasers visible but chord doesn't complete

## Enemy Positioning

### Levels 1-9: Column-aligned
- Each enemy floats directly above the piano key for its note
- White-key enemies: main row, full size
- Black-key enemies: slightly higher row, positioned between white-key enemies
- Spatial connection between note positions and enemy positions teaches chord shapes

### Level 15+: Random positions with labels
- Enemies appear at random x-positions with note name labels
- Player must know notes by name, not position
- Pedagogical progression: learn by position first, prove knowledge by name later

### Black Key Handling
- True piano mapping throughout — enemies mirror actual key positions
- Tier 1 (beginner) naturally avoids black keys since those chords are all white keys
- Black-key enemies introduced in tier 2+ when players understand the spatial system

## Player HP, Scoring & Progression

### HP
- Start with 5 HP (shield icons or health bar)
- Lose 1 HP per bullet that reaches bottom
- No HP recovery — keeps runs tense
- 0 HP = game over

### Scoring
- 100 base points per wave cleared
- Speed bonus up to +50 points (faster chord = higher bonus)
- Combo multiplier: consecutive waves without damage (x2, x3, x4...), resets on hit
- Taking damage clears the wave but breaks combo

### Level Progression
- Every 5 waves = level up
- Level up: bullet speed increases, chord difficulty scales with selected tier
- Level 10+: continuous assault mode
- Level 15+ (Advanced/Expert): random-position enemies with note labels

### Difficulty Tiers (selected at start)
- Beginner: major/minor triads, white keys only
- Intermediate: all triads + dim/aug, black keys appear
- Advanced: seventh chords (4 notes = 4 enemies per wave)
- Expert: extended chords (5-6 notes = 5-6 enemies)

## Chord Progressions

When progression mode is enabled:

**Multi-wave sequences:**
- A progression (e.g. Dm7 -> G7 -> Cmaj7) plays out as a 3-wave encounter
- Each wave = one chord in the progression, enemies reposition between waves
- After completing full progression: all chords replay in sequence (musical payoff) + "Progression Complete!" banner

**Progression bonus:**
- +200 points for completing a full progression without taking damage
- Progression name shown in HUD (e.g. "Jazz ii-V-I 2/3")

**Wave flow:**
- Alternates: progression sequence, 1-2 random chords as breather, next progression
- Higher levels chain progressions back-to-back

**Start screen toggle:**
- Same checkbox as current game: "Play chord progressions"
- Unchecked = all random chords (pure reflex mode)
- Checked = progression-based campaign waves

## Visual Design

**Theme:**
- Dark space/neon aesthetic matching existing gradient (#0f0c29 -> #302b63 -> #24243e)
- Subtle star field scrolling in background (Phaser particle emitter)
- Neon glow on lasers and bullets

**Enemies:**
- Glowing geometric shapes (orbs or hexagons), no complex sprites
- White-key enemies: larger, full brightness
- Black-key enemies: slightly smaller, different tint, higher row
- Spawn: fade in + drop to position
- Death: particle burst + screen shake on last enemy of wave

**Lasers (player -> enemy):**
- Thin neon cyan beam from piano key top edge to enemy
- Each correct note = persistent beam (tractor beam effect)
- All notes held = beams pulse bright, enemies explode simultaneously

**Bullets (enemy -> player):**
- Glowing red/orange orbs drifting downward with particle trail
- Blocked: bullet shatters with flash
- Hit: screen flashes red, HP icon cracks

## Bridge Layer

Event-based integration between HTML piano and Phaser canvas.

**HTML -> Phaser:**
- `noteOn(midiNote)` — draw laser from key's x-position
- `noteOff(midiNote)` — remove laser
- `chordComplete(chordSymbol)` — trigger enemy death + bullet destruction
- `wrongNote(midiNote)` — flash column red

**Phaser -> HTML:**
- `bulletHit()` — decrement HP, play damage sound
- `waveCleared()` — pick next chord, update prompt, update score
- `gameOver()` — show game over screen with stats

**Key-to-x mapping:**
- On init, bridge reads DOM positions of all piano key elements: `midiNote -> xPixel`
- Phaser uses this to position enemies and laser origins above correct keys
- Recalculates on window resize
