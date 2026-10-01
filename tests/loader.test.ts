/**
 * The loading dots (app/_Loader.tsx): the three school colours, announced once to a screen reader
 * as "Loading…" with the dots themselves hidden from it, and a fade instead of a bounce for anyone
 * who has asked their device for less motion.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Loader, LOADER_COLOURS } from '@/app/_Loader';
import RootLoading from '@/app/loading';
import AppLoading from '@/app/(app)/loading';

const html = renderToStaticMarkup(createElement(Loader));

describe('Loader', () => {
  it('is a status region with a visible "Loading…" label', () => {
    expect(html).toMatch(/^<div class="ssq-loader" role="status"/);
    expect(html).toContain('>Loading…</span>');
  });

  it('hides exactly three dots from screen readers', () => {
    const dots = /<div class="ssq-loader-dots" aria-hidden="true">((?:<span><\/span>)+)<\/div>/.exec(html);
    expect(dots).not.toBeNull();
    expect(dots![1].match(/<span>/g)).toHaveLength(3);
  });

  it('uses the blue, red and yellow, in that order', () => {
    expect(LOADER_COLOURS).toEqual(['#005baa', '#b8292f', '#f2c418']);
    const at = LOADER_COLOURS.map((c) => html.indexOf(c));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('fades instead of bouncing under prefers-reduced-motion', () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\}\s*\}/.exec(html);
    expect(reduced).not.toBeNull();
    expect(reduced![1]).toContain('ssq-fade');
    expect(reduced![1]).not.toContain('ssq-bounce');
  });

  it('is what both loading screens show', () => {
    expect(renderToStaticMarkup(createElement(RootLoading))).toBe(html);
    expect(renderToStaticMarkup(createElement(AppLoading))).toBe(html);
  });
});
