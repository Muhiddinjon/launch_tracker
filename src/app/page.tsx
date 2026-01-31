'use client';

import { useState, useEffect } from 'react';

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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, campaignsRes] = await Promise.all([
        fetch('/api/stats/tashkent-region?from_date=2026-01-26'),
        fetch('/api/campaigns'),
      ]);

      if (!statsRes.ok) throw new Error('Failed to fetch stats');

      const statsData = await statsRes.json();
      const campaignsData = campaignsRes.ok ? await campaignsRes.json() : { campaigns: [], dailyExpenses: [] };

      setStats(statsData);
      setCampaigns(campaignsData);
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
              <div className="text-3xl font-bold text-green-600">{stats?.summary.active}</div>
            </div>
            <span className="text-2xl">✅</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {dailyGrowth >= 0 ? (
              <span className="text-green-600">+{dailyGrowth} bugun</span>
            ) : (
              <span className="text-red-600">{dailyGrowth} bugun</span>
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
          <div className="mt-2 text-xs text-gray-400">Faol emas</div>
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
        stats?.target.onTrack
          ? 'bg-green-50 border-2 border-green-200'
          : 'bg-red-50 border-2 border-red-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{stats?.target.onTrack ? '✅' : '⚠️'}</span>
            <div>
              <h3 className={`text-lg font-bold ${stats?.target.onTrack ? 'text-green-700' : 'text-red-700'}`}>
                Day {stats?.target.daysPassed} / 30
              </h3>
              <p className="text-sm text-gray-600">
                {stats?.target.onTrack ? 'Grafikda!' : 'Grafikdan orqada'}
              </p>
            </div>
          </div>
          <div className={`text-4xl font-bold ${
            (stats?.target.difference || 0) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {(stats?.target.difference || 0) >= 0 ? '+' : ''}{stats?.target.difference}
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
                    stats?.target.onTrack ? 'bg-green-500' : 'bg-red-400'
                  }`}
                  style={{
                    width: `${Math.min(((stats?.summary.active || 0) / (stats?.target.expectedByToday || 1)) * 100, 100)}%`
                  }}
                >
                  <span className="text-white font-bold text-sm">{stats?.summary.active}</span>
                </div>
              </div>
              <div className="flex justify-between mt-1 text-xs">
                <span className="text-gray-400">0</span>
                <span className="text-gray-600 font-medium">
                  {Math.round(((stats?.summary.active || 0) / (stats?.target.expectedByToday || 1)) * 100)}% of today&apos;s target
                </span>
                <span className="text-gray-900 font-bold">{stats?.target.expectedByToday}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{stats?.target.expectedByToday}</div>
            <div className="text-xs text-gray-500">Bugun bo'lishi kerak</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{stats?.target.currentRate}</div>
            <div className="text-xs text-gray-500">O'rtacha/kun</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-bold ${
              (stats?.target.dailyRequired || 0) <= (stats?.target.dailyTarget || 10) ? 'text-green-600' : 'text-red-600'
            }`}>
              {stats?.target.dailyRequired}
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
