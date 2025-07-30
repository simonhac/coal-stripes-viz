import { GeneratingUnitCapFacHistoryDTO, GeneratingUnitDTO } from '@/shared/types';
import { FacilityYearTile } from './facility-year-tile';
import { createFacilitiesFromUnits } from './facility-factory';

export interface CapFacYear {
  year: number;
  data: GeneratingUnitCapFacHistoryDTO;
  facilityTiles: Map<string, FacilityYearTile>;
  regionCapacityFactors: Map<string, (number | null)[]>; // Map of region name to array of 12 monthly capacity-weighted capacity factors
  totalSizeBytes: number;
}

/**
 * Build monthly capacity-weighted capacity factors for each region
 */
function buildMonthlyCapacityFactorsForEachRegion(units: GeneratingUnitDTO[]): Map<string, (number | null)[]> {
  const regionCapacityFactors = new Map<string, (number | null)[]>();
  
  // Group units by region
  const unitsByRegion = new Map<string, GeneratingUnitDTO[]>();
  
  for (const unit of units) {
    // For WA network (WEM), use "WEM" as the region
    const region = unit.network === 'WEM' ? 'WEM' : (unit.region || 'UNKNOWN');
    
    if (!unitsByRegion.has(region)) {
      unitsByRegion.set(region, []);
    }
    unitsByRegion.get(region)!.push(unit);
  }
  
  // Calculate capacity-weighted capacity factors for each region
  for (const [region, regionUnits] of unitsByRegion) {
    const monthlyFactors: (number | null)[] = new Array(12);
    
    // For each month (0-11)
    for (let month = 0; month < 12; month++) {
      let totalCapacityFactorWeighted = 0;
      let totalCapacity = 0;
      let hasData = false;
      
      // Calculate capacity-weighted average for this month
      for (const unit of regionUnits) {
        // Check if this unit has data for this month
        if (unit.history.data && month < unit.history.data.length) {
          const capacityFactor = unit.history.data[month];
          
          if (capacityFactor !== null) {
            totalCapacityFactorWeighted += capacityFactor * unit.capacity;
            totalCapacity += unit.capacity;
            hasData = true;
          }
        }
      }
      
      // Calculate weighted average or null if no data
      monthlyFactors[month] = hasData && totalCapacity > 0 
        ? totalCapacityFactorWeighted / totalCapacity 
        : null;
    }
    
    regionCapacityFactors.set(region, monthlyFactors);
  }
  
  return regionCapacityFactors;
}

/**
 * Groups units by facility code and creates FacilityYearTile objects
 */
export function createCapFacYear(
  year: number,
  data: GeneratingUnitCapFacHistoryDTO
): CapFacYear {
  const facilityTiles = new Map<string, FacilityYearTile>();
  
  // Create Facility objects from units
  const facilities = createFacilitiesFromUnits(data.data);
  
  // Create a FacilityYearTile for each facility
  for (const [facilityCode, facility] of facilities) {
    const tile = new FacilityYearTile(facility, year);
    facilityTiles.set(facilityCode, tile);
  }
  
  // Build monthly capacity-weighted capacity factors for each region
  const regionCapacityFactors = buildMonthlyCapacityFactorsForEachRegion(data.data);
  
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
    regionCapacityFactors,
    totalSizeBytes
  };
}