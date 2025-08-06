# Gesture Analysis Dashboard

A real-time dashboard for visualising gesture session data using Server-Sent Events (SSE).

## Features

- **Real-time Updates**: Automatically displays new gesture data as it arrives
- **Multiple Session Types**: Separate charts for WHEEL, MOVE, and TOUCH gestures
- **Interactive Charts**: Zoom and pan capabilities using Chart.js
- **Phase Tracking**: Visual indicators for different gesture phases
- **Warning Markers**: Highlights events with warnings on the charts
- **Session Management**: Save sessions as JSON, clear individual or all sessions
- **Auto-reconnect**: Automatically reconnects if the SSE connection drops

## Usage

### 1. Start the Next.js Development Server

```bash
npm run dev
```

The server will start on http://localhost:3000

### 2. Open the Dashboard

Navigate to: http://localhost:3000/dashboard

### 3. Send Gesture Data

The dashboard accepts POST requests at `/api/sessions` with gesture data.

#### From the App

The MasterSession automatically sends data when it ends:
- Gesture interactions in the app will automatically appear on the dashboard
- Data is sent when all sessions in a MasterSession complete

#### Manual Testing

Use the test script to send sample data:

```bash
node test-dashboard.js
```

#### Custom Data

Send data via curl or any HTTP client:

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "masterSessionId": 1,
    "sessions": [{
      "sessionId": "1a-WHEEL",
      "type": "WHEEL",
      "events": [...]
    }]
  }'
```

## Architecture

```
Gesture App → POST /api/sessions → SSE → Dashboard
     ↓              ↓                ↓        ↓
  JSON data    Event Emitter   EventSource  Charts
```

### API Endpoints

- `POST /api/sessions` - Receive gesture session data
- `GET /api/sessions/stream` - SSE stream for real-time updates
- `GET /dashboard` - Dashboard UI

### Data Format

```json
{
  "masterSessionId": 1,
  "startTime": 1000,
  "endTime": 2880,
  "duration": 1880,
  "totalSessions": 2,
  "sessions": [
    {
      "sessionId": "1a-WHEEL",
      "type": "WHEEL",
      "duration": 880,
      "events": [
        {
          "elapsedMs": 0,
          "phase": "SCROLL",
          "data": {
            "deltaX": 1.5,
            "accumulatedX": 1.5
          },
          "warnings": ["MOMENTUM_LOST"]
        }
      ]
    }
  ]
}
```

## Chart Types

### WHEEL Sessions
- **Delta X**: Change in scroll position
- **Accumulated X**: Total scroll distance

### MOVE Sessions
- **Velocity**: Speed of movement
- **Acceleration**: Rate of speed change

### TOUCH Sessions
- **Delta X/Y**: Touch movement in both axes
- **Center Position**: Touch centre coordinates

## UI Controls

- **Clear All**: Remove all sessions from the dashboard
- **Save JSON**: Download session data as JSON file
- **Clear**: Remove individual master session
- **Connection Status**: Shows SSE connection state

## Development

The dashboard consists of:
- `/src/app/api/sessions/` - API routes for data ingestion
- `/src/app/api/sessions/stream/` - SSE endpoint
- `/src/app/dashboard/page.tsx` - Dashboard UI
- `/src/app/api/sessions/events.ts` - Event emitter for SSE coordination

## Troubleshooting

### Connection Issues
- Check that the Next.js server is running on port 3000
- Verify no CORS issues (headers are set to allow all origins)
- Check browser console for connection errors

### Data Not Appearing
- Ensure data follows the correct format
- Check browser console for parsing errors
- Verify SSE connection is established (green dot indicator)

### Chart Issues
- Charts require valid numeric data in event.data fields
- Phase changes require consistent phase values across events
- Warning markers only appear when warnings array is present