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

// Clean internal representations for the client
export interface GeneratingUnit {
  unitId: string;  // This is the DUID
  unitName: string; // This could be formatted differently from unitId
  capacity: number;
  history: UnitHistoryDTO;
}

export interface Facility {
  network: string;
  region?: string; // Only present for NEM units
  facilityCode: string;
  facilityName: string;
  units: GeneratingUnit[];
}
