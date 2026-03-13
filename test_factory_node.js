// Test script to run factory.py and see output
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = path.resolve(__dirname);
const factoryPath = path.join(projectRoot, 'orchestrator', 'factory.py');

console.log('📍 Running Python factory...');
console.log(`📍 Path: ${factoryPath}`);
console.log('-'.repeat(80));

const pythonProcess = spawn('python', [
  factoryPath,
  'test-factory-001',
  'Sistema de controle de clientes para loja de eletrônicos'
]);

let stdout = '';
let stderr = '';

pythonProcess.stdout.on('data', (data) => {
  const text = data.toString();
  stdout += text;
  process.stdout.write(text);
});

pythonProcess.stderr.on('data', (data) => {
  const text = data.toString();
  stderr += text;
  process.stderr.write(text);
});

pythonProcess.on('close', (code) => {
  console.log('\n' + '='.repeat(80));
  console.log('✅ Process finished with code:', code);
  console.log(`📊 STDOUT length: ${stdout.length} characters`);
  console.log(`📊 STDERR length: ${stderr.length} characters`);
  
  if (code === 0) {
    console.log('\n🔍 Trying to parse JSON output...');
    try {
      // Remove any trailing whitespace
      const cleanOutput = stdout.trim();
      const result = JSON.parse(cleanOutput);
      console.log('✅ JSON parsed successfully!');
      console.log('\n📊 RESULTS:');
      Object.entries(result).forEach(([key, value]) => {
        if (typeof value === 'string') {
          const lines = value.split('\n').length;
          const chars = value.length;
          console.log(`  - ${key}: ${chars} chars, ${lines} lines`);
        } else {
          console.log(`  - ${key}: ${JSON.stringify(value)}`);
        }
      });
    } catch (err) {
      console.error('❌ Failed to parse JSON:', err.message);
      console.log('\n🔍 First 500 chars of output:');
      console.log(stdout.substring(0, 500));
    }
  } else {
    console.error('❌ Python process failed!');
    console.log('\nError output:');
    console.log(stderr);
  }
});

pythonProcess.on('error', (err) => {
  console.error('❌ Failed to spawn Python process:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  pythonProcess.kill();
  process.exit(0);
});
