-- =====================================================
-- Migración 06: Agregar columnas `estado` y `password`
-- a base_de_datos_csu.usuarios
--
-- ▶ Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. Columna para contraseña hasheada
ALTER TABLE base_de_datos_csu.usuarios
  ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Columna de estado con valores permitidos
ALTER TABLE base_de_datos_csu.usuarios
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'activo';

-- 3. Restricción de valores válidos
DO $$
BEGIN
  ALTER TABLE base_de_datos_csu.usuarios
    ADD CONSTRAINT chk_usuarios_estado
    CHECK (estado IN ('activo', 'suspendido', 'inactivo'));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Constraint chk_usuarios_estado ya existe, omitiendo.';
END;
$$;

-- 4. Poblar estado desde el campo activo existente
UPDATE base_de_datos_csu.usuarios
SET estado = CASE WHEN activo = TRUE THEN 'activo' ELSE 'inactivo' END
WHERE estado IS NULL OR estado NOT IN ('activo', 'suspendido', 'inactivo');

-- 5. Índice para búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON base_de_datos_csu.usuarios(estado);

-- Verificar resultado
SELECT estado, COUNT(*) as total FROM base_de_datos_csu.usuarios GROUP BY estado;
