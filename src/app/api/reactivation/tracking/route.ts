import { NextRequest, NextResponse } from 'next/server';
import { getFromStorage, setToStorage } from '@/lib/redis';

// Storage key for tracking data
const TRACKING_KEY = 'reactivation-tracking';

// Tracking data interface
interface TrackingEntry {
  driverId: string;
  callStatus: 'not_called' | 'called' | 'no_answer' | 'callback' | 'interested' | 'not_interested' | 'converted';
  notes: string;
  lastContactDate: string | null;
  callAttempts: number;
  createdAt: string;
  updatedAt: string;
}

interface TrackingData {
  entries: Record<string, TrackingEntry>;
  stats: {
    totalCalled: number;
    totalConverted: number;
    lastUpdated: string;
  };
}

// Load tracking data from storage
async function loadTrackingData(): Promise<TrackingData> {
  const data = await getFromStorage(TRACKING_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      // Invalid JSON, return default
    }
  }
  return {
    entries: {},
    stats: {
      totalCalled: 0,
      totalConverted: 0,
      lastUpdated: new Date().toISOString(),
    },
  };
}

// Save tracking data to storage
async function saveTrackingData(data: TrackingData): Promise<void> {
  data.stats.lastUpdated = new Date().toISOString();
  // Recalculate stats
  const entries = Object.values(data.entries);
  data.stats.totalCalled = entries.filter(e => e.callStatus !== 'not_called').length;
  data.stats.totalConverted = entries.filter(e => e.callStatus === 'converted').length;
  await setToStorage(TRACKING_KEY, JSON.stringify(data));
}

// GET - Load all tracking data
export async function GET() {
  try {
    const data = await loadTrackingData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error loading tracking data:', error);
    return NextResponse.json(
      { error: 'Failed to load tracking data', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Update tracking for a driver
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driverId, callStatus, notes } = body;

    if (!driverId) {
      return NextResponse.json({ error: 'driverId is required' }, { status: 400 });
    }

    const data = await loadTrackingData();
    const now = new Date().toISOString();

    const existingEntry = data.entries[driverId];

    data.entries[driverId] = {
      driverId,
      callStatus: callStatus || existingEntry?.callStatus || 'not_called',
      notes: notes !== undefined ? notes : (existingEntry?.notes || ''),
      lastContactDate: callStatus && callStatus !== 'not_called' ? now : (existingEntry?.lastContactDate || null),
      callAttempts: callStatus && callStatus !== 'not_called' && callStatus !== existingEntry?.callStatus
        ? (existingEntry?.callAttempts || 0) + 1
        : (existingEntry?.callAttempts || 0),
      createdAt: existingEntry?.createdAt || now,
      updatedAt: now,
    };

    await saveTrackingData(data);

    return NextResponse.json({
      success: true,
      entry: data.entries[driverId],
      stats: data.stats,
    });
  } catch (error) {
    console.error('Error saving tracking data:', error);
    return NextResponse.json(
      { error: 'Failed to save tracking data', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Remove tracking entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');

    if (!driverId) {
      return NextResponse.json({ error: 'driverId is required' }, { status: 400 });
    }

    const data = await loadTrackingData();
    delete data.entries[driverId];
    await saveTrackingData(data);

    return NextResponse.json({ success: true, stats: data.stats });
  } catch (error) {
    console.error('Error deleting tracking data:', error);
    return NextResponse.json(
      { error: 'Failed to delete tracking data', details: String(error) },
      { status: 500 }
    );
  }
}
