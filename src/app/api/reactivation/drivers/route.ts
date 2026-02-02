import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { CAMPAIGN_CONFIG, INACTIVE_REASON_CATEGORIES } from '@/config/campaign';

const { DATA_START_DATE, TASHKENT_REGION_ID, TASHKENT_CITY_ID } = CAMPAIGN_CONFIG;

// Get old drivers (created before campaign start date) who are inactive/pending
// or were converted to active through our reactivation efforts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status'); // inactive, pending, active, or null for all
    const trackedIds = searchParams.get('tracked_ids'); // comma-separated IDs of tracked drivers

    // Parse tracked driver IDs (these are drivers we've worked on)
    const trackedDriverIds = trackedIds ? trackedIds.split(',').filter(Boolean) : [];

    // Build status condition
    // Show: inactive, pending, OR active if they're in our tracking list
    let statusCondition = '';
    if (statusFilter) {
      statusCondition = `AND c.status = '${statusFilter}'`;
    } else {
      // Default: show inactive, pending, and active (if tracked)
      if (trackedDriverIds.length > 0) {
        statusCondition = `AND (c.status IN ('inactive', 'pending') OR (c.status = 'active' AND c.id IN (${trackedDriverIds.map(id => `'${id}'`).join(',')})))`;
      } else {
        statusCondition = `AND c.status IN ('inactive', 'pending')`;
      }
    }

    // Query for drivers created BEFORE data start date
    // Combined filtering: Route (Toshkent Viloyati ↔ Toshkent City) OR Home Region (Toshkent Viloyati)
    // This gives us unique drivers from both criteria
    const query = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.phone_number,
        c.status,
        c.created_at,
        r.id as region_id,
        r.name->>'uz' as region_name,
        sr.id as sub_region_id,
        sr.name->>'uz' as sub_region_name,
        dep_r.name->>'uz' as departure_region_name,
        arr_r.name->>'uz' as arrival_region_name,
        (
          SELECT json_agg(json_build_object(
            'reason_id', cmr_r.id,
            'reason_title', cmr_r.title->>'uz'
          ))
          FROM customer_moderation_reasons cmr
          JOIN reasons cmr_r ON cmr.reason_id = cmr_r.id
          WHERE cmr.customer_id = c.id
            AND cmr_r.id IN ('59', '60', '65')
        ) as inactive_reasons
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      LEFT JOIN regions r ON di.region_id = r.id
      LEFT JOIN sub_regions sr ON di.sub_region_id = sr.id
      LEFT JOIN regions dep_r ON di.departure_region_id = dep_r.id
      LEFT JOIN regions arr_r ON di.arrival_region_id = arr_r.id
      WHERE c.role_id = '2'
        AND c.created_at < $1
        AND (
          -- Route-based: Toshkent Viloyati ↔ Toshkent City
          (di.departure_region_id = $2 AND di.arrival_region_id = $3)
          OR
          (di.departure_region_id = $3 AND di.arrival_region_id = $2)
          OR
          -- Home region-based: Toshkent Viloyati
          di.region_id = $2
        )
        ${statusCondition}
      ORDER BY c.status DESC, c.created_at DESC
    `;

    const result = await pool.query(query, [DATA_START_DATE, TASHKENT_REGION_ID, TASHKENT_CITY_ID]);

    // Process inactive reasons
    const fixableReasonIds = INACTIVE_REASON_CATEGORIES.FIXABLE as readonly string[];
    const processedData = result.rows.map(row => {
      if (row.inactive_reasons && Array.isArray(row.inactive_reasons)) {
        const reasons = row.inactive_reasons.map((r: { reason_id: string; reason_title: string }) => ({
          ...r,
          isFixable: fixableReasonIds.includes(r.reason_id),
        }));
        return { ...row, inactive_reasons: reasons };
      }
      return row;
    });

    // Calculate summary
    const totalInactive = processedData.filter(d => d.status === 'inactive').length;
    const totalActive = processedData.filter(d => d.status === 'active').length;
    const totalPending = processedData.filter(d => d.status === 'pending').length;

    return NextResponse.json({
      data: processedData,
      summary: {
        total: processedData.length,
        inactive: totalInactive,
        active: totalActive,  // These were converted!
        pending: totalPending,
        conversionRate: processedData.length > 0
          ? ((totalActive / processedData.length) * 100).toFixed(1) + '%'
          : '0%',
      },
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch old inactive drivers', details: String(error) },
      { status: 500 }
    );
  }
}
