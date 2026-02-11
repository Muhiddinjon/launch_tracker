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

interface SmsFunnelStats {
  login: number;
  fullRegister: number;
  active: number;
}

interface SmsData {
  uploaded: boolean;
  totalUniquePhones?: number;
  withRouteFilter?: SmsFunnelStats;
  withoutRouteFilter?: SmsFunnelStats;
  smsCost?: {
    totalUZS: number;
    totalUSD: number;
  };
}

interface FunnelStats {
  login: number;
  fullRegister: number;
  active: number;
}

interface TargetData {
  lead: {
    withRouteFilter: FunnelStats;
    withoutRouteFilter: FunnelStats;
  };
  regular: {
    views: number;
    installs: number;
    registrations: number;
    withRouteFilter: FunnelStats;
    withoutRouteFilter: FunnelStats;
  };
  targetCost: { regularUSD: number; leadUSD: number; totalUSD: number };
}

const FUNNEL_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-700',   bar: 'bg-blue-500' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-500' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500' },
  green:  { bg: 'bg-green-100',  text: 'text-green-700',  bar: 'bg-green-500' },
};

function FunnelRow({ label, count, prevCount, costTotal, color, widthPercent, formatCurrency: fmt }: {
  label: string;
  count: number;
  prevCount?: number;
  costTotal?: number;
  color: string;
  widthPercent: number;
  formatCurrency: (amount: number, currency?: 'USD' | 'UZS') => string;
}) {
  const c = FUNNEL_COLORS[color] || FUNNEL_COLORS.blue;
  const convRate = prevCount && prevCount > 0 ? ((count / prevCount) * 100).toFixed(1) : null;
  const costPer = costTotal && count > 0 ? Math.round(costTotal / count) : null;

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs font-medium text-gray-600 text-right">{label}</div>
      <div className="flex-1">
        <div
          className={`${c.bg} rounded-md px-3 py-2 flex items-center justify-between transition-all`}
          style={{ width: `${Math.min(100, widthPercent)}%`, minWidth: '120px' }}
        >
          <span className={`font-bold text-lg ${c.text}`}>{count.toLocaleString()}</span>
          {convRate && (
            <span className="text-xs text-gray-500 ml-2">{convRate}%</span>
          )}
        </div>
      </div>
      <div className="w-40 text-right text-xs text-gray-500">
        {costPer ? (
          <span>{fmt(costPer, 'UZS')}<span className="text-gray-400"> /ta</span></span>
        ) : ''}
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [smsData, setSmsData] = useState<SmsData | null>(null);
  const [targetData, setTargetData] = useState<TargetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetForm, setTargetForm] = useState({ regularViews: '', regularInstalls: '', regularRegistrations: '' });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ categoryId: 'ads_regular', amount: '', description: '' });
  const [uploadingSms, setUploadingSms] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [budgetRes, smsRes, targetRes] = await Promise.all([
        fetch('/api/reactivation/budget'),
        fetch('/api/reactivation/sms'),
        fetch('/api/reactivation/target'),
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

      if (targetRes.ok) {
        const data = await targetRes.json();
        setTargetData(data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: 'USD' | 'UZS' = 'USD') => {
    if (currency === 'UZS') {
      return new Intl.NumberFormat('en-US').format(Math.round(amount)) + " so'm";
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
        setExpenseForm({ categoryId: 'ads_regular', amount: '', description: '' });
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
        alert(`${data.totalNumbers} ta telefon raqam yuklandi.`);
        await fetchData();
      }
    } catch (err) {
      alert('Xatolik: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploadingSms(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveTargetStats = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/reactivation/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regularViews: parseInt(targetForm.regularViews) || 0,
          regularInstalls: parseInt(targetForm.regularInstalls) || 0,
          regularRegistrations: parseInt(targetForm.regularRegistrations) || 0,
        }),
      });
      if (res.ok) {
        setShowTargetModal(false);
        setTargetForm({ regularViews: '', regularInstalls: '', regularRegistrations: '' });
        await fetchData();
      }
    } catch (err) {
      alert('Xatolik: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const getCategoryName = (categoryId: string) => {
    const names: Record<string, string> = {
      ads: 'Target oddiy',
      ads_regular: 'Target oddiy',
      ads_lead: 'Target lead',
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Target oddiy</div>
            <div className="text-xl font-bold text-blue-600">
              {formatCurrency(budgetSummary?.byCategory?.ads_regular?.totalUSD || 0)}
            </div>
            <div className="text-xs text-gray-400">
              {budgetSummary?.byCategory?.ads_regular?.count || 0} ta xarajat
            </div>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Target lead</div>
            <div className="text-xl font-bold text-indigo-600">
              {formatCurrency(budgetSummary?.byCategory?.ads_lead?.totalUSD || 0)}
            </div>
            <div className="text-xs text-gray-400">
              {budgetSummary?.byCategory?.ads_lead?.count || 0} ta xarajat
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
          <div className="flex items-center gap-3">
            {smsData?.smsCost && smsData.smsCost.totalUZS > 0 && (
              <span className="text-sm text-gray-500">
                Umumiy xarajat: <span className="font-semibold text-gray-700">{formatCurrency(smsData.smsCost.totalUZS, 'UZS')}</span>
                <span className="text-gray-400 ml-1">(~{formatCurrency(smsData.smsCost.totalUSD)})</span>
              </span>
            )}
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
          <div className="space-y-6">
            {/* Funnel 1: Toshkent yo'nalishi */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Toshkent yo'nalishi (Viloyat - Shahar)</h3>
              <div className="space-y-2">
                <FunnelRow
                  label="Jo'natilgan"
                  count={smsData.totalUniquePhones || 0}
                  color="blue"
                  widthPercent={100}
                  formatCurrency={formatCurrency}
                />
                <FunnelRow
                  label="Login Page"
                  count={smsData.withRouteFilter?.login || 0}
                  prevCount={smsData.totalUniquePhones || 0}
                  costTotal={smsData.smsCost?.totalUZS || 0}
                  color="purple"
                  widthPercent={Math.max(15, ((smsData.withRouteFilter?.login || 0) / (smsData.totalUniquePhones || 1)) * 100)}
                  formatCurrency={formatCurrency}
                />
                <FunnelRow
                  label="Full Register"
                  count={smsData.withRouteFilter?.fullRegister || 0}
                  prevCount={smsData.withRouteFilter?.login || 0}
                  costTotal={smsData.smsCost?.totalUZS || 0}
                  color="yellow"
                  widthPercent={Math.max(10, ((smsData.withRouteFilter?.fullRegister || 0) / (smsData.totalUniquePhones || 1)) * 100)}
                  formatCurrency={formatCurrency}
                />
                <FunnelRow
                  label="Active"
                  count={smsData.withRouteFilter?.active || 0}
                  prevCount={smsData.withRouteFilter?.fullRegister || 0}
                  costTotal={smsData.smsCost?.totalUZS || 0}
                  color="green"
                  widthPercent={Math.max(8, ((smsData.withRouteFilter?.active || 0) / (smsData.totalUniquePhones || 1)) * 100)}
                  formatCurrency={formatCurrency}
                />
              </div>
            </div>

            {/* Funnel 2: Barcha yo'nalishlar */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Barcha yo'nalishlar</h3>
              <div className="space-y-2">
                <FunnelRow
                  label="Jo'natilgan"
                  count={smsData.totalUniquePhones || 0}
                  color="blue"
                  widthPercent={100}
                  formatCurrency={formatCurrency}
                />
                <FunnelRow
                  label="Login Page"
                  count={smsData.withoutRouteFilter?.login || 0}
                  prevCount={smsData.totalUniquePhones || 0}
                  costTotal={smsData.smsCost?.totalUZS || 0}
                  color="purple"
                  widthPercent={Math.max(15, ((smsData.withoutRouteFilter?.login || 0) / (smsData.totalUniquePhones || 1)) * 100)}
                  formatCurrency={formatCurrency}
                />
                <FunnelRow
                  label="Full Register"
                  count={smsData.withoutRouteFilter?.fullRegister || 0}
                  prevCount={smsData.withoutRouteFilter?.login || 0}
                  costTotal={smsData.smsCost?.totalUZS || 0}
                  color="yellow"
                  widthPercent={Math.max(10, ((smsData.withoutRouteFilter?.fullRegister || 0) / (smsData.totalUniquePhones || 1)) * 100)}
                  formatCurrency={formatCurrency}
                />
                <FunnelRow
                  label="Active"
                  count={smsData.withoutRouteFilter?.active || 0}
                  prevCount={smsData.withoutRouteFilter?.fullRegister || 0}
                  costTotal={smsData.smsCost?.totalUZS || 0}
                  color="green"
                  widthPercent={Math.max(8, ((smsData.withoutRouteFilter?.active || 0) / (smsData.totalUniquePhones || 1)) * 100)}
                  formatCurrency={formatCurrency}
                />
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

      {/* Target Campaign Section */}
      {targetData && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Target Reklama</h2>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              {targetData.targetCost.regularUSD > 0 && (
                <span>Oddiy: <span className="font-semibold text-gray-700">{formatCurrency(targetData.targetCost.regularUSD)}</span></span>
              )}
              {targetData.targetCost.leadUSD > 0 && (
                <span>Lead: <span className="font-semibold text-gray-700">{formatCurrency(targetData.targetCost.leadUSD)}</span></span>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Regular Target */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Oddiy format</h3>
                <button
                  onClick={() => {
                    setTargetForm({
                      regularViews: String(targetData.regular.views || ''),
                      regularInstalls: String(targetData.regular.installs || ''),
                      regularRegistrations: String(targetData.regular.registrations || ''),
                    });
                    setShowTargetModal(true);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Ma'lumot kiritish
                </button>
              </div>
              {(() => {
                const regCostUZS = targetData.targetCost.regularUSD * (budgetSummary?.exchangeRate || 12200);
                const views = targetData.regular.views || 0;
                const installs = targetData.regular.installs || 0;
                const regs = targetData.regular.registrations || 0;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Views</div>
                      <div className="text-xl font-bold text-blue-600">{views.toLocaleString()}</div>
                      {views > 0 && regCostUZS > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {formatCurrency(regCostUZS / views, 'UZS')}/view
                          <span className="text-gray-400 ml-1">~{formatCurrency(targetData.targetCost.regularUSD / views)}</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Installs</div>
                      <div className="text-xl font-bold text-purple-600">{installs.toLocaleString()}</div>
                      {installs > 0 && regCostUZS > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {formatCurrency(regCostUZS / installs, 'UZS')}/install
                          <span className="text-gray-400 ml-1">~{formatCurrency(targetData.targetCost.regularUSD / installs)}</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Registratsiya</div>
                      <div className="text-xl font-bold text-green-600">{regs.toLocaleString()}</div>
                      {regs > 0 && regCostUZS > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {formatCurrency(regCostUZS / regs, 'UZS')}/reg
                          <span className="text-gray-400 ml-1">~{formatCurrency(targetData.targetCost.regularUSD / regs)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <hr className="border-gray-200" />

            {/* Lead Target */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Lead format</h3>
              {/* Lead funnel - Toshkent */}
              <div className="mb-2">
                <span className="text-xs text-gray-500">Toshkent yo'nalishi</span>
              </div>
              <div className="space-y-1.5">
                {(() => {
                  const leadCostUZS = targetData.targetCost.leadUSD > 0 ? targetData.targetCost.leadUSD * (budgetSummary?.exchangeRate || 12200) : 0;
                  const lr = targetData.lead.withRouteFilter;
                  return (
                    <>
                      <FunnelRow label="Login Page" count={lr.login} color="blue" widthPercent={100} formatCurrency={formatCurrency} costTotal={leadCostUZS} />
                      <FunnelRow label="Full Register" count={lr.fullRegister} prevCount={lr.login} color="yellow" widthPercent={Math.max(10, (lr.fullRegister / (lr.login || 1)) * 100)} formatCurrency={formatCurrency} costTotal={leadCostUZS} />
                      <FunnelRow label="Active" count={lr.active} prevCount={lr.fullRegister} color="green" widthPercent={Math.max(8, (lr.active / (lr.login || 1)) * 100)} formatCurrency={formatCurrency} costTotal={leadCostUZS} />
                    </>
                  );
                })()}
              </div>
              {/* Lead funnel - All */}
              <div className="mt-3 mb-2">
                <span className="text-xs text-gray-500">Barcha yo'nalishlar</span>
              </div>
              <div className="space-y-1.5">
                {(() => {
                  const leadCostUZS = targetData.targetCost.leadUSD > 0 ? targetData.targetCost.leadUSD * (budgetSummary?.exchangeRate || 12200) : 0;
                  const la = targetData.lead.withoutRouteFilter;
                  return (
                    <>
                      <FunnelRow label="Login Page" count={la.login} color="blue" widthPercent={100} formatCurrency={formatCurrency} costTotal={leadCostUZS} />
                      <FunnelRow label="Full Register" count={la.fullRegister} prevCount={la.login} color="yellow" widthPercent={Math.max(10, (la.fullRegister / (la.login || 1)) * 100)} formatCurrency={formatCurrency} costTotal={leadCostUZS} />
                      <FunnelRow label="Active" count={la.active} prevCount={la.fullRegister} color="green" widthPercent={Math.max(8, (la.active / (la.login || 1)) * 100)} formatCurrency={formatCurrency} costTotal={leadCostUZS} />
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Target Stats Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Target oddiy statistikasi</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Views soni</label>
                <input
                  type="number"
                  value={targetForm.regularViews}
                  onChange={(e) => setTargetForm({ ...targetForm, regularViews: e.target.value })}
                  placeholder="Masalan: 50000"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installs soni</label>
                <input
                  type="number"
                  value={targetForm.regularInstalls}
                  onChange={(e) => setTargetForm({ ...targetForm, regularInstalls: e.target.value })}
                  placeholder="Masalan: 5000"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registratsiya soni</label>
                <input
                  type="number"
                  value={targetForm.regularRegistrations}
                  onChange={(e) => setTargetForm({ ...targetForm, regularRegistrations: e.target.value })}
                  placeholder="Masalan: 500"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTargetModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Bekor
              </button>
              <button
                onClick={saveTargetStats}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <option value="ads_regular">Target oddiy (USD)</option>
                  <option value="ads_lead">Target lead (USD)</option>
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
                  setExpenseForm({ categoryId: 'ads_regular', amount: '', description: '' });
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
