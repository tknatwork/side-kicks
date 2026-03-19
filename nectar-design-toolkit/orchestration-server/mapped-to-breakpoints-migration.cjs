#!/usr/bin/env node
/**
 * Mapped to Breakpoints Migration Script
 * 
 * Purpose: Move all FLOAT tokens from Mapped collection to Breakpoints collection
 * Architecture goal: Mapped = COLOR only, Breakpoints = ALL FLOAT tokens
 * 
 * Usage:
 *   node mapped-to-breakpoints-migration.js --step1   # Create variables in Breakpoints
 *   node mapped-to-breakpoints-migration.js --step2   # Delete variables from Mapped
 *   node mapped-to-breakpoints-migration.js --verify  # Verify migration
 */

const http = require('http');

const SERVER_URL = 'http://localhost:9877';

// Collection and Mode IDs
const MAPPED_COLLECTION_ID = 'VariableCollectionId:94:3';
const BREAKPOINTS_COLLECTION_ID = 'VariableCollectionId:101:233';
const ALIAS_COLLECTION_ID = 'VariableCollectionId:94:134';

const MAPPED_MODES = {
  light: '94:6',
  dark: '94:7'
};

const BREAKPOINTS_MODES = {
  desktop: '101:0',
  tablet: '101:1',
  mobile: '101:2'
};

const ALIAS_MODE = '94:8';

// Helper to send commands to the orchestration server
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
        'Content-Length': data.length
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
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

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Get all FLOAT variables from Mapped collection
async function getMappedFloatVars() {
  console.log('Fetching FLOAT variables from Mapped collection...');
  const result = await sendCommand('get_vars_detailed', { collectionId: MAPPED_COLLECTION_ID });
  if (!result.success) throw new Error('Failed to fetch Mapped variables');
  
  const floatVars = result.data.filter(v => v.resolvedType === 'FLOAT');
  console.log(`Found ${floatVars.length} FLOAT variables in Mapped`);
  return floatVars;
}

// Get Alias collection values to resolve aliases
async function getAliasValues() {
  console.log('Fetching Alias collection for value resolution...');
  const result = await sendCommand('get_vars_detailed', { collectionId: ALIAS_COLLECTION_ID });
  if (!result.success) throw new Error('Failed to fetch Alias variables');
  
  const valueMap = {};
  result.data.forEach(v => {
    const value = v.valuesByMode[ALIAS_MODE];
    // Only get direct values, not aliases
    if (typeof value === 'number') {
      valueMap[v.id] = value;
    }
  });
  console.log(`Resolved ${Object.keys(valueMap).length} Alias values`);
  return valueMap;
}

// Get existing Breakpoints variable names to avoid duplicates
async function getExistingBreakpointsVars() {
  console.log('Fetching existing Breakpoints variables...');
  const result = await sendCommand('get_vars_detailed', { collectionId: BREAKPOINTS_COLLECTION_ID });
  if (!result.success) throw new Error('Failed to fetch Breakpoints variables');
  
  const names = new Set(result.data.map(v => v.name));
  console.log(`Found ${names.size} existing variables in Breakpoints`);
  return names;
}

// Resolve variable value (handle aliases)
function resolveValue(valuesByMode, modeId, aliasValues) {
  const value = valuesByMode[modeId];
  if (typeof value === 'number') {
    return value;
  }
  if (value && value.type === 'VARIABLE_ALIAS' && value.id) {
    return aliasValues[value.id] || 0;
  }
  return 0;
}

// Step 1: Create variables in Breakpoints collection
async function step1CreateInBreakpoints() {
  console.log('\n=== STEP 1: Creating FLOAT variables in Breakpoints ===\n');
  
  const mappedFloatVars = await getMappedFloatVars();
  const aliasValues = await getAliasValues();
  const existingNames = await getExistingBreakpointsVars();
  
  // Filter out variables that already exist in Breakpoints
  const toCreate = mappedFloatVars.filter(v => !existingNames.has(v.name));
  const skipped = mappedFloatVars.filter(v => existingNames.has(v.name));
  
  console.log(`\nVariables to create: ${toCreate.length}`);
  console.log(`Already exist (skipping): ${skipped.length}`);
  
  if (skipped.length > 0) {
    console.log('\nSkipped (already in Breakpoints):');
    skipped.forEach(v => console.log(`  - ${v.name}`));
  }
  
  let created = 0;
  let failed = 0;
  
  for (const variable of toCreate) {
    // Resolve the value from Light mode (both modes should be same for static values)
    const resolvedValue = resolveValue(variable.valuesByMode, MAPPED_MODES.light, aliasValues);
    
    console.log(`\nCreating: ${variable.name} (value: ${resolvedValue})`);
    
    try {
      // Create the variable in Breakpoints
      const createResult = await sendCommand('create_variable', {
        collectionId: BREAKPOINTS_COLLECTION_ID,
        name: variable.name,
        resolvedType: 'FLOAT'
      });
      
      if (!createResult.success) {
        console.log(`  ❌ Failed to create: ${createResult.error}`);
        failed++;
        continue;
      }
      
      const newVarId = createResult.data.id;
      console.log(`  ✓ Created with ID: ${newVarId}`);
      
      // Set value for all 3 modes (same value since these are static)
      for (const [modeName, modeId] of Object.entries(BREAKPOINTS_MODES)) {
        const setResult = await sendCommand('set_variable_value', {
          variableId: newVarId,
          modeId: modeId,
          value: resolvedValue
        });
        
        if (!setResult.success) {
          console.log(`  ⚠ Failed to set ${modeName} value: ${setResult.error}`);
        } else {
          console.log(`  ✓ Set ${modeName} = ${resolvedValue}`);
        }
        await sleep(100);
      }
      
      // Set scopes if available
      if (variable.scopes && variable.scopes.length > 0) {
        const scopeResult = await sendCommand('set_variable_scopes', {
          variableId: newVarId,
          scopes: variable.scopes
        });
        if (scopeResult.success) {
          console.log(`  ✓ Set scopes: ${variable.scopes.join(', ')}`);
        }
        await sleep(100);
      }
      
      created++;
      await sleep(200);
      
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      failed++;
    }
  }
  
  console.log('\n=== STEP 1 COMPLETE ===');
  console.log(`Created: ${created}`);
  console.log(`Skipped (existing): ${skipped.length}`);
  console.log(`Failed: ${failed}`);
  console.log(`\nNext: Run --step2 to delete FLOAT variables from Mapped`);
}

// Step 2: Delete FLOAT variables from Mapped collection
async function step2DeleteFromMapped() {
  console.log('\n=== STEP 2: Deleting FLOAT variables from Mapped ===\n');
  
  const mappedFloatVars = await getMappedFloatVars();
  
  console.log(`Found ${mappedFloatVars.length} FLOAT variables to delete from Mapped`);
  
  let deleted = 0;
  let failed = 0;
  
  for (const variable of mappedFloatVars) {
    console.log(`Deleting: ${variable.name} (${variable.id})`);
    
    try {
      const result = await sendCommand('delete_variable', {
        variableId: variable.id
      });
      
      if (result.success) {
        console.log(`  ✓ Deleted`);
        deleted++;
      } else {
        console.log(`  ❌ Failed: ${result.error}`);
        failed++;
      }
      
      await sleep(150);
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      failed++;
    }
  }
  
  console.log('\n=== STEP 2 COMPLETE ===');
  console.log(`Deleted: ${deleted}`);
  console.log(`Failed: ${failed}`);
}

// Verify migration
async function verify() {
  console.log('\n=== VERIFYING MIGRATION ===\n');
  
  // Check Mapped collection
  const mappedResult = await sendCommand('get_vars_detailed', { collectionId: MAPPED_COLLECTION_ID });
  if (!mappedResult.success) throw new Error('Failed to fetch Mapped variables');
  
  const mappedFloats = mappedResult.data.filter(v => v.resolvedType === 'FLOAT');
  const mappedColors = mappedResult.data.filter(v => v.resolvedType === 'COLOR');
  
  console.log('MAPPED Collection:');
  console.log(`  Total: ${mappedResult.data.length}`);
  console.log(`  COLOR: ${mappedColors.length}`);
  console.log(`  FLOAT: ${mappedFloats.length}`);
  
  if (mappedFloats.length > 0) {
    console.log('\n  ⚠ Remaining FLOAT variables:');
    mappedFloats.forEach(v => console.log(`    - ${v.name}`));
  } else {
    console.log('  ✓ No FLOAT variables (as expected)');
  }
  
  // Check Breakpoints collection
  const breakpointsResult = await sendCommand('get_vars_detailed', { collectionId: BREAKPOINTS_COLLECTION_ID });
  if (!breakpointsResult.success) throw new Error('Failed to fetch Breakpoints variables');
  
  const breakpointsFloats = breakpointsResult.data.filter(v => v.resolvedType === 'FLOAT');
  const breakpointsStrings = breakpointsResult.data.filter(v => v.resolvedType === 'STRING');
  
  console.log('\nBREAKPOINTS Collection:');
  console.log(`  Total: ${breakpointsResult.data.length}`);
  console.log(`  FLOAT: ${breakpointsFloats.length}`);
  console.log(`  STRING: ${breakpointsStrings.length}`);
  
  console.log('\n=== ARCHITECTURE SUMMARY ===');
  console.log(`Mapped: ${mappedColors.length} COLOR tokens (Light/Dark modes)`);
  console.log(`Breakpoints: ${breakpointsFloats.length} FLOAT tokens (Desktop/Tablet/Mobile modes)`);
  
  if (mappedFloats.length === 0) {
    console.log('\n✅ Migration verified! Clean architecture achieved.');
  } else {
    console.log('\n⚠ Migration incomplete. Run --step2 to delete remaining FLOAT vars from Mapped.');
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--step1')) {
    await step1CreateInBreakpoints();
  } else if (args.includes('--step2')) {
    await step2DeleteFromMapped();
  } else if (args.includes('--verify')) {
    await verify();
  } else {
    console.log('Mapped → Breakpoints Migration Script');
    console.log('=====================================');
    console.log('');
    console.log('This script moves all FLOAT tokens from Mapped to Breakpoints collection.');
    console.log('');
    console.log('Architecture goal:');
    console.log('  - Mapped = COLOR tokens only (Light/Dark modes)');
    console.log('  - Breakpoints = ALL FLOAT tokens (Desktop/Tablet/Mobile modes)');
    console.log('');
    console.log('Usage:');
    console.log('  node mapped-to-breakpoints-migration.js --step1   # Create in Breakpoints');
    console.log('  node mapped-to-breakpoints-migration.js --step2   # Delete from Mapped');
    console.log('  node mapped-to-breakpoints-migration.js --verify  # Verify migration');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
