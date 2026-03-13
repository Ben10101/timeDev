# -*- coding: utf-8 -*-
"""
Frontend Generator - Cria aplicação React funcional completa
"""

import os
import json

class FrontendGenerator:
    """Gera um frontend React funcional"""
    
    def __init__(self, project_path, primary_entity="Task"):
        self.project_path = project_path
        self.frontend_path = os.path.join(project_path, 'frontend')
        self.entity = primary_entity
        self.entity_lower = primary_entity.lower()
        self.entity_plural = f"{self.entity_lower}s"
        self.page_name = f"{self.entity}sPage"
    
    def create_app_jsx(self):
        """Cria App.jsx funcional"""
        app_jsx = f"""import {{ useState, useEffect }} from 'react'
import {{ BrowserRouter as Router, Routes, Route, Navigate }} from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import {self.page_name} from './pages/{self.page_name}'
import './App.css'

export default function App() {{
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {{
    // Verificar se usuário está logado
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (token && userData) {{
      setUser(JSON.parse(userData))
    }}
    setLoading(false)
  }}, [])

  const handleLogin = (userData, token) => {{
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('token', token)
  }}

  const handleLogout = () => {{
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }}

  if (loading) {{
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>
  }}

  return (
    <Router>
      <Routes>
        <Route path="/login" element={{
          user ? <Navigate to="/" /> : <LoginPage onLogin={{handleLogin}} />
        }} />
        
        <Route path="/register" element={{
          user ? <Navigate to="/" /> : <RegisterPage onRegister={{handleLogin}} />
        }} />
        
        <Route path="/" element={{
          user ? <{self.page_name} user={{user}} onLogout={{handleLogout}} /> : <Navigate to="/login" />
        }} />
      </Routes>
    </Router>
  )
}}
"""
        with open(f'{self.frontend_path}/src/App.jsx', 'w', encoding='utf-8') as f:
            f.write(app_jsx)
        print('[CREATE] frontend/src/App.jsx', file=__import__('sys').stderr)

    def create_login_page(self):
        """Cria página de login"""
        login_page = """import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

const API_URL = 'http://localhost:3001/api'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password
      })

      const { user, token } = response.data
      onLogin(user, token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-2xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-800">Login</h1>

        {error && (
          <div className="mb-4 rounded bg-red-100 p-3 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-300 px-4 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-gray-300 px-4 py-2"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-500 py-2 text-white font-semibold hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-gray-600">
          Não tem conta?{' '}
          <Link to="/register" className="text-blue-500 hover:underline">
            Registre-se
          </Link>
        </p>
      </div>
    </div>
  )
}
"""
        with open(f'{self.frontend_path}/src/pages/LoginPage.jsx', 'w', encoding='utf-8') as f:
            f.write(login_page)
        print('[CREATE] frontend/src/pages/LoginPage.jsx', file=__import__('sys').stderr)

    def create_register_page(self):
        """Cria página de registro"""
        register_page = """import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

const API_URL = 'http://localhost:3001/api'

export default function RegisterPage({ onRegister }) {
  const [formData, setFormData] = useState({ email: '', password: '', name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post(`${API_URL}/auth/register`, formData)
      const { user, token } = response.data
      onRegister(user, token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-2xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-800">Registrar</h1>

        {error && (
          <div className="mb-4 rounded bg-red-100 p-3 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded border border-gray-300 px-4 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded border border-gray-300 px-4 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Senha</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full rounded border border-gray-300 px-4 py-2"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-500 py-2 text-white font-semibold hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-gray-600">
          Já tem conta?{' '}
          <Link to="/login" className="text-blue-500 hover:underline">
            Faça login
          </Link>
        </p>
      </div>
    </div>
  )
}
"""
        with open(f'{self.frontend_path}/src/pages/RegisterPage.jsx', 'w', encoding='utf-8') as f:
            f.write(register_page)
        print('[CREATE] frontend/src/pages/RegisterPage.jsx', file=__import__('sys').stderr)

    def create_entity_page(self):
        """Cria página da entidade principal"""
        page_content = f"""import {{ useState, useEffect }} from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:3001/api'

export default function {self.page_name}({{ user, onLogout }}) {{
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState({{ title: '', description: '', priority: 'medium' }})
  const [loading, setLoading] = useState(false)
  const token = localStorage.getItem('token')

  const axiosConfig = {{
    headers: {{ Authorization: `Bearer ${{token}}` }}
  }}

  useEffect(() => {{
    fetchTasks()
  }}, [])

  const fetchTasks = async () => {{
    try {{
      const response = await axios.get(`${{API_URL}}/{self.entity_plural}`, axiosConfig)
      setTasks(response.data.data || [])
    }} catch (err) {{
      console.error('Erro ao carregar dados:', err)
    }}
  }}

  const handleCreateTask = async (e) => {{
    e.preventDefault()
    if (!newTask.title.trim()) return

    setLoading(true)
    try {{
      const response = await axios.post(`${{API_URL}}/{self.entity_plural}`, newTask, axiosConfig)
      setTasks([response.data.{self.entity_lower}, ...tasks])
      setNewTask({{ title: '', description: '', priority: 'medium' }})
    }} catch (err) {{
      console.error('Erro ao criar:', err)
    }} finally {{
      setLoading(false)
    }}
  }}

  const handleUpdateTask = async (id, updates) => {{
    try {{
      const task = tasks.find(t => t.id === id)
      await axios.put(`${{API_URL}}/{self.entity_plural}/${{id}}`, {{ ...task, ...updates }}, axiosConfig)
      setTasks(tasks.map(t => t.id === id ? {{ ...t, ...updates }} : t))
    }} catch (err) {{
      console.error('Erro ao atualizar:', err)
    }}
  }}

  const handleDeleteTask = async (id) => {{
    if (!window.confirm('Tem certeza?')) return

    try {{
      await axios.delete(`${{API_URL}}/{self.entity_plural}/${{id}}`, axiosConfig)
      setTasks(tasks.filter(t => t.id !== id))
    }} catch (err) {{
      console.error('Erro ao deletar:', err)
    }}
  }}

  const getPriorityColor = (priority) => {{
    const colors = {{
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    }}
    return colors[priority] || 'bg-gray-100'
  }}

  const getStatusColor = (status) => {{
    return status === 'completed' ? 'line-through text-gray-500' : ''
  }}

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {{/* Header */}}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-6xl px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meus {self.entity_plural.title()}s</h1>
            <p className="text-gray-600">Bem-vindo, {{user.name}}! 👋</p>
          </div>
          <button
            onClick={{onLogout}}
            className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </header>

      {{/* Main content */}}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {{/* Create task form */}}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Novo {self.entity}</h2>
          <form onSubmit={{handleCreateTask}} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Título / Nome"
                value={{newTask.title}}
                onChange={{(e) => setNewTask({{ ...newTask, title: e.target.value }})}}
                className="w-full rounded border border-gray-300 px-4 py-2"
                required
              />
            </div>
            <div>
              <textarea
                placeholder="Descrição (opcional)"
                value={{newTask.description}}
                onChange={{(e) => setNewTask({{ ...newTask, description: e.target.value }})}}
                className="w-full rounded border border-gray-300 px-4 py-2"
                rows="3"
              />
            </div>
            <div className="flex gap-4">
              <select
                value={{newTask.priority}}
                onChange={{(e) => setNewTask({{ ...newTask, priority: e.target.value }})}}
                className="rounded border border-gray-300 px-4 py-2"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
              <button
                type="submit"
                disabled={{loading}}
                className="flex-1 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {{loading ? 'Criando...' : 'Criar'}}
              </button>
            </div>
          </form>
        </div>

        {{/* Tasks list */}}
        <div className="space-y-4">
          {{tasks.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center shadow">
              <p className="text-gray-500">Nenhum item ainda. Crie um para começar! 🚀</p>
            </div>
          ) : (
            tasks.map(task => (
              <div key={{task.id}} className="rounded-lg bg-white p-6 shadow hover:shadow-lg transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className={{`text-lg font-semibold text-gray-900 ${{getStatusColor(task.status)}}`}}>
                      {{task.title}}
                    </h3>
                    {{task.description && (
                      <p className="mt-2 text-gray-600">{{task.description}}</p>
                    )}}
                    <div className="mt-4 flex gap-2">
                      <span className={{`rounded-full px-3 py-1 text-sm font-medium ${{getPriorityColor(task.priority)}}`}}>
                        {{task.priority === 'low' ? '🟢 Baixa' : task.priority === 'medium' ? '🟡 Média' : '🔴 Alta'}}
                      </span>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                        {{task.status === 'completed' ? '✅ Completa' : '⏳ Ativa'}}
                      </span>
                    </div>
                  </div>

                  {{/* Actions */}}
                  <div className="ml-4 space-y-2">
                    <button
                      onClick={{() => handleUpdateTask(task.id, {{
                        status: task.status === 'completed' ? 'active' : 'completed'
                      }})}}
                      className="w-full rounded bg-green-500 px-3 py-1 text-sm text-white hover:bg-green-600"
                    >
                      {{task.status === 'completed' ? 'Reabrir' : 'Completar'}}
                    </button>
                    <button
                      onClick={{() => handleDeleteTask(task.id)}}
                      className="w-full rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}}
        </div>

        {{/* Stats */}}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-white p-6 shadow text-center">
            <p className="text-3xl font-bold text-blue-500">{{tasks.length}}</p>
            <p className="text-gray-600">Total</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow text-center">
            <p className="text-3xl font-bold text-green-500">{{tasks.filter(t => t.status === 'completed').length}}</p>
            <p className="text-gray-600">Completas</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow text-center">
            <p className="text-3xl font-bold text-yellow-500">{{tasks.filter(t => t.status === 'active').length}}</p>
            <p className="text-gray-600">Ativas</p>
          </div>
        </div>
      </main>
    </div>
  )
}}
"""
        with open(f'{self.frontend_path}/src/pages/{self.page_name}.jsx', 'w', encoding='utf-8') as f:
            f.write(page_content)
        print(f'[CREATE] frontend/src/pages/{self.page_name}.jsx', file=__import__('sys').stderr)

    def create_package_json(self):
        """Cria package.json"""
        package = {
          "name": "projeto-frontend",
          "private": True,
          "version": "1.0.0",
          "type": "module",
          "scripts": {
            "dev": "vite",
            "build": "vite build",
            "preview": "vite preview"
          },
          "dependencies": {
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "react-router-dom": "^6.8.0",
            "axios": "^1.3.0"
          },
          "devDependencies": {
            "@types/react": "^18.0.24",
            "@types/react-dom": "^18.0.8",
            "@vitejs/plugin-react": "^3.1.0",
            "vite": "^4.5.0",
            "tailwindcss": "^3.3.0",
            "postcss": "^8.4.24",
            "autoprefixer": "^10.4.14"
          }
        }

        with open(f'{self.frontend_path}/package.json', 'w', encoding='utf-8') as f:
            json.dump(package, f, indent=2)
        print('[CREATE] frontend/package.json', file=__import__('sys').stderr)

    def create_tailwind_config(self):
        """Cria tailwind.config.js"""
        config = """export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
"""
        with open(f'{self.frontend_path}/tailwind.config.js', 'w', encoding='utf-8') as f:
            f.write(config)
        print('[CREATE] frontend/tailwind.config.js', file=__import__('sys').stderr)

    def create_css(self):
        """Cria App.css com TailwindCSS"""
        css = """@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html, body, #root {
  width: 100%;
  height: 100%;
}
"""
        with open(f'{self.frontend_path}/src/App.css', 'w', encoding='utf-8') as f:
            f.write(css)
        print('[CREATE] frontend/src/App.css', file=__import__('sys').stderr)

    def create_vite_config(self):
        """Cria vite.config.js"""
        vite_config = """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: 'localhost'
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
"""
        with open(f'{self.frontend_path}/vite.config.js', 'w', encoding='utf-8') as f:
            f.write(vite_config)
        print('[CREATE] frontend/vite.config.js', file=__import__('sys').stderr)

    def create_postcss_config(self):
        """Cria postcss.config.js"""
        postcss_config = """export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
"""
        with open(f'{self.frontend_path}/postcss.config.js', 'w', encoding='utf-8') as f:
            f.write(postcss_config)
        print('[CREATE] frontend/postcss.config.js', file=__import__('sys').stderr)

    def create_main_jsx(self):
        """Cria main.jsx"""
        main_jsx = """import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
"""
        with open(f'{self.frontend_path}/src/main.jsx', 'w', encoding='utf-8') as f:
            f.write(main_jsx)
        print('[CREATE] frontend/src/main.jsx', file=__import__('sys').stderr)

    def create_index_html(self):
        """Cria index.html"""
        index_html = """<!doctype html>
<html lang="pt-br">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Task Management</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
"""
        with open(f'{self.frontend_path}/index.html', 'w', encoding='utf-8') as f:
            f.write(index_html)
        print('[CREATE] frontend/index.html', file=__import__('sys').stderr)

    def create_gitignore(self):
        """Cria .gitignore"""
        gitignore = """# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
"""
        with open(f'{self.frontend_path}/.gitignore', 'w', encoding='utf-8') as f:
            f.write(gitignore)
        print('[CREATE] frontend/.gitignore', file=__import__('sys').stderr)

    def generate(self):
        """Gera todo o frontend funcional"""
        import os
        os.makedirs(f'{self.frontend_path}/src/pages', exist_ok=True)
        os.makedirs(f'{self.frontend_path}/src/hooks', exist_ok=True)
        os.makedirs(f'{self.frontend_path}/src/services', exist_ok=True)
        
        self.create_vite_config()
        self.create_postcss_config()
        self.create_index_html()
        self.create_main_jsx()
        self.create_package_json()
        self.create_tailwind_config()
        self.create_css()
        self.create_app_jsx()
        self.create_login_page()
        self.create_register_page()
        self.create_entity_page()
        self.create_gitignore()
