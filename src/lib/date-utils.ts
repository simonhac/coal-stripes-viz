import { fromDate, toZoned } from '@internationalized/date';

/**
 * Get the current time in AEST timezone format without milliseconds
 * Format: YYYY-MM-DDTHH:mm:ss+10:00
 * 
 * @returns ISO 8601 formatted string with AEST timezone offset
 */
export function getCurrentTimeInAEST(): string {
  const now = new Date();
  // fromDate should interpret the Date object as UTC
  const utcDateTime = fromDate(now, 'UTC');
  // Then convert to AEST
  const aestNow = toZoned(utcDateTime, 'Australia/Brisbane');
  
  // Format manually to ensure we get the right format
  const year = aestNow.year;
  const month = String(aestNow.month).padStart(2, '0');
  const day = String(aestNow.day).padStart(2, '0');
  const hour = String(aestNow.hour).padStart(2, '0');
  const minute = String(aestNow.minute).padStart(2, '0');
  const second = String(aestNow.second).padStart(2, '0');
  
  // AEST is always +10:00 (Brisbane doesn't observe DST)
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+10:00`;
}

/**
 * Get a specific date/time in AEST timezone format without milliseconds
 * Format: YYYY-MM-DDTHH:mm:ss+10:00
 * 
 * @param date The date to convert
 * @returns ISO 8601 formatted string with AEST timezone offset
 */
export function getTimeInAEST(date: Date): string {
  // fromDate should interpret the Date object as UTC
  const utcDateTime = fromDate(date, 'UTC');
  // Then convert to AEST
  const aestTime = toZoned(utcDateTime, 'Australia/Brisbane');
  
  // Format manually to ensure we get the right format
  const year = aestTime.year;
  const month = String(aestTime.month).padStart(2, '0');
  const day = String(aestTime.day).padStart(2, '0');
  const hour = String(aestTime.hour).padStart(2, '0');
  const minute = String(aestTime.minute).padStart(2, '0');
  const second = String(aestTime.second).padStart(2, '0');
  
  // AEST is always +10:00 (Brisbane doesn't observe DST)
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+10:00`;
}