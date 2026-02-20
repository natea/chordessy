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

      this.checkChord();
    }

    noteOff(midiNote) {
      if (!this.heldNotes.has(midiNote)) return;

      this.heldNotes.delete(midiNote);

      this.emitter.emit('noteOff', { midiNote });
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
  }

  C.BattleBridge = BattleBridge;

})(window.Chordessy);