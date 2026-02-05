import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { CAMPAIGN_CONFIG, INACTIVE_REASONS } from '@/config/campaign';

const {
  DATA_START_DATE,
  CAMPAIGN_START_DATE,
  CAMPAIGN_END_DATE,
  CAMPAIGN_DURATION,
  TARGET_ACTIVE_DRIVERS,
  UTC_OFFSET_HOURS,
  TASHKENT_CITY_ID,
} = CAMPAIGN_CONFIG;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fromDate = searchParams.get('from_date') || DATA_START_DATE;

    // 1. Overall stats - ALL drivers, ALL regions
    const overallQuery = `
      SELECT
        COUNT(*) FILTER (WHERE c.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE c.status = 'active') as active,
        COUNT(*) FILTER (WHERE c.status = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE c.status = 'inactive') as inactive,
        COUNT(*) as total
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      WHERE c.role_id = '2'
        AND c.created_at >= $1
    `;

    // 2. Stats by region (where region is either departure OR arrival)
    // This counts each driver for EACH region they're connected to
    // Excludes Toshkent city (ID: 2) since all routes go through Toshkent
    const byRegionQuery = `
      WITH driver_regions AS (
        SELECT DISTINCT
          c.id as customer_id,
          c.status,
          r.id as region_id,
          r.name->>'uz' as region_name
        FROM customers c
        JOIN driver_infos di ON c.id = di.customer_id
        JOIN regions r ON r.id IN (di.departure_region_id, di.arrival_region_id)
        WHERE c.role_id = '2'
          AND c.created_at >= $1
          AND r.id != $2
      )
      SELECT
        region_id,
        region_name,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
        COUNT(*) as total
      FROM driver_regions
      GROUP BY region_id, region_name
      ORDER BY active DESC, total DESC
    `;

    // 3. Daily breakdown - ALL regions
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
      GROUP BY DATE(c.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')
      ORDER BY date
    `;

    // 4. Inactive breakdown - ALL regions
    const fixableQuery = `
      SELECT COUNT(DISTINCT c.id) as count
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      JOIN customer_moderation_reasons cmr ON c.id = cmr.customer_id
      WHERE c.role_id = '2'
        AND c.status = 'inactive'
        AND c.created_at >= $1
        AND cmr.reason_id IN ($2, $3)
    `;

    const notEligibleQuery = `
      SELECT COUNT(DISTINCT c.id) as count
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      JOIN customer_moderation_reasons cmr ON c.id = cmr.customer_id
      WHERE c.role_id = '2'
        AND c.status = 'inactive'
        AND c.created_at >= $1
        AND cmr.reason_id = $2
    `;

    // 5. Old drivers who became active (created before campaign)
    const oldActiveQuery = `
      SELECT COUNT(*) as count
      FROM customers c
      JOIN driver_infos di ON c.id = di.customer_id
      WHERE c.role_id = '2'
        AND c.status = 'active'
        AND c.created_at < $1
    `;

    const [overallResult, byRegionResult, dailyResult, fixableResult, notEligibleResult, oldActiveResult] = await Promise.all([
      pool.query(overallQuery, [fromDate]),
      pool.query(byRegionQuery, [fromDate, TASHKENT_CITY_ID]),
      pool.query(dailyQuery, [fromDate]),
      pool.query(fixableQuery, [
        fromDate,
        INACTIVE_REASONS.PERSONAL_INFO_ERROR,
        INACTIVE_REASONS.CAR_INFO_ERROR,
      ]),
      pool.query(notEligibleQuery, [
        fromDate,
        INACTIVE_REASONS.CAR_NOT_ELIGIBLE,
      ]),
      pool.query(oldActiveQuery, [fromDate]),
    ]);

    const overall = overallResult.rows[0];
    const pending = parseInt(overall?.pending || '0');
    const active = parseInt(overall?.active || '0');
    const blocked = parseInt(overall?.blocked || '0');
    const inactive = parseInt(overall?.inactive || '0');
    const oldActiveCount = parseInt(oldActiveResult.rows[0]?.count || '0');

    const fixableCount = parseInt(fixableResult.rows[0]?.count || '0');
    const notEligibleCount = parseInt(notEligibleResult.rows[0]?.count || '0');

    // Campaign metrics
    const campaignStart = new Date(CAMPAIGN_START_DATE);
    const now = new Date();
    const today = new Date(now.getTime() + (UTC_OFFSET_HOURS * 60 * 60 * 1000));

    const daysPassed = Math.max(1, Math.floor((today.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const daysRemaining = Math.max(0, CAMPAIGN_DURATION - daysPassed);
    const progress = (active / TARGET_ACTIVE_DRIVERS) * 100;
    const dailyRequired = daysRemaining > 0 ? (TARGET_ACTIVE_DRIVERS - active) / daysRemaining : 0;
    const currentRate = daysPassed > 0 ? active / daysPassed : 0;

    const dailyTarget = TARGET_ACTIVE_DRIVERS / CAMPAIGN_DURATION;
    const expectedByToday = Math.round(dailyTarget * daysPassed);
    const difference = active - expectedByToday;
    const onTrack = difference >= 0;

    return NextResponse.json({
      summary: {
        pending,
        active,
        blocked,
        inactive,
        total: pending + active + blocked + inactive,
        oldActiveDrivers: oldActiveCount,
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
      inactiveBreakdown: {
        fixable: fixableCount,
        notEligible: notEligibleCount,
      },
      byRegion: byRegionResult.rows,
      daily: dailyResult.rows,
      meta: {
        dataStartDate: DATA_START_DATE,
        campaignStart: CAMPAIGN_START_DATE,
        campaignEnd: CAMPAIGN_END_DATE,
        scope: 'all_regions',
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
