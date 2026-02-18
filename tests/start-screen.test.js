/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const gameHtml = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'game.html'),
  'utf-8'
);
const gameCss = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'game.css'),
  'utf-8'
);

// Extract only the <body> inner content (skip external scripts/CDN deps)
function getBodyContent(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : '';
}

function injectStyles(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

beforeEach(() => {
  // Strip <script> tags so jsdom doesn't try to load CDN resources
  const bodyContent = getBodyContent(gameHtml).replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  document.body.innerHTML = bodyContent;
  injectStyles(gameCss);
});

describe('Start screen renders correctly', () => {
  // --- Existence of key elements ---

  test('start-screen container exists and is visible by default', () => {
    const el = document.getElementById('start-screen');
    expect(el).not.toBeNull();
    // No inline display:none — should be visible on load
    expect(el.style.display).not.toBe('none');
  });

  test('title shows "Chordessy"', () => {
    const h1 = document.querySelector('#start-screen h1');
    expect(h1).not.toBeNull();
    expect(h1.textContent).toBe('Chordessy');
  });

  test('subtitle shows "Chord Training Game"', () => {
    const p = document.querySelector('#start-screen > p');
    expect(p).not.toBeNull();
    expect(p.textContent).toBe('Chord Training Game');
  });

  // --- Difficulty buttons ---

  test('has exactly 4 tier start buttons', () => {
    const btns = document.querySelectorAll('#start-screen .start-btn[data-tier]');
    expect(btns.length).toBe(4);
  });

  test.each([
    ['1', 'Beginner', 'Major & minor triads'],
    ['2', 'Intermediate', 'All triads + dim/aug'],
    ['3', 'Advanced', 'Seventh chords'],
    ['4', 'Expert', 'Extended chords'],
  ])('tier %s button shows "%s" with subtitle "%s"', (tier, label, subtitle) => {
    const btn = document.querySelector(`.start-btn[data-tier="${tier}"]`);
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain(label);
    const small = btn.querySelector('small');
    expect(small).not.toBeNull();
    expect(small.textContent).toBe(subtitle);
  });

  // --- Progression mode toggle ---

  test('progression mode checkbox exists and is unchecked by default', () => {
    const checkbox = document.getElementById('progression-mode');
    expect(checkbox).not.toBeNull();
    expect(checkbox.type).toBe('checkbox');
    expect(checkbox.checked).toBe(false);
  });

  test('progression toggle label text is present', () => {
    const label = document.querySelector('.progression-toggle');
    expect(label).not.toBeNull();
    expect(label.textContent).toContain('Play chord progressions');
  });

  // --- MIDI status ---

  test('MIDI status element exists with initial detecting text', () => {
    const status = document.getElementById('midi-status');
    expect(status).not.toBeNull();
    expect(status.textContent).toBe('Detecting MIDI keyboard...');
  });

  // --- Navigation link ---

  test('link to Neural Arpeggiator exists', () => {
    const link = document.querySelector('#start-screen a[href="index.html"]');
    expect(link).not.toBeNull();
    expect(link.textContent).toBe('Switch to Neural Arpeggiator');
  });

  // --- Game over screen is hidden on load ---

  test('game-over screen is hidden on initial load', () => {
    const el = document.getElementById('game-over-screen');
    expect(el).not.toBeNull();
    expect(el.style.display).toBe('none');
  });

  // --- Start screen overlays game content ---

  test('start screen has z-index 50 (overlays game)', () => {
    const el = document.getElementById('start-screen');
    const computed = getComputedStyle(el);
    expect(parseInt(computed.zIndex, 10)).toBe(50);
  });

  test('start screen is absolutely positioned full-screen', () => {
    const el = document.getElementById('start-screen');
    const computed = getComputedStyle(el);
    expect(computed.position).toBe('absolute');
    expect(computed.top).toBe('0px');
    expect(computed.left).toBe('0px');
    expect(computed.right).toBe('0px');
    expect(computed.bottom).toBe('0px');
  });

  // --- Behind the start screen, game HUD and keyboard exist ---

  test('game HUD elements exist behind start screen', () => {
    expect(document.getElementById('level-num')).not.toBeNull();
    expect(document.getElementById('tier-badge')).not.toBeNull();
    expect(document.getElementById('score')).not.toBeNull();
    expect(document.getElementById('lives-container')).not.toBeNull();
  });

  test('challenge area elements exist', () => {
    expect(document.getElementById('chord-name')).not.toBeNull();
    expect(document.getElementById('chord-notes')).not.toBeNull();
    expect(document.getElementById('timer-bar')).not.toBeNull();
  });

  test('hear-again button exists and is hidden initially', () => {
    const btn = document.getElementById('hear-again-btn');
    expect(btn).not.toBeNull();
    expect(btn.style.display).toBe('none');
  });

  test('game keyboard container exists', () => {
    expect(document.getElementById('game-keyboard')).not.toBeNull();
  });
});
