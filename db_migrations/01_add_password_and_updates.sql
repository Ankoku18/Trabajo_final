-- ============================================================
-- MIGRACIÓN: Agregar campos necesarios para autenticación
-- ============================================================
-- Esta migración agrega/actualiza los campos necesarios en la tabla usuarios
-- para el sistema de autenticación con contraseñas cifradas

-- 1. Asegurar que la tabla usuarios tenga la columna 'password' (si no existe)
-- Si ya existe, esta sentencia no hará nada
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS password VARCHAR(255) NOT NULL DEFAULT 'temporal123';

-- 2. Agregar columna 'ultimo_acceso' para registrar el último login del usuario
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMP DEFAULT NULL;

-- 3. Asegurar que el campo 'email' sea UNIQUE para evitar duplicados
ALTER TABLE usuarios
ADD CONSTRAINT IF NOT EXISTS usuarios_email_unique UNIQUE (email);

-- 4. Asegurar que la columna 'activo' existe (algunos usuarios pueden necesitarlo)
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

-- ============================================================
-- NOTA IMPORTANTE: Contraseñas en producción
-- ============================================================
-- Las contraseñas están siendo almacenadas con bcrypt en el backend.
-- Esta migración solo asegura que exista el campo en la BD.
--
-- IMPORTANTE: Después de esta migración:
-- 1. Actualizar todas las contraseñas existentes con hash bcrypt
-- 2. Ver el archivo: USUARIOS_SETUP.md para instrucciones
--
-- Ejemplo de contraseña bcrypt (para testing):
-- Contraseña: "123456" 
-- Hash: "$2b$10$S9/aqnCczTp2D4d5.v9mueT5fVvVB.Zr6W/V7B8qLJL3kV4N6V2Vm"
--
-- Comando para generar hash bcrypt en Node.js:
-- node -e "require('bcrypt').hash('123456', 10).then(h => console.log(h))"
-- ============================================================

-- 5. Crear índice en email para consultas de login más rápidas
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- 6. Crear índice en 'activo' para filtrar usuarios activos rápidamente
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- FIN DE LA MIGRACIÓN
