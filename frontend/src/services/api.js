import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

let accessToken = null
let refreshPromise = null

export function setApiAccessToken(nextToken) {
  accessToken = nextToken || null
}

export function clearApiAccessToken() {
  accessToken = null
}

async function refreshAuthSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
        }
      )
      .then((response) => {
        setApiAccessToken(response.data.accessToken)
        return response.data
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status

    if (!originalRequest || originalRequest._retry || status !== 401) {
      return Promise.reject(error)
    }

    if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register') || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const session = await refreshAuthSession()
      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${session.accessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      clearApiAccessToken()
      return Promise.reject(refreshError)
    }
  }
)

export async function registerAuth(payload) {
  const response = await apiClient.post('/auth/register', payload)
  setApiAccessToken(response.data.accessToken)
  return response.data
}

export async function loginAuth(payload) {
  const response = await apiClient.post('/auth/login', payload)
  setApiAccessToken(response.data.accessToken)
  return response.data
}

export async function refreshSession() {
  return refreshAuthSession()
}

export async function getMe() {
  const response = await apiClient.get('/auth/me')
  return response.data
}

export async function logoutAuth() {
  try {
    await apiClient.post('/auth/logout')
  } finally {
    clearApiAccessToken()
  }
}

export async function getAiSettings() {
  const response = await apiClient.get('/auth/ai-settings')
  return response.data
}

export async function updateAiSettings(payload) {
  const response = await apiClient.put('/auth/ai-settings', payload)
  return response.data
}

export async function getAiRuntimeSummary() {
  const response = await apiClient.get('/auth/ai-runtime')
  return response.data
}

export async function testAiProvider(payload) {
  const response = await apiClient.post('/auth/ai-settings/test', payload)
  return response.data
}

export async function getOperationalHealth() {
  const response = await axios.get(API_URL.replace(/\/api$/, '') + '/health', { withCredentials: true })
  return response.data
}

export async function getAiOperationsOverview(params = {}) {
  const response = await apiClient.get('/observability/ai', { params })
  return response.data
}

export const generateProject = async (idea) => {
  try {
    const response = await apiClient.post('/generate-project', {
      idea: idea
    })
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Erro ao gerar projeto')
  }
}

export const bootstrapWorkspace = async (payload) => {
  const response = await apiClient.post('/bootstrap', payload)
  return response.data
}

export const listProjects = async () => {
  const response = await apiClient.get('/projects')
  return response.data
}

export const getProject = async (projectUuid) => {
  const response = await apiClient.get(`/projects/${projectUuid}`)
  return response.data
}

export const listProjectTasks = async (projectUuid, params = {}) => {
  const response = await apiClient.get(`/projects/${projectUuid}/tasks`, { params })
  return response.data
}

export const listAllTasks = async (params = {}) => {
  const response = await apiClient.get('/tasks', { params })
  return response.data
}

export const createProject = async (payload) => {
  const response = await apiClient.post('/projects', payload)
  return response.data
}

export const generateProjectBacklog = async (projectUuid, payload) => {
  const response = await apiClient.post(`/projects/${projectUuid}/generate-backlog`, payload)
  return response.data
}

export const getProjectArchitectureStatus = async (projectUuid) => {
  const response = await apiClient.get(`/projects/${projectUuid}/architecture/status`)
  return response.data
}

export const generateProjectArchitecture = async (projectUuid) => {
  const response = await apiClient.post(`/projects/${projectUuid}/generate-architecture`)
  return response.data
}

export const createTask = async (projectUuid, payload) => {
  const response = await apiClient.post(`/projects/${projectUuid}/tasks`, payload)
  return response.data
}

export const runTaskRequirements = async (taskUuid, payload = {}) => {
  const response = await apiClient.post(`/tasks/${taskUuid}/requirements/run`, payload)
  return response.data
}

export const runTaskQa = async (taskUuid, payload = {}) => {
  const response = await apiClient.post(`/tasks/${taskUuid}/qa/run`, payload)
  return response.data
}

export const bootstrapGeneratedApp = async (projectUuid, payload = {}) => {
  const response = await apiClient.post(`/projects/${projectUuid}/generated-app/bootstrap`, payload)
  return response.data
}

export const getGeneratedApp = async (projectUuid) => {
  const response = await apiClient.get(`/projects/${projectUuid}/generated-app`)
  return response.data
}

export const runTaskImplementation = async (taskUuid) => {
  const response = await apiClient.post(`/tasks/${taskUuid}/implementation/run`)
  return response.data
}

export const getTaskImplementationStatus = async (taskUuid) => {
  const response = await apiClient.get(`/tasks/${taskUuid}/implementation/status`)
  return response.data
}

export const updateTask = async (taskUuid, payload) => {
  const response = await apiClient.patch(`/tasks/${taskUuid}`, payload)
  return response.data
}

export const getTask = async (taskUuid) => {
  const response = await apiClient.get(`/tasks/${taskUuid}`)
  return response.data
}

export const createTaskComment = async (taskUuid, payload) => {
  const response = await apiClient.post(`/tasks/${taskUuid}/comments`, payload)
  return response.data
}

export const ensurePipelineProject = async (payload) => {
  const response = await apiClient.post('/pipeline-project', payload)
  return response.data
}

export const importBacklogTasks = async (projectUuid, backlogMarkdown) => {
  const response = await apiClient.post(`/projects/${projectUuid}/import-backlog`, { backlogMarkdown })
  return response.data
}

export const createTaskArtifact = async (taskUuid, payload) => {
  const response = await apiClient.post(`/tasks/${taskUuid}/artifacts`, payload)
  return response.data
}

export { apiClient }

export default {
  registerAuth,
  loginAuth,
  refreshSession,
  getMe,
  logoutAuth,
  getAiSettings,
  updateAiSettings,
  getAiRuntimeSummary,
  testAiProvider,
  generateProject,
  bootstrapWorkspace,
  listProjects,
  getProject,
  listProjectTasks,
  createProject,
  generateProjectBacklog,
  getProjectArchitectureStatus,
  generateProjectArchitecture,
  createTask,
  runTaskRequirements,
  runTaskQa,
  bootstrapGeneratedApp,
  getGeneratedApp,
  runTaskImplementation,
  getTaskImplementationStatus,
  updateTask,
  getTask,
  createTaskComment,
  ensurePipelineProject,
  importBacklogTasks,
  createTaskArtifact,
  listAllTasks,
}
