'use client';

import { useState, useEffect, useCallback } from 'react';

interface InactiveReason {
  reason_id: string;
  reason_title: string;
  isFixable: boolean;
}

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  status: string;
  created_at: string;
  region_name: string | null;
  sub_region_name: string | null;
  departure_region_name: string | null;
  arrival_region_name: string | null;
  inactive_reasons: InactiveReason[] | null;
}

interface TrackingEntry {
  driverId: string;
  callStatus: string;
  notes: string;
  lastContactDate: string | null;
  callAttempts: number;
}

interface TrackingData {
  entries: Record<string, TrackingEntry>;
  stats: {
    totalCalled: number;
    totalConverted: number;
    lastUpdated: string;
  };
}

const callStatusOptions = [
  { value: 'not_called', label: "Qo'ng'iroq qilinmagan", color: 'bg-gray-100 text-gray-700' },
  { value: 'called', label: "Qo'ng'iroq qilindi", color: 'bg-blue-100 text-blue-700' },
  { value: 'no_answer', label: 'Javob bermadi', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'callback', label: 'Qayta aloqa', color: 'bg-purple-100 text-purple-700' },
  { value: 'interested', label: 'Qiziqdi', color: 'bg-green-100 text-green-700' },
  { value: 'not_interested', label: 'Qiziqmadi', color: 'bg-red-100 text-red-700' },
  { value: 'converted', label: 'Active bo\'ldi!', color: 'bg-emerald-500 text-white' },
];

export default function ReactivationPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'not_called' | 'in_progress' | 'converted'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'inactive' | 'pending'>('all');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ total: number; inactive: number; active: number; pending: number; conversionRate: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // First, fetch tracking data to get list of tracked driver IDs
      const trackingRes = await fetch('/api/reactivation/tracking');
      const trackingData = trackingRes.ok ? await trackingRes.json() : { entries: {}, stats: { totalCalled: 0, totalConverted: 0 } };
      setTracking(trackingData);

      // Get tracked driver IDs to include converted ones
      const trackedIds = Object.keys(trackingData.entries || {});

      // Fetch drivers with tracked IDs to show converted ones
      const params = new URLSearchParams();
      if (trackedIds.length > 0) {
        params.append('tracked_ids', trackedIds.join(','));
      }

      const driversRes = await fetch(`/api/reactivation/drivers?${params}`);
      if (!driversRes.ok) throw new Error('Failed to fetch drivers');

      const driversData = await driversRes.json();
      setDrivers(driversData.data);
      setSummary(driversData.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateTracking = async (driverId: string, callStatus: string, noteText?: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/reactivation/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          callStatus,
          notes: noteText !== undefined ? noteText : (tracking?.entries[driverId]?.notes || ''),
        }),
      });

      if (!res.ok) throw new Error('Failed to update tracking');

      const data = await res.json();
      setTracking(prev => prev ? {
        ...prev,
        entries: { ...prev.entries, [driverId]: data.entry },
        stats: data.stats,
      } : null);
    } catch (err) {
      alert('Xatolik: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!selectedDriver) return;
    await updateTracking(selectedDriver.id, tracking?.entries[selectedDriver.id]?.callStatus || 'not_called', notes);
    setSelectedDriver(null);
    setNotes('');
  };

  const getFilteredDrivers = () => {
    return drivers.filter(driver => {
      // First apply status filter (driver's actual status in DB)
      if (statusFilter !== 'all' && driver.status !== statusFilter) {
        // Allow active drivers if they're converted
        if (driver.status === 'active' && filter === 'converted') {
          // continue to call status filter
        } else {
          return false;
        }
      }

      // Then apply call status filter
      const entry = tracking?.entries[driver.id];
      const callStatus = entry?.callStatus || 'not_called';

      switch (filter) {
        case 'not_called':
          return callStatus === 'not_called';
        case 'in_progress':
          return ['called', 'no_answer', 'callback', 'interested'].includes(callStatus);
        case 'converted':
          return callStatus === 'converted' || driver.status === 'active';
        default:
          return true;
      }
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  const filteredDrivers = getFilteredDrivers();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reaktivatsiya</h1>
        <p className="text-sm text-gray-600">
          26.01.2026 dan oldin ro'yxatdan o'tgan inactive driverlar bilan ishlash
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Jami eski driverlar</div>
          <div className="text-2xl font-bold text-gray-900">{summary?.total || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Hozir inactive</div>
          <div className="text-2xl font-bold text-gray-600">{summary?.inactive || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Qo'ng'iroq qilindi</div>
          <div className="text-2xl font-bold text-blue-600">{tracking?.stats.totalCalled || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Active bo'ldi</div>
          <div className="text-2xl font-bold text-green-600">{summary?.active || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Konversiya</div>
          <div className="text-2xl font-bold text-emerald-600">{summary?.conversionRate || '0%'}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Driver holati:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'inactive' | 'pending')}
              className="text-sm border rounded-lg px-3 py-2 bg-white"
            >
              <option value="all">Hammasi</option>
              <option value="inactive">Inactive ({drivers.filter(d => d.status === 'inactive').length})</option>
              <option value="pending">Pending ({drivers.filter(d => d.status === 'pending').length})</option>
            </select>
          </div>

          <div className="h-6 border-l border-gray-300"></div>

          {/* Call Status Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Hammasi ({drivers.length})
            </button>
            <button
              onClick={() => setFilter('not_called')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === 'not_called' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Qo'ng'iroq qilinmagan ({drivers.filter(d => !tracking?.entries[d.id] || tracking.entries[d.id].callStatus === 'not_called').length})
            </button>
            <button
              onClick={() => setFilter('in_progress')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Jarayonda ({drivers.filter(d => {
                const s = tracking?.entries[d.id]?.callStatus;
                return ['called', 'no_answer', 'callback', 'interested'].includes(s || '');
              }).length})
            </button>
            <button
              onClick={() => setFilter('converted')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === 'converted' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              Active bo'ldi ({drivers.filter(d => d.status === 'active' || tracking?.entries[d.id]?.callStatus === 'converted').length})
            </button>
          </div>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ism</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sabab</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Holat</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qo'ng'iroq</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Izoh</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDrivers.map((driver, index) => {
                const entry = tracking?.entries[driver.id];
                const callStatus = entry?.callStatus || 'not_called';
                const statusOption = callStatusOptions.find(o => o.value === callStatus) || callStatusOptions[0];

                return (
                  <tr key={driver.id} className={`hover:bg-gray-50 ${driver.status === 'active' ? 'bg-green-50' : ''}`}>
                    <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {driver.first_name} {driver.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {driver.region_name} {driver.sub_region_name ? `/ ${driver.sub_region_name}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`tel:${driver.phone_number}`}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {driver.phone_number}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {driver.status === 'active' ? (
                        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-medium">
                          ACTIVE
                        </span>
                      ) : driver.inactive_reasons && driver.inactive_reasons.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {driver.inactive_reasons.map((reason, idx) => (
                            <span
                              key={idx}
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                reason.isFixable ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'
                              }`}
                              title={reason.reason_title}
                            >
                              {reason.isFixable ? '📝' : '🚫'} {reason.reason_title.substring(0, 20)}...
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        driver.status === 'active' ? 'bg-green-100 text-green-700' :
                        driver.status === 'inactive' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {driver.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={callStatus}
                        onChange={(e) => updateTracking(driver.id, e.target.value)}
                        disabled={saving}
                        className={`text-xs px-2 py-1 rounded border-0 font-medium cursor-pointer ${statusOption.color}`}
                      >
                        {callStatusOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {entry?.callAttempts && entry.callAttempts > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          {entry.callAttempts}x qo'ng'iroq
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedDriver(driver);
                          setNotes(entry?.notes || '');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        {entry?.notes ? '📝 Izoh bor' : '+ Izoh'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredDrivers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Bu filterda driver topilmadi
          </div>
        )}
      </div>

      {/* Notes Modal */}
      {selectedDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-2">
              {selectedDriver.first_name} {selectedDriver.last_name}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{selectedDriver.phone_number}</p>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Izoh yozing..."
              className="w-full border rounded-lg p-3 text-sm h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setSelectedDriver(null); setNotes(''); }}
                className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Bekor
              </button>
              <button
                onClick={saveNotes}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
