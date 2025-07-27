import { GeneratingUnitCapFacHistoryDTO, GeneratingUnitDTO } from '@/shared/types';
import { FacilityYearTile } from './facility-year-tile';

export interface CapFacYear {
  year: number;
  data: GeneratingUnitCapFacHistoryDTO;
  facilityTiles: Map<string, FacilityYearTile>;
  totalSizeBytes: number;
}

/**
 * Groups units by facility code and creates FacilityYearTile objects
 */
export function createCapFacYear(
  year: number,
  data: GeneratingUnitCapFacHistoryDTO
): CapFacYear {
  const facilityTiles = new Map<string, FacilityYearTile>();
  
  // Group units by facility code
  const unitsByFacility = new Map<string, GeneratingUnitDTO[]>();
  
  for (const unit of data.data) {
    const facilityCode = unit.facility_code;
    if (!unitsByFacility.has(facilityCode)) {
      unitsByFacility.set(facilityCode, []);
    }
    unitsByFacility.get(facilityCode)!.push(unit);
  }
  
  // Create a FacilityYearTile for each facility
  for (const [facilityCode, units] of unitsByFacility) {
    const tile = new FacilityYearTile(facilityCode, year, units);
    facilityTiles.set(facilityCode, tile);
  }
  
  // Calculate total size: JSON data + canvas memory
  const jsonSizeBytes = JSON.stringify(data).length;
  let canvasSizeBytes = 0;
  
  // Calculate canvas memory
  for (const tile of facilityTiles.values()) {
    canvasSizeBytes += tile.getSizeBytes();
  }
  
  const totalSizeBytes = jsonSizeBytes + canvasSizeBytes;
  
  return {
    year,
    data,
    facilityTiles,
    totalSizeBytes
  };
}