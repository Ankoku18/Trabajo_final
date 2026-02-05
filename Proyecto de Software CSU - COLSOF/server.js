import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { pool } from './db/connection.js'
import bcrypt from 'bcrypt'

const app = express()
const PORT = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../Config.env') })

// Detectar si está en Vercel
const isVercel = !!process.env.VERCEL

// Variable global para rastrear estado de BD
let dbConnected = false

// ==================== CORS (configuración para desarrollo y producción) ====================
const isDevelopment = !isVercel

const corsOptions = {
  origin: (origin, callback) => {
    // En desarrollo, permitir cualquier origen (file://, localhost, etc.)
    if (isDevelopment) {
      return callback(null, true)
    }
    
    // En producción, validar contra lista de orígenes permitidos
    const allowedOrigins = (process.env.CORS_ORIGINS || 'https://example.com')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
    
    if (!origin) return callback(null, true) // Permitir herramientas como curl o Postman
    if (allowedOrigins.includes(origin)) return callback(null, true)
    
    console.warn(`❌ CORS bloqueado: origen ${origin} no permitido`)
    return callback(new Error('Origen no permitido por CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 86400
}

// Middleware
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())

// Middleware de sanitización de entrada
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

// ==================== UTILIDADES DE VALIDACIÓN ====================

function sanitizeInput(str) {
  if (!str) return ''
  return String(str)
    .replace(/[<>\"'&]/g, '')
    .trim()
    .slice(0, 255)
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

function validatePassword(password) {
  return password && password.length >= 8
}

// ==================== RUTAS DE API (ANTES DE ARCHIVOS ESTÁTICOS) ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API running', dbConnected })
})

// Obtener todos los casos con validación de parámetros
app.get('/api/casos', async (req, res) => {
  try {
    const { estado, prioridad, cliente, asignado_a } = req.query

    // Lista de valores permitidos para prevenir SQL injection
    const estadosValidos = ['abierto', 'en_progreso', 'pausado', 'resuelto', 'cerrado', 'cancelado']
    const prioridadesValidas = ['baja', 'media', 'alta', 'urgente', 'critica']

    let query = 'SELECT * FROM casos WHERE 1=1'
    const params = []

    // Validar y sanitizar estado
    if (estado && estadosValidos.includes(estado.toLowerCase())) {
      query += ' AND estado = $' + (params.length + 1)
      params.push(estado)
    }

    // Validar y sanitizar prioridad
    if (prioridad && prioridadesValidas.includes(prioridad.toLowerCase())) {
      query += ' AND prioridad = $' + (params.length + 1)
      params.push(prioridad)
    }

    // Sanitizar búsqueda por cliente (evitar XSS)
    if (cliente) {
      const clienteSanitizado = String(cliente).replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 100)
      query += ' AND cliente ILIKE $' + (params.length + 1)
      params.push('%' + clienteSanitizado + '%')
    }

    // Sanitizar asignado_a
    if (asignado_a) {
      const asignadoSanitizado = String(asignado_a).replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 100)
      query += ' AND asignado_a = $' + (params.length + 1)
      params.push(asignadoSanitizado)
    }

    query += ' ORDER BY fecha_creacion DESC LIMIT 500'

    const result = await pool.query(query, params)

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    })
  } catch (error) {
    console.error('Error en /api/casos:', error)
    res.status(500).json({
      success: false,
      error: 'Error al obtener casos'
    })
  }
})

// Obtener caso por ID con validación
app.get('/api/casos/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // Validar que el ID sea un formato válido
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de ID invalido'
      })
    }

    const result = await pool.query('SELECT * FROM casos WHERE id = $1', [id])

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
      error: 'Error al obtener caso'
    })
  }
})

// Crear caso
app.post('/api/casos', async (req, res) => {
  try {
    const {
      id,
      cliente,
      sede,
      contacto,
      correo,
      telefono,
      tipo,
      categoria,
      descripcion,
      prioridad,
      autor
    } = req.body

    // Validación de campos requeridos
    if (!cliente || !sede || !categoria || !descripcion) {
      return res.status(400).json({
        success: false,
        error: 'Los campos cliente, sede, categoria y descripcion son requeridos'
      })
    }

    // Sanitizar entradas
    const clienteSanitizado = sanitizeInput(cliente)
    const sedeSanitizada = sanitizeInput(sede)
    const categoriaSanitizada = sanitizeInput(categoria)
    const descripcionSanitizada = sanitizeInput(descripcion)

    const result = await pool.query(
      `INSERT INTO casos 
       (id, cliente, sede, contacto, correo, telefono, tipo, categoria, descripcion, prioridad, autor, estado, fecha_creacion, fecha_actualizacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Abierto', NOW(), NOW())
       RETURNING *`,
      [id, clienteSanitizado, sedeSanitizada, sanitizeInput(contacto), sanitizeInput(correo), sanitizeInput(telefono), sanitizeInput(tipo), categoriaSanitizada, descripcionSanitizada, sanitizeInput(prioridad), sanitizeInput(autor)]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error en POST /api/casos:', error)
    res.status(500).json({
      success: false,
      error: 'Error al crear caso'
    })
  }
})

// Actualizar caso
app.put('/api/casos/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    // Validar ID
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de ID invalido'
      })
    }

    // Campos permitidos para actualización
    const camposPermitidos = ['estado', 'prioridad', 'categoria', 'descripcion', 'asignado_a', 'tecnico']
    const keys = Object.keys(updates).filter(key => camposPermitidos.includes(key))
    
    if (keys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos validos para actualizar'
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

    const result = await pool.query(query, [...values, id])

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
    console.error('Error en PUT /api/casos/:id:', error)
    res.status(500).json({
      success: false,
      error: 'Error al actualizar caso'
    })
  }
})

// Estadísticas
app.get('/api/estadisticas', async (req, res) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM casos'),
      pool.query('SELECT estado, COUNT(*) as count FROM casos GROUP BY estado'),
      pool.query('SELECT prioridad, COUNT(*) as count FROM casos GROUP BY prioridad'),
      pool.query('SELECT asignado_a, COUNT(*) as count FROM casos WHERE asignado_a IS NOT NULL GROUP BY asignado_a')
    ])

    res.json({
      success: true,
      data: {
        total: stats[0].rows[0].total,
        por_estado: stats[1].rows,
        por_prioridad: stats[2].rows,
        por_tecnico: stats[3].rows
      }
    })
  } catch (error) {
    console.error('Error en /api/estadisticas:', error)
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadisticas'
    })
  }
})

// ==================== USUARIOS ====================

// Obtener todos los usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const { rol, activo } = req.query

    let query = 'SELECT id, nombre, apellido, email, rol, activo, fecha_creacion FROM usuarios WHERE 1=1'
    const params = []

    // Validar rol
    const rolesValidos = ['administrador', 'gestor', 'tecnico']
    if (rol && rolesValidos.includes(rol.toLowerCase())) {
      query += ' AND rol = $' + (params.length + 1)
      params.push(rol)
    }

    if (activo !== undefined) {
      query += ' AND activo = $' + (params.length + 1)
      params.push(activo === 'true')
    }

    query += ' ORDER BY rol, nombre LIMIT 200'

    const result = await pool.query(query, params)

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    })
  } catch (error) {
    console.error('Error en /api/usuarios:', error)
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios'
    })
  }
})

// Obtener usuario por ID
app.get('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // Validar ID numérico
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de ID invalido'
      })
    }

    const result = await pool.query(
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
      error: 'Error al obtener usuario'
    })
  }
})

// Crear usuario con hash de contraseña
app.post('/api/usuarios', async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol } = req.body

    // Validación de entrada
    if (!nombre || !apellido || !email || !password || !rol) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos: nombre, apellido, email, password, rol'
      })
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de email invalido'
      })
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 8 caracteres'
      })
    }

    // Verificar si el email ya existe
    const existingUser = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email.toLowerCase()]
    )
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'El email ya esta registrado'
      })
    }

    // Hashear la contraseña
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Insertar usuario con contraseña hasheada
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, apellido, email, password, rol, activo, fecha_creacion, fecha_actualizacion)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING id, nombre, apellido, email, rol, activo, fecha_creacion`,
      [sanitizeInput(nombre), sanitizeInput(apellido), email.toLowerCase(), hashedPassword, rol]
    )

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error en POST /api/usuarios:', error)
    res.status(500).json({
      success: false,
      error: 'Error al crear usuario'
    })
  }
})

// Actualizar usuario
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    // Validar ID
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de ID invalido'
      })
    }

    // Campos permitidos para actualización
    const camposPermitidos = ['nombre', 'apellido', 'email', 'rol', 'activo']
    const keys = Object.keys(updates).filter(key => camposPermitidos.includes(key))

    if (keys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos validos para actualizar'
      })
    }

    const values = keys.map(key => {
      if (key === 'email') {
        return String(updates[key]).toLowerCase()
      }
      return sanitizeInput(updates[key])
    })
    const setClauses = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ')

    const query = `
      UPDATE usuarios 
      SET ${setClauses}, fecha_actualizacion = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING id, nombre, apellido, email, rol, activo, fecha_creacion
    `

    const result = await pool.query(query, [...values, id])

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
    console.error('Error en PUT /api/usuarios/:id:', error)
    res.status(500).json({
      success: false,
      error: 'Error al actualizar usuario'
    })
  }
})

// Estadísticas de usuarios
app.get('/api/usuarios-stats', async (req, res) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM usuarios'),
      pool.query('SELECT rol, COUNT(*) as count FROM usuarios GROUP BY rol'),
      pool.query('SELECT COUNT(*) as count FROM usuarios WHERE activo = true'),
    ])

    res.json({
      success: true,
      data: {
        total: stats[0].rows[0].total,
        por_rol: stats[1].rows,
        activos: stats[2].rows[0].count
      }
    })
  } catch (error) {
    console.error('Error en /api/usuarios-stats:', error)
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadisticas de usuarios'
    })
  }
})

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  })
})

// Iniciar servidor solo en modo local. En Vercel exportamos el handler sin levantar listener.
if (!isVercel) {
  app.listen(PORT, async () => {
    console.log(`✅ Servidor API ejecutandose en http://localhost:${PORT}`)
    
    // Verificar conexión a BD al iniciar
    try {
      const client = await pool.connect()
      const result = await client.query('SELECT current_database() as db, current_user as user')
      client.release()
      dbConnected = true
      console.log(`✅ Conexion a BD exitosa: ${result.rows[0].db} (${result.rows[0].user})`)
    } catch (error) {
      console.error(`❌ Error en conexion a BD: ${error.message}`)
      console.log('⚠️  El servidor continua ejecutandose, pero las queries fallaran.')
    }
    
    console.log(`📊 Endpoints disponibles:`)
    console.log(`   GET  http://localhost:${PORT}/api/health`)
    console.log(`   GET  http://localhost:${PORT}/api/casos`)
    console.log(`   GET  http://localhost:${PORT}/api/casos/:id`)
    console.log(`   POST http://localhost:${PORT}/api/casos`)
    console.log(`   PUT  http://localhost:${PORT}/api/casos/:id`)
    console.log(`   GET  http://localhost:${PORT}/api/estadisticas`)
    console.log(`   GET  http://localhost:${PORT}/api/usuarios`)
    console.log(`   GET  http://localhost:${PORT}/api/usuarios/:id`)
    console.log(`   POST http://localhost:${PORT}/api/usuarios`)
    console.log(`   PUT  http://localhost:${PORT}/api/usuarios/:id`)
    console.log(`   GET  http://localhost:${PORT}/api/usuarios-stats`)
    console.log(`\n🌐 Abre http://localhost:${PORT} en tu navegador`)
  })
}

// Exportar app para Vercel (serverless handler)
export default app
