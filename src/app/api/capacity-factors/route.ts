import { NextResponse } from 'next/server';
import { CapFacDataService } from '@/server/cap-fac-data-service';
import { isLeapYear } from '@/shared/date-utils';
import { initializeRequestLogger } from '@/server/request-logger';

// Initialize logger for API routes
const port = parseInt(process.env.PORT || '3000');
initializeRequestLogger(port);

// Create a singleton instance of the service to avoid creating multiple API clients
let serviceInstance: CapFacDataService | null = null;

function getService(): CapFacDataService {
  if (!serviceInstance) {
    const apiKey = process.env.OPENELECTRICITY_API_KEY;
    if (!apiKey) {
      throw new Error('API key not configured');
    }
    serviceInstance = new CapFacDataService(apiKey);
  }
  return serviceInstance;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    
    if (!yearParam) {
      return NextResponse.json(
        { error: 'year parameter is required' },
        { status: 400 }
      );
    }
    
    const year = parseInt(yearParam);
    if (isNaN(year) || year < 1900 || year > 2100) {
      return NextResponse.json(
        { error: 'Invalid year parameter' },
        { status: 400 }
      );
    }
    
    console.log(`🌐 API: Fetching capacity factors for year ${year}`);
    
    const service = getService();
    const data = await service.getCapacityFactors(year);
    
    console.log(`🌐 API: Returning data for year ${year}`);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}