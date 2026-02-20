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
    }

    update(time, delta) {
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

  // --- Battle Bridge ---
  class BattleBridge {
    constructor() {
      this.battleScene = null;
      this.uiScene = null;
      this.audioEngine = null;
    }

    init(game) {
      this.battleScene = game.scene.getScene(SCENE_KEYS.BATTLE);
      this.uiScene = game.scene.getScene(SCENE_KEYS.UI);
      return this;
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

    let config = {
      ...BATTLE_CONFIG,
      scene: [BattleScene, UIScene]
    };

    state.game = new Phaser.Game(config);
    state.battleBridge = new BattleBridge().init(state.game);
    state.initialized = true;
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