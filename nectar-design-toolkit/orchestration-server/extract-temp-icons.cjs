#!/usr/bin/env node
/**
 * Extract Icons from Temporary Icons Page
 * 
 * Extracts icons with stroke=1, radius=3, join=round variants
 * and creates standalone components on the Icons page with simplified naming:
 * - icon-name (for filled=off / outline)
 * - icon-name_filled (for filled=on / filled)
 * 
 * Usage:
 *   node extract-temp-icons.cjs scan      - Dry run to see what icons will be extracted
 *   node extract-temp-icons.cjs extract   - Actually extract and create icons (batch mode)
 *   node extract-temp-icons.cjs extract-category "Category Name" - Extract single category
 *   node extract-temp-icons.cjs children <frameId> - Get children of a frame
 */

const http = require('http');

// Configuration
const TEMP_ICONS_PAGE_ID = '138:478';
const ICONS_PAGE_ID = '110:2';
const STROKE_VARIABLE = 'fg/default';  // From Mapped collection

// Target variant specification
const TARGET_VARIANT = {
  stroke: '1',
  radius: '3',
  join: 'round'
};

// Helper: Send command to orchestration server
function sendCommand(command, payload, timeoutMs = 120000) {
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
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(data);
    req.end();
  });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Scan icons (dry run)
async function scanIcons() {
  console.log('📋 Scanning Temporary Icons page (dry run)...\n');
  console.log(`Source Page: ${TEMP_ICONS_PAGE_ID}`);
  console.log(`Target Variant: stroke=${TARGET_VARIANT.stroke}, radius=${TARGET_VARIANT.radius}, join=${TARGET_VARIANT.join}`);
  console.log(`Color Variable: ${STROKE_VARIABLE} (from Mapped collection)\n`);
  
  const result = await sendCommand('extract_temp_icons', {
    sourcePageId: TEMP_ICONS_PAGE_ID,
    targetPageId: ICONS_PAGE_ID,
    targetVariant: TARGET_VARIANT,
    bindStrokeVariable: STROKE_VARIABLE,
    organizeByCategory: true,
    dryRun: true
  });
  
  if (!result.success) {
    console.error('❌ Scan failed:', result.error);
    return;
  }
  
  const data = result.data;
  
  console.log('📊 Scan Results:');
  console.log(`   Icon frames scanned: ${data.scanned}`);
  console.log(`   Icons to extract: ${data.extracted}`);
  console.log('\n📁 Categories:');
  
  for (const cat of data.categories) {
    console.log(`   - ${cat.name}`);
  }
  
  console.log('\n🎯 Icons to be created:');
  
  // Group by variant type
  const outlineIcons = data.icons.filter(i => i.variant === 'outline');
  const filledIcons = data.icons.filter(i => i.variant === 'filled');
  
  console.log(`\n   Outline icons (${outlineIcons.length}):`);
  for (const icon of outlineIcons.slice(0, 20)) {
    console.log(`      ${icon.name}`);
  }
  if (outlineIcons.length > 20) {
    console.log(`      ... and ${outlineIcons.length - 20} more`);
  }
  
  console.log(`\n   Filled icons (${filledIcons.length}):`);
  for (const icon of filledIcons.slice(0, 20)) {
    console.log(`      ${icon.name}`);
  }
  if (filledIcons.length > 20) {
    console.log(`      ... and ${filledIcons.length - 20} more`);
  }
  
  if (data.errors.length > 0) {
    console.log('\n⚠️  Warnings:');
    for (const err of data.errors) {
      console.log(`   ${err}`);
    }
  }
  
  console.log('\n✅ Scan complete!');
  console.log(`\nTo extract icons, run: node extract-temp-icons.cjs extract`);
}

// Get category list
async function getCategoryList() {
  const result = await sendCommand('get_category_list', {
    sourcePageId: TEMP_ICONS_PAGE_ID
  });
  
  if (!result.success) {
    throw new Error(`Failed to get category list: ${result.error}`);
  }
  
  return result.data.categories;
}

// Extract a single category
async function extractSingleCategory(categoryName, categoryY) {
  console.log(`   📦 Extracting "${categoryName}"...`);
  
  const result = await sendCommand('extract_single_category', {
    categoryName,
    sourcePageId: TEMP_ICONS_PAGE_ID,
    targetPageId: ICONS_PAGE_ID,
    targetVariant: TARGET_VARIANT,
    bindStrokeVariable: STROKE_VARIABLE,
    spacing: 40,
    iconsPerRow: 20,
    categoryY
  }, 120000);  // 2 minute timeout per category
  
  if (!result.success) {
    console.error(`   ❌ Failed: ${result.error}`);
    return { success: false, error: result.error, icons: 0 };
  }
  
  const data = result.data;
  console.log(`   ✅ Created ${data.extracted} icons`);
  
  if (data.errors.length > 0) {
    for (const err of data.errors) {
      console.log(`   ⚠️  ${err}`);
    }
  }
  
  return { 
    success: true, 
    icons: data.extracted,
    categoryFrameId: data.categoryFrameId,
    errors: data.errors
  };
}

// Extract icons using batch processing (one category at a time)
async function extractIconsBatch() {
  console.log('🔄 Extracting icons from Temporary Icons page (batch mode)...\n');
  console.log(`Source Page: ${TEMP_ICONS_PAGE_ID}`);
  console.log(`Target Page: ${ICONS_PAGE_ID}`);
  console.log(`Color Variable: ${STROKE_VARIABLE} (from Mapped collection)`);
  console.log(`Target Variant: stroke=${TARGET_VARIANT.stroke}, radius=${TARGET_VARIANT.radius}, join=${TARGET_VARIANT.join}`);
  console.log(`Organization: By category frames\n`);
  
  // Step 1: Get category list
  console.log('📋 Getting category list...');
  const categories = await getCategoryList();
  console.log(`   Found ${categories.length} categories\n`);
  
  // Step 2: Process each category one at a time
  let totalIcons = 0;
  let processedCategories = 0;
  let failedCategories = [];
  let categoryY = 100;
  const categoryGap = 100;
  
  console.log('🏭 Processing categories one by one...\n');
  
  for (const cat of categories) {
    const result = await extractSingleCategory(cat.name, categoryY);
    
    if (result.success) {
      totalIcons += result.icons;
      processedCategories++;
      // Estimate next category Y based on icons (rough approximation)
      categoryY += 200 + Math.ceil(result.icons / 20) * 40;
    } else {
      failedCategories.push(cat.name);
    }
    
    // Small delay between categories to avoid overwhelming Figma
    await sleep(500);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Batch extraction complete!\n');
  console.log(`📊 Results:`);
  console.log(`   Categories processed: ${processedCategories}/${categories.length}`);
  console.log(`   Total icons created: ${totalIcons}`);
  
  if (failedCategories.length > 0) {
    console.log('\n❌ Failed categories:');
    for (const cat of failedCategories) {
      console.log(`   - ${cat}`);
    }
  }
  
  console.log(`\n🎉 Successfully created ${totalIcons} icon components!`);
}

// Extract a specific single category (for manual/retry use)
async function extractOneCategoryManual(categoryName) {
  console.log(`🔄 Extracting single category: "${categoryName}"\n`);
  console.log(`Target Page: ${ICONS_PAGE_ID}`);
  console.log(`Color Variable: ${STROKE_VARIABLE}`);
  console.log(`Target Variant: stroke=${TARGET_VARIANT.stroke}, radius=${TARGET_VARIANT.radius}, join=${TARGET_VARIANT.join}\n`);
  
  const result = await extractSingleCategory(categoryName, 100);
  
  if (result.success) {
    console.log(`\n✅ Successfully extracted ${result.icons} icons from "${categoryName}"`);
  } else {
    console.log(`\n❌ Failed to extract "${categoryName}"`);
  }
}

// Get children of a frame (for debugging)
async function getChildren(frameId) {
  console.log(`🔍 Getting children of frame: ${frameId}\n`);
  
  const result = await sendCommand('get_frame_children', { frameId });
  
  if (!result.success) {
    console.error('❌ Failed:', result.error);
    return;
  }
  
  console.log('Children:');
  for (const child of result.data.children) {
    console.log(`  - ${child.name} (${child.type}) [${child.id}]`);
  }
}

// Main function
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];
  
  switch (command) {
    case 'scan':
      await scanIcons();
      break;
    case 'extract':
      await extractIconsBatch();
      break;
    case 'extract-category':
      if (!arg) {
        console.error('Usage: node extract-temp-icons.cjs extract-category "Category Name"');
        process.exit(1);
      }
      await extractOneCategoryManual(arg);
      break;
    case 'list-categories':
      console.log('📋 Categories on Temporary Icons page:\n');
      const categories = await getCategoryList();
      for (const cat of categories) {
        console.log(`  - ${cat.name} (${cat.iconSetCount} icon sets)`);
      }
      console.log(`\n  Total: ${categories.length} categories`);
      break;
    case 'children':
      if (!arg) {
        console.error('Usage: node extract-temp-icons.cjs children <frameId>');
        process.exit(1);
      }
      await getChildren(arg);
      break;
    default:
      console.log(`
Extract Temporary Icons Script

This script extracts icons from the "Temporary Icons" page and creates 
standalone components on the "Icons" page with simplified naming:
  - icon-name (for outline icons with filled=off)
  - icon-name_filled (for filled icons with filled=on)

Only icons with stroke=1, radius=3, join=round are extracted.

Usage:
  node extract-temp-icons.cjs scan                        - Dry run to preview icons
  node extract-temp-icons.cjs extract                     - Extract all icons (batch mode)
  node extract-temp-icons.cjs extract-category "Name"     - Extract single category
  node extract-temp-icons.cjs list-categories             - List all categories
  node extract-temp-icons.cjs children <id>               - Debug: get children of a frame

Configuration (edit this script to change):
  Source Page: ${TEMP_ICONS_PAGE_ID}
  Target Page: ${ICONS_PAGE_ID}
  Stroke Variable: ${STROKE_VARIABLE}
`);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
