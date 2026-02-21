window.Chordessy = window.Chordessy || {};

(function(C) {
  'use strict';

  class BattleBridge {
    constructor({ scene, keyboardContainer, keyElements }) {
      this.scene = scene;
      this.keyboardContainer = keyboardContainer;
      this.keyElements = keyElements;
      this.keyXMap = new Map();
      this.heldNotes = new Set();
      this.targetMidi = [];
      this.emitter = new Phaser.Events.EventEmitter();
    }

    buildKeyXMap() {
      this.keyXMap.clear();

      if (!this.scene || !this.scene.game || !this.keyElements) return;

      let canvasRect = this.scene.game.canvas.getBoundingClientRect();

      this.keyElements.forEach(keyEl => {
        let keyRect = keyEl.getBoundingClientRect();
        let centerX = keyRect.left + keyRect.width / 2 - canvasRect.left;
        let midiNote = parseInt(keyEl.dataset.note, 10);
        let isAccidental = keyEl.classList.contains('accidental');

        if (!isNaN(midiNote)) {
          this.keyXMap.set(midiNote, {
            x: centerX,
            width: keyRect.width,
            isAccidental: isAccidental
          });
        }
      });

      return this.keyXMap;
    }

    rebuildKeyXMap() {
      return this.buildKeyXMap();
    }

    noteOn(midiNote) {
      if (this.heldNotes.has(midiNote)) return;

      this.heldNotes.add(midiNote);

      let keyX = this.keyXMap.get(midiNote);
      let x = keyX ? keyX.x : 0;

      let targetPitchClasses = new Set(this.targetMidi.map(n => n % 12));
      let isCorrect = targetPitchClasses.has(midiNote % 12);

      this.emitter.emit('noteOn', { midiNote, x, isCorrect });

      if (this.audio) {
        this.audio.playNote(midiNote, 0.7);
      }

      if (this.keyElements) {
        let idx = midiNote - C.MIN_NOTE;
        if (idx >= 0 && idx < this.keyElements.length) {
          this.keyElements[idx].classList.add('pressed');
        }
      }

      this.checkChord();
    }

    noteOff(midiNote) {
      if (!this.heldNotes.has(midiNote)) return;

      this.heldNotes.delete(midiNote);

      this.emitter.emit('noteOff', { midiNote });

      if (this.keyElements) {
        let idx = midiNote - C.MIN_NOTE;
        if (idx >= 0 && idx < this.keyElements.length) {
          this.keyElements[idx].classList.remove('pressed');
        }
      }
    }

    setTargetChord(chordSymbol, midiNotes) {
      this.targetSymbol = chordSymbol;
      this.targetMidi = midiNotes || [];

      this.emitter.emit('newTarget', { symbol: chordSymbol, midiNotes: this.targetMidi });
    }

    checkChord() {
      if (this.targetMidi.length === 0) return;

      let heldArray = Array.from(this.heldNotes);
      if (heldArray.length === 0) return;

      if (window.Chordessy.pitchClassesMatch(heldArray, this.targetMidi)) {
        this.emitter.emit('chordComplete', { heldNotes: heldArray });
      } else {
        let targetPitchClasses = new Set(this.targetMidi.map(n => n % 12));
        let wrongNotes = heldArray.filter(n => !targetPitchClasses.has(n % 12));

        wrongNotes.forEach(wrongNote => {
          this.emitter.emit('wrongNote', { midiNote: wrongNote });
        });
      }
    }

    onCorrectAnswer(data) {
      this.emitter.emit('onCorrectAnswer', { chord: data.chord, lastEnemy: data.lastEnemy });
    }

    onBulletHit() {
      this.emitter.emit('bulletHit');
    }

    onWaveCleared() {
      this.emitter.emit('waveCleared');
    }

    onGameOver() {
      this.emitter.emit('gameOver');
    }

    init({ audio, qwertyMap }) {
      this.audio = audio;
      this.qwertyMap = qwertyMap;

      this.setupMidiInput();
      this.setupQwertyInput();
      this.setupMouseTouchInput();
    }

    setupMidiInput() {
      let statusEl = document.getElementById('midi-status');
      C.setupMidi()
        .then(midi => {
          midi.onNoteOn((note, velocity) => {
            this.noteOn(note);
          });
          midi.onNoteOff(note => {
            this.noteOff(note);
          });
          let inputs = midi.getInputs ? midi.getInputs() : [];
          if (statusEl) {
            if (inputs.length > 0) {
              statusEl.textContent = 'MIDI connected: ' + inputs.map(i => i.name).join(', ');
              statusEl.style.color = '#00ff88';
            } else {
              statusEl.textContent = 'No MIDI keyboard found. Use on-screen keys or QWERTY.';
              statusEl.style.color = '#ffaa00';
            }
          }
        })
        .catch(err => {
          console.warn('MIDI not available:', err);
          if (statusEl) {
            statusEl.textContent = 'No MIDI keyboard found. Use on-screen keys or QWERTY.';
            statusEl.style.color = '#ffaa00';
          }
        });
    }

    setupQwertyInput() {
      document.addEventListener('keydown', e => {
        if (e.repeat) return;
        let note = this.qwertyMap[e.key.toLowerCase()];
        if (note !== undefined) {
          e.preventDefault();
          this.noteOn(note);
        }
      });

      document.addEventListener('keyup', e => {
        let note = this.qwertyMap[e.key.toLowerCase()];
        if (note !== undefined) {
          this.noteOff(note);
        }
      });
    }

    setupMouseTouchInput() {
      let touchedNotes = new Set();

      let handleTouch = e => {
        e.preventDefault();
        let currentTouches = new Set();
        for (let touch of Array.from(e.touches)) {
          let el = document.elementFromPoint(touch.clientX, touch.clientY);
          if (el && el.classList && el.classList.contains('key')) {
            let note = parseInt(el.dataset.note, 10);
            if (!isNaN(note)) {
              currentTouches.add(note);
            }
          }
        }

        currentTouches.forEach(note => {
          if (!touchedNotes.has(note)) {
            this.noteOn(note);
            touchedNotes.add(note);
          }
        });

        touchedNotes.forEach(note => {
          if (!currentTouches.has(note)) {
            this.noteOff(note);
            touchedNotes.delete(note);
          }
        });
      };

      this.keyElements.forEach(keyEl => {
        let note = parseInt(keyEl.dataset.note, 10);
        if (isNaN(note)) return;

        let mouseDown = false;

        keyEl.addEventListener('mousedown', e => {
          e.preventDefault();
          mouseDown = true;
          this.noteOn(note);
        });

        keyEl.addEventListener('mouseenter', () => {
          if (mouseDown) {
            this.noteOn(note);
          }
        });

        keyEl.addEventListener('mouseup', () => {
          mouseDown = false;
          this.noteOff(note);
        });

        keyEl.addEventListener('mouseleave', () => {
          if (mouseDown) {
            mouseDown = false;
            this.noteOff(note);
          }
        });
      });

      document.addEventListener('mouseup', () => {
        touchedNotes.forEach(note => {
          this.noteOff(note);
          touchedNotes.delete(note);
        });
      });

      this.keyboardContainer.addEventListener('touchstart', handleTouch, { passive: false });
      this.keyboardContainer.addEventListener('touchmove', handleTouch, { passive: false });
      this.keyboardContainer.addEventListener('touchend', e => {
        e.preventDefault();
        handleTouch(e);
      });
    }
  }

  C.BattleBridge = BattleBridge;

  const SCENE_KEYS = {
    BATTLE: 'BattleScene'
  };

  class BattleScene extends Phaser.Scene {
    constructor() {
      super(SCENE_KEYS.BATTLE);
    }

    preload() {}

    create() {
      let { width, height } = this.cameras.main;
      this.physics.world.setBounds(0, 0, width, height);
      this.sceneWidth = width;
      this.sceneHeight = height;
      let particleTex = this.textures.createCanvas('particle', 4, 4);
      let ctx = particleTex.getContext();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 4, 4);
      particleTex.refresh();
      this.stars = [];
      let starCount = 100;
      for (let i = 0; i < starCount; i++) {
        let x = Phaser.Math.Between(0, width);
        let y = Phaser.Math.Between(0, height);
        let radius = Phaser.Math.FloatBetween(0.5, 1.5);
        let star = this.add.circle(x, y, radius, 0xffffff);
        let speed = Phaser.Math.FloatBetween(0.5, 2);
        star.starSpeed = speed;
        this.stars.push(star);
      }
      this.events.on('destroy', enemy => this.handleEnemyDestroy({ GameObject: enemy }));
      this.enemies = [];
      this.bullets = [];
      this.battleState = {
        running: false,
        tier: 1,
        wave: 1,
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
        progressionDamaged: false,
        breatherWavesRemaining: 0,
        bulletSpeed: 40
      };
      this.waveActive = false;
      this._sfxCtx = null;

      // Build on-screen keyboard
      let keyboardContainer = document.getElementById('keyboard-area');
      let keyElements = [];
      if (keyboardContainer && C.buildKeyboard) {
        keyboardContainer.classList.add('keyboard', 'loaded');
        keyboardContainer.style.position = 'relative';
        keyElements = C.buildKeyboard(keyboardContainer);
      }

      this.bridge = new BattleBridge({
        scene: this,
        keyboardContainer: keyboardContainer || document.body,
        keyElements: keyElements
      });
      this.laserGroup = new Map();
      this.bridge.emitter.on('noteOn', this.onNoteOn.bind(this));
      this.bridge.emitter.on('noteOff', this.onNoteOff.bind(this));
      this.bridge.emitter.on('chordComplete', this.onChordComplete.bind(this));
      this.bridge.emitter.on('bulletHit', this.onBulletHit.bind(this));
      this.bridge.emitter.on('waveCleared', this.onWaveCleared.bind(this));
      this.bridge.emitter.on('gameOver', this.onGameOver.bind(this));

      // Setup audio and input
      let audio = null;
      try {
        audio = C.setupAudio();
      } catch (e) {
        console.warn('Audio setup failed:', e);
      }

      // QWERTY mapping: two rows of keys mapped to piano notes
      let qwertyMap = {};
      let bottomRow = ['z','x','c','v','b','n','m',',','.','/'];
      let topRow =    ['a','s','d','f','g','h','j','k','l',';'];
      let startNote = C.MIN_NOTE || 48;
      bottomRow.forEach((key, i) => { qwertyMap[key] = startNote + i; });
      topRow.forEach((key, i) => { qwertyMap[key] = startNote + 10 + i; });
      // Accidentals on number/upper rows
      let accRow = ['w','e','','r','t','','y','u','','i','o'];
      let accStart = startNote + 1;
      accRow.forEach((key, i) => {
        if (key) qwertyMap[key] = accStart + i;
      });

      this.bridge.init({ audio, qwertyMap });
      this.bridge.buildKeyXMap();

      this.renderLives();
      this.scene.pause();
    }

    onGameOver() {
      this.battleState.running = false;

      if (this.bulletEvents) {
        this.bulletEvents.forEach(event => event.remove());
        this.bulletEvents = [];
      }

      this.enemies.forEach(enemy => {
        if (enemy) {
          enemy.alive = false;
          if (enemy.scene) enemy.destroy();
        }
      });
      this.enemies = [];

      for (let i = this.bullets.length - 1; i >= 0; i--) {
        if (this.bullets[i].scene) this.bullets[i].destroy();
      }
      this.bullets = [];

      for (let laserData of this.laserGroup.values()) {
            if (laserData.glow) laserData.glow.destroy();
            if (laserData.outer) laserData.outer.destroy();
            if (laserData.middle) laserData.middle.destroy();
            if (laserData.inner) laserData.inner.destroy();
          }
          this.laserGroup.clear();

      let gameOverOverlay = document.getElementById('game-over-overlay');
      if (gameOverOverlay) {
        this.scene.pause();
        gameOverOverlay.classList.remove('hidden');

        let finalScoreEl = document.getElementById('final-score');
        if (finalScoreEl) {
          finalScoreEl.textContent = this.battleState.score;
        }

        let wavesClearedEl = document.getElementById('stat-waves-cleared');
        if (wavesClearedEl) {
          wavesClearedEl.textContent = this.battleState.wavesCleared;
        }

        let damageTakenEl = document.getElementById('stat-damage-taken');
        if (damageTakenEl) {
          damageTakenEl.textContent = this.battleState.wavesMissed;
        }

        let bestComboEl = document.getElementById('stat-best-combo');
        if (bestComboEl) {
          bestComboEl.textContent = this.battleState.bestCombo;
        }

        let levelReachedEl = document.getElementById('stat-level-reached');
        if (levelReachedEl) {
          levelReachedEl.textContent = this.battleState.level;
        }
      }
    }

    onCorrectAnswer({ chord, lastEnemy }) {
      if (this.bridge) {
        this.bridge.onCorrectAnswer({ chord: chord, lastEnemy: lastEnemy });
      }
    }

    update(time, delta) {
      this.stars.forEach(star => {
        star.y += star.starSpeed;
        if (star.y > this.sceneHeight) {
          star.y = 0;
          star.x = Phaser.Math.Between(0, this.sceneWidth);
        }
      });

      let currentHeight = this.cameras.main.height;
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        let bullet = this.bullets[i];
        bullet.update(time, delta);
        if (bullet.y > currentHeight) {
          this.onBulletHit(bullet.x);
          bullet.destroy();
          this.bullets.splice(i, 1);
        }
      }
    }

    createDeathBurst(x, y, tint) {
      let count = 20 + Math.floor(Math.random() * 11);
      let emitter = this.add.particles(x, y, 'particle', {
        speed: { min: 50, max: 200 },
        lifespan: 400,
        gravityY: 50,
        scale: { start: 1.0, end: 0 },
        tint: tint,
        emitting: false
      });
      emitter.explode(count);
      this.time.delayedCall(500, () => emitter.destroy());
    }

    emitDeathParticles(x, y, tint) {
      this.createDeathBurst(x, y, tint);
    }

    screenShake(duration, intensity) {
      duration = duration || 200;
      intensity = intensity || 0.005;
      this.cameras.main.shake(duration, intensity);
    }

    shakeCamera(intensity, duration) {
      intensity = intensity || 0.005;
      duration = duration || 200;
      this.cameras.main.shake(duration, intensity);
    }

    enemyTint(chord) {
      if (!chord || !chord.symbol) return 0xff4444;
      let symbol = chord.symbol;
      if (symbol.includes('dim')) return 0x9900ff;
      if (symbol.includes('aug')) return 0xff9900;
      if (symbol.includes('m7')) return 0x00ff99;
      if (symbol.includes('7')) return 0xff0066;
      if (symbol.includes('m') || symbol.includes('min')) return 0x6666ff;
      return 0x00ffff;
    }

    handleEnemyDestroy(data) {
      let enemy = data.GameObject;
      if (enemy && enemy.body) {
        let tint = this.enemyTint(enemy.chord);
        this.emitDeathParticles(enemy.x, enemy.y, tint);
      }
      if (data.lastEnemy) {
        this.shakeCamera(0.005, 200);
      }
    }

    spawnEnemies(midiNotes, level) {
      this.enemies.forEach(enemy => {
        if (enemy) {
          enemy.alive = false;
          if (enemy.scene) enemy.destroy();
        }
      });
      this.enemies = [];

      let keyXMap = this.bridge.keyXMap;
      let spawnDuration = this.getSpawnAnimationDuration(level);

      midiNotes.forEach((midiNote, index) => {
        let x, y, isAccidental;

        if (level <= 14) {
          let keyInfo = keyXMap.get(midiNote);
          x = keyInfo ? keyInfo.x : Phaser.Math.Between(50, this.sceneWidth - 50);
          isAccidental = keyInfo ? keyInfo.isAccidental : false;
          // White keys at a consistent row near top; black keys offset slightly higher
          y = isAccidental ? 50 : 100;
        } else {
          let padding = 100;
          x = Phaser.Math.Between(padding, this.sceneWidth - padding);
          y = Phaser.Math.Between(50, Math.floor(0.4 * this.sceneHeight));
          isAccidental = false;
        }

        let enemy = new Enemy(this, midiNote, x, y, isAccidental);
        this.enemies.push(enemy);

        if (level >= 15) {
          enemy.showLabel();
        }

        this.time.delayedCall(index * 100, () => {
          if (enemy && enemy.alive && enemy.scene) {
            enemy.spawnAnimation(spawnDuration);
          }
        });
      });
    }

    getRandomAliveEnemy() {
      let aliveEnemies = this.enemies.filter(e => e && e.alive);
      if (aliveEnemies.length === 0) return null;
      return Phaser.Utils.Array.GetRandom(aliveEnemies);
    }

    startBulletFire(level) {
      if (level <= 9) {
        this.bulletEvents = this.bulletEvents || [];
        this.bulletEvents.forEach(event => event.remove());
        this.bulletEvents = [];

        let bulletEvent = this.time.addEvent({
          delay: this.getFireInterval(level),
          callback: () => {
            if (this.battleState.running) {
              this.spawnBullet(this.battleState.level);
            }
          },
          callbackScope: this,
          loop: true
        });
        this.bulletEvents.push(bulletEvent);
      } else {
        this.bulletEvents = this.bulletEvents || [];
        this.bulletEvents.forEach(event => event.remove());
        this.bulletEvents = [];

        this.enemies.forEach((enemy, index) => {
          if (enemy && enemy.alive) {
            let bulletEvent = this.time.addEvent({
              delay: this.getFireInterval(level) + index * 400,
              callback: () => {
                if (enemy && enemy.alive && this.battleState.running) {
                  let speed = this.getBulletSpeed(this.battleState.level);
                  let bullet = new Bullet(this, enemy.x, enemy.y);
                  bullet.speed = speed;
                  bullet.fire(0, 1);
                  this.bullets.push(bullet);
                }
              },
              callbackScope: this,
              loop: true
            });
            this.bulletEvents.push(bulletEvent);
          }
        });
      }
    }

    spawnBullet(level) {
      let enemy = this.getRandomAliveEnemy();
      if (!enemy) return;

      let speed = this.getBulletSpeed(this.battleState.level);

      let bullet = new Bullet(this, enemy.x, enemy.y);
      bullet.speed = speed;
      bullet.fire(0, 1);
      this.bullets.push(bullet);
    }

    drawLaserBeam(startX, startY, endX, endY, midiNote, tint) {
      tint = tint || 0x00ffff;
      let laserData = { glow: null, outer: null, middle: null, inner: null };

      laserData.glow = this.add.graphics();
      laserData.glow.lineStyle(12, tint, 0.1);
      laserData.glow.beginPath();
      laserData.glow.moveTo(startX, startY);
      laserData.glow.lineTo(endX, endY);
      laserData.glow.strokePath();

      laserData.outer = this.add.graphics();
      laserData.outer.lineStyle(6, tint, 0.2);
      laserData.outer.beginPath();
      laserData.outer.moveTo(startX, startY);
      laserData.outer.lineTo(endX, endY);
      laserData.outer.strokePath();

      laserData.middle = this.add.graphics();
      laserData.middle.lineStyle(3, tint, 0.5);
      laserData.middle.beginPath();
      laserData.middle.moveTo(startX, startY);
      laserData.middle.lineTo(endX, endY);
      laserData.middle.strokePath();

      laserData.inner = this.add.graphics();
      laserData.inner.lineStyle(1, 0xffffff, 1.0);
      laserData.inner.beginPath();
      laserData.inner.moveTo(startX, startY);
      laserData.inner.lineTo(endX, endY);
      laserData.inner.strokePath();

      this.laserGroup.set(midiNote, laserData);

      this.tweens.add({
        targets: [laserData.glow, laserData.outer, laserData.middle, laserData.inner],
        alpha: 0,
        duration: 50,
        yoyo: true,
        repeat: 3
      });

      this.time.delayedCall(300, () => {
        this.clearLaser(midiNote);
      });

      return laserData;
    }

    findNearestActiveBullet(fromX) {
      let nearest = null;
      let nearestDist = Infinity;
      for (let i = 0; i < this.bullets.length; i++) {
        let bullet = this.bullets[i];
        if (bullet && bullet.active && bullet.scene) {
          let dist = Math.abs(bullet.x - fromX) + (this.sceneHeight - bullet.y) * 0.5;
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = bullet;
          }
        }
      }
      return nearest;
    }

    onNoteOn({ midiNote, x, isCorrect }) {
      let keyXMap = this.bridge.keyXMap;
      let keyInfo = keyXMap.get(midiNote);
      let startX = keyInfo ? keyInfo.x : x;
      let startY = this.sceneHeight - 50;

      if (isCorrect) {
        // Priority: shoot bullets first, then enemies
        let nearestBullet = this.findNearestActiveBullet(startX);

        if (nearestBullet) {
          // Laser targets the bullet
          this.drawLaserBeam(startX, startY, nearestBullet.x, nearestBullet.y, midiNote, 0x00ff88);
          this.playDeflectSound();
          nearestBullet.deflect();
          let idx = this.bullets.indexOf(nearestBullet);
          if (idx >= 0) this.bullets.splice(idx, 1);
        } else {
          // No bullets — laser targets the enemy
          let targetEnemy = this.enemies.find(e => e.midiNote === midiNote && e.alive);
          let endX = targetEnemy ? targetEnemy.x : startX;
          let endY = targetEnemy ? targetEnemy.y : 50;

          this.drawLaserBeam(startX, startY, endX, endY, midiNote, 0x00ffff);

          if (targetEnemy) {
            this.time.delayedCall(100, () => {
              if (targetEnemy && targetEnemy.alive && targetEnemy.scene) {
                targetEnemy.die();
                this.onCorrectAnswer({ chord: this.bridge.targetSymbol || {}, lastEnemy: true });
              }
            });
          }
        }
      } else {
        // Wrong note — red flash
        let flashColumn = this.add.graphics();
        flashColumn.fillStyle(0xff0000, 0.5);
        flashColumn.fillRect(startX - 20, this.sceneHeight - 100, 40, 100);

        this.tweens.add({
          targets: flashColumn,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            flashColumn.destroy();
          }
        });
      }
    }

    onNoteOff({ midiNote }) {
      this.clearLaser(midiNote);
    }

    onChordComplete() {
      if (!this.waveActive || !this.battleState.running) return;

      this.battleState.chordsCompleted++;
      this.updateWaveProgress();

      // Play chord blast sound
      this.playChordBlastSound();

      // Shockwave visual — expanding ring from center of screen
      let centerX = this.sceneWidth / 2;
      let waveY = this.sceneHeight - 30;
      let shockwave = this.add.circle(centerX, waveY, 20, 0x00ffff, 0.6);
      shockwave.setStrokeStyle(3, 0xffffff, 0.8);
      this.tweens.add({
        targets: shockwave,
        scaleX: 30,
        scaleY: 8,
        alpha: 0,
        duration: 600,
        ease: 'Cubic.Out',
        onComplete: () => shockwave.destroy()
      });

      // Camera flash for positive feedback
      this.cameras.main.flash(200, 0, 255, 255, false);

      // Deflect all active bullets with visual bursts
      if (this.bulletEvents) {
        this.bulletEvents.forEach(event => event.remove());
        this.bulletEvents = [];
      }
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        let bullet = this.bullets[i];
        if (bullet && bullet.scene && bullet.active) {
          bullet.deflect();
        } else if (bullet && bullet.scene) {
          bullet.destroy();
        }
      }
      this.bullets = [];

      // Keep lasers visible for a moment, then clear
      this.time.delayedCall(400, () => {
        for (let laserData of this.laserGroup.values()) {
          if (laserData.glow) laserData.glow.destroy();
          if (laserData.outer) laserData.outer.destroy();
          if (laserData.middle) laserData.middle.destroy();
          if (laserData.inner) laserData.inner.destroy();
        }
        this.laserGroup.clear();
      });

      // Kill remaining enemies with death particles
      this.enemies.forEach(enemy => {
        if (enemy && enemy.alive && enemy.scene) {
          enemy.die();
        } else if (enemy) {
          enemy.alive = false;
          if (enemy.scene) enemy.destroy();
        }
      });
      this.enemies = [];

      // Wave complete — all chords played
      if (this.battleState.chordsCompleted >= this.battleState.chordsPerWave) {
        this.onWaveCleared();
        return;
      }

      // Pause between chords so the player has time to release keys
      this.waveActive = false;

      // Clear the old chord and show "Get ready..." during pause
      let chordDisplayPause = document.getElementById('chord-display');
      if (chordDisplayPause) chordDisplayPause.textContent = 'Get ready...';
      let chordNotesPause = document.getElementById('chord-notes');
      if (chordNotesPause) chordNotesPause.textContent = '';

      this.time.delayedCall(2000, () => {
        if (!this.battleState.running) return;
        this.waveActive = true;

        // Pick next chord — respect progression mode
        let chord;
        if (this.battleState.progressionMode && this.battleState.currentProgression &&
            this.battleState.progressionIndex < this.battleState.currentProgression.chords.length) {
          let symbol = this.battleState.currentProgression.chords[this.battleState.progressionIndex];
          chord = C.CHORDS[symbol] || { symbol: symbol, name: symbol, tier: this.battleState.tier, notes: 0 };
          this.battleState.progressionIndex++;
        } else {
          chord = C.getRandomChord(this.battleState.tier);
        }

        let midiNotes = C.chordToMidiNotes(chord.symbol);

        this.bridge.setTargetChord(chord.symbol, midiNotes);

        if (this.bridge && this.bridge.audio) {
          if (this.bridge.audio.sampler && this.bridge.audio.sampler.releaseAll) {
            this.bridge.audio.sampler.releaseAll();
          }
          this.bridge.audio.playChord(midiNotes, '2n');
        }

        let chordDisplay = document.getElementById('chord-display');
        if (chordDisplay) {
          chordDisplay.textContent = chord.name;
        }
        let chordNotes = document.getElementById('chord-notes');
        if (chordNotes) {
          chordNotes.textContent = midiNotes.map(n => C.midiToNoteName ? C.midiToNoteName(n) : n).join(' - ');
        }

        let progressionInfo = document.getElementById('progression-info');
        if (progressionInfo) {
          if (this.battleState.progressionMode && this.battleState.currentProgression) {
            progressionInfo.textContent = this.battleState.currentProgression.name +
              ' (' + this.battleState.progressionIndex + '/' + this.battleState.currentProgression.chords.length + ')';
            progressionInfo.style.display = '';
          } else {
            progressionInfo.style.display = 'none';
          }
        }

        this.spawnEnemies(midiNotes, this.battleState.level);
        this.startBulletFire(this.battleState.level);
      });
    }

    onWaveCleared() {
      let baseScore = 100;
      let clearTime = this.time.now - this.battleState.waveStartTime;
      let speedBonus = Math.min(50, Math.floor(50000 / clearTime));
      let comboMultiplier = Math.min(10, Math.floor(this.battleState.combo / 5) + 1);
      let waveScore = (baseScore + speedBonus) * comboMultiplier;

      this.battleState.score += waveScore;
      this.battleState.combo++;
      this.battleState.wavesCleared++;

      if (this.battleState.combo > this.battleState.bestCombo) {
        this.battleState.bestCombo = this.battleState.combo;
      }

      // Clear remaining bullets and timers between waves
      if (this.bulletEvents) {
        this.bulletEvents.forEach(event => event.remove());
        this.bulletEvents = [];
      }
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        this.bullets[i].destroy();
      }
      this.bullets = [];

      // Clear remaining enemies — mark dead before destroying to prevent delayed callbacks
      this.enemies.forEach(enemy => {
        if (enemy) {
          enemy.alive = false;
          if (enemy.scene) enemy.destroy();
        }
      });
      this.enemies = [];

      this.updateHUD();

      this.showFloatingScore(waveScore);

      if (this.battleState.combo > 0 && this.battleState.combo % 5 === 0) {
        this.showComboCelebration(this.battleState.combo);
      }

      this.waveActive = false;

      // Show "Wave Cleared!" text
      let centerX = this.sceneWidth / 2;
      let centerY = this.sceneHeight / 2;
      let waveText = this.add.text(centerX, centerY, 'WAVE ' + this.battleState.wave + ' CLEARED!', {
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#00ff00',
        stroke: '#000000',
        strokeThickness: 4
      });
      waveText.setOrigin(0.5, 0.5);
      this.tweens.add({
        targets: waveText,
        alpha: 0,
        y: centerY - 60,
        duration: 1200,
        ease: 'Cubic.Out',
        onComplete: () => waveText.destroy()
      });

      this.time.delayedCall(1500, () => {
        this.nextWave();
      });
    }

    updateScoreDisplay() {
      let scoreDisplay = document.getElementById('score-display');
      if (scoreDisplay) {
        scoreDisplay.textContent = this.battleState.score;
      }
    }

    updateHPBar() {
      let hpBar = document.getElementById('hp-bar');
      let livesDisplay = document.getElementById('lives-display');
      
      if (hpBar && livesDisplay) {
        let hpPercent = this.battleState.hp / this.battleState.maxHp;
        
        hpBar.style.width = (hpPercent * 100) + '%';
        livesDisplay.textContent = this.battleState.hp + '/' + this.battleState.maxHp;
        
        hpBar.classList.remove('green', 'yellow', 'red');
        
        if (hpPercent > 0.6) {
          hpBar.classList.add('green');
        } else if (hpPercent > 0.2) {
          hpBar.classList.add('yellow');
        } else {
          hpBar.classList.add('red');
        }
      }
    }

    updateComboDisplay() {
      let comboDisplay = document.getElementById('combo-display');
      if (comboDisplay) {
        if (this.battleState.combo > 0) {
          comboDisplay.classList.remove('hidden');
          comboDisplay.textContent = this.battleState.combo + 'x';
        } else {
          comboDisplay.classList.add('hidden');
        }
      }
    }

    pulseCombo() {
      let comboDisplay = document.getElementById('combo-display');
      if (comboDisplay) {
        comboDisplay.classList.remove('combo-pulse');
        void comboDisplay.offsetWidth;
        comboDisplay.classList.add('combo-pulse');
      }
    }

    updateWaveDisplay() {
      let waveDisplay = document.getElementById('wave-display');
      if (waveDisplay) {
        waveDisplay.textContent = this.battleState.wave;
      }
    }

    updateHUD() {
      this.updateScoreDisplay();
      this.updateHPBar();
      this.updateComboDisplay();
      this.updateWaveDisplay();
      
      let levelDisplay = document.getElementById('level-display');
      if (levelDisplay) {
        levelDisplay.textContent = this.battleState.level;
      }
    }

    showFloatingScore(score) {
      let centerX = this.sceneWidth / 2;
      let centerY = this.sceneHeight / 3;

      let popup = this.add.text(centerX, centerY, '+' + score, {
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#00ffff',
        stroke: '#000000',
        strokeThickness: 6
      });
      popup.setOrigin(0.5, 0.5);

      this.tweens.add({
        targets: popup,
        y: centerY - 100,
        alpha: 0,
        duration: 800,
        ease: Phaser.Math.Easing.Cubic.Out,
        onComplete: () => {
          popup.destroy();
        }
      });
    }

    showComboCelebration(comboCount) {
      let centerX = this.sceneWidth / 2;
      let centerY = this.sceneHeight / 3;

      let emitter = this.add.particles(centerX, centerY, 'particle', {
        speed: { min: 100, max: 300 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.5, end: 0.2 },
        alpha: { start: 1, end: 0.3 },
        lifespan: 1200,
        gravityY: -200,
        tint: [0xffd700, 0xffaa00, 0xff8800, 0xffcc00],
        frequency: -1,
        quantity: 50
      });
      emitter.explode(50);

      this.time.delayedCall(1300, () => {
        emitter.destroy();
      });

      let comboText = this.add.text(centerX, centerY - 50, comboCount + 'x COMBO!', {
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 8,
        shadow: {
          offsetX: 4,
          offsetY: 4,
          color: '#ff6600',
          blur: 8,
          fill: true
        }
      });
      comboText.setOrigin(0.5, 0.5);
      comboText.setScale(0);

      this.tweens.add({
        targets: comboText,
        scaleX: 1.2,
        scaleY: 1.2,
        alpha: 1,
        duration: 300,
        ease: Phaser.Math.Easing.Back.Out
      });

      this.time.delayedCall(300, () => {
        this.tweens.add({
          targets: comboText,
          alpha: 0,
          y: centerY - 120,
          duration: 700,
          ease: Phaser.Math.Easing.Cubic.Out,
          onComplete: () => {
            comboText.destroy();
          }
        });
      });
    }

    renderLives() {
      if (!this.add || !this.livesContainer) return;

      this.add.text(10, 10, 'Lives: ' + this.battleState.hp, {
        fontSize: '16px',
        color: '#ffffff'
      });
    }

    awardProgressionBonus(points) {
      this.battleState.score += points;
      this.updateHUD();
      this.showFloatingScore(points);
    }

    showProgressionComplete(name) {
      let centerX = this.sceneWidth / 2;
      let centerY = this.sceneHeight / 2;

      let banner = this.add.text(centerX, centerY, 'Progression Complete!\n' + name, {
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#00ffff',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center'
      });
      banner.setOrigin(0.5, 0.5);
      banner.setScale(0.5);

      this.tweens.add({
        targets: banner,
        scaleX: 1.2,
        scaleY: 1.2,
        alpha: 1,
        duration: 300,
        ease: Phaser.Math.Easing.Back.Out,
        onComplete: () => {
          this.time.delayedCall(1000, () => {
            this.tweens.add({
              targets: banner,
              alpha: 0,
              scale: 1.5,
              duration: 400,
              ease: Phaser.Math.Easing.Cubic.Out,
              onComplete: () => {
                banner.destroy();
              }
            });
          });
        }
      });
    }

    playProgressionReplay(progression) {
      if (!this.bridge || !this.bridge.audio) return;

      progression.chords.forEach((symbol, index) => {
        this.time.delayedCall(index * 400, () => {
          if (this.bridge.audio.sampler && this.bridge.audio.sampler.releaseAll) {
            this.bridge.audio.sampler.releaseAll();
          }
          let midiNotes = C.chordToMidiNotes(symbol);
          this.bridge.audio.playChord(midiNotes, '4n');
        });
      });
    }

    setupNextProgression() {
      this.battleState.currentProgression = C.getRandomProgression(this.battleState.tier);
      this.battleState.progressionIndex = 0;
      this.battleState.progressionDamaged = false;
      this.battleState.breatherWavesRemaining = 0;
    }

    startNextProgression() {
      this.setupNextProgression();

      // chordsPerWave = full progression length
      this.battleState.chordsPerWave = this.battleState.currentProgression.chords.length;
      this.battleState.chordsCompleted = 0;
      this.updateWaveProgress();

      let symbol = this.battleState.currentProgression.chords[this.battleState.progressionIndex];
      let chord = C.CHORDS[symbol] || { symbol: symbol, name: symbol, tier: this.battleState.tier, notes: 0 };
      this.battleState.progressionIndex++;

      let midiNotes = C.chordToMidiNotes(chord.symbol);
      if (midiNotes.length === 0) {
        this.nextWave();
        return;
      }

      this.bridge.setTargetChord(chord.symbol, midiNotes);

      // Silence any lingering replay audio first, then play new chord after a brief gap
      if (this.bridge && this.bridge.audio) {
        if (this.bridge.audio.sampler && this.bridge.audio.sampler.releaseAll) {
          this.bridge.audio.sampler.releaseAll();
        }
        this.time.delayedCall(150, () => {
          if (this.bridge && this.bridge.audio) {
            this.bridge.audio.playChord(midiNotes, '2n');
          }
        });
      }

      let chordDisplay = document.getElementById('chord-display');
      if (chordDisplay) chordDisplay.textContent = chord.name;
      let chordNotes = document.getElementById('chord-notes');
      if (chordNotes) chordNotes.textContent = midiNotes.map(n => C.midiToNoteName ? C.midiToNoteName(n) : n).join(' - ');

      let progressionInfo = document.getElementById('progression-info');
      if (progressionInfo) {
        progressionInfo.textContent = this.battleState.currentProgression.name +
          ' (' + this.battleState.progressionIndex + '/' + this.battleState.currentProgression.chords.length + ')';
        progressionInfo.style.display = '';
      }

      this.spawnEnemies(midiNotes, this.battleState.level);
      this.battleState.waveStartTime = this.time.now;

      let lastEnemySpawnDelay = (midiNotes.length - 1) * 100;
      this.time.delayedCall(lastEnemySpawnDelay + this.getReadyBeatDelay(this.battleState.level), () => {
        this.startBulletFire(this.battleState.level);
      });
    }

    getFireInterval(level) {
      return Math.max(600, Math.floor(2800 - (level - 1) * 130));
    }

    getBulletSpeed(level) {
      return Math.min(500, 120 + (level - 1) * 25);
    }

    getReadyBeatDelay(level) {
      return Math.max(400, Math.floor(1800 - (level - 1) * 80));
    }

    getSpawnAnimationDuration(level) {
      if (level >= 10) return 300;
      return 500;
    }

    getChordsPerWave(wave) {
      // 3 chords for first 3 waves, then grows slowly
      return 3 + Math.floor((wave - 1) / 3);
    }

    getSfxContext() {
      if (!this._sfxCtx || this._sfxCtx.state === 'closed') {
        this._sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this._sfxCtx.state === 'suspended') {
        this._sfxCtx.resume();
      }
      return this._sfxCtx;
    }

    playDamageSound() {
      try {
        let ctx = this.getSfxContext();
        let t = ctx.currentTime;
        // Low thud
        let osc = ctx.createOscillator();
        let gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(20, t + 0.3);
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
        // Noise burst
        let bufferSize = Math.floor(ctx.sampleRate * 0.2);
        let buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        let data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        let noise = ctx.createBufferSource();
        noise.buffer = buffer;
        let noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.6, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        noise.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(t);
      } catch (e) {
        // Audio not available
      }
    }

    playDeflectSound() {
      try {
        let ctx = this.getSfxContext();
        let t = ctx.currentTime;
        let osc = ctx.createOscillator();
        let gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1500, t + 0.08);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      } catch (e) {}
    }

    playChordBlastSound() {
      try {
        let ctx = this.getSfxContext();
        let t = ctx.currentTime;
        // Rising sweep
        let osc = ctx.createOscillator();
        let gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
        // Shimmer
        let osc2 = ctx.createOscillator();
        let gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(800, t);
        osc2.frequency.exponentialRampToValueAtTime(2000, t + 0.1);
        gain2.gain.setValueAtTime(0.15, t);
        gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(t + 0.05);
        osc2.stop(t + 0.2);
      } catch (e) {}
    }

    updateWaveProgress() {
      let el = document.getElementById('wave-progress');
      if (el) {
        el.textContent = this.battleState.chordsCompleted + '/' + this.battleState.chordsPerWave;
      }
    }

    startBattle(tier) {
      this.battleState = {
        running: true,
        tier: tier,
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
        chordsPerWave: 3,
        chordsCompleted: 0,
        progressionMode: false,
        currentProgression: null,
        progressionIndex: 0,
        progressionDamaged: false,
        breatherWavesRemaining: 0,
        bulletSpeed: 40,
        _skipCount: 0
      };

      let progressionCheckbox = document.getElementById('progression-mode');
      this.battleState.progressionMode = progressionCheckbox && progressionCheckbox.checked;
      this.battleState.currentProgression = null;
      this.battleState.progressionIndex = 0;

      let startScreen = document.getElementById('battle-start-screen');
      if (startScreen) {
        startScreen.classList.add('hidden');
      }

      let hudBar = document.getElementById('hud-bar');
      if (hudBar) {
        hudBar.classList.remove('hidden');
      }

      this.scene.resume();
      this.nextWave();
    }

    nextWave() {
      this.waveActive = true;

      this.battleState.wave++;
      this.battleState.chordsCompleted = 0;
      this.battleState.level = this.battleState.wave;

      let chord;
      if (!this.battleState.progressionMode) {
        this.battleState.chordsPerWave = this.getChordsPerWave(this.battleState.wave);
        chord = C.getRandomChord(this.battleState.tier);
      } else {
        // Need a new progression?
        if (!this.battleState.currentProgression || this.battleState.progressionIndex >= this.battleState.currentProgression.chords.length) {
          // Award bonus and show message if undamaged, then move on
          if (this.battleState.currentProgression && !this.battleState.progressionDamaged) {
            this.awardProgressionBonus(200);
            this.showProgressionComplete(this.battleState.currentProgression.name);
          }
          this.setupNextProgression();
        }

        // chordsPerWave = remaining chords in this progression
        this.battleState.chordsPerWave = this.battleState.currentProgression.chords.length - this.battleState.progressionIndex;

        // Pick the next progression chord
        let symbol = this.battleState.currentProgression.chords[this.battleState.progressionIndex];
        chord = C.CHORDS[symbol] || { symbol: symbol, name: symbol, tier: this.battleState.tier, notes: 0 };
        this.battleState.progressionIndex++;
      }

      this.updateWaveProgress();

      let midiNotes = C.chordToMidiNotes(chord.symbol);

      if (midiNotes.length === 0) {
        this.battleState._skipCount = (this.battleState._skipCount || 0) + 1;
        if (this.battleState._skipCount < 20) {
          this.nextWave();
          return;
        } else {
          this.battleState._skipCount = 0;
          this.bridge.onGameOver();
          return;
        }
      }
      this.battleState._skipCount = 0;

      this.bridge.setTargetChord(chord.symbol, midiNotes);

      if (this.bridge && this.bridge.audio) {
        if (this.bridge.audio.sampler && this.bridge.audio.sampler.releaseAll) {
          this.bridge.audio.sampler.releaseAll();
        }
        this.bridge.audio.playChord(midiNotes, '2n');
      }

      let chordDisplay = document.getElementById('chord-display');
      if (chordDisplay) {
        chordDisplay.textContent = chord.name;
      }
      let chordNotes = document.getElementById('chord-notes');
      if (chordNotes) {
        chordNotes.textContent = midiNotes.map(n => C.midiToNoteName ? C.midiToNoteName(n) : n).join(' - ');
      }

      let progressionInfo = document.getElementById('progression-info');
      if (progressionInfo) {
        if (this.battleState.progressionMode && this.battleState.currentProgression) {
          progressionInfo.textContent = this.battleState.currentProgression.name +
            ' (' + this.battleState.progressionIndex + '/' + this.battleState.currentProgression.chords.length + ')';
          progressionInfo.style.display = '';
        } else {
          progressionInfo.style.display = 'none';
        }
      }

      this.spawnEnemies(midiNotes, this.battleState.level);

      this.battleState.waveStartTime = this.time.now;

      let lastEnemySpawnDelay = (midiNotes.length - 1) * 100;
      this.time.delayedCall(lastEnemySpawnDelay + this.getReadyBeatDelay(this.battleState.level), () => {
        this.startBulletFire(this.battleState.level);
      });
    }

    clearLaser(midiNote) {
      let laserData = this.laserGroup.get(midiNote);
      if (laserData) {
        if (laserData.glow) laserData.glow.destroy();
        if (laserData.outer) laserData.outer.destroy();
        if (laserData.middle) laserData.middle.destroy();
        if (laserData.inner) laserData.inner.destroy();
        this.laserGroup.delete(midiNote);
      }
    }

    onBulletHit(bulletX) {
      if (!this.battleState.running) return;

      this.battleState.hp--;
      this.battleState.combo = 0;

      this.updateHUD();

      this.triggerHPAnimation();
      this.playDamageSound();
      this.screenShake(300, 0.012);

      // Explosion at impact point
      let impactX = bulletX || this.sceneWidth / 2;
      let impactY = this.sceneHeight - 10;

      let explosion = this.add.particles(impactX, impactY, 'particle', {
        speed: { min: 80, max: 250 },
        angle: { min: 200, max: 340 },
        scale: { start: 1.5, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 500,
        tint: [0xff4444, 0xff6644, 0xff0000],
        emitting: false
      });
      explosion.explode(20);
      this.time.delayedCall(600, () => explosion.destroy());

      // Floating damage text
      let dmgText = this.add.text(impactX, impactY - 30, '-1 HP', {
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ff4444',
        stroke: '#000000',
        strokeThickness: 4
      });
      dmgText.setOrigin(0.5, 0.5);
      this.tweens.add({
        targets: dmgText,
        y: impactY - 120,
        alpha: 0,
        duration: 800,
        ease: 'Cubic.Out',
        onComplete: () => dmgText.destroy()
      });

      if (this.battleState.hp <= 0) {
        this.onGameOver();
      }
    }

    triggerHPAnimation() {
      let hpBar = document.getElementById('hp-bar');
      let livesDisplay = document.getElementById('lives-display');

      if (hpBar) {
        hpBar.classList.remove('shake');
        void hpBar.offsetWidth;
        hpBar.classList.add('shake');
      }

      if (livesDisplay) {
        livesDisplay.classList.remove('flash-red');
        void livesDisplay.offsetWidth;
        livesDisplay.classList.add('flash-red');
      }

      // Use Phaser camera flash so it's visible over the canvas
      this.cameras.main.flash(300, 255, 0, 0, false, (cam, progress) => {
        cam.setAlpha(1);
      });
    }
  }

  C.BattleScene = BattleScene;
  C.SCENE_KEYS = SCENE_KEYS;

  class Enemy extends Phaser.GameObjects.Container {
    constructor(scene, midiNote, x, y, isAccidental) {
      super(scene, x, y);

      this.midiNote = midiNote;
      this.isAccidental = isAccidental;
      this.alive = true;

      const glowRadius = isAccidental ? 24 : 30;
      const bodyRadius = isAccidental ? 16 : 20;
      const bodyColor = isAccidental ? 0xff00ff : 0x00ffff;

      this.glow = scene.add.ellipse(0, 0, glowRadius * 2, glowRadius * 2, bodyColor);
      this.glow.setAlpha(0.3);

      this.body = scene.add.ellipse(0, 0, bodyRadius * 2, bodyRadius * 2, bodyColor);

      this.label = scene.add.text(0, 0, '', {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold'
      });
      this.label.setOrigin(0.5, 0.5);
      this.label.setVisible(false);

      this.add([this.glow, this.body, this.label]);

      scene.add.existing(this);
    }

    spawnAnimation(duration = 500) {
      if (!this.scene) return;
      const startY = this.y;
      const offScreenY = -100;

      this.y = offScreenY;
      this.setAlpha(0);

      this.scene.tweens.add({
        targets: this,
        alpha: 1,
        y: startY,
        duration: duration,
        ease: Phaser.Math.Easing.Back.Out
      });
    }

    die() {
      if (!this.scene || !this.alive) return;
      this.alive = false;

      if (this.scene.emitDeathParticles) {
        let tint = this.body ? this.body.fillColor : 0x00ffff;
        this.scene.emitDeathParticles(this.x, this.y, tint);
      }

      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 400,
        ease: Phaser.Math.Easing.Back.In,
        onComplete: () => {
          this.destroy();
        }
      });
    }

    showLabel() {
      let level = this.scene.gameState ? this.scene.gameState.level : 1;
      if (level >= 15) {
        let noteName = C.NOTE_NAMES[this.midiNote % 12];
        this.label.setText(noteName);
        this.label.setVisible(true);
      }
    }
  }

  C.Enemy = Enemy;

  class Bullet extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
      super(scene, x, y);

      this.speed = 400;
      this.active = true;

      this.core = scene.add.ellipse(0, 0, 6, 6, 0xff4444);
      
      this.glow = scene.add.ellipse(0, 0, 12, 12, 0xff6644);
      this.glow.setAlpha(0.3);

      this.trailEmitter = scene.add.particles(0, 0, 'particle', {
        speed: { min: 10, max: 40 },
        angle: { min: 240, max: 300 },
        scale: { start: 0.3, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 200,
        tint: [0xff4444, 0xff6644],
        emitting: false,
        on: false
      });

      this.add([this.glow, this.core]);

      scene.add.existing(this);
    }

    fire(directionX, directionY) {
      this.active = true;
      this.dirX = directionX;
      this.dirY = directionY;
    }

    update(time, delta) {
      if (!this.active) return;

      // Simple manual movement only — no physics conflicts
      this.y += this.dirY * this.speed * delta / 1000;
      this.x += this.dirX * this.speed * delta / 1000;

      if (this.trailEmitter) {
        this.trailEmitter.emitParticleAt(this.x, this.y, Phaser.Math.Between(3, 6));
      }
    }

    deactivate() {
      this.active = false;
      if (this.trailEmitter) {
        this.trailEmitter.emitParticleAt(this.x, this.y, 3);
        this.trailEmitter.stop();
      }
    }

    deflect() {
      this.active = false;

      if (this.scene && this.scene.add) {
        let flashEllipse = this.scene.add.ellipse(this.x, this.y, 10, 10, 0x00ffff);
        flashEllipse.setAlpha(1);
        flashEllipse.setScale(0);

        this.scene.tweens.add({
          targets: flashEllipse,
          scaleX: 2,
          scaleY: 2,
          alpha: 0,
          duration: 200,
          ease: Phaser.Math.Easing.Cubic.Out,
          onComplete: () => {
            flashEllipse.destroy();
          }
        });

        let burstEmitter = this.scene.add.particles(this.x, this.y, 'particle', {
          speed: { min: 80, max: 250 },
          angle: { min: 0, max: 360 },
          scale: { start: 1.0, end: 0 },
          alpha: { start: 0.8, end: 0 },
          lifespan: 350,
          frequency: -1,
          tint: [0xffffff, 0x00ffff],
          quantity: 8,
          emitting: false
        });

        burstEmitter.explode(8);

        this.scene.time.delayedCall(400, () => {
          burstEmitter.destroy();
        });
      }

      this.destroy();
    }

    destroy() {
      if (this.trailEmitter) {
        this.trailEmitter.destroy();
      }
      super.destroy();
    }
  }

  C.Bullet = Bullet;

  let battleScene = null;

  function initBattleUI(game) {
    game.events.once('ready', () => {
      battleScene = game.scene.getScene(C.SCENE_KEYS.BATTLE);

      document.querySelectorAll('#battle-start-screen .tier-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          let tier = parseInt(btn.dataset.tier, 10);
          if (battleScene && battleScene.startBattle) {
            battleScene.startBattle(tier);
          }
        });
      });

      let restartButton = document.getElementById('restart-button');
      if (restartButton) {
        restartButton.addEventListener('click', () => {
          let gameOverOverlay = document.getElementById('game-over-overlay');
          let startScreen = document.getElementById('battle-start-screen');
          if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
          }
          if (startScreen) {
            startScreen.classList.remove('hidden');
          }
          if (battleScene) {
            battleScene.scene.resume();
          }
        });
      }

      let menuButton = document.getElementById('menu-button');
      if (menuButton) {
        menuButton.addEventListener('click', () => {
          window.location.href = './index.html';
        });
      }

      let startButton = document.getElementById('start-button');
      if (startButton) {
        startButton.style.display = 'none';
      }
    });
  }

  C.initBattleUI = initBattleUI;

  let game = null;

  function startBattleGame() {
    if (game) return;

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'phaser-container',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#000018',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 }
        }
      },
      scene: C.BattleScene,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
    });

    C.initBattleUI(game);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBattleGame);
  } else {
    startBattleGame();
  }

})(window.Chordessy);