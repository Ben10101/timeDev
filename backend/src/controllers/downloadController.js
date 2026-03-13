import { response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import archiver from 'archiver'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Caminho até a raiz do projeto
const projectRoot = path.resolve(__dirname, '../../..')

export async function downloadProjectController(req, res) {
  try {
    const { projectId } = req.params

    if (!projectId) {
      return res.status(400).json({ message: 'Project ID é obrigatório' })
    }

    const projectPath = path.join(projectRoot, 'outputs/generated_projects', projectId)

    // Verificar se o projeto existe
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ message: 'Projeto não encontrado' })
    }

    // Criar arquivo ZIP
    const zipFileName = `${projectId}.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`)

    const archive = archiver('zip', {
      zlib: { level: 9 } // Compressão máxima
    })

    archive.on('error', (err) => {
      console.error('❌ Erro ao criar ZIP:', err)
      res.status(500).json({ message: 'Erro ao criar arquivo ZIP' })
    })

    archive.pipe(res)
    archive.directory(projectPath, projectId)
    archive.finalize()

  } catch (error) {
    console.error('❌ Erro ao fazer download do projeto:', error)
    return res.status(500).json({
      message: 'Erro ao fazer download do projeto',
      error: error.message
    })
  }
}

export default {
  downloadProjectController
}
