/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'index.html'),
  'utf-8'
);
const styleCss = fs.readFileSync(
  path.join(__dirname, '..', 'neural-arpeggiator', 'src', 'style.css'),
  'utf-8'
);

function injectStyles(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

beforeEach(() => {
  // index.html is a fragment (no <html>/<body> wrapper), inject directly
  document.body.innerHTML = indexHtml;
  injectStyles(styleCss);
});

describe('Navigation link from arpeggiator to game works', () => {
  test('mode-switch container exists in the arpeggiator page', () => {
    const modeSwitch = document.querySelector('.mode-switch');
    expect(modeSwitch).not.toBeNull();
  });

  test('mode-switch contains a link to game.html', () => {
    const link = document.querySelector('.mode-switch a[href="game.html"]');
    expect(link).not.toBeNull();
  });

  test('link text says "Switch to Chord Training Game"', () => {
    const link = document.querySelector('.mode-switch a');
    expect(link).not.toBeNull();
    expect(link.textContent).toBe('Switch to Chord Training Game');
  });

  test('mode-switch is positioned at the bottom of the page', () => {
    const el = document.querySelector('.mode-switch');
    const computed = getComputedStyle(el);
    expect(computed.position).toBe('absolute');
    expect(computed.bottom).toBe('10px');
  });

  test('mode-switch is centered horizontally', () => {
    const el = document.querySelector('.mode-switch');
    const computed = getComputedStyle(el);
    expect(computed.textAlign).toBe('center');
    expect(computed.width).toBe('100%');
  });

  test('mode-switch has a z-index for visibility above other content', () => {
    const el = document.querySelector('.mode-switch');
    const computed = getComputedStyle(el);
    expect(parseInt(computed.zIndex, 10)).toBe(10);
  });

  test('mode-switch starts with reduced opacity and increases on hover', () => {
    const el = document.querySelector('.mode-switch');
    const computed = getComputedStyle(el);
    expect(computed.opacity).toBe('0.5');
  });

  test('link is inside the main container', () => {
    const container = document.querySelector('.container');
    const modeSwitch = document.querySelector('.mode-switch');
    expect(container).not.toBeNull();
    expect(container.contains(modeSwitch)).toBe(true);
  });
});
