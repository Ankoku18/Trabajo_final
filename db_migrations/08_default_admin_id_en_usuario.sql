-- =====================================================================
-- MIGRACIÓN 08: Agregar DEFAULT a usuario.administrador_id_administrador
-- =====================================================================
-- Problema: columna NOT NULL sin DEFAULT, cualquier INSERT que omita
-- administrador_id_administrador falla con constraint violation.
-- Solución: poner como DEFAULT el id del administrador principal (id=4).
-- =====================================================================

ALTER TABLE base_de_datos_csu.usuario
  ALTER COLUMN administrador_id_administrador
  SET DEFAULT 4;

-- Verificar
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'base_de_datos_csu'
  AND table_name   = 'usuario'
  AND column_name  = 'administrador_id_administrador';
