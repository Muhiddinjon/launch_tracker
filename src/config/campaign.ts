// Campaign Configuration
// Toshkent Viloyati Driver Acquisition Campaign

export const CAMPAIGN_CONFIG = {
  // Region IDs
  TASHKENT_REGION_ID: '9',    // Toshkent Viloyati
  TASHKENT_CITY_ID: '2',      // Toshkent (shahar)

  // Campaign dates
  DATA_START_DATE: '2026-01-26',      // Driver data boshlanish sanasi
  CAMPAIGN_START_DATE: '2026-01-29',  // Kampaniya boshlanish sanasi
  CAMPAIGN_END_DATE: '2026-02-27',    // Kampaniya tugash sanasi

  // Campaign targets
  CAMPAIGN_DURATION: 30,              // Kampaniya davomiyligi (kun)
  TARGET_ACTIVE_DRIVERS: 300,         // Maqsad: active driverlar soni

  // Timezone
  TIMEZONE: 'Asia/Tashkent',
  UTC_OFFSET_HOURS: 5,
} as const;

// Budget Configuration
export const BUDGET_CONFIG = {
  // Total budget in USD
  TOTAL_BUDGET_USD: 2200,

  // Category configurations
  CATEGORIES: {
    ADS_REGULAR: {
      id: 'ads_regular',
      name: 'Target oddiy',
      currency: 'USD',
    },
    ADS_LEAD: {
      id: 'ads_lead',
      name: 'Target lead',
      currency: 'USD',
    },
    SMS: {
      id: 'sms',
      name: 'SMS xabarlar',
      costPerUnit: 19, // 19 so'm/sms
      currency: 'UZS',
      baseCount: 130000, // Baza hajmi
    },
    FLYERS: {
      id: 'flyers',
      name: 'Flayerlar',
      totalBudget: 325, // $300-350 oralig'ida
      currency: 'USD',
    },
    TELEGRAM: {
      id: 'telegram',
      name: 'Telegram reklama',
      currency: 'USD',
    },
  },

  // Exchange rate
  USD_TO_UZS: 12200,
} as const;

// Budget category type
export type BudgetCategoryId = 'ads' | 'ads_regular' | 'ads_lead' | 'sms' | 'flyers' | 'telegram';

// Source codes for tracking
export const SOURCE_CODES = {
  LEAD: 'cml5adx980000la04tuyyeh8e',
  REGULAR_TARGET: 'cmkurqj560002kt043hp58v76',
  TELEGRAM_GLOBAL: 'cml64lcz10009l804neznadfn',
  TELEGRAM_ADS: 'cmlgd0ots0048lf04gzf459yc',
} as const;

// Flyer tracking start date (Tashkent time)
export const FLYER_START_DATE = '2026-02-09T03:00:00.000Z'; // 09.02 08:00 Tashkent = 03:00 UTC

// Driver statuses
export const DRIVER_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
} as const;

// Inactive reason IDs and their meanings
export const INACTIVE_REASONS = {
  PERSONAL_INFO_ERROR: '59',    // Shaxsiy ma'lumotlarda xatolik - tuzatilishi mumkin
  CAR_INFO_ERROR: '60',         // Mashina ma'lumotlarida xatolik - tuzatilishi mumkin
  CAR_NOT_ELIGIBLE: '65',       // Reglamentga mos emas - yangi mashina kerak
} as const;

// Reason categories
export const INACTIVE_REASON_CATEGORIES = {
  FIXABLE: ['59', '60'],        // Hujjatlarda kamchilik - tuzatilishi mumkin
  NOT_ELIGIBLE: ['65'],         // Reglamentga mos emas - yangi mashina kerak
} as const;

// Reason labels for UI
export const INACTIVE_REASON_LABELS: Record<string, string> = {
  '59': 'Shaxsiy ma\'lumotlarda xatolik',
  '60': 'Mashina ma\'lumotlarida xatolik',
  '65': 'Reglamentga mos emas',
} as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[keyof typeof DRIVER_STATUSES];

// Calculate daily target
export const getDailyTarget = () => {
  return CAMPAIGN_CONFIG.TARGET_ACTIVE_DRIVERS / CAMPAIGN_CONFIG.CAMPAIGN_DURATION;
};

// Get current campaign day
export const getCampaignDay = () => {
  const campaignStart = new Date(CAMPAIGN_CONFIG.CAMPAIGN_START_DATE);
  const now = new Date();
  const today = new Date(now.getTime() + (CAMPAIGN_CONFIG.UTC_OFFSET_HOURS * 60 * 60 * 1000));

  return Math.max(1, Math.floor((today.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
};
