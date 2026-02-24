-- ====================================================================================
-- MIGRACION/SEED: Poblar c_costo con datos reales derivados de cliente/ticket/categoria
-- Esquema objetivo: base_de_datos_csu
-- ====================================================================================

BEGIN;

WITH ticket_enriquecido AS (
  SELECT
    COALESCE(t.id_cliente, t.cliente_id_cliente) AS id_cliente_ref,
    t.id_ticket,
    LOWER(COALESCE(t.estado::text, 'abierto')) AS estado_ticket,
    COALESCE(cat.prioridad::text, 'Media') AS prioridad_categoria,
    COALESCE(cat.tiempo_respuesta, 8) AS tiempo_respuesta,
    COALESCE(t.fecha_actualizacion, t.fecha_creacion) AS fecha_mov
  FROM base_de_datos_csu.ticket t
  LEFT JOIN base_de_datos_csu.categoria cat
    ON cat.id_categoria = t.categoria_id_categoria
),
metricas AS (
  SELECT
    c.id_cliente,
    COUNT(te.id_ticket) AS total_tickets,
    COUNT(*) FILTER (WHERE te.estado_ticket IN ('abierto', 'en_progreso', 'escalado')) AS abiertos,
    MAX(te.fecha_mov) AS ultima_actividad,
    COALESCE(SUM(
      1200000
      * (CASE UPPER(te.prioridad_categoria)
           WHEN 'ALTA' THEN 1.35
           WHEN 'MEDIA' THEN 1.00
           WHEN 'BAJA' THEN 0.75
           ELSE 1.00
         END)
      * (CASE
           WHEN te.tiempo_respuesta <= 2 THEN 1.15
           WHEN te.tiempo_respuesta <= 4 THEN 1.05
           ELSE 1.00
         END)
    ), 0) AS presupuesto_calc,
    COALESCE(SUM(
      1200000
      * (CASE UPPER(te.prioridad_categoria)
           WHEN 'ALTA' THEN 1.35
           WHEN 'MEDIA' THEN 1.00
           WHEN 'BAJA' THEN 0.75
           ELSE 1.00
         END)
      * (CASE
           WHEN te.tiempo_respuesta <= 2 THEN 1.15
           WHEN te.tiempo_respuesta <= 4 THEN 1.05
           ELSE 1.00
         END)
      * (CASE te.estado_ticket
           WHEN 'cerrado' THEN 1.00
           WHEN 'resuelto' THEN 1.00
           WHEN 'escalado' THEN 0.82
           WHEN 'en_progreso' THEN 0.65
           WHEN 'abierto' THEN 0.40
           ELSE 0.50
         END)
    ), 0) AS ejecutado_calc
  FROM base_de_datos_csu.cliente c
  LEFT JOIN ticket_enriquecido te
    ON te.id_cliente_ref = c.id_cliente
  GROUP BY c.id_cliente
),
fuente_cc AS (
  SELECT
    c.id_cliente,
    'CC-CL-' || LPAD(c.id_cliente::text, 4, '0') AS codigo,
    LEFT(COALESCE(c.empresa, 'Cliente ' || c.id_cliente::text) || ' - ' || COALESCE(c.sede, 'Sin sede'), 120) AS nombre,
    LEFT(
      'Generado desde datos reales. Tickets: ' || m.total_tickets
      || ' | Abiertos: ' || m.abiertos
      || ' | Cerrados/Resueltos: ' || GREATEST(m.total_tickets - m.abiertos, 0)
      || ' | Ultima actividad: ' || COALESCE(TO_CHAR(m.ultima_actividad, 'YYYY-MM-DD HH24:MI'), 'sin actividad')
      || ' | Contacto: ' || COALESCE(c.contacto_principal, 'N/A')
      || ' | Correo: ' || COALESCE(c.correo, 'N/A'),
      500
    ) AS descripcion,
    ROUND(
      GREATEST(
        m.presupuesto_calc,
        CASE WHEN m.total_tickets = 0 THEN 900000 ELSE 0 END
      )::numeric,
      2
    ) AS presupuesto,
    CASE
      WHEN m.total_tickets = 0 THEN 'inactivo'
      WHEN m.abiertos = 0 AND m.ejecutado_calc >= m.presupuesto_calc * 0.95 THEN 'cerrado'
      ELSE 'activo'
    END AS estado,
    COALESCE(m.ultima_actividad, NOW()) AS fecha_referencia
  FROM base_de_datos_csu.cliente c
  JOIN metricas m
    ON m.id_cliente = c.id_cliente
)
INSERT INTO base_de_datos_csu.c_costo (
  codigo,
  nombre,
  descripcion,
  presupuesto,
  estado,
  fecha_creacion,
  fecha_cierre,
  id_cliente
)
SELECT
  f.codigo,
  f.nombre,
  f.descripcion,
  f.presupuesto,
  f.estado,
  NOW(),
  CASE WHEN f.estado = 'cerrado' THEN NOW() ELSE f.fecha_referencia END,
  f.id_cliente
FROM fuente_cc f
ON CONFLICT (codigo)
DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  presupuesto = EXCLUDED.presupuesto,
  estado = EXCLUDED.estado,
  fecha_cierre = EXCLUDED.fecha_cierre,
  id_cliente = EXCLUDED.id_cliente;

UPDATE base_de_datos_csu.ticket t
SET id_c_costo = cc.id_c_costo
FROM base_de_datos_csu.c_costo cc
WHERE cc.id_cliente = COALESCE(t.id_cliente, t.cliente_id_cliente)
  AND (t.id_c_costo IS DISTINCT FROM cc.id_c_costo);

COMMIT;
