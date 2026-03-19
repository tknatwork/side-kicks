const http = require('http');

const SERVER_URL = 'http://localhost:9877';
const MAPPED_COLLECTION_ID = 'VariableCollectionId:94:3';

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
      timeout: 180000 // 3 minutes for large operations
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

async function deleteFloatVars() {
  console.log('=== STEP 2: Deleting FLOAT variables from Mapped ===\n');
  console.log('Fetching FLOAT variables from Mapped collection...');
  
  const result = await sendCommand('get_variables', { collectionId: MAPPED_COLLECTION_ID });
  const allVars = result.data || [];
  
  const floatVars = allVars.filter(v => v.resolvedType === 'FLOAT');
  console.log(`Found ${floatVars.length} FLOAT variables to delete\n`);
  
  let deleted = 0;
  let failed = 0;
  
  for (const variable of floatVars) {
    console.log(`Deleting: ${variable.name}`);
    
    try {
      await sendCommand('delete_variable', { variableId: variable.id });
      console.log(`  ✓ Deleted`);
      deleted++;
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      failed++;
    }
    
    await sleep(150);
  }
  
  console.log('\n=== STEP 2 COMPLETE ===');
  console.log(`Deleted: ${deleted}`);
  console.log(`Failed: ${failed}`);
}

deleteFloatVars().catch(console.error);
