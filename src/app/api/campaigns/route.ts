import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'campaigns.json');

interface Campaign {
  id: string;
  name: string;
  channel: 'sms' | 'target' | 'telegram' | 'referral' | 'organic';
  startDate: string;
  endDate: string | null;
  budget: number;
  spent: number;
  status: 'active' | 'paused' | 'completed';
  notes: string;
}

interface SmsBatch {
  id: string;
  campaignId: string;
  sentDate: string;
  phoneNumbers: string[];
  totalSent: number;
  delivered: number;
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
  smsBatches: SmsBatch[];
  dailyExpenses: DailyExpense[];
  lastUpdated: string;
}

async function readData(): Promise<CampaignData> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      campaigns: [],
      smsBatches: [],
      dailyExpenses: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

async function writeData(data: CampaignData): Promise<void> {
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function GET() {
  try {
    const data = await readData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read campaigns', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await readData();

    if (body.type === 'campaign') {
      const newCampaign: Campaign = {
        id: Date.now().toString(),
        name: body.name,
        channel: body.channel,
        startDate: body.startDate || new Date().toISOString().split('T')[0],
        endDate: body.endDate || null,
        budget: body.budget || 0,
        spent: body.spent || 0,
        status: body.status || 'active',
        notes: body.notes || '',
      };
      data.campaigns.push(newCampaign);
      await writeData(data);
      return NextResponse.json(newCampaign);
    }

    if (body.type === 'expense') {
      const dateFrom = body.dateFrom || body.date || new Date().toISOString().split('T')[0];
      const dateTo = body.dateTo || dateFrom;

      // Calculate days between dates
      const startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);
      const daysDiff = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const amountPerDay = Math.round(body.amount / daysDiff);

      const expenses: DailyExpense[] = [];

      // Create expense for each day in range
      for (let i = 0; i < daysDiff; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];

        const newExpense: DailyExpense = {
          id: `${Date.now()}-${i}`,
          date: dateStr,
          campaignId: body.campaignId,
          amount: i === daysDiff - 1 ? body.amount - (amountPerDay * (daysDiff - 1)) : amountPerDay,
          description: daysDiff > 1 ? `${body.description || ''} (${dateFrom} - ${dateTo})`.trim() : body.description || '',
        };
        expenses.push(newExpense);
        data.dailyExpenses.push(newExpense);
      }

      // Update campaign spent
      const campaign = data.campaigns.find(c => c.id === body.campaignId);
      if (campaign) {
        campaign.spent += body.amount;
      }

      await writeData(data);
      return NextResponse.json(expenses.length === 1 ? expenses[0] : expenses);
    }

    if (body.type === 'smsBatch') {
      const newBatch: SmsBatch = {
        id: Date.now().toString(),
        campaignId: body.campaignId,
        sentDate: body.sentDate || new Date().toISOString().split('T')[0],
        phoneNumbers: body.phoneNumbers || [],
        totalSent: body.totalSent || body.phoneNumbers?.length || 0,
        delivered: body.delivered || 0,
        notes: body.notes || '',
      };
      data.smsBatches.push(newBatch);
      await writeData(data);
      return NextResponse.json(newBatch);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await readData();

    if (body.type === 'campaign') {
      const index = data.campaigns.findIndex(c => c.id === body.id);
      if (index !== -1) {
        data.campaigns[index] = { ...data.campaigns[index], ...body };
        await writeData(data);
        return NextResponse.json(data.campaigns[index]);
      }
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update', details: String(error) },
      { status: 500 }
    );
  }
}
