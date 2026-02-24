/**
 * Cliente API Optimizado para COLSOF
 * Features: Caché local, Request deduplication, Response compression, Retry logic
 */

// Construir URL dinámica
let API_BASE_URL
if (typeof window !== 'undefined') {
  if (window.location.protocol === 'file:') {
    API_BASE_URL = 'http://localhost:3000/api'
  } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const port = window.location.port || (window.location.protocol === 'https:' ? 443 : 80)
    API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:${port}/api`
  } else {
    API_BASE_URL = '/api'
  }
}

// ==================== CACHÉ LOCAL ====================
class LocalCache {
  constructor(maxSize = 100, defaultTTL = 5 * 60 * 1000) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
  }

  key(endpoint, params = {}) {
    return `${endpoint}:${JSON.stringify(params)}`.slice(0, 255)
  }

  set(endpoint, data, params = {}, ttl = this.defaultTTL) {
    const key = this.key(endpoint, params)
    
    // Limpiar si llegamos a max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      hits: 0
    })
  }

  get(endpoint, params = {}) {
    const key = this.key(endpoint, params)
    const entry = this.cache.get(key)

    if (!entry) return null

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return null
    }

    entry.hits++
    return entry.data
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.match(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  clear() {
    this.cache.clear()
  }

  stats() {
    let totalHits = 0
    for (const entry of this.cache.values()) {
      totalHits += entry.hits
    }
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      items: this.cache.size
    }
  }
}

// ==================== DEDUPLICACIÓN DE REQUESTS ====================
class RequestDeduplicator {
  constructor() {
    this.pending = new Map()
  }

  async deduplicate(key, fn) {
    if (this.pending.has(key)) {
      return this.pending.get(key)
    }

    const promise = fn().finally(() => {
      this.pending.delete(key)
    })

    this.pending.set(key, promise)
    return promise
  }

  clear() {
    this.pending.clear()
  }
}

// ==================== CLIENT API OPTIMIZADO ====================
class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL
    this.cache = new LocalCache()
    this.deduplicator = new RequestDeduplicator()
    this.retryConfig = {
      maxRetries: 2,
      delayMs: 500
    }
  }

  /**
   * Request genérico con todas las optimizaciones
   */
  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      cacheDuration = method === 'GET' ? 5 * 60 * 1000 : 0,
      retry = true,
      params = {}
    } = options

    const url = this._buildUrl(endpoint, params)
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(params)}`

    // Intentar obtener del caché (solo para GET)
    if (method === 'GET') {
      const cached = this.cache.get(endpoint, params)
      if (cached) {
        return { ...cached, _fromCache: true }
      }
    }

    // Deduplicar requests duplicados
    const dedupeKey = method === 'GET' ? cacheKey : null
    const requestFn = async () => {
      return this._executeRequest(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      })
    }

    let data
    if (dedupeKey) {
      data = await this.deduplicator.deduplicate(dedupeKey, requestFn)
    } else {
      data = await requestFn()
    }

    // Cachear respuestas exitosas
    if (method === 'GET' && cacheDuration > 0 && data.success) {
      this.cache.set(endpoint, data, params, cacheDuration)
    }

    return data
  }

  /**
   * Execute request con reintentos
   */
  async _executeRequest(url, options, attempt = 0) {
    try {
      const response = await fetch(url, options)

      if (!response.ok) {
        if (response.status === 429 && attempt < this.retryConfig.maxRetries) {
          // Rate limit - reintentar
          await this._sleep(this.retryConfig.delayMs * (attempt + 1))
          return this._executeRequest(url, options, attempt + 1)
        }

        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success === false) {
        throw new Error(data.error || 'Error desconocido')
      }

      return data
    } catch (error) {
      if (attempt < this.retryConfig.maxRetries && this._isRetryable(error)) {
        await this._sleep(this.retryConfig.delayMs * (attempt + 1))
        return this._executeRequest(url, options, attempt + 1)
      }

      console.error(`❌ API Error [${url}]:`, error.message)
      throw error
    }
  }

  _buildUrl(endpoint, params = {}) {
    const url = new URL(`${this.baseURL}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value)
      }
    })
    return url.toString()
  }

  _isRetryable(error) {
    const retryableErrors = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT']
    return retryableErrors.some(e => error.message.includes(e))
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ========== CASOS ==========
  async getCasos(filters = {}) {
    const params = {
      page: filters.page || 1,
      limit: filters.limit || 50,
      sort: filters.sort || '-fecha_creacion',
      ...(filters.estado && { estado: filters.estado }),
      ...(filters.prioridad && { prioridad: filters.prioridad }),
      ...(filters.cliente && { cliente: filters.cliente }),
      ...(filters.asignado_a && { asignado_a: filters.asignado_a })
    }

    const result = await this.request('/casos', {
      params,
      cacheDuration: 2 * 60 * 1000
    })

    return result.data || []
  }

  async getCaso(id) {
    const result = await this.request(`/casos/${id}`, {
      cacheDuration: 5 * 60 * 1000
    })
    return result.data
  }

  async crearCaso(caso) {
    const result = await this.request('/casos', {
      method: 'POST',
      body: JSON.stringify(caso)
    })

    // Invalidar caché
    this.cache.invalidate(/casos/)

    return result.data
  }

  async actualizarCaso(id, updates) {
    const result = await this.request(`/casos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })

    // Invalidar caché
    this.cache.invalidate(/casos|stats/)

    return result.data
  }

  // ========== ESTADÍSTICAS ==========
  async getEstadisticas() {
    const result = await this.request('/estadisticas', {
      cacheDuration: 5 * 60 * 1000
    })
    return result.data
  }

  async getDashboardStats() {
    const result = await this.request('/dashboard/stats', {
      cacheDuration: 1 * 60 * 1000
    })
    return result.data
  }

  // ========== USUARIOS ==========
  async getUsuarios(filters = {}) {
    const params = {
      page: filters.page || 1,
      limit: filters.limit || 50,
      ...(filters.rol && { rol: filters.rol }),
      ...(filters.activo !== undefined && { activo: filters.activo })
    }

    const result = await this.request('/usuarios', {
      params,
      cacheDuration: 5 * 60 * 1000
    })

    return result.data || []
  }

  async getUsuario(id) {
    const result = await this.request(`/usuarios/${id}`, {
      cacheDuration: 5 * 60 * 1000
    })
    return result.data
  }

  async crearUsuario(usuario) {
    const result = await this.request('/usuarios', {
      method: 'POST',
      body: JSON.stringify(usuario)
    })

    this.cache.invalidate(/usuarios/)

    return result.data
  }

  async actualizarUsuario(id, updates) {
    const result = await this.request(`/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })

    this.cache.invalidate(/usuarios/)

    return result.data
  }

  async getUsuariosStats() {
    const result = await this.request('/usuarios-stats', {
      cacheDuration: 5 * 60 * 1000
    })
    return result.data
  }

  // ========== CLIENTES ==========
  async getClientes() {
    const result = await this.request('/clientes', {
      cacheDuration: 10 * 60 * 1000
    })
    return result.data || []
  }

  // ========== AUTENTICACIÓN ==========
  async login(email, password) {
    const result = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })

    if (result.success) {
      // Limpiar caché al logear
      this.cache.clear()
    }

    return result
  }

  // ========== UTILIDADES ==========
  async healthCheck() {
    try {
      const result = await this.request('/health', {
        cacheDuration: 0
      })
      return result.status === 'ok'
    } catch {
      return false
    }
  }

  getCacheStats() {
    return this.cache.stats()
  }

  clearCache() {
    this.cache.clear()
  }

  invalidateCache(pattern) {
    this.cache.invalidate(pattern)
  }
}

// Instancia global
const apiClient = new APIClient(API_BASE_URL)

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { apiClient, APIClient }
}

// Disponible globalmente
if (typeof window !== 'undefined') {
  window.apiClient = apiClient
  window.APIClient = APIClient
}
