import express from 'express'
import cors from 'cors'
import { ProfileSettingsRouter } from './modules/profile-settings/index'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'plataforma-de-ead' })
})

app.use('/api/profile', ProfileSettingsRouter)

app.listen(3001, () => {
  console.log('API running on 3001')
})
