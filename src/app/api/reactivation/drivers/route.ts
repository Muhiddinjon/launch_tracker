import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getFromStorage, setToStorage } from '@/lib/redis';
import { CAMPAIGN_CONFIG, INACTIVE_REASON_CATEGORIES } from '@/config/campaign';

const { DATA_START_DATE, TASHKENT_REGION_ID, TASHKENT_CITY_ID } = CAMPAIGN_CONFIG;

// Redis key for storing tracked driver IDs
const TRACKED_DRIVERS_KEY = 'reactivation-driver-ids';

// Load tracked driver IDs from Redis
async function getTrackedDriverIds(): Promise<string[]> {
  const data = await getFromStorage(TRACKED_DRIVERS_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  return [];
}

// Save tracked driver IDs to Redis
async function saveTrackedDriverIds(ids: string[]): Promise<void> {
  await setToStorage(TRACKED_DRIVERS_KEY, JSON.stringify(ids));
}

// Add new driver IDs to tracked list
async function addToTrackedDrivers(newIds: string[]): Promise<string[]> {
  const existingIds = await getTrackedDriverIds();
  const uniqueIds = [...new Set([...existingIds, ...newIds])];
  await saveTrackedDriverIds(uniqueIds);
  return uniqueIds;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status'); // inactive, pending, active, or null for all
    const syncNew = searchParams.get('sync') !== 'false'; // Default: sync new drivers

    // 1. Get currently tracked driver IDs from Redis
    let trackedIds = await getTrackedDriverIds();

    // 2. Find NEW old drivers (pending/inactive) that aren't tracked yet
    if (syncNew) {
      const newDriversQuery = `
        SELECT c.id
        FROM customers c
        JOIN driver_infos di ON c.id = di.customer_id
        WHERE c.role_id = '2'
          AND c.created_at < $1
          AND c.status IN ('inactive', 'pending')
          AND (
            (di.departure_region_id = $2 AND di.arrival_region_id = $3)
            OR
            (di.departure_region_id = $3 AND di.arrival_region_id = $2)
            OR
            di.region_id = $2
          )
      `;

      const newDriversResult = await pool.query(newDriversQuery, [
        DATA_START_DATE,
        TASHKENT_REGION_ID,
        TASHKENT_CITY_ID,
      ]);

      const newIds = newDriversResult.rows.map(r => r.id);

      // Add new drivers to tracked list
      if (newIds.length > 0) {
        trackedIds = await addToTrackedDrivers(newIds);
      }
    }

    // 3. If no tracked drivers yet, return empty
    if (trackedIds.length === 0) {
      return NextResponse.json({
        data: [],
        summary: {
          total: 0,
          inactive: 0,
          active: 0,
          pending: 0,
          conversionRate: '0%',
        },
      });
    }

    // 4. Build status condition for filtering display
    let statusCondition = '';
    if (statusFilter) {
      statusCondition = `AND c.status = '${statusFilter}'`;
    }
    // No status filter = show ALL tracked drivers regardless of current status

    // 5. Fetch full driver data for ALL tracked IDs (including those now active!)
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
      WHERE c.id IN (${trackedIds.map(id => `'${id}'`).join(',')})
        ${statusCondition}
      ORDER BY
        CASE c.status
          WHEN 'active' THEN 1
          WHEN 'pending' THEN 2
          ELSE 3
        END,
        c.created_at DESC
    `;

    const result = await pool.query(query);

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
        active: totalActive,
        pending: totalPending,
        conversionRate: processedData.length > 0
          ? ((totalActive / processedData.length) * 100).toFixed(1) + '%'
          : '0%',
      },
      meta: {
        trackedTotal: trackedIds.length,
        lastSync: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drivers', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Manually add driver IDs to tracking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driverIds } = body;

    if (!driverIds || !Array.isArray(driverIds)) {
      return NextResponse.json({ error: 'driverIds array is required' }, { status: 400 });
    }

    const updatedIds = await addToTrackedDrivers(driverIds);

    return NextResponse.json({
      success: true,
      totalTracked: updatedIds.length,
    });
  } catch (error) {
    console.error('Error adding drivers:', error);
    return NextResponse.json(
      { error: 'Failed to add drivers', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Remove driver from tracking (optional)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');

    if (!driverId) {
      return NextResponse.json({ error: 'driverId is required' }, { status: 400 });
    }

    const trackedIds = await getTrackedDriverIds();
    const updatedIds = trackedIds.filter(id => id !== driverId);
    await saveTrackedDriverIds(updatedIds);

    return NextResponse.json({
      success: true,
      totalTracked: updatedIds.length,
    });
  } catch (error) {
    console.error('Error removing driver:', error);
    return NextResponse.json(
      { error: 'Failed to remove driver', details: String(error) },
      { status: 500 }
    );
  }
}
