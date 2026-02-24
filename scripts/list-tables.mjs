import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../Config.env')
const envContent = readFileSync(envPath, 'utf8')
const match = envContent.match(/DATABASE_URL\s*=\s*(.+)/)
const DATABASE_URL = match ? match[1].trim() : ''

const { Pool } = pg
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
pool.on('connect', c => c.query('SET search_path TO base_de_datos_csu, public').catch(() => {}))

const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'base_de_datos_csu'")
console.log('Tablas en base_de_datos_csu:')
r.rows.forEach(x => console.log(' -', x.table_name))

// Also check columns of a few key tables
const interestingTables = ['usuarios', 'clientes', 'empleados', 'roles']
for (const tbl of r.rows.map(x => x.table_name)) {
  const cols = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'base_de_datos_csu' AND table_name = $1",
    [tbl]
  )
  if (cols.rows.some(c => c.column_name.includes('nombre'))) {
    console.log(`\nColumnas en ${tbl} con 'nombre':`)
    cols.rows.filter(c => c.column_name.includes('nombre')).forEach(c => console.log(`  ${c.column_name} (${c.data_type})`))
  }
}

await pool.end()
