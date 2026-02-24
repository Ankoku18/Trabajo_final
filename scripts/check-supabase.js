#!/usr/bin/env node

/**
 * Validador de Conexión a Supabase - COLSOF
 * Simple y efectivo para listar tablas
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../Config.env') })

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('❌ DATABASE_URL no encontrado en Config.env')
  process.exit(1)
}

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
})

console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║       VALIDACIÓN DE CONEXIÓN SUPABASE - COLSOF                   ║
║       Listando tablas y estructura                               ║
╚═══════════════════════════════════════════════════════════════════╝
`)

async function main() {
  try {
    console.log('🔗 Conectando a Supabase...\n')
    
    const startTime = Date.now()
    const client = await pool.connect()
    const connectTime = Date.now() - startTime
    
    console.log(`✅ Conexión exitosa en ${connectTime}ms\n`)
    
    // 1. Info de conexión
    const connInfo = await client.query(
      'SELECT current_user as user, current_database() as db, version() as version'
    )
    const { user, db } = connInfo.rows[0]
    
    console.log('📊 Información de Base de Datos:')
    console.log(`   Usuario: ${user}`)
    console.log(`   Base de datos: ${db}\n`)
    
    // 2. Listar tablas
    console.log('📋 Listando tablas por schema...\n')
    
    const tables = await client.query(`
      SELECT 
        table_schema as schema,
        table_name as name,
        table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `)
    
    if (tables.rows.length === 0) {
      console.log('⚠️  No hay tablas encontradas\n')
      client.release()
      await pool.end()
      return
    }
    
    // Agrupar por schema
    const bySchema = {}
    tables.rows.forEach(t => {
      if (!bySchema[t.schema]) bySchema[t.schema] = []
      bySchema[t.schema].push(t)
    })
    
    // Mostrar tablas
    let totalTables = 0
    for (const [schema, schemaTables] of Object.entries(bySchema)) {
      console.log(`📁 Schema "${schema}":`)
      
      for (const table of schemaTables) {
        totalTables++
        
        // Columnas
        const cols = await client.query(
          `SELECT column_name, data_type, is_nullable 
           FROM information_schema.columns 
           WHERE table_schema = $1 AND table_name = $2
           ORDER BY ordinal_position`,
          [schema, table.name]
        )
        
        // Filas
        const rows = await client.query(
          `SELECT COUNT(*) as count FROM "${schema}"."${table.name}"`
        )
        
        const rowCount = rows.rows[0].count
        const colCount = cols.rows.length
        
        console.log(`\n   ✓ ${table.name}`)
        console.log(`     ├─ Columnas: ${colCount}`)
        console.log(`     ├─ Registros: ${rowCount}`)
        console.log(`     └─ Campos:`)
        
        cols.rows.forEach((col, idx) => {
          const last = idx === cols.rows.length - 1
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'
          console.log(`        ${last ? '└' : '├'}─ ${col.column_name}: ${col.data_type} [${nullable}]`)
        })
      }
      
      console.log()
    }
    
    // Resumen
    console.log('\n' + '═'.repeat(67) + '\n')
    console.log('📊 RESUMEN:\n')
    console.log(`   ✅ Conexión: OK (${connectTime}ms)`)
    console.log(`   ✅ Total tablas: ${totalTables}`)
    console.log(`   ✅ Schemas: ${Object.keys(bySchema).join(', ')}\n`)
    
    // 3. Validar tablas principales
    console.log('🔍 VALIDACIÓN DE TABLAS DEL PROYECTO:\n')
    
    const projectTables = ['casos', 'usuarios', 'tecnico', 'gestor', 'administrador', 'cliente', 'ticket']
    const allTableNames = tables.rows.map(t => t.name)
    
    projectTables.forEach(tableName => {
      if (allTableNames.includes(tableName)) {
        console.log(`   ✅ ${tableName}`)
      } else {
        console.log(`   ❌ ${tableName}`)
      }
    })
    
    console.log('\n' + '═'.repeat(67) + '\n')
    console.log('✅ VALIDACIÓN COMPLETADA\n')
    
    client.release()
    await pool.end()
    
  } catch (error) {
    console.error('\n❌ ERROR:\n')
    console.error(`   ${error.message}\n`)
    
    if (error.code === 'ENOTFOUND') {
      console.error('   Problema: No se resuelve el host')
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   Problema: Conexión rechazada')
    } else if (error.code === '28P01') {
      console.error('   Problema: Credenciales inválidas')
    }
    
    console.error('\n📋 Verifica:')
    console.error('   1. DATABASE_URL en Config.env')
    console.error('   2. Conexión a internet')
    console.error('   3. Disponibilidad de Supabase\n')
    
    try {
      await pool.end()
    } catch (e) {}
    
    process.exit(1)
  }
}

main()
