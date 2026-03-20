import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: '__PROJECT_SLUG__' })
})

// AUTO_REGISTER_API_ROUTES

app.listen(3001, () => {
  console.log('API __PROJECT_NAME__ running on 3001')
})
