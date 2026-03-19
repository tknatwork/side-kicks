/**
 * Mobile-First Migration Script
 * 
 * Architecture Change:
 * - Alias: Contains ONLY mobile base values (no /mobile, /tablet, /desktop suffixes)
 * - Breakpoints: Mobile mode aliases to Alias, Tablet/Desktop have direct FLOAT values
 * 
 * Migration Steps:
 * 1. Update Alias base variables with current mobile values
 * 2. Update Breakpoints modes with correct values (Mobile=alias, Tablet/Desktop=direct)
 * 3. Delete redundant /mobile, /tablet suffixed variables from Alias
 */

const ORCHESTRATION_URL = 'http://localhost:9877/command';

// Collection IDs
const ALIAS_COLLECTION_ID = 'VariableCollectionId:94:134';
const BREAKPOINTS_COLLECTION_ID = 'VariableCollectionId:101:233';
const ALIAS_MODE_ID = '94:8';
const BREAKPOINTS_MODES = {
  desktop: '101:0',
  tablet: '101:1',
  mobile: '101:2'
};

// Migration data extracted from current state
// Format: { baseName: { desktop: value, tablet: value, mobile: value } }
const RESPONSIVE_VALUES = {
  // Layout/Container
  'layout/container/max': { desktop: 1280, tablet: 720, mobile: 9999 },
  'layout/container/narrow': { desktop: 720, tablet: 640, mobile: 9999 },
  'layout/container/prose': { desktop: 680, tablet: 600, mobile: 9999 },
  'layout/container/wide': { desktop: 1440, tablet: 1024, mobile: 9999 },
  
  // Layout/MaxWidth
  'layout/maxWidth/content': { desktop: 1200, tablet: 900, mobile: 9999 },
  'layout/maxWidth/form': { desktop: 480, tablet: 440, mobile: 9999 },
  'layout/maxWidth/modal/lg': { desktop: 720, tablet: 600, mobile: 440 },
  'layout/maxWidth/modal/md': { desktop: 560, tablet: 480, mobile: 360 },
  'layout/maxWidth/modal/sm': { desktop: 400, tablet: 360, mobile: 320 },
  'layout/maxWidth/text': { desktop: 680, tablet: 600, mobile: 9999 },
  'layout/maxWidth/wide': { desktop: 1440, tablet: 1200, mobile: 9999 },
  
  // Layout/MinHeight
  'layout/minHeight/card': { desktop: 320, tablet: 280, mobile: 240 },
  'layout/minHeight/hero': { desktop: 560, tablet: 480, mobile: 400 },
  'layout/minHeight/screen': { desktop: 800, tablet: 700, mobile: 600 },
  'layout/minHeight/section': { desktop: 600, tablet: 500, mobile: 400 },
  
  // Grid
  'grid/gap': { desktop: 24, tablet: 20, mobile: 16 },
  'grid/gutter': { desktop: 24, tablet: 20, mobile: 16 },
  'grid/margin': { desktop: 64, tablet: 40, mobile: 20 },
  
  // Size/Component
  'size/component/drawer/width': { desktop: 400, tablet: 320, mobile: 280 },
  'size/component/logo': { desktop: 48, tablet: 40, mobile: 32 }, // Note: base is 'logo/default'
  'size/component/modal/lg': { desktop: 720, tablet: 600, mobile: 400 },
  'size/component/modal/md': { desktop: 560, tablet: 480, mobile: 360 },
  'size/component/modal/sm': { desktop: 400, tablet: 360, mobile: 320 },
  'size/component/modal/xl': { desktop: 900, tablet: 720, mobile: 440 },
  'size/component/nav/height': { desktop: 64, tablet: 60, mobile: 56 },
  'size/component/tap/target': { desktop: 40, tablet: 44, mobile: 48 },
  'size/component/touch/comfortable': { desktop: 44, tablet: 48, mobile: 48 },
  'size/component/touch/min': { desktop: 40, tablet: 44, mobile: 44 },
};

// Variable IDs for deletion (suffixed variables in Alias)
const VARIABLES_TO_DELETE = [
  // Container
  'VariableID:104:449', // layout/container/max/mobile
  'VariableID:104:418', // layout/container/max/tablet
  'VariableID:104:451', // layout/container/narrow/mobile
  'VariableID:104:420', // layout/container/narrow/tablet
  'VariableID:104:452', // layout/container/prose/mobile
  'VariableID:104:421', // layout/container/prose/tablet
  'VariableID:104:450', // layout/container/wide/mobile
  'VariableID:104:419', // layout/container/wide/tablet
  
  // MaxWidth
  'VariableID:104:458', // layout/maxWidth/content/mobile
  'VariableID:104:427', // layout/maxWidth/content/tablet
  'VariableID:104:457', // layout/maxWidth/form/mobile
  'VariableID:104:426', // layout/maxWidth/form/tablet
  'VariableID:104:462', // layout/maxWidth/modal/lg/mobile
  'VariableID:104:431', // layout/maxWidth/modal/lg/tablet
  'VariableID:104:461', // layout/maxWidth/modal/md/mobile
  'VariableID:104:430', // layout/maxWidth/modal/md/tablet
  'VariableID:104:460', // layout/maxWidth/modal/sm/mobile
  'VariableID:104:429', // layout/maxWidth/modal/sm/tablet
  'VariableID:104:456', // layout/maxWidth/text/mobile
  'VariableID:104:425', // layout/maxWidth/text/tablet
  'VariableID:104:459', // layout/maxWidth/wide/mobile
  'VariableID:104:428', // layout/maxWidth/wide/tablet
  
  // MinHeight
  'VariableID:104:466', // layout/minHeight/card/mobile
  'VariableID:104:435', // layout/minHeight/card/tablet
  'VariableID:104:465', // layout/minHeight/hero/mobile
  'VariableID:104:434', // layout/minHeight/hero/tablet
  'VariableID:104:463', // layout/minHeight/screen/mobile
  'VariableID:104:432', // layout/minHeight/screen/tablet
  'VariableID:104:464', // layout/minHeight/section/mobile
  'VariableID:104:433', // layout/minHeight/section/tablet
  
  // Grid
  'VariableID:104:453', // grid/gap/mobile
  'VariableID:104:422', // grid/gap/tablet
  'VariableID:104:454', // grid/gutter/mobile
  'VariableID:104:423', // grid/gutter/tablet
  'VariableID:104:455', // grid/margin/mobile
  'VariableID:104:424', // grid/margin/tablet
  
  // Size/Component
  'VariableID:104:475', // size/component/drawer/width/mobile
  'VariableID:104:444', // size/component/drawer/width/tablet
  'VariableID:104:471', // size/component/logo/mobile
  'VariableID:104:440', // size/component/logo/tablet
  'VariableID:104:478', // size/component/modal/lg/mobile
  'VariableID:104:447', // size/component/modal/lg/tablet
  'VariableID:104:477', // size/component/modal/md/mobile
  'VariableID:104:446', // size/component/modal/md/tablet
  'VariableID:104:476', // size/component/modal/sm/mobile
  'VariableID:104:445', // size/component/modal/sm/tablet
  'VariableID:104:479', // size/component/modal/xl/mobile
  'VariableID:104:448', // size/component/modal/xl/tablet
  'VariableID:104:473', // size/component/nav/height/mobile
  'VariableID:104:442', // size/component/nav/height/tablet
  'VariableID:104:469', // size/component/tap/target/mobile
  'VariableID:104:438', // size/component/tap/target/tablet
  'VariableID:104:468', // size/component/touch/comfortable/mobile
  'VariableID:104:437', // size/component/touch/comfortable/tablet
  'VariableID:104:467', // size/component/touch/min/mobile
  'VariableID:104:436', // size/component/touch/min/tablet
];

// Base variable IDs in Alias (to update with mobile values)
const BASE_VARIABLE_IDS = {
  'layout/container/max': 'VariableID:103:386',
  'layout/container/narrow': 'VariableID:103:388',
  'layout/container/prose': 'VariableID:103:389',
  'layout/container/wide': 'VariableID:103:387',
  'layout/maxWidth/content': 'VariableID:103:396',
  'layout/maxWidth/form': 'VariableID:103:395',
  'layout/maxWidth/modal/lg': 'VariableID:103:400',
  'layout/maxWidth/modal/md': 'VariableID:103:399',
  'layout/maxWidth/modal/sm': 'VariableID:103:398',
  'layout/maxWidth/text': 'VariableID:103:394',
  'layout/maxWidth/wide': 'VariableID:103:397',
  'layout/minHeight/card': 'VariableID:103:404',
  'layout/minHeight/hero': 'VariableID:103:403',
  'layout/minHeight/screen': 'VariableID:103:401',
  'layout/minHeight/section': 'VariableID:103:402',
  'grid/gap': 'VariableID:103:391', // grid/gap/default
  'grid/gutter': 'VariableID:103:392', // grid/gutter/default
  'grid/margin': 'VariableID:103:393', // grid/margin/default
  'size/component/drawer/width': 'VariableID:103:413',
  'size/component/logo': 'VariableID:103:409', // size/component/logo/default
  'size/component/modal/lg': 'VariableID:103:416',
  'size/component/modal/md': 'VariableID:103:415',
  'size/component/modal/sm': 'VariableID:103:414',
  'size/component/modal/xl': 'VariableID:103:417',
  'size/component/nav/height': 'VariableID:103:411',
  'size/component/tap/target': 'VariableID:103:407',
  'size/component/touch/comfortable': 'VariableID:103:406',
  'size/component/touch/min': 'VariableID:103:405',
};

async function sendCommand(command, payload = {}) {
  const response = await fetch(ORCHESTRATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, payload })
  });
  return response.json();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateAliasBaseValues() {
  console.log('\n=== Step 1: Update Alias base variables with MOBILE values ===\n');
  
  for (const [baseName, values] of Object.entries(RESPONSIVE_VALUES)) {
    const variableId = BASE_VARIABLE_IDS[baseName];
    if (!variableId) {
      console.log(`⚠️  No ID found for ${baseName}, skipping...`);
      continue;
    }
    
    const mobileValue = values.mobile;
    console.log(`Updating ${baseName} → ${mobileValue} (mobile value)`);
    
    try {
      const result = await sendCommand('set_variable_value', {
        variableId,
        modeId: ALIAS_MODE_ID,
        value: mobileValue
      });
      
      if (result.success) {
        console.log(`  ✅ Updated`);
      } else {
        console.log(`  ❌ Failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }
    
    await sleep(100); // Rate limiting
  }
}

async function updateBreakpointsValues() {
  console.log('\n=== Step 2: Update Breakpoints with direct values ===\n');
  
  // First, get all Breakpoints variables to find their IDs
  const varsResult = await sendCommand('get_vars_detailed', {
    collectionId: BREAKPOINTS_COLLECTION_ID
  });
  
  if (!varsResult.data) {
    console.log('❌ Failed to get Breakpoints variables');
    return;
  }
  
  // Build a map of name → variableId
  const breakpointsVarMap = {};
  for (const v of varsResult.data) {
    breakpointsVarMap[v.name] = v.id;
  }
  
  // Map Alias names to Breakpoints variable IDs (pre-verified)
  const breakpointsMapping = {
    'layout/container/max': { name: 'container/max', id: 'VariableID:101:261' },
    'layout/container/narrow': { name: 'container/narrow', id: 'VariableID:101:263' },
    'layout/container/prose': { name: 'container/prose', id: 'VariableID:101:264' },
    'layout/container/wide': { name: 'container/wide', id: 'VariableID:101:262' },
    'layout/maxWidth/content': { name: 'maxWidth/content', id: 'VariableID:101:363' },
    'layout/maxWidth/form': { name: 'maxWidth/form', id: 'VariableID:101:359' },
    'layout/maxWidth/modal/lg': { name: 'maxWidth/modal/lg', id: 'VariableID:101:362' },
    'layout/maxWidth/modal/md': { name: 'maxWidth/modal/md', id: 'VariableID:101:361' },
    'layout/maxWidth/modal/sm': { name: 'maxWidth/modal/sm', id: 'VariableID:101:360' },
    'layout/maxWidth/text': { name: 'maxWidth/text', id: 'VariableID:101:358' },
    'layout/maxWidth/wide': { name: 'maxWidth/wide', id: 'VariableID:101:364' },
    'layout/minHeight/card': { name: 'minHeight/card', id: 'VariableID:101:368' },
    'layout/minHeight/hero': { name: 'minHeight/hero', id: 'VariableID:101:367' },
    'layout/minHeight/screen': { name: 'minHeight/screen', id: 'VariableID:101:365' },
    'layout/minHeight/section': { name: 'minHeight/section', id: 'VariableID:101:366' },
    'grid/gap': { name: 'grid/gap', id: 'VariableID:101:266' },
    'grid/gutter': { name: 'grid/gutter', id: 'VariableID:101:337' },
    'grid/margin': { name: 'grid/margin', id: 'VariableID:101:338' },
    'size/component/drawer/width': { name: 'size/drawer/width', id: 'VariableID:101:336' },
    'size/component/logo': { name: 'size/logo', id: 'VariableID:101:328' },
    'size/component/modal/lg': { name: 'size/modal/lg', id: 'VariableID:101:334' },
    'size/component/modal/md': { name: 'size/modal/md', id: 'VariableID:101:333' },
    'size/component/modal/sm': { name: 'size/modal/sm', id: 'VariableID:101:332' },
    'size/component/modal/xl': { name: 'size/modal/xl', id: 'VariableID:101:335' },
    'size/component/nav/height': { name: 'size/nav/height', id: 'VariableID:101:330' },
    'size/component/tap/target': { name: 'size/tap/target', id: 'VariableID:101:316' },
    'size/component/touch/comfortable': { name: 'size/touch/comfortable', id: 'VariableID:101:315' },
    'size/component/touch/min': { name: 'size/touch/min', id: 'VariableID:101:314' },
  };
  
  for (const [aliasName, values] of Object.entries(RESPONSIVE_VALUES)) {
    const mapping = breakpointsMapping[aliasName];
    if (!mapping) {
      console.log(`⚠️  No Breakpoints mapping for ${aliasName}`);
      continue;
    }
    
    const variableId = mapping.id;
    const aliasBaseId = BASE_VARIABLE_IDS[aliasName];
    
    console.log(`\nUpdating ${mapping.name}:`);
    
    // Mobile mode → Alias to base variable (which now has mobile value)
    if (aliasBaseId) {
      console.log(`  Mobile → alias to ${aliasName}`);
      try {
        const result = await sendCommand('set_variable_value', {
          variableId,
          modeId: BREAKPOINTS_MODES.mobile,
          value: { type: 'VARIABLE_ALIAS', id: aliasBaseId }
        });
        console.log(`    ${result.success ? '✅' : '❌'} ${result.error || ''}`);
      } catch (err) {
        console.log(`    ❌ Error: ${err.message}`);
      }
    }
    
    await sleep(100);
    
    // Tablet mode → Direct value
    console.log(`  Tablet → ${values.tablet} (direct value)`);
    try {
      const result = await sendCommand('set_variable_value', {
        variableId,
        modeId: BREAKPOINTS_MODES.tablet,
        value: values.tablet
      });
      console.log(`    ${result.success ? '✅' : '❌'} ${result.error || ''}`);
    } catch (err) {
      console.log(`    ❌ Error: ${err.message}`);
    }
    
    await sleep(100);
    
    // Desktop mode → Direct value
    console.log(`  Desktop → ${values.desktop} (direct value)`);
    try {
      const result = await sendCommand('set_variable_value', {
        variableId,
        modeId: BREAKPOINTS_MODES.desktop,
        value: values.desktop
      });
      console.log(`    ${result.success ? '✅' : '❌'} ${result.error || ''}`);
    } catch (err) {
      console.log(`    ❌ Error: ${err.message}`);
    }
    
    await sleep(100);
  }
}

async function deleteRedundantVariables() {
  console.log('\n=== Step 3: Delete redundant /mobile, /tablet variables from Alias ===\n');
  
  console.log(`Total variables to delete: ${VARIABLES_TO_DELETE.length}`);
  
  let deleted = 0;
  let failed = 0;
  
  for (const variableId of VARIABLES_TO_DELETE) {
    try {
      const result = await sendCommand('delete_variable', { variableId });
      if (result.success) {
        deleted++;
        process.stdout.write('.');
      } else {
        failed++;
        console.log(`\n❌ Failed to delete ${variableId}: ${result.error}`);
      }
    } catch (err) {
      failed++;
      console.log(`\n❌ Error deleting ${variableId}: ${err.message}`);
    }
    await sleep(50);
  }
  
  console.log(`\n\n✅ Deleted: ${deleted}, ❌ Failed: ${failed}`);
}

async function verifyMigration() {
  console.log('\n=== Step 4: Verify Migration ===\n');
  
  // Check Alias collection for any remaining /mobile, /tablet suffixes
  const aliasVars = await sendCommand('get_vars_detailed', {
    collectionId: ALIAS_COLLECTION_ID
  });
  
  const remainingSuffixed = aliasVars.data?.filter(v => 
    v.name.endsWith('/mobile') || v.name.endsWith('/tablet')
  ) || [];
  
  if (remainingSuffixed.length > 0) {
    console.log(`⚠️  Found ${remainingSuffixed.length} remaining suffixed variables:`);
    remainingSuffixed.forEach(v => console.log(`   - ${v.name}`));
  } else {
    console.log('✅ No /mobile or /tablet suffixed variables remain in Alias');
  }
  
  // Sample check of Breakpoints values
  console.log('\nSample verification of Breakpoints values:');
  const bpVars = await sendCommand('get_vars_detailed', {
    collectionId: BREAKPOINTS_COLLECTION_ID
  });
  
  const sample = bpVars.data?.find(v => v.name === 'container/max');
  if (sample) {
    console.log(`\ncontainer/max:`);
    console.log(`  Desktop: ${JSON.stringify(sample.valuesByMode[BREAKPOINTS_MODES.desktop])}`);
    console.log(`  Tablet: ${JSON.stringify(sample.valuesByMode[BREAKPOINTS_MODES.tablet])}`);
    console.log(`  Mobile: ${JSON.stringify(sample.valuesByMode[BREAKPOINTS_MODES.mobile])}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Mobile-First Migration for Nectar DS               ║');
  console.log('║                                                            ║');
  console.log('║  Alias: Base mobile values only                            ║');
  console.log('║  Breakpoints: Mobile→Alias, Tablet/Desktop→Direct values   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const args = process.argv.slice(2);
  
  if (args.includes('--step1')) {
    await updateAliasBaseValues();
  } else if (args.includes('--step2')) {
    await updateBreakpointsValues();
  } else if (args.includes('--step3')) {
    await deleteRedundantVariables();
  } else if (args.includes('--verify')) {
    await verifyMigration();
  } else if (args.includes('--all')) {
    await updateAliasBaseValues();
    await updateBreakpointsValues();
    await deleteRedundantVariables();
    await verifyMigration();
  } else {
    console.log('Usage:');
    console.log('  node mobile-first-migration.js --step1   # Update Alias base values to mobile');
    console.log('  node mobile-first-migration.js --step2   # Update Breakpoints values');
    console.log('  node mobile-first-migration.js --step3   # Delete redundant variables');
    console.log('  node mobile-first-migration.js --verify  # Verify migration');
    console.log('  node mobile-first-migration.js --all     # Run all steps');
    console.log('\n⚠️  Recommended: Run steps individually to verify each stage');
  }
}

main().catch(console.error);
