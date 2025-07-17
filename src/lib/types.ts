// Type definitions for coal stripes visualization

export interface CoalUnit {
  code: string;
  facility_name: string;
  facility_code: string;
  capacity: number;
  fueltech: 'coal_black' | 'coal_brown';
  data: Record<string, number>; // date -> energy MWh
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
  dates: string[];
  actualDateStart: string;
  actualDateEnd: string;
  lastGoodDay: string;
  totalUnits: number;
  requestedDays: number;
  actualDays: number;
}

export interface DataAvailabilityInfo {
  requestedRange: {
    start: string;
    end: string;
    days: number;
  };
  actualRange: {
    start: string;
    end: string;
    days: number;
  };
  lastGoodDay: string;
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