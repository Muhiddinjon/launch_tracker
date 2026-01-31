// Driver Types
export type DriverStatus = 'pending' | 'active' | 'inactive' | 'blocked';

export interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  status: DriverStatus;
  created_at: string;
  region_id: string | null;
  region_name: string | null;
  sub_region_id: string | null;
  sub_region_name: string | null;
  departure_region_id: string | null;
  departure_region_name: string | null;
  departure_sub_region_id: string | null;
  departure_sub_region_name: string | null;
  arrival_region_id: string | null;
  arrival_region_name: string | null;
  arrival_sub_region_id: string | null;
  arrival_sub_region_name: string | null;
}

// Region Types
export interface Region {
  id: string;
  name: string;
}

export interface SubRegion {
  id: string;
  name: string;
  region_id: string;
}

// Pagination
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// API Response Types
export interface DriversResponse {
  data: Driver[];
  pagination: Pagination;
}

export interface StatusSummary {
  pending: number;
  active: number;
  inactive: number;
  blocked: number;
  total: number;
}

export interface CampaignTarget {
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
}

export interface DailyStats {
  date: string;
  pending: number;
  active: number;
  inactive: number;
  blocked: number;
  total: number;
}

export interface SubRegionStats {
  id: string;
  name: string;
  pending: number;
  active: number;
  inactive: number;
  blocked: number;
  total: number;
}

export interface StatsResponse {
  summary: StatusSummary;
  target: CampaignTarget;
  daily: DailyStats[];
  subRegions: SubRegionStats[];
  meta: {
    dataStartDate: string;
    campaignStart: string;
    campaignEnd: string;
    region: string;
    regionId: string;
  };
}

// Campaign Types
export interface Campaign {
  id: string;
  name: string;
  channel: string;
  startDate: string;
  spent: number;
  status: string;
  notes: string;
}

export interface DailyExpense {
  id: string;
  date: string;
  campaignId: string;
  amount: number;
  description: string;
}

export interface CampaignData {
  campaigns: Campaign[];
  dailyExpenses: DailyExpense[];
}

// SMS Types
export interface SmsMatchResult {
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
  matched: Driver[];
  notRegistered: string[];
}

// Sort Types
export type SortField = 'created_at' | 'status' | 'first_name' | 'region_name' | 'sub_region_name';
export type SortOrder = 'asc' | 'desc';
