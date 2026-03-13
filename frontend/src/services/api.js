import axios from 'axios'

const API_URL = 'http://localhost:3001/api'

export const generateProject = async (idea) => {
  try {
    const response = await axios.post(`${API_URL}/generate-project`, {
      idea: idea
    })
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Erro ao gerar projeto')
  }
}

export default {
  generateProject
}
