import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcrypt'
import { pool, testConnection } from '../Proyecto de Software CSU - COLSOF/db/connection.js'

const app = express()
const PORT = process.env.PORT || 3000

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Variable global para rastrear estado de BD
let dbConnected = false

// Verificar conexión a BD al iniciar
testConnection().then(result => {
  if (result.success) {
    dbConnected = true
    console.log(`✅ BD conectada: usuario=${result.user}, db=${result.database}`)
  } else {
    dbConnected = false
    console.error('❌ No se pudo conectar a la BD:', result.error)
  }
}).catch(err => {
  console.error('❌ Error al verificar conexión BD:', err.message)
})

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

// ==================== ENDPOINTS LEGACY (DEPRECADOS) ====================
// Mantener solo para compatibilidad retroactiva - usar endpoints RESTful
app.get('/api', async (req, res) => {
  res.status(400).json({ success: false, error: 'Usar endpoints RESTful: GET /api/casos, POST /api/casos, etc.' })
})

app.post('/api', async (req, res) => {
  res.status(400).json({ success: false, error: 'Usar endpoints RESTful: GET /api/casos, POST /api/casos, etc.' })
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
      `SELECT id_usuario as id, nombre_usuario as nombre, '' as apellido, 
              correo as email, contrasena as password, rol::text, 
              CASE WHEN estado::text = 'Activo' THEN true ELSE false END as activo
       FROM base_de_datos_csu.usuario WHERE correo = $1`,
      [email.toLowerCase()]
    )

    // Verificar si el usuario existe
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
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

    // Comparar contraseña soportando múltiples formatos:
    // 1. Hash bcrypt ($2b$... o $2a$...)
    // 2. Base64 (formato actual en BD: cGFzczEyMw== = pass123)
    // 3. Texto plano (fallback)
    let passwordMatch = false
    const storedPassword = usuario.password || ''

    if (storedPassword.match(/^\$2[ab]\$\d+\$/)) {
      // Contraseña almacenada como hash bcrypt
      passwordMatch = await bcrypt.compare(password, storedPassword)
    } else {
      // Intentar decodificación Base64
      try {
        const decoded = Buffer.from(storedPassword, 'base64').toString('utf8')
        // Verificar que el resultado sea texto legible (no caracteres raros)
        if (decoded && /^[\x20-\x7E]+$/.test(decoded)) {
          passwordMatch = (decoded === password)
        }
      } catch (_) { /* ignorar */ }
      // Si Base64 no coincidió, intentar texto plano
      if (!passwordMatch) {
        passwordMatch = (storedPassword === password)
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña incorrecta'
      })
    }

    // Autenticación exitosa - registrar último acceso (ignorar si columna no existe)
    try {
      await pool.query(
        'UPDATE base_de_datos_csu.usuario SET fecha_modificacion = NOW() WHERE id_usuario = $1',
        [usuario.id]
      )
    } catch (_) { /* columna puede no existir en todas las instalaciones */ }

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

// ==================== CASOS (usa base_de_datos_csu.ticket) ====================

// Query base para obtener tickets con JOINs
const TICKET_BASE_QUERY = `
  SELECT 
    t.id_ticket as id,
    t.estado,
    t.descripcion,
    t.fecha_creacion,
    t.fecha_actualizacion,
    c.empresa as cliente,
    c.sede,
    c.contacto_principal as contacto,
    c.correo,
    c.telefono_principal as telefono,
    cat.nombre_categoria as categoria,
    cat.prioridad,
    u_tec.nombre_usuario as asignado_a,
    u_ges.nombre_usuario as autor
  FROM base_de_datos_csu.ticket t
  LEFT JOIN base_de_datos_csu.cliente c ON c.id_cliente = t.id_cliente
  LEFT JOIN base_de_datos_csu.categoria cat ON cat.id_categoria = t.categoria_id_categoria
  LEFT JOIN base_de_datos_csu.usuario u_tec ON u_tec.id_usuario = t.tecnico_ususario_id_usuario
  LEFT JOIN base_de_datos_csu.usuario u_ges ON u_ges.id_usuario = t.gestor_ususario_id_usuario
`

// Obtener todos los casos
app.get('/api/casos', async (req, res) => {
  try {
    const { estado, prioridad, cliente, asignado_a, autor, gestor_id } = req.query

    let where = ' WHERE 1=1'
    const params = []

    if (estado) {
      where += ' AND t.estado = $' + (params.length + 1)
      params.push(estado)
    }
    if (prioridad) {
      where += ' AND cat.prioridad::text = $' + (params.length + 1)
      params.push(prioridad)
    }
    if (cliente) {
      where += ' AND c.empresa ILIKE $' + (params.length + 1)
      params.push('%' + cliente + '%')
    }
    if (asignado_a) {
      where += ' AND u_tec.nombre_usuario ILIKE $' + (params.length + 1)
      params.push('%' + asignado_a + '%')
    }
    if (autor) {
      where += ' AND u_ges.nombre_usuario ILIKE $' + (params.length + 1)
      params.push('%' + autor + '%')
    }
    if (gestor_id) {
      where += ' AND t.gestor_ususario_id_usuario = $' + (params.length + 1)
      params.push(parseInt(gestor_id, 10))
    }

    const query = TICKET_BASE_QUERY + where + ' ORDER BY t.fecha_creacion DESC'
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

// GET /api/dashboard/stats - Métricas para el dashboard
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*)::int as total_casos,
        COUNT(*) FILTER (WHERE estado = 'en_progreso')::int as en_progreso,
        COUNT(*) FILTER (WHERE estado = 'escalado')::int as escalados,
        COUNT(*) FILTER (WHERE estado = 'resuelto')::int as resueltos,
        COUNT(*) FILTER (WHERE estado = 'cerrado')::int as cerrados,
        COUNT(*) FILTER (WHERE estado = 'abierto')::int as abiertos
      FROM base_de_datos_csu.ticket
    `)

    const data = stats.rows[0]
    res.json({
      success: true,
      data: {
        total_casos: data.total_casos,
        pausados: data.escalados,  // "escalado" es equivalente a pausado en el UI
        resueltos: data.resueltos,
        cerrados: data.cerrados,
        abiertos: data.abiertos,
        en_progreso: data.en_progreso
      }
    })
  } catch (error) {
    console.error('❌ Error en /api/dashboard/stats:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.get('/api/casos/stats/summary', async (req, res) => {
  // Redirigir a endpoint unificado
  res.redirect(302, '/api/estadisticas')
})


// Obtener caso por ID
app.get('/api/casos/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      TICKET_BASE_QUERY + ' WHERE t.id_ticket = $1', [id]
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

// ==================== CLIENTES ====================

// Obtener todos los clientes
app.get('/api/clientes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_cliente as id, empresa as nombre, sede, contacto_principal as contacto,
              telefono_principal as telefono, correo, fecha_creacion
       FROM base_de_datos_csu.cliente
       ORDER BY empresa`
    )

    res.json({ success: true, count: result.rows.length, data: result.rows })
  } catch (error) {
    console.error('Error en /api/clientes:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Obtener cliente por ID
app.get('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      `SELECT id_cliente as id, empresa as nombre, sede, contacto_principal as contacto,
              telefono_principal as telefono, correo, fecha_creacion
       FROM base_de_datos_csu.cliente WHERE id_cliente = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' })
    }

    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Error en /api/clientes/:id:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Crear caso (ticket)
app.post('/api/casos', async (req, res) => {
  const client = await pool.connect()
  try {
    const {
      cliente, descripcion, categoria, estado,
      asignado_a, prioridad,
      gestor_id // id_usuario del gestor logueado (enviado desde el frontend)
    } = req.body

    await client.query('BEGIN')

    // 1. Buscar cliente por nombre de empresa
    const clienteRes = await client.query(
      `SELECT id_cliente FROM base_de_datos_csu.cliente WHERE empresa ILIKE $1 LIMIT 1`,
      [cliente]
    )
    if (!clienteRes.rows.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({ success: false, error: `Cliente "${cliente}" no encontrado en la BD` })
    }
    const idCliente = clienteRes.rows[0].id_cliente

    // 2. Buscar registro gestor por id_usuario
    const gestorRes = await client.query(
      `SELECT id_gestor, ususario_id_usuario, ususario_administrador_id_administrador
       FROM base_de_datos_csu.gestor WHERE ususario_id_usuario = $1 LIMIT 1`,
      [gestor_id]
    )
    if (!gestorRes.rows.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({ success: false, error: 'No se encontró registro de gestor para el usuario actual' })
    }
    const gestor = gestorRes.rows[0]

    // 3. Buscar categoría (por nombre aproximado)
    let categoriaId = null
    if (categoria) {
      const catRes = await client.query(
        `SELECT id_categoria FROM base_de_datos_csu.categoria WHERE nombre_categoria ILIKE $1 LIMIT 1`,
        [`%${categoria}%`]
      )
      if (catRes.rows.length) categoriaId = catRes.rows[0].id_categoria
    }
    if (!categoriaId) {
      // Usar primera categoría disponible como fallback
      const defCat = await client.query(
        `SELECT id_categoria FROM base_de_datos_csu.categoria LIMIT 1`
      )
      categoriaId = defCat.rows[0]?.id_categoria
    }

    // 4. Buscar técnico (por nombre si se especificó, si no usar el primero disponible)
    let tecnico = null
    if (asignado_a) {
      const tecRes = await client.query(
        `SELECT t.id_tecnico, t.ususario_id_usuario, t.ususario_administrador_id_administrador
         FROM base_de_datos_csu.tecnico t
         JOIN base_de_datos_csu.usuario u ON u.id_usuario = t.ususario_id_usuario
         WHERE u.nombre_usuario ILIKE $1 LIMIT 1`,
        [`%${asignado_a}%`]
      )
      if (tecRes.rows.length) tecnico = tecRes.rows[0]
    }
    if (!tecnico) {
      const defTec = await client.query(
        `SELECT id_tecnico, ususario_id_usuario, ususario_administrador_id_administrador
         FROM base_de_datos_csu.tecnico LIMIT 1`
      )
      if (!defTec.rows.length) {
        await client.query('ROLLBACK')
        return res.status(400).json({ success: false, error: 'No hay técnicos registrados en el sistema' })
      }
      tecnico = defTec.rows[0]
    }

    // 5. Normalizar estado al enum válido (abierto, en_progreso, escalado, resuelto, cerrado)
    const estadosValidos = ['abierto', 'en_progreso', 'escalado', 'resuelto', 'cerrado']
    const estadoNorm = (estado || '').toLowerCase().replace(/\s+/g, '_')
    const estadoOk = estadosValidos.includes(estadoNorm) ? estadoNorm : 'abierto'

    // 6. Para la FK circular ticket <-> seguimiento, usamos un seguimiento existente temporalmente
    const tempSegRes = await client.query(
      `SELECT id_seguimiento FROM base_de_datos_csu.seguimiento LIMIT 1`
    )
    const tempSegId = tempSegRes.rows[0]?.id_seguimiento || 1

    // 7. INSERT del ticket con todos los campos NOT NULL requeridos
    const ticketRes = await client.query(
      `INSERT INTO base_de_datos_csu.ticket
         (estado, descripcion,
          id_cliente, cliente_id_cliente,
          id_gestor, gestor_id_gestor,
          gestor_ususario_id_usuario,
          gestor_ususario_administrador_id_administrador,
          id_tecnico, tecnico_id_tecnico,
          tecnico_ususario_id_usuario,
          tecnico_ususario_administrador_id_administrador,
          seguimiento_id_seguimiento,
          categoria_id_categoria,
          fecha_creacion, fecha_actualizacion)
       VALUES (
         $1::base_de_datos_csu.estado_ticket_enum, $2,
         $3, $3,
         $4, $4, $5, $6,
         $7, $7, $8, $9,
         $10,
         $11,
         NOW(), NOW()
       )
       RETURNING *`,
      [
        estadoOk, descripcion || '',
        idCliente,
        gestor.id_gestor, gestor.ususario_id_usuario, gestor.ususario_administrador_id_administrador,
        tecnico.id_tecnico, tecnico.ususario_id_usuario, tecnico.ususario_administrador_id_administrador,
        tempSegId,
        categoriaId
      ]
    )
    const newTicket = ticketRes.rows[0]

    // 8. Crear el seguimiento inicial del ticket
    const segRes = await client.query(
      `INSERT INTO base_de_datos_csu.seguimiento
         (id_ticket, id_usuario, comentarios, tipo, fecha, estado_anterior, estado_nuevo)
       VALUES ($1, $2, 'Caso creado', 'asignacion'::base_de_datos_csu.tipo_seguimiento_enum,
               NOW(), NULL, $3::base_de_datos_csu.estado_ticket_enum)
       RETURNING id_seguimiento`,
      [newTicket.id_ticket, gestor.ususario_id_usuario, estadoOk]
    )
    const newSegId = segRes.rows[0].id_seguimiento

    // 9. Actualizar el ticket con el seguimiento real recién creado
    await client.query(
      `UPDATE base_de_datos_csu.ticket
       SET seguimiento_id_seguimiento = $1
       WHERE id_ticket = $2`,
      [newSegId, newTicket.id_ticket]
    )

    await client.query('COMMIT')

    res.status(201).json({
      success: true,
      data: { ...newTicket, seguimiento_id_seguimiento: newSegId }
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error en POST /api/casos:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  } finally {
    client.release()
  }
})

// Actualizar caso (ticket)
app.put('/api/casos/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { estado, descripcion } = req.body

    // Solo actualizar campos permitidos del ticket
    const setClauses = []
    const values = []

    if (estado) {
      setClauses.push(`estado = $${values.length + 1}::base_de_datos_csu.estado_ticket_enum`)
      values.push(estado)
    }
    if (descripcion !== undefined) {
      setClauses.push(`descripcion = $${values.length + 1}`)
      values.push(descripcion)
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay campos para actualizar' })
    }

    setClauses.push(`fecha_actualizacion = NOW()`)
    values.push(id)

    const query = `
      UPDATE base_de_datos_csu.ticket 
      SET ${setClauses.join(', ')}
      WHERE id_ticket = $${values.length}
      RETURNING *
    `

    const result = await pool.query(query, values)

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
      pool.query('SELECT COUNT(*)::int as total FROM base_de_datos_csu.ticket'),
      pool.query(`SELECT estado::text, COUNT(*)::int as count FROM base_de_datos_csu.ticket GROUP BY estado`),
      pool.query(`SELECT cat.prioridad::text, COUNT(*)::int as count 
                  FROM base_de_datos_csu.ticket t 
                  LEFT JOIN base_de_datos_csu.categoria cat ON cat.id_categoria = t.categoria_id_categoria 
                  GROUP BY cat.prioridad`),
      pool.query(`SELECT u.nombre_usuario as asignado_a, COUNT(*)::int as count 
                  FROM base_de_datos_csu.ticket t 
                  LEFT JOIN base_de_datos_csu.usuario u ON u.id_usuario = t.tecnico_ususario_id_usuario 
                  WHERE t.tecnico_ususario_id_usuario IS NOT NULL 
                  GROUP BY u.nombre_usuario`)
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

    let query = `SELECT id_usuario as id, nombre_usuario as nombre, '' as apellido, 
                        correo as email, rol::text, 
                        estado::text as estado,
                        CASE WHEN estado::text = 'Activo' THEN true ELSE false END as activo,
                        fecha_creacion
                 FROM base_de_datos_csu.usuario WHERE 1=1`
    const params = []

    if (rol) {
      query += ' AND rol::text = $' + (params.length + 1)
      params.push(rol)
    }
    if (activo !== undefined) {
      const estadoVal = activo === 'true' ? 'Activo' : 'Inactivo'
      query += ' AND estado::text = $' + (params.length + 1)
      params.push(estadoVal)
    }

    query += ' ORDER BY rol, nombre_usuario'

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
      `SELECT id_usuario as id, nombre_usuario as nombre, '' as apellido, 
              correo as email, rol::text, 
              CASE WHEN estado::text = 'Activo' THEN true ELSE false END as activo,
              fecha_creacion
       FROM base_de_datos_csu.usuario WHERE id_usuario = $1`,
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
    const { nombre, email, password, rol } = req.body

    // Obtener el id del administrador activo (FK NOT NULL obligatoria en tabla usuario)
    const adminResult = await pool.query(
      `SELECT id_administrador FROM base_de_datos_csu.administrador LIMIT 1`
    )
    if (adminResult.rows.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'No hay administrador registrado en el sistema. Contacte al equipo técnico.'
      })
    }
    const adminId = adminResult.rows[0].id_administrador

    const result = await pool.query(
      `INSERT INTO base_de_datos_csu.usuario 
       (nombre_usuario, correo, contrasena, rol, estado, administrador_id_administrador, fecha_creacion, fecha_modificacion)
       VALUES ($1, $2, $3, $4::base_de_datos_csu.rol_enum, 'Activo'::base_de_datos_csu.estado_usuario_enum, $5, NOW(), NOW())
       RETURNING id_usuario as id, nombre_usuario as nombre, correo as email, rol::text, 'Activo' as estado, fecha_creacion`,
      [nombre, email, password, rol, adminId]
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
    const { nombre, email, rol, estado } = req.body

    const setClauses = []
    const values = []

    if (nombre) { setClauses.push(`nombre_usuario = $${values.length + 1}`); values.push(nombre) }
    if (email) { setClauses.push(`correo = $${values.length + 1}`); values.push(email) }
    if (rol) { setClauses.push(`rol = $${values.length + 1}::base_de_datos_csu.rol_enum`); values.push(rol) }
    if (estado) { setClauses.push(`estado = INITCAP($${values.length + 1})::base_de_datos_csu.estado_usuario_enum`); values.push(estado) }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay campos para actualizar' })
    }

    setClauses.push('fecha_modificacion = NOW()')
    values.push(id)

    const query = `
      UPDATE base_de_datos_csu.usuario 
      SET ${setClauses.join(', ')}
      WHERE id_usuario = $${values.length}
      RETURNING id_usuario as id, nombre_usuario as nombre, correo as email, rol::text, estado::text, fecha_creacion
    `

    const result = await pool.query(query, values)

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
      pool.query('SELECT COUNT(*)::int as total FROM base_de_datos_csu.usuario'),
      pool.query(`SELECT rol::text, COUNT(*)::int as count FROM base_de_datos_csu.usuario GROUP BY rol`),
      pool.query(`SELECT COUNT(*)::int as count FROM base_de_datos_csu.usuario WHERE estado::text = 'Activo'`),
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
