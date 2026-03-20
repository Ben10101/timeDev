import express from 'express'
import cors from 'cors'
import { AccountRegistrationRouter } from './modules/auth-register/index'
import { LoginSessionRouter } from './modules/auth-login/index'
import { ProfileSettingsRouter } from './modules/profile-settings/index'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'teste-paulo' })
})

app.use('/api/auth/register', AccountRegistrationRouter)
app.use('/api/auth/login', LoginSessionRouter)
app.use('/api/profile', ProfileSettingsRouter)

app.listen(3001, () => {
  console.log('API running on 3001')
})
