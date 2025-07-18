// Next.js API route for coal stripes data
import type { NextApiRequest, NextApiResponse } from 'next';
import { CoalDataService } from '../../lib/coal-data-service';
import { CoalStripesData } from '../../lib/types';

interface ErrorResponse {
  error: string;
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CoalStripesData | ErrorResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method Not Allowed', 
      message: 'Only GET requests are allowed' 
    });
  }

  try {
    const apiKey = process.env.OPENELECTRICITY_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Configuration Error', 
        message: 'OpenElectricity API key not configured' 
      });
    }

    // Debug: Log API key info (without exposing the key)
    console.log('API Key present:', !!apiKey);
    console.log('API Key length:', apiKey?.length);
    console.log('API Key starts with:', apiKey?.substring(0, 3));

    // Get optional query parameters
    const requestDays = parseInt(req.query.days as string) || 365;
    
    // Validate requestDays
    if (requestDays < 1 || requestDays > 365) {
      return res.status(400).json({ 
        error: 'Invalid Parameter', 
        message: 'Days parameter must be between 1 and 365' 
      });
    }

    console.log(`📡 API request for coal stripes data (${requestDays} days)`);
    
    const service = new CoalDataService(apiKey);
    const data = await service.getCoalStripesData(requestDays);
    
    console.log(`✅ API response ready: ${data.totalUnits} units, ${data.actualDays} days`);
    
    // Set cache headers (cache for 5 minutes)
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('❌ API error:', error);
    
    // Return appropriate error response
    if (error instanceof Error) {
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: error.message 
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'An unexpected error occurred' 
    });
  }
}