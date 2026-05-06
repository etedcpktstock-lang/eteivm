import { format, parseISO, isValid } from 'date-fns';
import { th } from 'date-fns/locale/th';

/**
 * Intelligent date parser for logistics application
 * Supports ISO strings with or without 'Z', and Date objects
 */
export const safeParseDate = (dateInput: any): Date => {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  
  try {
    // Try parseISO first (best for Z or T formats)
    let d = parseISO(dateInput);
    if (isValid(d)) return d;
    
    // Fallback to native Date constructor
    d = new Date(dateInput);
    if (isValid(d)) return d;
  } catch (e) {
    console.warn("Failed to parse date:", dateInput);
  }
  
  return new Date(); // Final fallback
};

/**
 * Formats date to Thai style with B.E. year: "9 เม.ย. 69"
 */
export const formatThaiDate = (dateInput: any): string => {
  const d = safeParseDate(dateInput);
  const yearBE = (d.getFullYear() + 543).toString().slice(-2);
  return `${format(d, 'd MMM', { locale: th })} ${yearBE}`;
};

/**
 * Formats time to Thai style: "14:30 น."
 */
export const formatThaiTime = (dateInput: any): string => {
  const d = safeParseDate(dateInput);
  return format(d, 'HH:mm') + ' น.';
};

/**
 * Formats full timestamp with B.E. year: "9 เม.ย. 69 • 14:30"
 */
export const formatThaiDateTime = (dateInput: any): string => {
  const d = safeParseDate(dateInput);
  const yearBE = (d.getFullYear() + 543).toString().slice(-2);
  return `${format(d, 'd MMM', { locale: th })} ${yearBE} • ${format(d, 'HH:mm')}`;
};

/**
 * Formats full date with 4-digit B.E. year: "9 เมษายน 2569"
 */
export const formatThaiDateFullYear = (dateInput: any): string => {
  const d = safeParseDate(dateInput);
  const yearBE = d.getFullYear() + 543;
  return `${format(d, 'd MMMM', { locale: th })} ${yearBE}`;
};
