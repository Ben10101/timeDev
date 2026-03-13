import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Backend rodando com sucesso!',
    timestamp: new Date().toISOString()
  })
})

// Exemplo de rota
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Seu Projeto',
    version: '1.0.0',
    description: 'Projeto gerado por AI Software Factory'
  })
})

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Erro interno do servidor' })
})

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' })
})

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`)
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`)
})
