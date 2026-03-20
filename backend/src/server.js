import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { prisma } from './lib/prisma.js'
import projectRoutes from './routes/projectRoutes.js'
import agentRoutes from './routes/agentRoutes.js'
import dataRoutes from './routes/dataRoutes.js'
import implementationRoutes from './routes/implementationRoutes.js'

// Fix for "Do not know how to serialize a BigInt" when using Prisma
BigInt.prototype.toJSON = function () {
  return this.toString()
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const app = express()
const PORT = process.env.PORT || 3001
const DATABASE_URL = process.env.DATABASE_URL || ''

function getSafeDatabaseLabel() {
  if (!DATABASE_URL) return 'DATABASE_URL ausente'

  try {
    const parsed = new URL(DATABASE_URL)
    return `${parsed.protocol.replace(':', '')}://${parsed.hostname}:${parsed.port}${parsed.pathname}`
  } catch {
    return 'DATABASE_URL presente (nao foi possivel parsear)'
  }
}

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api', projectRoutes)
app.use('/api', agentRoutes)
app.use('/api', dataRoutes)
app.use('/api', implementationRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() })
})

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  const statusCode =
    err.message?.includes('não encontrado') ? 404 :
    err.message?.includes('obrigatório') ? 400 :
    500

  res.status(statusCode).json({ message: 'Erro interno do servidor', error: err.message })
})

async function startServer() {
  console.log(`🗄️ Database target: ${getSafeDatabaseLabel()}`)

  try {
    await prisma.$connect()
    console.log('✅ Prisma conectado com sucesso')
  } catch (error) {
    console.error(`❌ Falha ao conectar no banco: ${error.message}`)
  }

  app.listen(PORT, () => {
    console.log(`🚀 Backend rodando em http://localhost:${PORT}`)
    console.log(`📝 API disponível em http://localhost:${PORT}/api`)
  })
}

startServer()

export default app
