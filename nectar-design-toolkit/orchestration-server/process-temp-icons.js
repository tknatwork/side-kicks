#!/usr/bin/env node
/**
 * Process icons from Temporary page
 * 
 * This script extracts the specific icon variants (stroke=1, radius=3, join=round)
 * from the Temporary page and creates icon components in the Icons page.
 * 
 * Usage:
 *   node process-temp-icons.js list      - Show icons that will be processed
 *   node process-temp-icons.js manifest  - Generate manifest JSON
 *   node process-temp-icons.js process   - Process all icons
 *   node process-temp-icons.js arrows    - Process only arrows
 *   node process-temp-icons.js layout    - Process only layout icons
 */

const ORCHESTRATION_URL = 'http://localhost:9877';

// Icon node IDs extracted from the Temporary page metadata
// Format: { iconName: { outline: nodeId, filled: nodeId } }
// These are the "filled=off/on, stroke=1, radius=3, join=round" variants (at x=1588/1644)
const ICONS = {
  // ========== ARROWS (16 icons) ==========
  'arrow-up-circle': { outline: '118:293', filled: '118:296' },
  'arrow-right-up-circle': { outline: '118:355', filled: '118:357' },
  'arrow-right-circle': { outline: '118:416', filled: '118:418' },
  'arrow-right-down-circle': { outline: '118:477', filled: '118:479' },
  'arrow-down-circle': { outline: '118:538', filled: '118:540' },
  'arrow-left-down-circle': { outline: '118:599', filled: '118:601' },
  'arrow-left-circle': { outline: '118:660', filled: '118:662' },
  'arrow-left-up-circle': { outline: '118:721', filled: '118:723' },
  'arrow-up': { outline: '118:782', filled: '118:784' },
  'arrow-up-right': { outline: '118:843', filled: '118:845' },
  'arrow-right': { outline: '118:904', filled: '118:906' },
  'arrow-down-right': { outline: '118:965', filled: '118:967' },
  'arrow-down': { outline: '118:1026', filled: '118:1028' },
  'arrow-down-left': { outline: '118:1087', filled: '118:1089' },
  'arrow-left': { outline: '118:1148', filled: '118:1150' },
  'arrow-up-left': { outline: '118:1209', filled: '118:1211' },
  
  // ========== LAYOUT (22 icons) ==========
  'column-wide-add': { outline: '118:90978', filled: '118:90981' },
  'column-split': { outline: '118:91054', filled: '118:91057' },
  'column-wide-half': { outline: '118:91130', filled: '118:91133' },
  'column-wide-half-add': { outline: '118:91206', filled: '118:91209' },
  'column-wide-half-remove': { outline: '118:91282', filled: '118:91285' },
  'slide-wide-add': { outline: '118:91358', filled: '118:91361' },
  'slide-tall-add': { outline: '118:91434', filled: '118:91437' },
  'slides-tall': { outline: '118:91510', filled: '118:91513' },
  'slides-tall-add': { outline: '118:91600', filled: '118:91604' },
  'slides-wide': { outline: '118:91677', filled: '118:91680' },
  'slides-wide-add': { outline: '118:91767', filled: '118:91771' },
  'layers-two': { outline: '118:91830', filled: '118:91832' },
  'layers-three': { outline: '118:91891', filled: '118:91893' },
  'layers-behind': { outline: '118:91966', filled: '118:91969' },
  'carousel': { outline: '118:92055', filled: '118:92059' },
  'placeholder': { outline: '118:92118', filled: '118:92120' },
  'kanban-view': { outline: '118:92179', filled: '118:92181' },
  'sidebar-left-arrow': { outline: '118:92268', filled: '118:92272' },
  'sidebar-wide-left-arrow': { outline: '118:92359', filled: '118:92363' },
  'sidebar-simple-left-wide': { outline: '118:92436', filled: '118:92439' },
  'sidebar-simple-right-wide': { outline: '118:92512', filled: '118:92515' },
  'sidebar-simple-left-square': { outline: '118:92588', filled: '118:92591' },
  'sidebar-simple-right-square': { outline: '118:92664', filled: '118:92667' },
};

async function sendCommand(command, payload = {}) {
  try {
    const response = await fetch(`${ORCHESTRATION_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, payload })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ Command failed: ${command}`, error.message);
    return null;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildIconBatch(filter = null) {
  const iconBatch = [];
  
  for (const [iconName, variants] of Object.entries(ICONS)) {
    // Apply filter if provided
    if (filter === 'arrows' && !iconName.startsWith('arrow')) continue;
    if (filter === 'layout' && iconName.startsWith('arrow')) continue;
    
    iconBatch.push({
      name: `icon/${iconName}`,
      nodeId: variants.outline,
      variant: 'outline'
    });
    iconBatch.push({
      name: `icon/${iconName}-filled`,
      nodeId: variants.filled,
      variant: 'filled'
    });
  }
  
  return iconBatch;
}

async function processIcons(filter = null) {
  const iconBatch = buildIconBatch(filter);
  
  console.log(`
════════════════════════════════════════════════════════════
🍯 NECTAR DS - PROCESS TEMPORARY ICONS
════════════════════════════════════════════════════════════

Filter: ${filter || 'all'}
Total icons: ${iconBatch.length} (${iconBatch.length / 2} × 2 variants)
Variant: stroke=1, radius=3, join=round

════════════════════════════════════════════════════════════
`);

  console.log(`📦 Sending batch to plugin...`);
  console.log('');

  // Send batch command to plugin via orchestration server
  const result = await sendCommand('process_temp_icons', {
    icons: iconBatch,
    targetPageName: 'Icons',
    bindStrokeVariable: 'fg/default',  // Using fg/default since icon/* color vars don't exist
    startX: 100,
    startY: 100,
    spacing: 40,
    iconsPerRow: 10
  });

  if (result && result.success !== false) {
    console.log(`✅ Successfully processed ${result.processed || iconBatch.length} icons!`);
    
    if (result.icons && result.icons.length > 0) {
      console.log('');
      console.log('Created components:');
      result.icons.forEach((icon, i) => {
        console.log(`  ${i + 1}. ${icon.name}`);
      });
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log('');
      console.log('⚠️  Warnings/Errors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
  } else {
    console.log('❌ Processing failed');
    if (result && result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
    console.log('Make sure:');
    console.log('  1. Orchestration server is running: cd orchestration-server && npm start');
    console.log('  2. Figma plugin is running in Figma desktop app');
    console.log('  3. NDS file is open with Temporary page containing the icons');
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════════');
}

// Generate manifest
function generateManifest() {
  const manifest = {
    version: '1.0.0',
    variant: 'stroke=1, radius=3, join=round',
    generatedAt: new Date().toISOString(),
    categories: {
      arrows: [],
      layout: []
    },
    icons: {}
  };

  for (const [name, variants] of Object.entries(ICONS)) {
    const category = name.startsWith('arrow') ? 'arrows' : 'layout';
    manifest.categories[category].push(name);
    manifest.icons[name] = {
      outline: `icon/${name}`,
      filled: `icon/${name}-filled`,
      sourceNodes: variants
    };
  }

  return manifest;
}

// List all icons
function listIcons() {
  console.log(`
🍯 NECTAR DS - ICON LIST
════════════════════════════════════════════════════════════

Total: ${Object.keys(ICONS).length} icons (${Object.keys(ICONS).length * 2} with variants)
Variant: stroke=1, radius=3, join=round

═══ ARROWS (16) ═════════════════════════════════════════════
`);
  
  let i = 1;
  for (const name of Object.keys(ICONS)) {
    if (name.startsWith('arrow')) {
      console.log(`  ${i}. ${name}`);
      i++;
    }
  }
  
  console.log(`
═══ LAYOUT (${Object.keys(ICONS).length - 16}) ═════════════════════════════════════════════
`);
  
  for (const name of Object.keys(ICONS)) {
    if (!name.startsWith('arrow')) {
      console.log(`  ${i}. ${name}`);
      i++;
    }
  }
  
  console.log('');
}

// Main
const command = process.argv[2] || 'help';

switch (command) {
  case 'process':
    processIcons().catch(console.error);
    break;
    
  case 'arrows':
    processIcons('arrows').catch(console.error);
    break;
    
  case 'layout':
    processIcons('layout').catch(console.error);
    break;
    
  case 'list':
    listIcons();
    break;
    
  case 'manifest':
    const manifest = generateManifest();
    const fs = require('fs');
    const path = require('path');
    const manifestPath = path.join(__dirname, 'icons', 'temp-icons-manifest.json');
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Manifest saved: ${manifestPath}`);
    console.log(`   Total icons: ${Object.keys(ICONS).length * 2}`);
    break;
    
  default:
    console.log(`
🍯 NECTAR DS - Process Temporary Icons

Usage:
  node process-temp-icons.js <command>

Commands:
  list      - List all icons that will be processed
  manifest  - Generate icon manifest JSON
  process   - Process ALL icons from Temporary page to Icons page
  arrows    - Process only arrow icons
  layout    - Process only layout icons

Prerequisites:
  1. Figma plugin must be running (load it in Figma Desktop)
  2. Orchestration server must be running: npm start
  3. NDS file must be open with Temporary page containing icons

Icon Count:
  • Arrows: 16 icons (32 with variants)
  • Layout: 23 icons (46 with variants)
  • Total: 39 icons (78 with variants)
`);
}
