-- =====================================================================
-- MIGRACIÓN 09: Sincronizar secuencias de PKs con el máximo real
-- =====================================================================
-- Causa del error:
--   "duplicate key value violates unique constraint"
-- Se produce cuando la secuencia está detrás del MAX(pk) de la tabla
-- (ocurre después de INSERTs directos o migraciones de datos manuales).
-- =====================================================================

SELECT setval(
  pg_get_serial_sequence('base_de_datos_csu.usuario',       'id_usuario'),
  GREATEST((SELECT COALESCE(MAX(id_usuario),1)       FROM base_de_datos_csu.usuario),       1)
);
SELECT setval(
  pg_get_serial_sequence('base_de_datos_csu.administrador', 'id_administrador'),
  GREATEST((SELECT COALESCE(MAX(id_administrador),1) FROM base_de_datos_csu.administrador), 1)
);
SELECT setval(
  pg_get_serial_sequence('base_de_datos_csu.gestor',        'id_gestor'),
  GREATEST((SELECT COALESCE(MAX(id_gestor),1)        FROM base_de_datos_csu.gestor),        1)
);
SELECT setval(
  pg_get_serial_sequence('base_de_datos_csu.tecnico',       'id_tecnico'),
  GREATEST((SELECT COALESCE(MAX(id_tecnico),1)       FROM base_de_datos_csu.tecnico),       1)
);
SELECT setval(
  pg_get_serial_sequence('base_de_datos_csu.cliente',       'id_cliente'),
  GREATEST((SELECT COALESCE(MAX(id_cliente),1)       FROM base_de_datos_csu.cliente),       1)
);
SELECT setval(
  pg_get_serial_sequence('base_de_datos_csu.categoria',     'id_categoria'),
  GREATEST((SELECT COALESCE(MAX(id_categoria),1)     FROM base_de_datos_csu.categoria),     1)
);
SELECT setval(
  pg_get_serial_sequence('base_de_datos_csu.ticket',        'id_ticket'),
  GREATEST((SELECT COALESCE(MAX(id_ticket),1)        FROM base_de_datos_csu.ticket),        1)
);
SELECT setval(
  pg_get_serial_sequence('base_de_datos_csu.seguimiento',   'id_seguimiento'),
  GREATEST((SELECT COALESCE(MAX(id_seguimiento),1)   FROM base_de_datos_csu.seguimiento),   1)
);
SELECT setval(
  pg_get_serial_sequence('base_de_datos_csu.archivo',       'id_archivo'),
  GREATEST((SELECT COALESCE(MAX(id_archivo),1)       FROM base_de_datos_csu.archivo),       1)
);
SELECT setval(
  pg_get_serial_sequence('base_de_datos_csu.informe',       'id_informe'),
  GREATEST((SELECT COALESCE(MAX(id_informe),1)       FROM base_de_datos_csu.informe),       1)
);
