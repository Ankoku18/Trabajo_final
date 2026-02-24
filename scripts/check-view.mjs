import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const raw = readFileSync(resolve(__dirname, '../Config.env'), 'utf8')
const DATABASE_URL = raw.match(/DATABASE_URL\s*=\s*"?([^"\n]+)"?/)[1].trim()

const { Pool } = pg
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
pool.on('connect', c => c.query('SET search_path TO base_de_datos_csu, public').catch(() => {}))

const r = await pool.query(
  "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='base_de_datos_csu' AND table_name IN ('usuario','usuarios')"
)
console.log('Tipo de tabla:')
r.rows.forEach(x => console.log(`  ${x.table_name} -> ${x.table_type}`))

// Si usuarios es VIEW, ver su definición
const rv = await pool.query(
  "SELECT view_definition FROM information_schema.views WHERE table_schema='base_de_datos_csu' AND table_name='usuarios'"
)
if (rv.rows.length > 0) {
  console.log('\nDEFINICIÓN de la vista usuarios:\n', rv.rows[0].view_definition)
}

await pool.end()
