import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import projectRoutes from './routes/projectRoutes.js'
import agentRoutes from './routes/agentRoutes.js'
import dataRoutes from './routes/dataRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api', projectRoutes)
app.use('/api', agentRoutes)
app.use('/api', dataRoutes)

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

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`)
  console.log(`📝 API disponível em http://localhost:${PORT}/api`)
})

export default app
