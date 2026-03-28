import express from 'express'
import cors from 'cors'
import { ProfileSettingsRouter } from './modules/profile-settings/index'
import { AccessControlRoleRouter } from './modules/access-control-roles/index'
import { TicketNotificationPreferenceRouter } from './modules/ticket-notification-preferences/index'
import { SupportTicketAttachmentRouter } from './modules/support-ticket-attachments/index'
const app = express()
app.use(cors())
app.use(express.json())
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'central-de-chamados-internos' })
})
app.use('/api/profile', ProfileSettingsRouter)
app.use('/api/access-control/roles', AccessControlRoleRouter)
app.use('/api/notification-preferences', TicketNotificationPreferenceRouter)
app.use('/api/support-ticket-attachments', SupportTicketAttachmentRouter)
app.listen(3001, () => {
  console.log('API running on 3001')
})