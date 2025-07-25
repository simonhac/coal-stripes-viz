// Type definitions for capacity factor visualisation
import { CalendarDate } from '@internationalized/date';

export interface UnitHistoryDTO {
  start: string;
  last: string;
  interval: string;
  data: (number | null)[];
}

export interface GeneratingUnitDTO {
  network: string;
  region?: string; // Only present for NEM units
  data_type: string;
  units: string;
  capacity: number;
  duid: string;
  facility_code: string;
  facility_name: string;
  fueltech: string;
  history: UnitHistoryDTO;
}

export interface GeneratingUnitCapFacHistoryDTO {
  type: "capacity_factors";
  version: string;
  created_at: string;
  data: GeneratingUnitDTO[];
}

