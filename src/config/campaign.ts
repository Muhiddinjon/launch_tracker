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
  TARGET_ACTIVE_DRIVERS: 250,         // Maqsad: active driverlar soni

  // Timezone
  TIMEZONE: 'Asia/Tashkent',
  UTC_OFFSET_HOURS: 5,
} as const;

// Driver statuses
export const DRIVER_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
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
