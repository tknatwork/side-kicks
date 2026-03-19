/**
 * Nectar DS - Icon Import Script
 * 
 * This script:
 * 1. Extracts icon node IDs from the Central Icon System file
 * 2. Downloads SVGs for the specific variants (stroke=1, radius=3, round)
 * 3. Creates icon components in the NDS file via the Figma plugin
 * 
 * Usage:
 *   FIGMA_TOKEN=your-token node import-icons.js extract   # Download SVGs
 *   node import-icons.js create                            # Create icons in Figma
 *   FIGMA_TOKEN=your-token node import-icons.js all       # Do everything
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const FIGMA_PERSONAL_ACCESS_TOKEN = process.env.FIGMA_TOKEN || '';
const SOURCE_FILE_KEY = 'quMngmJX7ahR1d3QfA6LUm'; // Central Icon System
const PLUGIN_SERVER_URL = 'http://localhost:9877';
const ICONS_OUTPUT_DIR = path.join(__dirname, 'icons');

// All icons extracted from the metadata
// Format: { iconName: { outline: nodeId, filled: nodeId } }
// These are the "stroke=1, radius=3, join=round" variants
const ICONS = {
  // ========== ARROWS (16 icons) ==========
  'arrow-up-circle': { outline: '1:6359', filled: '1:6362' },
  'arrow-right-up-circle': { outline: '1:6421', filled: '1:6423' },
  'arrow-right-circle': { outline: '1:6482', filled: '1:6484' },
  'arrow-right-down-circle': { outline: '1:6543', filled: '1:6545' },
  'arrow-down-circle': { outline: '1:6604', filled: '1:6606' },
  'arrow-left-down-circle': { outline: '1:6665', filled: '1:6667' },
  'arrow-left-circle': { outline: '1:6726', filled: '1:6728' },
  'arrow-left-up-circle': { outline: '1:6787', filled: '1:6789' },
  'arrow-up': { outline: '1:6848', filled: '1:6850' },
  'arrow-up-right': { outline: '1:6909', filled: '1:6911' },
  'arrow-right': { outline: '1:6970', filled: '1:6972' },
  'arrow-down-right': { outline: '1:7031', filled: '1:7033' },
  'arrow-down': { outline: '1:7092', filled: '1:7094' },
  'arrow-down-left': { outline: '1:7153', filled: '1:7155' },
  'arrow-left': { outline: '1:7214', filled: '1:7216' },
  'arrow-up-left': { outline: '1:7275', filled: '1:7277' },
  
  // ========== LAYOUT (21 icons) ==========
  'column-split': { outline: '1:97261', filled: '1:97264' },
  'column-wide-half': { outline: '1:97337', filled: '1:97340' },
  'column-wide-half-add': { outline: '1:97413', filled: '1:97416' },
  'column-wide-half-remove': { outline: '1:97489', filled: '1:97492' },
  'slide-wide-add': { outline: '1:97565', filled: '1:97568' },
  'slide-tall-add': { outline: '1:97641', filled: '1:97644' },
  'slides-tall': { outline: '1:97717', filled: '1:97720' },
  'slides-tall-add': { outline: '1:97807', filled: '1:97811' },
  'slides-wide': { outline: '1:97884', filled: '1:97887' },
  'slides-wide-add': { outline: '1:97974', filled: '1:97978' },
  'layers-two': { outline: '1:98037', filled: '1:98039' },
  'layers-three': { outline: '1:98098', filled: '1:98100' },
  'layers-behind': { outline: '1:98173', filled: '1:98176' },
  'carousel': { outline: '1:98262', filled: '1:98266' },
  'placeholder': { outline: '1:98325', filled: '1:98327' },
  'kanban-view': { outline: '1:98386', filled: '1:98388' },
  'sidebar-left-arrow': { outline: '1:98475', filled: '1:98479' },
  'sidebar-wide-left-arrow': { outline: '1:98566', filled: '1:98570' },
  'sidebar-simple-left-wide': { outline: '1:98643', filled: '1:98646' },
  'sidebar-simple-right-wide': { outline: '1:98719', filled: '1:98722' },
  'sidebar-simple-left-square': { outline: '1:98795', filled: '1:98798' },
  'sidebar-simple-right-square': { outline: '1:98871', filled: '1:98874' },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchFigmaImages(nodeIds, format = 'svg') {
  if (!FIGMA_PERSONAL_ACCESS_TOKEN) {
    throw new Error('FIGMA_TOKEN environment variable is required');
  }
  
  const url = `https://api.figma.com/v1/images/${SOURCE_FILE_KEY}?ids=${nodeIds.join(',')}&format=${format}`;
  
  console.log(`  Fetching ${nodeIds.length} images from Figma API...`);
  
  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': FIGMA_PERSONAL_ACCESS_TOKEN
    }
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Figma API error: ${response.status} ${response.statusText}\n${text}`);
  }
  
  const data = await response.json();
  
  if (data.err) {
    throw new Error(`Figma API error: ${data.err}`);
  }
  
  return data.images;
}

async function sendPluginCommand(command, payload = {}) {
  const response = await fetch(`${PLUGIN_SERVER_URL}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, payload })
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Plugin command failed');
  }
  return data.data;
}

async function downloadSvg(url, filename) {
  const response = await fetch(url);
  const svg = await response.text();
  
  // Ensure output directory exists
  if (!fs.existsSync(ICONS_OUTPUT_DIR)) {
    fs.mkdirSync(ICONS_OUTPUT_DIR, { recursive: true });
  }
  
  const filepath = path.join(ICONS_OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, svg);
  return svg;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function extractIcons() {
  console.log('🔍 Extracting icons via Figma API...\n');
  
  if (!FIGMA_PERSONAL_ACCESS_TOKEN) {
    console.log('❌ FIGMA_TOKEN environment variable is required');
    console.log('   Get your token at: https://www.figma.com/developers/api#access-tokens');
    console.log('   Usage: FIGMA_TOKEN=your-token node import-icons.js extract');
    return null;
  }
  
  // Collect all node IDs
  const allNodeIds = [];
  const nodeIdMap = {};
  
  for (const [name, ids] of Object.entries(ICONS)) {
    allNodeIds.push(ids.outline, ids.filled);
    nodeIdMap[ids.outline] = { name, variant: 'outline' };
    nodeIdMap[ids.filled] = { name, variant: 'filled' };
  }
  
  console.log(`📥 Fetching ${allNodeIds.length} SVG images from Figma...\n`);
  
  // Fetch in batches of 50 (Figma API limit)
  const batchSize = 50;
  const imageUrls = {};
  
  for (let i = 0; i < allNodeIds.length; i += batchSize) {
    const batch = allNodeIds.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(allNodeIds.length / batchSize);
    console.log(`  Batch ${batchNum}/${totalBatches}...`);
    
    try {
      const urls = await fetchFigmaImages(batch, 'svg');
      Object.assign(imageUrls, urls);
      
      // Rate limiting - wait a bit between batches
      if (i + batchSize < allNodeIds.length) {
        await sleep(500);
      }
    } catch (error) {
      console.log(`  ❌ Batch ${batchNum} failed: ${error.message}`);
    }
  }
  
  console.log(`\n📂 Downloading SVGs to ${ICONS_OUTPUT_DIR}...\n`);
  
  const downloaded = [];
  const failed = [];
  
  // Download each SVG
  for (const [nodeId, url] of Object.entries(imageUrls)) {
    if (!url) {
      const info = nodeIdMap[nodeId];
      failed.push(`${info.name}-${info.variant} (no URL)`);
      continue;
    }
    
    try {
      const info = nodeIdMap[nodeId];
      const filename = `${info.name}-${info.variant}.svg`;
      await downloadSvg(url, filename);
      downloaded.push(filename);
      console.log(`  ✅ ${filename}`);
    } catch (error) {
      const info = nodeIdMap[nodeId];
      failed.push(`${info.name}-${info.variant}: ${error.message}`);
    }
  }
  
  console.log(`\n✨ Downloaded ${downloaded.length} icons`);
  if (failed.length > 0) {
    console.log(`⚠️  ${failed.length} failed:\n  - ${failed.join('\n  - ')}`);
  }
  
  return { downloaded, failed };
}

async function createIconsInNDS() {
  console.log('\n🎨 Creating icon components in NDS file...\n');
  
  // Check if plugin is connected
  try {
    const statusRes = await fetch(`${PLUGIN_SERVER_URL}/status`);
    const status = await statusRes.json();
    
    if (!status.connected) {
      console.log('❌ Plugin not connected.');
      console.log('   1. Open your NDS file in Figma');
      console.log('   2. Run the Nectar DS Builder plugin');
      console.log('   3. Make sure the orchestration server is running');
      return;
    }
    
    console.log(`✅ Connected to: ${status.fileInfo?.name || 'unknown'}`);
  } catch (error) {
    console.log('❌ Cannot connect to plugin server.');
    console.log('   Run: cd orchestration-server && npm start');
    return;
  }
  
  // Check if we have SVG files
  if (!fs.existsSync(ICONS_OUTPUT_DIR)) {
    console.log('❌ No SVG files found. Run "extract" command first.');
    return;
  }
  
  const svgFiles = fs.readdirSync(ICONS_OUTPUT_DIR).filter(f => f.endsWith('.svg'));
  if (svgFiles.length === 0) {
    console.log('❌ No SVG files found in icons directory.');
    return;
  }
  
  console.log(`📦 Found ${svgFiles.length} SVG files\n`);
  
  // Navigate to Icons page (110:2 is the NDS Icons page)
  try {
    await sendPluginCommand('set_current_page', { pageId: '110:2' });
    console.log('✅ Navigated to Icons page\n');
  } catch (error) {
    console.log(`⚠️  Could not navigate to Icons page: ${error.message}`);
    console.log('   Will create icons on current page\n');
  }
  
  // Get the icon/default variable for stroke binding
  let strokeVariableId = null;
  try {
    const collections = await sendPluginCommand('get_variable_collections');
    const mappedCollection = collections.find(c => c.name === 'Mapped');
    
    if (mappedCollection) {
      const variables = await sendPluginCommand('get_variables', { collectionId: mappedCollection.id });
      const iconVar = variables.find(v => v.name === 'icon/default');
      if (iconVar) {
        strokeVariableId = iconVar.id;
        console.log(`✅ Found icon/default variable: ${strokeVariableId}\n`);
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not find icon variable: ${error.message}`);
  }
  
  // Prepare icons for batch creation
  const iconsData = [];
  for (const file of svgFiles) {
    const svg = fs.readFileSync(path.join(ICONS_OUTPUT_DIR, file), 'utf-8');
    const name = file.replace('.svg', '');
    const variant = name.includes('-outline') ? 'outline' : name.includes('-filled') ? 'filled' : undefined;
    
    iconsData.push({
      name,
      svg,
      variant
    });
  }
  
  console.log(`🚀 Creating ${iconsData.length} icons in Figma...\n`);
  
  // Create icons in batches of 10 to avoid overwhelming the plugin
  const batchSize = 10;
  const results = [];
  
  for (let i = 0; i < iconsData.length; i += batchSize) {
    const batch = iconsData.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(iconsData.length / batchSize);
    
    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} icons)...`);
    
    try {
      const result = await sendPluginCommand('batch_create_icons_from_svg', {
        icons: batch,
        x: 0,
        y: i * 4,  // Offset each batch vertically
        spacing: 40,
        iconsPerRow: 10,
        createComponents: true,
        strokeVariableId
      });
      
      results.push(...result.icons);
      
      if (result.errors && result.errors.length > 0) {
        console.log(`    ⚠️  ${result.errors.length} errors in batch`);
      }
      
      // Small delay between batches
      await sleep(200);
      
    } catch (error) {
      console.log(`    ❌ Batch failed: ${error.message}`);
    }
  }
  
  console.log(`\n✨ Created ${results.length} icons in Figma!`);
  
  return results;
}

async function generateManifest() {
  console.log('\n📝 Generating icon manifest...\n');
  
  const manifest = {
    version: '1.0.0',
    sourceFile: SOURCE_FILE_KEY,
    extractedAt: new Date().toISOString(),
    specification: {
      stroke: 1,
      radius: 3,
      join: 'round',
      variants: ['outline', 'filled']
    },
    icons: Object.entries(ICONS).map(([name, ids]) => ({
      name,
      outlineNodeId: ids.outline,
      filledNodeId: ids.filled
    })),
    totalIcons: Object.keys(ICONS).length * 2
  };
  
  if (!fs.existsSync(ICONS_OUTPUT_DIR)) {
    fs.mkdirSync(ICONS_OUTPUT_DIR, { recursive: true });
  }
  
  const manifestPath = path.join(ICONS_OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`✅ Manifest saved: ${manifestPath}`);
  console.log(`   Total icons: ${manifest.totalIcons}`);
  console.log(`   Unique icons: ${Object.keys(ICONS).length}`);
  
  return manifest;
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('🍯 NECTAR DS - ICON IMPORT SCRIPT');
  console.log('═'.repeat(60));
  console.log('');
  console.log(`Source File: Central Icon System (${SOURCE_FILE_KEY})`);
  console.log(`Icons: ${Object.keys(ICONS).length * 2} total (${Object.keys(ICONS).length} × 2 variants)`);
  console.log(`Variant: stroke=1, radius=3, join=round`);
  console.log('');
  console.log('═'.repeat(60));
  
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  switch (command) {
    case 'manifest':
      await generateManifest();
      break;
      
    case 'extract':
      await extractIcons();
      break;
      
    case 'create':
      await createIconsInNDS();
      break;
      
    case 'all':
      await generateManifest();
      const extracted = await extractIcons();
      if (extracted && extracted.downloaded.length > 0) {
        await createIconsInNDS();
      }
      break;
      
    default:
      console.log('Usage: node import-icons.js [command]');
      console.log('');
      console.log('Commands:');
      console.log('  manifest  Generate icon manifest JSON');
      console.log('  extract   Download SVGs from Figma (requires FIGMA_TOKEN)');
      console.log('  create    Create icon components in NDS (requires plugin)');
      console.log('  all       Run all steps');
      console.log('');
      console.log('Environment:');
      console.log('  FIGMA_TOKEN  Your Figma Personal Access Token');
      console.log('               Get it at: figma.com/developers/api#access-tokens');
      console.log('');
      console.log('Examples:');
      console.log('  FIGMA_TOKEN=xxx node import-icons.js extract');
      console.log('  node import-icons.js create');
  }
  
  console.log('');
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});

