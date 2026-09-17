/* small helpers with no dependencies: DOM lookup, escaping, seeded randomness */

export const $ = id => document.getElementById(id);
export const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
export const showKey = k => esc(k).replace(/·/g,'<i>·</i>').replace(/\n/g,'<i>\\n</i>');

/* mulberry32: a tiny seeded PRNG, so a given seed replays the same draws */
export function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
