/**
 * Reproduction + regression test for cross-collection (external dependency)
 * variable alias re-linking on import.
 *
 * Pure-logic mirror of `chooseAliasCollection` in src/code.ts. Run with:
 *   node tests/alias-resolution.test.mjs
 *
 * The plugin has no test runner (build is plain `tsc && terser`), so this is a
 * standalone node script. Keep this function character-identical to the one in
 * src/code.ts — it encodes the alias-resolution decision and nothing else.
 */

// ----- function under test (port from src/code.ts) -------------------------
// NOTE: starts as a STUB modelling today's buggy behaviour (exact key only).
// Replaced with the real implementation once the RED run is confirmed.
function chooseAliasCollection(aliasCollection, aliasPath, exactExists, pathCollections, importingCollection) {
  // Fast path: the recorded collection has this exact path locally/in-library.
  if (exactExists) return aliasCollection;
  if (!pathCollections || pathCollections.length === 0) return null;
  // Only one collection anywhere holds this path — unambiguous, link it.
  if (pathCollections.length === 1) return pathCollections[0];
  // Several collections hold the path. Disambiguate without guessing wildly.
  const norm = function (s) { return String(s).replace(/\s+/g, ' ').trim().toLowerCase(); };
  const target = norm(aliasCollection);
  // 1) A collection whose name matches the recorded one apart from case/space.
  for (let i = 0; i < pathCollections.length; i++) {
    if (norm(pathCollections[i]) === target) return pathCollections[i];
  }
  // 2) Exactly one candidate that is not the collection currently importing —
  //    an external dependency lives in some *other* collection by definition.
  const external = pathCollections.filter(function (c) { return c !== importingCollection; });
  if (external.length === 1) return external[0];
  // 3) Still ambiguous — refuse to guess (caller keeps the $localValue fallback).
  return null;
}

// ----- tiny assert harness --------------------------------------------------
let passed = 0;
let failed = 0;
function eq(actual, expected, name) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
  }
}

console.log('alias-resolution:');

// 1) Exact match still wins (fast path — no regression).
eq(
  chooseAliasCollection('Tailwind CSS', 'blue/500', true, ['Tailwind CSS'], 'shadcn'),
  'Tailwind CSS',
  'exact collection match is used as-is',
);

// 2) THE BUG: external dependency present under a *different* local collection
//    name. Recorded $collectionName "Tailwind CSS", but the user imported the
//    tokens into a collection named "Tailwind Primitives". Must still re-link.
eq(
  chooseAliasCollection('Tailwind CSS', 'blue/500', false, ['Tailwind Primitives'], 'shadcn'),
  'Tailwind Primitives',
  'external dep under a differently-named collection re-links by path',
);

// 3) Loose name match (case / trailing space drift) when several collections
//    share the path.
eq(
  chooseAliasCollection('Tailwind CSS', 'blue/500', false, ['tailwind css ', 'Other'], 'shadcn'),
  'tailwind css ',
  'loose (case/space-insensitive) name match wins over an unrelated collection',
);

// 4) Single external candidate (besides the importing collection) is chosen.
eq(
  chooseAliasCollection('Unknown', 'blue/500', false, ['shadcn', 'Tailwind Primitives'], 'shadcn'),
  'Tailwind Primitives',
  'the one candidate outside the importing collection is chosen',
);

// 5) Genuinely ambiguous (two unrelated externals, no name hint) → refuse to
//    guess. Returning null keeps the safe $localValue fallback instead of
//    mis-linking to the wrong collection.
eq(
  chooseAliasCollection('Unknown', 'blue/500', false, ['Brand A', 'Brand B'], 'shadcn'),
  null,
  'ambiguous match refuses to guess (no mis-link)',
);

// 6) No candidate anywhere → null.
eq(
  chooseAliasCollection('Tailwind CSS', 'blue/500', false, [], 'shadcn'),
  null,
  'no candidate path anywhere returns null',
);

// 7) Real-world case (shadcn studio kit): library "☀️ Mode" (one space after
//    emoji) vs local "☀️  Mode" (two spaces). Whitespace runs must collapse so
//    the loose name match wins over ambiguity bail-out.
eq(
  chooseAliasCollection('☀️ Mode', 'theme/background', false, ['☀️  Mode', 'TailwindCSS'], '🚀 Themes'),
  '☀️  Mode',
  'whitespace-run difference still loose-matches the recorded collection name',
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
