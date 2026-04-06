import express from 'express'
import cors from 'cors'
import { SupportTicketAttachmentRouter } from './modules/support-ticket-attachments/index'
import { AccessControlRoleRouter } from './modules/access-control-roles/index'
import { TicketNotificationPreferenceRouter } from './modules/ticket-notification-preferences/index'
import { SupportPerformanceDashboardRouter } from './modules/support-performance-dashboard/index'
import { TicketEscalationQueueRouter } from './modules/ticket-escalation-queue/index'
const app = express()
const PORT = Number(process.env.PORT || 3001)
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
  res.json({ status: 'ok', app: 'central-de-chamados-internos' })
})
app.use('/api/support-ticket-attachments', SupportTicketAttachmentRouter)
app.use('/api/access-control/roles', AccessControlRoleRouter)
app.use('/api/notification-preferences', TicketNotificationPreferenceRouter)
app.use('/api/support-performance/dashboard', SupportPerformanceDashboardRouter)
app.use('/api/ticket-escalations', TicketEscalationQueueRouter)
app.listen(PORT, () => {
  console.log(`API running on ${PORT}`)
})
