# 🚀 Despliegue a Vercel - Paso a Paso

Este guía te ayudará a desplegar el proyecto CSU COLSOF en Vercel de forma rápida y segura.

## ✅ Checklist Pre-Despliegue

Antes de desplegar, verifica que tienes:

- [ ] Cuenta en Vercel (https://vercel.com)
- [ ] Git configurado localmente
- [ ] Repositorio "Trabajo_final" en GitHub
- [ ] Base de datos PostgreSQL en la nube (Supabase, Railway, etc)
- [ ] NODE_ENV configurado correctamente

## 🎯 Paso 1: Preparar el Entorno Local

### 1.1 Crear archivo .env.local

```bash
cd "Proyecto de Software CSU - COLSOF"
```

Crea un archivo `.env.local` con tus credenciales:

```
DATABASE_URL=postgresql://usuario:contraseña@host:5432/bd_nombre
PORT=3000
NODE_ENV=development
VERCEL=0
API_BASE_URL=http://localhost:3000
```

### 1.2 Verificar la configuración

```bash
npm run check-vercel
```

Debería mostrar ✅ en todos los elementos críticos.

## 📤 Paso 2: Preparar GitHub

### 2.1 Agregar cambios a Git

```bash
cd ..  # Volver a la carpeta raíz
git status  # Ver cambios
```

Deberías ver:
- `vercel.json` (modificado)
- `GUIA_VERCEL.md` (nuevo)
- `README_VERCEL.md` (este archivo - nuevo)
- `.gitignore` (modificado)
- `.env.example` (nuevo)

### 2.2 Commit y Push

```bash
git add .
git commit -m "🚀 Configuración para despliegue en Vercel

- Agregado vercel.json optimizado
- Agregado .env.example
- Agregado setup-vercel.js para verificación
- Actualizado .gitignore
- Agregada documentación de despliegue"

git push origin yo
```

## 🌐 Paso 3: Desplegar en Vercel

### Opción A: Desde Vercel Dashboard (Recomendado)

1. Ve a https://vercel.com/dashboard
2. Click en **"Add New Project"**
3. Selecciona **"Import Git Repository"**
4. Busca **"Trabajo_final"** y selecciónalo
5. Vercel auto-detectará `vercel.json`
6. Click en **"Deploy"**

### Opción B: Usando Vercel CLI

```bash
# Instalar CLI global
npm install -g vercel

# Desplegar
cd "c:\Users\Ankoku\Documents\REPOCITORIOS GITHUB\Trabajo_final"
vercel --prod
```

## 🔐 Paso 4: Configurar Variables de Entorno

Una vez que Vercel termine el build inicial:

1. Ve a tu proyecto en https://vercel.com/dashboard
2. Click en **"Settings"** → **"Environment Variables"**
3. Agrega las siguientes variables:

| Variable | Valor | Nota |
|----------|-------|------|
| `DATABASE_URL` | `postgresql://...` | Tu base de datos PostgreSQL en la nube |
| `NODE_ENV` | `production` | Automático en Vercel |
| `VERCEL` | `1` | Automático en Vercel |
| `API_BASE_URL` | `https://tu-proyecto.vercel.app` | URL del dominio |

4. Click en **"Save"**
5. Vercel re-desplegará automáticamente con las nuevas variables

## ✅ Paso 5: Verificar el Despliegue

Una vez completado, prueba:

### 5.1 Página principal
```
https://tu-proyecto.vercel.app
```

Debería cargar la página de login.

### 5.2 Health Check
```
https://tu-proyecto.vercel.app/api/health
```

Debería retornar:
```json
{
  "status": "OK",
  "database": "connected"
}
```

### 5.3 Probar página de Usuario GESTOR
```
https://tu-proyecto.vercel.app/Usuario%20GESTOR/Menu%20principal.html
```

### 5.4 Probar página de Usuario ADMINISTRADOR
```
https://tu-proyecto.vercel.app/Usuario%20ADMINISTRDOR/Menu%20principal%20Admin.html
```

## 🔄 CI/CD Automático

A partir de ahora:

1. **Haces commit a `yo`** → `git push origin yo`
2. **Vercel detecta el cambio**
3. **Auto-construye y despliega**
4. **Tu app se actualiza automáticamente**

## 🎯 Dominio Personalizado (Opcional)

Para usar tu propio dominio (ej: `csu.colsof.com`):

1. Ve a **Settings** → **Domains**
2. Agrega tu dominio
3. Configura DNS según instrucciones de Vercel
4. Espera 24-48 horas para propagación

## ⚠️ Troubleshooting

### "Error: DATABASE_URL no está definido"
- ✅ Verifica que DATABASE_URL está en Vercel Settings
- ✅ Re-deploy después de agregar la variable
- ✅ Usa una BD en la nube, no localhost

### "Build failed"
- ✅ Revisa los logs en Vercel Dashboard → Deployments
- ✅ Asegúrate que package.json está en la carpeta correcta
- ✅ Verifica que todas las dependencias están listadas

### "Archivos estáticos no se cargan"
- ✅ Revisa vercel.json routes
- ✅ Asegúrate que Express sirve archivos estáticos correctamente
- ✅ Usa rutas relativas en HTML/CSS/JS

### "Conexión a BD timeout"
- ✅ Verifica que la BD está activa y accesible
- ✅ Aumenta `connectionTimeoutMillis` en connection.js
- ✅ Usa pool de conexiones adecuado

## 📊 Monitoreo

En Vercel Dashboard puedes ver:

- ✅ **Deployments**: Historial de despliegues
- ✅ **Analytics**: Tráfico y rendimiento
- ✅ **Functions**: Uso de funciones serverless
- ✅ **Logs**: Errores y consola
- ✅ **Edge Functions**: Edge caching

## 🆘 Recursos

- 📖 [Vercel Docs](https://vercel.com/docs)
- 📖 [Express + Vercel](https://vercel.com/guides/using-express-with-vercel)
- 📖 [PostgreSQL en Supabase](https://supabase.com/docs)
- 📖 [PostgreSQL en Railway](https://docs.railway.app)

## 💡 Tips Importantes

1. **No subas `.env.local`** a Git (está en `.gitignore`)
2. **Usa variables de entorno** para datos sensibles
3. **DATABASE_URL** debe ser URL remota, no localhost
4. **Puerto dinámico**: Vercel usa `process.env.PORT`
5. **HTTPS automático**: Vercel maneja certificados SSL

## ✨ ¡Listo!

Una vez completados estos pasos, tu aplicación estará:

- ✅ Desplegada en Vercel
- ✅ Accesible desde internet
- ✅ Con CI/CD automático
- ✅ Con monitoreo y logs
- ✅ Con escalamiento automático
- ✅ Con caching y optimización

**¡Felicidades! 🎉**

---

*Para más información, ver `GUIA_VERCEL.md`*
