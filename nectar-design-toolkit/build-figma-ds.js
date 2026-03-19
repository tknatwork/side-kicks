#!/usr/bin/env node

/**
 * build-figma-ds.js
 *
 * Automated Figma Design System builder for Nectar Core.
 * Reads the Portfolio's actual token JSON files (seed.json, alias.json, mapped.json)
 * and sends commands to the orchestration server to create:
 *   1.  Variable collections (Seed, Alias, Mapped)
 *   2.  Seed variables — raw primitives (colors, spacing, typography, borders)
 *   2b. Alias variables — semantic tokens with VARIABLE_ALIAS refs to seed vars
 *       (Two-pass pattern from variables-styles-extractor: raw values first, aliases second)
 *   3.  Mapped variables — light/dark mode theme tokens
 *   4.  Text styles (headings, titles, body, caption, code)
 *   5.  Effect styles (hard shadows)
 *   6.  Pages and section frames
 *
 * Dependency chain: Seed → Alias → Mapped → Styles → Visual Hierarchy
 *
 * Prerequisites:
 *   - Orchestration server running: node orchestration-server/index.js
 *   - Figma Desktop app open with target file
 *   - Plugin loaded and connected
 *
 * Usage:
 *   node build-figma-ds.js                    # Full build (steps 1-7)
 *   node build-figma-ds.js --step variables   # Only variables (steps 1-3)
 *   node build-figma-ds.js --step styles      # Only styles (steps 4-5)
 *   node build-figma-ds.js --step pages       # Only pages (step 6)
 *   node build-figma-ds.js --step visual      # Only visual hierarchy (step 7, needs existing IDs)
 *   node build-figma-ds.js --step all         # Explicit full build
 *   node build-figma-ds.js --dry-run          # Print commands without sending
 *
 * Zero external dependencies — uses Node.js built-ins only.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SERVER_URL = 'http://localhost:9877';
const PORTFOLIO_ROOT = path.resolve(__dirname, '../../Portfolio');
const TOKENS_DIR = path.join(PORTFOLIO_ROOT, 'design-system/tokens');

const SEED_PATH = path.join(TOKENS_DIR, 'seed.json');
const ALIAS_PATH = path.join(TOKENS_DIR, 'alias.json');
const MAPPED_PATH = path.join(TOKENS_DIR, 'mapped.json');

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const STEP = args.includes('--step') ? args[args.indexOf('--step') + 1] : null;

// ---------------------------------------------------------------------------
// HTTP helper — send command to orchestration server
// ---------------------------------------------------------------------------

let commandCount = 0;

function sendCommand(command, payload) {
  commandCount++;
  const num = commandCount;

  if (DRY_RUN) {
    console.log(`  [${num}] ${command}`, JSON.stringify(payload).slice(0, 120));
    return Promise.resolve({ dry: true });
  }

  return new Promise(function (resolve, reject) {
    var body = JSON.stringify({ command: command, payload: payload || {} });

    var options = {
      hostname: 'localhost',
      port: 9877,
      path: '/command',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    var req = http.request(options, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var parsed = JSON.parse(data);
          if (parsed.success) {
            resolve(parsed.data);
          } else {
            console.error('  Command failed:', command, parsed.error);
            reject(new Error(parsed.error || 'Command failed'));
          }
        } catch (e) {
          reject(new Error('Invalid response: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', function (e) {
      reject(new Error('Connection error: ' + e.message + ' — is the orchestration server running?'));
    });

    req.setTimeout(120000, function () {
      req.destroy();
      reject(new Error('Command timed out: ' + command));
    });

    req.write(body);
    req.end();
  });
}

// Small delay between commands to let Figma breathe
function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Send commands in parallel batches for speed
// Each "task" is an async function that calls sendCommand internally
async function runBatch(tasks, concurrency) {
  concurrency = concurrency || 5;
  var results = [];
  var index = 0;

  async function worker() {
    while (index < tasks.length) {
      var i = index++;
      results[i] = await tasks[i]();
    }
  }

  var workers = [];
  for (var w = 0; w < Math.min(concurrency, tasks.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Color parsing helpers
// ---------------------------------------------------------------------------

function hexToRGB(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.substr(0, 2), 16) / 255,
    g: parseInt(hex.substr(2, 2), 16) / 255,
    b: parseInt(hex.substr(4, 2), 16) / 255
  };
}

function hexToFigmaColor(hex) {
  var rgb = hexToRGB(hex);
  return { r: rgb.r, g: rgb.g, b: rgb.b };
}

// ---------------------------------------------------------------------------
// Load token files
// ---------------------------------------------------------------------------

function loadTokens() {
  console.log('Loading token files...');

  if (!fs.existsSync(SEED_PATH)) {
    throw new Error('seed.json not found at ' + SEED_PATH);
  }
  if (!fs.existsSync(MAPPED_PATH)) {
    throw new Error('mapped.json not found at ' + MAPPED_PATH);
  }

  var seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  var alias = fs.existsSync(ALIAS_PATH) ? JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8')) : null;
  var mapped = JSON.parse(fs.readFileSync(MAPPED_PATH, 'utf8'));

  console.log('  seed.json: v' + seed.version);
  if (alias) console.log('  alias.json: v' + alias.version);
  console.log('  mapped.json: v' + mapped.version);

  return { seed: seed, alias: alias, mapped: mapped };
}

// ---------------------------------------------------------------------------
// Step 1: Create Variable Collections
// ---------------------------------------------------------------------------

async function createCollections() {
  console.log('\n=== Step 1: Create Variable Collections ===');

  // Seed collection — single mode (Default)
  console.log('  Creating "Seed" collection...');
  var seedResult = await sendCommand('create_variable_collection', {
    name: 'Seed',
    modes: ['Default']
  });
  await delay(300);

  // Mapped collection — two modes (Light, Dark)
  console.log('  Creating "Mapped" collection...');
  var mappedResult = await sendCommand('create_variable_collection', {
    name: 'Mapped',
    modes: ['Light', 'Dark']
  });
  await delay(300);

  // Alias collection — single mode (Default)
  console.log('  Creating "Alias" collection...');
  var aliasResult = await sendCommand('create_variable_collection', {
    name: 'Alias',
    modes: ['Default']
  });
  await delay(300);

  console.log('  Collections created. Fetching IDs...');
  var collections = await sendCommand('get_variable_collections', {});
  await delay(200);

  return collections;
}

// ---------------------------------------------------------------------------
// Step 2: Create Seed Variables (primitives)
// ---------------------------------------------------------------------------

async function createSeedVariables(seed, collectionId, modeId) {
  console.log('\n=== Step 2: Create Seed Variables (batched) ===');
  var tokens = seed.tokens;

  // Build a flat list of all seed variables to create
  var varDefs = [];

  // Pastels
  var pastels = tokens.color.pastel;
  for (var key in pastels) {
    if (pastels.hasOwnProperty(key)) {
      varDefs.push({ name: 'color/pastel/' + key, type: 'COLOR', value: hexToFigmaColor(pastels[key].value) });
    }
  }

  // Neutrals
  var neutrals = tokens.color.neutral;
  for (var nKey in neutrals) {
    if (neutrals.hasOwnProperty(nKey)) {
      varDefs.push({ name: 'color/neutral/' + nKey, type: 'COLOR', value: hexToFigmaColor(neutrals[nKey].value) });
    }
  }

  // Semantic seeds
  var semanticColors = { ink: tokens.color.ink, danger: tokens.color.danger, success: tokens.color.success, warning: tokens.color.warning, white: tokens.color.white, black: tokens.color.black };
  for (var sKey in semanticColors) {
    if (semanticColors.hasOwnProperty(sKey) && semanticColors[sKey]) {
      varDefs.push({ name: 'color/' + sKey, type: 'COLOR', value: hexToFigmaColor(semanticColors[sKey].value) });
    }
  }

  // Spacing
  var spacing = tokens.spacing;
  for (var spKey in spacing) {
    if (spacing.hasOwnProperty(spKey)) {
      varDefs.push({ name: 'spacing/' + spKey, type: 'FLOAT', value: parseFloat(spacing[spKey].value) });
    }
  }

  // Border Width
  var bw = tokens.borderWidth;
  for (var bwKey in bw) {
    if (bw.hasOwnProperty(bwKey)) {
      varDefs.push({ name: 'borderWidth/' + bwKey, type: 'FLOAT', value: parseFloat(bw[bwKey].value) });
    }
  }

  // Border Radius
  var br = tokens.borderRadius;
  for (var brKey in br) {
    if (br.hasOwnProperty(brKey)) {
      var brVal = parseFloat(br[brKey].value);
      varDefs.push({ name: 'borderRadius/' + brKey, type: 'FLOAT', value: isNaN(brVal) ? 0 : brVal });
    }
  }

  // Font Sizes (px values)
  var fs_map = { xs: 10, sm: 13, base: 16, md: 20, lg: 25, xl: 31, '2xl': 39, '3xl': 49, '4xl': 61 };
  for (var fsKey in fs_map) {
    if (fs_map.hasOwnProperty(fsKey)) {
      varDefs.push({ name: 'typography/fontSize/' + fsKey, type: 'FLOAT', value: fs_map[fsKey] });
    }
  }

  // Font Weights
  var fw = tokens.typography.fontWeight;
  for (var fwKey in fw) {
    if (fw.hasOwnProperty(fwKey)) {
      varDefs.push({ name: 'typography/fontWeight/' + fwKey, type: 'FLOAT', value: parseInt(fw[fwKey].value) });
    }
  }

  console.log('  ' + varDefs.length + ' seed variables to create...');

  // Scope map — which Figma scopes apply to each variable category
  var scopeMap = {
    'color/': ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'],
    'spacing/': ['GAP', 'WIDTH_HEIGHT'],
    'borderWidth/': ['STROKE_FLOAT'],
    'borderRadius/': ['CORNER_RADIUS'],
    'typography/fontSize/': ['FONT_SIZE'],
    'typography/fontWeight/': ['FONT_WEIGHT']
  };

  function getScopesForVar(name) {
    for (var prefix in scopeMap) {
      if (name.startsWith(prefix)) return scopeMap[prefix];
    }
    return ['ALL_SCOPES'];
  }

  // --- BATCH MODE: Send all variables in a single command ---
  var batchVars = varDefs.map(function (def) {
    var values = {};
    values[modeId] = def.value;
    return {
      name: def.name,
      resolvedType: def.type,
      values: values,
      scopes: getScopesForVar(def.name)
    };
  });

  var result = await sendCommand('batch_create_variables', {
    collectionId: collectionId,
    variables: batchVars
  });

  var varIdMap = (result && result.varIds) ? result.varIds : {};
  var created = (result && result.created) ? result.created : varDefs.length;
  if (result && result.errors && result.errors.length > 0) {
    console.log('  ⚠ Errors: ' + result.errors.join(', '));
  }

  console.log('  Total seed variables: ' + created + ' (1 batch command)');
  return { count: created, varIds: varIdMap };
}

// ---------------------------------------------------------------------------
// Step 2b: Create Alias Variables (semantic — VARIABLE_ALIAS references)
//
// Two-pass pattern (from variables-styles-extractor):
//   Pass 1: Create all alias variables with fallback raw values
//   Pass 2: Resolve {seed.xxx} references → VARIABLE_ALIAS using seed var IDs
//
// Alias tokens reference seed tokens like: "{seed.color.pastel.honey}"
// These become Figma VARIABLE_ALIAS values pointing to seed variable IDs.
// ---------------------------------------------------------------------------

function resolveAliasRef(ref, seedVarIds) {
  // Convert alias.json ref format to seed var ID lookup key
  // "{seed.color.pastel.honey}" → "color/pastel/honey"
  // "{seed.spacing.4}" → "spacing/4"
  // "{seed.typography.fontSize.4xl}" → "typography/fontSize/4xl"
  var cleaned = ref.replace(/^\{seed\./, '').replace(/\}$/, '');
  // Convert dot-path to slash-path
  var varName = cleaned.replace(/\./g, '/');
  return seedVarIds[varName] || null;
}

// Resolve a raw value for alias token (fallback if VARIABLE_ALIAS can't be set)
function resolveAliasRawValue(ref, seed) {
  // "{seed.color.pastel.honey}" → seed.tokens.color.pastel.honey.value → hex
  var path = ref.replace(/^\{seed\./, '').replace(/\}$/, '').split('.');
  var current = seed.tokens;
  for (var i = 0; i < path.length; i++) {
    if (!current || !current[path[i]]) return null;
    current = current[path[i]];
  }
  if (current && current.value !== undefined) return current.value;
  return current; // Direct value (e.g. for nested typography)
}

async function createAliasVariables(alias, seed, collectionId, modeId, seedVarIds) {
  console.log('\n=== Step 2b: Create Alias Variables (semantic, batched) ===');
  if (!alias || !alias.tokens) {
    console.log('  No alias.json found — skipping alias variables');
    return { count: 0, varIds: {} };
  }

  var aliasTokens = alias.tokens;
  var varDefs = [];
  var pendingAliases = []; // For pass 2

  // --- Color aliases ---
  var colors = aliasTokens.color || {};
  for (var cKey in colors) {
    if (colors.hasOwnProperty(cKey)) {
      var ref = colors[cKey].value;
      var rawVal = resolveAliasRawValue(ref, seed);
      var seedId = resolveAliasRef(ref, seedVarIds);

      varDefs.push({
        name: 'color/' + cKey,
        type: 'COLOR',
        rawValue: rawVal ? hexToFigmaColor(rawVal) : hexToFigmaColor('#000000'),
        aliasTargetId: seedId,
        scopes: ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'],
        description: colors[cKey].description || ''
      });
    }
  }

  // --- Spacing aliases ---
  var spacing = aliasTokens.spacing || {};
  for (var spKey in spacing) {
    if (spacing.hasOwnProperty(spKey)) {
      var spRef = spacing[spKey].value;
      var spRaw = resolveAliasRawValue(spRef, seed);
      var spSeedId = resolveAliasRef(spRef, seedVarIds);

      varDefs.push({
        name: 'spacing/' + spKey,
        type: 'FLOAT',
        rawValue: spRaw !== null ? parseFloat(spRaw) : 0,
        aliasTargetId: spSeedId,
        scopes: ['GAP', 'WIDTH_HEIGHT'],
        description: spacing[spKey].description || ''
      });
    }
  }

  // --- Grid aliases (columns are numbers, gutters/margins are spacing refs) ---
  var grid = aliasTokens.grid || {};
  for (var gKey in grid) {
    if (grid.hasOwnProperty(gKey)) {
      var gRef = grid[gKey].value;
      var gType = grid[gKey].type;
      var gSeedId = null;
      var gRawValue;

      if (gRef.startsWith('{seed.')) {
        gSeedId = resolveAliasRef(gRef, seedVarIds);
        var gResolved = resolveAliasRawValue(gRef, seed);
        gRawValue = gResolved !== null ? parseFloat(gResolved) : 0;
      } else {
        gRawValue = parseFloat(gRef);
      }

      varDefs.push({
        name: 'grid/' + gKey,
        type: 'FLOAT',
        rawValue: isNaN(gRawValue) ? 0 : gRawValue,
        aliasTargetId: gSeedId,
        scopes: gType === 'spacing' ? ['GAP', 'WIDTH_HEIGHT'] : ['ALL_SCOPES'],
        description: grid[gKey].description || ''
      });
    }
  }

  // --- Border aliases ---
  var border = aliasTokens.border || {};
  for (var bKey in border) {
    if (border.hasOwnProperty(bKey)) {
      var bRef = border[bKey].value;
      var bSeedId = resolveAliasRef(bRef, seedVarIds);
      var bRaw = resolveAliasRawValue(bRef, seed);

      var bScopes = bKey === 'width' ? ['STROKE_FLOAT'] : ['CORNER_RADIUS'];
      varDefs.push({
        name: 'border/' + bKey,
        type: 'FLOAT',
        rawValue: bRaw !== null ? parseFloat(bRaw) : 0,
        aliasTargetId: bSeedId,
        scopes: bScopes,
        description: border[bKey].description || ''
      });
    }
  }

  console.log('  ' + varDefs.length + ' alias variables to create...');

  // --- BATCH PASS 1: Create all alias variables with raw fallback values ---
  var batchVars = varDefs.map(function (def) {
    var values = {};
    values[modeId] = def.rawValue;
    return {
      name: def.name,
      resolvedType: def.type,
      values: values,
      scopes: def.scopes || [],
      description: def.description || ''
    };
  });

  var result = await sendCommand('batch_create_variables', {
    collectionId: collectionId,
    variables: batchVars
  });

  var varIdMap = (result && result.varIds) ? result.varIds : {};
  if (result && result.errors && result.errors.length > 0) {
    console.log('  ⚠ Pass 1 errors: ' + result.errors.join(', '));
  }
  console.log('  Pass 1 complete: ' + (result ? result.created : 0) + ' variables created (1 batch command)');

  // Build pending aliases list using returned varIds
  for (var i = 0; i < varDefs.length; i++) {
    if (varDefs[i].aliasTargetId && varIdMap[varDefs[i].name]) {
      pendingAliases.push({
        variableId: varIdMap[varDefs[i].name],
        modeId: modeId,
        aliasTargetId: varDefs[i].aliasTargetId
      });
    }
  }

  // --- BATCH PASS 2: Set VARIABLE_ALIAS references (1 command for all) ---
  if (pendingAliases.length > 0) {
    console.log('  Pass 2: Resolving ' + pendingAliases.length + ' alias references...');
    var aliasResult = await sendCommand('batch_set_variable_aliases', {
      aliases: pendingAliases
    });
    if (aliasResult && aliasResult.errors && aliasResult.errors.length > 0) {
      console.log('  ⚠ Pass 2 errors: ' + aliasResult.errors.join(', '));
    }
    console.log('  Pass 2 complete: ' + (aliasResult ? aliasResult.set : 0) + ' aliases resolved (1 batch command)');
  }

  console.log('  Total alias variables: ' + varDefs.length);
  return { count: varDefs.length, varIds: varIdMap };
}

// ---------------------------------------------------------------------------
// Step 3: Create Mapped Variables (Light/Dark mode)
// ---------------------------------------------------------------------------

async function createMappedVariables(mapped, collectionId, lightModeId, darkModeId) {
  console.log('\n=== Step 3: Create Mapped Variables (Light/Dark, batched) ===');
  var lightTokens = mapped.modes.light.color;
  var darkTokens = mapped.modes.dark.color;

  // Build flat list of mapped variable definitions
  var varDefs = [];
  for (var key in lightTokens) {
    if (lightTokens.hasOwnProperty(key)) {
      var lightValue = lightTokens[key].value;
      var darkValue = darkTokens[key] ? darkTokens[key].value : lightValue;

      // Skip transparent values — Figma doesn't support transparent as a color variable
      if (lightValue === 'transparent' || darkValue === 'transparent') {
        console.log('  Skipping transparent: ' + key);
        continue;
      }

      varDefs.push({ name: 'color/' + key, light: lightValue, dark: darkValue });
    }
  }

  console.log('  ' + varDefs.length + ' mapped variables to create...');

  // Mapped scope map — assign scopes based on token name patterns
  function getMappedScopes(name) {
    var n = name.replace('color/', '');
    if (n.startsWith('bg') || n.startsWith('surface') || n.startsWith('card') || n.startsWith('input-bg') || n.startsWith('toggle-bg')) return ['ALL_FILLS'];
    if (n.startsWith('fg') || n.startsWith('muted') || n.startsWith('badge-fg') || n.includes('-fg')) return ['TEXT_FILL'];
    if (n.startsWith('border') || n.startsWith('ring') || n.startsWith('outline-border')) return ['STROKE_COLOR'];
    if (n.startsWith('shadow')) return ['EFFECT_COLOR'];
    if (n.startsWith('button') || n.startsWith('outline') || n.startsWith('th-')) return ['ALL_FILLS'];
    return ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'];
  }

  // --- BATCH MODE: Create all mapped variables with both mode values ---
  var batchVars = varDefs.map(function (def) {
    var values = {};
    values[lightModeId] = hexToFigmaColor(def.light);
    values[darkModeId] = hexToFigmaColor(def.dark);
    return {
      name: def.name,
      resolvedType: 'COLOR',
      values: values,
      scopes: getMappedScopes(def.name)
    };
  });

  var result = await sendCommand('batch_create_variables', {
    collectionId: collectionId,
    variables: batchVars
  });

  var varIdMap = (result && result.varIds) ? result.varIds : {};
  if (result && result.errors && result.errors.length > 0) {
    console.log('  ⚠ Errors: ' + result.errors.join(', '));
  }

  console.log('  Total mapped variables: ' + (result ? result.created : 0) + ' (1 batch command)');
  return { count: varDefs.length, varIds: varIdMap };
}

// ---------------------------------------------------------------------------
// Step 4: Create Text Styles
// ---------------------------------------------------------------------------

async function createTextStyles() {
  console.log('\n=== Step 4: Create Text Styles (batched) ===');

  // All text style definitions in one flat array
  var allStyles = [
    // Heading styles (Libre Baskerville)
    { name: 'Heading/H1', fontFamily: 'Libre Baskerville', fontSize: 61, fontWeight: 700, lineHeight: 1.25 },
    { name: 'Heading/H2', fontFamily: 'Libre Baskerville', fontSize: 49, fontWeight: 700, lineHeight: 1.25 },
    { name: 'Heading/H3', fontFamily: 'Libre Baskerville', fontSize: 39, fontWeight: 400, lineHeight: 1.25 },
    { name: 'Heading/H4', fontFamily: 'Libre Baskerville', fontSize: 31, fontWeight: 400, lineHeight: 1.5 },
    { name: 'Heading/H5', fontFamily: 'Libre Baskerville', fontSize: 25, fontWeight: 400, lineHeight: 1.5 },
    { name: 'Heading/H6', fontFamily: 'Libre Baskerville', fontSize: 20, fontWeight: 400, lineHeight: 1.5 },
    // Title styles (Switzer)
    { name: 'Title/Title 1', fontFamily: 'Switzer', fontSize: 31, fontWeight: 600, lineHeight: 1.5 },
    { name: 'Title/Title 2', fontFamily: 'Switzer', fontSize: 25, fontWeight: 500, lineHeight: 1.5 },
    { name: 'Title/Title 3', fontFamily: 'Switzer', fontSize: 20, fontWeight: 500, lineHeight: 1.5 },
    // Body styles (Switzer)
    { name: 'Body/Base', fontFamily: 'Switzer', fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
    { name: 'Body/Small', fontFamily: 'Switzer', fontSize: 13, fontWeight: 400, lineHeight: 1.5 },
    { name: 'Body/Large', fontFamily: 'Switzer', fontSize: 20, fontWeight: 400, lineHeight: 1.75 },
    // Special styles
    { name: 'Caption', fontFamily: 'Merriweather', fontSize: 13, fontWeight: 400, lineHeight: 1.5 },
    { name: 'Code', fontFamily: 'Roboto Mono', fontSize: 13, fontWeight: 400, lineHeight: 1.5 }
  ];

  console.log('  ' + allStyles.length + ' text styles to create...');

  // Map font weight numbers to Figma style strings
  var weightToStyle = { 400: 'Regular', 500: 'Medium', 600: 'Medium', 700: 'Bold' };

  // --- BATCH MODE: Create all text styles in a single command ---
  var batchTextStyles = allStyles.map(function (s) {
    return {
      name: s.name,
      fontFamily: s.fontFamily,
      fontStyle: weightToStyle[s.fontWeight] || 'Regular',
      fontSize: s.fontSize,
      lineHeight: { value: s.lineHeight * s.fontSize, unit: 'PIXELS' }
    };
  });

  var result = await sendCommand('batch_create_styles', {
    textStyles: batchTextStyles
  });

  // Convert returned IDs to the format step 7 expects
  var styleIdList = [];
  if (result && result.textStyleIds) {
    for (var i = 0; i < allStyles.length; i++) {
      var s = allStyles[i];
      var sid = result.textStyleIds[s.name];
      if (sid) {
        styleIdList.push({
          id: sid,
          name: s.name,
          fontSize: s.fontSize,
          fontName: { family: s.fontFamily, style: weightToStyle[s.fontWeight] || 'Regular' }
        });
      }
    }
  }
  if (result && result.errors && result.errors.length > 0) {
    console.log('  ⚠ Errors: ' + result.errors.join(', '));
  }

  console.log('  Total text styles: ' + (result ? result.textCount : 0) + ' (1 batch command)');
  return { count: allStyles.length, styleIds: styleIdList };
}

// ---------------------------------------------------------------------------
// Step 5: Create Effect Styles (Hard Shadows)
// ---------------------------------------------------------------------------

async function createEffectStyles() {
  console.log('\n=== Step 5: Create Effect Styles (Hard Shadows, batched) ===');

  // Light mode shadow color: #D9D5D2
  // Note: Effect colors need {r, g, b, a} — unlike variable colors which are {r, g, b}
  var rgb = hexToFigmaColor('#D9D5D2');
  var lightShadowColor = { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 };

  var shadows = [
    { name: 'Shadow/Small', offset: 2 },
    { name: 'Shadow/Medium', offset: 4 },
    { name: 'Shadow/Large', offset: 6 },
    { name: 'Shadow/XLarge', offset: 8 }
  ];

  // --- BATCH MODE: Create all effect styles in a single command ---
  var batchEffectStyles = shadows.map(function (s) {
    return {
      name: s.name,
      effects: [{
        type: 'DROP_SHADOW',
        color: lightShadowColor,
        offset: { x: s.offset, y: s.offset },
        radius: 0,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
      }],
      description: s.offset + 'px hard shadow'
    };
  });

  var result = await sendCommand('batch_create_styles', {
    effectStyles: batchEffectStyles
  });

  var styleIdList = [];
  if (result && result.effectStyleIds) {
    for (var i = 0; i < shadows.length; i++) {
      var sid = result.effectStyleIds[shadows[i].name];
      if (sid) {
        styleIdList.push({
          id: sid,
          name: shadows[i].name,
          description: shadows[i].offset + 'px hard shadow'
        });
      }
    }
  }
  if (result && result.errors && result.errors.length > 0) {
    console.log('  ⚠ Errors: ' + result.errors.join(', '));
  }

  console.log('  Created ' + (result ? result.effectCount : 0) + ' effect styles (1 batch command)');
  return { count: shadows.length, styleIds: styleIdList };
}

// ---------------------------------------------------------------------------
// Step 6: Create Pages (with emoji prefixes, Ant Design X pattern)
// ---------------------------------------------------------------------------

async function createPages() {
  console.log('\n=== Step 6: Create Pages (batched) ===');

  var pages = [
    '📋 Cover',
    '🎨 Foundations',
    '🧩 Components',
    '📐 Layout',
    '📖 Templates'
  ];

  // Check existing pages to avoid duplicates
  var existingPages = await sendCommand('get_pages', {});
  var existingNames = {};
  if (Array.isArray(existingPages)) {
    for (var e = 0; e < existingPages.length; e++) {
      existingNames[existingPages[e].name] = true;
    }
  }

  var created = 0;
  for (var i = 0; i < pages.length; i++) {
    if (existingNames[pages[i]]) {
      console.log('  Page exists: ' + pages[i] + ' (skipping)');
    } else {
      console.log('  Creating page: ' + pages[i]);
      await sendCommand('create_page', { name: pages[i] });
      created++;
    }
  }

  console.log('  Created ' + created + ' pages (' + (pages.length - created) + ' already existed)');
  return pages.length;
}

// ---------------------------------------------------------------------------
// Step 7: Build Visual Hierarchy (Ant Design X pattern)
//
// Creates sections, content frames, swatch grids, typography specimens,
// and shadow previews on the Foundations page. Requires variable IDs and
// style IDs from steps 1-5.
//
// Pattern per section:
//   Section (top-level Figma section node)
//     ├─ Header Frame (section title + description text)
//     └─ Content Frame (auto-layout container for specimens)
//          └─ group commands (color swatches / typography / effects)
// ---------------------------------------------------------------------------

async function buildVisualHierarchy(context) {
  console.log('\n=== Step 7: Build Visual Hierarchy ===');

  if (!context || !context.seedVarIds || !context.mappedVarIds) {
    console.log('  Skipping visual hierarchy — no variable IDs available (dry-run or missing context)');
    return;
  }

  // --- 7a: Navigate to Foundations page and get its children ---
  console.log('  Navigating to 🎨 Foundations...');
  await sendCommand('set_current_page', { name: '🎨 Foundations' });
  await delay(500);

  // --- 7b: Create "Seed Colors" section ---
  console.log('  Creating Seed Colors section...');
  var seedSection = await sendCommand('create_section', {
    name: 'Seed Colors',
    x: 0, y: 0,
    width: 2200, height: 1200
  });
  await delay(200);

  if (seedSection && seedSection.id) {
    // Create a content frame inside the section
    var seedContentFrame = await sendCommand('create_frame', {
      name: 'Content',
      parentId: seedSection.id,
      width: 2100, height: 1000,
      x: 50, y: 100,
      fills: [{ type: 'SOLID', color: hexToFigmaColor('#FFFFFF') }],
      cornerRadius: 12,
      autoLayout: {
        mode: 'VERTICAL',
        itemSpacing: 40,
        paddingLeft: 60, paddingRight: 60,
        paddingTop: 40, paddingBottom: 40,
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'FIXED'
      }
    });
    await delay(200);

    if (seedContentFrame && seedContentFrame.id) {
      // Pastel swatches — build from seed variable IDs
      var pastelSwatches = [];
      for (var pKey in context.seedVarIds) {
        if (pKey.startsWith('color/pastel/')) {
          var shortName = pKey.replace('color/pastel/', '');
          pastelSwatches.push({
            variableId: context.seedVarIds[pKey],
            name: shortName,
            description: shortName
          });
        }
      }

      if (pastelSwatches.length > 0) {
        console.log('  Creating Pastel swatches group (' + pastelSwatches.length + ' colors)...');
        await sendCommand('create_color_swatches_group', {
          name: 'Pastel Colors',
          parentFrameId: seedContentFrame.id,
          swatches: pastelSwatches
        });
        await delay(300);
      }

      // Neutral swatches
      var neutralSwatches = [];
      for (var nKey in context.seedVarIds) {
        if (nKey.startsWith('color/neutral/')) {
          var nShortName = nKey.replace('color/neutral/', '');
          neutralSwatches.push({
            variableId: context.seedVarIds[nKey],
            name: nShortName,
            description: 'Neutral ' + nShortName
          });
        }
      }

      if (neutralSwatches.length > 0) {
        console.log('  Creating Neutral swatches group (' + neutralSwatches.length + ' colors)...');
        await sendCommand('create_color_swatches_group', {
          name: 'Neutral Colors',
          parentFrameId: seedContentFrame.id,
          swatches: neutralSwatches
        });
        await delay(300);
      }

      // Semantic swatches (ink, danger, success, warning, white, black)
      var semanticSwatches = [];
      var semanticKeys = ['color/ink', 'color/danger', 'color/success', 'color/warning', 'color/white', 'color/black'];
      for (var s = 0; s < semanticKeys.length; s++) {
        var sKey = semanticKeys[s];
        if (context.seedVarIds[sKey]) {
          semanticSwatches.push({
            variableId: context.seedVarIds[sKey],
            name: sKey.replace('color/', ''),
            description: sKey.replace('color/', '')
          });
        }
      }

      if (semanticSwatches.length > 0) {
        console.log('  Creating Semantic swatches group (' + semanticSwatches.length + ' colors)...');
        await sendCommand('create_color_swatches_group', {
          name: 'Semantic Colors',
          parentFrameId: seedContentFrame.id,
          swatches: semanticSwatches
        });
        await delay(300);
      }
    }
  }

  // --- 7c: Create "Mapped Colors" section ---
  console.log('  Creating Mapped Colors section...');
  var mappedSection = await sendCommand('create_section', {
    name: 'Mapped Colors',
    x: 0, y: 1400,
    width: 2200, height: 1200
  });
  await delay(200);

  if (mappedSection && mappedSection.id) {
    var mappedContentFrame = await sendCommand('create_frame', {
      name: 'Content',
      parentId: mappedSection.id,
      width: 2100, height: 1000,
      x: 50, y: 100,
      fills: [{ type: 'SOLID', color: hexToFigmaColor('#FFFFFF') }],
      cornerRadius: 12,
      autoLayout: {
        mode: 'VERTICAL',
        itemSpacing: 40,
        paddingLeft: 60, paddingRight: 60,
        paddingTop: 40, paddingBottom: 40,
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'FIXED'
      }
    });
    await delay(200);

    if (mappedContentFrame && mappedContentFrame.id) {
      var mappedSwatches = [];
      for (var mKey in context.mappedVarIds) {
        if (context.mappedVarIds.hasOwnProperty(mKey)) {
          var mShortName = mKey.replace('color/', '');
          mappedSwatches.push({
            variableId: context.mappedVarIds[mKey],
            name: mShortName,
            description: mShortName
          });
        }
      }

      if (mappedSwatches.length > 0) {
        console.log('  Creating Mapped swatches group (' + mappedSwatches.length + ' colors)...');
        await sendCommand('create_color_swatches_group', {
          name: 'Theme Colors (Light / Dark)',
          parentFrameId: mappedContentFrame.id,
          swatches: mappedSwatches
        });
        await delay(300);
      }
    }
  }

  // --- 7d: Create "Typography" section ---
  if (context.textStyleIds && context.textStyleIds.length > 0) {
    console.log('  Creating Typography section...');
    var typoSection = await sendCommand('create_section', {
      name: 'Typography',
      x: 0, y: 2800,
      width: 2200, height: 1400
    });
    await delay(200);

    if (typoSection && typoSection.id) {
      var typoContentFrame = await sendCommand('create_frame', {
        name: 'Content',
        parentId: typoSection.id,
        width: 2100, height: 1200,
        x: 50, y: 100,
        fills: [{ type: 'SOLID', color: hexToFigmaColor('#FFFFFF') }],
        cornerRadius: 12,
        autoLayout: {
          mode: 'VERTICAL',
          itemSpacing: 40,
          paddingLeft: 60, paddingRight: 60,
          paddingTop: 40, paddingBottom: 40
        }
      });
      await delay(200);

      if (typoContentFrame && typoContentFrame.id) {
        console.log('  Creating Typography specimens (' + context.textStyleIds.length + ' styles)...');
        await sendCommand('create_typography_group', {
          name: 'Text Styles',
          parentFrameId: typoContentFrame.id,
          styles: context.textStyleIds
        });
        await delay(300);
      }
    }
  }

  // --- 7e: Create "Shadows" section ---
  if (context.effectStyleIds && context.effectStyleIds.length > 0) {
    console.log('  Creating Shadows section...');
    var shadowSection = await sendCommand('create_section', {
      name: 'Shadows',
      x: 0, y: 4400,
      width: 2200, height: 800
    });
    await delay(200);

    if (shadowSection && shadowSection.id) {
      var shadowContentFrame = await sendCommand('create_frame', {
        name: 'Content',
        parentId: shadowSection.id,
        width: 2100, height: 600,
        x: 50, y: 100,
        fills: [{ type: 'SOLID', color: hexToFigmaColor('#FFFFFF') }],
        cornerRadius: 12,
        autoLayout: {
          mode: 'VERTICAL',
          itemSpacing: 40,
          paddingLeft: 60, paddingRight: 60,
          paddingTop: 40, paddingBottom: 40
        }
      });
      await delay(200);

      if (shadowContentFrame && shadowContentFrame.id) {
        console.log('  Creating Shadow specimens (' + context.effectStyleIds.length + ' styles)...');
        await sendCommand('create_effect_group', {
          name: 'Hard Shadows',
          parentFrameId: shadowContentFrame.id,
          styles: context.effectStyleIds
        });
        await delay(300);
      }
    }
  }

  // --- 7f: Create "Spacing" section ---
  if (context.seedVarIds) {
    console.log('  Creating Spacing section...');
    var spacingSection = await sendCommand('create_section', {
      name: 'Spacing Scale',
      x: 0, y: 5400,
      width: 2200, height: 600
    });
    await delay(200);

    if (spacingSection && spacingSection.id) {
      var spacingContentFrame = await sendCommand('create_frame', {
        name: 'Content',
        parentId: spacingSection.id,
        width: 2100, height: 400,
        x: 50, y: 100,
        fills: [{ type: 'SOLID', color: hexToFigmaColor('#FFFFFF') }],
        cornerRadius: 12,
        autoLayout: {
          mode: 'VERTICAL',
          itemSpacing: 24,
          paddingLeft: 60, paddingRight: 60,
          paddingTop: 40, paddingBottom: 40,
          primaryAxisSizingMode: 'AUTO',
          counterAxisSizingMode: 'FIXED'
        }
      });
      await delay(200);

      if (spacingContentFrame && spacingContentFrame.id) {
        // Create spacing specimens as horizontal bars
        var spacingKeys = ['spacing/1', 'spacing/2', 'spacing/3', 'spacing/4', 'spacing/5', 'spacing/6', 'spacing/8', 'spacing/10', 'spacing/12', 'spacing/16', 'spacing/20', 'spacing/24'];
        var spacingSwatches = [];
        for (var spIdx = 0; spIdx < spacingKeys.length; spIdx++) {
          var spKey = spacingKeys[spIdx];
          if (context.seedVarIds[spKey]) {
            spacingSwatches.push({
              variableId: context.seedVarIds[spKey],
              name: spKey.replace('spacing/', '') + ' (' + [0,4,8,12,16,20,24,32,40,48,64,80,96][spIdx] + 'px)',
              description: 'spacing/' + spKey.replace('spacing/', '')
            });
          }
        }

        if (spacingSwatches.length > 0) {
          console.log('  Creating Spacing specimens (' + spacingSwatches.length + ' tokens)...');
          await sendCommand('create_color_swatches_group', {
            name: 'Spacing Scale',
            parentFrameId: spacingContentFrame.id,
            swatches: spacingSwatches
          });
          await delay(300);
        }
      }
    }
  }

  console.log('  Visual hierarchy complete');
}

// ---------------------------------------------------------------------------
// Pre-flight check
// ---------------------------------------------------------------------------

async function preflightCheck() {
  console.log('Running pre-flight check...');

  try {
    var statusBody = await new Promise(function (resolve, reject) {
      http.get(SERVER_URL + '/status', function (res) {
        var data = '';
        res.on('data', function (chunk) { data += chunk; });
        res.on('end', function () { resolve(data); });
      }).on('error', function (e) { reject(e); });
    });

    var status = JSON.parse(statusBody);

    if (!status.connected) {
      console.error('\n  ERROR: Figma plugin is NOT connected.');
      console.error('  1. Open Figma Desktop app');
      console.error('  2. Open your design file');
      console.error('  3. Load the plugin: Plugins → Development → Portfolio DS Builder');
      console.error('  4. Re-run this script\n');
      process.exit(1);
    }

    console.log('  Server connected: ' + status.connectionType);
    console.log('  File: ' + (status.fileInfo ? status.fileInfo.name : 'unknown'));
    console.log('  Pre-flight OK\n');
    return true;
  } catch (e) {
    console.error('\n  ERROR: Cannot reach orchestration server at ' + SERVER_URL);
    console.error('  Start it with: cd orchestration-server && node index.js\n');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('🍯 NECTAR CORE — FIGMA DESIGN SYSTEM BUILDER');
  console.log('='.repeat(60));
  console.log('');

  if (DRY_RUN) {
    console.log('  *** DRY RUN — commands will be printed, not sent ***\n');
  }

  if (STEP) {
    console.log('  Running step: ' + STEP + '\n');
  }

  // Load tokens
  var tokens = loadTokens();

  // Pre-flight (skip for dry run)
  if (!DRY_RUN) {
    await preflightCheck();
  }

  var totalVars = 0;
  var totalStyles = 0;

  // Context object — collects IDs from steps 1-5 for visual hierarchy (step 7)
  // Dependency chain (from variables-styles-extractor pattern):
  //   Seed (raw) → Alias (VARIABLE_ALIAS → seed) → Mapped (raw) → Styles → Visual
  var buildContext = {
    seedVarIds: null,    // { 'color/pastel/lavender': 'id123', ... }
    aliasVarIds: null,   // { 'color/primary': 'id789', ... }
    mappedVarIds: null,  // { 'color/bg': 'id456', ... }
    textStyleIds: null,  // [{ id, name, fontSize, fontName }, ...]
    effectStyleIds: null // [{ id, name, description }, ...]
  };

  // Step 1-3: Variables
  if (!STEP || STEP === 'variables' || STEP === 'all') {
    var collections = await createCollections();

    // We need to fetch the actual collection IDs after creation
    // The get_variable_collections response gives us what we need
    if (!DRY_RUN && collections) {
      console.log('\n  Fetched collections. Looking up IDs...');

      // Re-fetch to get all collections with their IDs and mode IDs
      var allCollections = await sendCommand('get_variable_collections', {});
      await delay(200);

      if (allCollections && Array.isArray(allCollections)) {
        var seedCol = allCollections.find(function (c) { return c.name === 'Seed'; });
        var mappedCol = allCollections.find(function (c) { return c.name === 'Mapped'; });

        // Dependency-aware ordering: Seed → Alias → Mapped
        var aliasCol = allCollections.find(function (c) { return c.name === 'Alias'; });

        if (seedCol) {
          console.log('  Seed collection ID: ' + seedCol.id);
          var seedModeId = seedCol.modes && seedCol.modes[0] ? seedCol.modes[0].modeId : null;
          if (seedModeId) {
            var seedResult = await createSeedVariables(tokens.seed, seedCol.id, seedModeId);
            totalVars += seedResult.count;
            buildContext.seedVarIds = seedResult.varIds;
          }
        }

        // Step 2b: Alias variables (depend on seed variable IDs)
        if (aliasCol && buildContext.seedVarIds) {
          console.log('  Alias collection ID: ' + aliasCol.id);
          var aliasModeId = aliasCol.modes && aliasCol.modes[0] ? aliasCol.modes[0].modeId : null;
          if (aliasModeId) {
            var aliasResult = await createAliasVariables(tokens.alias, tokens.seed, aliasCol.id, aliasModeId, buildContext.seedVarIds);
            totalVars += aliasResult.count;
            buildContext.aliasVarIds = aliasResult.varIds;
          }
        }

        if (mappedCol) {
          console.log('  Mapped collection ID: ' + mappedCol.id);
          var lightMode = mappedCol.modes ? mappedCol.modes.find(function (m) { return m.name === 'Light'; }) : null;
          var darkMode = mappedCol.modes ? mappedCol.modes.find(function (m) { return m.name === 'Dark'; }) : null;
          if (lightMode && darkMode) {
            var mappedResult = await createMappedVariables(tokens.mapped, mappedCol.id, lightMode.modeId, darkMode.modeId);
            totalVars += mappedResult.count;
            buildContext.mappedVarIds = mappedResult.varIds;
          }
        }
      }
    } else if (DRY_RUN) {
      // In dry run, simulate with placeholder IDs
      // Dependency chain: Seed → Alias → Mapped
      var seedDry = await createSeedVariables(tokens.seed, 'SEED_COL_ID', 'SEED_MODE_ID');
      var aliasDry = await createAliasVariables(tokens.alias, tokens.seed, 'ALIAS_COL_ID', 'ALIAS_MODE_ID', {});
      var mappedDry = await createMappedVariables(tokens.mapped, 'MAPPED_COL_ID', 'LIGHT_MODE_ID', 'DARK_MODE_ID');
      totalVars += seedDry.count + aliasDry.count + mappedDry.count;
    }
  }

  // Step 4-5: Styles
  if (!STEP || STEP === 'styles' || STEP === 'all') {
    var textResult = await createTextStyles();
    totalStyles += textResult.count;
    buildContext.textStyleIds = textResult.styleIds;

    var effectResult = await createEffectStyles();
    totalStyles += effectResult.count;
    buildContext.effectStyleIds = effectResult.styleIds;
  }

  // Step 6: Pages
  if (!STEP || STEP === 'pages' || STEP === 'all') {
    await createPages();
  }

  // Step 7: Visual hierarchy (requires IDs from earlier steps)
  // If running --step visual, fetch existing IDs from Figma
  if (STEP === 'visual' && !buildContext.seedVarIds && !DRY_RUN) {
    console.log('\n=== Fetching existing variable & style IDs for visual hierarchy ===');
    // Fetch collections first to get IDs
    var allCols = await sendCommand('get_variable_collections', {});
    if (allCols && Array.isArray(allCols)) {
      buildContext.seedVarIds = {};
      buildContext.aliasVarIds = {};
      buildContext.mappedVarIds = {};
      for (var ci = 0; ci < allCols.length; ci++) {
        var col = allCols[ci];
        var vars = await sendCommand('get_vars', { collectionId: col.id });
        if (!vars || !Array.isArray(vars)) continue;
        var targetMap = null;
        if (col.name === 'Seed') targetMap = buildContext.seedVarIds;
        else if (col.name === 'Alias') targetMap = buildContext.aliasVarIds;
        else if (col.name === 'Mapped') targetMap = buildContext.mappedVarIds;
        if (targetMap) {
          for (var vi = 0; vi < vars.length; vi++) {
            targetMap[vars[vi].name] = vars[vi].id;
          }
          console.log('  ' + col.name + ': ' + vars.length + ' vars');
        }
      }
    }
    var existingStyles = await sendCommand('get_local_styles', {});
    if (existingStyles) {
      // Text styles from get_local_styles only have id+name — enrich with known definitions
      var knownTextDefs = {
        'Heading/H1': { fontSize: 61, fontFamily: 'Libre Baskerville', fontStyle: 'Bold' },
        'Heading/H2': { fontSize: 49, fontFamily: 'Libre Baskerville', fontStyle: 'Bold' },
        'Heading/H3': { fontSize: 39, fontFamily: 'Libre Baskerville', fontStyle: 'Regular' },
        'Heading/H4': { fontSize: 31, fontFamily: 'Libre Baskerville', fontStyle: 'Regular' },
        'Heading/H5': { fontSize: 25, fontFamily: 'Libre Baskerville', fontStyle: 'Regular' },
        'Heading/H6': { fontSize: 20, fontFamily: 'Libre Baskerville', fontStyle: 'Regular' },
        'Title/Title 1': { fontSize: 31, fontFamily: 'Switzer', fontStyle: 'Medium' },
        'Title/Title 2': { fontSize: 25, fontFamily: 'Switzer', fontStyle: 'Medium' },
        'Title/Title 3': { fontSize: 20, fontFamily: 'Switzer', fontStyle: 'Medium' },
        'Body/Base': { fontSize: 16, fontFamily: 'Switzer', fontStyle: 'Regular' },
        'Body/Small': { fontSize: 13, fontFamily: 'Switzer', fontStyle: 'Regular' },
        'Body/Large': { fontSize: 20, fontFamily: 'Switzer', fontStyle: 'Regular' },
        'Caption': { fontSize: 13, fontFamily: 'Merriweather', fontStyle: 'Regular' },
        'Code': { fontSize: 13, fontFamily: 'Roboto Mono', fontStyle: 'Regular' }
      };
      buildContext.textStyleIds = (existingStyles.textStyles || []).map(function (s) {
        var known = knownTextDefs[s.name] || { fontSize: 16, fontFamily: 'Inter', fontStyle: 'Regular' };
        return { id: s.id, name: s.name, fontSize: known.fontSize, fontName: { family: known.fontFamily, style: known.fontStyle } };
      });
      buildContext.effectStyleIds = (existingStyles.effectStyles || []).map(function (s) {
        return { id: s.id, name: s.name, description: s.description || '' };
      });
      console.log('  Text styles: ' + buildContext.textStyleIds.length);
      console.log('  Effect styles: ' + buildContext.effectStyleIds.length);
    }
  }

  if (!STEP || STEP === 'visual' || STEP === 'all') {
    if (!DRY_RUN) {
      await buildVisualHierarchy(buildContext);
    } else {
      console.log('\n=== Step 7: Build Visual Hierarchy ===');
      console.log('  Skipping in dry-run mode (requires real variable/style IDs)');
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('BUILD COMPLETE');
  console.log('='.repeat(60));
  console.log('  Variables created: ' + totalVars);
  console.log('  Styles created:    ' + totalStyles);
  console.log('  Commands sent:     ' + commandCount);
  if (buildContext.seedVarIds) {
    console.log('  Seed var IDs:      ' + Object.keys(buildContext.seedVarIds).length);
  }
  if (buildContext.aliasVarIds) {
    console.log('  Alias var IDs:     ' + Object.keys(buildContext.aliasVarIds).length);
  }
  if (buildContext.mappedVarIds) {
    console.log('  Mapped var IDs:    ' + Object.keys(buildContext.mappedVarIds).length);
  }
  if (buildContext.textStyleIds) {
    console.log('  Text style IDs:    ' + buildContext.textStyleIds.length);
  }
  if (buildContext.effectStyleIds) {
    console.log('  Effect style IDs:  ' + buildContext.effectStyleIds.length);
  }
  if (DRY_RUN) {
    console.log('  (DRY RUN — nothing was actually sent)');
  }
  console.log('');
}

main().catch(function (err) {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
