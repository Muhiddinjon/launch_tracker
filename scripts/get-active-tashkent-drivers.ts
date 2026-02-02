import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function getActiveTashkentDrivers() {
  const TASHKENT_REGION_ID = '9';

  const query = `
    SELECT
      c.id,
      c.first_name,
      c.last_name,
      c.phone_number,
      c.status,
      c.created_at,
      r.name->>'uz' as home_region,
      sr.name->>'uz' as home_sub_region,
      dep_r.name->>'uz' as departure_region,
      arr_r.name->>'uz' as arrival_region
    FROM customers c
    LEFT JOIN driver_infos di ON c.id = di.customer_id
    LEFT JOIN regions r ON di.region_id = r.id
    LEFT JOIN sub_regions sr ON di.sub_region_id = sr.id
    LEFT JOIN regions dep_r ON di.departure_region_id = dep_r.id
    LEFT JOIN regions arr_r ON di.arrival_region_id = arr_r.id
    WHERE c.role_id = '2'
      AND c.status = 'active'
      AND di.region_id = $1
    ORDER BY c.created_at DESC
  `;

  try {
    const result = await pool.query(query, [TASHKENT_REGION_ID]);

    console.log('\n========================================');
    console.log('TOSHKENT VILOYATI - ACTIVE DRIVERLAR');
    console.log('========================================\n');
    console.log(`Jami: ${result.rows.length} ta driver\n`);

    result.rows.forEach((driver, index) => {
      console.log(`${index + 1}. ${driver.first_name} ${driver.last_name}`);
      console.log(`   Tel: ${driver.phone_number}`);
      console.log(`   Tuman: ${driver.home_sub_region || 'Noma\'lum'}`);
      console.log(`   Yo'nalish: ${driver.departure_region} → ${driver.arrival_region}`);
      console.log(`   Ro'yxatdan o'tgan: ${new Date(driver.created_at).toLocaleDateString('uz-UZ')}`);
      console.log('');
    });

    // Return as JSON for further processing
    return result.rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

getActiveTashkentDrivers()
  .then((drivers) => {
    console.log('\n--- JSON Format ---\n');
    console.log(JSON.stringify(drivers, null, 2));
  })
  .catch(console.error);
