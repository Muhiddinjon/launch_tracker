import { NextRequest, NextResponse } from 'next/server';
import { getFromStorage, setToStorage } from '@/lib/redis';
import pool from '@/lib/db';
import { BUDGET_CONFIG, CAMPAIGN_CONFIG } from '@/config/campaign';

const { TASHKENT_REGION_ID, TASHKENT_CITY_ID, DATA_START_DATE } = CAMPAIGN_CONFIG;

// Lead form source code
const LEAD_SOURCE_CODE = 'cml5adx980000la04tuyyeh8e';
// Regular target source code
const REGULAR_SOURCE_CODE = 'cmkurqj560002kt043hp58v76';

// Redis key for manual target stats (views, installs)
const TARGET_STATS_KEY = 'reactivation-target-stats';
// Budget Redis key
const BUDGET_KEY = 'reactivation-budget';

interface ManualTargetStats {
  regularViews: number;
  regularInstalls: number;
  regularRegistrations: number;
  leadViews: number;
  leadInstalls: number;
  updatedAt: string;
}

async function loadManualStats(): Promise<ManualTargetStats> {
  const data = await getFromStorage(TARGET_STATS_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      // ignore
    }
  }
  return { regularViews: 0, regularInstalls: 0, regularRegistrations: 0, leadViews: 0, leadInstalls: 0, updatedAt: '' };
}

async function getTargetCostFromBudget(): Promise<{ regularUSD: number; leadUSD: number; totalUSD: number }> {
  const data = await getFromStorage(BUDGET_KEY);
  let regularUSD = 0;
  let leadUSD = 0;
  if (data) {
    try {
      const budgetData = JSON.parse(data);
      const expenses = budgetData.expenses || [];
      for (const e of expenses) {
        const amount = e.currency === 'UZS' ? e.amount / BUDGET_CONFIG.USD_TO_UZS : e.amount;
        // Legacy 'ads' treated as regular
        if (e.categoryId === 'ads_regular' || e.categoryId === 'ads') {
          regularUSD += amount;
        } else if (e.categoryId === 'ads_lead') {
          leadUSD += amount;
        }
      }
    } catch {
      // ignore
    }
  }
  return { regularUSD, leadUSD, totalUSD: regularUSD + leadUSD };
}

// GET - Get target campaign stats
export async function GET() {
  try {
    const [manualStats, targetCost] = await Promise.all([
      loadManualStats(),
      getTargetCostFromBudget(),
    ]);

    // Single query for both lead and regular sources
    const query = `
      SELECT
        c.register_sources_comment as source,
        c.first_name,
        c.status,
        di.departure_region_id,
        di.arrival_region_id
      FROM customers c
      LEFT JOIN driver_infos di ON c.id = di.customer_id
      WHERE c.role_id = '2'
        AND c.created_at >= $1
        AND c.register_sources_comment IN ($2, $3)
    `;

    const result = await pool.query(query, [DATA_START_DATE, LEAD_SOURCE_CODE, REGULAR_SOURCE_CODE]);

    // Compute funnels
    let leadLogin = 0, leadFullRegRoute = 0, leadFullRegAll = 0, leadActiveRoute = 0, leadActiveAll = 0;
    let regLogin = 0, regFullRegRoute = 0, regFullRegAll = 0, regActiveRoute = 0, regActiveAll = 0;

    for (const row of result.rows) {
      const isFullReg = row.first_name && row.first_name.trim() !== '';
      const isTashkentRoute =
        (row.departure_region_id === TASHKENT_REGION_ID && row.arrival_region_id === TASHKENT_CITY_ID) ||
        (row.departure_region_id === TASHKENT_CITY_ID && row.arrival_region_id === TASHKENT_REGION_ID);

      if (row.source === LEAD_SOURCE_CODE) {
        leadLogin++;
        if (isFullReg) {
          leadFullRegAll++;
          if (isTashkentRoute) leadFullRegRoute++;
        }
        if (isFullReg && row.status === 'active') {
          leadActiveAll++;
          if (isTashkentRoute) leadActiveRoute++;
        }
      } else if (row.source === REGULAR_SOURCE_CODE) {
        regLogin++;
        if (isFullReg) {
          regFullRegAll++;
          if (isTashkentRoute) regFullRegRoute++;
        }
        if (isFullReg && row.status === 'active') {
          regActiveAll++;
          if (isTashkentRoute) regActiveRoute++;
        }
      }
    }

    return NextResponse.json({
      lead: {
        withRouteFilter: {
          login: leadLogin,
          fullRegister: leadFullRegRoute,
          active: leadActiveRoute,
        },
        withoutRouteFilter: {
          login: leadLogin,
          fullRegister: leadFullRegAll,
          active: leadActiveAll,
        },
      },
      regular: {
        views: manualStats.regularViews,
        installs: manualStats.regularInstalls,
        registrations: manualStats.regularRegistrations,
        withRouteFilter: {
          login: regLogin,
          fullRegister: regFullRegRoute,
          active: regActiveRoute,
        },
        withoutRouteFilter: {
          login: regLogin,
          fullRegister: regFullRegAll,
          active: regActiveAll,
        },
      },
      targetCost,
    });
  } catch (error) {
    console.error('Error loading target stats:', error);
    return NextResponse.json(
      { error: 'Failed to load target stats', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Update manual target stats (views, installs)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const current = await loadManualStats();

    const updated: ManualTargetStats = {
      regularViews: body.regularViews ?? current.regularViews,
      regularInstalls: body.regularInstalls ?? current.regularInstalls,
      regularRegistrations: body.regularRegistrations ?? current.regularRegistrations,
      leadViews: body.leadViews ?? current.leadViews,
      leadInstalls: body.leadInstalls ?? current.leadInstalls,
      updatedAt: new Date().toISOString(),
    };

    await setToStorage(TARGET_STATS_KEY, JSON.stringify(updated));

    return NextResponse.json({ success: true, ...updated });
  } catch (error) {
    console.error('Error saving target stats:', error);
    return NextResponse.json(
      { error: 'Failed to save target stats', details: String(error) },
      { status: 500 }
    );
  }
}
