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

// Columnas de la tabla 'usuario' (sin s)
const r = await pool.query(
  "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'base_de_datos_csu' AND table_name = 'usuario' ORDER BY ordinal_position"
)
console.log('\n=== Columnas de tabla "usuario" ===')
r.rows.forEach(c => console.log(`  ${c.column_name} | ${c.data_type} | nullable:${c.is_nullable} | default:${c.column_default}`))

// Columnas de la tabla 'usuarios' (con s)
const r2 = await pool.query(
  "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'base_de_datos_csu' AND table_name = 'usuarios' ORDER BY ordinal_position"
)
console.log('\n=== Columnas de tabla "usuarios" ===')
r2.rows.forEach(c => console.log(`  ${c.column_name} | ${c.data_type} | nullable:${c.is_nullable} | default:${c.column_default}`))

// Buscar tablas que tengan administrador en el nombre de columna
const r3 = await pool.query(
  "SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'base_de_datos_csu' AND column_name ILIKE '%administrador%'"
)
console.log('\n=== Columnas con "administrador" en cualquier tabla ===')
r3.rows.forEach(c => console.log(`  ${c.table_name}.${c.column_name} | ${c.data_type} | nullable:${c.is_nullable}`))

// Ver qué INSERT se hace exactamente cuando se crea un usuario
// Verificar si hay triggers en la tabla usuarios
const r4 = await pool.query(
  "SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_schema = 'base_de_datos_csu' AND event_object_table IN ('usuarios', 'usuario')"
)
console.log('\n=== Triggers en tabla usuarios / usuario ===')
r4.rows.forEach(t => console.log(`  ${t.trigger_name} | ${t.event_manipulation} | ${t.action_statement.substring(0,120)}`))

await pool.end()
