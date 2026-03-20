import axios from 'axios'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  API_URL,
  clearApiAccessToken,
  getMe,
  loginAuth,
  logoutAuth,
  refreshSession,
  registerAuth,
  setApiAccessToken,
} from '../services/api'

const AuthContext = createContext(null)

function persistBootstrapContext(session) {
  if (!session?.user || !session?.workspace) {
    localStorage.removeItem('factory_bootstrap_context')
    return
  }

  localStorage.setItem(
    'factory_bootstrap_context',
    JSON.stringify({
      user: session.user,
      workspace: session.workspace,
    })
  )
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const apiOrigin = useMemo(() => {
    try {
      return new URL(API_URL).origin
    } catch {
      return window.location.origin
    }
  }, [])

  useEffect(() => {
    axios.defaults.withCredentials = true

    const requestInterceptor = axios.interceptors.request.use((config) => {
      if (config.url?.startsWith('/api/')) {
        config.baseURL = apiOrigin
      }

      if (session?.accessToken) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${session.accessToken}`
      }

      return config
    })

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        if (!originalRequest || originalRequest._retry || error.response?.status !== 401) {
          return Promise.reject(error)
        }

        if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register') || originalRequest.url?.includes('/auth/refresh')) {
          return Promise.reject(error)
        }

        originalRequest._retry = true

        try {
          const restored = await refreshSession()
          setApiAccessToken(restored.accessToken)
          setSession({
            user: restored.user,
            workspace: restored.workspace,
            accessToken: restored.accessToken,
          })
          persistBootstrapContext(restored)
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${restored.accessToken}`
          return axios(originalRequest)
        } catch (refreshError) {
          clearApiAccessToken()
          setSession(null)
          persistBootstrapContext(null)
          return Promise.reject(refreshError)
        }
      }
    )

    return () => {
      axios.interceptors.request.eject(requestInterceptor)
      axios.interceptors.response.eject(responseInterceptor)
    }
  }, [apiOrigin, session?.accessToken])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const restored = await refreshSession()
        if (cancelled) return

        setApiAccessToken(restored.accessToken)
        setSession({
          user: restored.user,
          workspace: restored.workspace,
          accessToken: restored.accessToken,
        })
        persistBootstrapContext(restored)
      } catch (_error) {
        if (cancelled) return
        clearApiAccessToken()
        setSession(null)
        persistBootstrapContext(null)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      workspace: session?.workspace || null,
      isAuthenticated: Boolean(session?.user),
      loading,
      async login(payload) {
        const result = await loginAuth(payload)
        setSession({
          user: result.user,
          workspace: result.workspace,
          accessToken: result.accessToken,
        })
        persistBootstrapContext(result)
        return result
      },
      async register(payload) {
        const result = await registerAuth(payload)
        setSession({
          user: result.user,
          workspace: result.workspace,
          accessToken: result.accessToken,
        })
        persistBootstrapContext(result)
        return result
      },
      async refreshMe() {
        const result = await getMe()
        setSession((current) => ({
          ...current,
          user: result.user,
          workspace: result.workspace,
        }))
        persistBootstrapContext(result)
        return result
      },
      async logout() {
        await logoutAuth()
        clearApiAccessToken()
        setSession(null)
        persistBootstrapContext(null)
      },
    }),
    [loading, session]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de AuthProvider')
  }
  return context
}

export { API_URL }
