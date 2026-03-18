import axios from 'axios'

const API_URL = 'http://localhost:3001/api'
const apiClient = axios.create({
  baseURL: API_URL,
})

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

export const createProject = async (payload) => {
  const response = await apiClient.post('/projects', payload)
  return response.data
}

export const generateProjectBacklog = async (projectUuid, payload) => {
  const response = await apiClient.post(`/projects/${projectUuid}/generate-backlog`, payload)
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

export default {
  generateProject,
  bootstrapWorkspace,
  listProjects,
  getProject,
  listProjectTasks,
  createProject,
  generateProjectBacklog,
  createTask,
  runTaskRequirements,
  runTaskQa,
  updateTask,
  getTask,
  createTaskComment,
  ensurePipelineProject,
  importBacklogTasks,
  createTaskArtifact,
}
