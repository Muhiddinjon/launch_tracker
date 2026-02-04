'use client';

import { useState, useEffect, useRef } from 'react';

interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  byCategory: Record<string, { totalUSD: number; totalUZS: number; count: number }>;
  exchangeRate: number;
}

interface ExpenseEntry {
  id: string;
  categoryId: string;
  amount: number;
  currency: 'USD' | 'UZS';
  description: string;
  date: string;
  createdAt: string;
}

interface SmsData {
  uploaded: boolean;
  totalSent?: number;
  conversionStats?: {
    totalMatched: number;
    converted: number;
    pending: number;
    inactive: number;
  };
  cost?: {
    uzs: number;
    usd: number;
  };
  conversionRate?: string;
}

export default function BudgetPage() {
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [smsData, setSmsData] = useState<SmsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ categoryId: 'ads', amount: '', description: '' });
  const [uploadingSms, setUploadingSms] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [budgetRes, smsRes] = await Promise.all([
        fetch('/api/reactivation/budget'),
        fetch('/api/reactivation/sms'),
      ]);

      if (budgetRes.ok) {
        const data = await budgetRes.json();
        setBudgetSummary(data.summary);
        setExpenses(data.expenses || []);
      }

      if (smsRes.ok) {
        const data = await smsRes.json();
        setSmsData(data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: 'USD' | 'UZS' = 'USD') => {
    if (currency === 'UZS') {
      return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
    }
    return '$' + amount.toFixed(2);
  };

  const addExpense = async () => {
    if (!expenseForm.amount) return;
    setSaving(true);
    try {
      const res = await fetch('/api/reactivation/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense: {
            categoryId: expenseForm.categoryId,
            amount: parseFloat(expenseForm.amount),
            currency: expenseForm.categoryId === 'sms' ? 'UZS' : 'USD',
            description: expenseForm.description,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBudgetSummary(data.summary);
        setExpenses(data.expenses || []);
        setShowExpenseModal(false);
        setExpenseForm({ categoryId: 'ads', amount: '', description: '' });
      }
    } catch (err) {
      alert('Xatolik: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!confirm("Bu xarajatni o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/reactivation/budget?expenseId=${expenseId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      alert('Xatolik: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleSmsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSms(true);
    try {
      const text = await file.text();
      const res = await fetch('/api/reactivation/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: text }),
      });

      if (res.ok) {
        const data = await res.json();
        setSmsData({
          uploaded: true,
          totalSent: data.totalNumbers,
          conversionStats: data.conversionStats,
          cost: data.cost,
          conversionRate: data.conversionRate,
        });
        alert(`${data.totalNumbers} ta telefon raqam yuklandi. ${data.matchedDrivers} tasi driverlar bilan mos keldi.`);
      }
    } catch (err) {
      alert('Xatolik: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploadingSms(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getCategoryName = (categoryId: string) => {
    const names: Record<string, string> = {
      ads: 'Target reklama',
      sms: 'SMS',
      flyers: 'Flayerlar',
      telegram: 'Telegram',
    };
    return names[categoryId] || categoryId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kampaniya Byudjeti</h1>
        <p className="text-sm text-gray-600">Marketing xarajatlarini boshqarish</p>
      </div>

      {/* Budget Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Jami byudjet</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(budgetSummary?.totalBudget || 2750)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Sarflangan</div>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(budgetSummary?.totalSpent || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Qolgan</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(budgetSummary?.remaining || 2750)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Sarflangan %</div>
          <div className="text-2xl font-bold text-blue-600">
            {budgetSummary?.totalBudget
              ? Math.round((budgetSummary.totalSpent / budgetSummary.totalBudget) * 100)
              : 0}%
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Kategoriyalar bo'yicha</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Target reklama</div>
            <div className="text-xl font-bold text-blue-600">
              {formatCurrency(budgetSummary?.byCategory?.ads?.totalUSD || 0)}
            </div>
            <div className="text-xs text-gray-400">
              {budgetSummary?.byCategory?.ads?.count || 0} ta xarajat
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">SMS</div>
            <div className="text-xl font-bold text-green-600">
              {budgetSummary?.byCategory?.sms?.totalUZS
                ? formatCurrency(budgetSummary.byCategory.sms.totalUZS, 'UZS')
                : formatCurrency(0)}
            </div>
            <div className="text-xs text-gray-400">
              {budgetSummary?.byCategory?.sms?.count || 0} ta xarajat
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Flayerlar</div>
            <div className="text-xl font-bold text-orange-600">
              {formatCurrency(budgetSummary?.byCategory?.flyers?.totalUSD || 0)}
            </div>
            <div className="text-xs text-gray-400">
              {budgetSummary?.byCategory?.flyers?.count || 0} ta xarajat
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Telegram</div>
            <div className="text-xl font-bold text-purple-600">
              {formatCurrency(budgetSummary?.byCategory?.telegram?.totalUSD || 0)}
            </div>
            <div className="text-xs text-gray-400">
              {budgetSummary?.byCategory?.telegram?.count || 0} ta xarajat
            </div>
          </div>
        </div>
      </div>

      {/* SMS Campaign Section */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">SMS Kampaniyasi</h2>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleSmsUpload}
              className="hidden"
              id="sms-upload"
            />
            <label
              htmlFor="sms-upload"
              className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer ${
                uploadingSms
                  ? 'bg-gray-300 text-gray-500'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {uploadingSms ? 'Yuklanmoqda...' : 'CSV yuklash'}
            </label>
          </div>
        </div>

        {smsData?.uploaded ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Jo'natilgan SMS</div>
              <div className="text-xl font-bold text-blue-600">{smsData.totalSent || 0}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Driverlar bilan mos</div>
              <div className="text-xl font-bold text-purple-600">{smsData.conversionStats?.totalMatched || 0}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">SMS dan active</div>
              <div className="text-xl font-bold text-green-600">{smsData.conversionStats?.converted || 0}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">SMS konversiya</div>
              <div className="text-xl font-bold text-yellow-600">{smsData.conversionRate || '0%'}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">SMS xarajati</div>
              <div className="text-xl font-bold text-red-600">
                {smsData.cost ? formatCurrency(smsData.cost.uzs, 'UZS') : '-'}
              </div>
              <div className="text-xs text-gray-500">
                ~{smsData.cost ? formatCurrency(smsData.cost.usd) : '-'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>SMS ma'lumotlari hali yuklanmagan</p>
            <p className="text-sm mt-1">CSV faylni yuklang (telefon raqamlar ro'yxati)</p>
          </div>
        )}
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Xarajatlar tarixi</h2>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            + Xarajat qo'shish
          </button>
        </div>

        {expenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sana</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategoriya</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Izoh</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amal</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{expense.date}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{getCategoryName(expense.categoryId)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatCurrency(expense.amount, expense.currency)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{expense.description || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteExpense(expense.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        O'chirish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Hali xarajatlar qo'shilmagan
          </div>
        )}
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Xarajat qo'shish</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategoriya</label>
                <select
                  value={expenseForm.categoryId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="ads">Target reklama (USD)</option>
                  <option value="sms">SMS (UZS)</option>
                  <option value="flyers">Flayerlar (USD)</option>
                  <option value="telegram">Telegram (USD)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Summa ({expenseForm.categoryId === 'sms' ? "so'm" : 'USD'})
                </label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder={expenseForm.categoryId === 'sms' ? "Masalan: 2470000" : "Masalan: 40"}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Izoh (ixtiyoriy)</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Masalan: 1-kun target"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowExpenseModal(false);
                  setExpenseForm({ categoryId: 'ads', amount: '', description: '' });
                }}
                className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Bekor
              </button>
              <button
                onClick={addExpense}
                disabled={saving || !expenseForm.amount}
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
