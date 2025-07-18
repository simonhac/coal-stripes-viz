// Type definitions for coal stripes visualisation
import { CalendarDate } from '@internationalized/date';

export interface CoalUnit {
  code: string;
  facility_name: string;
  facility_code: string;
  capacity: number;
  fueltech: 'coal_black' | 'coal_brown';
  data: Record<string, number>; // date string -> energy MWh (for frontend compatibility)
}

export interface RegionData {
  name: string;
  units: CoalUnit[];
}

export interface Regions {
  NSW1: RegionData;
  QLD1: RegionData;
  VIC1: RegionData;
  SA1: RegionData;
  WEM: RegionData;
}

export interface CoalStripesData {
  regions: Regions;
  dates: string[]; // ISO date strings for frontend compatibility
  actualDateStart: string;
  actualDateEnd: string;
  lastGoodDay: string;
  totalUnits: number;
  requestedDays: number;
  actualDays: number;
}

// Internal interface for coal-data-service (uses CalendarDate internally)
export interface DataAvailabilityInfo {
  requestedRange: {
    start: CalendarDate;
    end: CalendarDate;
    days: number;
  };
  actualRange: {
    start: CalendarDate;
    end: CalendarDate;
    days: number;
  };
  lastGoodDay: CalendarDate;
  dataPoints: number;
}

// OpenElectricity API types
export interface OpenElectricityUnit {
  code: string;
  capacity_registered: number | null;
  fueltech_id: string | null;
  status_id: string | null;
}

export interface OpenElectricityFacility {
  code: string;
  name: string;
  network_region: string;
  units: OpenElectricityUnit[];
}

export interface OpenElectricityDataRow {
  unit_code: string;
  interval: Date;
  energy: number;
}