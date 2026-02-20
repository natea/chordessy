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
      C.setupMidi()
        .then(midi => {
          midi.onNoteOn((note, velocity) => {
            this.noteOn(note);
          });
          midi.onNoteOff(note => {
            this.noteOff(note);
          });
        })
        .catch(err => {
          console.warn('MIDI not available:', err);
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
      this.stars = [];
      let starCount = 100;
      for (let i = 0; i < starCount; i++) {
        let x = Phaser.Math.Between(0, width);
        let y = Phaser.Math.Between(0, height);
        let star = this.add.circle(x, y, 0xffffff);
        let speed = Phaser.Math.FloatBetween(0.5, 2);
        star.starSpeed = speed;
        this.stars.push(star);
      }
      this.events.on('destroy', enemy => this.handleEnemyDestroy({ GameObject: enemy }));
      this.enemies = [];
      this.bridge = new BattleBridge({
        scene: this,
        keyboardContainer: document.getElementById('keyboard') || document.body,
        keyElements: []
      });
      this.laserGroup = new Map();
      this.bridge.emitter.on('noteOn', this.onNoteOn.bind(this));
      this.bridge.emitter.on('noteOff', this.onNoteOff.bind(this));
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
    }

    emitDeathParticles(x, y, tint) {
      let count = 20 + Math.floor(Math.random() * 11);
      let emitter = this.add.particles(x, y, 'particle-white', {
        speed: { min: 50, max: 200 },
        lifespan: 400,
        gravityY: 80,
        scale: { start: 1.0, end: 0 },
        tint: tint,
        emitting: false
      });
      emitter.explode(count);
      this.time.delayedCall(500, () => emitter.destroy());
    }

    screenShake(duration, intensity) {
      duration = duration || 200;
      intensity = intensity || 0.005;
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
        this.screenShake(200, 0.005);
      }
    }

    spawnEnemies(midiNotes, level) {
      this.enemies.forEach(enemy => {
        if (enemy && enemy.alive) {
          enemy.destroy();
        }
      });
      this.enemies = [];

      let keyXMap = this.bridge.keyXMap;

      midiNotes.forEach((midiNote, index) => {
        let x, y, isAccidental;

        if (level < 15) {
          let keyInfo = keyXMap.get(midiNote);
          x = keyInfo ? keyInfo.x : Phaser.Math.Between(50, this.sceneWidth - 50);
          isAccidental = keyInfo ? keyInfo.isAccidental : false;
          y = Phaser.Math.Between(50, this.sceneHeight - 150);
        } else {
          x = Phaser.Math.Between(50, this.sceneWidth - 50);
          y = Phaser.Math.Between(50, this.sceneHeight - 150);
          isAccidental = false;
        }

        let enemy = new Enemy(this.scene, midiNote, x, y, isAccidental);
        this.enemies.push(enemy);

        if (level >= 15) {
          enemy.showLabel();
        }

        this.time.delayedCall(index * 100, () => {
          if (enemy && enemy.alive) {
            enemy.spawnAnimation();
          }
        });
      });
    }

    onNoteOn({ midiNote, x, isCorrect }) {
      let keyXMap = this.bridge.keyXMap;
      let keyInfo = keyXMap.get(midiNote);
      let startX = keyInfo ? keyInfo.x : x;
      let startY = this.sceneHeight - 50;

      if (isCorrect) {
        let laserData = { outer: null, middle: null, inner: null, tweens: [] };

        laserData.outer = this.add.graphics();
        laserData.outer.lineStyle(6, 0x00ffff, 0.2);
        laserData.outer.beginPath();
        laserData.outer.moveTo(startX, startY);
        
        let targetEnemy = this.enemies.find(e => e.midiNote === midiNote && e.alive);
        let endX = targetEnemy ? targetEnemy.x : startX;
        let endY = targetEnemy ? targetEnemy.y : 50;
        
        laserData.outer.lineTo(endX, endY);
        laserData.outer.strokePath();

        laserData.middle = this.add.graphics();
        laserData.middle.lineStyle(3, 0x00ffff, 0.5);
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

        let pulseTween = this.tweens.add({
          targets: [laserData.outer, laserData.middle, laserData.inner],
          alpha: 0,
          duration: 50,
          yoyo: true,
          repeat: 3,
          onYoyo: () => {
            laserData.outer.lineStyle(6, 0x00ffff, 0.4);
            laserData.outer.strokePath();
            laserData.middle.lineStyle(3, 0x00ffff, 0.7);
            laserData.middle.strokePath();
            laserData.inner.lineStyle(1, 0xffffff, 1.0);
            laserData.inner.strokePath();
          },
          onRepeat: () => {
            laserData.outer.lineStyle(6, 0x00ffff, 0.2);
            laserData.outer.strokePath();
            laserData.middle.lineStyle(3, 0x00ffff, 0.5);
            laserData.middle.strokePath();
          }
        });

        if (targetEnemy) {
          this.time.delayedCall(100, () => {
            targetEnemy.die();
            this.onCorrectAnswer({ chord: this.bridge.targetSymbol || {}, lastEnemy: true });
          });
        }

        this.time.delayedCall(200, () => {
          this.clearLaser(midiNote);
        });
      } else {
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
      for (let [midiNote, laserData] of this.laserGroup) {
        laserData.outer.lineStyle(6, 0x00ffff, 1.0);
        laserData.outer.strokePath();
        laserData.middle.lineStyle(3, 0x00ffff, 1.0);
        laserData.middle.strokePath();
        laserData.inner.lineStyle(1, 0xffffff, 1.0);
        laserData.inner.strokePath();
      }

      this.time.delayedCall(200, () => {
        this.enemies.forEach(enemy => {
          if (enemy && enemy.alive) {
            enemy.die();
          }
        });

        let allMidiNotes = Array.from(this.laserGroup.keys());
        allMidiNotes.forEach(midiNote => {
          this.clearLaser(midiNote);
        });
      });
    }

    clearLaser(midiNote) {
      let laserData = this.laserGroup.get(midiNote);
      if (laserData) {
        if (laserData.outer) laserData.outer.destroy();
        if (laserData.middle) laserData.middle.destroy();
        if (laserData.inner) laserData.inner.destroy();
        this.laserGroup.delete(midiNote);
      }
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

    spawnAnimation() {
      const startY = this.y;
      const offScreenY = -100;
      
      this.y = offScreenY;
      this.setAlpha(0);
      
      this.scene.tweens.add({
        targets: this,
        alpha: 1,
        y: startY,
        duration: 500,
        ease: Phaser.Math.Easing.Back.Out
      });
    }

    die() {
      this.alive = false;

      if (this.scene.emitDeathParticles) {
        let tint = this.body.fillColor;
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

      this.trailEmitter = scene.add.particles(0, 0, null, {
        speed: { min: 20, max: 60 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.6, end: 0 },
        lifespan: 300,
        frequency: -1,
        tint: [0xff4444, 0xff6644],
        emitting: false
      });

      this.add([this.glow, this.core]);

      scene.add.existing(this);
    }

    fire(directionX, directionY) {
      this.active = true;
      this.trailEmitter.start();
      
      let velocity = new Phaser.Math.Vector2(directionX, directionY).normalize().scale(this.speed);
      this.scene.physics.add.existing(this);
      this.body.setVelocity(velocity.x, velocity.y);
    }

    update(time, delta) {
      if (!this.active) return;

      this.y += this.speed * delta / 1000;

      if (this.scene) {
        let { width, height } = this.scene.cameras.main;
        
        if (this.y > height) {
          if (this.scene.events) {
            this.scene.events.emit('bulletHit', { bullet: this });
          }
          this.deactivate();
        }

        if (this.x < -50 || this.x > width + 50 || this.y < -50) {
          this.deactivate();
        }
      }
    }

    deactivate() {
      this.active = false;
      this.trailEmitter.emitParticleAt(this.x, this.y, 3);
      this.trailEmitter.stop();
      
      if (this.body) {
        this.body.setVelocity(0, 0);
      }
    }

    deflect() {
      this.active = false;

      if (this.scene && this.scene.add) {
        let burstEmitter = this.scene.add.particles(this.x, this.y, null, {
          speed: { min: 80, max: 250 },
          angle: { min: 180, max: 360 },
          scale: { start: 1.0, end: 0 },
          alpha: { start: 0.8, end: 0 },
          lifespan: 350,
          frequency: -1,
          tint: [0xff4444, 0xff6644, 0xff8844],
          quantity: 15,
          emitting: false
        });

        burstEmitter.explode(15);

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

})(window.Chordessy);