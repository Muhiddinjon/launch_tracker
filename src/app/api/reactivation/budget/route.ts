import { NextRequest, NextResponse } from 'next/server';
import { getFromStorage, setToStorage } from '@/lib/redis';
import { BUDGET_CONFIG, BudgetCategoryId } from '@/config/campaign';

// Storage key for budget data
const BUDGET_KEY = 'reactivation-budget';

// Budget expense entry
interface ExpenseEntry {
  id: string;
  categoryId: BudgetCategoryId;
  amount: number;
  currency: 'USD' | 'UZS';
  description: string;
  date: string;
  createdAt: string;
}

// Budget data structure
interface BudgetData {
  totalBudget: number; // in USD
  expenses: ExpenseEntry[];
  updatedAt: string;
}

// Load budget data from storage
async function loadBudgetData(): Promise<BudgetData> {
  const data = await getFromStorage(BUDGET_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      // Invalid JSON, return default
    }
  }
  return {
    totalBudget: BUDGET_CONFIG.TOTAL_BUDGET_USD,
    expenses: [],
    updatedAt: new Date().toISOString(),
  };
}

// Save budget data to storage
async function saveBudgetData(data: BudgetData): Promise<void> {
  data.updatedAt = new Date().toISOString();
  await setToStorage(BUDGET_KEY, JSON.stringify(data));
}

// Convert UZS to USD
function uzsToUsd(uzs: number): number {
  return uzs / BUDGET_CONFIG.USD_TO_UZS;
}

// Calculate budget summary
function calculateSummary(data: BudgetData) {
  const byCategory: Record<string, { totalUSD: number; totalUZS: number; count: number }> = {};

  // Initialize categories
  Object.values(BUDGET_CONFIG.CATEGORIES).forEach(cat => {
    byCategory[cat.id] = { totalUSD: 0, totalUZS: 0, count: 0 };
  });

  // Sum up expenses
  let totalSpentUSD = 0;
  data.expenses.forEach(expense => {
    const cat = byCategory[expense.categoryId];
    if (cat) {
      cat.count++;
      if (expense.currency === 'USD') {
        cat.totalUSD += expense.amount;
        totalSpentUSD += expense.amount;
      } else {
        cat.totalUZS += expense.amount;
        totalSpentUSD += uzsToUsd(expense.amount);
      }
    }
  });

  return {
    totalBudget: data.totalBudget,
    totalSpent: totalSpentUSD,
    remaining: data.totalBudget - totalSpentUSD,
    byCategory,
    exchangeRate: BUDGET_CONFIG.USD_TO_UZS,
  };
}

// GET - Load budget data with summary
export async function GET() {
  try {
    const data = await loadBudgetData();
    const summary = calculateSummary(data);

    return NextResponse.json({
      ...data,
      summary,
      categories: BUDGET_CONFIG.CATEGORIES,
    });
  } catch (error) {
    console.error('Error loading budget data:', error);
    return NextResponse.json(
      { error: 'Failed to load budget data', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Add expense or update total budget
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await loadBudgetData();

    // Update total budget if provided
    if (body.totalBudget !== undefined) {
      data.totalBudget = body.totalBudget;
    }

    // Add expense if provided
    if (body.expense) {
      const { categoryId, amount, currency, description, date } = body.expense;

      if (!categoryId || amount === undefined) {
        return NextResponse.json(
          { error: 'categoryId and amount are required' },
          { status: 400 }
        );
      }

      const expense: ExpenseEntry = {
        id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        categoryId,
        amount: Number(amount),
        currency: currency || 'USD',
        description: description || '',
        date: date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };

      data.expenses.push(expense);
    }

    await saveBudgetData(data);
    const summary = calculateSummary(data);

    return NextResponse.json({
      success: true,
      ...data,
      summary,
    });
  } catch (error) {
    console.error('Error saving budget data:', error);
    return NextResponse.json(
      { error: 'Failed to save budget data', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Remove expense
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const expenseId = searchParams.get('expenseId');

    if (!expenseId) {
      return NextResponse.json({ error: 'expenseId is required' }, { status: 400 });
    }

    const data = await loadBudgetData();
    data.expenses = data.expenses.filter(e => e.id !== expenseId);
    await saveBudgetData(data);

    const summary = calculateSummary(data);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense', details: String(error) },
      { status: 500 }
    );
  }
}
