import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'plataforma-saas-de-gestao-de-reembolsos-corporativos' })
})

// AUTO_REGISTER_API_ROUTES

app.listen(3001, () => {
  console.log('API Plataforma SaaS de gestão de reembolsos corporativos running on 3001')
})
