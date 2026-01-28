# 🎯 Guía de Mantenimiento y Mejores Prácticas

**Proyecto:** CSU-COLSOF Sistema de Gestión de Casos  
**Versión:** 3.0.0 (Optimizada)  
**Actualizado:** 27 de Enero de 2026

---

## 📋 Índice

1. [Estructura del Proyecto](#estructura-del-proyecto)
2. [Cómo Iniciar](#cómo-iniciar)
3. [Archivos Principales](#archivos-principales)
4. [Funcionalidades Activas](#funcionalidades-activas)
5. [Mantenimiento](#mantenimiento)
6. [Solución de Problemas](#solución-de-problemas)
7. [Próximos Pasos](#próximos-pasos)

---

## Estructura del Proyecto

```
Proyecto de Software CSU - COLSOF/
│
├── 📁 Usuario GESTOR/              # Interfaz para gestores
│   ├── Menu principal.html
│   ├── script.js                   # Lógica principal
│   ├── Estilos.css                 # Estilos globales
│   ├── 📁 Casos/                   # Gestión de casos
│   ├── 📁 Clientes/
│   ├── 📁 estadisticas/            # Dashboard estadísticas
│   └── ...
│
├── 📁 Usuario ADMINISTRDOR/        # Interfaz para administrador
│   ├── Menu principal Admin.html
│   ├── scripts.js
│   ├── 📁 Usuarios/                # Gestión de usuarios
│   ├── 📁 Tecnico/                 # Control técnico
│   ├── 📁 Terminal/                # Terminal de comandos
│   └── ...
│
├── 📁 api/                         # API endpoints
│   └── index.js                    # Rutas de API
│
├── 📁 db/
│   └── connection.js               # ⭐ Pool de conexión PostgreSQL
│
├── 📁 shared/                      # Código compartido
│   ├── api-client.js               # Cliente API para frontend
│   └── app-init.js                 # Inicialización global
│
├── ⚙️  server.js                    # Servidor Express principal
├── 🌐 index.html                   # Página de login
├── 📋 package.json                 # Dependencias
└── 🚀 start.ps1                    # Script de inicio

```

---

## 🚀 Cómo Iniciar

### Requisitos Previos
- **Node.js** v16+ (Verificar: `node -v`)
- **npm** v8+ (Verificar: `npm -v`)
- **PostgreSQL** (Base de datos Supabase)
- **Config.env** configurado (en raíz del proyecto padre)

### Opción 1: PowerShell (Recomendado para Windows)
```powershell
cd "c:\Users\Ankoku\Documents\REPOCITORIOS GITHUB\Trabajo_final\Proyecto de Software CSU - COLSOF"
.\start.ps1
```

### Opción 2: Terminal de Comando
```bash
npm install    # Solo la primera vez
npm start
```

### Verificación de Inicio
Deberías ver:
```
✅ Servidor API ejecutándose en http://localhost:3000
✅ Conexión a BD exitosa: postgres (postgres)
📊 Endpoints disponibles:
   GET  http://localhost:3000/api/health
   GET  http://localhost:3000/api/casos
   ...
```

### Accesos a la Aplicación
- **Login:** `http://localhost:3000/index.html`
- **Gestor:** `http://localhost:3000/Usuario%20GESTOR/Menu%20principal.html`
- **Admin:** `http://localhost:3000/Usuario%20ADMINISTRDOR/Menu%20principal%20Admin.html`

---

## 📄 Archivos Principales

### 1. **server.js** ⭐ Archivo Crítico
```javascript
// Funciones principales:
- Servir archivos estáticos (HTML, CSS, JS)
- Configurar CORS para frontend
- Manejar rutas de API
- Conectar a base de datos PostgreSQL
- Health checks

// Puertos:
- Desarrollo: localhost:3000
- Producción: variable PORT en .env
```

### 2. **db/connection.js** ⭐ Conexión de BD
```javascript
// Importa DATABASE_URL desde:
1. Variable de entorno (process.env.DATABASE_URL)
2. Archivo Config.env (ruta: ../../Config.env)

// Proporciona:
- Pool de conexiones a PostgreSQL
- Manejo de timeouts
- Fallback de variables de entorno
```

### 3. **shared/app-init.js** - Inicialización Frontend
```javascript
// Configura:
- Cliente API global (window.api)
- Utilidades compartidas (window.utils)
- Eventos globales
- Variables de configuración
```

### 4. **shared/api-client.js** - Cliente HTTP
```javascript
// Métodos disponibles:
- api.getCasos()
- api.getUsuarios()
- api.getEstadisticasCasos()
- api.loginUser()
- ... (ver archivo para lista completa)
```

### 5. **package.json** - Configuración NPM
```json
{
  "scripts": {
    "start": "node server.js",      // Inicia servidor
    "dev": "node --watch server.js" // Desarrollo con auto-reload
  }
}
```

---

## ✅ Funcionalidades Activas

### 🔐 Autenticación
- [x] Login de usuarios
- [x] Validación de credenciales
- [x] Hash de contraseñas con bcrypt
- [x] Sesiones

### 📊 Gestión de Casos (Gestor)
- [x] Crear casos
- [x] Listar casos
- [x] Filtrar por estado/prioridad
- [x] Cambiar vistas (lista/cuadrícula/árbol)
- [x] Asignar técnicos
- [x] Estadísticas de casos

### 👥 Gestión de Usuarios (Admin)
- [x] Crear usuarios
- [x] Listar usuarios
- [x] Filtrar por rol/estado
- [x] Monitoreo de sesiones
- [x] Roles (Admin, Gestor, Técnico)

### 📈 Estadísticas
- [x] Dashboard con KPIs
- [x] Gráficos de tendencias
- [x] Desempeño de técnicos
- [x] Distribución de casos

### 🛠️ Utilidades
- [x] Terminal de comandos
- [x] Herramientas de BD
- [x] Notificaciones en tiempo real
- [x] Exportación de reportes

---

## 🔧 Mantenimiento

### Tareas Regulares

#### 1. Verificar Logs del Servidor
```bash
# Monitorear salida en consola
npm start
```

#### 2. Comprobar Conexión a BD
```bash
# Probar conectividad (si necesitas agregar script)
# La conexión se verifica automáticamente al iniciar
```

#### 3. Actualizar Dependencias
```bash
npm update                    # Actualizar a versiones menores
npm outdated                  # Ver qué está desactualizado
```

#### 4. Limpiar Cache
```bash
# Eliminar node_modules y reinstalar
rmdir node_modules -s -q
npm install
```

### Archivos Importantes a Respaldar

| Archivo | Importancia | Razón |
|---------|-------------|-------|
| **Config.env** | 🔴 CRÍTICA | URL de conexión a BD |
| **server.js** | 🔴 CRÍTICA | Configuración del servidor |
| **package.json** | 🟠 ALTA | Dependencias del proyecto |
| **db/connection.js** | 🟠 ALTA | Pool de conexiones |

---

## 🐛 Solución de Problemas

### Problema: "Puerto 3000 ya está en uso"
```powershell
# Encontrar proceso en puerto 3000
Get-NetTCPConnection -LocalPort 3000

# Matar proceso
Stop-Process -Id <PID> -Force

# O cambiar puerto en .env
$env:PORT=3001
npm start
```

### Problema: "Conexión a BD rechazada"
```
Verificar:
1. DATABASE_URL en Config.env es correcto
2. Credenciales de PostgreSQL/Supabase válidas
3. Conexión a internet disponible
4. Firewall no bloquea puerto 5432 (BD) o 6543 (Supabase)
```

### Problema: "Archivo no encontrado (404)"
```
Verificar:
1. Ruta correcta en navegador (sin espacios)
2. Usar %20 para espacios: /Usuario%20GESTOR/
3. Verificar que server.js sirve ese directorio
```

### Problema: "Errores de CORS"
```
Verificar:
1. Que server.js tenga cors() habilitado
2. Que las URLs frontend y API sean compatibles
3. Revisar console del navegador (F12) para detalle
```

### Problema: Scripts NO funcionan después de actualización
```
Razones posibles:
1. Cache del navegador - Limpiar (Ctrl+Shift+Del)
2. Node.js desactualizado - Verificar versión
3. node_modules corrupto - Reinstalar (rmdir + npm install)
```

---

## 📝 Próximos Pasos

### Mejoras Planeadas

- [ ] Agregar autenticación por tokens JWT
- [ ] Implementar notificaciones por email
- [ ] Agregar exportación a PDF
- [ ] Implementar caché de BD con Redis
- [ ] Agregar tests unitarios
- [ ] Mejorar documentación de API
- [ ] Agregar más tipos de gráficos
- [ ] Implementar backup automático de BD

### Recomendaciones de Producción

1. **Seguridad**
   - Usar HTTPS en producción
   - Implementar rate limiting
   - Validar todas las entradas
   - Usar variables secretas para credenciales

2. **Performance**
   - Usar CDN para archivos estáticos
   - Implementar caché en frontend
   - Comprimir archivos (gzip)
   - Optimizar queries de BD

3. **Monitoreo**
   - Agregar logging centralizado
   - Configurar alertas de errores
   - Monitorear uso de recursos
   - Mantener logs de auditoría

4. **Escalabilidad**
   - Configurar load balancing
   - Usar múltiples instancias
   - Implementar base de datos replicada
   - Considerar microservicios

---

## 📞 Soporte

### Si algo no funciona:

1. **Revisar logs del servidor**
   - Terminal donde se ejecutó npm start
   - Buscando errores en rojo

2. **Revisar consola del navegador**
   - Presionar F12
   - Ir a pestaña "Console"
   - Buscar errores de JavaScript

3. **Verificar estructura de archivos**
   - Usar comando: `tree /F` (Windows)
   - Comparar con estructura documentada arriba

4. **Reiniciar servicios**
   - Detener servidor (Ctrl+C)
   - Esperar 5 segundos
   - Reiniciar: npm start

---

## ✨ Notas Finales

- **Última optimización:** 27 Enero 2026
- **Archivos no funcionales:** ❌ Eliminados (13 archivos)
- **Estado actual:** ✅ Proyecto limpio y optimizado
- **Documentación:** ✅ Completa y actualizada

```
"Un código limpio es un código que funciona correctamente"
- Robert C. Martin
```

---

**Documento creado para facilitar el mantenimiento y desarrollo del proyecto CSU-COLSOF** 🚀
