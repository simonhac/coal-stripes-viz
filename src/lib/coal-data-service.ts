import { OpenElectricityClient } from 'openelectricity';
import { 
  CoalStripesData, 
  DataAvailabilityInfo, 
  OpenElectricityFacility, 
  OpenElectricityDataRow,
  Regions,
  CoalUnit
} from './types';
import { CalendarDate, today, parseDate, fromDate, toCalendarDate } from '@internationalized/date';

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
    const dateStart = requestStartDate.toString(); // YYYY-MM-DD
    const dateEnd = requestEndDate.toString(); // YYYY-MM-DD
    
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
      requestEndDate,
      requestDays
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
    // End on today - we now know the API has current data available
    const todayDate = today('Australia/Brisbane');
    const requestEndDate = todayDate; // Today
    
    // Request extra days to account for potential data delays, but respect API limits
    // The OpenElectricity API has a maximum range of 365 days for 1d intervals
    const bufferDays = requestDays >= 365 ? 0 : 3; // No buffer for 365-day requests
    const totalDaysToRequest = requestDays + bufferDays;
    const requestStartDate = requestEndDate.subtract({ days: totalDaysToRequest - 1 });
    
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
    // WORKAROUND: OpenElectricity API treats dateEnd as exclusive instead of inclusive
    // We need to add +1 day to dateEnd to get the data for the actual end date
    const adjustedDateEnd = parseDate(dateEnd).add({ days: 1 }).toString();
    
    for (let i = 0; i < facilityCodes.length; i += batchSize) {
      const batch = facilityCodes.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(facilityCodes.length / batchSize);
      
      console.log(`  ${network} Batch ${batchNum}/${totalBatches}: ${batch.length} facilities`);
      
      try {
        const batchData = await this.client.getFacilityData(network, batch, ['energy'], {
          interval: '1d',
          dateStart,
          dateEnd: adjustedDateEnd
        });
        
        allData.push(...((batchData.datatable as any)?.rows || []));
      } catch (error) {
        // Handle the case where no data is found for this batch
        if (error instanceof Error && error.message.includes('No data found')) {
          console.log(`  ${network} Batch ${batchNum}/${totalBatches}: No data found for this batch`);
          // Continue to next batch
          continue;
        }
        // Re-throw other errors
        throw error;
      }
    }
  }

  /**
   * Analyze data availability and determine the optimal date range
   */
  private analyzeDataAvailability(
    allData: OpenElectricityDataRow[],
    facilities: OpenElectricityFacility[],
    requestStartDate: CalendarDate,
    requestEndDate: CalendarDate,
    requestDays: number
  ): DataAvailabilityInfo {
    console.log('🔍 Analyzing data availability...');
    
    // Create all possible dates in the requested range
    const allDates: string[] = [];
    let currentDate = requestStartDate;
    while (currentDate.compare(requestEndDate) <= 0) {
      allDates.push(currentDate.toString());
      currentDate = currentDate.add({ days: 1 });
    }
    
    // Count data points per day
    const dailyDataCount: Record<string, number> = {};
    allData.forEach(row => {
      const date = toCalendarDate(fromDate(row.interval, 'Australia/Brisbane')).toString();
      dailyDataCount[date] = (dailyDataCount[date] || 0) + 1;
    });
    
    // Calculate expected data points (total coal units across all facilities)
    const expectedDataPoints = facilities.reduce((sum, f) => {
      return sum + f.units.filter(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown').length;
    }, 0);
    
    const minDataThreshold = Math.floor(expectedDataPoints * 0.5); // 50% threshold
    
    // Find the most recent consecutive days with good data
    // Work backwards from the end to find the most recent period with consistent data
    let lastGoodDay = null;
    let consecutiveGoodDays = 0;
    
    // First, find the last day with any data
    for (let i = allDates.length - 1; i >= 0; i--) {
      const date = allDates[i];
      const dataCount = dailyDataCount[date] || 0;
      if (dataCount > 0) {
        lastGoodDay = date;
        break;
      }
    }
    
    // Error if no data found at all
    if (!lastGoodDay) {
      throw new Error(`No coal data found in the requested date range (${requestStartDate.toString()} to ${requestEndDate.toString()})`);
    }
    
    // Find the best consecutive period with minimal data collection gaps
    // We'll evaluate all possible consecutive periods and pick the one with the best data coverage
    let bestPeriod = null;
    let bestScore = -1;
    
    // Try all possible consecutive periods of requestDays length
    for (let startIdx = 0; startIdx <= allDates.length - requestDays; startIdx++) {
      const periodDates = allDates.slice(startIdx, startIdx + requestDays);
      
      // Calculate the score for this period (total data points and recency)
      let totalDataPoints = 0;
      let daysWithData = 0;
      
      for (const date of periodDates) {
        const dataCount = dailyDataCount[date] || 0;
        totalDataPoints += dataCount;
        if (dataCount > 0) {
          daysWithData++;
        }
      }
      
      // Score = (data coverage * 1000) + (recency bonus based on how recent the end date is)
      // But heavily penalize periods with days that have no data at all
      const dataCoverageScore = (daysWithData / requestDays) * 1000;
      const recencyBonus = startIdx; // Higher index = more recent
      
      // Check if any day in this period has zero data across all units
      let hasZeroDataDays = false;
      for (const date of periodDates) {
        const dataCount = dailyDataCount[date] || 0;
        if (dataCount === 0) {
          hasZeroDataDays = true;
          break;
        }
      }
      
      // Heavily penalize periods with zero-data days
      const zeroDataPenalty = hasZeroDataDays ? -10000 : 0;
      const score = dataCoverageScore + recencyBonus + zeroDataPenalty;
      
      if (score > bestScore) {
        bestScore = score;
        bestPeriod = {
          startDate: parseDate(periodDates[0]),
          endDate: parseDate(periodDates[periodDates.length - 1]),
          daysWithData,
          totalDataPoints
        };
      }
    }
    
    // Use the best period found, or fallback to the most recent available period
    if (!bestPeriod) {
      // Fallback: use the most recent period, even if it has gaps
      const finalEndDate = parseDate(lastGoodDay);
      const finalStartDate = finalEndDate.subtract({ days: requestDays - 1 });
      bestPeriod = { startDate: finalStartDate, endDate: finalEndDate };
    }
    
    let finalStartDate = bestPeriod.startDate;
    let finalEndDate = bestPeriod.endDate;
    
    // For periods with zero-data days, trim them out
    // Check if the selected period has any zero-data days and exclude them
    const periodStartIdx = allDates.findIndex(d => d === finalStartDate.toString());
    const periodEndIdx = allDates.findIndex(d => d === finalEndDate.toString());
    
    if (periodStartIdx !== -1 && periodEndIdx !== -1) {
      const periodDates = allDates.slice(periodStartIdx, periodEndIdx + 1);
      const validDates = periodDates.filter(date => (dailyDataCount[date] || 0) > 0);
      
      if (validDates.length > 0) {
        finalStartDate = parseDate(validDates[0]);
        finalEndDate = parseDate(validDates[validDates.length - 1]);
      }
    }
    
    // Calculate actual days returned (may be less than requested for 365-day requests)
    const actualDays = Math.ceil((finalEndDate.toDate('Australia/Brisbane').getTime() - finalStartDate.toDate('Australia/Brisbane').getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return {
      requestedRange: {
        start: requestStartDate,
        end: requestEndDate,
        days: Math.ceil((requestEndDate.toDate('Australia/Brisbane').getTime() - requestStartDate.toDate('Australia/Brisbane').getTime()) / (1000 * 60 * 60 * 24)) + 1
      },
      actualRange: {
        start: finalStartDate,
        end: finalEndDate,
        days: actualDays
      },
      lastGoodDay: finalEndDate,
      dataPoints: dailyDataCount[finalEndDate.toString()] || 0
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
    const unitData: Record<string, Map<CalendarDate, number>> = {};
    allData.forEach(row => {
      const unitCode = row.unit_code;
      const date = toCalendarDate(fromDate(row.interval, 'Australia/Brisbane'));
      const energy = row.energy || 0;
      
      // Only include data within our final date range
      if (date.compare(actualRange.start) >= 0 && 
          date.compare(actualRange.end) <= 0) {
        if (!unitData[unitCode]) unitData[unitCode] = new Map();
        unitData[unitCode].set(date, energy);
      }
    });
    
    // Create date array for the final requested days
    const allDates: CalendarDate[] = [];
    let currentDate = actualRange.start;
    while (currentDate.compare(actualRange.end) <= 0) {
      allDates.push(currentDate);
      currentDate = currentDate.add({ days: 1 });
    }
    
    // Find the first date where we have substantial data across multiple units
    let firstGoodDate = allDates[0];
    const minUnitsThreshold = Math.max(5, Object.keys(unitData).length * 0.3); // At least 30% of units or 5 units
    
    for (const date of allDates) {
      const unitsWithData = Object.keys(unitData).filter(unitCode => {
        const energy = unitData[unitCode].get(date);
        return energy !== undefined && energy > 0;
      }).length;
      
      if (unitsWithData >= minUnitsThreshold) {
        firstGoodDate = date;
        break;
      }
    }
    
    // Create final dates array - use the full actualRange
    // For 365-day requests, we accept that some days might have data collection gaps
    const dates = allDates;
    
    // Group units by region
    const regions: Regions = {
      NSW1: { name: 'New South Wales', units: [] },
      QLD1: { name: 'Queensland', units: [] },
      VIC1: { name: 'Victoria', units: [] },
      SA1: { name: 'South Australia', units: [] },
      WEM: { name: 'Western Australia', units: [] }
    };
    
    // Organize units by region - include ALL coal units, not just those with data
    facilities.forEach(facility => {
      facility.units.forEach(unit => {
        if (unit.status_id === 'operating' && 
            (unit.fueltech_id === 'coal_black' || unit.fueltech_id === 'coal_brown')) {
          const region = facility.network_region as keyof Regions;
          
          if (regions[region]) {
            // Convert Map to Record for frontend compatibility
            const dataRecord: Record<string, number> = {};
            const unitMap = unitData[unit.code];
            if (unitMap) {
              for (const [date, energy] of unitMap) {
                dataRecord[date.toString()] = energy;
              }
            }
            // If no data available, dataRecord will be empty (which is correct)
            
            regions[region].units.push({
              code: unit.code,
              facility_name: facility.name,
              facility_code: facility.code,
              capacity: unit.capacity_registered || 0,
              fueltech: unit.fueltech_id as 'coal_black' | 'coal_brown',
              data: dataRecord
            });
          }
        }
      });
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
      dates: dates.map(d => d.toString()),
      actualDateStart: actualRange.start.toString(),
      actualDateEnd: actualRange.end.toString(),
      lastGoodDay: availabilityInfo.lastGoodDay.toString(),
      totalUnits,
      requestedDays: availabilityInfo.requestedRange.days,
      actualDays: dates.length
    };
  }
}

