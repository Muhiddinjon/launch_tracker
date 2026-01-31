import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { CAMPAIGN_CONFIG } from '@/config/campaign';
import { normalizePhone } from '@/lib/utils';

const { TASHKENT_REGION_ID, TASHKENT_CITY_ID } = CAMPAIGN_CONFIG;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phoneNumbers: string[] = body.phoneNumbers || [];

    if (phoneNumbers.length === 0) {
      return NextResponse.json({ error: 'No phone numbers provided' }, { status: 400 });
    }

    // Normalize all phone numbers
    const normalizedPhones = phoneNumbers.map(normalizePhone);

    // Query database for matching drivers
    const query = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.phone_number,
        c.status,
        c.created_at,
        di.region_id,
        r.name->>'uz' as region_name,
        di.departure_region_id,
        dep_r.name->>'uz' as departure_region_name,
        di.arrival_region_id,
        arr_r.name->>'uz' as arrival_region_name
      FROM customers c
      LEFT JOIN driver_infos di ON c.id = di.customer_id
      LEFT JOIN regions r ON di.region_id = r.id
      LEFT JOIN regions dep_r ON di.departure_region_id = dep_r.id
      LEFT JOIN regions arr_r ON di.arrival_region_id = arr_r.id
      WHERE c.role_id = '2'
        AND c.phone_number = ANY($1)
    `;

    const result = await pool.query(query, [normalizedPhones]);

    // Categorize results
    const matched = result.rows;
    const matchedPhones = new Set(matched.map(d => d.phone_number));
    const notRegistered = normalizedPhones.filter(p => !matchedPhones.has(p));

    // Check if matched drivers are in Tashkent region route
    const inTashkentRoute = matched.filter(d =>
      (d.departure_region_id === TASHKENT_REGION_ID && d.arrival_region_id === TASHKENT_CITY_ID) ||
      (d.departure_region_id === TASHKENT_CITY_ID && d.arrival_region_id === TASHKENT_REGION_ID)
    );

    // Status breakdown
    const statusBreakdown = {
      pending: matched.filter(d => d.status === 'pending').length,
      active: matched.filter(d => d.status === 'active').length,
      inactive: matched.filter(d => d.status === 'inactive').length,
      blocked: matched.filter(d => d.status === 'blocked').length,
    };

    return NextResponse.json({
      summary: {
        totalSent: normalizedPhones.length,
        registered: matched.length,
        notRegistered: notRegistered.length,
        inTashkentRoute: inTashkentRoute.length,
        conversionRate: ((matched.length / normalizedPhones.length) * 100).toFixed(1) + '%',
      },
      statusBreakdown,
      matched,
      notRegistered,
      inTashkentRoute,
    });
  } catch (error) {
    console.error('SMS match error:', error);
    return NextResponse.json(
      { error: 'Failed to match SMS', details: String(error) },
      { status: 500 }
    );
  }
}
