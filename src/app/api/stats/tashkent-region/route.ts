import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { CAMPAIGN_CONFIG } from '@/config/campaign';

const {
  TASHKENT_REGION_ID,
  TASHKENT_CITY_ID,
  DATA_START_DATE,
  CAMPAIGN_START_DATE,
  CAMPAIGN_END_DATE,
  CAMPAIGN_DURATION,
  TARGET_ACTIVE_DRIVERS,
  UTC_OFFSET_HOURS,
} = CAMPAIGN_CONFIG;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fromDate = searchParams.get('from_date') || DATA_START_DATE;

    // 1. PENDING drivers - by route (departure/arrival = Toshkent Viloyati), created_at >= fromDate
    const pendingQuery = `
      SELECT COUNT(*) as count
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      WHERE c.role_id = '2'
        AND c.status = 'pending'
        AND c.created_at >= $1
        AND (
          (di.departure_region_id = $2 AND di.arrival_region_id = $3)
          OR
          (di.departure_region_id = $3 AND di.arrival_region_id = $2)
        )
    `;

    // 2. ACTIVE drivers - by route (same as drivers page), created_at >= fromDate
    const activeQuery = `
      SELECT COUNT(*) as count
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      WHERE c.role_id = '2'
        AND c.status = 'active'
        AND c.created_at >= $1
        AND (
          (di.departure_region_id = $2 AND di.arrival_region_id = $3)
          OR
          (di.departure_region_id = $3 AND di.arrival_region_id = $2)
        )
    `;

    // 3. BLOCKED drivers - by route (same as drivers page), created_at >= fromDate
    const blockedQuery = `
      SELECT COUNT(*) as count
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      WHERE c.role_id = '2'
        AND c.status = 'blocked'
        AND c.created_at >= $1
        AND (
          (di.departure_region_id = $2 AND di.arrival_region_id = $3)
          OR
          (di.departure_region_id = $3 AND di.arrival_region_id = $2)
        )
    `;

    // 4. INACTIVE drivers - by route (same as drivers page), created_at >= fromDate
    const inactiveQuery = `
      SELECT COUNT(*) as count
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      WHERE c.role_id = '2'
        AND c.status = 'inactive'
        AND c.created_at >= $1
        AND (
          (di.departure_region_id = $2 AND di.arrival_region_id = $3)
          OR
          (di.departure_region_id = $3 AND di.arrival_region_id = $2)
        )
    `;

    // 5. Daily breakdown (for chart) - by route, UTC+5 timezone
    const dailyQuery = `
      SELECT
        DATE(c.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent') as date,
        COUNT(*) FILTER (WHERE c.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE c.status = 'active') as active,
        COUNT(*) FILTER (WHERE c.status = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE c.status = 'inactive') as inactive,
        COUNT(*) as total
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      WHERE c.role_id = '2'
        AND c.created_at >= $1
        AND (
          (di.departure_region_id = $2 AND di.arrival_region_id = $3)
          OR
          (di.departure_region_id = $3 AND di.arrival_region_id = $2)
        )
      GROUP BY DATE(c.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')
      ORDER BY date
    `;

    // 6. Sub-region breakdown - by route (consistent with drivers page)
    const subRegionQuery = `
      SELECT
        COALESCE(sr.id, '0') as id,
        COALESCE(sr.name->>'uz', 'Noma''lum') as name,
        COUNT(*) FILTER (WHERE c.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE c.status = 'active') as active,
        COUNT(*) FILTER (WHERE c.status = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE c.status = 'inactive') as inactive,
        COUNT(*) as total
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      LEFT JOIN sub_regions sr ON di.departure_sub_region_id = sr.id
      WHERE c.role_id = '2'
        AND c.created_at >= $1
        AND (
          (di.departure_region_id = $2 AND di.arrival_region_id = $3)
          OR
          (di.departure_region_id = $3 AND di.arrival_region_id = $2)
        )
      GROUP BY sr.id, sr.name
      ORDER BY total DESC
    `;

    const [pendingResult, activeResult, blockedResult, inactiveResult, dailyResult, subRegionResult] = await Promise.all([
      pool.query(pendingQuery, [fromDate, TASHKENT_REGION_ID, TASHKENT_CITY_ID]),
      pool.query(activeQuery, [fromDate, TASHKENT_REGION_ID, TASHKENT_CITY_ID]),
      pool.query(blockedQuery, [fromDate, TASHKENT_REGION_ID, TASHKENT_CITY_ID]),
      pool.query(inactiveQuery, [fromDate, TASHKENT_REGION_ID, TASHKENT_CITY_ID]),
      pool.query(dailyQuery, [fromDate, TASHKENT_REGION_ID, TASHKENT_CITY_ID]),
      pool.query(subRegionQuery, [fromDate, TASHKENT_REGION_ID, TASHKENT_CITY_ID]),
    ]);

    const pending = parseInt(pendingResult.rows[0]?.count || '0');
    const active = parseInt(activeResult.rows[0]?.count || '0');
    const blocked = parseInt(blockedResult.rows[0]?.count || '0');
    const inactive = parseInt(inactiveResult.rows[0]?.count || '0');

    // Calculate campaign metrics (from campaign start date, not data start date)
    const campaignStart = new Date(CAMPAIGN_START_DATE);
    // Use UTC+5 for today
    const now = new Date();
    const today = new Date(now.getTime() + (UTC_OFFSET_HOURS * 60 * 60 * 1000));

    const daysPassed = Math.max(1, Math.floor((today.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const daysRemaining = Math.max(0, CAMPAIGN_DURATION - daysPassed);
    const progress = (active / TARGET_ACTIVE_DRIVERS) * 100;
    const dailyRequired = daysRemaining > 0 ? (TARGET_ACTIVE_DRIVERS - active) / daysRemaining : 0;
    const currentRate = daysPassed > 0 ? active / daysPassed : 0;

    // Daily progress tracking
    const dailyTarget = TARGET_ACTIVE_DRIVERS / CAMPAIGN_DURATION; // 10 drivers per day
    const expectedByToday = Math.round(dailyTarget * daysPassed); // Expected cumulative by today
    const difference = active - expectedByToday; // Positive = ahead, Negative = behind
    const onTrack = difference >= 0;

    return NextResponse.json({
      summary: {
        pending,
        active,
        blocked,
        inactive,
        total: pending + active + blocked + inactive,
      },
      target: {
        goal: TARGET_ACTIVE_DRIVERS,
        current: active,
        progress: Math.round(progress * 10) / 10,
        daysPassed,
        daysRemaining,
        dailyRequired: Math.round(dailyRequired * 10) / 10,
        currentRate: Math.round(currentRate * 10) / 10,
        dailyTarget: Math.round(dailyTarget * 10) / 10,
        expectedByToday,
        difference,
        onTrack,
      },
      daily: dailyResult.rows,
      subRegions: subRegionResult.rows,
      meta: {
        dataStartDate: DATA_START_DATE,
        campaignStart: CAMPAIGN_START_DATE,
        campaignEnd: CAMPAIGN_END_DATE,
        region: 'Toshkent Viloyati',
        regionId: TASHKENT_REGION_ID,
      },
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics', details: String(error) },
      { status: 500 }
    );
  }
}
