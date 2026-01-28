# 🚀 Guía de Despliegue en Vercel

## 📋 Requisitos Previos

1. **Cuenta en Vercel**: https://vercel.com/signup
2. **Repositorio en GitHub**: El proyecto debe estar en GitHub
3. **Node.js 18+**: Instalado localmente

## 🔧 Paso 1: Preparar el Repositorio

### 1.1 Crear archivo `.env.local`

Copia el contenido de `.env.example` y crea `.env.local`:

```bash
cd "Proyecto de Software CSU - COLSOF"
cp .env.example .env.local
```

Luego edita `.env.local` con tus valores reales:

```
DATABASE_URL=postgresql://usuario:contraseña@host:5432/nombre_bd
PORT=3000
NODE_ENV=production
VERCEL=1
API_BASE_URL=https://tu-app.vercel.app
```

### 1.2 Verificar `.gitignore`

Asegúrate de que `.gitignore` contenga:
```
node_modules/
.env
.env.local
.env.*.local
.vercel/
```

### 1.3 Confirmar archivos necesarios

- ✅ `/Proyecto de Software CSU - COLSOF/package.json`
- ✅ `/Proyecto de Software CSU - COLSOF/server.js`
- ✅ `/Proyecto de Software CSU - COLSOF/api/index.js`
- ✅ `/vercel.json`

## 📤 Paso 2: Push a GitHub

```bash
cd "c:\Users\Ankoku\Documents\REPOCITORIOS GITHUB\Trabajo_final"
git add .
git commit -m "Configuración para despliegue en Vercel"
git push origin yo
```

## 🌐 Paso 3: Conectar a Vercel

### Opción A: Desde la Web (Recomendado)

1. Ve a https://vercel.com/dashboard
2. Click en "Add New..." → "Project"
3. Selecciona tu repositorio GitHub "Trabajo_final"
4. Vercel auto-detectará el `vercel.json`
5. Configura las variables de entorno:
   - **DATABASE_URL**: Tu cadena de conexión PostgreSQL
   - **API_BASE_URL**: URL de producción

### Opción B: Usando Vercel CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Desplegar
cd "c:\Users\Ankoku\Documents\REPOCITORIOS GITHUB\Trabajo_final"
vercel

# Responde las preguntas:
# - ¿Vinculado con un proyecto existente? No
# - ¿Nombre del proyecto? csu-colsof
# - ¿Directorio raíz? . (punto)
# - ¿Build command? npm install
```

## 🔐 Paso 4: Configurar Variables de Entorno en Vercel

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega estas variables:

```
DATABASE_URL = postgresql://...
PORT = 3000
NODE_ENV = production
VERCEL = 1
API_BASE_URL = https://tu-dominio.vercel.app
```

## ✅ Paso 5: Verificar el Despliegue

1. Ve a https://csu-colsof.vercel.app
2. Debería cargar la página de login
3. Prueba la API: https://csu-colsof.vercel.app/api/health

## 📊 Estructura de Despliegue

```
Vercel (Dominio raíz)
├── API Routes (/api/*)
│   └── Manejadas por: Proyecto de Software CSU - COLSOF/api/index.js
├── Archivos Estáticos (/*)
│   ├── /Usuario GESTOR/*
│   ├── /Usuario ADMINISTRDOR/*
│   └── Otros archivos HTML, CSS, JS
└── Health Check: /api/health
```

## 🔄 CI/CD Automático

Una vez vinculado a Vercel:
- **Cada push a `yo`** dispara un auto-deploy
- **Vercel ejecuta**: npm install + build
- **Servidor Express** maneja rutas automáticamente
- **Base de datos** se conecta mediante DATABASE_URL

## ⚠️ Solución de Problemas

### "Build failed"
```
Verifica:
- package.json está en la carpeta raíz
- Todas las dependencias en package.json
- PORT se obtiene de process.env.PORT
```

### "Conexión a base de datos falla"
```
- Verifica DATABASE_URL en Vercel Settings
- Asegúrate que la BD está en la nube (Supabase, Railway, etc)
- No uses localhost en producción
```

### "Archivos estáticos no se sirven"
```
- Vercel sirve archivos estáticos desde la carpeta del proyecto
- El vercel.json configure rutas correctamente
- Verifica que Express usa path.join(__dirname, ...)
```

## 🚨 Dominios Personalizados (Opcional)

1. Ve a Settings → Domains
2. Agrega tu dominio (ej: csu.colsof.com)
3. Configura DNS según las instrucciones de Vercel
4. Espera 24-48 horas para propagación

## 📝 Notas Importantes

- **No subas `.env.local`** a Git
- **Usa variables de entorno** para datos sensibles
- **DATABASE_URL** debe ser una URL remota (Supabase, Railway, etc)
- **NODE_ENV=production** en Vercel automáticamente
- **Puerto dinámico**: Vercel asigna automáticamente

## 🆘 Soporte

- Docs Vercel: https://vercel.com/docs
- Express + Vercel: https://vercel.com/guides/using-express-with-vercel
- PostgreSQL en la nube: https://supabase.com o https://railway.app
