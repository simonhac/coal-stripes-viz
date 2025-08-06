'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import './dashboard.css';

export default function DashboardPage() {
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    // Check if all scripts are loaded
    const checkReady = setInterval(() => {
      if (typeof window !== 'undefined' && (window as any).Chart) {
        setChartsReady(true);
        clearInterval(checkReady);
      }
    }, 100);

    return () => clearInterval(checkReady);
  }, [scriptsLoaded]);

  return (
    <>
      <Script 
        src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"
        strategy="beforeInteractive"
        onLoad={() => setScriptsLoaded(true)}
      />
      <Script 
        src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"
        strategy="beforeInteractive"
      />
      <Script 
        src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"
        strategy="beforeInteractive"
      />
      
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Gesture Analysis Dashboard</h1>
          <button id="clear-all-btn" className="clear-all-btn">Clear All</button>
        </div>
        
        <div id="sessions-container">
          {!chartsReady && (
            <div className="dashboard-loading">
              Loading charts...
            </div>
          )}
        </div>
        
        <div id="connection-status" className="connection-status">
          <span className="status-dot"></span>
          <span className="status-text">Connecting...</span>
        </div>
      </div>

      {chartsReady && (
        <Script id="dashboard-script" strategy="afterInteractive">{`
          (function() {
            let eventSource = null;
            let charts = new Map();
            let masterSessions = new Map();
            
            // Chart colors matching session types
            const COLORS = {
              WHEEL: '#2196F3',
              MOVE: '#4CAF50', 
              TOUCH: '#9C27B0',
              WARNING: '#FF9800',
              PHASE_BG: 'rgba(0, 0, 0, 0.05)'
            };
            
            // Initialize dashboard
            function initDashboard() {
              // Remove loading message
              const loadingEl = document.querySelector('.dashboard-loading');
              if (loadingEl) loadingEl.remove();
              
              connectSSE();
              setupEventHandlers();
            }
            
            // Connect to SSE stream
            function connectSSE() {
              const statusDot = document.querySelector('.status-dot');
              const statusText = document.querySelector('.status-text');
              
              eventSource = new EventSource('/api/sessions/stream');
              
              eventSource.onopen = () => {
                console.log('📡 Connected to session stream');
                statusDot.classList.add('connected');
                statusDot.classList.remove('error');
                statusText.textContent = 'Connected';
              };
              
              eventSource.onmessage = (event) => {
                try {
                  const data = JSON.parse(event.data);
                  
                  // Calculate payload size
                  const payloadSize = new Blob([event.data]).size / 1024;
                  const timestamp = new Date().toLocaleTimeString();
                  
                  console.log(
                    \`📊 [\${timestamp}] New data arrived: MasterSession #\${data.masterSessionId}\`,
                    \`| Size: \${payloadSize.toFixed(2)} kB\`,
                    \`| Sessions: \${data.sessions?.length || 0}\`,
                    \`| Total Events: \${data.sessions?.reduce((sum, s) => sum + (s.eventCount || s.events?.length || 0), 0) || 0}\`
                  );
                  
                  processMasterSession(data);
                } catch (error) {
                  console.error('Error parsing session data:', error);
                }
              };
              
              eventSource.onerror = () => {
                console.error('❌ SSE connection error');
                statusDot.classList.remove('connected');
                statusDot.classList.add('error');
                statusText.textContent = 'Connection lost';
                
                // Auto-reconnect after 5 seconds
                setTimeout(() => {
                  statusText.textContent = 'Reconnecting...';
                  connectSSE();
                }, 5000);
              };
            }
            
            // Process incoming master session data
            function processMasterSession(data) {
              const masterSessionId = data.masterSessionId;
              
              // Create container for this master session if it doesn't exist
              if (!masterSessions.has(masterSessionId)) {
                createMasterSessionContainer(data);
              }
              
              // Process each session
              if (data.sessions && Array.isArray(data.sessions)) {
                data.sessions.forEach(session => {
                  createOrUpdateChart(masterSessionId, session);
                });
              }
            }
            
            // Create master session container
            function createMasterSessionContainer(data) {
              const container = document.getElementById('sessions-container');
              
              // Add divider if there are existing sessions
              if (container.children.length > 0) {
                const divider = document.createElement('div');
                divider.className = 'divider';
                container.appendChild(divider);
              }
              
              const masterDiv = document.createElement('div');
              masterDiv.className = 'master-session';
              masterDiv.id = 'master-' + data.masterSessionId;
              
              masterDiv.innerHTML = \`
                <div class="master-session-header">
                  <h2 class="master-session-title">MasterSession #\${data.masterSessionId}</h2>
                  <div class="master-session-controls">
                    <button class="btn-secondary" onclick="saveMasterSession(\${data.masterSessionId})">Save JSON</button>
                    <button class="btn-secondary" onclick="clearMasterSession(\${data.masterSessionId})">Clear</button>
                  </div>
                </div>
                <div class="session-charts" id="charts-\${data.masterSessionId}"></div>
              \`;
              
              container.appendChild(masterDiv);
              masterSessions.set(data.masterSessionId, data);
            }
            
            // Create or update chart for a session
            function createOrUpdateChart(masterSessionId, session) {
              const chartId = masterSessionId + '-' + session.sessionId;
              
              if (!charts.has(chartId)) {
                createChart(masterSessionId, session);
              } else {
                updateChart(chartId, session);
              }
            }
            
            // Create new chart for session
            function createChart(masterSessionId, session) {
              const container = document.getElementById('charts-' + masterSessionId);
              if (!container) return;
              
              const chartId = masterSessionId + '-' + session.sessionId;
              
              const chartDiv = document.createElement('div');
              chartDiv.className = 'session-chart';
              chartDiv.innerHTML = \`
                <div class="session-info">
                  <span class="session-type \${session.type}">\${session.sessionId}</span>
                  <div class="session-metadata">
                    <span>Duration: \${session.duration}ms</span>
                    <span>Events: \${session.eventCount}</span>
                    <span>Status: \${session.active ? 'Active' : 'Complete'}</span>
                  </div>
                </div>
                <div class="chart-container">
                  <canvas id="chart-\${chartId}"></canvas>
                </div>
              \`;
              
              container.appendChild(chartDiv);
              
              // Create Chart.js chart
              const ctx = document.getElementById('chart-' + chartId).getContext('2d');
              const chartData = processSessionData(session);
              
              const chart = new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top',
                    },
                    tooltip: {
                      enabled: true,
                      callbacks: {
                        afterLabel: function(context) {
                          // Add warnings to tooltip if present
                          const event = session.events[context.dataIndex];
                          if (event && event.warnings) {
                            return 'Warnings: ' + event.warnings.join(', ');
                          }
                        }
                      }
                    },
                    zoom: {
                      zoom: {
                        wheel: {
                          enabled: true,
                        },
                        pinch: {
                          enabled: true
                        },
                        mode: 'x',
                      },
                      pan: {
                        enabled: true,
                        mode: 'x',
                      }
                    }
                  },
                  scales: {
                    x: {
                      type: 'linear',
                      display: true,
                      title: {
                        display: true,
                        text: 'Time (ms)'
                      }
                    },
                    y: {
                      display: true,
                      title: {
                        display: true,
                        text: 'Value'
                      }
                    }
                  }
                }
              });
              
              charts.set(chartId, chart);
            }
            
            // Process session data for chart
            function processSessionData(session) {
              const datasets = [];
              const labels = session.events.map(e => e.elapsedMs);
              
              // Determine which data to show based on session type
              if (session.type === 'WHEEL' && session.events.length > 0 && session.events[0].data) {
                // Delta X dataset
                datasets.push({
                  label: 'Delta X',
                  data: session.events.map(e => ({ x: e.elapsedMs, y: e.data?.deltaX || 0 })),
                  borderColor: COLORS.WHEEL,
                  backgroundColor: COLORS.WHEEL + '20',
                  tension: 0.1
                });
                
                // Accumulated X dataset
                datasets.push({
                  label: 'Accumulated X',
                  data: session.events.map(e => ({ x: e.elapsedMs, y: e.data?.accumulatedX || 0 })),
                  borderColor: '#FF5722',
                  backgroundColor: '#FF572220',
                  tension: 0.1
                });
              } else if (session.type === 'MOVE' && session.events.length > 0 && session.events[0].data) {
                // Velocity dataset
                datasets.push({
                  label: 'Velocity',
                  data: session.events.map(e => ({ x: e.elapsedMs, y: e.data?.velocity || 0 })),
                  borderColor: COLORS.MOVE,
                  backgroundColor: COLORS.MOVE + '20',
                  tension: 0.1
                });
                
                // Acceleration dataset
                datasets.push({
                  label: 'Acceleration',
                  data: session.events.map(e => ({ x: e.elapsedMs, y: e.data?.acceleration || 0 })),
                  borderColor: '#FF9800',
                  backgroundColor: '#FF980020',
                  tension: 0.1
                });
              } else if (session.type === 'TOUCH' && session.events.length > 0 && session.events[0].data) {
                // Delta X/Y datasets
                datasets.push({
                  label: 'Delta X',
                  data: session.events.map(e => ({ x: e.elapsedMs, y: e.data?.deltaX || 0 })),
                  borderColor: COLORS.TOUCH,
                  backgroundColor: COLORS.TOUCH + '20',
                  tension: 0.1
                });
                
                datasets.push({
                  label: 'Delta Y',
                  data: session.events.map(e => ({ x: e.elapsedMs, y: e.data?.deltaY || 0 })),
                  borderColor: '#E91E63',
                  backgroundColor: '#E91E6320',
                  tension: 0.1
                });
              }
              
              // Add warning markers
              const warningPoints = session.events
                .filter(e => e.warnings && e.warnings.length > 0)
                .map(e => ({ x: e.elapsedMs, y: 0 }));
              
              if (warningPoints.length > 0) {
                datasets.push({
                  label: 'Warnings',
                  data: warningPoints,
                  borderColor: COLORS.WARNING,
                  backgroundColor: COLORS.WARNING,
                  pointStyle: 'triangle',
                  pointRadius: 8,
                  showLine: false
                });
              }
              
              return { datasets };
            }
            
            // Setup event handlers
            function setupEventHandlers() {
              const clearBtn = document.getElementById('clear-all-btn');
              if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                  if (confirm('Clear all sessions?')) {
                    document.getElementById('sessions-container').innerHTML = '';
                    charts.clear();
                    masterSessions.clear();
                  }
                });
              }
            }
            
            // Save master session as JSON
            window.saveMasterSession = function(masterSessionId) {
              const data = masterSessions.get(masterSessionId);
              if (data) {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'master-session-' + masterSessionId + '.json';
                a.click();
                URL.revokeObjectURL(url);
              }
            };
            
            // Clear master session
            window.clearMasterSession = function(masterSessionId) {
              const element = document.getElementById('master-' + masterSessionId);
              if (element) {
                element.remove();
              }
              
              // Remove charts for this master session
              for (const [key, chart] of charts) {
                if (key.startsWith(masterSessionId + '-')) {
                  chart.destroy();
                  charts.delete(key);
                }
              }
              
              masterSessions.delete(masterSessionId);
            };
            
            // Initialize dashboard
            initDashboard();
          })();
        `}</Script>
      )}
    </>
  );
}