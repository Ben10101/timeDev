import express from 'express'
import cors from 'cors'
import pino from 'pino'
import { VisitExtraCompanionRouter } from './modules/visit-extra-companions/index'
import { VisitRecurringHistoryRouter } from './modules/visit-recurring-history/index'
import { VisitOperationalResponsibleRouter } from './modules/visit-operational-responsibles/index'
const app = express()
const logger = pino({ name: 'plataforma-de-operacoes-de-visitas-corporativas-api' })
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
  res.json({ status: 'ok', app: 'plataforma-de-operacoes-de-visitas-corporativas' })
})
app.use('/api/visit-extra-companions', VisitExtraCompanionRouter)
app.use('/api/visit-recurring-history', VisitRecurringHistoryRouter)
app.use('/api/visit-operational-responsibles', VisitOperationalResponsibleRouter)
app.listen(port, () => {
  logger.info({ port }, 'API running')
})