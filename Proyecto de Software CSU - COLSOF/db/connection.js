import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let connectionString = process.env.DATABASE_URL

// Si no hay variable de entorno, intentar leer desde Config.env (solo desarrollo local)
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
  console.warn('   Para desarrollo local, asegúrate de que Config.env tenga DATABASE_URL.')
  console.warn('   Para producción, configura DATABASE_URL en las variables de entorno de Vercel.')
}

// Configuración del pool de conexiones
const poolConfig = {
  connectionString,
  max: process.env.VERCEL ? 5 : 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.VERCEL ? { rejectUnauthorized: false } : false
}

const pool = new Pool(poolConfig)

// Establecer search_path al esquema correcto en cada conexión nueva
pool.on('connect', (client) => {
  client.query("SET search_path TO base_de_datos_csu, public")
    .catch(err => console.warn('No se pudo establecer search_path:', err.message))
})

// Manejo de errores del pool
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de conexiones:', err)
})

// Función para probar la conexión
async function testConnection() {
  try {
    const client = await pool.connect()
    try {
      const { rows } = await client.query(
        'SELECT current_user as user, current_database() as database, now() as now'
      )
      return { success: true, ...rows[0] }
    } finally {
      client.release()
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Función para cerrar el pool
async function closePool() {
  await pool.end()
}

export { pool, testConnection, closePool }
