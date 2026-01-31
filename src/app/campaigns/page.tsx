'use client';

import { useState, useEffect } from 'react';

interface Campaign {
  id: string;
  name: string;
  channel: string;
  startDate: string;
  spent: number;
  status: string;
  notes: string;
}

interface DailyExpense {
  id: string;
  date: string;
  campaignId: string;
  amount: number;
  description: string;
}

interface CampaignData {
  campaigns: Campaign[];
  dailyExpenses: DailyExpense[];
}

export default function CampaignsPage() {
  const [data, setData] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);

  // Expense form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    campaignId: '',
    amount: '',
    description: '',
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/campaigns');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          campaignId: form.campaignId,
          amount: parseInt(form.amount),
          description: form.description,
          dateFrom: form.dateFrom,
          dateTo: form.dateTo || form.dateFrom,
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setForm({ campaignId: '', amount: '', description: '', dateFrom: new Date().toISOString().split('T')[0], dateTo: '' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    date.setHours(date.getHours() + 5); // UTC+5
    return date.toLocaleDateString('uz-UZ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const campaigns = data?.campaigns.filter(c => c.channel !== 'referral') || [];
  const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0);

  // Group expenses by date
  const expensesByDate = (data?.dailyExpenses || []).reduce((acc, exp) => {
    if (!acc[exp.date]) acc[exp.date] = [];
    acc[exp.date].push(exp);
    return acc;
  }, {} as Record<string, DailyExpense[]>);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kampaniyalar</h1>
          <p className="text-sm text-gray-700">Marketing xarajatlarini track qilish</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-700">Jami sarflangan</div>
          <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalSpent)}</div>
        </div>
      </div>

      {/* Campaigns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  campaign.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {campaign.status}
                </span>
              </div>
              <span className="text-2xl">
                {campaign.channel === 'sms' && '📱'}
                {campaign.channel === 'target' && '🎯'}
                {campaign.channel === 'telegram' && '✈️'}
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-2">
              {formatCurrency(campaign.spent)}
            </div>
            <div className="text-xs text-gray-500">{campaign.notes}</div>
          </div>
        ))}
      </div>

      {/* Add Expense Button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        + Add Expense
      </button>

      {/* Expense Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">Yangi Xarajat Qo'shish</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Kanal</label>
              <select
                value={form.campaignId}
                onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2 text-gray-900"
                required
              >
                <option value="">Tanlang</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Summa</label>
              <input
                type="number"
                placeholder="so'm"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Sana (dan)</label>
              <input
                type="date"
                value={form.dateFrom}
                onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Sana (gacha)</label>
              <input
                type="date"
                value={form.dateTo}
                onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2 text-gray-900"
                placeholder="Ixtiyoriy"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Izoh</label>
              <input
                type="text"
                placeholder="Ixtiyoriy"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2 text-gray-900"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700">
              Saqlash
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300"
            >
              Bekor
            </button>
          </div>
        </form>
      )}

      {/* Expense History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold text-gray-900 mb-4">Xarajatlar Tarixi</h3>
        {Object.keys(expensesByDate).length === 0 ? (
          <p className="text-gray-600 text-center py-8">Hali xarajatlar kiritilmagan</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(expensesByDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, expenses]) => (
                <div key={date} className="border-b pb-4">
                  <div className="text-sm font-semibold text-gray-700 mb-2">{formatDate(date)}</div>
                  <div className="space-y-2">
                    {expenses.map((exp) => {
                      const campaign = campaigns.find(c => c.id === exp.campaignId);
                      return (
                        <div key={exp.id} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                          <div>
                            <span className="font-semibold text-gray-900">{campaign?.name}</span>
                            {exp.description && (
                              <span className="text-gray-700 text-sm ml-2">- {exp.description}</span>
                            )}
                          </div>
                          <span className="font-bold text-gray-900">{formatCurrency(exp.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
