// battle.js - Chordessy neural arpeggiator battle mode
window.Chordessy = window.Chordessy || {};

(function(C) {
  'use strict';

  // --- Constants ---
  const BATTLE_CONFIG = {
    width: 800,
    height: 600,
    parent: 'phaser-container',
    type: Phaser.AUTO,
    transparent: true,
    physics: { default: 'arcade', arcade: { debug: false } }
  };

  const SCENE_KEYS = {
    BATTLE: 'BattleScene',
    UI: 'UIScene'
  };

  const AUDIO_SETTINGS = {
    sampleRate: 44100,
    channels: 2,
    bpm: 120
  };

  // --- Game state ---
  let state = {
    initialized: false,
    game: null,
    currentScene: null,
    audioContext: null,
    battleBridge: null,
    keyboard: null,
    audio: null,
    midi: null
  };

  // --- Phaser Scene Stubs ---
  class BattleScene extends Phaser.Scene {
    constructor() {
      super(SCENE_KEYS.BATTLE);
    }

    preload() {
    }

    create() {
      let width = this.cameras.main.width;
      let height = this.cameras.main.height;

      this.physics.world.setBounds(0, 0, width, height);

      this.sceneWidth = width;
      this.sceneHeight = height;

      this.stars = [];
      let starCount = 100;
      for (let i = 0; i < starCount; i++) {
        let x = Phaser.Math.Between(0, width);
        let y = Phaser.Math.Between(0, height);
        let size = Phaser.Math.FloatBetween(1, 3);
        let speed = Phaser.Math.FloatBetween(0.5, 3);
        let star = this.add.circle(x, y, size, 0xffffff, Phaser.Math.FloatBetween(0.3, 0.8));
        star.starSpeed = speed;
        this.stars.push(star);
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
  }

  class UIScene extends Phaser.Scene {
    constructor() {
      super(SCENE_KEYS.UI);
    }

    preload() {
    }

    create() {
    }

    update(time, delta) {
    }
  }

  // --- Battle Bridge (T009) ---
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
  }

  // --- Phaser Game Creation ---
  function createPhaserGame() {
    let container = document.getElementById('phaser-container');
    let rect = container.getBoundingClientRect();
    let width = Math.floor(rect.width);
    let height = Math.floor(rect.height);

    let config = {
      width: width,
      height: height,
      parent: 'phaser-container',
      type: Phaser.AUTO,
      transparent: true,
      physics: { default: 'arcade', arcade: { debug: false } },
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: width,
        height: height
      },
      scene: [BattleScene, UIScene]
    };

    return new Phaser.Game(config);
  }

  // --- Canvas Resize Handler ---
  function handleResize() {
    let container = document.getElementById('phaser-container');
    if (container && state.game) {
      let rect = container.getBoundingClientRect();
      let width = Math.floor(rect.width);
      let height = Math.floor(rect.height);

      state.game.scale.resize(width, height);
    }
  }

  // --- Initialization ---
  function init() {
    if (state.initialized) return;

    let keyboardContainer = document.getElementById('keyboard-area');
    state.keyboard = C.buildKeyboard(keyboardContainer);

    let audioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new audioContextClass();

    navigator.requestMIDIAccess().then(midiAccess => {
      state.midi = midiAccess;
    }).catch(err => {
      console.warn('MIDI not available:', err);
    });

    state.game = createPhaserGame();
    state.battleBridge = new BattleBridge({
      scene: null,
      keyboardContainer: keyboardContainer,
      keyElements: null
    });
    state.initialized = true;

    window.addEventListener('resize', handleResize);
  }

  // --- DOM Ready ---
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });

  // --- Expose on namespace ---
  C.BATTLE_CONFIG = BATTLE_CONFIG;
  C.SCENE_KEYS = SCENE_KEYS;
  C.AUDIO_SETTINGS = AUDIO_SETTINGS;
  C.state = state;
  C.BattleScene = BattleScene;
  C.UIScene = UIScene;
  C.BattleBridge = BattleBridge;
  C.init = init;

})(window.Chordessy);