# Script para iniciar el servidor y la aplicación
Write-Host "🚀 Iniciando COLSOF Sistema..." -ForegroundColor Green

# Verificar si Node.js está instalado
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js no está instalado. Por favor instálalo primero." -ForegroundColor Red
    exit 1
}

# Verificar si npm está instalado
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm no está instalado." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js v$(node -v) y npm v$(npm -v) detectados" -ForegroundColor Green

# Instalar dependencias si no existen
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependencias..." -ForegroundColor Yellow
    npm install
}

# Iniciar el servidor
Write-Host "▶️  Iniciando servidor en puerto 3000..." -ForegroundColor Cyan
npm start

Write-Host "✅ Servidor iniciado correctamente" -ForegroundColor Green
Write-Host "🌐 Abre http://localhost:3000 en tu navegador" -ForegroundColor Cyan
