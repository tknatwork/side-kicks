// Script to update shadow variables for neo-brutalism style
// Run with: node update-shadow-vars.js

import http from 'http';

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
    req.write(data);
    req.end();
  });
}

async function updateVariables() {
  console.log('=== Updating Shadow Variables for Neo-Brutalism ===\n');
  
  // Alias Collection (Mode: 94:8)
  const aliasUpdates = [
    // Blur values -> 0 (hard shadows)
    { id: 'VariableID:97:101', value: 0, name: 'effects/shadow/blur/sm' },
    { id: 'VariableID:97:102', value: 0, name: 'effects/shadow/blur/md' },
    { id: 'VariableID:97:103', value: 0, name: 'effects/shadow/blur/lg' },
    { id: 'VariableID:97:104', value: 0, name: 'effects/shadow/blur/xl' },
    { id: 'VariableID:98:105', value: 0, name: 'effects/shadow/blur/2xl' },
    
    // OffsetY values (sm=2, md=4, lg=6, xl=8, 2xl=10)
    { id: 'VariableID:98:110', value: 2, name: 'effects/shadow/offsetY/sm' },
    { id: 'VariableID:98:111', value: 4, name: 'effects/shadow/offsetY/md' },
    { id: 'VariableID:98:112', value: 6, name: 'effects/shadow/offsetY/lg' },
    { id: 'VariableID:98:113', value: 8, name: 'effects/shadow/offsetY/xl' },
    { id: 'VariableID:98:114', value: 10, name: 'effects/shadow/offsetY/2xl' },
    
    // Spread values -> 0
    { id: 'VariableID:98:106', value: 0, name: 'effects/shadow/spread/sm' },
    { id: 'VariableID:98:107', value: 0, name: 'effects/shadow/spread/md' },
    { id: 'VariableID:98:108', value: 0, name: 'effects/shadow/spread/lg' },
    { id: 'VariableID:98:109', value: 0, name: 'effects/shadow/spread/xl' },
    { id: 'VariableID:167:150', value: 0, name: 'effects/shadow/spread/2xl' },
    
    // Opacity values -> 1 (solid black)
    { id: 'VariableID:98:115', value: 1, name: 'effects/shadow/opacity/sm' },
    { id: 'VariableID:98:116', value: 1, name: 'effects/shadow/opacity/md' },
    { id: 'VariableID:98:117', value: 1, name: 'effects/shadow/opacity/lg' },
    { id: 'VariableID:98:118', value: 1, name: 'effects/shadow/opacity/xl' },
    { id: 'VariableID:167:151', value: 1, name: 'effects/shadow/opacity/2xl' },
  ];
  
  console.log('Updating Alias Collection variables...');
  for (const update of aliasUpdates) {
    const result = await sendCommand('set_variable_value', {
      variableId: update.id,
      modeId: '94:8',
      value: update.value
    });
    console.log(`  ${update.name}: ${update.value} -> ${result.success ? '✓' : '✗ ' + result.error}`);
  }
  
  // Breakpoints Collection (Modes: 101:0=Desktop, 101:1=Tablet, 101:2=Mobile)
  const breakpointModes = ['101:0', '101:1', '101:2'];
  const modeNames = ['Desktop', 'Tablet', 'Mobile'];
  
  const breakpointUpdates = [
    // Blur -> 0 for all modes
    { id: 'VariableID:303:7311', value: 0, name: 'elevation/sm/blur' },
    { id: 'VariableID:303:7315', value: 0, name: 'elevation/md/blur' },
    { id: 'VariableID:303:7319', value: 0, name: 'elevation/lg/blur' },
    { id: 'VariableID:303:7323', value: 0, name: 'elevation/xl/blur' },
    
    // OffsetY (sm=2, md=4, lg=6, xl=8)
    { id: 'VariableID:303:7312', value: 2, name: 'elevation/sm/offsetY' },
    { id: 'VariableID:303:7316', value: 4, name: 'elevation/md/offsetY' },
    { id: 'VariableID:303:7320', value: 6, name: 'elevation/lg/offsetY' },
    { id: 'VariableID:303:7324', value: 8, name: 'elevation/xl/offsetY' },
    
    // Spread -> 0
    { id: 'VariableID:303:7313', value: 0, name: 'elevation/sm/spread' },
    { id: 'VariableID:303:7317', value: 0, name: 'elevation/md/spread' },
    { id: 'VariableID:303:7321', value: 0, name: 'elevation/lg/spread' },
    { id: 'VariableID:303:7325', value: 0, name: 'elevation/xl/spread' },
    
    // Opacity -> 1 (solid black)
    { id: 'VariableID:303:7314', value: 1, name: 'elevation/sm/opacity' },
    { id: 'VariableID:303:7318', value: 1, name: 'elevation/md/opacity' },
    { id: 'VariableID:303:7322', value: 1, name: 'elevation/lg/opacity' },
    { id: 'VariableID:303:7326', value: 1, name: 'elevation/xl/opacity' },
  ];
  
  console.log('\nUpdating Breakpoints Collection variables...');
  for (const update of breakpointUpdates) {
    for (let i = 0; i < breakpointModes.length; i++) {
      const result = await sendCommand('set_variable_value', {
        variableId: update.id,
        modeId: breakpointModes[i],
        value: update.value
      });
      if (i === 0) {
        console.log(`  ${update.name}: ${update.value} (all modes) -> ${result.success ? '✓' : '✗ ' + result.error}`);
      }
    }
  }
  
  console.log('\n=== Shadow Variables Updated for Neo-Brutalism! ===');
  console.log('Neo-brutalism shadows: blur=0, solid black, equal X/Y offsets');
}

updateVariables().catch(console.error);
