import { OEClientQueued } from './queued-oeclient';
import { 
  GeneratingUnitCapFacHistoryDTO, 
  GeneratingUnitDTO
} from '@/shared/types';
import { CalendarDate, parseDate } from '@internationalized/date';
import { getAESTDateTimeString, isLeapYear, getDaysBetween, parseAESTDateString, getTodayAEST } from '@/shared/date-utils';
import { LRUCache } from '@/shared/lru-cache';

// Define types for the new API
interface UnitRecord {
  facility_code: string;
  facility_name: string;
  facility_network: string;
  facility_region: string;
  unit_code: string;
  unit_fueltech: string;
  unit_capacity: number;
}

interface Facility {
  facility_code: string;
  facility_name: string;
  facility_network: string;
  facility_region: string;
  units: UnitRecord[];
}

export class CapFacDataService {
  private client: OEClientQueued;
  private facilitiesCache: Facility[] | null = null;
  private facilitiesFetchPromise: Promise<Facility[]> | null = null;
  private yearDataCache: LRUCache<string>;

  constructor(apiKey: string, maxCachedYears: number = 5) {
    this.client = new OEClientQueued(apiKey);
    this.yearDataCache = new LRUCache<string>(100);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Wait for any pending facility fetch to complete
    if (this.facilitiesFetchPromise) {
      try {
        await this.facilitiesFetchPromise;
      } catch (err) {
        // Ignore errors during cleanup
      }
    }
    
    // Clear caches
    this.facilitiesCache = null;
    this.facilitiesFetchPromise = null;
    this.yearDataCache.clear();
    
    // Clear any pending requests in the queue
    if (this.client) {
      this.client.clearQueue();
    }
    
    // Null out the reference to help with garbage collection
    this.client = null as any;
  }

  /**
   * Fetch capacity factors for coal units for a specific year
   * Always returns data for the full year with today and future dates nulled out
   */
  async getCapacityFactors(year: number): Promise<GeneratingUnitCapFacHistoryDTO> {
    const cacheKey = year.toString();
    
    // Check cache first
    const cachedJson = this.yearDataCache.get(cacheKey);
    if (cachedJson) {
      console.log(`📦 Cache hit: ${year}`);
      return JSON.parse(cachedJson);
    }
    
    const startTime = performance.now();
    
    // Always work with full years - no partial years allowed
    const startDate = parseDate(`${year}-01-01`);
    const endDate = parseDate(`${year}-12-31`);
    const days = isLeapYear(year) ? 366 : 365;
    
    console.log(`📡 API fetch: ${year} (${days} days)`);
    
    // Get facilities first
    const facilities = await this.getAllCoalFacilities();
    
    // Check if we need to split the request (leap year with 366 days)
    let allData: any[] = [];
    if (days > 365) {
      console.log(`   Splitting leap year request into two 6-month chunks...`);
      
      // First half: Jan 1 - Jun 30
      const midYear = parseDate(`${year}-06-30`);
      const firstHalfData = await this.fetchEnergyData(facilities, startDate.toString(), midYear.toString());
      
      // Second half: Jul 1 - Dec 31
      const secondHalfStart = parseDate(`${year}-07-01`);
      const secondHalfData = await this.fetchEnergyData(facilities, secondHalfStart.toString(), endDate.toString());
      
      // Combine the data
      allData = [...firstHalfData, ...secondHalfData];
    } else {
      // Normal fetch for non-leap years
      allData = await this.fetchEnergyData(facilities, startDate.toString(), endDate.toString());
    }
    
    const coalStripesData = this.processGeneratingUnitCapFacHistoryDTO(allData, facilities, startDate, endDate);
    
    // Convert to JSON and cache
    const jsonString = JSON.stringify(coalStripesData);
    const sizeInBytes = jsonString.length;
    this.yearDataCache.set(cacheKey, jsonString, sizeInBytes, `Year ${year}`);
    
    const elapsed = Math.round(performance.now() - startTime);
    console.log(`✅ API response: ${year} | ${elapsed}ms | Cached (${Math.round(sizeInBytes / 1024)}KB)`);
    
    return coalStripesData;
  }

  /**
   * Get queue statistics for monitoring
   */
  public getQueueStats() {
    return this.client ? this.client.getQueueStats() : null;
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    return this.yearDataCache.getStats();
  }


  /**
   * Get all coal facilities from OpenElectricity API
   */
  private async getAllCoalFacilities(): Promise<Facility[]> {
    // Return cached facilities if available
    if (this.facilitiesCache) {
      return this.facilitiesCache;
    }

    // Return existing promise if fetch is in progress
    if (this.facilitiesFetchPromise) {
      return this.facilitiesFetchPromise;
    }

    // Start new fetch
    this.facilitiesFetchPromise = (async () => {
      try {
        console.log('🏭 Fetching coal facilities...');
        const { response, table } = await this.client.getFacilities({
          status_id: ['operating'],
          fueltech_id: ['coal_black', 'coal_brown']
        });
        
        // Get units from the table
        const units = table.getRecords() as UnitRecord[];
        
        // Group units by facility
        const facilityMap = new Map<string, Facility>();
        
        units.forEach(unit => {
          const key = unit.facility_code;
          
          if (!facilityMap.has(key)) {
            facilityMap.set(key, {
              facility_code: unit.facility_code,
              facility_name: unit.facility_name,
              facility_network: unit.facility_network,
              facility_region: unit.facility_region,
              units: []
            });
          }
          
          facilityMap.get(key)!.units.push(unit);
        });
        
        // Convert to array and sort
        const facilities = Array.from(facilityMap.values()).sort((a, b) => 
          a.facility_name.localeCompare(b.facility_name)
        );
        
        // Cache the facilities
        this.facilitiesCache = facilities;
        console.log(`🏭 Found ${facilities.length} coal facilities with ${units.length} units`);
        
        return facilities;
      } finally {
        // Clear the promise
        this.facilitiesFetchPromise = null;
      }
    })();

    return this.facilitiesFetchPromise;
  }

  /**
   * Fetch energy data from OpenElectricity API
   */
  private async fetchEnergyData(
    facilities: Facility[], 
    startDate: string, 
    endDate: string
  ): Promise<any[]> {
    // Group facilities by network code
    const facilitiesByNetwork = new Map<string, string[]>();
    
    facilities.forEach(facility => {
      const network = facility.facility_network;
      if (!facilitiesByNetwork.has(network)) {
        facilitiesByNetwork.set(network, []);
      }
      // Collect unique facility codes
      const codes = facilitiesByNetwork.get(network)!;
      if (!codes.includes(facility.facility_code)) {
        codes.push(facility.facility_code);
      }
    });

    console.log(`   Fetching data for ${facilities.length} facilities across ${facilitiesByNetwork.size} networks...`);

    // Fetch data for each network
    const allPromises: Promise<any>[] = [];
    
    for (const [network, facilityCodes] of facilitiesByNetwork) {
      console.log(`   Fetching ${network} network: ${facilityCodes.length} facilities`);
      // Add one day to end date because API treats it as exclusive
      const endDatePlusOne = parseDate(endDate).add({ days: 1 }).toString();
      
      const promise = this.client.getFacilityData(
        network as any, // NetworkCode type - API expects uppercase
        facilityCodes,
        ['energy'],
        {
          interval: '1d',
          dateStart: startDate,
          dateEnd: endDatePlusOne
        }
      ).catch(err => {
        console.error(`   Failed to fetch ${network} data:`, err.message);
        throw err;
      });
      allPromises.push(promise);
    }

    // Wait for all requests
    const responses = await Promise.all(allPromises);
    
    // Combine all data
    const allData: any[] = [];
    responses.forEach(response => {
      if (response.datatable) {
        allData.push(...response.datatable.rows);
      } else if (response.data) {
        // Handle the alternative response format
        response.data.forEach((dataSection: any) => {
          if (dataSection.results) {
            dataSection.results.forEach((result: any) => {
              const unitCode = result.columns?.unit_code;
              if (unitCode && result.data) {
                result.data.forEach(([dateStr, energy]: [string, number]) => {
                  allData.push({
                    interval: dateStr,
                    unit_code: unitCode,
                    energy: energy
                  });
                });
              }
            });
          }
        });
      }
    });

    console.log(`   Received ${allData.length} data points`);
    
    // Transform Date objects to strings for consistent processing
    const transformedData = allData.map(row => {
      const dateValue = row.interval || row.date || row.period;
      if (dateValue instanceof Date) {
        // Convert Date to ISO string
        return {
          ...row,
          interval: dateValue.toISOString()
        };
      }
      return row;
    });
    
    return transformedData;
  }


  /**
   * Process raw energy data into GeneratingUnitCapFacHistoryDTO format
   */
  private processGeneratingUnitCapFacHistoryDTO(
    data: any[],
    facilities: Facility[],
    requestedStartDate: CalendarDate,
    requestedEndDate: CalendarDate
  ): GeneratingUnitCapFacHistoryDTO {
    const startTime = performance.now();
    
    // Sort facilities by network, region, then facility name
    const sortedFacilities = [...facilities].sort((a, b) => {
      // First sort by network (NEM before WEM)
      const networkCompare = a.facility_network.localeCompare(b.facility_network);
      if (networkCompare !== 0) return networkCompare;
      
      // Then by region
      const regionCompare = (a.facility_region || '').localeCompare(b.facility_region || '');
      if (regionCompare !== 0) return regionCompare;
      
      // Finally by facility name
      return a.facility_name.localeCompare(b.facility_name);
    });

    // Create unit data structures
    const coalUnits: GeneratingUnitDTO[] = [];
    
    // Process each facility
    sortedFacilities.forEach(facility => {
      // Sort units by code
      const sortedUnits = [...facility.units].sort((a, b) => 
        a.unit_code.localeCompare(b.unit_code)
      );

      // Process each unit
      sortedUnits.forEach(unit => {
        const unitData = data.filter(row => {
          const rowCode = row.unit_code || row.code || row.duid;
          return rowCode === unit.unit_code;
        });
        
        if (unitData.length === 0) {
          return; // Skip units with no data
        }

        // Sort by date to ensure chronological order
        unitData.sort((a, b) => {
          const dateA = a.interval || a.date || a.period;
          const dateB = b.interval || b.date || b.period;
          // Handle both Date objects and strings
          const timeA = dateA instanceof Date ? dateA.getTime() : new Date(dateA).getTime();
          const timeB = dateB instanceof Date ? dateB.getTime() : new Date(dateB).getTime();
          return timeA - timeB;
        });

        // Use the requested date range (not the data's date range)
        const startDate = requestedStartDate.toString();
        const endDate = requestedEndDate.toString();
        
        // Calculate capacity factors
        const capacityFactors: (number | null)[] = [];
        
        // Create a map for quick lookup
        const dataMap = new Map(unitData.map(row => {
          const dateValue = row.interval || row.date || row.period;
          
          // Parse as AEST date string - will throw if format is invalid
          const dateStr = parseAESTDateString(dateValue).toString();
          
          return [dateStr, row];
        }));
        
        // Fill in the capacity factors array
        const start = parseDate(startDate);
        const end = parseDate(endDate);
        let currentDate = start;
        
        // Get today's date in Brisbane time for comparison
        const todayBrisbane = getTodayAEST();
        
        while (currentDate.compare(end) <= 0) {
          const dateStr = currentDate.toString();
          const dayData = dataMap.get(dateStr);
          
          // Check if this is today or a future date - set to null
          if (currentDate.compare(todayBrisbane) >= 0) {
            capacityFactors.push(null);
          } else if (dayData && dayData.energy !== null && dayData.energy !== undefined) {
            // Calculate capacity factor: (energy_MWh / 24) / registered_capacity * 100
            const capacityFactor = (dayData.energy / 24) / unit.unit_capacity * 100;
            capacityFactors.push(Math.round(capacityFactor * 10) / 10); // Round to 1 decimal
          } else {
            capacityFactors.push(null);
          }
          
          currentDate = currentDate.add({ days: 1 });
        }

        const coalUnit: GeneratingUnitDTO = {
          network: facility.facility_network.toLowerCase(),
          region: facility.facility_region || undefined,
          data_type: 'energy',
          units: 'MW',
          facility_name: facility.facility_name,
          facility_code: facility.facility_code,
          facility_id: facility.facility_code,
          duid: unit.unit_code,
          capacity: unit.unit_capacity,
          fueltech: unit.unit_fueltech === 'coal_brown' ? 'coal_brown' : 'coal_black',
          fuel_source_descriptor: unit.unit_fueltech,
          commissioned_date: null,
          decommissioned_date: null,
          latest_carbon_intensity: null,
          history: {
            start: startDate,
            last: endDate,
            interval: '1d',
            data: capacityFactors
          }
        } as any;

        coalUnits.push(coalUnit);
      });
    });

    // Calculate metadata
    const allDates = data.map(row => {
      const dateValue = row.interval || row.date || row.period;
      if (!dateValue) return null;
      return dateValue instanceof Date 
        ? dateValue.toISOString().split('T')[0]
        : dateValue.split('T')[0];
    }).filter(Boolean);
    const metadata = {
      start_date: allDates.length > 0 ? allDates.reduce((a, b) => a < b ? a : b) : '',
      end_date: allDates.length > 0 ? allDates.reduce((a, b) => a > b ? a : b) : '',
      version: '1.0',
      created_at: getAESTDateTimeString()
    };

    const elapsed = Math.round(performance.now() - startTime);
    console.log(`   Processing completed in ${elapsed}ms`);

    return {
      type: 'capacity_factors',
      version: metadata.version,
      created_at: metadata.created_at,
      data: coalUnits
    } as GeneratingUnitCapFacHistoryDTO;
  }
}

/**
 * Get or create a singleton instance of CoalDataService
 */
export async function getCoalDataService(): Promise<CapFacDataService> {
  const apiKey = process.env.OPENELECTRICITY_API_KEY;
  if (!apiKey) {
    throw new Error('OPENELECTRICITY_API_KEY environment variable is not set');
  }
  
  return new CapFacDataService(apiKey);
}