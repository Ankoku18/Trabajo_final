import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcrypt'
import { pool } from '../Proyecto de Software CSU - COLSOF/db/connection.js'

const app = express()
const PORT = process.env.PORT || 3000

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Variable global para rastrear estado de BD
let dbConnected = false

// Middleware
app.use(cors())
app.use(express.json())

// ==================== ARCHIVOS ESTÁTICOS ====================

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(__dirname + '/..'))

// Headers para archivos estáticos
app.use((req, res, next) => {
  if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  }
  next()
})

// ==================== RUTAS DE API (ANTES DE ARCHIVOS ESTÁTICOS) ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API running', dbConnected })
})

// Compatibilidad con endpoints legacy basados en ?action=
app.get('/api', async (req, res) => {
  const { action } = req.query
  try {
    if (action === 'get_casos_simple') {
      const result = await pool.query('SELECT * FROM casos ORDER BY fecha_creacion DESC')
      return res.json({ cases: result.rows })
    }

    if (action === 'get_dashboard_stats') {
      const stats = await Promise.all([
        pool.query('SELECT COUNT(*)::int as total FROM casos'),
        pool.query("SELECT COUNT(*)::int as count FROM casos WHERE estado = 'pausado'"),
        pool.query("SELECT COUNT(*)::int as count FROM casos WHERE estado = 'resuelto'"),
        pool.query("SELECT COUNT(*)::int as count FROM casos WHERE estado = 'cerrado'"),
        pool.query("SELECT COUNT(*)::int as count FROM casos WHERE estado = 'abierto' OR estado = 'en_progreso'")
      ])

      return res.json({
        total_casos: stats[0].rows[0].total,
        pausados: stats[1].rows[0].count,
        resueltos: stats[2].rows[0].count,
        cerrados: stats[3].rows[0].count,
        pendientes: stats[4].rows[0].count,
        reportes_generados: 0,
        usuarios_activos: 0
      })
    }

    if (action === 'get_recent_reports') {
      const result = await pool.query(
        'SELECT id, cliente, fecha_creacion, categoria FROM casos ORDER BY fecha_creacion DESC LIMIT 8'
      )
      return res.json(result.rows)
    }

    if (action === 'get_next_id') {
      const result = await pool.query(
        "SELECT MAX(id::bigint) as max_id FROM casos WHERE id ~ '^[0-9]+$'"
      )
      const maxId = result.rows[0]?.max_id || 0
      return res.json({ new_id: String(Number(maxId) + 1) })
    }

    if (action === 'get_notifications') {
      return res.json([])
    }

    return res.status(400).json({ success: false, error: 'Acción no soportada' })
  } catch (error) {
    console.error('Error en /api (legacy):', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api', async (req, res) => {
  const { action } = req.query
  try {
    if (action === 'update_case') {
      const { id, estado, descripcion } = req.body
      const result = await pool.query(
        'UPDATE casos SET estado = $1, descripcion = $2, fecha_actualizacion = NOW() WHERE id = $3 RETURNING *',
        [estado, descripcion, id]
      )
      return res.json({ success: result.rows.length > 0, data: result.rows[0] })
    }

    if (action === 'delete_case') {
      const { id } = req.body
      const result = await pool.query('DELETE FROM casos WHERE id = $1 RETURNING id', [id])
      return res.json({ success: result.rows.length > 0 })
    }

    if (action === 'save_case') {
      const data = req.body || {}
      const nextIdResult = await pool.query(
        "SELECT MAX(id::bigint) as max_id FROM casos WHERE id ~ '^[0-9]+$'"
      )
      const maxId = nextIdResult.rows[0]?.max_id || Date.now()
      const newId = String(data.id || Number(maxId) + 1)

      const result = await pool.query(
        `INSERT INTO casos (
          id, cliente, sede, contacto, correo, telefono,
          contacto2, correo2, telefono2, centro_costos,
          serial, marca, tipo, categoria, descripcion,
          asignado_a, prioridad, estado, autor,
          fecha_creacion, fecha_actualizacion
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,
          $11,$12,$13,$14,$15,
          $16,$17,$18,$19,
          NOW(), NOW()
        ) RETURNING *`,
        [
          newId,
          data.cliente || null,
          data.sede || null,
          data.contacto || null,
          data.correo || null,
          data.telefono || null,
          data.contacto2 || null,
          data.correo2 || null,
          data.telefono2 || null,
          data.centro_costos || null,
          data.serial || null,
          data.marca || null,
          data.tipo || null,
          data.categoria || null,
          data.descripcion || null,
          data.asignado || data.asignado_a || null,
          data.prioridad || null,
          data.estado || 'Abierto',
          data.autor || null
        ]
      )

      return res.json({ success: true, data: result.rows[0] })
    }

    return res.status(400).json({ success: false, error: 'Acción no soportada' })
  } catch (error) {
    console.error('Error en /api (legacy POST):', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== AUTENTICACIÓN ====================

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // Validar que ambos campos estén presentes
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      })
    }

    // Buscar usuario por email
    const userResult = await pool.query(
      'SELECT id, nombre, apellido, email, password, rol, activo FROM usuarios WHERE email = $1',
      [email.toLowerCase()]
    )

    // Verificar si el usuario existe
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado'
      })
    }

    const usuario = userResult.rows[0]

    // Verificar si el usuario está activo
    if (!usuario.activo) {
      return res.status(403).json({
        success: false,
        error: 'Usuario inactivo. Contacta al administrador.'
      })
    }

    // Comparar contraseña con bcrypt
    const passwordMatch = await bcrypt.compare(password, usuario.password)

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña incorrecta'
      })
    }

    // Autenticación exitosa - registrar último acceso
    await pool.query(
      'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1',
      [usuario.id]
    )

    // Retornar datos del usuario (sin contraseña)
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

// ==================== CASOS ====================

// Obtener todos los casos
app.get('/api/casos', async (req, res) => {
  try {
    const { estado, prioridad, cliente, asignado_a } = req.query

    let query = 'SELECT * FROM casos WHERE 1=1'
    const params = []

    if (estado) {
      query += ' AND estado = $' + (params.length + 1)
      params.push(estado)
    }
    if (prioridad) {
      query += ' AND prioridad = $' + (params.length + 1)
      params.push(prioridad)
    }
    if (cliente) {
      query += ' AND cliente ILIKE $' + (params.length + 1)
      params.push('%' + cliente + '%')
    }
    if (asignado_a) {
      query += ' AND asignado_a = $' + (params.length + 1)
      params.push(asignado_to)
    }

    query += ' ORDER BY fecha_creacion DESC'

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
      error: error.message
    })
  }
})

// Obtener caso por ID
app.get('/api/casos/:id', async (req, res) => {
  try {
    const { id } = req.params
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
      error: error.message
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

    const result = await pool.query(
      `INSERT INTO casos 
       (id, cliente, sede, contacto, correo, telefono, tipo, categoria, descripcion, prioridad, autor, estado, fecha_creacion, fecha_actualizacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Abierto', NOW(), NOW())
       RETURNING *`,
      [id, cliente, sede, contacto, correo, telefono, tipo, categoria, descripcion, prioridad, autor]
    )

    res.json({
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

// Actualizar caso
app.put('/api/casos/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    // Construir query dinámicamente
    const keys = Object.keys(updates)
    const values = Object.values(updates)
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
      error: error.message
    })
  }
})

// ==================== ESTADÍSTICAS ====================

app.get('/api/estadisticas', async (req, res) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM casos'),
      pool.query(`SELECT estado, COUNT(*) as count FROM casos GROUP BY estado`),
      pool.query(`SELECT prioridad, COUNT(*) as count FROM casos GROUP BY prioridad`),
      pool.query(`SELECT asignado_a, COUNT(*) as count FROM casos WHERE asignado_a IS NOT NULL GROUP BY asignado_a`)
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
      error: error.message
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

    if (rol) {
      query += ' AND rol = $' + (params.length + 1)
      params.push(rol)
    }
    if (activo !== undefined) {
      query += ' AND activo = $' + (params.length + 1)
      params.push(activo === 'true')
    }

    query += ' ORDER BY rol, nombre'

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
      error: error.message
    })
  }
})

// Obtener usuario por ID
app.get('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params
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
      error: error.message
    })
  }
})

// Crear usuario
app.post('/api/usuarios', async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol } = req.body

    const result = await pool.query(
      `INSERT INTO usuarios (nombre, apellido, email, password, rol, activo, fecha_creacion, fecha_actualizacion)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING id, nombre, apellido, email, rol, activo, fecha_creacion`,
      [nombre, apellido, email, password, rol]
    )

    res.json({
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

// Actualizar usuario
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const keys = Object.keys(updates)
    const values = Object.values(updates)
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
      error: error.message
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
      error: error.message
    })
  }
})

// ==================== RUTAS HTML (SPA FALLBACK) ====================

// Estas rutas deben ir después de todas las rutas de API
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'))
})

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Proyecto de Software CSU - COLSOF', 'Usuario ADMINISTRDOR', 'Menu principal Admin.html'))
})

app.get('/gestor', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Proyecto de Software CSU - COLSOF', 'Usuario GESTOR', 'Menu principal.html'))
})

// 404 para rutas API
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta de API no encontrada'
  })
})

// 404 para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  })
})

// Exportar app para Vercel (serverless handler)
export default app

// Si no está en Vercel, iniciar servidor
if (process.env.VERCEL === undefined) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`)
  })
}
