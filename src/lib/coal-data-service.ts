import { OpenElectricityClient } from 'openelectricity';
import { 
  CoalStripesData, 
  DataAvailabilityInfo, 
  OpenElectricityFacility, 
  OpenElectricityDataRow,
  Regions,
  CoalUnit
} from './types';

export class CoalDataService {
  private client: OpenElectricityClient;

  constructor(apiKey: string) {
    this.client = new OpenElectricityClient({ apiKey });
  }

  /**
   * Main method to fetch and process coal stripes data
   */
  async getCoalStripesData(requestDays: number = 365): Promise<CoalStripesData> {
    console.log('🎨 Fetching coal stripes data...');
    
    // Step 1: Get date range with buffer
    const { requestStartDate, requestEndDate } = this.getRequestDateRange(requestDays);
    const dateStart = requestStartDate.toISOString().split('T')[0];
    const dateEnd = requestEndDate.toISOString().split('T')[0];
    
    console.log(`📅 Requesting data from ${dateStart} to ${dateEnd} (${requestDays} days)`);
    
    // Step 2: Get facilities from both networks
    const facilities = await this.getAllCoalFacilities();
    console.log(`🔍 Found ${facilities.length} total coal facilities`);
    
    // Step 3: Fetch energy data in batches
    const allData = await this.fetchEnergyData(facilities, dateStart, dateEnd);
    console.log(`✅ Retrieved ${allData.length} data rows`);
    
    // Step 4: Analyze data availability and determine final date range
    const availabilityInfo = this.analyzeDataAvailability(
      allData, 
      facilities, 
      requestStartDate, 
      requestEndDate
    );
    
    console.log(`📊 Last day with good data: ${availabilityInfo.lastGoodDay}`);
    console.log(`📅 Using date range: ${availabilityInfo.actualRange.start} to ${availabilityInfo.actualRange.end} (${availabilityInfo.actualRange.days} days)`);
    
    // Step 5: Process data into final structure
    const coalStripesData = this.processCoalStripesData(
      allData, 
      facilities, 
      availabilityInfo
    );
    
    return coalStripesData;
  }

  /**
   * Get request date range with buffer for data availability
   */
  private getRequestDateRange(requestDays: number) {
    const requestEndDate = new Date();
    const requestStartDate = new Date(requestEndDate);
    requestStartDate.setDate(requestStartDate.getDate() - requestDays);
    
    return { requestStartDate, requestEndDate };
  }

  /**
   * Fetch all coal facilities from both NEM and WEM networks
   */
  private async getAllCoalFacilities(): Promise<OpenElectricityFacility[]> {
    console.log('📋 Fetching facilities from all networks...');
    
    const allFacilities = await this.client.getFacilities();
    
    // Filter for coal facilities
    const coalFacilities = allFacilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    
    // Separate by network region
    const nemCoalFacilities = coalFacilities.filter(f => f.network_region !== 'WEM');
    const wemCoalFacilities = coalFacilities.filter(f => f.network_region === 'WEM');
    
    console.log(`🔍 Found ${nemCoalFacilities.length} NEM coal facilities and ${wemCoalFacilities.length} WEM coal facilities`);
    
    return coalFacilities;
  }

  /**
   * Fetch energy data in batches from both networks
   */
  private async fetchEnergyData(
    facilities: OpenElectricityFacility[], 
    dateStart: string, 
    dateEnd: string
  ): Promise<OpenElectricityDataRow[]> {
    console.log('⚡ Fetching energy data in batches...');
    
    const BATCH_SIZE = 20;
    const allData: OpenElectricityDataRow[] = [];
    
    // Separate facilities by network
    const nemFacilities = facilities.filter(f => f.network_region !== 'WEM');
    const wemFacilities = facilities.filter(f => f.network_region === 'WEM');
    
    // Process NEM facilities
    const nemFacilityCodes = nemFacilities.map(f => f.code);
    await this.fetchBatchedData('NEM', nemFacilityCodes, dateStart, dateEnd, BATCH_SIZE, allData);
    
    // Process WEM facilities
    const wemFacilityCodes = wemFacilities.map(f => f.code);
    await this.fetchBatchedData('WEM', wemFacilityCodes, dateStart, dateEnd, BATCH_SIZE, allData);
    
    return allData;
  }

  /**
   * Fetch data in batches for a specific network
   */
  private async fetchBatchedData(
    network: 'NEM' | 'WEM',
    facilityCodes: string[],
    dateStart: string,
    dateEnd: string,
    batchSize: number,
    allData: OpenElectricityDataRow[]
  ) {
    for (let i = 0; i < facilityCodes.length; i += batchSize) {
      const batch = facilityCodes.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(facilityCodes.length / batchSize);
      
      console.log(`  ${network} Batch ${batchNum}/${totalBatches}: ${batch.length} facilities`);
      
      const batchData = await this.client.getFacilityData(network, batch, ['energy'], {
        interval: '1d',
        dateStart,
        dateEnd
      });
      
      allData.push(...((batchData.datatable as any)?.rows || []));
    }
  }

  /**
   * Analyze data availability and determine the optimal date range
   */
  private analyzeDataAvailability(
    allData: OpenElectricityDataRow[],
    facilities: OpenElectricityFacility[],
    requestStartDate: Date,
    requestEndDate: Date
  ): DataAvailabilityInfo {
    console.log('🔍 Analyzing data availability...');
    
    // Create all possible dates in the requested range
    const allDates: string[] = [];
    for (let d = new Date(requestStartDate); d <= requestEndDate; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toISOString().split('T')[0]);
    }
    
    // Count data points per day
    const dailyDataCount: Record<string, number> = {};
    allData.forEach(row => {
      const date = row.interval.toISOString().split('T')[0];
      dailyDataCount[date] = (dailyDataCount[date] || 0) + 1;
    });
    
    // Calculate expected data points (total coal units across all facilities)
    const expectedDataPoints = facilities.reduce((sum, f) => {
      return sum + f.units.filter(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown').length;
    }, 0);
    
    const minDataThreshold = Math.floor(expectedDataPoints * 0.5); // 50% threshold
    
    // Find the last day with ANY data (not requiring substantial data)
    let lastGoodDay = null;
    for (let i = allDates.length - 1; i >= 0; i--) {
      const date = allDates[i];
      const dataCount = dailyDataCount[date] || 0;
      if (dataCount > 0) {
        lastGoodDay = date;
        break;
      }
    }
    
    // Fallback if no good day found
    if (!lastGoodDay) {
      lastGoodDay = allDates[allDates.length - 3]; // 3 days ago as fallback
    }
    
    // Create final date range - exactly 365 days ending with last good day
    const finalEndDate = new Date(lastGoodDay);
    const finalStartDate = new Date(finalEndDate);
    finalStartDate.setDate(finalStartDate.getDate() - 364); // 364 days back + end day = 365 days
    
    return {
      requestedRange: {
        start: requestStartDate.toISOString().split('T')[0],
        end: requestEndDate.toISOString().split('T')[0],
        days: Math.ceil((requestEndDate.getTime() - requestStartDate.getTime()) / (1000 * 60 * 60 * 24))
      },
      actualRange: {
        start: finalStartDate.toISOString().split('T')[0],
        end: finalEndDate.toISOString().split('T')[0],
        days: 365
      },
      lastGoodDay,
      dataPoints: dailyDataCount[lastGoodDay] || 0
    };
  }

  /**
   * Process raw data into the final coal stripes structure
   */
  private processCoalStripesData(
    allData: OpenElectricityDataRow[],
    facilities: OpenElectricityFacility[],
    availabilityInfo: DataAvailabilityInfo
  ): CoalStripesData {
    const { actualRange } = availabilityInfo;
    
    // Create facility lookup
    const facilityLookup: Record<string, OpenElectricityFacility> = {};
    facilities.forEach(f => {
      facilityLookup[f.code] = f;
    });
    
    // Process data into unit/date matrix (only for the final date range)
    const unitData: Record<string, Record<string, number>> = {};
    allData.forEach(row => {
      const unitCode = row.unit_code;
      const date = row.interval.toISOString().split('T')[0];
      const energy = row.energy || 0;
      
      // Only include data within our final date range
      if (date >= actualRange.start && date <= actualRange.end) {
        if (!unitData[unitCode]) unitData[unitCode] = {};
        unitData[unitCode][date] = energy;
      }
    });
    
    // Create date array for the final 365 days
    const allDates: string[] = [];
    const finalStartDate = new Date(actualRange.start + 'T00:00:00Z');
    const finalEndDate = new Date(actualRange.end + 'T00:00:00Z');
    
    for (let d = new Date(finalStartDate); d <= finalEndDate; d.setUTCDate(d.getUTCDate() + 1)) {
      allDates.push(d.toISOString().split('T')[0]);
    }
    
    // Find the first date where we have substantial data across multiple units
    let firstGoodDate = allDates[0];
    const minUnitsThreshold = Math.max(5, Object.keys(unitData).length * 0.3); // At least 30% of units or 5 units
    
    for (const date of allDates) {
      const unitsWithData = Object.keys(unitData).filter(unitCode => {
        const energy = unitData[unitCode][date];
        return energy !== undefined && energy > 0;
      }).length;
      
      if (unitsWithData >= minUnitsThreshold) {
        firstGoodDate = date;
        break;
      }
    }
    
    // Create final dates array - use the full actualRange to ensure we get exactly 365 days
    // Don't filter by firstGoodDate as this would truncate the range
    const dates = allDates;
    
    // Group units by region
    const regions: Regions = {
      NSW1: { name: 'New South Wales', units: [] },
      QLD1: { name: 'Queensland', units: [] },
      VIC1: { name: 'Victoria', units: [] },
      SA1: { name: 'South Australia', units: [] },
      WEM: { name: 'Western Australia', units: [] }
    };
    
    // Organize units by region
    Object.keys(unitData).forEach(unitCode => {
      // Find which facility this unit belongs to
      let facilityCode = null;
      let unitInfo = null;
      
      for (const [fCode, facility] of Object.entries(facilityLookup)) {
        const unit = facility.units.find(u => u.code === unitCode);
        if (unit) {
          facilityCode = fCode;
          unitInfo = unit;
          break;
        }
      }
      
      if (facilityCode && unitInfo && unitInfo.status_id === 'operating' && unitInfo.fueltech_id) {
        const facility = facilityLookup[facilityCode];
        const region = facility.network_region as keyof Regions;
        
        if (regions[region]) {
          regions[region].units.push({
            code: unitCode,
            facility_name: facility.name,
            facility_code: facilityCode,
            capacity: unitInfo.capacity_registered || 0,
            fueltech: unitInfo.fueltech_id as 'coal_black' | 'coal_brown',
            data: unitData[unitCode]
          });
        }
      }
    });
    
    // Sort units by facility first, then by capacity within each facility
    Object.values(regions).forEach(region => {
      region.units.sort((a: CoalUnit, b: CoalUnit) => {
        // First sort by facility name
        if (a.facility_name !== b.facility_name) {
          return a.facility_name.localeCompare(b.facility_name);
        }
        // Then sort by capacity (largest first) within the same facility
        return (b.capacity || 0) - (a.capacity || 0);
      });
    });
    
    // Calculate total units
    const totalUnits = Object.values(regions).reduce((sum, region) => sum + region.units.length, 0);
    
    return {
      regions,
      dates,
      actualDateStart: actualRange.start,
      actualDateEnd: actualRange.end,
      lastGoodDay: availabilityInfo.lastGoodDay,
      totalUnits,
      requestedDays: availabilityInfo.requestedRange.days,
      actualDays: dates.length
    };
  }
}

// Utility functions for data processing
export class CoalDataUtils {
  /**
   * Calculate capacity factor as percentage
   */
  static calculateCapacityFactor(dailyEnergyMWh: number, capacityMW: number): number {
    if (!capacityMW || capacityMW <= 0) return 0;
    
    const maxPossibleMWh = capacityMW * 24;
    const capacityFactor = (dailyEnergyMWh / maxPossibleMWh) * 100;
    
    return Math.min(100, capacityFactor);
  }

  /**
   * Get shade character for capacity factor (for ASCII visualization)
   */
  static getShadeCharacter(capacityFactor: number): string {
    const SHADES = {
      offline: 'X',
      shades: ['█', '▉', '▊', '▋', '▌', '▍', '▎', '▏', '░', '·']
    };
    
    if (capacityFactor <= 0) return SHADES.offline;
    
    const shadeIndex = Math.min(9, Math.floor((100 - capacityFactor) / 10));
    return SHADES.shades[shadeIndex];
  }

  /**
   * Format date in Australian format (DD/MM)
   */
  static formatDateAU(dateStr: string): string {
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}/${month}`;
  }

  /**
   * Create date headers for weekly alignment
   */
  static createWeeklyHeaders(dates: string[]): string {
    const headerChars = new Array(dates.length).fill(' ');
    
    // Place dates at weekly intervals (every 7 days)
    for (let i = 0; i < dates.length; i += 7) {
      const dateStr = this.formatDateAU(dates[i]);
      // Place the date starting at position i
      for (let j = 0; j < dateStr.length && i + j < dates.length; j++) {
        headerChars[i + j] = dateStr[j];
      }
    }
    
    return headerChars.join('');
  }
}