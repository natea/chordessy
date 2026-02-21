// chords-db.js - Chord definitions organized by difficulty
window.Chordessy = window.Chordessy || {};

(function(C) {

  // Difficulty tiers: 1=beginner (3-note), 2=intermediate (3-note all types),
  // 3=advanced (4-note), 4=expert (5+ note)
  const CHORDS = {
    // --- TIER 1: Major triads in easy keys ---
    'C':    { symbol: 'C',    name: 'C major',     tier: 1, notes: 3 },
    'F':    { symbol: 'F',    name: 'F major',     tier: 1, notes: 3 },
    'G':    { symbol: 'G',    name: 'G major',     tier: 1, notes: 3 },
    'Am':   { symbol: 'Am',   name: 'A minor',     tier: 1, notes: 3 },
    'Dm':   { symbol: 'Dm',   name: 'D minor',     tier: 1, notes: 3 },
    'Em':   { symbol: 'Em',   name: 'E minor',     tier: 1, notes: 3 },

    // --- TIER 2: All major/minor triads + dim/aug ---
    'D':    { symbol: 'D',    name: 'D major',     tier: 2, notes: 3 },
    'E':    { symbol: 'E',    name: 'E major',     tier: 2, notes: 3 },
    'A':    { symbol: 'A',    name: 'A major',     tier: 2, notes: 3 },
    'Bb':   { symbol: 'Bb',   name: 'Bb major',    tier: 2, notes: 3 },
    'Eb':   { symbol: 'Eb',   name: 'Eb major',    tier: 2, notes: 3 },
    'Ab':   { symbol: 'Ab',   name: 'Ab major',    tier: 2, notes: 3 },
    'Cm':   { symbol: 'Cm',   name: 'C minor',     tier: 2, notes: 3 },
    'Fm':   { symbol: 'Fm',   name: 'F minor',     tier: 2, notes: 3 },
    'Gm':   { symbol: 'Gm',   name: 'G minor',     tier: 2, notes: 3 },
    'Bm':   { symbol: 'Bm',   name: 'B minor',     tier: 2, notes: 3 },
    'Bdim': { symbol: 'Bdim', name: 'B diminished', tier: 2, notes: 3 },
    'Caug': { symbol: 'Caug', name: 'C augmented',  tier: 2, notes: 3 },

    // --- TIER 3: Seventh chords (4 notes) ---
    'Cmaj7':  { symbol: 'Cmaj7',  name: 'C major 7',     tier: 3, notes: 4 },
    'Dm7':    { symbol: 'Dm7',    name: 'D minor 7',     tier: 3, notes: 4 },
    'Em7':    { symbol: 'Em7',    name: 'E minor 7',     tier: 3, notes: 4 },
    'Fmaj7':  { symbol: 'Fmaj7',  name: 'F major 7',     tier: 3, notes: 4 },
    'G7':     { symbol: 'G7',     name: 'G dominant 7',   tier: 3, notes: 4 },
    'Am7':    { symbol: 'Am7',    name: 'A minor 7',     tier: 3, notes: 4 },
    'Bm7b5':  { symbol: 'Bm7b5', name: 'B half-dim 7',  tier: 3, notes: 4 },
    'D7':     { symbol: 'D7',     name: 'D dominant 7',   tier: 3, notes: 4 },
    'A7':     { symbol: 'A7',     name: 'A dominant 7',   tier: 3, notes: 4 },
    'E7':     { symbol: 'E7',     name: 'E dominant 7',   tier: 3, notes: 4 },
    'Bb7':    { symbol: 'Bb7',    name: 'Bb dominant 7',  tier: 3, notes: 4 },
    'C7':     { symbol: 'C7',     name: 'C dominant 7',   tier: 3, notes: 4 },

    // --- TIER 4: Extended / altered chords (5+ notes) ---
    'Cmaj9':  { symbol: 'Cmaj9',  name: 'C major 9',     tier: 4, notes: 5 },
    'Dm9':    { symbol: 'Dm9',    name: 'D minor 9',     tier: 4, notes: 5 },
    'G9':     { symbol: 'G9',     name: 'G dominant 9',   tier: 4, notes: 5 },
    'Am9':    { symbol: 'Am9',    name: 'A minor 9',     tier: 4, notes: 5 },
    'Cmaj11': { symbol: 'Cmaj11', name: 'C major 11',    tier: 4, notes: 5 },
    'G13':    { symbol: 'G13',    name: 'G dominant 13',  tier: 4, notes: 6 },
  };

  // Common progressions for level sequences (Roman numerals resolved to C major)
  // Source: Hooktheory top progressions
  const PROGRESSIONS = [
    // Beginner progressions (tier 1 chords only)
    { name: 'Pop Classic',       tier: 1, chords: ['C', 'G', 'Am', 'F'] },
    { name: 'Doo-wop',           tier: 1, chords: ['C', 'Am', 'F', 'G'] },
    { name: 'Country Road',      tier: 1, chords: ['C', 'F', 'G', 'C'] },
    { name: 'Emo Anthem',        tier: 1, chords: ['Am', 'F', 'C', 'G'] },
    { name: 'Three Chord Rock',  tier: 1, chords: ['C', 'F', 'G'] },

    // Intermediate progressions (use tier 2 chords)
    { name: 'Minor Drama',       tier: 2, chords: ['Cm', 'Fm', 'Bb', 'Eb'] },
    { name: 'Andalusian',        tier: 2, chords: ['Am', 'G', 'F', 'E'] },
    { name: 'Dark Pop',          tier: 2, chords: ['Gm', 'Bb', 'D', 'Eb'] },
    { name: 'Soul Train',        tier: 2, chords: ['Ab', 'Fm', 'Bb', 'Eb'] },
    { name: 'Rock Ballad',       tier: 2, chords: ['D', 'Bm', 'G', 'A'] },
    { name: 'Motown Groove',     tier: 2, chords: ['Bb', 'Gm', 'Cm', 'Eb'] },

    // Advanced progressions (tier 3 chords)
    { name: 'Jazz ii-V-I',       tier: 3, chords: ['Dm7', 'G7', 'Cmaj7'] },
    { name: 'Smooth Jazz',       tier: 3, chords: ['Cmaj7', 'Am7', 'Dm7', 'G7'] },
    { name: 'Autumn Leaves',     tier: 3, chords: ['Am7', 'D7', 'Cmaj7', 'Fmaj7'] },
    { name: 'Blues Turnaround',  tier: 3, chords: ['G7', 'C7', 'D7', 'G7'] },

    // Expert progressions (tier 4 chords)
    { name: 'Neo-Soul',          tier: 4, chords: ['Cmaj9', 'Am9', 'Dm9', 'G9'] },
    { name: 'Modern Jazz',       tier: 4, chords: ['Cmaj9', 'Dm9', 'G13', 'Cmaj9'] },
  ];

  function getChordsByTier(tier) {
    return Object.values(CHORDS).filter(c => c.tier <= tier);
  }

  function getProgressionsByTier(tier) {
    return PROGRESSIONS.filter(p => p.tier <= tier);
  }

  function getRandomChord(tier) {
    // 90% chance: pick from exact tier; 10%: pick from one tier below
    let exactPool = Object.values(CHORDS).filter(c => c.tier === tier);
    if (exactPool.length > 0 && Math.random() < 0.9) {
      return exactPool[Math.floor(Math.random() * exactPool.length)];
    }
    // Fall back to exact tier - 1, or full pool
    let fallbackPool = Object.values(CHORDS).filter(c => c.tier === tier - 1);
    if (fallbackPool.length > 0) {
      return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    }
    let pool = getChordsByTier(tier);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function getRandomProgression(tier) {
    // Always pick from the exact tier; fall back to tier-1 if none exist
    let exactPool = PROGRESSIONS.filter(p => p.tier === tier);
    if (exactPool.length > 0) {
      return exactPool[Math.floor(Math.random() * exactPool.length)];
    }
    let fallbackPool = PROGRESSIONS.filter(p => p.tier === tier - 1);
    if (fallbackPool.length > 0) {
      return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    }
    let pool = getProgressionsByTier(tier);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  C.CHORDS = CHORDS;
  C.PROGRESSIONS = PROGRESSIONS;
  C.getChordsByTier = getChordsByTier;
  C.getProgressionsByTier = getProgressionsByTier;
  C.getRandomChord = getRandomChord;
  C.getRandomProgression = getRandomProgression;

})(window.Chordessy);
