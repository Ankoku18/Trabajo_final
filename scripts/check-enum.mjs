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

const r = await pool.query(`SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'rol_enum')`)
console.log('Valores válidos del enum rol_enum:')
r.rows.forEach(x => console.log(' -', JSON.stringify(x.enumlabel)))
await pool.end()
