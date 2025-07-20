// Type definitions for coal stripes visualisation
import { CalendarDate } from '@internationalized/date';

export interface UnitHistory {
  start: string;
  last: string;
  interval: string;
  data: (number | null)[];
}

export interface CoalUnit {
  network: string;
  region?: string; // Only present for NEM units
  data_type: string;
  units: string;
  capacity: number;
  duid: string;
  facility_code: string;
  facility_name: string;
  fueltech: 'coal_black' | 'coal_brown';
  history: UnitHistory;
}

export interface CoalStripesData {
  type: "capacity_factors";
  version: string;
  created_at: string;
  data: CoalUnit[];
}

export interface PartialCoalStripesData extends CoalStripesData {
  isPartial: true;
  missingYears: number[];
  availableYears: number[];
  missingDateRanges: Array<{
    start: string;
    end: string;
    reason: string;
  }>;
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
  energy: number | null;
}