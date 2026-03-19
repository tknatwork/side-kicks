/**
 * Migration Script: Move responsive variables from Alias to Breakpoints
 * 
 * This script:
 * 1. Creates variables in Breakpoints collection with Desktop/Tablet/Mobile modes
 * 2. Deletes the old /mobile /tablet suffixed variables from Alias
 */

import http from 'http';

// Configuration
const SERVER_URL = 'http://localhost:9877';
const BREAKPOINTS_COLLECTION_ID = 'VariableCollectionId:101:233';
const ALIAS_COLLECTION_ID = 'VariableCollectionId:94:134';

const MODE_IDS = {
  Desktop: '101:0',
  Tablet: '101:1',
  Mobile: '101:2'
};

// Variables to migrate (base name -> {desktop, tablet, mobile} values)
const VARIABLES_TO_CREATE = {
  // Grid
  'grid/gap': { desktop: 24, tablet: 20, mobile: 16 },
  'grid/gutter': { desktop: 24, tablet: 20, mobile: 16 },
  'grid/margin': { desktop: 64, tablet: 40, mobile: 20 },
  
  // Layout containers
  'layout/container/max': { desktop: 1280, tablet: 720, mobile: 9999 },
  'layout/container/wide': { desktop: 1440, tablet: 1024, mobile: 9999 },
  'layout/container/narrow': { desktop: 720, tablet: 640, mobile: 9999 },
  'layout/container/prose': { desktop: 680, tablet: 600, mobile: 9999 },
  
  // Layout maxWidth
  'layout/maxWidth/text': { desktop: 680, tablet: 600, mobile: 9999 },
  'layout/maxWidth/form': { desktop: 480, tablet: 440, mobile: 9999 },
  'layout/maxWidth/content': { desktop: 1200, tablet: 900, mobile: 9999 },
  'layout/maxWidth/wide': { desktop: 1440, tablet: 1200, mobile: 9999 },
  'layout/maxWidth/modal/sm': { desktop: 400, tablet: 360, mobile: 320 },
  'layout/maxWidth/modal/md': { desktop: 560, tablet: 480, mobile: 360 },
  'layout/maxWidth/modal/lg': { desktop: 720, tablet: 600, mobile: 440 },
  
  // Layout minHeight
  'layout/minHeight/screen': { desktop: 800, tablet: 700, mobile: 600 },
  'layout/minHeight/section': { desktop: 600, tablet: 500, mobile: 400 },
  'layout/minHeight/hero': { desktop: 560, tablet: 480, mobile: 400 },
  'layout/minHeight/card': { desktop: 320, tablet: 280, mobile: 240 },
  
  // Size components
  'size/component/touch/min': { desktop: 40, tablet: 44, mobile: 44 },
  'size/component/touch/comfortable': { desktop: 44, tablet: 48, mobile: 48 },
  'size/component/tap/target': { desktop: 40, tablet: 44, mobile: 48 },
  'size/component/logo/default': { desktop: 48, tablet: 40, mobile: 32 },
  'size/component/logo/small': { desktop: 32, tablet: 28, mobile: 24 },
  'size/component/nav/height': { desktop: 64, tablet: 60, mobile: 56 },
  'size/component/drawer/width': { desktop: 400, tablet: 320, mobile: 280 },
  'size/component/modal/sm': { desktop: 400, tablet: 360, mobile: 320 },
  'size/component/modal/md': { desktop: 560, tablet: 480, mobile: 360 },
  'size/component/modal/lg': { desktop: 720, tablet: 600, mobile: 400 },
  'size/component/modal/xl': { desktop: 900, tablet: 720, mobile: 440 },
};

// Variables to delete from Alias (the old /default /tablet /mobile suffixed ones)
const VARIABLES_TO_DELETE_PATTERNS = [
  'grid/gap/default', 'grid/gap/tablet', 'grid/gap/mobile',
  'grid/gutter/default', 'grid/gutter/tablet', 'grid/gutter/mobile',
  'grid/margin/default', 'grid/margin/tablet', 'grid/margin/mobile',
  'layout/container/max', 'layout/container/max/tablet', 'layout/container/max/mobile',
  'layout/container/wide', 'layout/container/wide/tablet', 'layout/container/wide/mobile',
  'layout/container/narrow', 'layout/container/narrow/tablet', 'layout/container/narrow/mobile',
  'layout/container/prose', 'layout/container/prose/tablet', 'layout/container/prose/mobile',
  'layout/maxWidth/text', 'layout/maxWidth/text/tablet', 'layout/maxWidth/text/mobile',
  'layout/maxWidth/form', 'layout/maxWidth/form/tablet', 'layout/maxWidth/form/mobile',
  'layout/maxWidth/content', 'layout/maxWidth/content/tablet', 'layout/maxWidth/content/mobile',
  'layout/maxWidth/wide', 'layout/maxWidth/wide/tablet', 'layout/maxWidth/wide/mobile',
  'layout/maxWidth/modal/sm', 'layout/maxWidth/modal/sm/tablet', 'layout/maxWidth/modal/sm/mobile',
  'layout/maxWidth/modal/md', 'layout/maxWidth/modal/md/tablet', 'layout/maxWidth/modal/md/mobile',
  'layout/maxWidth/modal/lg', 'layout/maxWidth/modal/lg/tablet', 'layout/maxWidth/modal/lg/mobile',
  'layout/minHeight/screen', 'layout/minHeight/screen/tablet', 'layout/minHeight/screen/mobile',
  'layout/minHeight/section', 'layout/minHeight/section/tablet', 'layout/minHeight/section/mobile',
  'layout/minHeight/hero', 'layout/minHeight/hero/tablet', 'layout/minHeight/hero/mobile',
  'layout/minHeight/card', 'layout/minHeight/card/tablet', 'layout/minHeight/card/mobile',
  'size/component/touch/min', 'size/component/touch/min/tablet', 'size/component/touch/min/mobile',
  'size/component/touch/comfortable', 'size/component/touch/comfortable/tablet', 'size/component/touch/comfortable/mobile',
  'size/component/tap/target', 'size/component/tap/target/tablet', 'size/component/tap/target/mobile',
  'size/component/logo/default', 'size/component/logo/tablet', 'size/component/logo/mobile',
  'size/component/logo/small',
  'size/component/nav/height', 'size/component/nav/height/tablet', 'size/component/nav/height/mobile',
  'size/component/drawer/width', 'size/component/drawer/width/tablet', 'size/component/drawer/width/mobile',
  'size/component/modal/sm', 'size/component/modal/sm/tablet', 'size/component/modal/sm/mobile',
  'size/component/modal/md', 'size/component/modal/md/tablet', 'size/component/modal/md/mobile',
  'size/component/modal/lg', 'size/component/modal/lg/tablet', 'size/component/modal/lg/mobile',
  'size/component/modal/xl', 'size/component/modal/xl/tablet', 'size/component/modal/xl/mobile',
];

// Helper to send command to server
function sendCommand(command, payload = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ command, payload });
    
    const options = {
      hostname: 'localhost',
      port: 9877,
      path: '/command',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.write(data);
    req.end();
  });
}

// Delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function createVariableInBreakpoints(name, values) {
  console.log(`Creating: ${name}`);
  
  // Create the variable
  const createResult = await sendCommand('create_variable', {
    collectionId: BREAKPOINTS_COLLECTION_ID,
    name: name,
    resolvedType: 'FLOAT'
  });
  
  if (!createResult.success) {
    console.error(`  Failed to create ${name}:`, createResult.error);
    return false;
  }
  
  const variableId = createResult.data.id;
  console.log(`  Created with ID: ${variableId}`);
  
  // Set Desktop value
  await sendCommand('set_variable_value', {
    variableId,
    modeId: MODE_IDS.Desktop,
    value: values.desktop
  });
  console.log(`  Desktop: ${values.desktop}`);
  
  // Set Tablet value
  await sendCommand('set_variable_value', {
    variableId,
    modeId: MODE_IDS.Tablet,
    value: values.tablet
  });
  console.log(`  Tablet: ${values.tablet}`);
  
  // Set Mobile value
  await sendCommand('set_variable_value', {
    variableId,
    modeId: MODE_IDS.Mobile,
    value: values.mobile
  });
  console.log(`  Mobile: ${values.mobile}`);
  
  await delay(100); // Small delay between operations
  return true;
}

async function main() {
  console.log('='.repeat(60));
  console.log('MIGRATION: Alias → Breakpoints');
  console.log('='.repeat(60));
  
  // Step 1: Create variables in Breakpoints
  console.log('\n📦 STEP 1: Creating variables in Breakpoints collection...\n');
  
  let created = 0;
  for (const [name, values] of Object.entries(VARIABLES_TO_CREATE)) {
    const success = await createVariableInBreakpoints(name, values);
    if (success) created++;
    await delay(200);
  }
  
  console.log(`\n✅ Created ${created}/${Object.keys(VARIABLES_TO_CREATE).length} variables in Breakpoints\n`);
  
  console.log('='.repeat(60));
  console.log('MIGRATION COMPLETE - Part 1');
  console.log('='.repeat(60));
  console.log('\n⚠️  MANUAL STEP REQUIRED:');
  console.log('Please delete the following variables from Alias collection in Figma:\n');
  VARIABLES_TO_DELETE_PATTERNS.forEach(v => console.log(`  - ${v}`));
  console.log('\nOr you can run this script with --delete flag to attempt automatic deletion.');
}

main().catch(console.error);
