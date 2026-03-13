import { spawn, execSync } from 'child_process'

console.log('[INFO] Testando Python...\n')

// Test 1: Check if python is available
try {
  const version = execSync('python --version', { encoding: 'utf-8' })
  console.log('[OK] Python encontrado:', version.trim())
} catch (e) {
  console.log('[WARN] Python não encontrado com "python"')
  try {
    const version = execSync('python3 --version', { encoding: 'utf-8' })
    console.log('[OK] Python3 encontrado:', version.trim())
  } catch {
    console.log('[ERROR] Python3 não encontrado')
  }
}

// Test 2: Check orchestrator path
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const orchestratorPath = path.join(projectRoot, 'orchestrator', 'factory.py')

console.log('\n[INFO] Caminho do Projeto:', projectRoot)
console.log('[INFO] Caminho do Orchestrator:', orchestratorPath)

// Test 3: Check if file exists
import fs from 'fs'
if (fs.existsSync(orchestratorPath)) {
  console.log('[OK] Arquivo factory.py existe!')
} else {
  console.log('[ERROR] Arquivo factory.py NAO existe!')
  console.log('        Procurou em:', orchestratorPath)
}

// Test 4: Try to run factory.py
console.log('\n[TEST] Tentando executar factory.py...')
const testProcess = spawn('python', [orchestratorPath, 'test-001', 'Teste'])

let output = ''
testProcess.stdout.on('data', (data) => {
  output += data.toString()
  process.stdout.write(data)
})

testProcess.stderr.on('data', (data) => {
  console.error('[STDERR]:', data.toString())
})

testProcess.on('close', (code) => {
  console.log(`\n[INFO] Processo fechado com código: ${code}`)
})

testProcess.on('error', (err) => {
  console.error('[ERROR] Erro ao executar:', err.message)
})
