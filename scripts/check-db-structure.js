import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let connectionString = process.env.DATABASE_URL

if (!connectionString) {
  const envPaths = [path.resolve(__dirname, '../Config.env')]
  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8')
        const match = envContent.match(/DATABASE_URL\s*=\s*"([^"]+)"/)
        if (match) {
          connectionString = match[1]
          break
        }
      }
    } catch (error) {}
  }
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })

async function checkStructure() {
  console.log('🔍 Verificando estructura de tablas relacionadas...\n')

  const tables = ['cliente', 'c_costo', 'ticket', 'gestor', 'usuario']

  try {
    for (const tableName of tables) {
      const columnsRes = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'base_de_datos_csu'
        AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName])

      console.log(`📋 Tabla: "${tableName}"`)
      columnsRes.rows.slice(0, 8).forEach(row => {
        console.log(`   ├─ ${row.column_name}: ${row.data_type}`)
      })
      if (columnsRes.rows.length > 8) {
        console.log(`   ├─ ... (${columnsRes.rows.length - 8} más)`)
      }
      console.log()
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await pool.end()
  }
}

checkStructure()
