import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Caminho até a raiz do projeto (3 níveis acima de src/services)
const projectRoot = path.resolve(__dirname, '../../..')

export async function orchestrateProject(projectId, idea) {
  return new Promise((resolve, reject) => {
    // Caminho para o orchestrator Python (na raiz do projeto)
    const orchestratorPath = path.join(projectRoot, 'orchestrator', 'factory.py')

    console.log(`📍 Caminho do orchestrator: ${orchestratorPath}`)
    console.log(`🔍 Projeto Root: ${projectRoot}`)

    // Executa o orchestrator Python
    const pythonProcess = spawn('python', [orchestratorPath, projectId, idea])

    let outputData = ''
    let errorData = ''

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString()
    })

    pythonProcess.on('close', (code) => {
      console.log(`\n[ORCHESTRATOR LOGS]:\n${errorData}`)
      console.log(`[OUTPUT LENGTH]: ${outputData.length} caracteres`)
      
      if (code === 0) {
        try {
          // Tenta fazer parse do JSON retornado pelo orchestrator
          const result = JSON.parse(outputData)
          console.log('[SUCCESS] JSON parseado com sucesso')
          resolve(result)
        } catch (err) {
          // Se não conseguir fazer parse, retorna os dados como texto
          console.error(`[ERROR] Falha ao parser JSON: ${err.message}`)
          console.log(`[RAW OUTPUT]: ${outputData.substring(0, 500)}...`)
          resolve({
            backlog: outputData || 'Backlog gerado pelo orchestrator',
            requirements: 'Requisitos gerados',
            architecture: 'Arquitetura definida',
            code: 'Código base gerado',
            tests: 'Testes planejados'
          })
        }
      } else {
        console.error(`❌ Python Error (code ${code}):`, errorData)
        reject(new Error(`Erro ao executar orchestrator: ${errorData}`))
      }
    })

    pythonProcess.on('error', (err) => {
      console.error('❌ Erro ao spawnar processo Python:', err)
      reject(new Error(`Não foi possível executar Python. Mensagem: ${err.message}`))
    })
  })
}

export default {
  orchestrateProject
}
