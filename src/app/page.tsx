'use client';

import { useState, useEffect } from 'react';

interface InactiveReason {
  reasonId: string;
  reasonTitle: string;
  count: number;
  isFixable: boolean;
}

interface Stats {
  summary: {
    pending: number;
    active: number;
    blocked: number;
    inactive: number;
    total: number;
  };
  target: {
    goal: number;
    current: number;
    progress: number;
    daysPassed: number;
    daysRemaining: number;
    dailyRequired: number;
    currentRate: number;
    dailyTarget: number;
    expectedByToday: number;
    difference: number;
    onTrack: boolean;
  };
  inactiveBreakdown?: {
    reasons: InactiveReason[];
    fixable: number;
    notEligible: number;
  };
  daily: Array<{
    date: string;
    pending: number;
    active: number;
    blocked: number;
    inactive: number;
    total: number;
  }>;
  subRegions: Array<{
    id: string;
    name: string;
    pending: number;
    active: number;
    blocked: number;
    inactive: number;
    total: number;
  }>;
}

interface Campaign {
  id: string;
  name: string;
  channel: string;
  spent: number;
  status: string;
  notes: string;
}

interface CampaignData {
  campaigns: Campaign[];
  dailyExpenses: Array<{
    date: string;
    campaignId: string;
    amount: number;
    description: string;
  }>;
}

interface ReactivationStats {
  trackingStats: {
    totalCalled: number;
    totalConverted: number;
  };
  driverSummary: {
    total: number;
    inactive: number;
    active: number;
    pending: number;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignData | null>(null);
  const [reactivation, setReactivation] = useState<ReactivationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, campaignsRes, trackingRes, driversRes] = await Promise.all([
        fetch('/api/stats/tashkent-region?from_date=2026-01-26'),
        fetch('/api/campaigns'),
        fetch('/api/reactivation/tracking'),
        fetch('/api/reactivation/drivers'),
      ]);

      if (!statsRes.ok) throw new Error('Failed to fetch stats');

      const statsData = await statsRes.json();
      const campaignsData = campaignsRes.ok ? await campaignsRes.json() : { campaigns: [], dailyExpenses: [] };
      const trackingData = trackingRes.ok ? await trackingRes.json() : { stats: { totalCalled: 0, totalConverted: 0 } };
      const driversData = driversRes.ok ? await driversRes.json() : { summary: { total: 0, inactive: 0, active: 0, pending: 0 } };

      setStats(statsData);
      setCampaigns(campaignsData);
      setReactivation({
        trackingStats: trackingData.stats,
        driverSummary: driversData.summary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    // Adjust for UTC+5
    date.setHours(date.getHours() + 5);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
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

  const totalSpent = campaigns?.campaigns.reduce((sum, c) => sum + c.spent, 0) || 0;

  // Calculate combined active: new active + reactivated (from Redis tracking)
  const newActive = stats?.summary.active || 0;
  const reactivatedActive = reactivation?.trackingStats.totalConverted || 0;
  const combinedActive = newActive + reactivatedActive;

  // Recalculate target metrics with combined active
  const targetGoal = stats?.target.goal || 250;
  const combinedProgress = (combinedActive / targetGoal) * 100;
  const daysRemaining = stats?.target.daysRemaining || 25;
  const combinedDailyRequired = daysRemaining > 0 ? (targetGoal - combinedActive) / daysRemaining : 0;
  const daysPassed = stats?.target.daysPassed || 1;
  const combinedCurrentRate = daysPassed > 0 ? combinedActive / daysPassed : 0;
  const expectedByToday = stats?.target.expectedByToday || 0;
  const combinedDifference = combinedActive - expectedByToday;
  const combinedOnTrack = combinedDifference >= 0;

  // Calculate daily growth
  const dailyData = stats?.daily || [];
  const todayData = dailyData[dailyData.length - 1];
  const yesterdayData = dailyData[dailyData.length - 2];
  const dailyGrowth = todayData && yesterdayData
    ? parseInt(String(todayData.active)) - parseInt(String(yesterdayData.active))
    : 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600">
          Campaign Day {stats?.target.daysPassed} of 30 | Campaign: 29.01 - 27.02.2026 | Data from: 26.01.2026
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-medium text-gray-500">PENDING</div>
              <div className="text-3xl font-bold text-yellow-600">{stats?.summary.pending}</div>
            </div>
            <span className="text-2xl">⏳</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">Tasdiqlash kutilmoqda</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-medium text-gray-500">ACTIVE</div>
              <div className="text-3xl font-bold text-green-600">{combinedActive}</div>
            </div>
            <span className="text-2xl">✅</span>
          </div>
          <div className="mt-2 text-xs space-y-0.5">
            <div className="text-gray-500">Yangi: <span className="text-green-600 font-medium">{newActive}</span></div>
            {reactivatedActive > 0 && (
              <div className="text-gray-500">Reaktivatsiya: <span className="text-purple-600 font-medium">+{reactivatedActive}</span></div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-medium text-gray-500">INACTIVE</div>
              <div className="text-3xl font-bold text-gray-600">{stats?.summary.inactive}</div>
            </div>
            <span className="text-2xl">💤</span>
          </div>
          {stats?.inactiveBreakdown && (stats.inactiveBreakdown.fixable > 0 || stats.inactiveBreakdown.notEligible > 0) && (
            <div className="mt-2 text-xs space-y-1">
              {stats.inactiveBreakdown.fixable > 0 && (
                <div className="text-orange-600">📝 Tuzatilishi mumkin: {stats.inactiveBreakdown.fixable}</div>
              )}
              {stats.inactiveBreakdown.notEligible > 0 && (
                <div className="text-red-500">🚫 Mos emas: {stats.inactiveBreakdown.notEligible}</div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-medium text-gray-500">TARGET</div>
              <div className="text-3xl font-bold text-blue-600">{stats?.target.goal}</div>
            </div>
            <span className="text-2xl">🎯</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">30 kun ichida active</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-medium text-gray-500">SPENT</div>
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalSpent)}</div>
            </div>
            <span className="text-2xl">💰</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">Marketing</div>
        </div>
      </div>

      {/* Daily Progress Status - Visual Progress Bar */}
      <div className={`rounded-lg shadow p-6 mb-6 ${
        combinedOnTrack
          ? 'bg-green-50 border-2 border-green-200'
          : 'bg-red-50 border-2 border-red-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{combinedOnTrack ? '✅' : '⚠️'}</span>
            <div>
              <h3 className={`text-lg font-bold ${combinedOnTrack ? 'text-green-700' : 'text-red-700'}`}>
                Day {daysPassed} / 30
              </h3>
              <p className="text-sm text-gray-600">
                {combinedOnTrack ? 'Grafikda!' : 'Grafikdan orqada'}
              </p>
            </div>
          </div>
          <div className={`text-4xl font-bold ${
            combinedDifference >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {combinedDifference >= 0 ? '+' : ''}{combinedDifference}
          </div>
        </div>

        {/* Visual Progress - Today's target */}
        <div className="relative pt-2 pb-2">
          {/* Progress bar - 100% = today's expected */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-8 relative overflow-hidden">
                <div
                  className={`h-8 rounded-full transition-all flex items-center justify-end pr-2 ${
                    combinedOnTrack ? 'bg-green-500' : 'bg-red-400'
                  }`}
                  style={{
                    width: `${Math.min((combinedActive / (expectedByToday || 1)) * 100, 100)}%`
                  }}
                >
                  <span className="text-white font-bold text-sm">{combinedActive}</span>
                </div>
              </div>
              <div className="flex justify-between mt-1 text-xs">
                <span className="text-gray-400">0</span>
                <span className="text-gray-600 font-medium">
                  {Math.round((combinedActive / (expectedByToday || 1)) * 100)}% of today&apos;s target
                </span>
                <span className="text-gray-900 font-bold">{expectedByToday}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{expectedByToday}</div>
            <div className="text-xs text-gray-500">Bugun bo'lishi kerak</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{Math.round(combinedCurrentRate * 10) / 10}</div>
            <div className="text-xs text-gray-500">O'rtacha/kun</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-bold ${
              combinedDailyRequired <= (stats?.target.dailyTarget || 10) ? 'text-green-600' : 'text-red-600'
            }`}>
              {Math.round(combinedDailyRequired * 10) / 10}
            </div>
            <div className="text-xs text-gray-500">Kerak/kun (qolgan)</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{stats?.target.daysRemaining}</div>
            <div className="text-xs text-gray-500">Qolgan kun</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily Growth - Table Format */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Kunlik Ro'yxatdan O'tish</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-gray-500 font-medium">Sana</th>
                  <th className="text-center py-2 text-yellow-600 font-medium">P</th>
                  <th className="text-center py-2 text-green-600 font-medium">A</th>
                  <th className="text-center py-2 text-gray-500 font-medium">I</th>
                  <th className="text-center py-2 text-gray-600 font-medium">Jami</th>
                  <th className="text-right py-2 text-gray-500 font-medium">+/-</th>
                </tr>
              </thead>
              <tbody>
                {stats?.daily.slice(-7).map((day, index, arr) => {
                  const prevDay = arr[index - 1];
                  const growth = prevDay ? parseInt(String(day.total)) - parseInt(String(prevDay.total)) : parseInt(String(day.total));

                  return (
                    <tr key={day.date} className="border-b last:border-0">
                      <td className="py-2 font-medium">{formatDate(day.date)}</td>
                      <td className="py-2 text-center">
                        <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                          {day.pending}
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          {day.active}
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {day.inactive}
                        </span>
                      </td>
                      <td className="py-2 text-center font-semibold">{day.total}</td>
                      <td className="py-2 text-right">
                        {growth > 0 ? (
                          <span className="text-green-600 font-medium">+{growth}</span>
                        ) : growth < 0 ? (
                          <span className="text-red-600 font-medium">{growth}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 pt-3 border-t flex justify-between text-sm">
            <span className="text-gray-500">Jami: <strong className="text-gray-900">{stats?.summary.total}</strong></span>
            <span className="text-gray-500">
              P: <strong className="text-yellow-600">{stats?.summary.pending}</strong> |
              A: <strong className="text-green-600">{stats?.summary.active}</strong> |
              I: <strong className="text-gray-600">{stats?.summary.inactive}</strong> |
              B: <strong className="text-red-600">{stats?.summary.blocked}</strong>
            </span>
          </div>
        </div>

        {/* Campaigns Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Marketing Channels</h3>
          <div className="space-y-3">
            {campaigns?.campaigns.filter(c => c.channel !== 'referral').map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{campaign.name}</div>
                  <div className="text-xs text-gray-500">{campaign.notes}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatCurrency(campaign.spent)}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    campaign.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <a href="/campaigns" className="block mt-4 text-center text-sm text-blue-600 hover:text-blue-800">
            Manage Campaigns →
          </a>
        </div>
      </div>

      {/* Inactive Breakdown */}
      {stats?.inactiveBreakdown && stats.inactiveBreakdown.reasons.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Inactive Driverlar Sababi</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.inactiveBreakdown.reasons.map((reason) => (
              <div
                key={reason.reasonId}
                className={`p-4 rounded-lg border-2 ${
                  reason.isFixable
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{reason.isFixable ? '📝' : '🚫'}</span>
                  <span className={`text-2xl font-bold ${reason.isFixable ? 'text-orange-600' : 'text-red-600'}`}>
                    {reason.count}
                  </span>
                </div>
                <div className={`text-sm font-medium ${reason.isFixable ? 'text-orange-800' : 'text-red-800'}`}>
                  {reason.reasonTitle}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {reason.isFixable ? 'Hujjatlarni tuzatib qayta murojaat qilishi mumkin' : 'Yangi mashina qo\'shishi kerak'}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t flex justify-between text-sm">
            <span className="text-orange-600">
              <strong>📝 Tuzatilishi mumkin:</strong> {stats.inactiveBreakdown.fixable} ta driver
            </span>
            <span className="text-red-600">
              <strong>🚫 Reglamentga mos emas:</strong> {stats.inactiveBreakdown.notEligible} ta driver
            </span>
          </div>
        </div>
      )}

      {/* Reactivation Section */}
      {reactivation && reactivation.driverSummary.total > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg shadow p-6 mb-6 border-2 border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔄</span>
              <div>
                <h3 className="text-lg font-semibold text-purple-900">Reaktivatsiya (Eski Driverlar)</h3>
                <p className="text-sm text-purple-600">26.01 dan oldin ro'yxatdan o'tgan driverlar</p>
              </div>
            </div>
            <a
              href="/reactivation"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
            >
              Batafsil →
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500">Jami eski</div>
              <div className="text-2xl font-bold text-purple-600">{reactivation.driverSummary.total}</div>
              <div className="text-xs text-gray-400">inactive/pending</div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500">Qo'ng'iroq qilindi</div>
              <div className="text-2xl font-bold text-blue-600">{reactivation.trackingStats.totalCalled}</div>
              <div className="text-xs text-gray-400">
                {reactivation.driverSummary.total > 0
                  ? `${Math.round((reactivation.trackingStats.totalCalled / reactivation.driverSummary.total) * 100)}%`
                  : '0%'}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500">Converted</div>
              <div className="text-2xl font-bold text-green-600">{reactivation.trackingStats.totalConverted}</div>
              <div className="text-xs text-green-500">active bo'ldi</div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500">Inactive</div>
              <div className="text-2xl font-bold text-gray-600">{reactivation.driverSummary.inactive}</div>
              <div className="text-xs text-gray-400">qoldi</div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">{reactivation.driverSummary.pending}</div>
              <div className="text-xs text-gray-400">kutilmoqda</div>
            </div>
          </div>

          {/* Conversion rate bar */}
          {reactivation.trackingStats.totalCalled > 0 && (
            <div className="mt-4 pt-4 border-t border-purple-200">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-purple-700">Konversiya darajasi</span>
                <span className="font-bold text-purple-900">
                  {reactivation.trackingStats.totalCalled > 0
                    ? `${Math.round((reactivation.trackingStats.totalConverted / reactivation.trackingStats.totalCalled) * 100)}%`
                    : '0%'}
                </span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${reactivation.trackingStats.totalCalled > 0
                      ? (reactivation.trackingStats.totalConverted / reactivation.trackingStats.totalCalled) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-regions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Tumanlar bo'yicha</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {stats?.subRegions.slice(0, 12).map((sr, index) => (
            <div key={sr.id || `sr-${index}`} className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-900 truncate">{sr.name || 'Noma\'lum'}</div>
              <div className="flex gap-2 mt-1 flex-wrap">
                <span className="text-xs font-medium text-yellow-700">P:{sr.pending}</span>
                <span className="text-xs font-medium text-green-700">A:{sr.active}</span>
                <span className="text-xs font-medium text-gray-500">I:{sr.inactive}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
