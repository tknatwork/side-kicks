/**
 * Nectar Design Kit - Full Setup Script
 * 
 * This orchestration script builds the complete Nectar Design Kit by:
 * 1. Setting up the Figma file page structure
 * 2. Importing NDS variable collections (Brand, Alias, Mapped, Breakpoints)
 * 3. Importing icons from Central Icon System
 * 4. Importing NDS styles (Paint, Text, Effect)
 * 5. Creating foundation pages with proper layouts
 * 
 * Prerequisites:
 *   - Orchestration server running (npm start)
 *   - Figma plugin connected
 *   - Target Figma file open
 * 
 * Usage:
 *   node build-nectar-design-kit.js [step]
 * 
 * Steps:
 *   all       - Run all steps (default)
 *   check     - Check connection and file status
 *   pages     - Create page structure
 *   variables - Import variable collections
 *   icons     - Import icons
 *   styles    - Import styles
 *   report    - Generate status report
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

const PLUGIN_SERVER_URL = 'http://localhost:9877';

// URL allowlist (defense against CodeQL js/file-access-to-http).
// Only loopback addresses on the orchestration port are allowed.
function assertSafeUrl(url) {
  const allowed = /^http:\/\/(localhost|127(?:\.\d{1,3}){3}|\[::1\]):\d{1,5}(\/.*)?$/;
  if (!allowed.test(url)) {
    throw new Error(`Refused outbound request to non-loopback URL: ${url}`);
  }
}
const ICONS_DIR = path.join(__dirname, 'central-icons');
const NDS_SOURCE_FILE_KEY = process.env.NDS_FILE_KEY || ''; // Source NDS file for variables/styles

// Page structure for Nectar Design Kit (based on M3 structure, adapted for NDS)
const PAGE_STRUCTURE = [
  { name: '◆ Cover', emoji: '◆', type: 'cover' },
  { name: '📖 Getting Started', emoji: '📖', type: 'docs' },
  { name: '🎨 Foundations', emoji: '🎨', type: 'section', children: [
    '🎨 Color',
    '✏️ Typography', 
    '📐 Spacing',
    '💫 Effects',
    '🖼️ Icons',
    '📱 Responsive'
  ]},
  { name: '🧩 Components', emoji: '🧩', type: 'section', children: [
    '🔘 Buttons',
    '📝 Inputs',
    '🏷️ Labels & Badges',
    '📋 Cards',
    '🗂️ Navigation',
    '💬 Dialogs & Modals',
    '📊 Data Display',
    '⏳ Feedback'
  ]},
  { name: '📐 Patterns', emoji: '📐', type: 'section', children: [
    '📄 Page Layouts',
    '📝 Forms',
    '📋 Lists & Tables',
    '🔄 Loading States'
  ]},
  { name: '💡 Examples', emoji: '💡', type: 'section' },
  { name: '📚 Reference', emoji: '📚', type: 'section' }
];

// Variable collections structure
const VARIABLE_COLLECTIONS = {
  'Brand': { hidden: true, modes: ['Default'], priority: 1 },
  'Alias': { hidden: true, modes: ['Light', 'Dark'], priority: 2 },
  'Mapped': { hidden: false, modes: ['Light', 'Dark'], priority: 3 },
  'Breakpoints': { hidden: false, modes: ['Desktop', 'Tablet', 'Mobile'], priority: 4 }
};

// Neo-brutalist effect styles
const EFFECT_STYLES = [
  { name: 'shadow/elevation-1', blur: 0, x: 2, y: 2, color: '#000000' },
  { name: 'shadow/elevation-2', blur: 0, x: 4, y: 4, color: '#000000' },
  { name: 'shadow/elevation-3', blur: 0, x: 6, y: 6, color: '#000000' },
  { name: 'shadow/elevation-4', blur: 0, x: 8, y: 8, color: '#000000' },
  { name: 'shadow/elevation-5', blur: 0, x: 10, y: 10, color: '#000000' }
];

// ============================================================================
// LOGGING & UTILITIES
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(level, message, data = null) {
  const icons = {
    info: `${colors.blue}ℹ${colors.reset}`,
    success: `${colors.green}✅${colors.reset}`,
    warn: `${colors.yellow}⚠️${colors.reset}`,
    error: `${colors.red}❌${colors.reset}`,
    step: `${colors.magenta}▸${colors.reset}`,
    substep: `${colors.cyan}  •${colors.reset}`,
    header: `${colors.bold}${colors.magenta}`,
  };
  
  if (level === 'header') {
    console.log(`\n${icons.header}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${icons.header}  ${message}${colors.reset}`);
    console.log(`${icons.header}${'═'.repeat(60)}${colors.reset}\n`);
    return;
  }
  
  const icon = icons[level] || icons.info;
  console.log(`${icon} ${message}`);
  if (data && process.env.DEBUG) {
    console.log(`   ${colors.dim}${JSON.stringify(data, null, 2).slice(0, 500)}${colors.reset}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// API HELPERS
// ============================================================================

async function sendCommand(command, payload = {}) {
  try {
    const url = `${PLUGIN_SERVER_URL}/command`;
    assertSafeUrl(url);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, payload })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Command failed');
    }
    
    return data.data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Orchestration server not running. Start with: npm start');
    }
    throw error;
  }
}

async function checkConnection() {
  try {
    const url = `${PLUGIN_SERVER_URL}/status`;
    assertSafeUrl(url);
    const response = await fetch(url);
    const status = await response.json();
    return status;
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

// ============================================================================
// STEP 1: CHECK CONNECTION
// ============================================================================

async function stepCheck() {
  log('header', '🔍 CHECKING CONNECTION');
  
  const status = await checkConnection();
  
  if (!status.connected) {
    log('error', 'Plugin not connected');
    log('info', 'Please ensure:');
    log('substep', '1. Figma file is open');
    log('substep', '2. Nectar DS Builder plugin is running');
    log('substep', '3. Orchestration server is started (npm start)');
    return false;
  }
  
  log('success', `Connected to: ${status.fileInfo?.name || 'Unknown file'}`);
  log('info', `Current page: ${status.fileInfo?.currentPage || 'Unknown'}`);
  log('info', `Connection type: ${status.connectionType}`);
  log('info', `WebSocket state: ${status.wsState}`);
  
  // Get more details
  try {
    const fileInfo = await sendCommand('get_file_info');
    log('success', 'File info retrieved');
    log('substep', `File ID: ${fileInfo.id || 'N/A'}`);
    log('substep', `Page count: ${fileInfo.pageCount || 'N/A'}`);
  } catch (error) {
    log('warn', `Could not get file info: ${error.message}`);
  }
  
  return true;
}

// ============================================================================
// STEP 2: CREATE PAGE STRUCTURE
// ============================================================================

async function stepPages() {
  log('header', '📄 CREATING PAGE STRUCTURE');
  
  try {
    // Get existing pages
    const pages = await sendCommand('get_pages');
    log('info', `Found ${pages.length} existing pages`);
    
    const existingNames = pages.map(p => p.name);
    const pagesToCreate = [];
    
    // Flatten page structure
    function collectPages(items, depth = 0) {
      for (const item of items) {
        if (typeof item === 'string') {
          pagesToCreate.push({ name: item, depth });
        } else if (item.children) {
          pagesToCreate.push({ name: item.name, depth, isSection: true });
          collectPages(item.children, depth + 1);
        } else {
          pagesToCreate.push({ name: item.name, depth });
        }
      }
    }
    
    collectPages(PAGE_STRUCTURE);
    
    let created = 0;
    let skipped = 0;
    
    for (const page of pagesToCreate) {
      if (existingNames.includes(page.name)) {
        log('substep', `Skipping (exists): ${page.name}`);
        skipped++;
        continue;
      }
      
      try {
        await sendCommand('create_page', { name: page.name });
        log('success', `Created: ${page.name}`);
        created++;
        await sleep(100); // Rate limiting
      } catch (error) {
        log('error', `Failed to create ${page.name}: ${error.message}`);
      }
    }
    
    log('success', `Page structure complete: ${created} created, ${skipped} skipped`);
    return true;
    
  } catch (error) {
    log('error', `Failed to create pages: ${error.message}`);
    return false;
  }
}

// ============================================================================
// STEP 3: IMPORT VARIABLES
// ============================================================================

async function stepVariables() {
  log('header', '🔧 IMPORTING VARIABLE COLLECTIONS');
  
  try {
    // Get existing collections
    const collections = await sendCommand('get_variable_collections');
    log('info', `Found ${collections.length} existing collections`);
    
    const existingNames = collections.map(c => c.name);
    
    for (const [name, config] of Object.entries(VARIABLE_COLLECTIONS)) {
      if (existingNames.includes(name)) {
        log('substep', `Collection exists: ${name}`);
        
        // Get variables in collection
        const collection = collections.find(c => c.name === name);
        if (collection) {
          try {
            const variables = await sendCommand('get_variables', { collectionId: collection.id });
            log('substep', `  → ${variables.length} variables`);
          } catch (e) {
            log('warn', `  → Could not count variables: ${e.message}`);
          }
        }
        continue;
      }
      
      log('step', `Creating collection: ${name}`);
      log('substep', `Modes: ${config.modes.join(', ')}`);
      log('substep', `Hidden: ${config.hidden}`);
      
      // Note: Creating full variable collections requires the source NDS file
      // For now, we'll just log what would be created
      log('warn', `Variable creation requires source file. Collection ${name} will need manual import.`);
    }
    
    // Check if we have the NDS source file key
    if (NDS_SOURCE_FILE_KEY) {
      log('info', 'NDS source file key provided - could sync variables from source');
      // TODO: Implement variable sync from source file
    } else {
      log('info', 'No NDS_FILE_KEY provided. Set environment variable for variable sync.');
      log('substep', 'Usage: NDS_FILE_KEY=your-file-key node build-nectar-design-kit.js variables');
    }
    
    return true;
    
  } catch (error) {
    log('error', `Failed to process variables: ${error.message}`);
    return false;
  }
}

// ============================================================================
// STEP 4: IMPORT ICONS
// ============================================================================

async function stepIcons() {
  log('header', '🖼️ IMPORTING ICONS');
  
  // Check if icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    log('error', `Icons directory not found: ${ICONS_DIR}`);
    log('info', 'Run: node import-icons.js extract');
    return false;
  }
  
  const svgFiles = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.svg'));
  log('info', `Found ${svgFiles.length} SVG files`);
  
  if (svgFiles.length === 0) {
    log('warn', 'No SVG files found. Skipping icon import.');
    return true;
  }
  
  try {
    // Try to navigate to Icons page
    const pages = await sendCommand('get_pages');
    const iconsPage = pages.find(p => p.name.includes('Icons'));
    
    if (iconsPage) {
      await sendCommand('set_current_page', { pageId: iconsPage.id });
      log('success', `Navigated to: ${iconsPage.name}`);
    } else {
      log('warn', 'Icons page not found, creating icons on current page');
    }
    
    // Get icon/default variable for stroke binding
    let strokeVariableId = null;
    try {
      const collections = await sendCommand('get_variable_collections');
      const mappedCollection = collections.find(c => c.name === 'Mapped');
      
      if (mappedCollection) {
        const variables = await sendCommand('get_variables', { collectionId: mappedCollection.id });
        const iconVar = variables.find(v => v.name === 'icon/default');
        if (iconVar) {
          strokeVariableId = iconVar.id;
          log('success', `Found icon/default variable: ${strokeVariableId}`);
        }
      }
    } catch (error) {
      log('warn', `Could not find icon variable: ${error.message}`);
    }
    
    // Prepare icons data for batch creation
    const iconsData = svgFiles.map(file => {
      const svg = fs.readFileSync(path.join(ICONS_DIR, file), 'utf-8');
      const name = file.replace('.svg', '');
      return { name, svg };
    });
    
    log('info', `Prepared ${iconsData.length} icons for batch import`);
    
    // Use batch_create_icons_from_svg command
    let processed = 0;
    let failed = 0;
    const batchSize = 10;
    
    for (let i = 0; i < iconsData.length; i += batchSize) {
      const batch = iconsData.slice(i, i + batchSize);
      
      try {
        const result = await sendCommand('batch_create_icons_from_svg', {
          icons: batch,
          strokeVariableId
        });
        processed += batch.length;
        log('substep', `Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} icons created`);
      } catch (error) {
        // Fallback to individual creation with create_from_svg
        log('warn', `Batch failed, trying individual: ${error.message}`);
        for (const icon of batch) {
          try {
            await sendCommand('create_from_svg', {
              name: icon.name,
              svg: icon.svg,
              createComponent: true
            });
            processed++;
            log('substep', `Created: ${icon.name}`);
          } catch (err) {
            failed++;
            log('error', `Failed: ${icon.name} - ${err.message}`);
          }
        }
      }
      
      // Progress update
      log('info', `Progress: ${Math.min(i + batchSize, iconsData.length)}/${iconsData.length} icons`);
      await sleep(300); // Rate limiting between batches
    }
    
    log('success', `Icons complete: ${processed} created, ${failed} failed`);
    return true;
    
  } catch (error) {
    log('error', `Failed to import icons: ${error.message}`);
    return false;
  }
}

// ============================================================================
// STEP 5: IMPORT STYLES
// ============================================================================

async function stepStyles() {
  log('header', '🎨 IMPORTING STYLES');
  
  try {
    // Get existing styles
    const stylesResponse = await sendCommand('get_local_styles');
    
    // Handle different response formats
    const paintStyles = Array.isArray(stylesResponse) 
      ? stylesResponse.filter(s => s.type === 'PAINT') 
      : (stylesResponse?.paintStyles || []);
    const textStyles = Array.isArray(stylesResponse) 
      ? stylesResponse.filter(s => s.type === 'TEXT') 
      : (stylesResponse?.textStyles || []);
    const effectStyles = Array.isArray(stylesResponse) 
      ? stylesResponse.filter(s => s.type === 'EFFECT') 
      : (stylesResponse?.effectStyles || []);
    
    log('info', `Found ${paintStyles.length} paint, ${textStyles.length} text, ${effectStyles.length} effect styles`);
    
    // Check for neo-brutalist effect styles
    log('step', 'Checking effect styles...');
    log('substep', `Found ${effectStyles.length} effect styles`);
    
    // Create missing neo-brutalist shadows
    for (const shadow of EFFECT_STYLES) {
      const exists = effectStyles.some(s => s.name === shadow.name || s.name === `🍯 ${shadow.name}`);
      if (exists) {
        log('substep', `Style exists: ${shadow.name}`);
        continue;
      }
      
      try {
        await sendCommand('create_effect_style', {
          name: shadow.name,
          effects: [{
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 1 },
            offset: { x: shadow.x, y: shadow.y },
            radius: shadow.blur,
            spread: 0,
            visible: true,
            blendMode: 'NORMAL'
          }]
        });
        log('success', `Created: ${shadow.name}`);
      } catch (error) {
        log('warn', `Could not create ${shadow.name}: ${error.message}`);
      }
    }
    
    // Report on text styles
    log('step', `Text styles: ${textStyles.length}`);
    
    // Report on paint styles
    log('step', `Paint styles: ${paintStyles.length}`);
    
    return true;
    
  } catch (error) {
    log('error', `Failed to process styles: ${error.message}`);
    return false;
  }
}

// ============================================================================
// STEP 6: GENERATE REPORT
// ============================================================================

async function stepReport() {
  log('header', '📊 GENERATING REPORT');
  
  const report = {
    timestamp: new Date().toISOString(),
    file: null,
    pages: [],
    collections: [],
    styles: { paint: 0, text: 0, effect: 0 },
    icons: 0
  };
  
  try {
    // Get file info
    const status = await checkConnection();
    report.file = status.fileInfo;
    
    // Get pages
    const pages = await sendCommand('get_pages');
    report.pages = pages.map(p => p.name);
    log('info', `Pages: ${pages.length}`);
    
    // Get collections
    const collections = await sendCommand('get_variable_collections');
    for (const col of collections) {
      try {
        const variables = await sendCommand('get_variables', { collectionId: col.id });
        report.collections.push({
          name: col.name,
          variables: variables.length,
          modes: col.modes?.length || 1
        });
        log('substep', `${col.name}: ${variables.length} variables`);
      } catch (e) {
        report.collections.push({ name: col.name, variables: 'unknown' });
      }
    }
    
    // Get styles
    const stylesResponse = await sendCommand('get_local_styles');
    
    // Handle different response formats
    if (Array.isArray(stylesResponse)) {
      report.styles.paint = stylesResponse.filter(s => s.type === 'PAINT').length;
      report.styles.text = stylesResponse.filter(s => s.type === 'TEXT').length;
      report.styles.effect = stylesResponse.filter(s => s.type === 'EFFECT').length;
    } else if (stylesResponse && typeof stylesResponse === 'object') {
      report.styles.paint = stylesResponse.paintStyles?.length || 0;
      report.styles.text = stylesResponse.textStyles?.length || 0;
      report.styles.effect = stylesResponse.effectStyles?.length || 0;
    }
    log('info', `Styles: ${report.styles.paint} paint, ${report.styles.text} text, ${report.styles.effect} effect`);
    
    // Count local SVG icons
    if (fs.existsSync(ICONS_DIR)) {
      report.icons = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.svg')).length;
    }
    log('info', `Local icons: ${report.icons}`);
    
    // Summary
    console.log('\n');
    log('header', '📋 NECTAR DESIGN KIT STATUS');
    console.log(`
${colors.cyan}File:${colors.reset} ${report.file?.name || 'Unknown'}
${colors.cyan}Pages:${colors.reset} ${report.pages.length}
${colors.cyan}Collections:${colors.reset} ${report.collections.length}
${colors.cyan}Variables:${colors.reset} ${report.collections.reduce((sum, c) => sum + (typeof c.variables === 'number' ? c.variables : 0), 0)}
${colors.cyan}Styles:${colors.reset} ${report.styles.paint + report.styles.text + report.styles.effect}
${colors.cyan}Icons (local):${colors.reset} ${report.icons}
`);
    
    // Save report.
    // Path is fixed (hardcoded filename joined under __dirname) so it
    // cannot escape the project. JSON.stringify escapes control bytes
    // in any network-derived strings (defense against
    // CodeQL js/http-to-file-access). Cap serialized size at 8 MiB so
    // a runaway aggregate cannot fill the disk.
    const reportPath = path.join(__dirname, 'nectar-kit-report.json');
    const reportJson = JSON.stringify(report, null, 2);
    if (reportJson.length > 8 * 1024 * 1024) {
      throw new Error(`Refused report write: serialized size exceeds 8 MiB`);
    }
    fs.writeFileSync(reportPath, reportJson);
    log('success', `Report saved to: ${reportPath}`);
    
    return true;
    
  } catch (error) {
    log('error', `Failed to generate report: ${error.message}`);
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const step = args[0] || 'all';
  
  console.log(`
${colors.bold}${colors.magenta}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║            🍯 NECTAR DESIGN KIT BUILDER                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);
  
  log('info', `Running step: ${step}`);
  log('info', `Server URL: ${PLUGIN_SERVER_URL}`);
  
  // Always check connection first
  const connected = await stepCheck();
  if (!connected && step !== 'check') {
    log('error', 'Cannot proceed without plugin connection');
    process.exit(1);
  }
  
  // Run requested step(s)
  const steps = {
    'check': async () => true, // Already done
    'pages': stepPages,
    'variables': stepVariables,
    'icons': stepIcons,
    'styles': stepStyles,
    'report': stepReport,
    'all': async () => {
      const results = [];
      results.push(await stepPages());
      results.push(await stepVariables());
      results.push(await stepIcons());
      results.push(await stepStyles());
      results.push(await stepReport());
      return results.every(r => r);
    }
  };
  
  if (steps[step]) {
    const success = await steps[step]();
    
    console.log('\n');
    if (success) {
      log('success', `Step '${step}' completed successfully!`);
    } else {
      log('error', `Step '${step}' completed with errors`);
      process.exit(1);
    }
  } else {
    log('error', `Unknown step: ${step}`);
    console.log('\nAvailable steps:');
    Object.keys(steps).forEach(s => console.log(`  - ${s}`));
    process.exit(1);
  }
}

main().catch(error => {
  log('error', `Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
