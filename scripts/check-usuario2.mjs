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

// Columnas de administrador
const ra = await pool.query(
  "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='base_de_datos_csu' AND table_name='administrador' ORDER BY ordinal_position"
)
console.log('=== Columnas de "administrador" ===')
ra.rows.forEach(c => console.log(`  ${c.column_name} | ${c.data_type} | nullable:${c.is_nullable}`))

// Filas de administrador
const ra2 = await pool.query('SELECT * FROM administrador LIMIT 5')
console.log('\n=== Filas en administrador ===')
ra2.rows.forEach(r => console.log(JSON.stringify(r)))

// Enums en usuario
const re = await pool.query(`
  SELECT c.column_name, t.typname, e.enumlabel
  FROM information_schema.columns c
  JOIN pg_attribute a ON a.attname = c.column_name
  JOIN pg_class cl ON cl.oid = a.attrelid AND cl.relname = 'usuario'
  JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'base_de_datos_csu'
  JOIN pg_type t ON t.oid = a.atttypid AND t.typcategory = 'E'
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE c.table_schema = 'base_de_datos_csu' AND c.table_name = 'usuario'
  ORDER BY c.column_name, e.enumsortorder
`)
console.log('\n=== Enums de tabla "usuario" ===')
re.rows.forEach(r => console.log(`  ${r.column_name} (${r.typname}) → "${r.enumlabel}"`))

await pool.end()
