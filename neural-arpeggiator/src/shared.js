// shared.js - Shared utilities for Chordessy apps
window.Chordessy = window.Chordessy || {};

(function(C) {
  const MIN_NOTE = 48;
  const MAX_NOTE = 84;
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function isAccidental(note) {
    let pc = note % 12;
    return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
  }

  function buildKeyboard(container) {
    let nAccidentals = _.range(MIN_NOTE, MAX_NOTE + 1).filter(isAccidental).length;
    let keyWidthPercent = 100 / (MAX_NOTE - MIN_NOTE - nAccidentals + 1);
    let keyInnerWidthPercent = keyWidthPercent - 0.5;
    let gapPercent = keyWidthPercent - keyInnerWidthPercent;
    let accumulatedWidth = 0;
    return _.range(MIN_NOTE, MAX_NOTE + 1).map(note => {
      let accidental = isAccidental(note);
      let key = document.createElement('div');
      key.classList.add('key');
      key.dataset.note = note;
      if (accidental) {
        key.classList.add('accidental');
        key.style.left = `${accumulatedWidth - gapPercent - (keyWidthPercent / 2 - gapPercent) / 2}%`;
        key.style.width = `${keyWidthPercent / 2}%`;
      } else {
        key.style.left = `${accumulatedWidth}%`;
        key.style.width = `${keyInnerWidthPercent}%`;
      }
      container.appendChild(key);
      if (!accidental) accumulatedWidth += keyWidthPercent;
      return key;
    });
  }

  function midiToNoteName(midi) {
    return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  }

  function midiToPitchClass(midi) {
    return midi % 12;
  }

  function detectChord(notes) {
    let noteNames = notes.map(n => Tonal.Note.pc(Tonal.Note.fromMidi(n))).sort();
    return Tonal.PcSet.modes(noteNames)
      .map((mode, i) => {
        const tonic = Tonal.Note.name(noteNames[i]);
        const names = Tonal.Dictionary.chord.names(mode);
        return names.length ? tonic + names[0] : null;
      })
      .filter(x => x);
  }

  // Compare two sets of pitch classes (0-11) regardless of octave
  function pitchClassesMatch(midiNotesA, midiNotesB) {
    let setA = [...new Set(midiNotesA.map(n => n % 12))].sort((a, b) => a - b);
    let setB = [...new Set(midiNotesB.map(n => n % 12))].sort((a, b) => a - b);
    if (setA.length !== setB.length) return false;
    return setA.every((v, i) => v === setB[i]);
  }

  // Resolve a chord symbol (e.g. "Cmaj7") to an array of MIDI note numbers in octave 4
  function chordToMidiNotes(chordSymbol) {
    // Use Tonal.Chord.notes() which works in both old (v1) and new Tonal.js
    let notes = Tonal.Chord.notes(chordSymbol);
    if (!notes || notes.length === 0) return [];
    // Place in octave 4, keep all notes within one octave span
    let rootMidi = Tonal.Note.midi(notes[0] + '4');
    return notes.map(n => {
      let midi = Tonal.Note.midi(n + '4');
      // Wrap notes below root up an octave
      if (midi < rootMidi) midi += 12;
      return midi;
    });
  }

  function animatePlay(keyEl, note, color) {
    let targetColor = isAccidental(note) ? 'black' : 'white';
    keyEl.animate(
      [{ backgroundColor: color }, { backgroundColor: targetColor }],
      { duration: 700, easing: 'ease-out' }
    );
  }

  // Setup WebMidi and return a promise with {onNoteOn, onNoteOff} callback setters
  function setupMidi() {
    let noteOnCallbacks = [];
    let noteOffCallbacks = [];

    return new Promise((resolve, reject) => {
      WebMidi.enable(err => {
        if (err) {
          reject(err);
          return;
        }
        function bindInput(input) {
          input.addListener('noteon', 1, e => {
            noteOnCallbacks.forEach(cb => cb(e.note.number, e.velocity));
          });
          input.addListener('noteoff', 1, e => {
            noteOffCallbacks.forEach(cb => cb(e.note.number));
          });
        }
        WebMidi.inputs.forEach(bindInput);
        WebMidi.addListener('connected', () => {
          WebMidi.inputs.forEach(bindInput);
        });

        resolve({
          onNoteOn(cb) { noteOnCallbacks.push(cb); },
          onNoteOff(cb) { noteOffCallbacks.push(cb); },
          getInputs() { return WebMidi.inputs; }
        });
      });
    });
  }

  // Setup audio engine (Tone.js sampler with effects)
  function setupAudio() {
    let Tone = mm.Player.tone;
    let masterGain = new Tone.Gain(0.6).toMaster();
    let reverb = new Tone.Convolver(
      'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/hm2_000_ortf_48k.mp3'
    ).connect(masterGain);
    reverb.wet.value = 0.1;
    let echo = new Tone.FeedbackDelay('8n.', 0.4).connect(
      new Tone.Gain(0.5).connect(reverb)
    );
    let lowPass = new Tone.Filter(5000).connect(echo).connect(reverb);
    let sampler = new Tone.Sampler({
      C3: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-c3.wav',
      'D#3': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-ds3.wav',
      'F#3': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-fs3.wav',
      A3: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-a3.wav',
      C4: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-c4.wav',
      'D#4': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-ds4.wav',
      'F#4': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-fs4.wav',
      A4: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-a4.wav',
      C5: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-c5.wav',
      'D#5': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-ds5.wav',
      'F#5': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-fs5.wav',
      A5: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/s11-a5.wav'
    }).connect(lowPass);
    sampler.release.value = 2;

    return {
      Tone,
      sampler,
      masterGain,
      playNote(note, velocity, time) {
        let freq = Tone.Frequency(note, 'midi');
        sampler.triggerAttack(freq, time || Tone.now(), velocity || 0.7);
      },
      playChord(midiNotes, duration) {
        let now = Tone.now();
        midiNotes.forEach(note => {
          let freq = Tone.Frequency(note, 'midi');
          sampler.triggerAttackRelease(freq, duration || '2n', now);
        });
      }
    };
  }

  // Expose on namespace
  C.MIN_NOTE = MIN_NOTE;
  C.MAX_NOTE = MAX_NOTE;
  C.NOTE_NAMES = NOTE_NAMES;
  C.isAccidental = isAccidental;
  C.buildKeyboard = buildKeyboard;
  C.midiToNoteName = midiToNoteName;
  C.midiToPitchClass = midiToPitchClass;
  C.detectChord = detectChord;
  C.pitchClassesMatch = pitchClassesMatch;
  C.chordToMidiNotes = chordToMidiNotes;
  C.animatePlay = animatePlay;
  C.setupMidi = setupMidi;
  C.setupAudio = setupAudio;

})(window.Chordessy);
