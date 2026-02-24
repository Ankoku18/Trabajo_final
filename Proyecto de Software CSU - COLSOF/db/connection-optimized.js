import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let connectionString = process.env.DATABASE_URL

// Si no hay variable de entorno, intentar leer desde Config.env
if (!connectionString) {
  const envPaths = [
    path.resolve(__dirname, '../../Config.env'),
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../.env.local')
  ]
  
  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8')
        const match = envContent.match(/DATABASE_URL\s*=\s*"([^"]+)"/)
        if (match) {
          connectionString = match[1]
          console.log(`📄 Leído DATABASE_URL desde: ${envPath}`)
          break
        }
      }
    } catch (error) {
      console.warn(`No se pudo leer ${envPath}:`, error.message)
    }
  }
}

if (!connectionString) {
  console.warn('⚠️  DATABASE_URL no está definido. La API funcionará pero fallará en consultas a BD.')
}

// ==================== CONFIGURACIÓN OPTIMIZADA ====================
// Adaptada para Supabase y máximo rendimiento
const isVercel = !!process.env.VERCEL
const isDevelopment = !isVercel

const poolConfig = {
  connectionString,
  // Pool size optimizado
  max: isVercel ? 3 : 20, // Vercel serverless permite menos conexiones
  min: isVercel ? 1 : 5,
  // Timeouts optimizados
  idleTimeoutMillis: isDevelopment ? 30000 : 60000,
  connectionTimeoutMillis: isDevelopment ? 10000 : 5000,
  // Query timeout en ms (30 segundos por defecto)
  query_timeout: 30000,
  // SSL para conexiones de producción
  ssl: process.env.VERCEL || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  // Usar prepared statements para mejor rendimiento
  application_name: 'COLSOF-API',
  // Reuse connections más agresivamente
  reapIntervalMillis: 1000,
}

const pool = new Pool(poolConfig)

// Monitoreo de pool
let queryCount = 0
let errorCount = 0

pool.on('error', (err, client) => {
  console.error('❌ Error inesperado en el pool:', err)
  errorCount++
})

pool.on('connect', (client) => {
  // Configurar sesión: apuntar al esquema correcto
  client.query("SET search_path TO base_de_datos_csu, public")
    .catch(err => console.warn('search_path warning:', err.message))
})

// ==================== UTILIDADES ====================

// Función para probar la conexión
async function testConnection() {
  const startTime = Date.now()
  try {
    const client = await pool.connect()
    try {
      const { rows } = await client.query(
        'SELECT current_user as user, current_database() as database, now() as now'
      )
      const duration = Date.now() - startTime
      return { success: true, duration, ...rows[0] }
    } finally {
      client.release()
    }
  } catch (error) {
    return { success: false, error: error.message, duration: Date.now() - startTime }
  }
}

// Función para cerrar el pool
async function closePool() {
  await pool.end()
}

// Ejecutar query con retry automático
async function queryWithRetry(sql, params = [], maxRetries = 2) {
  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      queryCount++
      const result = await pool.query(sql, params)
      return result
    } catch (error) {
      lastError = error
      if (attempt < maxRetries && error.code === 'ECONNREFUSED') {
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
        continue
      }
      throw error
    }
  }
  throw lastError
}

// Ejecutar múltiples queries en paralelo con control
async function parallelQueries(queries) {
  return Promise.all(
    queries.map(({ sql, params }) => queryWithRetry(sql, params))
  )
}

// Health check mejorado
async function getPoolHealth() {
  const status = {
    idle: pool.idleCount,
    waitingCount: pool.waitingCount,
    totalCount: pool.totalCount,
    queryCount,
    errorCount,
    errorRate: queryCount > 0 ? (errorCount / queryCount * 100).toFixed(2) + '%' : '0%'
  }
  return status
}

export {
  pool,
  testConnection,
  closePool,
  queryWithRetry,
  parallelQueries,
  getPoolHealth
}
