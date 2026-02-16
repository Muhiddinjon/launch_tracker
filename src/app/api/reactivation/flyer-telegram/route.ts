import { NextResponse } from 'next/server';
import { getFromStorage } from '@/lib/redis';
import pool from '@/lib/db';
import { BUDGET_CONFIG, CAMPAIGN_CONFIG, SOURCE_CODES, FLYER_START_DATE } from '@/config/campaign';

const { TASHKENT_REGION_ID, TASHKENT_CITY_ID } = CAMPAIGN_CONFIG;
const SMS_DATA_KEY = 'reactivation-sms-data';
const BUDGET_KEY = 'reactivation-budget';

interface FunnelStats {
  login: number;
  fullRegister: number;
  active: number;
}

function emptyFunnel(): { withRouteFilter: FunnelStats; withoutRouteFilter: FunnelStats } {
  return {
    withRouteFilter: { login: 0, fullRegister: 0, active: 0 },
    withoutRouteFilter: { login: 0, fullRegister: 0, active: 0 },
  };
}

export async function GET() {
  try {
    // Load SMS phones, budget, and drivers in parallel
    const [smsRaw, budgetRaw, driversResult] = await Promise.all([
      getFromStorage(SMS_DATA_KEY),
      getFromStorage(BUDGET_KEY),
      pool.query(
        `SELECT c.id, c.phone_number, c.first_name, c.status,
                c.register_sources_comment,
                di.departure_region_id, di.arrival_region_id
         FROM customers c
         LEFT JOIN driver_infos di ON c.id = di.customer_id
         WHERE c.role_id = '2'
           AND c.phone_number IS NOT NULL
           AND c.created_at >= $1`,
        [FLYER_START_DATE]
      ),
    ]);

    // Build SMS last-9 set
    let smsLast9Set = new Set<string>();
    if (smsRaw) {
      try {
        const smsData = JSON.parse(smsRaw);
        smsLast9Set = new Set(smsData.phoneNumbers.map((p: string) => p.replace(/\D/g, '').slice(-9)));
      } catch { /* ignore */ }
    }

    // Get costs from budget
    let flyerUSD = 0;
    let telegramUSD = 0;
    if (budgetRaw) {
      try {
        const budgetData = JSON.parse(budgetRaw);
        for (const e of (budgetData.expenses || [])) {
          const amountUSD = e.currency === 'UZS' ? e.amount / BUDGET_CONFIG.USD_TO_UZS : e.amount;
          if (e.categoryId === 'flyers') flyerUSD += amountUSD;
          if (e.categoryId === 'telegram') telegramUSD += amountUSD;
        }
      } catch { /* ignore */ }
    }

    // Known source codes to exclude from flyer
    const allKnownSources = new Set([
      SOURCE_CODES.LEAD,
      SOURCE_CODES.REGULAR_TARGET,
      SOURCE_CODES.TELEGRAM_GLOBAL,
      SOURCE_CODES.TELEGRAM_ADS,
    ]);

    const flyer = emptyFunnel();
    const telegramGlobal = emptyFunnel();
    const telegramAds = emptyFunnel();

    for (const d of driversResult.rows) {
      const isFullReg = d.first_name && d.first_name.trim() !== '';
      const isTashkentRoute =
        (d.departure_region_id === TASHKENT_REGION_ID && d.arrival_region_id === TASHKENT_CITY_ID) ||
        (d.departure_region_id === TASHKENT_CITY_ID && d.arrival_region_id === TASHKENT_REGION_ID);

      let target: ReturnType<typeof emptyFunnel> | null = null;

      if (d.register_sources_comment === SOURCE_CODES.TELEGRAM_GLOBAL) {
        target = telegramGlobal;
      } else if (d.register_sources_comment === SOURCE_CODES.TELEGRAM_ADS) {
        target = telegramAds;
      } else if (!allKnownSources.has(d.register_sources_comment)) {
        // Not a known source — check if SMS
        const last9 = d.phone_number.replace(/\D/g, '').slice(-9);
        if (!smsLast9Set.has(last9)) {
          target = flyer;
        }
      }

      if (!target) continue;

      target.withoutRouteFilter.login++;
      if (isTashkentRoute) target.withRouteFilter.login++;

      if (isFullReg) {
        target.withoutRouteFilter.fullRegister++;
        if (isTashkentRoute) target.withRouteFilter.fullRegister++;
      }
      if (isFullReg && d.status === 'active') {
        target.withoutRouteFilter.active++;
        if (isTashkentRoute) target.withRouteFilter.active++;
      }
    }

    return NextResponse.json({
      flyer: {
        ...flyer,
        costUSD: flyerUSD,
        costUZS: flyerUSD * BUDGET_CONFIG.USD_TO_UZS,
      },
      telegramGlobal: {
        ...telegramGlobal,
        costUSD: 0, // no separate cost tracking
        costUZS: 0,
      },
      telegramAds: {
        ...telegramAds,
        costUSD: telegramUSD,
        costUZS: telegramUSD * BUDGET_CONFIG.USD_TO_UZS,
      },
      telegramTotal: {
        costUSD: telegramUSD,
        costUZS: telegramUSD * BUDGET_CONFIG.USD_TO_UZS,
      },
    });
  } catch (error) {
    console.error('Error loading flyer/telegram stats:', error);
    return NextResponse.json(
      { error: 'Failed to load stats', details: String(error) },
      { status: 500 }
    );
  }
}
