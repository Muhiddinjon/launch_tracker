import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

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

async function exportDriversToCSV() {
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

    // CSV Header
    const headers = ['#', 'Ism', 'Familiya', 'Telefon', 'Tuman', 'Yo\'nalish', 'Ro\'yxatdan o\'tgan'];

    // CSV Rows
    const rows = result.rows.map((driver, index) => {
      const date = new Date(driver.created_at).toLocaleDateString('uz-UZ');
      const route = `${driver.departure_region || ''} - ${driver.arrival_region || ''}`;
      return [
        index + 1,
        driver.first_name || '',
        driver.last_name || '',
        driver.phone_number || '',
        driver.home_sub_region || '',
        route,
        date
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Save to file
    const filename = `tashkent-active-drivers-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, '\uFEFF' + csvContent, 'utf8'); // BOM for Excel UTF-8

    console.log(`\n✅ CSV fayl yaratildi: ${filename}`);
    console.log(`📊 Jami: ${result.rows.length} ta driver\n`);

    return filename;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

exportDriversToCSV().catch(console.error);
