import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
import {
  pool,
  queryWithRetry,
  parallelQueries,
  getPoolHealth,
  testConnection
} from './db/connection-optimized.js'
import {
  compressionMiddleware,
  generalLimiter,
  loginLimiter,
  writeLimiter,
  cacheMiddleware,
  CacheManager,
  validateInput,
  performanceLogger,
  securityHeaders,
  sanitizeInput,
  validateEmail,
  validatePassword
} from './shared/performance-middleware.js'

const app = express()
const PORT = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../Config.env') })

const isVercel = !!process.env.VERCEL
const isDevelopment = !isVercel
let dbConnected = false

// ==================== CORS ====================
const corsOptions = {
  origin: (origin, callback) => {
    if (isDevelopment) {
      return callback(null, true)
    }
    
    const allowedOrigins = (process.env.CORS_ORIGINS || 'https://example.com')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
    
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    
    console.warn(`❌ CORS bloqueado: origen ${origin} no permitido`)
    return callback(new Error('Origen no permitido por CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 86400
}

// ==================== MIDDLEWARE GLOBAL ====================
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// Compresión (PRIMERO para máxima eficiencia)
app.use(compressionMiddleware)

// Rate limiting general
app.use(generalLimiter)

// Parseo de JSON
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// Headers de seguridad
app.use(securityHeaders)

// Logger de rendimiento
app.use(performanceLogger)

// Sanitización de entrada
app.use((req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim()
      }
    }
  }
  next()
})

// ==================== ARCHIVOS ESTÁTICOS ====================
app.use(express.static(__dirname + '/..'))

// Cache de archivos estáticos
app.use((req, res, next) => {
  if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  }
  next()
})

// ==================== HEALTH CHECK ====================
app.get('/api/health', async (req, res) => {
  try {
    const poolHealth = await getPoolHealth()
    res.json({
      status: 'ok',
      message: 'API running',
      dbConnected,
      pool: poolHealth,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    })
  }
})

// ==================== AUTENTICACIÓN ====================
app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      })
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email inválido'
      })
    }

    // Buscar usuario por email (con caché)
    const cachedUser = CacheManager.get(`user:${email}`)
    if (cachedUser) {
      const passwordMatch = await bcrypt.compare(password, cachedUser.password)
      if (passwordMatch && cachedUser.activo) {
        return res.json({
          success: true,
          data: {
            id: cachedUser.id,
            nombre: cachedUser.nombre,
            apellido: cachedUser.apellido,
            email: cachedUser.email,
            rol: cachedUser.rol
          }
        })
      } else if (!cachedUser.activo) {
        return res.status(403).json({
          success: false,
          error: 'Usuario inactivo. Contacta al administrador.'
        })
      }
    }

    const userResult = await queryWithRetry(
      'SELECT id, nombre, apellido, email, password, rol, activo FROM usuarios WHERE email = $1',
      [email.toLowerCase()]
    )

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      })
    }

    const usuario = userResult.rows[0]

    if (!usuario.activo) {
      return res.status(403).json({
        success: false,
        error: 'Usuario inactivo. Contacta al administrador.'
      })
    }

    const passwordMatch = await bcrypt.compare(password, usuario.password)
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña incorrecta'
      })
    }

    // Cachear usuario
    CacheManager.set(`user:${email}`, usuario, 10 * 60 * 1000)

    // Registrar último acceso
    await queryWithRetry(
      'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1',
      [usuario.id]
    )

    // Invalidar caché de estadísticas
    CacheManager.invalidatePattern(/stats|estadisticas/)

    res.json({
      success: true,
      data: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol
      }
    })
  } catch (error) {
    console.error('Error en POST /api/login:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// ==================== CASOS - ENDPOINTS OPTIMIZADOS ====================

/**
 * GET /api/casos
 * Parámetros: ?page=1&limit=50&estado=abierto&prioridad=alta&cliente=ejemplo&asignado_a=5
 * Retorna: casos con paginación
 */
app.get('/api/casos', cacheMiddleware(2 * 60 * 1000), async (req, res) => {
  try {
    const { estado, prioridad, cliente, asignado_a, page = 1, limit = 50, sort = '-fecha_creacion' } = req.query
    
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit))
    const pageSize = Math.min(100, parseInt(limit))

    // Validar parámetros
    const estadosValidos = ['abierto', 'en_progreso', 'pausado', 'resuelto', 'cerrado', 'cancelado']
    const prioridadesValidas = ['baja', 'media', 'alta', 'urgente', 'critica']

    let query = 'SELECT id, cliente, sede, categoria, descripcion, estado, prioridad, asignado_a, fecha_creacion FROM casos WHERE 1=1'
    const params = []

    if (estado && estadosValidos.includes(estado.toLowerCase())) {
      query += ' AND estado = $' + (params.length + 1)
      params.push(estado)
    }

    if (prioridad && prioridadesValidas.includes(prioridad.toLowerCase())) {
      query += ' AND prioridad = $' + (params.length + 1)
      params.push(prioridad)
    }

    if (cliente) {
      query += ' AND cliente ILIKE $' + (params.length + 1)
      params.push('%' + sanitizeInput(cliente) + '%')
    }

    if (asignado_a) {
      query += ' AND asignado_a = $' + (params.length + 1)
      params.push(asignado_a)
    }

    // Sorting
    const sortField = sort.replace('-', '').replace('+', '')
    const sortDir = sort.startsWith('-') ? 'DESC' : 'ASC'
    const validSortFields = ['fecha_creacion', 'fecha_actualizacion', 'prioridad', 'estado']
    
    if (validSortFields.includes(sortField)) {
      query += ` ORDER BY ${sortField} ${sortDir}`
    } else {
      query += ' ORDER BY fecha_creacion DESC'
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(pageSize, offset)

    const [result, countResult] = await Promise.all([
      queryWithRetry(query, params),
      queryWithRetry('SELECT COUNT(*) as total FROM casos WHERE 1=1' + 
        (estado && estadosValidos.includes(estado.toLowerCase()) ? ` AND estado = '${estado}'` : '') +
        (prioridad && prioridadesValidas.includes(prioridad.toLowerCase()) ? ` AND prioridad = '${prioridad}'` : '') +
        (cliente ? ` AND cliente ILIKE '%${sanitizeInput(cliente)}%'` : '') +
        (asignado_a ? ` AND asignado_a = '${asignado_a}'` : '')
      )
    ])

    const total = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(total / pageSize)

    res.json({
      success: true,
      pagination: {
        page: Math.max(1, parseInt(page)),
        limit: pageSize,
        total,
        totalPages,
        hasMore: Math.max(1, parseInt(page)) < totalPages
      },
      data: result.rows
    })
  } catch (error) {
    console.error('Error en /api/casos:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/casos/:id
 * Retorna caso por ID con caché
 */
app.get('/api/casos/:id', cacheMiddleware(5 * 60 * 1000), async (req, res) => {
  try {
    const { id } = req.params

    if (!/^[a-zA-Z0-9_\-]+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de ID inválido'
      })
    }

    const result = await queryWithRetry(
      'SELECT * FROM casos WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Caso no encontrado'
      })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error en /api/casos/:id:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/casos
 * Crear nuevo caso
 */
app.post('/api/casos', writeLimiter, async (req, res) => {
  try {
    const { id, cliente, sede, contacto, correo, telefono, tipo, categoria, descripcion, prioridad, autor } = req.body

    if (!cliente || !sede || !categoria || !descripcion) {
      return res.status(400).json({
        success: false,
        error: 'Los campos cliente, sede, categoria y descripcion son requeridos',
        required: ['cliente', 'sede', 'categoria', 'descripcion']
      })
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'El campo id es requerido'
      })
    }

    const result = await queryWithRetry(
      `INSERT INTO casos 
       (id, cliente, sede, contacto, correo, telefono, tipo, categoria, descripcion, prioridad, autor, estado, fecha_creacion, fecha_actualizacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'abierto', NOW(), NOW())
       RETURNING *`,
      [
        id,
        sanitizeInput(cliente),
        sanitizeInput(sede),
        sanitizeInput(contacto),
        sanitizeInput(correo),
        sanitizeInput(telefono),
        sanitizeInput(tipo),
        sanitizeInput(categoria),
        sanitizeInput(descripcion),
        sanitizeInput(prioridad),
        sanitizeInput(autor)
      ]
    )

    // Invalidar caché
    CacheManager.invalidatePattern(/casos/)

    res.status(201).json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error en POST /api/casos:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * PUT /api/casos/:id
 * Actualizar caso
 */
app.put('/api/casos/:id', writeLimiter, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    if (!/^[a-zA-Z0-9_\-]+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de ID inválido'
      })
    }

    const camposPermitidos = ['estado', 'prioridad', 'categoria', 'descripcion', 'asignado_a', 'tecnico', 'contacto', 'correo', 'telefono']
    const keys = Object.keys(updates).filter(key => camposPermitidos.includes(key))

    if (keys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos válidos para actualizar'
      })
    }

    const values = keys.map(key => sanitizeInput(updates[key]))
    const setClauses = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ')

    const query = `
      UPDATE casos 
      SET ${setClauses}, fecha_actualizacion = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *
    `

    const result = await queryWithRetry(query, [...values, id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Caso no encontrado'
      })
    }

    // Invalidar caché
    CacheManager.invalidatePattern(/casos|stats|estadisticas/)

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error en PUT /api/casos/:id:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// ==================== ESTADÍSTICAS OPTIMIZADAS ====================

/**
 * GET /api/estadisticas
 * Retorna estadísticas agrupadas por estado, prioridad y técnico
 * Usa queries en paralelo para máxima velocidad
 */
app.get('/api/estadisticas', cacheMiddleware(5 * 60 * 1000), async (req, res) => {
  try {
    const queries = [
      { sql: 'SELECT COUNT(*)::int as total FROM casos', params: [] },
      { sql: 'SELECT estado, COUNT(*)::int as count FROM casos GROUP BY estado', params: [] },
      { sql: 'SELECT prioridad, COUNT(*)::int as count FROM casos GROUP BY prioridad', params: [] },
      { sql: 'SELECT asignado_a, COUNT(*)::int as count FROM casos WHERE asignado_a IS NOT NULL GROUP BY asignado_a', params: [] }
    ]

    const results = await parallelQueries(queries)

    res.json({
      success: true,
      data: {
        total: results[0].rows[0]?.total || 0,
        por_estado: results[1].rows,
        por_prioridad: results[2].rows,
        por_tecnico: results[3].rows
      }
    })
  } catch (error) {
    console.error('Error en /api/estadisticas:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/dashboard/stats
 * Endpoint rápido para dashboard
 */
app.get('/api/dashboard/stats', cacheMiddleware(1 * 60 * 1000), async (req, res) => {
  try {
    const stats = await parallelQueries([
      { sql: 'SELECT COUNT(*)::int as total FROM casos', params: [] },
      { sql: 'SELECT COUNT(*)::int as count FROM casos WHERE estado = $1', params: ['pausado'] },
      { sql: 'SELECT COUNT(*)::int as count FROM casos WHERE estado = $1', params: ['resuelto'] },
      { sql: 'SELECT COUNT(*)::int as count FROM casos WHERE estado = $1', params: ['cerrado'] }
    ])

    res.json({
      success: true,
      data: {
        total_casos: stats[0].rows[0]?.total || 0,
        pausados: stats[1].rows[0]?.count || 0,
        resueltos: stats[2].rows[0]?.count || 0,
        cerrados: stats[3].rows[0]?.count || 0
      }
    })
  } catch (error) {
    console.error('Error en /api/dashboard/stats:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// ==================== CLIENTES ====================

app.get('/api/clientes', cacheMiddleware(10 * 60 * 1000), async (req, res) => {
  try {
    const result = await queryWithRetry(
      `SELECT DISTINCT cliente as nombre FROM casos WHERE cliente IS NOT NULL ORDER BY cliente`
    )

    const data = result.rows.map((row, idx) => ({
      id: idx + 1,
      nombre: row.nombre,
      estado: 'Activo'
    }))

    res.json({ success: true, count: data.length, data })
  } catch (error) {
    console.error('Error en /api/clientes:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// ==================== USUARIOS ====================

app.get('/api/usuarios', cacheMiddleware(5 * 60 * 1000), async (req, res) => {
  try {
    const { rol, activo, page = 1, limit = 50 } = req.query

    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit))
    const pageSize = Math.min(100, parseInt(limit))

    const rolesValidos = ['administrador', 'gestor', 'tecnico']
    let query = 'SELECT id, nombre, apellido, email, rol, activo, fecha_creacion FROM usuarios WHERE 1=1'
    const params = []

    if (rol && rolesValidos.includes(rol.toLowerCase())) {
      query += ' AND rol = $' + (params.length + 1)
      params.push(rol)
    }

    if (activo !== undefined) {
      query += ' AND activo = $' + (params.length + 1)
      params.push(activo === 'true')
    }

    query += ' ORDER BY rol, nombre'
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(pageSize, offset)

    const [result, countResult] = await Promise.all([
      queryWithRetry(query, params),
      queryWithRetry('SELECT COUNT(*) as total FROM usuarios')
    ])

    const total = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(total / pageSize)

    res.json({
      success: true,
      pagination: {
        page: Math.max(1, parseInt(page)),
        limit: pageSize,
        total,
        totalPages
      },
      data: result.rows
    })
  } catch (error) {
    console.error('Error en /api/usuarios:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.get('/api/usuarios/:id', cacheMiddleware(5 * 60 * 1000), async (req, res) => {
  try {
    const { id } = req.params

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de ID inválido'
      })
    }

    const result = await queryWithRetry(
      'SELECT id, nombre, apellido, email, rol, activo, fecha_creacion FROM usuarios WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error en /api/usuarios/:id:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/usuarios', writeLimiter, async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol } = req.body

    if (!nombre || !apellido || !email || !password || !rol) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos',
        required: ['nombre', 'apellido', 'email', 'password', 'rol']
      })
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email inválido'
      })
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 8 caracteres'
      })
    }

    // Verificar email único
    const existing = await queryWithRetry(
      'SELECT id FROM usuarios WHERE email = $1',
      [email.toLowerCase()]
    )

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Email ya registrado'
      })
    }

    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    const result = await queryWithRetry(
      `INSERT INTO usuarios (nombre, apellido, email, password, rol, activo, fecha_creacion, fecha_actualizacion)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING id, nombre, apellido, email, rol, activo, fecha_creacion`,
      [sanitizeInput(nombre), sanitizeInput(apellido), email.toLowerCase(), hashedPassword, rol]
    )

    CacheManager.invalidatePattern(/usuarios|stats/)

    res.status(201).json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error en POST /api/usuarios:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.put('/api/usuarios/:id', writeLimiter, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de ID inválido'
      })
    }

    const camposPermitidos = ['nombre', 'apellido', 'email', 'rol', 'activo']
    const keys = Object.keys(updates).filter(key => camposPermitidos.includes(key))

    if (keys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos válidos para actualizar'
      })
    }

    const values = keys.map(key => {
      if (key === 'email') return String(updates[key]).toLowerCase()
      return sanitizeInput(updates[key])
    })

    const setClauses = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ')

    const query = `
      UPDATE usuarios 
      SET ${setClauses}, fecha_actualizacion = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING id, nombre, apellido, email, rol, activo, fecha_creacion
    `

    const result = await queryWithRetry(query, [...values, id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      })
    }

    CacheManager.invalidatePattern(/usuarios|stats/)

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error en PUT /api/usuarios/:id:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.get('/api/usuarios-stats', cacheMiddleware(5 * 60 * 1000), async (req, res) => {
  try {
    const stats = await parallelQueries([
      { sql: 'SELECT COUNT(*)::int as total FROM usuarios', params: [] },
      { sql: 'SELECT rol, COUNT(*)::int as count FROM usuarios GROUP BY rol', params: [] },
      { sql: 'SELECT COUNT(*)::int as count FROM usuarios WHERE activo = true', params: [] }
    ])

    res.json({
      success: true,
      data: {
        total: stats[0].rows[0]?.total || 0,
        por_rol: stats[1].rows,
        activos: stats[2].rows[0]?.count || 0
      }
    })
  } catch (error) {
    console.error('Error en /api/usuarios-stats:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// ==================== MANEJO DE ERRORES ====================

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta de API no encontrada'
  })
})

app.use((req, res) => {
  const filePath = path.join(__dirname, '..', req.path)
  if (filePath.includes('..') || !filePath.startsWith(__dirname)) {
    return res.status(404).json({
      success: false,
      error: 'Ruta no encontrada'
    })
  }
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  })
})

app.use((err, req, res, next) => {
  console.error('Error no manejado:', err)
  res.status(500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  })
})

export default app

// ==================== INICIO DE SERVIDOR ====================
if (!isVercel) {
  app.listen(PORT, async () => {
    console.log(`\n✅ Servidor API ejecutándose en http://localhost:${PORT}`)
    console.log(`📦 Modo: ${isDevelopment ? 'Desarrollo' : 'Producción'}`)
    
    try {
      const testResult = await testConnection()
      if (testResult.success) {
        dbConnected = true
        console.log(`✅ Conexión a BD exitosa: ${testResult.database} (${testResult.user})`)
        console.log(`   Tiempo de conexión: ${testResult.duration}ms`)
      } else {
        console.error(`❌ Error en conexión a BD: ${testResult.error}`)
      }
    } catch (error) {
      console.error(`❌ Error al probar BD: ${error.message}`)
    }
    
    console.log(`\n📊 ENDPOINTS OPTIMIZADOS:`)
    console.log(`\n   AUTENTICACIÓN:`)
    console.log(`      POST http://localhost:${PORT}/api/login`)
    console.log(`\n   CASOS (con paginación y caché):`)
    console.log(`      GET  http://localhost:${PORT}/api/casos?page=1&limit=50&estado=abierto`)
    console.log(`      GET  http://localhost:${PORT}/api/casos/:id`)
    console.log(`      POST http://localhost:${PORT}/api/casos`)
    console.log(`      PUT  http://localhost:${PORT}/api/casos/:id`)
    console.log(`\n   ESTADÍSTICAS (con queries paralelas):`)
    console.log(`      GET  http://localhost:${PORT}/api/estadisticas`)
    console.log(`      GET  http://localhost:${PORT}/api/dashboard/stats`)
    console.log(`\n   USUARIOS (con paginación):`)
    console.log(`      GET  http://localhost:${PORT}/api/usuarios?page=1&limit=50`)
    console.log(`      GET  http://localhost:${PORT}/api/usuarios/:id`)
    console.log(`      POST http://localhost:${PORT}/api/usuarios`)
    console.log(`      PUT  http://localhost:${PORT}/api/usuarios/:id`)
    console.log(`      GET  http://localhost:${PORT}/api/usuarios-stats`)
    console.log(`\n   SISTEMA:`)
    console.log(`      GET  http://localhost:${PORT}/api/health`)
    console.log(`\n🚀 Lista completa: http://localhost:${PORT}`)
  })
}
