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
  const bodyContent = getBodyContent(gameHtml).replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  document.body.innerHTML = bodyContent;
  injectStyles(gameCss);
});

describe('Navigation link from game to arpeggiator works', () => {
  test('start screen contains a link to index.html', () => {
    const link = document.querySelector('#start-screen a[href="index.html"]');
    expect(link).not.toBeNull();
  });

  test('link text says "Switch to Neural Arpeggiator"', () => {
    const link = document.querySelector('#start-screen a[href="index.html"]');
    expect(link).not.toBeNull();
    expect(link.textContent).toBe('Switch to Neural Arpeggiator');
  });

  test('link is inside a paragraph within the start screen', () => {
    const link = document.querySelector('#start-screen a[href="index.html"]');
    expect(link).not.toBeNull();
    expect(link.parentElement.tagName).toBe('P');
  });

  test('start screen is visible on initial load (overlays game)', () => {
    const startScreen = document.getElementById('start-screen');
    expect(startScreen).not.toBeNull();
    expect(startScreen.style.display).not.toBe('none');
  });

  test('start screen has z-index 50 so the link is accessible', () => {
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

  test('start screen paragraph containing link has styled text', () => {
    const p = document.querySelector('#start-screen a[href="index.html"]').closest('p');
    const computed = getComputedStyle(p);
    expect(computed.fontSize).toBe('20px');
    expect(computed.opacity).toBe('0.7');
  });

  test('link is inside the game-container', () => {
    const gameContainer = document.querySelector('.game-container');
    const link = document.querySelector('#start-screen a[href="index.html"]');
    expect(gameContainer).not.toBeNull();
    expect(gameContainer.contains(link)).toBe(true);
  });
});
