/**
 * POST endpoint for receiving gesture session data
 */

import { NextRequest, NextResponse } from 'next/server';
import { sessionEvents } from './events';

// Enable CORS for local development
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Log received session data
    console.log(`📊 Received MasterSession #${data.masterSessionId} with ${data.totalSessions || data.sessions?.length || 0} sessions`);
    
    // Broadcast to all connected SSE clients
    sessionEvents.emitSession(data);
    
    return NextResponse.json(
      { success: true, message: 'Session data received' },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error processing session data:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid session data' },
      { status: 400, headers: corsHeaders }
    );
  }
}