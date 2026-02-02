import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function checkInactiveReasons() {
  try {
    // 1. Check reasons table structure
    console.log('\n=== REASONS TABLE ===');
    const reasonsQuery = `
      SELECT id, title->>'uz' as title_uz, title->>'ru' as title_ru
      FROM reasons
      WHERE id IN ('59', '60', '65')
      ORDER BY id
    `;
    const reasons = await pool.query(reasonsQuery);
    console.log('Reasons (59, 60, 65):');
    reasons.rows.forEach(r => console.log(`  ID ${r.id}: ${r.title_uz} | ${r.title_ru}`));

    // 2. Check customer_moderation_reasons structure
    console.log('\n=== INACTIVE DRIVERS BY REASON ===');
    const inactiveQuery = `
      SELECT
        r.id as reason_id,
        r.title->>'uz' as reason_title,
        COUNT(DISTINCT c.id) as driver_count
      FROM customers c
      JOIN customer_moderation_reasons cmr ON c.id = cmr.customer_id
      JOIN reasons r ON cmr.reason_id = r.id
      WHERE c.role_id = '2'
        AND c.status = 'inactive'
        AND r.id IN ('59', '60', '65')
      GROUP BY r.id, r.title
      ORDER BY driver_count DESC
    `;
    const inactive = await pool.query(inactiveQuery);
    console.log('Inactive drivers by reason:');
    inactive.rows.forEach(r => console.log(`  Reason ${r.reason_id}: ${r.driver_count} ta - ${r.reason_title}`));

    // 3. Check for Tashkent region inactive drivers
    console.log('\n=== TASHKENT VILOYATI INACTIVE DRIVERS BY REASON ===');
    const tashkentInactiveQuery = `
      SELECT
        r.id as reason_id,
        r.title->>'uz' as reason_title,
        COUNT(DISTINCT c.id) as driver_count
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      JOIN customer_moderation_reasons cmr ON c.id = cmr.customer_id
      JOIN reasons r ON cmr.reason_id = r.id
      WHERE c.role_id = '2'
        AND c.status = 'inactive'
        AND di.region_id = '9'
        AND r.id IN ('59', '60', '65')
      GROUP BY r.id, r.title
      ORDER BY driver_count DESC
    `;
    const tashkentInactive = await pool.query(tashkentInactiveQuery);
    console.log('Tashkent viloyati inactive drivers by reason:');
    tashkentInactive.rows.forEach(r => console.log(`  Reason ${r.reason_id}: ${r.driver_count} ta - ${r.reason_title}`));

    // 4. List all inactive drivers with their reasons
    console.log('\n=== FULL LIST: TASHKENT INACTIVE DRIVERS ===');
    const fullListQuery = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.phone_number,
        r.id as reason_id,
        r.title->>'uz' as reason_title
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      LEFT JOIN customer_moderation_reasons cmr ON c.id = cmr.customer_id
      LEFT JOIN reasons r ON cmr.reason_id = r.id
      WHERE c.role_id = '2'
        AND c.status = 'inactive'
        AND di.region_id = '9'
      ORDER BY r.id, c.created_at DESC
    `;
    const fullList = await pool.query(fullListQuery);
    console.log(`Jami: ${fullList.rows.length} ta inactive driver\n`);
    fullList.rows.forEach((d, i) => {
      console.log(`${i + 1}. ${d.first_name} ${d.last_name} | ${d.phone_number}`);
      console.log(`   Sabab: [${d.reason_id || 'N/A'}] ${d.reason_title || 'Noma\'lum'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkInactiveReasons();
