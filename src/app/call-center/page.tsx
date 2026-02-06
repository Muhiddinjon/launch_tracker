'use client';

import { useState, useEffect, useCallback } from 'react';

const CALL_STATUS_OPTIONS = [
  { value: 'not_called', label: "Qo'ng'iroq qilinmadi", color: 'gray' },
  { value: 'will_register', label: "O'tadi", color: 'green' },
  { value: 'not_reachable', label: "Bog'lanib bo'lmadi", color: 'orange' },
  { value: 'wrong_route', label: "Boshqa yo'nalish", color: 'blue' },
  { value: 'not_suitable', label: 'Mos emas', color: 'red' },
];

// Message modal component
function MessageModal({ message, phone, onClose }: { message: string; phone: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <span className="font-medium text-gray-900">Xabar</span>
            <span className="ml-2 text-sm text-gray-500">+{phone}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <p className="whitespace-pre-wrap text-gray-700">{message}</p>
        </div>
        <div className="p-4 border-t flex justify-end">
          <a href={`tel:+${phone}`} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            Qo'ng'iroq qilish
          </a>
        </div>
      </div>
    </div>
  );
}

interface Entry {
  phone: string;
  message: string;
  manualType: 'driver' | 'client' | null;
  callStatus: string;
  calledAt: string | null;
  notes: string | null;
  isRegistered: boolean;
  isDriver: boolean;
  isFullRegister: boolean;
  driverStatus: string | null;
  userName: string | null;
}

interface Stats {
  total: number;
  needsCall: number;
  called: number;
  fullRegistered: number;
  willRegister: number;
  notReachable: number;
  drivers: number;
  activeDrivers: number;
  callConversion: {
    registered: number;
    loginOnly: number;
    fullRegister: number;
    drivers: number;
    activeDrivers: number;
    conversionRate: string;
  };
}

export default function CallCenterPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<{ phone: string; message: string } | null>(null);

  // Filters
  const [filter, setFilter] = useState<string>('needs_call'); // Default: needs call
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/call-center');
      const data = await res.json();
      if (data.uploaded) {
        setEntries(data.entries || []);
        setStats(data.stats);
        setUploaded(true);
      } else {
        setUploaded(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      await fetch('/api/call-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: text }),
      });
      await fetchData();
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (phone: string, updates: { callStatus?: string; manualType?: 'driver' | 'client' | null }) => {
    try {
      await fetch('/api/call-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, action: 'update', ...updates }),
      });
      // Refetch data
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter entries
  const filteredEntries = entries.filter(e => {
    // Search
    if (search && !e.phone.includes(search.replace(/\D/g, ''))) return false;

    switch (filter) {
      case 'needs_call':
        return !e.isFullRegister && e.callStatus === 'not_called';
      case 'full_registered':
        return e.isFullRegister;
      case 'will_register':
        return e.callStatus === 'will_register';
      case 'not_reachable':
        return e.callStatus === 'not_reachable';
      case 'called':
        return e.callStatus !== 'not_called';
      case 'all':
      default:
        return true;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'will_register': return 'bg-green-100 text-green-700';
      case 'not_reachable': return 'bg-orange-100 text-orange-700';
      case 'wrong_route': return 'bg-blue-100 text-blue-700';
      case 'not_suitable': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Yuklanmoqda...</div>;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Call Center</h1>
          <p className="text-sm text-gray-600">Gruppadan olingan raqamlar</p>
        </div>
        <div className="flex gap-2">
          <label className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer">
            {uploading ? '...' : 'CSV Yuklash'}
            <input type="file" accept=".csv" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      </div>

      {uploaded && stats && (
        <>
          {/* Stats Row 1 - Main stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="bg-white rounded shadow p-3 cursor-pointer hover:bg-gray-50" onClick={() => setFilter('all')}>
              <div className="text-xs text-gray-500">Jami Raqamlar</div>
              <div className="text-xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-orange-50 rounded shadow p-3 cursor-pointer hover:bg-orange-100" onClick={() => setFilter('needs_call')}>
              <div className="text-xs text-orange-600">Call Kerak</div>
              <div className="text-xl font-bold text-orange-700">{stats.needsCall}</div>
            </div>
            <div className="bg-blue-50 rounded shadow p-3 cursor-pointer hover:bg-blue-100" onClick={() => setFilter('called')}>
              <div className="text-xs text-blue-600">Call Qilindi</div>
              <div className="text-xl font-bold text-blue-700">{stats.called}</div>
            </div>
            <div className="bg-green-50 rounded shadow p-3 cursor-pointer hover:bg-green-100" onClick={() => setFilter('full_registered')}>
              <div className="text-xs text-green-600">To'liq Reg. (call shart emas)</div>
              <div className="text-xl font-bold text-green-700">{stats.fullRegistered}</div>
            </div>
          </div>

          {/* Stats Row 2 - Driver stats */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded shadow p-4 mb-4 border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-3">Hozirgi Holat (Jami)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded p-3 text-center">
                <div className="text-lg font-bold text-purple-700">{stats.drivers}</div>
                <div className="text-xs text-gray-600">Driverlar</div>
              </div>
              <div className="bg-white rounded p-3 text-center">
                <div className="text-lg font-bold text-emerald-700">{stats.activeDrivers}</div>
                <div className="text-xs text-gray-600">Active Driver</div>
              </div>
              <div className="bg-white rounded p-3 text-center">
                <div className="text-lg font-bold text-green-600">{stats.fullRegistered}</div>
                <div className="text-xs text-gray-600">Full Register</div>
              </div>
              <div className="bg-white rounded p-3 text-center">
                <div className="text-lg font-bold text-gray-600">{stats.total - stats.fullRegistered - (stats.drivers - stats.fullRegistered)}</div>
                <div className="text-xs text-gray-600">Ro'yxatdan O'tmagan</div>
              </div>
            </div>
          </div>

          {/* Stats Row 3 - Call status breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="bg-emerald-50 rounded shadow p-3 cursor-pointer hover:bg-emerald-100" onClick={() => setFilter('will_register')}>
              <div className="text-xs text-emerald-600">O'tadi</div>
              <div className="text-xl font-bold text-emerald-700">{stats.willRegister}</div>
            </div>
            <div className="bg-amber-50 rounded shadow p-3 cursor-pointer hover:bg-amber-100" onClick={() => setFilter('not_reachable')}>
              <div className="text-xs text-amber-600">Bog'lanib Bo'lmadi</div>
              <div className="text-xl font-bold text-amber-700">{stats.notReachable}</div>
            </div>
            <div className="bg-sky-50 rounded shadow p-3">
              <div className="text-xs text-sky-600">Boshqa Yo'nalish</div>
              <div className="text-xl font-bold text-sky-700">{entries.filter(e => e.callStatus === 'wrong_route').length}</div>
            </div>
            <div className="bg-red-50 rounded shadow p-3">
              <div className="text-xs text-red-600">Mos Emas</div>
              <div className="text-xl font-bold text-red-700">{entries.filter(e => e.callStatus === 'not_suitable').length}</div>
            </div>
          </div>

          {/* Call Conversion Stats */}
          {stats.called > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded shadow p-4 mb-6 border border-indigo-200">
              <h3 className="font-medium text-indigo-900 mb-3">Call Natijalari ({stats.called} ta call)</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white rounded p-3 text-center">
                  <div className="text-lg font-bold text-indigo-700">{stats.callConversion.registered}</div>
                  <div className="text-xs text-gray-600">Ro'yxatdan o'tdi</div>
                  <div className="text-xs text-indigo-500">{stats.callConversion.conversionRate}%</div>
                </div>
                <div className="bg-white rounded p-3 text-center">
                  <div className="text-lg font-bold text-yellow-600">{stats.callConversion.loginOnly}</div>
                  <div className="text-xs text-gray-600">Login Only</div>
                </div>
                <div className="bg-white rounded p-3 text-center">
                  <div className="text-lg font-bold text-green-600">{stats.callConversion.fullRegister}</div>
                  <div className="text-xs text-gray-600">Full Register</div>
                </div>
                <div className="bg-white rounded p-3 text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.callConversion.drivers}</div>
                  <div className="text-xs text-gray-600">Driver bo'ldi</div>
                </div>
                <div className="bg-white rounded p-3 text-center">
                  <div className="text-lg font-bold text-emerald-600">{stats.callConversion.activeDrivers}</div>
                  <div className="text-xs text-gray-600">Active Driver</div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded shadow p-3 mb-4 flex gap-3 items-center">
            <input
              type="text"
              placeholder="Telefon qidirish..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm w-40"
            />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm"
            >
              <option value="all">Barchasi</option>
              <option value="needs_call">Call kerak</option>
              <option value="full_registered">To'liq reg.</option>
              <option value="called">Call qilindi</option>
              <option value="will_register">O'tadi</option>
              <option value="not_reachable">Bog'lanmadi</option>
            </select>
            <span className="text-sm text-gray-500 ml-auto">{filteredEntries.length} ta</span>
          </div>

          {/* Table */}
          <div className="bg-white rounded shadow overflow-hidden">
            <div className="max-h-[calc(100vh-350px)] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Telefon</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Xabar</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Turi</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Reg. Holati</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Call Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredEntries.map((entry, idx) => (
                    <tr
                      key={entry.phone}
                      className={`hover:bg-gray-50 ${
                        entry.isFullRegister ? 'bg-green-50' :
                        entry.callStatus !== 'not_called' ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <a href={`tel:+${entry.phone}`} className="font-mono text-blue-600 hover:underline">
                          +{entry.phone}
                        </a>
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        <button
                          onClick={() => setSelectedMessage({ phone: entry.phone, message: entry.message })}
                          className="text-left truncate text-gray-700 hover:text-blue-600 hover:underline w-full"
                          title="Batafsil ko'rish"
                        >
                          {entry.message.slice(0, 50)}{entry.message.length > 50 ? '...' : ''}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        {entry.isRegistered ? (
                          <span className={`px-2 py-0.5 text-xs rounded ${entry.isDriver ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {entry.isDriver ? 'Driver' : 'Client'}
                          </span>
                        ) : (
                          <select
                            value={entry.manualType || ''}
                            onChange={e => handleUpdate(entry.phone, { manualType: (e.target.value as 'driver' | 'client') || null })}
                            className="text-xs border rounded px-1 py-0.5"
                          >
                            <option value="">-</option>
                            <option value="driver">Driver</option>
                            <option value="client">Client</option>
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {entry.isFullRegister ? (
                          <div>
                            <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
                              Full Register
                            </span>
                            {entry.isDriver && entry.driverStatus && (
                              <span className={`ml-1 px-2 py-0.5 text-xs rounded ${
                                entry.driverStatus === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                entry.driverStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {entry.driverStatus}
                              </span>
                            )}
                          </div>
                        ) : entry.isRegistered ? (
                          <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">
                            Login Only
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500">
                            Ro'yxatdan o'tmagan
                          </span>
                        )}
                        {entry.userName && (
                          <div className="text-xs text-gray-500 mt-0.5">{entry.userName}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {entry.isFullRegister ? (
                          <span className="text-xs text-green-600">Call shart emas</span>
                        ) : (
                          <select
                            value={entry.callStatus}
                            onChange={e => handleUpdate(entry.phone, { callStatus: e.target.value })}
                            className={`text-xs border rounded px-2 py-1 ${getStatusColor(entry.callStatus)}`}
                          >
                            {CALL_STATUS_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!uploaded && (
        <div className="bg-gray-50 rounded p-12 text-center">
          <div className="text-4xl mb-4">📞</div>
          <h3 className="font-medium text-gray-900 mb-2">Ma'lumot yo'q</h3>
          <p className="text-gray-600 text-sm">CSV faylni yuklang</p>
        </div>
      )}

      {/* Message Modal */}
      {selectedMessage && (
        <MessageModal
          phone={selectedMessage.phone}
          message={selectedMessage.message}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </div>
  );
}
