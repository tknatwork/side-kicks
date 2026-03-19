#!/usr/bin/env node
/**
 * Central Icon System Import Script
 * 
 * Extracts icons from the Central Icon System Figma file and creates 
 * component sets with filled variant property in NDS.
 * 
 * Usage:
 *   FIGMA_TOKEN="your_token" node import-central-icons.js extract
 *   node import-central-icons.js create
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const FIGMA_TOKEN = process.env.FIGMA_TOKEN || '';
const SOURCE_FILE_KEY = 'quMngmJX7ahR1d3QfA6LUm';
const ICONS_PAGE_ID = '1:3';
const ORCHESTRATION_URL = 'http://localhost:9877/command';
const ICONS_DIR = path.join(__dirname, 'central-icons');

// Target variant: stroke=1, radius=3, join=round (NDS standard)
const TARGET_VARIANT = {
  stroke: '1',
  radius: '3',
  join: 'round'
};

// Icon categories and their frame IDs (extracted from metadata)
const ICON_FRAMES = [
  // Arrows - Directional Circle
  { name: 'arrow-up-circle', frameId: '1:6288', aliases: ['arrow-top'] },
  { name: 'arrow-right-up-circle', frameId: '1:6364' },
  { name: 'arrow-right-circle', frameId: '1:6425' },
  { name: 'arrow-right-down-circle', frameId: '1:6486' },
  { name: 'arrow-down-circle', frameId: '1:6547', aliases: ['arrow-bottom'] },
  { name: 'arrow-left-down-circle', frameId: '1:6608' },
  { name: 'arrow-left-circle', frameId: '1:6669' },
  { name: 'arrow-left-up-circle', frameId: '1:6730' },
  
  // Arrows - Simple
  { name: 'arrow-up', frameId: '1:6791', aliases: ['arrow-top'] },
  { name: 'arrow-up-right', frameId: '1:6852' },
  { name: 'arrow-right', frameId: '1:6913' },
  { name: 'arrow-down-right', frameId: '1:6974' },
  { name: 'arrow-down', frameId: '1:7035' },
  { name: 'arrow-down-left', frameId: '1:7096' },
  { name: 'arrow-left', frameId: '1:7157' },
  { name: 'arrow-up-left', frameId: '1:7218' },
  
  // Layout - Columns
  { name: 'column-split', frameId: '1:97190' },
  { name: 'column-wide-half', frameId: '1:97266' },
  { name: 'column-wide-half-add', frameId: '1:97342' },
  { name: 'column-wide-half-remove', frameId: '1:97418' },
  
  // Layout - Slides
  { name: 'slide-wide-add', frameId: '1:97494' },
  { name: 'slide-tall-add', frameId: '1:97570' },
  { name: 'slides-tall', frameId: '1:97646' },
  { name: 'slides-tall-add', frameId: '1:97722' },
  { name: 'slides-wide', frameId: '1:97813' },
  { name: 'slides-wide-add', frameId: '1:97889' },
  
  // Layers
  { name: 'layers-two', frameId: '1:97980', aliases: ['stack'] },
  { name: 'layers-three', frameId: '1:98041', aliases: ['stack'] },
  { name: 'layers-behind', frameId: '1:98102', aliases: ['slides', 'pages'] },
  
  // UI Components
  { name: 'carousel', frameId: '1:98178', aliases: ['slides'] },
  { name: 'placeholder', frameId: '1:98268', aliases: ['generate'] },
  { name: 'kanban-view', frameId: '1:98329', aliases: ['columns'] },
  
  // Sidebar
  { name: 'sidebar-left-arrow', frameId: '1:98390' },
  { name: 'sidebar-wide-left-arrow', frameId: '1:98481' },
  { name: 'sidebar-simple-left-wide', frameId: '1:98572' },
  { name: 'sidebar-simple-right-wide', frameId: '1:98648' },
  { name: 'sidebar-simple-left-square', frameId: '1:98724' },
  { name: 'sidebar-simple-right-square', frameId: '1:98800' },
];

// Categories for organization
const CATEGORIES = {
  'Arrows (Circle)': [
    'arrow-up-circle', 'arrow-right-up-circle', 'arrow-right-circle', 
    'arrow-right-down-circle', 'arrow-down-circle', 'arrow-left-down-circle',
    'arrow-left-circle', 'arrow-left-up-circle'
  ],
  'Arrows (Simple)': [
    'arrow-up', 'arrow-up-right', 'arrow-right', 'arrow-down-right',
    'arrow-down', 'arrow-down-left', 'arrow-left', 'arrow-up-left'
  ],
  'Layout': [
    'column-split', 'column-wide-half', 'column-wide-half-add', 
    'column-wide-half-remove'
  ],
  'Slides': [
    'slide-wide-add', 'slide-tall-add', 'slides-tall', 'slides-tall-add',
    'slides-wide', 'slides-wide-add'
  ],
  'Layers': [
    'layers-two', 'layers-three', 'layers-behind'
  ],
  'UI': [
    'carousel', 'placeholder', 'kanban-view'
  ],
  'Sidebar': [
    'sidebar-left-arrow', 'sidebar-wide-left-arrow', 'sidebar-simple-left-wide',
    'sidebar-simple-right-wide', 'sidebar-simple-left-square', 'sidebar-simple-right-square'
  ]
};

// Helper: Make HTTPS request
function httpsRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Helper: Send command to orchestration server
function sendCommand(command, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ command, payload });
    const options = {
      hostname: 'localhost',
      port: 9877,
      path: '/command',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ success: false, error: body });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(data);
    req.end();
  });
}

// Helper: Sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Find the specific variant nodes we want
function findTargetVariants(children) {
  const variants = { outline: null, filled: null };
  
  for (const child of children) {
    if (child.type === 'COMPONENT') {
      const name = child.name.toLowerCase();
      
      // Check if this is our target variant
      const isStroke1 = name.includes('stroke=1,') || name.includes('stroke=1 ');
      const isRadius3 = name.includes('radius=3');
      const isJoinRound = name.includes('join=round');
      
      if (isStroke1 && isRadius3 && isJoinRound) {
        if (name.includes('filled=off')) {
          variants.outline = child.id;
        } else if (name.includes('filled=on')) {
          variants.filled = child.id;
        }
      }
    }
  }
  
  return variants;
}

// Extract SVGs from Figma
async function extractIcons() {
  if (!FIGMA_TOKEN) {
    console.error('❌ FIGMA_TOKEN not set. Run with: FIGMA_TOKEN="your_token" node import-central-icons.js extract');
    process.exit(1);
  }

  console.log('🔍 Fetching icon data from Central Icon System...\n');
  
  // Create output directory
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  const nodeIds = ICON_FRAMES.map(f => f.frameId).join(',');
  
  // Fetch nodes data
  const url = `https://api.figma.com/v1/files/${SOURCE_FILE_KEY}/nodes?ids=${nodeIds}&geometry=paths`;
  console.log('📥 Fetching node data...');
  
  const nodesResponse = await httpsRequest(url, {
    'X-Figma-Token': FIGMA_TOKEN
  });

  if (nodesResponse.err) {
    console.error('❌ API Error:', nodesResponse.err);
    process.exit(1);
  }

  // Collect all variant IDs to export
  const exportIds = [];
  const iconMap = {};

  for (const iconDef of ICON_FRAMES) {
    const nodeData = nodesResponse.nodes[iconDef.frameId];
    if (!nodeData || !nodeData.document) {
      console.warn(`⚠️  Could not find frame for ${iconDef.name}`);
      continue;
    }

    const children = nodeData.document.children || [];
    const variants = findTargetVariants(children);

    if (variants.outline) {
      exportIds.push(variants.outline);
      iconMap[variants.outline] = { name: iconDef.name, variant: 'outline' };
    }
    if (variants.filled) {
      exportIds.push(variants.filled);
      iconMap[variants.filled] = { name: iconDef.name, variant: 'filled' };
    }

    console.log(`  ✓ ${iconDef.name}: outline=${variants.outline ? '✓' : '✗'}, filled=${variants.filled ? '✓' : '✗'}`);
  }

  console.log(`\n📤 Exporting ${exportIds.length} SVGs...`);

  // Export SVGs in batches
  const batchSize = 50;
  for (let i = 0; i < exportIds.length; i += batchSize) {
    const batch = exportIds.slice(i, i + batchSize);
    const exportUrl = `https://api.figma.com/v1/images/${SOURCE_FILE_KEY}?ids=${batch.join(',')}&format=svg`;
    
    const exportResponse = await httpsRequest(exportUrl, {
      'X-Figma-Token': FIGMA_TOKEN
    });

    if (exportResponse.err) {
      console.error(`❌ Export error:`, exportResponse.err);
      continue;
    }

    // Download each SVG
    for (const [nodeId, svgUrl] of Object.entries(exportResponse.images || {})) {
      if (!svgUrl) continue;
      
      const iconInfo = iconMap[nodeId];
      if (!iconInfo) continue;

      const filename = `${iconInfo.name}-${iconInfo.variant}.svg`;
      const filepath = path.join(ICONS_DIR, filename);

      // Download SVG
      const svgContent = await httpsRequest(svgUrl);
      fs.writeFileSync(filepath, svgContent);
      console.log(`  ✓ Downloaded ${filename}`);
    }

    await sleep(500); // Rate limiting
  }

  // Save manifest
  const manifest = {
    source: 'Central Icon System',
    fileKey: SOURCE_FILE_KEY,
    exportedAt: new Date().toISOString(),
    variant: TARGET_VARIANT,
    categories: CATEGORIES,
    icons: ICON_FRAMES.map(f => ({
      name: f.name,
      aliases: f.aliases || [],
      files: {
        outline: `${f.name}-outline.svg`,
        filled: `${f.name}-filled.svg`
      }
    }))
  };

  fs.writeFileSync(
    path.join(ICONS_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n✨ Extracted ${exportIds.length} icons to ${ICONS_DIR}`);
}

// Create icons in Figma
async function createIcons() {
  console.log('🎨 Creating Central Icon System icons in Figma...\n');

  // Load manifest
  const manifestPath = path.join(ICONS_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ Manifest not found. Run "extract" command first.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Navigate to Icons page
  console.log('📄 Navigating to Icons page...');
  await sendCommand('set_current_page', { pageId: '110:2' });
  await sleep(500);

  // Find the last y position on the page
  const children = await sendCommand('get_page_children', {});
  let startY = 4800; // Start below existing Material Icons
  
  if (children.success && children.data) {
    for (const child of children.data) {
      if (child.y + (child.height || 0) > startY - 100) {
        startY = child.y + (child.height || 0) + 100;
      }
    }
  }

  // Create section header
  console.log('📝 Creating section header...');
  const headerY = startY;
  
  await sendCommand('create_frame', {
    name: '🎯 Nectar Icons (Central Icon System)',
    x: -4460,
    y: headerY,
    width: 1200,
    height: 200,
    fills: [{ type: 'SOLID', color: { r: 0.14, g: 0.8, b: 0.58 } }]
  });

  await sendCommand('create_text', {
    text: 'Nectar Icons',
    x: -4420,
    y: headerY + 30,
    fontSize: 48,
    fontWeight: 'Bold'
  });

  await sendCommand('create_text', {
    text: `${manifest.icons.length} icons (2 variants: outline + filled) • Stroke: 1px • Radius: 3px • Join: Round`,
    x: -4420,
    y: headerY + 100,
    fontSize: 18,
    fontWeight: 'Regular'
  });

  await sleep(300);

  // Create icons by category
  let currentY = headerY + 250;
  
  for (const [category, iconNames] of Object.entries(CATEGORIES)) {
    console.log(`\n📁 Creating ${category} section...`);
    
    // Calculate section height based on icons
    const categoryIcons = manifest.icons.filter(i => iconNames.includes(i.name));
    const iconsPerRow = 8;
    const rows = Math.ceil(categoryIcons.length / iconsPerRow);
    const sectionHeight = 80 + (rows * 80);
    
    // Create category header
    await sendCommand('create_frame', {
      name: `🏷️ ${category}`,
      x: -4460,
      y: currentY,
      width: 1200,
      height: sectionHeight,
      fills: [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.96 } }]
    });

    await sendCommand('create_text', {
      text: `🏷️ ${category}`,
      x: -4436,
      y: currentY + 20,
      fontSize: 24,
      fontWeight: 'Bold'
    });

    let iconX = -4420;
    let iconY = currentY + 70;
    let iconsInRow = 0;

    // Batch create icons for this category
    const iconBatch = [];
    
    for (const iconDef of categoryIcons) {
      // Read SVG files
      const outlinePath = path.join(ICONS_DIR, iconDef.files.outline);
      const filledPath = path.join(ICONS_DIR, iconDef.files.filled);

      if (!fs.existsSync(outlinePath) || !fs.existsSync(filledPath)) {
        console.warn(`  ⚠️ Missing files for ${iconDef.name}`);
        continue;
      }

      const outlineSvg = fs.readFileSync(outlinePath, 'utf-8');
      const filledSvg = fs.readFileSync(filledPath, 'utf-8');

      // Add outline variant (using icon/name format for component usage)
      iconBatch.push({
        name: `icon/${iconDef.name}`,
        svg: outlineSvg,
        x: iconX,
        y: iconY
      });

      // Add filled variant next to it
      iconBatch.push({
        name: `icon/${iconDef.name}-filled`,
        svg: filledSvg,
        x: iconX + 32,
        y: iconY
      });

      iconX += 120;
      iconsInRow++;

      if (iconsInRow >= iconsPerRow) {
        iconX = -4420;
        iconY += 80;
        iconsInRow = 0;
      }
    }

    // Create icons in batch as COMPONENTS
    if (iconBatch.length > 0) {
      const response = await sendCommand('batch_create_icons_from_svg', {
        icons: iconBatch,
        createComponents: true  // Create as reusable components
      });
      
      if (response.success) {
        console.log(`  ✓ Created ${categoryIcons.length * 2} icons in ${category}`);
      } else {
        console.error(`  ✗ Error creating icons: ${response.error}`);
      }
    }

    await sleep(300);

    // Add labels for each icon
    iconX = -4420;
    iconY = currentY + 70;
    iconsInRow = 0;

    for (const iconDef of categoryIcons) {
      await sendCommand('create_text', {
        text: iconDef.name,
        x: iconX,
        y: iconY + 30,
        fontSize: 8,
        fontWeight: 'Regular'
      });

      iconX += 120;
      iconsInRow++;

      if (iconsInRow >= iconsPerRow) {
        iconX = -4420;
        iconY += 80;
        iconsInRow = 0;
      }
    }

    currentY += sectionHeight + 40;
    await sleep(200);
  }

  console.log('\n✨ Nectar Icons created successfully!');
  console.log(`\n📋 Icon naming convention:`);
  console.log(`   • icon/{name}        - Outline variant (default)`);
  console.log(`   • icon/{name}-filled - Filled variant`);
}

// Main
const command = process.argv[2];

if (command === 'extract') {
  extractIcons().catch(console.error);
} else if (command === 'create') {
  createIcons().catch(console.error);
} else {
  console.log(`
Central Icon System Import Script

Usage:
  FIGMA_TOKEN="your_token" node import-central-icons.js extract  - Download SVGs from Figma
  node import-central-icons.js create                            - Create icons in NDS Figma file

Environment:
  FIGMA_TOKEN - Your Figma personal access token (required for extract)
`);
}
