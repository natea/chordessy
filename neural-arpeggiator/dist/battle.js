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

})(window.Chordessy);