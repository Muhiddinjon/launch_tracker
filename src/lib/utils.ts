import { CAMPAIGN_CONFIG } from '@/config/campaign';

// Format currency in Uzbek format
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('uz-UZ').format(amount) + " so'm";
};

// Format date for display
export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  date.setHours(date.getHours() + CAMPAIGN_CONFIG.UTC_OFFSET_HOURS);
  return date.toLocaleDateString('uz-UZ');
};

// Format date short (e.g., "Jan 26")
export const formatDateShort = (dateStr: string): string => {
  const date = new Date(dateStr);
  date.setHours(date.getHours() + CAMPAIGN_CONFIG.UTC_OFFSET_HOURS);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

// Normalize phone number to +998XXXXXXXXX format
export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('998')) {
    return '+' + digits;
  } else if (digits.startsWith('8') && digits.length === 10) {
    return '+998' + digits.substring(1);
  } else if (digits.length === 9) {
    return '+998' + digits;
  }

  return '+' + digits;
};

// Calculate percentage
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 1000) / 10;
};

// Get today's date in Tashkent timezone
export const getTashkentToday = (): Date => {
  const now = new Date();
  return new Date(now.getTime() + (CAMPAIGN_CONFIG.UTC_OFFSET_HOURS * 60 * 60 * 1000));
};

// Class name helper (simplified cn)
export const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};
