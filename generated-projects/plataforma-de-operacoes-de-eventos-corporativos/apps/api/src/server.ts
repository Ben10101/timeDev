import express from 'express'
import cors from 'cors'
import pino from 'pino'
import { EventSupplierRouter } from './modules/event-suppliers/index'
const app = express()
const logger = pino({ name: 'plataforma-de-operacoes-de-eventos-corporativos-api' })
const port = Number(process.env.PORT || 3001)
const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`Origin not allowed: ${origin}`))
    },
    credentials: true,
  })
)
app.use(express.json({ limit: '1mb' }))
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'plataforma-de-operacoes-de-eventos-corporativos' })
})
app.use('/api/event-suppliers', EventSupplierRouter)
app.listen(port, () => {
  logger.info({ port }, 'API running')
})