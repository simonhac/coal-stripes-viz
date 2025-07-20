import { OpenElectricityClient } from 'openelectricity';
import { 
  CoalStripesData, 
  PartialCoalStripesData,
  DataAvailabilityInfo, 
  OpenElectricityFacility, 
  OpenElectricityDataRow,
  CoalUnit
} from './types';
import { CalendarDate, today, parseDate, fromDate, toCalendarDate, getLocalTimeZone } from '@internationalized/date';
import { TimeSeriesCache } from './time-series-cache';

export class CoalDataService {
  private client: OpenElectricityClient;
  private cache: TimeSeriesCache;
  private pendingRequests = new Map<string, Promise<CoalStripesData>>();
  private facilitiesCache: OpenElectricityFacility[] | null = null;
  private facilitiesFetchPromise: Promise<OpenElectricityFacility[]> | null = null;

  constructor(apiKey: string) {
    this.client = new OpenElectricityClient({ apiKey });
    this.cache = new TimeSeriesCache(5); // Max 5 year chunks
  }



  /**
   * NEW: Fetch coal data for a specific date range with caching
   * Uses year-long chunks (Jan 1 - Dec 31) for efficient caching
   */
  async getCoalStripesDataRange(startDate: CalendarDate, endDate: CalendarDate): Promise<CoalStripesData | PartialCoalStripesData> {
    const startTime = performance.now();
    const days = endDate.compare(startDate) + 1;
    
    console.log(`📡 API fetch: ${startDate.toString()} → ${endDate.toString()} (${days} days)`);
    
    // Check cache first - may return full data, partial data, or null
    const cachedResult = this.cache.getDataForDateRange(startDate, endDate);
    if (cachedResult) {
      const elapsed = Math.round(performance.now() - startTime);
      const stats = this.cache.getCacheStats();
      
      if ('isPartial' in cachedResult) {
        console.log(`📦 Partial cache hit: ${startDate.toString()} → ${endDate.toString()} | ${elapsed}ms | Missing: ${cachedResult.missingYears.join(', ')}`);
        
        // Launch background fetch for missing years
        this.backgroundFetchMissingYears(cachedResult.missingYears);
        
        return cachedResult;
      } else {
        console.log(`✅ Complete cache hit: ${startDate.toString()} → ${endDate.toString()} | ${elapsed}ms | Cache: ${stats.sizeMB}MB (${stats.chunkCount} chunks)`);
        return cachedResult;
      }
    }
    
    // Determine which years we need to fetch
    const requiredYears = this.getRequiredYears(startDate, endDate);
    const fetchPromises: Promise<CoalStripesData>[] = [];
    
    for (const year of requiredYears) {
      const yearStart = parseDate(`${year}-01-01`);
      const yearEnd = parseDate(`${year}-12-31`);
      
      // Check if this year is already cached
      if (this.cache.hasDataForDate(yearStart)) {
        continue; // Skip, already have it
      }
      
      // Check for duplicate requests
      const requestKey = year.toString();
      if (this.pendingRequests.has(requestKey)) {
        fetchPromises.push(this.pendingRequests.get(requestKey)!);
        continue;
      }
      
      // Start fetch for this year
      const fetchPromise = this.fetchYearData(year);
      this.pendingRequests.set(requestKey, fetchPromise);
      fetchPromises.push(fetchPromise);
    }
    
    // Wait for all required years to load
    if (fetchPromises.length > 0) {
      console.log(`⏳ Fetching ${fetchPromises.length} year(s) of data...`);
      await Promise.all(fetchPromises);
    }
    
    // Now try to get the data from cache again
    const result = this.cache.getDataForDateRange(startDate, endDate);
    const elapsed = Math.round(performance.now() - startTime);
    
    if (result) {
      const stats = this.cache.getCacheStats();
      
      if ('isPartial' in result) {
        console.log(`📦 Partial result after fetch: ${startDate.toString()} → ${endDate.toString()} | ${elapsed}ms | Still missing: ${result.missingYears.join(', ')}`);
        return result;
      } else {
        console.log(`✅ Complete result after fetch: ${startDate.toString()} → ${endDate.toString()} | ${elapsed}ms | Cache: ${stats.sizeMB}MB (${stats.chunkCount} chunks)`);
        return result;
      }
    } else {
      console.log(`❌ API failed: ${startDate.toString()} → ${endDate.toString()} | ${elapsed}ms | Error: Unable to retrieve data after fetch`);
      throw new Error(`Failed to retrieve data for range ${startDate.toString()} → ${endDate.toString()}`);
    }
  }

  /**
   * Fetch a complete year of data (Jan 1 - Dec 31)
   */
  private async fetchYearData(year: number): Promise<CoalStripesData> {
    const yearStart = parseDate(`${year}-01-01`);
    const yearEnd = parseDate(`${year}-12-31`);
    const daysInYear = yearEnd.compare(yearStart) + 1;
    const requestKey = year.toString();
    
    try {
      console.log(`🔄 Fetching year ${year} data... (${daysInYear} days)`);
      
      // Get facilities first
      const facilities = await this.getAllCoalFacilities();
      
      if (daysInYear <= 365) {
        // Single request for normal years
        console.log(`   📡 Single request: ${yearStart.toString()} → ${yearEnd.toString()}`);
        const allData = await this.fetchEnergyData(facilities, yearStart.toString(), yearEnd.toString());
        
        const availabilityInfo = this.analyzeDataAvailability(allData, facilities, yearStart, yearEnd, 365);
        const coalStripesData = this.processCoalStripesData(allData, facilities, availabilityInfo);
        this.cache.addChunk(year, coalStripesData);
        return coalStripesData;
        
      } else {
        // Split into 6-month chunks for leap years (366 days)
        console.log(`🔀 Leap year detected: splitting into 6-month chunks`);
        
        // First 6 months: Jan 1 → Jun 30
        const chunk1Start = parseDate(`${year}-01-01`);
        const chunk1End = parseDate(`${year}-06-30`);
        
        // Last 6 months: Jul 1 → Dec 31
        const chunk2Start = parseDate(`${year}-07-01`);
        const chunk2End = parseDate(`${year}-12-31`);
        
        console.log(`   📡 Fetching both halves in parallel...`);
        console.log(`      • ${chunk1Start.toString()} → ${chunk1End.toString()}`);
        console.log(`      • ${chunk2Start.toString()} → ${chunk2End.toString()}`);
        
        // Fetch both chunks in parallel
        const [data1, data2] = await Promise.all([
          this.fetchEnergyData(facilities, chunk1Start.toString(), chunk1End.toString()),
          this.fetchEnergyData(facilities, chunk2Start.toString(), chunk2End.toString())
        ]);
        
        // Merge the data
        console.log(`   🔗 Merging leap year data: ${data1.length} + ${data2.length} rows`);
        const allData = [...data1, ...data2];
        
        const availabilityInfo = this.analyzeDataAvailability(allData, facilities, yearStart, yearEnd, 366);
        const coalStripesData = this.processCoalStripesData(allData, facilities, availabilityInfo);
        this.cache.addChunk(year, coalStripesData);
        return coalStripesData;
      }
      
    } catch (error) {
      console.log(`❌ Failed to fetch year ${year}: ${error}`);
      throw error;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Launch background fetch for missing years (don't wait for completion)
   */
  private backgroundFetchMissingYears(missingYears: number[]): void {
    console.log(`🔄 Background fetching missing years: ${missingYears.join(', ')}`);
    
    for (const year of missingYears) {
      const requestKey = year.toString();
      
      // Skip if already being fetched
      if (this.pendingRequests.has(requestKey)) {
        continue;
      }
      
      // Start background fetch
      const fetchPromise = this.fetchYearData(year);
      this.pendingRequests.set(requestKey, fetchPromise);
      
      // Clean up on completion (don't await)
      fetchPromise.finally(() => {
        this.pendingRequests.delete(requestKey);
      });
    }
  }

  /**
   * Get all years needed to cover a date range
   */
  private getRequiredYears(startDate: CalendarDate, endDate: CalendarDate): number[] {
    const years: number[] = [];
    let currentYear = startDate.year;
    
    while (currentYear <= endDate.year) {
      years.push(currentYear);
      currentYear++;
    }
    
    return years;
  }


  /**
   * Fetch all coal facilities from both NEM and WEM networks
   */
  private async getAllCoalFacilities(): Promise<OpenElectricityFacility[]> {
    // Return cached facilities if available
    if (this.facilitiesCache) {
      return this.facilitiesCache;
    }
    
    // If already fetching, wait for the existing promise
    if (this.facilitiesFetchPromise) {
      return this.facilitiesFetchPromise;
    }
    
    // Start new fetch
    this.facilitiesFetchPromise = this.fetchFacilitiesFromAPI();
    
    try {
      const facilities = await this.facilitiesFetchPromise;
      this.facilitiesCache = facilities;
      return facilities;
    } finally {
      this.facilitiesFetchPromise = null;
    }
  }

  private async fetchFacilitiesFromAPI(): Promise<OpenElectricityFacility[]> {
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
    console.log(`   Total data rows: ${allData.length}`);
    console.log(`   Requested range: ${requestStartDate.toString()} → ${requestEndDate.toString()}`);
    
    // Debug: Check first few rows
    if (allData.length > 0) {
      console.log(`   Sample data:`, allData.slice(0, 3).map(row => ({
        unit: row.unit_code,
        date: row.interval,
        energy: row.energy
      })));
    }
    
    // Simply return the requested range - no filtering
    // The client will handle any date filtering if needed
    return {
      requestedRange: {
        start: requestStartDate,
        end: requestEndDate,
        days: requestDays
      },
      actualRange: {
        start: requestStartDate,
        end: requestEndDate,
        days: requestDays
      },
      lastGoodDay: requestEndDate,
      dataPoints: allData.length
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
    
    // Get today's date in Australian Eastern Time using Temporal API
    const todayAEST = today('Australia/Brisbane');
    
    // Build facility unit capacity lookup
    const unitCapacities: Record<string, number> = {};
    const unitFacilityMap: Record<string, OpenElectricityFacility> = {};
    facilities.forEach(facility => {
      facility.units.forEach(unit => {
        if (unit.status_id === 'operating' && 
            (unit.fueltech_id === 'coal_black' || unit.fueltech_id === 'coal_brown')) {
          unitCapacities[unit.code] = unit.capacity_registered || 0;
          unitFacilityMap[unit.code] = facility;
        }
      });
    });
    
    // Process data into arrays - since we know data is ordered by date and complete years
    const unitDataArrays: Record<string, (number | null)[]> = {};
    const daysInYear = actualRange.end.compare(actualRange.start) + 1;
    
    // Initialize arrays for each unit
    facilities.forEach(facility => {
      facility.units.forEach(unit => {
        if (unit.status_id === 'operating' && 
            (unit.fueltech_id === 'coal_black' || unit.fueltech_id === 'coal_brown')) {
          unitDataArrays[unit.code] = new Array(daysInYear).fill(null);
        }
      });
    });
    
    // Fill in the data
    allData.forEach(row => {
      const unitCode = row.unit_code;
      const date = toCalendarDate(fromDate(row.interval, 'Australia/Brisbane'));
      let energy = row.energy; // Preserve null values - don't convert to 0
      
      // Replace ONLY today's partial data with null (we only want complete days)
      if (date.compare(todayAEST) === 0) {
        // Today's data is partial/incomplete - set to null
        energy = null;
      }
      // For future dates, preserve whatever OpenElectricity sends (even if it's wrong)
      // so we can detect their bugs
      
      // Calculate capacity factor
      let capacityFactor: number | null = null;
      if (energy !== null) {
        const capacity = unitCapacities[unitCode] || 0;
        if (capacity > 0) {
          const maxPossibleMWh = capacity * 24;
          capacityFactor = Math.min(100, (energy / maxPossibleMWh) * 100);
          // Round to 1 decimal place
          capacityFactor = Math.round(capacityFactor * 10) / 10;
        } else {
          capacityFactor = 0;
        }
      }
      
      // Calculate the index in the array (0-based)
      const dayIndex = date.compare(actualRange.start);
      if (unitDataArrays[unitCode] && dayIndex >= 0 && dayIndex < daysInYear) {
        unitDataArrays[unitCode][dayIndex] = capacityFactor;
      }
    });
    
    // Convert to new flat unit array format
    const units: CoalUnit[] = [];
    
    facilities.forEach(facility => {
      facility.units.forEach(unit => {
        if (unit.status_id === 'operating' && 
            (unit.fueltech_id === 'coal_black' || unit.fueltech_id === 'coal_brown')) {
          
          // Get the pre-built data array for this unit
          const dataArray = unitDataArrays[unit.code] || [];
          
          // Determine region from network_region
          let region: string;
          const networkRegion = facility.network_region;
          if (networkRegion === 'WEM') {
            region = ''; // WEM has no regions
          } else {
            // For NEM, use the network_region as the region (NSW1, QLD1, etc.)
            region = networkRegion;
          }
          
          const unitData: CoalUnit = {
            network: networkRegion === 'WEM' ? 'wem' : 'nem',
            data_type: 'capacity_factor',
            units: 'percentage',
            capacity: unit.capacity_registered || 0,
            duid: unit.code,
            facility_code: facility.code,
            facility_name: facility.name,
            fueltech: unit.fueltech_id as 'coal_black' | 'coal_brown',
            history: {
              start: actualRange.start.toString(),
              last: actualRange.end.toString(),
              interval: '1d',
              data: dataArray
            }
          };
          
          // Only add region for NEM units
          if (networkRegion !== 'WEM') {
            unitData.region = region;
          }
          
          units.push(unitData);
        }
      });
    });
    
    // Sort units by: network, region, facility, then duid
    units.sort((a, b) => {
      // First sort by network (nem before wem)
      if (a.network !== b.network) {
        return a.network.localeCompare(b.network);
      }
      
      // Then by region (WEM units have no region, so handle that)
      const aRegion = a.region || '';
      const bRegion = b.region || '';
      if (aRegion !== bRegion) {
        return aRegion.localeCompare(bRegion);
      }
      
      // Then by facility name
      if (a.facility_name !== b.facility_name) {
        return a.facility_name.localeCompare(b.facility_name);
      }
      
      // Finally by duid
      return a.duid.localeCompare(b.duid);
    });
    
    // Get current time in AEST
    const now = new Date();
    const aestFormatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Brisbane',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const aestTime = aestFormatter.format(now).replace(/\//g, '-').replace(', ', 'T');
    
    return {
      type: "capacity_factors" as const,
      version: "unknown",
      created_at: aestTime,
      data: units
    };
  }
}

