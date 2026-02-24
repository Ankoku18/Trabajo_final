import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres.ocoblumeyursvefwrgjo:Proyecto_csu@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=10',
  ssl: { rejectUnauthorized: false }
});

const TABLAS = [
  { tabla: 'usuario',       col: 'id_usuario' },
  { tabla: 'administrador', col: 'id_administrador' },
  { tabla: 'gestor',        col: 'id_gestor' },
  { tabla: 'tecnico',       col: 'id_tecnico' },
  { tabla: 'cliente',       col: 'id_cliente' },
  { tabla: 'categoria',     col: 'id_categoria' },
  { tabla: 'ticket',        col: 'id_ticket' },
  { tabla: 'seguimiento',   col: 'id_seguimiento' },
  { tabla: 'archivo',       col: 'id_archivo' },
  { tabla: 'informe',       col: 'id_informe' },
];

async function main() {
  console.log('=== DIAGNOSTICO Y CORRECCION DE SECUENCIAS ===\n');
  for (const { tabla, col } of TABLAS) {
    try {
      const r = await pool.query(
        `SELECT pg_get_serial_sequence('base_de_datos_csu.${tabla}', '${col}') AS seq,
                COALESCE(MAX(${col}), 0) AS max_id
         FROM base_de_datos_csu.${tabla}`
      );
      const seq    = r.rows[0].seq;
      const max_id = r.rows[0].max_id;
      if (!seq) { console.log(`SKIP  ${tabla}: sin secuencia serial`); continue; }
      const fix = await pool.query(`SELECT setval('${seq}', GREATEST($1, 1))`, [max_id]);
      console.log(
        `OK  ${tabla.padEnd(16)} ${col.padEnd(18)} max_pk=${String(max_id).padEnd(6)} seq_fijada=${fix.rows[0].setval}`
      );
    } catch (e) {
      console.log(`ERR ${tabla}.${col}: ${e.message.split('\n')[0]}`);
    }
  }
  console.log('\nListo. Proximos INSERT no chocaran con PK existentes.');
  await pool.end();
}

main().catch(async e => { console.error(e.message); await pool.end(); });
