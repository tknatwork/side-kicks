const http = require('http');

const SERVER_URL = 'http://localhost:9877';
const BREAKPOINTS_COLLECTION_ID = 'VariableCollectionId:101:233';
const DESKTOP_MODE = '101:0';
const TABLET_MODE = '101:1';
const MOBILE_MODE = '101:2';

async function sendCommand(command, payload = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ command, payload });
    const url = new URL(`${SERVER_URL}/command`);
    
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 120000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ data: body });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(data);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function repair() {
  console.log('Fetching all Breakpoints variables...\n');
  
  const breakpointsResult = await sendCommand('get_variables', { collectionId: BREAKPOINTS_COLLECTION_ID });
  const allVars = breakpointsResult.data || [];
  
  console.log(`Found ${allVars.length} variables in Breakpoints\n`);
  
  let repaired = 0;
  let alreadyOk = 0;
  let errors = 0;
  
  for (const variable of allVars) {
    const desktopValue = variable.valuesByMode[DESKTOP_MODE];
    const tabletValue = variable.valuesByMode[TABLET_MODE];
    const mobileValue = variable.valuesByMode[MOBILE_MODE];
    
    // Skip if all modes have values
    if (desktopValue !== undefined && tabletValue !== undefined && mobileValue !== undefined) {
      alreadyOk++;
      continue;
    }
    
    // Only repair if desktop has a value but tablet/mobile don't
    if (desktopValue !== undefined && (tabletValue === undefined || mobileValue === undefined)) {
      console.log(`Repairing: ${variable.name}`);
      
      const value = typeof desktopValue === 'object' ? desktopValue : desktopValue;
      
      try {
        if (tabletValue === undefined) {
          await sendCommand('set_variable_value', {
            variableId: variable.id,
            modeId: TABLET_MODE,
            value: value
          });
          console.log(`  ✓ Set tablet = ${JSON.stringify(value)}`);
        }
        
        await sleep(100);
        
        if (mobileValue === undefined) {
          await sendCommand('set_variable_value', {
            variableId: variable.id,
            modeId: MOBILE_MODE,
            value: value
          });
          console.log(`  ✓ Set mobile = ${JSON.stringify(value)}`);
        }
        
        repaired++;
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        errors++;
      }
      
      await sleep(200);
    }
  }
  
  console.log('\n=== REPAIR COMPLETE ===');
  console.log(`Already OK: ${alreadyOk}`);
  console.log(`Repaired: ${repaired}`);
  console.log(`Errors: ${errors}`);
}

repair().catch(console.error);
