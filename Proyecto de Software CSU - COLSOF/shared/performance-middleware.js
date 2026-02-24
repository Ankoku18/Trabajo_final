import compression from 'compression'
import rateLimit from 'express-rate-limit'

/**
 * Middleware de Rendimiento y Seguridad
 * Incluye: compresión, rate limiting, validación, caché
 */

// ==================== COMPRESIÓN ====================
// Comprimir todas las respuestas texto/json > 1KB
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false
    }
    return compression.filter(req, res)
  },
  level: 6, // Balance entre compresión y CPU
  threshold: 1024 // Solo si > 1KB
})

// ==================== RATE LIMITING ====================
// Límites separados por endpoint para máxima flexibilidad
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por ventana
  keyGenerator: (req) => {
    // Usar IP real con proxy X-Forwarded-For
    return req.ip || req.connection.remoteAddress
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes. Intenta más tarde.'
    })
  },
  skip: (req) => req.path === '/api/health'
})

// Rate limit más estricto para login
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 intentos por 15 minutos
  keyGenerator: (req) => {
    // Limitar por email + IP
    const email = req.body?.email || ''
    return `${email}-${req.ip}`
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiados intentos de login. Intenta en 15 minutos.'
    })
  }
})

// Rate limit moderado para write operations
export const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 operaciones por minuto
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Límite de escritura alcanzado. Intenta más tarde.'
    })
  }
})

// ==================== CACHÉ EN MEMORIA ====================
const cacheStore = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos por defecto

export class CacheManager {
  static set(key, value, duration = CACHE_DURATION) {
    const expiresAt = Date.now() + duration
    cacheStore.set(key, { value, expiresAt })
  }

  static get(key) {
    const entry = cacheStore.get(key)
    if (!entry) return null
    
    if (entry.expiresAt < Date.now()) {
      cacheStore.delete(key)
      return null
    }
    
    return entry.value
  }

  static delete(key) {
    cacheStore.delete(key)
  }

  static clear() {
    cacheStore.clear()
  }

  static invalidatePattern(pattern) {
    for (const key of cacheStore.keys()) {
      if (key.match(pattern)) {
        cacheStore.delete(key)
      }
    }
  }

  static size() {
    return cacheStore.size
  }
}

// Middleware de caché para GET
export function cacheMiddleware(duration = CACHE_DURATION) {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next()
    }

    const cacheKey = `${req.path}:${JSON.stringify(req.query)}`.slice(0, 256)
    const cached = CacheManager.get(cacheKey)

    if (cached) {
      res.set('X-Cache', 'HIT')
      return res.json(cached)
    }

    // Guardar respuesta original
    const originalJson = res.json.bind(res)
    res.json = function(data) {
      if (res.statusCode === 200) {
        CacheManager.set(cacheKey, data, duration)
      }
      res.set('X-Cache', 'MISS')
      return originalJson(data)
    }

    next()
  }
}

// ==================== VALIDACIÓN DE ENTRADA ====================
export function validateInput(schema) {
  return (req, res, next) => {
    try {
      const errors = []

      for (const [field, rules] of Object.entries(schema)) {
        const value = req.body[field]

        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`${field} es requerido`)
        }

        if (value !== undefined && value !== null) {
          if (rules.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(value)) {
              errors.push(`${field} debe ser un email válido`)
            }
          }

          if (rules.type === 'number' && isNaN(value)) {
            errors.push(`${field} debe ser un número`)
          }

          if (rules.minLength && String(value).length < rules.minLength) {
            errors.push(`${field} debe tener mínimo ${rules.minLength} caracteres`)
          }

          if (rules.maxLength && String(value).length > rules.maxLength) {
            errors.push(`${field} debe tener máximo ${rules.maxLength} caracteres`)
          }

          if (rules.enum && !rules.enum.includes(value)) {
            errors.push(`${field} debe ser uno de: ${rules.enum.join(', ')}`)
          }
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validación fallida',
          errors
        })
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

// ==================== LOGGING DE RENDIMIENTO ====================
export function performanceLogger(req, res, next) {
  const startTime = Date.now()
  const startMemory = process.memoryUsage().heapUsed

  const originalJson = res.json.bind(res)
  res.json = function(data) {
    const duration = Date.now() - startTime
    const memoryDelta = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024

    const logLevel = duration > 1000 ? '⚠️' : '✓'
    console.log(`${logLevel} ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms (${memoryDelta.toFixed(2)}MB)`)

    res.set('X-Response-Time', `${duration}ms`)
    
    if (duration > 1000) {
      console.warn(`  ⚠️ Endpoint lento detectado: ${req.path}`)
    }

    return originalJson(data)
  }

  next()
}

// ==================== HEADERS DE SEGURIDAD ====================
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:;")
  
  next()
}

// ==================== SANITIZACIÓN ====================
export function sanitizeInput(str) {
  if (!str) return ''
  return String(str)
    .replace(/[<>\"'&]/g, '')
    .trim()
    .slice(0, 255)
}

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export function validatePassword(password) {
  return password && password.length >= 8
}
