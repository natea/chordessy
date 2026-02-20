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
      this.bridge = new BattleBridge({
        scene: this,
        keyboardContainer: document.getElementById('keyboard') || document.body,
        keyElements: []
      });
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

})(window.Chordessy);