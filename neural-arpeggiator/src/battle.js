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
  }

  C.BattleBridge = BattleBridge;

})(window.Chordessy);