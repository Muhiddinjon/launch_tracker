import { NextRequest, NextResponse } from 'next/server';
import { getFromStorage, setToStorage } from '@/lib/redis';
import pool from '@/lib/db';
import { BUDGET_CONFIG, CAMPAIGN_CONFIG } from '@/config/campaign';

// Storage keys
const SMS_DATA_KEY = 'reactivation-sms-data';

// SMS data structure
interface SmsData {
  phoneNumbers: string[];
  uploadedAt: string;
  totalSent: number;
  matchedDrivers: string[];
  conversionStats: {
    totalMatched: number;
    converted: number;
    pending: number;
    inactive: number;
  };
}

// Normalize phone number for comparison
function normalizePhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // Handle different formats: +998..., 998..., or just 9...
  if (digits.startsWith('998') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('9') && digits.length === 9) {
    return '998' + digits;
  }
  return digits;
}

// Load SMS data from storage
async function loadSmsData(): Promise<SmsData | null> {
  const data = await getFromStorage(SMS_DATA_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

// Save SMS data to storage
async function saveSmsData(data: SmsData): Promise<void> {
  await setToStorage(SMS_DATA_KEY, JSON.stringify(data));
}

// Budget storage key (same as in budget/route.ts)
const BUDGET_KEY = 'reactivation-budget';

// Get all drivers with full info for funnel calculation
async function getAllDriversFull(): Promise<Array<{
  id: string;
  phone_number: string;
  first_name: string | null;
  status: string;
  created_at: string;
  departure_region_id: string | null;
  arrival_region_id: string | null;
}>> {
  const query = `
    SELECT c.id, c.phone_number, c.first_name, c.status, c.created_at,
           di.departure_region_id, di.arrival_region_id
    FROM customers c
    LEFT JOIN driver_infos di ON c.id = di.customer_id
    WHERE c.role_id = '2'
      AND c.phone_number IS NOT NULL
  `;
  const result = await pool.query(query);
  return result.rows;
}

// Get total SMS cost from budget expenses
async function getSmsCostFromBudget(): Promise<{ totalUZS: number; totalUSD: number }> {
  const data = await getFromStorage(BUDGET_KEY);
  let totalUZS = 0;
  if (data) {
    try {
      const budgetData = JSON.parse(data);
      totalUZS = (budgetData.expenses || [])
        .filter((e: { categoryId: string }) => e.categoryId === 'sms')
        .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);
    } catch {
      // ignore
    }
  }
  return {
    totalUZS,
    totalUSD: totalUZS / BUDGET_CONFIG.USD_TO_UZS,
  };
}

// GET - Get SMS funnel stats
export async function GET() {
  try {
    const smsData = await loadSmsData();

    if (!smsData) {
      return NextResponse.json({
        uploaded: false,
        message: 'No SMS data uploaded yet',
      });
    }

    const { TASHKENT_REGION_ID, TASHKENT_CITY_ID, DATA_START_DATE } = CAMPAIGN_CONFIG;

    // Load all drivers and SMS cost in parallel
    const [allDrivers, smsCost] = await Promise.all([
      getAllDriversFull(),
      getSmsCostFromBudget(),
    ]);

    // Build last-9-digits set from SMS phone numbers
    const smsLast9Set = new Set(smsData.phoneNumbers.map(p => p.slice(-9)));

    // Match and compute funnel
    let loginCount = 0;
    let fullRegWithRoute = 0;
    let fullRegNoRoute = 0;
    let activeWithRoute = 0;
    let activeNoRoute = 0;

    const dataStartDate = new Date(DATA_START_DATE);

    for (const driver of allDrivers) {
      const driverLast9 = driver.phone_number.replace(/\D/g, '').slice(-9);
      if (!driverLast9 || !smsLast9Set.has(driverLast9)) continue;

      // Login: matched + created_at >= DATA_START_DATE
      const createdAt = new Date(driver.created_at);
      if (createdAt < dataStartDate) continue;

      loginCount++;

      // Full register check: first_name exists and not empty
      const isFullReg = driver.first_name && driver.first_name.trim() !== '';

      // Route check: Toshkent Viloyati ↔ Toshkent Shahar
      const isTashkentRoute =
        (driver.departure_region_id === TASHKENT_REGION_ID && driver.arrival_region_id === TASHKENT_CITY_ID) ||
        (driver.departure_region_id === TASHKENT_CITY_ID && driver.arrival_region_id === TASHKENT_REGION_ID);

      if (isFullReg) {
        fullRegNoRoute++;
        if (isTashkentRoute) fullRegWithRoute++;
      }

      if (isFullReg && driver.status === 'active') {
        activeNoRoute++;
        if (isTashkentRoute) activeWithRoute++;
      }
    }

    return NextResponse.json({
      uploaded: true,
      totalUniquePhones: smsData.totalSent,
      withRouteFilter: {
        login: loginCount,
        fullRegister: fullRegWithRoute,
        active: activeWithRoute,
      },
      withoutRouteFilter: {
        login: loginCount,
        fullRegister: fullRegNoRoute,
        active: activeNoRoute,
      },
      smsCost,
    });
  } catch (error) {
    console.error('Error loading SMS data:', error);
    return NextResponse.json(
      { error: 'Failed to load SMS data', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Upload SMS CSV data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvData, phoneColumn } = body;

    if (!csvData) {
      return NextResponse.json({ error: 'csvData is required' }, { status: 400 });
    }

    // Parse CSV - expect phone numbers in specified column or first column
    const lines = csvData.split('\n').filter((line: string) => line.trim());
    const phoneNumbers: string[] = [];

    // Skip header if it looks like a header
    const startIndex = lines[0]?.toLowerCase().includes('phone') ||
                       lines[0]?.toLowerCase().includes('telefon') ||
                       lines[0]?.toLowerCase().includes('raqam') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const columns = lines[i].split(/[,;\t]/);
      const colIndex = phoneColumn ? parseInt(phoneColumn) : 0;
      const phone = columns[colIndex]?.trim();

      if (phone) {
        const normalized = normalizePhone(phone);
        if (normalized.length >= 9) {
          phoneNumbers.push(normalized);
        }
      }
    }

    // Remove duplicates
    const uniquePhones = [...new Set(phoneNumbers)];

    // Get all drivers from database
    const allDrivers = await getAllDriversFull();

    // Match phone numbers with drivers
    let matchedDrivers: string[] = [];
    if (allDrivers.length > 0 && uniquePhones.length > 0) {
      // Get last 9 digits for matching
      const last9Set = new Set(uniquePhones.map(p => p.slice(-9)));

      // Match in memory (more efficient for large phone lists)
      matchedDrivers = allDrivers
        .filter(r => {
          const driverLast9 = r.phone_number?.replace(/\D/g, '').slice(-9);
          return driverLast9 && last9Set.has(driverLast9);
        })
        .map(r => r.id);
    }

    // Calculate conversion stats
    const conversionStats = {
      totalMatched: 0,
      converted: 0,
      pending: 0,
      inactive: 0,
    };

    if (matchedDrivers.length > 0) {
      const statsPlaceholders = matchedDrivers.map((_, i) => `$${i + 1}`).join(',');
      const statsQuery = `
        SELECT status, COUNT(*) as count
        FROM customers
        WHERE id IN (${statsPlaceholders})
        GROUP BY status
      `;
      const statsResult = await pool.query(statsQuery, matchedDrivers);

      conversionStats.totalMatched = matchedDrivers.length;
      statsResult.rows.forEach(row => {
        if (row.status === 'active') conversionStats.converted = parseInt(row.count);
        if (row.status === 'pending') conversionStats.pending = parseInt(row.count);
        if (row.status === 'inactive') conversionStats.inactive = parseInt(row.count);
      });
    }

    // Save SMS data
    const smsData: SmsData = {
      phoneNumbers: uniquePhones,
      uploadedAt: new Date().toISOString(),
      totalSent: uniquePhones.length,
      matchedDrivers,
      conversionStats,
    };

    await saveSmsData(smsData);

    // Calculate cost
    const costUZS = smsData.totalSent * BUDGET_CONFIG.CATEGORIES.SMS.costPerUnit;
    const costUSD = costUZS / BUDGET_CONFIG.USD_TO_UZS;

    return NextResponse.json({
      success: true,
      totalNumbers: uniquePhones.length,
      matchedDrivers: matchedDrivers.length,
      conversionStats,
      cost: {
        uzs: costUZS,
        usd: costUSD,
      },
      conversionRate: conversionStats.totalMatched > 0
        ? ((conversionStats.converted / conversionStats.totalMatched) * 100).toFixed(1) + '%'
        : '0%',
    });
  } catch (error) {
    console.error('Error processing SMS data:', error);
    return NextResponse.json(
      { error: 'Failed to process SMS data', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Clear SMS data
export async function DELETE() {
  try {
    await setToStorage(SMS_DATA_KEY, '');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing SMS data:', error);
    return NextResponse.json(
      { error: 'Failed to clear SMS data', details: String(error) },
      { status: 500 }
    );
  }
}
