import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres.ocoblumeyursvefwrgjo:Proyecto_csu@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=10',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    // 1. Poner DEFAULT 4 en administrador_id_administrador
    await pool.query(`
      ALTER TABLE base_de_datos_csu.usuario
        ALTER COLUMN administrador_id_administrador
        SET DEFAULT 4
    `);
    console.log('✅ DEFAULT 4 establecido en administrador_id_administrador');

    // 2. Verificar
    const r = await pool.query(`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'base_de_datos_csu'
        AND table_name   = 'usuario'
        AND column_name  = 'administrador_id_administrador'
    `);
    console.log('Verificación:', r.rows[0]);
  } catch (e) {
    console.error('❌', e.message);
  } finally {
    await pool.end();
  }
}

main();
