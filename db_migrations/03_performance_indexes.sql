-- ====================================================================================
-- MIGRATION: Crear índices de PERFORMANCE para optimizar queries frecuentes
-- ====================================================================================
-- Creado para: COLSOF aplicación de gestión de casos
-- Objetivo: Mejorar velocidad de búsquedas, filtros y ordenamiento
-- ====================================================================================

-- ==================== ÍNDICES EN TABLA CASOS ====================

-- Índice en estado (búsquedas por estado muy frecuentes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_casos_estado 
  ON casos(estado) 
  WHERE estado IS NOT NULL;

-- Índice en prioridad (búsquedas por prioridad)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_casos_prioridad 
  ON casos(prioridad) 
  WHERE prioridad IS NOT NULL;

-- Índice en cliente para búsquedas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_casos_cliente_gin 
  ON casos USING GIN (cliente gin_trgm_ops);

-- Índice en asignado_a (búsquedas por técnico)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_casos_asignado_a 
  ON casos(asignado_a);

-- Índice compuesto para filtros comunes (estado + prioridad)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_casos_estado_prioridad 
  ON casos(estado, prioridad);

-- Índice en fecha_creacion para ordenamiento
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_casos_fecha_creacion 
  ON casos(fecha_creacion DESC);

-- Índice en fecha_actualizacion
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_casos_fecha_actualizacion 
  ON casos(fecha_actualizacion DESC);

-- Índice compuesto para estadísticas (estado + prioridad + asignado_a)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_casos_stats 
  ON casos(estado, prioridad, asignado_a);

-- ==================== ÍNDICES EN TABLA USUARIOS ====================

-- Índice en email (login muy frecuente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usuarios_email 
  ON usuarios(email) 
  UNIQUE;

-- Índice en rol (búsquedas por rol)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usuarios_rol 
  ON usuarios(rol);

-- Índice en activo (filtrar usuarios activos)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usuarios_activo 
  ON usuarios(activo) 
  WHERE activo = true;

-- Índice compuesto para búsquedas comunes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usuarios_rol_activo 
  ON usuarios(rol, activo);

-- Índice en nombre para búsquedas con LIKE
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usuarios_nombre_gin 
  ON usuarios USING GIN (nombre gin_trgm_ops);

-- ==================== EXTENSIONES NECESARIAS ====================

-- Extensión para búsquedas de texto difuso (LIKE mejorado)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ==================== ANÁLISIS Y VACÍO ====================

-- Analizar tabla para estadísticas del query planner
ANALYZE casos;
ANALYZE usuarios;

-- Notas de rendimiento:
-- - Los índices CONCURRENTLY no bloquean la tabla (seguro en producción)
-- - gin_trgm_ops permite búsquedas LIKE más rápidas
-- - Índices compuestos reducen N+1 queries
-- - Las fechas descendentes ayudan al ORDER BY DESC
