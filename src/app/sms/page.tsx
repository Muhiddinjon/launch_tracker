'use client';

import { useState } from 'react';

interface MatchResult {
  summary: {
    totalSent: number;
    registered: number;
    notRegistered: number;
    inTashkentRoute: number;
    conversionRate: string;
  };
  statusBreakdown: {
    pending: number;
    active: number;
    inactive: number;
    blocked: number;
  };
  matched: Array<{
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    status: string;
    created_at: string;
    departure_region_name: string;
    arrival_region_name: string;
  }>;
  notRegistered: string[];
}

export default function SmsPage() {
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // Parse CSV - assume first column is phone number
      const lines = text.split('\n');
      const phones = lines
        .map(line => line.split(',')[0]?.trim())
        .filter(phone => phone && phone.length > 5);
      setPhoneNumbers(phones.join('\n'));
    };
    reader.readAsText(file);
  };

  const handleMatch = async () => {
    const phones = phoneNumbers
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 5);

    if (phones.length === 0) {
      setError('No phone numbers to match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/sms/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumbers: phones }),
      });

      if (!res.ok) throw new Error('Failed to match');

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SMS Matching</h1>
        <p className="text-sm text-gray-700">
          Import SMS nomerlarini va driver bazasi bilan solishtiring
        </p>
      </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Telefon Raqamlarni Import Qilish</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                CSV Fayl Yuklash
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1 text-xs text-gray-600">CSV yoki TXT fayl (birinchi ustun telefon raqami)</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Yoki raqamlarni yozing (har bir qatorda bitta)
              </label>
              <textarea
                value={phoneNumbers}
                onChange={(e) => setPhoneNumbers(e.target.value)}
                rows={6}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm border p-2 font-mono text-gray-900"
                placeholder="+998901234567&#10;998912345678&#10;901234567"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleMatch}
              disabled={loading || !phoneNumbers.trim()}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Tekshirilmoqda...' : 'Bazada Tekshirish'}
            </button>
            <span className="text-sm font-medium text-gray-700">
              {phoneNumbers.split('\n').filter(p => p.trim()).length} ta raqam
            </span>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 text-red-800 p-3 rounded-md font-medium">{error}</div>
          )}
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Summary Cards - Row 1 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm font-medium text-gray-700">Jami yuborilgan</div>
                <div className="text-3xl font-bold text-gray-900">{result.summary.totalSent}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                <div className="text-sm font-medium text-gray-700">Ro'yxatdan o'tgan</div>
                <div className="text-3xl font-bold text-blue-600">{result.summary.registered}</div>
                <div className="text-xs text-gray-500 mt-1">Login qilgan</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
                <div className="text-sm font-medium text-gray-700">Ro'yxatdan o'tmagan</div>
                <div className="text-3xl font-bold text-red-600">{result.summary.notRegistered}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
                <div className="text-sm font-medium text-gray-700">Konversiya</div>
                <div className="text-3xl font-bold text-purple-600">{result.summary.conversionRate}</div>
              </div>
            </div>

            {/* Status Breakdown Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-yellow-50 rounded-lg shadow p-4 border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-yellow-800">Pending</div>
                    <div className="text-2xl font-bold text-yellow-700">{result.statusBreakdown.pending}</div>
                  </div>
                  <span className="text-2xl">⏳</span>
                </div>
                <div className="text-xs text-yellow-600 mt-1">Kutilmoqda</div>
              </div>
              <div className="bg-green-50 rounded-lg shadow p-4 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-green-800">Active</div>
                    <div className="text-2xl font-bold text-green-700">{result.statusBreakdown.active}</div>
                  </div>
                  <span className="text-2xl">✅</span>
                </div>
                <div className="text-xs text-green-600 mt-1">Faol</div>
              </div>
              <div className="bg-gray-50 rounded-lg shadow p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">Inactive</div>
                    <div className="text-2xl font-bold text-gray-700">{result.statusBreakdown.inactive}</div>
                  </div>
                  <span className="text-2xl">💤</span>
                </div>
                <div className="text-xs text-gray-600 mt-1">Faol emas</div>
              </div>
              <div className="bg-red-50 rounded-lg shadow p-4 border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-red-800">Blocked</div>
                    <div className="text-2xl font-bold text-red-700">{result.statusBreakdown.blocked}</div>
                  </div>
                  <span className="text-2xl">🚫</span>
                </div>
                <div className="text-xs text-red-600 mt-1">Bloklangan</div>
              </div>
              <div className="bg-blue-50 rounded-lg shadow p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-blue-800">Toshkent yo'n.</div>
                    <div className="text-2xl font-bold text-blue-700">{result.summary.inTashkentRoute}</div>
                  </div>
                  <span className="text-2xl">🚗</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">Vil. ↔ Shahar</div>
              </div>
            </div>

            {/* Matched Drivers Table */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Topilgan Driverlar ({result.matched.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Ism</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Telefon</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Yo'nalish</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Sana</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.matched.map((driver) => (
                      <tr key={driver.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {driver.first_name} {driver.last_name}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-700">{driver.phone_number}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            driver.status === 'active' ? 'bg-green-100 text-green-800' :
                            driver.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            driver.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {driver.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {driver.departure_region_name} → {driver.arrival_region_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(driver.created_at).toLocaleDateString('uz-UZ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Not Registered */}
            {result.notRegistered.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Ro'yxatdan o'tmagan ({result.notRegistered.length})</h3>
                <div className="max-h-40 overflow-y-auto">
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {result.notRegistered.map((phone, i) => (
                      <div key={i} className="text-sm font-mono text-gray-700 bg-gray-100 p-2 rounded">
                        {phone}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}
