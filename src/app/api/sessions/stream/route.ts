/**
 * SSE endpoint for streaming session data to dashboards
 */

import { NextRequest } from 'next/server';
import { sessionEvents } from '../events';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // Create a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // Send initial connection message
  writer.write(encoder.encode(': Connected to session stream\n\n'));
  
  // Keep connection alive with periodic heartbeat
  const heartbeat = setInterval(() => {
    writer.write(encoder.encode(': heartbeat\n\n')).catch(() => {
      clearInterval(heartbeat);
    });
  }, 30000);
  
  // Handle incoming session data
  const handleSession = (data: any) => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    writer.write(encoder.encode(message)).catch(() => {
      // Client disconnected
      sessionEvents.offSession(handleSession);
      clearInterval(heartbeat);
    });
  };
  
  // Subscribe to session events
  sessionEvents.onSession(handleSession);
  
  // Clean up on client disconnect
  request.signal.addEventListener('abort', () => {
    sessionEvents.offSession(handleSession);
    clearInterval(heartbeat);
    writer.close();
  });
  
  // Return SSE response
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}