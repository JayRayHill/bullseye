// Spintax: choose-one-of-N at random from `{a|b|c}` blocks. Standard
// outreach trick to defeat naive spam filters that flag identical mass
// sends. We use single curly braces with pipes — distinguishable from
// {{double-brace merge fields}} which contain no pipes.
//
// Picks are DETERMINISTIC per seed (e.g. the lead's identity) so:
//   - The email preview in the drawer doesn't shimmer between renders.
//   - The same rep sending to the same lead twice gets the same body
//     (low value but consistent).
//   - Different leads in the same batch still get different variations
//     because their seeds differ.
//
// Apply order: spintax FIRST, then merge fields. Otherwise a merge
// value that happens to contain `{` or `|` could be misread as spintax.

// Tiny non-cryptographic string hash. djb2-ish. Stable and fast.
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const SPINTAX_RE = /\{([^{}|]+(?:\|[^{}|]+)+)\}/g;

export function applySpintax(text: string, seed: string): string {
  const seedHash = hashString(seed);
  let blockIndex = 0;
  return text.replace(SPINTAX_RE, (_match, options: string) => {
    const choices = options.split('|');
    // Mix the seed with the running block index so different blocks in
    // the same email pick differently. Without this, every block in a
    // single email would pick the same option index.
    const pick = (seedHash + blockIndex++) % choices.length;
    return choices[pick];
  });
}

/** True if the text contains any spintax block. Useful for tooling that
 *  wants to know whether to invoke applySpintax. */
export function hasSpintax(text: string): boolean {
  SPINTAX_RE.lastIndex = 0;
  return SPINTAX_RE.test(text);
}
