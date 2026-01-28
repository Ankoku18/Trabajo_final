#!/usr/bin/env node

/**
 * Script de Setup para Vercel
 * Verifica que todo está configurado correctamente
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('\n🔍 Verificando configuración de Vercel...\n')

const checks = [
  {
    name: 'package.json',
    path: path.join(__dirname, 'package.json'),
    critical: true
  },
  {
    name: 'server.js',
    path: path.join(__dirname, 'server.js'),
    critical: true
  },
  {
    name: 'api/index.js',
    path: path.join(__dirname, 'api', 'index.js'),
    critical: true
  },
  {
    name: 'vercel.json (raíz)',
    path: path.join(__dirname, '..', 'vercel.json'),
    critical: true
  },
  {
    name: '.gitignore',
    path: path.join(__dirname, '..', '.gitignore'),
    critical: false
  },
  {
    name: '.env.example',
    path: path.join(__dirname, '.env.example'),
    critical: false
  }
]

let allGood = true

checks.forEach(check => {
  const exists = fs.existsSync(check.path)
  const status = exists ? '✅' : '❌'
  const type = check.critical ? '[CRÍTICO]' : '[INFO]'
  
  console.log(`${status} ${type} ${check.name}`)
  
  if (!exists && check.critical) {
    allGood = false
  }
})

console.log('\n📋 Verificando package.json:\n')

try {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8')
  )
  
  const requiredDeps = ['express', 'cors', 'pg', 'bcrypt']
  requiredDeps.forEach(dep => {
    const hasDep = packageJson.dependencies[dep]
    const status = hasDep ? '✅' : '❌'
    console.log(`${status} ${dep}: ${hasDep || 'FALTANTE'}`)
  })
  
  console.log('\n🔨 Scripts configurados:')
  Object.entries(packageJson.scripts || {}).forEach(([name, cmd]) => {
    console.log(`  - ${name}: ${cmd}`)
  })
} catch (error) {
  console.error('❌ Error leyendo package.json:', error.message)
  allGood = false
}

console.log('\n🌍 Verificando configuración de entorno:\n')

if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL está configurada')
} else {
  console.log('⚠️  DATABASE_URL no está configurada (necesaria para producción)')
}

if (process.env.VERCEL) {
  console.log(`✅ VERCEL=${process.env.VERCEL}`)
} else {
  console.log('⚠️  VERCEL no está configurada (se establecerá en Vercel)')
}

console.log('\n' + (allGood ? '✅ LISTO PARA VERCEL' : '❌ FALTAN CONFIGURACIONES'))

if (allGood) {
  console.log(`
📚 Próximos pasos:

1. Asegúrate de haber creado .env.local:
   cp .env.example .env.local
   # Edita .env.local con tus valores

2. Push a GitHub:
   git add .
   git commit -m "Setup para Vercel"
   git push origin yo

3. Ve a https://vercel.com y conecta tu repositorio

4. Configura variables de entorno en Vercel:
   - DATABASE_URL (tu base de datos PostgreSQL)
   - API_BASE_URL (tu dominio Vercel)

5. ¡Listo! Vercel desplegará automáticamente
  `)
}

console.log('')
