#!/usr/bin/env node
/* Direct backend test without HTTP */

import { orchestrateProject } from './backend/src/services/orchestratorService.js';

console.log('🚀 Testing AI Software Factory Backend\n');

const projectId = 'direct-test-001';
const idea = 'Sistema de gerenciamento de tarefas com notificações em tempo real e colaboração em equipe';

console.log(`📋 Project ID: ${projectId}`);
console.log(`💡 Idea: ${idea}`);
console.log('-'.repeat(80) + '\n');

orchestrateProject(projectId, idea)
  .then((result) => {
    console.log('\n✅ SUCCESS! Orchestrator returned results:\n');
    
    if (typeof result === 'object' && result !== null) {
      Object.entries(result).forEach(([key, value]) => {
        if (typeof value === 'string') {
          const lines = value.split('\n').length;
          const chars = value.length;
          console.log(`  📄 ${key.toUpperCase()}: ${chars} characters, ${lines} lines`);
          
          // Print first 200 chars
          const preview = value.substring(0, 200).replace(/\n/g, '\n     ');
          console.log(`     Preview: ${preview}...\n`);
        } else {
          console.log(`  📊 ${key}: ${JSON.stringify(value)}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(80));
    
  })
  .catch((err) => {
    console.error('\n❌ ERROR:', err.message);
    console.error('\nFull error:');
    console.error(err);
    process.exit(1);
  });
