#!/usr/bin/env node

/**
 * Performance Utility Script para COLSOF
 * Funciones: Monitoreo de caché, limpieza de índices, análisis de BD
 */

import { pool, testConnection, getPoolHealth } from '../Proyecto de Software CSU - COLSOF/db/connection-optimized.js'

const args = process.argv.slice(2)
const command = args[0]

async function main() {
  switch (command) {
    case 'health':
      await checkHealth()
      break
    case 'analyze':
      await analyzeDatabase()
      break
    case 'indexes':
      await listIndexes()
      break
    case 'slow-queries':
      await findSlowQueries()
      break
    case 'stats':
      await getStats()
      break
    case 'reindex':
      await reindexTables()
      break
    default:
      showHelp()
  }
  
  process.exit(0)
}

async function checkHealth() {
  console.log('📊 Health Check de Sistema...\n')
  
  try {
    // Conexión a BD
    const connTest = await testConnection()
    console.log(`✅ Conexión a BD:`)
    console.log(`   Database: ${connTest.database}`)
    console.log(`   User: ${connTest.user}`)
    console.log(`   Tiempo: ${connTest.duration}ms\n`)
    
    // Pool health
    const poolHealth = await getPoolHealth()
    console.log(`✅ Estado del Pool:`)
    console.log(`   Idle connections: ${poolHealth.idle}`)
    console.log(`   Total connections: ${poolHealth.totalCount}`)
    console.log(`   Query count: ${poolHealth.queryCount}`)
    console.log(`   Error count: ${poolHealth.errorCount}`)
    console.log(`   Error rate: ${poolHealth.errorRate}\n`)
    
    // Tabla sizes
    const sizeResult = await pool.query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `)
    
    console.log(`✅ Tamaño de Tablas:`)
    sizeResult.rows.forEach(row => {
      console.log(`   ${row.tablename}: ${row.size}`)
    })
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
  }
}

async function analyzeDatabase() {
  console.log('📈 Analizando Base de Datos...\n')
  
  try {
    // Analizar todas las tablas
    const tables = await pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `)
    
    for (const { tablename } of tables.rows) {
      console.log(`Analizando ${tablename}...`)
      await pool.query(`ANALYZE ${tablename}`)
    }
    
    console.log(`\n✅ Análisis completado!\n`)
    
    // Mostrar estadísticas
    const stats = await pool.query(`
      SELECT
        schemaname,
        tablename,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows,
        last_vacuum,
        last_autovacuum
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `)
    
    console.log('📊 Estadísticas de Tablas:')
    console.log('─'.repeat(80))
    
    for (const row of stats.rows) {
      console.log(`\n${row.tablename}:`)
      console.log(`  Filas vivas: ${row.live_rows}`)
      console.log(`  Filas muertas: ${row.dead_rows}`)
      console.log(`  Último vacuum: ${row.last_vacuum || 'Nunca'}`)
      console.log(`  Último autovacuum: ${row.last_autovacuum || 'Nunca'}`)
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
  }
}

async function listIndexes() {
  console.log('🔍 Listado de Índices\n')
  
  try {
    const indexes = await pool.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `)
    
    console.log('📊 Índices:')
    console.log('─'.repeat(80))
    
    let currentTable = ''
    for (const idx of indexes.rows) {
      if (idx.tablename !== currentTable) {
        console.log(`\n${idx.tablename}:`)
        currentTable = idx.tablename
      }
      console.log(`  • ${idx.indexname}`)
    }
    
    console.log(`\n\nTotal: ${indexes.rows.length} índices creados`)
    
    // Índices no utilizados
    const unusedIndexes = await pool.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        idx_scan
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
      AND schemaname = 'public'
      ORDER BY tablename
    `)
    
    if (unusedIndexes.rows.length > 0) {
      console.log(`\n⚠️  Índices NO UTILIZADOS: ${unusedIndexes.rows.length}`)
      unusedIndexes.rows.forEach(idx => {
        console.log(`  • ${idx.schemaname}.${idx.tablename}.${idx.indexname}`)
      })
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
  }
}

async function findSlowQueries() {
  console.log('⚠️  Buscando Queries Lentos...\n')
  
  try {
    // Mostrar queries con duración promedio alta
    const slowQueries = await pool.query(`
      SELECT
        query,
        calls,
        total_time,
        mean_time,
        rows
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_stat_statements%'
      ORDER BY mean_time DESC
      LIMIT 10
    `)
    
    if (slowQueries.rows.length === 0) {
      console.log('ℹ️  pg_stat_statements no está disponible')
      console.log('Ejecutar: CREATE EXTENSION pg_stat_statements')
      return
    }
    
    console.log('📊 Top 10 Queries Lentos:')
    console.log('─'.repeat(80))
    
    slowQueries.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. Duración promedio: ${row.mean_time.toFixed(2)}ms`)
      console.log(`   Llamadas: ${row.calls}`)
      console.log(`   Tiempo total: ${row.total_time.toFixed(2)}ms`)
      console.log(`   Query: ${row.query.substring(0, 100)}...`)
    })
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
  }
}

async function getStats() {
  console.log('📊 Estadísticas de Rendimiento\n')
  
  try {
    // Cache hit ratio (si está habilitado)
    const tableStats = await pool.query(`
      SELECT
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins,
        n_tup_upd,
        n_tup_del
      FROM pg_stat_user_tables
      ORDER BY seq_scan DESC
      LIMIT 5
    `)
    
    console.log('📊 Tables con más scans secuenciales:')
    tableStats.rows.forEach(row => {
      console.log(`\n${row.tablename}:`)
      console.log(`  Seq scans: ${row.seq_scan}`)
      console.log(`  Index scans: ${row.idx_scan}`)
      console.log(`  Inserts: ${row.n_tup_ins}, Updates: ${row.n_tup_upd}, Deletes: ${row.n_tup_del}`)
    })
    
    // Conexiones activas
    const connections = await pool.query(`
      SELECT
        datname,
        count(*) as connections,
        state
      FROM pg_stat_activity
      GROUP BY datname, state
      ORDER BY count(*) DESC
    `)
    
    console.log('\n\n📡 Conexiones Activas:')
    connections.rows.forEach(row => {
      console.log(`  ${row.datname}: ${row.connections} (${row.state})`)
    })
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
  }
}

async function reindexTables() {
  console.log('🔨 Reindexando Tablas...\n')
  
  try {
    const tables = await pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `)
    
    for (const { tablename } of tables.rows) {
      console.log(`Reindexando ${tablename}...`)
      await pool.query(`REINDEX TABLE CONCURRENTLY ${tablename}`)
      console.log(`✅ ${tablename} reindexado\n`)
    }
    
    console.log('✅ Reindexación completada!\n')
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
  }
}

function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  COLSOF Performance Utility                                   ║
╚════════════════════════════════════════════════════════════════╝

COMANDOS:
  health           Verificar salud del sistema
  analyze          Analizar base de datos
  indexes          Listar índices y detectar no utilizados
  slow-queries     Mostrar top 10 queries lentos
  stats            Estadísticas de rendimiento
  reindex          Reindexar todas las tablas

EJEMPLOS:
  node scripts/performance-utils.js health
  node scripts/performance-utils.js analyze
  node scripts/performance-utils.js slow-queries

REQUISITOS:
  - Conexión activa a Supabase
  - DATABASE_URL configurado en Config.env
`)
}

main().catch(console.error)
