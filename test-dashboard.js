/**
 * Test script to send sample gesture data to the dashboard
 */

const sampleData = {
  masterSessionId: 1,
  startTime: 1000,
  endTime: 2880,
  duration: 1880,
  totalSessions: 2,
  sessions: [
    {
      sessionId: "1a-WHEEL",
      type: "WHEEL",
      identifier: "a",
      masterSessionDeltaMs: 0,
      startTime: 1000,
      endTime: 1880,
      duration: 880,
      active: false,
      eventCount: 5,
      events: [
        {
          sessionId: "1a-WHEEL",
          phase: "SCROLL",
          eventSeq: 0,
          elapsedMs: 0,
          data: { deltaX: 1.5, accumulatedX: 1.5 }
        },
        {
          sessionId: "1a-WHEEL",
          phase: "SCROLL",
          eventSeq: 1,
          elapsedMs: 100,
          data: { deltaX: 3.2, accumulatedX: 4.7 },
          warnings: ["MOMENTUM_LOST"]
        },
        {
          sessionId: "1a-WHEEL",
          phase: "SCROLL",
          eventSeq: 2,
          elapsedMs: 200,
          data: { deltaX: -2.1, accumulatedX: 2.6 }
        },
        {
          sessionId: "1a-WHEEL",
          phase: "SCROLL",
          eventSeq: 3,
          elapsedMs: 400,
          data: { deltaX: 5.5, accumulatedX: 8.1 }
        },
        {
          sessionId: "1a-WHEEL",
          phase: "SCROLL",
          eventSeq: 4,
          elapsedMs: 600,
          data: { deltaX: -1.0, accumulatedX: 7.1 },
          warnings: ["THRESHOLD_EXCEEDED", "NEARLY_STOPPED"]
        }
      ]
    },
    {
      sessionId: "1a-MOVE",
      type: "MOVE",
      identifier: "a",
      masterSessionDeltaMs: 100,
      startTime: 1100,
      endTime: 1880,
      duration: 780,
      active: false,
      eventCount: 4,
      events: [
        {
          sessionId: "1a-MOVE",
          phase: "DRAG",
          eventSeq: 0,
          elapsedMs: 0,
          data: {
            position: "2025-08-05",
            targetDate: "2025-08-10",
            velocity: 5.0,
            acceleration: 0.5,
            displacement: 5
          }
        },
        {
          sessionId: "1a-MOVE",
          phase: "DRAG",
          eventSeq: 1,
          elapsedMs: 200,
          data: {
            position: "2025-08-06",
            targetDate: "2025-08-10",
            velocity: 4.5,
            acceleration: -0.5,
            displacement: 4
          }
        },
        {
          sessionId: "1a-MOVE",
          phase: "DRAG",
          eventSeq: 2,
          elapsedMs: 400,
          data: {
            position: "2025-08-07",
            targetDate: "2025-08-10",
            velocity: 3.0,
            acceleration: -1.5,
            displacement: 3
          },
          warnings: ["STUCK"]
        },
        {
          sessionId: "1a-MOVE",
          phase: "DRAG",
          eventSeq: 3,
          elapsedMs: 600,
          data: {
            position: "2025-08-08",
            targetDate: "2025-08-10",
            velocity: 0.0,
            acceleration: -3.0,
            displacement: 2
          },
          warnings: ["STUCK", "IN_SLOP"]
        }
      ]
    }
  ]
};

async function sendTestData() {
  try {
    const response = await fetch('http://localhost:3000/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleData)
    });
    
    const result = await response.json();
    console.log('✅ Data sent successfully:', result);
    
    // Send a second master session after 2 seconds
    setTimeout(async () => {
      const secondData = {
        ...sampleData,
        masterSessionId: 2,
        sessions: [
          {
            ...sampleData.sessions[0],
            sessionId: "2a-WHEEL",
            events: sampleData.sessions[0].events.map(e => ({
              ...e,
              sessionId: "2a-WHEEL",
              data: { 
                deltaX: (e.data.deltaX || 0) * 1.5, 
                accumulatedX: (e.data.accumulatedX || 0) * 1.5 
              }
            }))
          }
        ]
      };
      
      const response2 = await fetch('http://localhost:3000/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(secondData)
      });
      
      const result2 = await response2.json();
      console.log('✅ Second data sent:', result2);
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error sending data:', error);
  }
}

console.log('Sending test data to dashboard...');
console.log('Make sure the Next.js server is running (npm run dev)');
console.log('Open http://localhost:3000/dashboard to see the results');

sendTestData();