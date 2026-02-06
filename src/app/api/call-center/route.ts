import { NextRequest, NextResponse } from 'next/server';
import { getFromStorage, setToStorage } from '@/lib/redis';
import pool from '@/lib/db';

// Storage key
const CALL_CENTER_DATA_KEY = 'call-center-data-v3';

// Call status options
export const CALL_STATUSES = {
  NOT_CALLED: 'not_called',
  WILL_REGISTER: 'will_register',      // O'tadi
  NOT_REACHABLE: 'not_reachable',      // Bog'lanib bo'lmadi
  WRONG_ROUTE: 'wrong_route',          // Boshqa yo'nalish
  NOT_SUITABLE: 'not_suitable',        // Mos emas
  ALREADY_REGISTERED: 'already_registered', // Allaqachon ro'yxatdan o'tgan
} as const;

// Data structure
interface PhoneEntry {
  phone: string;
  message: string;
  manualType: 'driver' | 'client' | null; // Operator tomonidan belgilangan
  callStatus: string;
  calledAt: string | null;
  notes: string | null;
}

interface CallCenterData {
  entries: PhoneEntry[];
  uploadedAt: string;
}

// Normalize phone number
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('9') && digits.length === 9) {
    return '998' + digits;
  }
  return digits;
}

// Load data
async function loadData(): Promise<CallCenterData | null> {
  const data = await getFromStorage(CALL_CENTER_DATA_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

// Save data
async function saveData(data: CallCenterData): Promise<void> {
  await setToStorage(CALL_CENTER_DATA_KEY, JSON.stringify(data));
}

// GET - Get all data with registration status (optimized)
export async function GET() {
  try {
    const storedData = await loadData();

    if (!storedData) {
      return NextResponse.json({ uploaded: false });
    }

    // Get phone last 9 digits
    const phoneLast9Set = new Set(
      storedData.entries.map(e => normalizePhone(e.phone).slice(-9))
    );

    // Single optimized query
    const query = `
      SELECT
        c.phone_number,
        c.first_name,
        c.last_name,
        c.status,
        c.role_id
      FROM customers c
      WHERE c.phone_number IS NOT NULL
    `;

    const result = await pool.query(query);

    // Build lookup map
    const dbLookup = new Map<string, {
      first_name: string | null;
      last_name: string | null;
      status: string;
      role_id: string;
    }>();

    result.rows.forEach(row => {
      const last9 = row.phone_number?.replace(/\D/g, '').slice(-9);
      if (last9 && phoneLast9Set.has(last9)) {
        dbLookup.set(last9, row);
      }
    });

    // Build entries with db info
    const entries = storedData.entries.map(entry => {
      const last9 = normalizePhone(entry.phone).slice(-9);
      const db = dbLookup.get(last9);

      const isRegistered = !!db;
      const isDriver = db?.role_id === '2';
      const isFullRegister = !!(db?.first_name && db.first_name.trim());
      const driverStatus = isDriver ? db?.status : null;
      const userName = db?.first_name
        ? `${db.first_name} ${db.last_name || ''}`.trim()
        : null;

      return {
        phone: entry.phone,
        message: entry.message,
        manualType: entry.manualType,
        callStatus: entry.callStatus,
        calledAt: entry.calledAt,
        notes: entry.notes,
        // DB info
        isRegistered,
        isDriver,
        isFullRegister,
        driverStatus,
        userName,
      };
    });

    // Stats
    const total = entries.length;
    const needsCall = entries.filter(e => !e.isFullRegister && e.callStatus === 'not_called').length;
    const calledEntries = entries.filter(e => e.callStatus !== 'not_called');
    const called = calledEntries.length;
    const fullRegistered = entries.filter(e => e.isFullRegister).length;
    const willRegister = entries.filter(e => e.callStatus === 'will_register').length;
    const notReachable = entries.filter(e => e.callStatus === 'not_reachable').length;

    // Call conversion stats - among called entries
    const calledAndRegistered = calledEntries.filter(e => e.isRegistered).length;
    const calledAndLogin = calledEntries.filter(e => e.isRegistered && !e.isFullRegister).length;
    const calledAndFullReg = calledEntries.filter(e => e.isFullRegister).length;
    const calledAndDriver = calledEntries.filter(e => e.isDriver).length;
    const calledAndActiveDriver = calledEntries.filter(e => e.isDriver && e.driverStatus === 'active').length;

    const drivers = entries.filter(e => e.isDriver);
    const activeDrivers = drivers.filter(d => d.driverStatus === 'active').length;

    return NextResponse.json({
      uploaded: true,
      uploadedAt: storedData.uploadedAt,
      stats: {
        total,
        needsCall,
        called,
        fullRegistered,
        willRegister,
        notReachable,
        drivers: drivers.length,
        activeDrivers,
        // Call conversion stats
        callConversion: {
          registered: calledAndRegistered,
          loginOnly: calledAndLogin,
          fullRegister: calledAndFullReg,
          drivers: calledAndDriver,
          activeDrivers: calledAndActiveDriver,
          conversionRate: called > 0 ? ((calledAndRegistered / called) * 100).toFixed(1) : '0',
        },
      },
      entries,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}

// POST - Upload CSV or update entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Upload CSV
    if (body.csvData) {
      const lines = body.csvData.split('\n').filter((l: string) => l.trim());
      const entries: PhoneEntry[] = [];

      const startIndex = lines[0]?.toLowerCase().includes('telefon') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        let phone = '';
        let message = '';

        if (line.includes('"')) {
          const match = line.match(/^([^,]+),(.*)$/);
          if (match) {
            phone = match[1].replace(/"/g, '').trim();
            message = match[2].replace(/^"|"$/g, '').trim();
          }
        } else {
          const parts = line.split(',');
          phone = parts[0]?.trim() || '';
          message = parts.slice(1).join(',').trim();
        }

        if (phone) {
          const normalized = normalizePhone(phone);
          if (normalized.length >= 9) {
            entries.push({
              phone: normalized,
              message,
              manualType: null,
              callStatus: 'not_called',
              calledAt: null,
              notes: null,
            });
          }
        }
      }

      // Remove duplicates
      const unique = Array.from(new Map(entries.map(e => [e.phone, e])).values());

      await saveData({
        entries: unique,
        uploadedAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, total: unique.length });
    }

    // Update entry
    if (body.phone && body.action === 'update') {
      const storedData = await loadData();
      if (!storedData) {
        return NextResponse.json({ error: 'No data' }, { status: 400 });
      }

      const phoneNorm = normalizePhone(body.phone);
      const idx = storedData.entries.findIndex(
        e => normalizePhone(e.phone) === phoneNorm
      );

      if (idx === -1) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      // Update fields
      if (body.callStatus) {
        storedData.entries[idx].callStatus = body.callStatus;
        storedData.entries[idx].calledAt = new Date().toISOString();
      }
      if (body.manualType !== undefined) {
        storedData.entries[idx].manualType = body.manualType;
      }
      if (body.notes !== undefined) {
        storedData.entries[idx].notes = body.notes;
      }

      await saveData(storedData);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE - with action parameter
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'reset_calls') {
      // Reset only call statuses, keep phone data
      const storedData = await loadData();
      if (storedData) {
        storedData.entries = storedData.entries.map(e => ({
          ...e,
          callStatus: 'not_called',
          calledAt: null,
          notes: null,
        }));
        await saveData(storedData);
      }
      return NextResponse.json({ success: true, action: 'reset_calls' });
    }

    // Full delete
    await setToStorage(CALL_CENTER_DATA_KEY, '');
    return NextResponse.json({ success: true, action: 'delete_all' });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
