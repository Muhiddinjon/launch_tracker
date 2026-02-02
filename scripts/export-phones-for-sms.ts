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

async function exportPhonesForSMS() {
  const TASHKENT_REGION_ID = '9';

  const query = `
    SELECT DISTINCT
      c.phone_number,
      c.first_name
    FROM customers c
    LEFT JOIN driver_infos di ON c.id = di.customer_id
    WHERE c.role_id = '2'
      AND c.status = 'active'
      AND di.region_id = $1
    ORDER BY c.phone_number
  `;

  try {
    const result = await pool.query(query, [TASHKENT_REGION_ID]);

    // Just phone numbers (one per line)
    const phones = result.rows.map(d => d.phone_number);

    // Save phone numbers only
    const phonesFile = `sms-phones-${new Date().toISOString().split('T')[0]}.txt`;
    fs.writeFileSync(phonesFile, phones.join('\n'), 'utf8');

    // Save with names for reference
    const detailedFile = `sms-phones-detailed-${new Date().toISOString().split('T')[0]}.csv`;
    const csvContent = 'Telefon,Ism\n' + result.rows.map(d => `${d.phone_number},"${d.first_name}"`).join('\n');
    fs.writeFileSync(detailedFile, '\uFEFF' + csvContent, 'utf8');

    console.log('\n========================================');
    console.log('SMS UCHUN TELEFON RAQAMLAR');
    console.log('========================================\n');
    console.log(`Jami: ${phones.length} ta raqam\n`);
    console.log(`Fayllar yaratildi:`);
    console.log(`  📱 ${phonesFile} - faqat raqamlar`);
    console.log(`  📋 ${detailedFile} - ismlar bilan\n`);

    // Show first 20 phones
    console.log('Birinchi 20 ta raqam:');
    phones.slice(0, 20).forEach((phone, i) => {
      console.log(`  ${i + 1}. ${phone}`);
    });

    return phones;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

exportPhonesForSMS().catch(console.error);
