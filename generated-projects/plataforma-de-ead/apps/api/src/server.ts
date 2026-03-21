import express from 'express'
import cors from 'cors'
import { ProfileSettingsRouter } from './modules/profile-settings/index'
import { CourseCatalogRouter } from './modules/course-catalog/index'
import { CourseModuleRouter } from './modules/course-modules/index'
import { CourseLessonRouter } from './modules/course-lessons/index'
import { LessonMaterialRouter } from './modules/lesson-materials/index'
import { CourseSearchRouter } from './modules/course-search/index'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'plataforma-de-ead' })
})

app.use('/api/profile', ProfileSettingsRouter)
app.use('/api/courses', CourseCatalogRouter)
app.use('/api/course-modules', CourseModuleRouter)
app.use('/api/course-lessons', CourseLessonRouter)
app.use('/api/lesson-materials', LessonMaterialRouter)
app.use('/api/course-search', CourseSearchRouter)

app.listen(3001, () => {
  console.log('API running on 3001')
})
