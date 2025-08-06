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
      <Script 
        src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"
        strategy="beforeInteractive"
      />
      <link 
        rel="stylesheet" 
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        crossOrigin="anonymous"
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
          {chartsReady && (
            <div id="awaiting-data" className="awaiting-data">
              Awaiting interaction event data.
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
            
            // Warning colors and symbols (different from line colors)
            const WARNING_COLORS = ['#FF6B6B', '#845EC2', '#4E8397', '#C493FF', '#FFC75F', '#B39CD0', '#00C9A7'];
            const WARNING_SYMBOLS = ['triangle', 'rect', 'star', 'crossRot', 'circle', 'rectRounded', 'triangleDown'];
            
            // Phase colors for background regions
            const PHASE_COLORS = ['#1E88E5', '#43A047', '#E53935', '#FB8C00', '#8E24AA', '#00ACC1', '#D81B60'];
            
            // Simple hash function for consistent warning assignment
            function hashString(str) {
              let hash = 0;
              for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
              }
              return Math.abs(hash);
            }
            
            // Get consistent color and symbol for a warning type
            function getWarningStyle(warningType) {
              const hash = hashString(warningType);
              return {
                color: WARNING_COLORS[hash % WARNING_COLORS.length],
                symbol: WARNING_SYMBOLS[hash % WARNING_SYMBOLS.length]
              };
            }
            
            // Get consistent color for a phase
            function getPhaseColor(phase) {
              if (!phase) return 'rgba(0, 0, 0, 0.05)';
              const hash = hashString(phase);
              const baseColor = PHASE_COLORS[hash % PHASE_COLORS.length];
              // Convert hex to rgba with 20% opacity
              const r = parseInt(baseColor.slice(1, 3), 16);
              const g = parseInt(baseColor.slice(3, 5), 16);
              const b = parseInt(baseColor.slice(5, 7), 16);
              return 'rgba(' + r + ', ' + g + ', ' + b + ', 0.2)';
            }
            
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
              
              // Process each session - sort MOVE first, then by type and name
              if (data.sessions && Array.isArray(data.sessions)) {
                const sortedSessions = [...data.sessions].sort((a, b) => {
                  // MOVE type always comes first
                  if (a.type === 'MOVE' && b.type !== 'MOVE') return -1;
                  if (b.type === 'MOVE' && a.type !== 'MOVE') return 1;
                  
                  // Then sort by type
                  if (a.type !== b.type) {
                    return a.type.localeCompare(b.type);
                  }
                  
                  // Finally sort by sessionId (name)
                  return a.sessionId.localeCompare(b.sessionId);
                });
                
                sortedSessions.forEach(session => {
                  createOrUpdateChart(masterSessionId, session);
                });
              }
            }
            
            // Create master session container
            function createMasterSessionContainer(data) {
              const container = document.getElementById('sessions-container');
              
              // Remove "awaiting data" message if it exists
              const awaitingMsg = document.getElementById('awaiting-data');
              if (awaitingMsg) {
                awaitingMsg.remove();
              }
              
              const masterDiv = document.createElement('div');
              masterDiv.className = 'master-session';
              masterDiv.id = 'master-' + data.masterSessionId;
              
              // Calculate max duration across all sessions for x-axis sync
              let maxDuration = 0;
              if (data.sessions) {
                data.sessions.forEach(session => {
                  const sessionMax = session.events?.reduce((max, e) => Math.max(max, e.elapsedMs || 0), 0) || session.duration || 0;
                  maxDuration = Math.max(maxDuration, sessionMax);
                });
              }
              // Round up to nearest 80ms for consistent grid
              maxDuration = Math.ceil(maxDuration / 80) * 80;
              masterDiv.dataset.maxDuration = maxDuration;
              
              masterDiv.innerHTML = \`
                <div class="master-session-header">
                  <h2 class="master-session-title">
                    MasterSession #\${data.masterSessionId}
                    <span class="master-session-duration">\${data.duration || maxDuration} ms</span>
                  </h2>
                  <div class="master-session-controls">
                    <button class="btn-icon" onclick="saveMasterSession(\${data.masterSessionId})" title="Save JSON">
                      <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-icon" onclick="clearMasterSession(\${data.masterSessionId})" title="Clear">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                </div>
                <div class="session-charts" id="charts-\${data.masterSessionId}"></div>
              \`;
              
              // Insert at the beginning of the container (newest first)
              if (container.firstChild) {
                container.insertBefore(masterDiv, container.firstChild);
              } else {
                container.appendChild(masterDiv);
              }
              
              masterSessions.set(data.masterSessionId, data);
              
              // Smooth scroll to top when new session added
              window.scrollTo({
                top: 0,
                behavior: 'smooth'
              });
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
                </div>
                <div class="chart-container">
                  <canvas id="chart-\${chartId}"></canvas>
                </div>
              \`;
              
              container.appendChild(chartDiv);
              
              // Create Chart.js chart
              const ctx = document.getElementById('chart-' + chartId).getContext('2d');
              const chartData = processSessionData(session);
              
              // Get max duration for this master session (already rounded in createMasterSessionContainer)
              const masterDiv = document.getElementById('master-' + masterSessionId);
              const maxDuration = parseFloat(masterDiv.dataset.maxDuration) || Math.ceil((session.duration || 1000) / 80) * 80;
              
              // Add phase backgrounds as annotations
              const annotations = {};
              if (session.events.length > 0) {
                session.events.forEach((event, idx) => {
                  if (event.phase) {
                    const xMin = event.elapsedMs;
                    const xMax = idx < session.events.length - 1 
                      ? session.events[idx + 1].elapsedMs 
                      : maxDuration;
                    
                    annotations['phase_' + idx] = {
                      type: 'box',
                      xMin: xMin,
                      xMax: xMax,
                      yMin: null,
                      yMax: null,
                      backgroundColor: getPhaseColor(event.phase),
                      borderWidth: 0
                    };
                  }
                });
              }
              
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
                    annotation: {
                      annotations: annotations
                    },
                    legend: {
                      display: true,
                      position: 'right',
                      labels: {
                        font: {
                          family: "'DM Sans', sans-serif"
                        },
                        usePointStyle: true,
                        pointStyle: 'line',
                        boxWidth: 7,  // Square aspect ratio for markers
                        boxHeight: 7,  // Square aspect ratio for markers
                        generateLabels: function(chart) {
                          // Get original labels and ensure they have proper line width
                          const originalLabels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                          originalLabels.forEach(label => {
                            // Match the dataset border width (default is 3 for Chart.js line charts)
                            const dataset = chart.data.datasets.find(ds => ds.label === label.text);
                            label.lineWidth = dataset?.borderWidth || 2;
                            
                            // Use the dataset's point style for warnings
                            if (dataset?.pointStyle && !dataset.showLine) {
                              label.pointStyle = dataset.pointStyle;
                            }
                          });
                          
                          return originalLabels;
                        }
                      }
                    },
                    tooltip: {
                      enabled: true,
                      bodyFont: {
                        family: "'DM Sans', sans-serif"
                      },
                      titleFont: {
                        family: "'DM Sans', sans-serif"
                      },
                      usePointStyle: true,
                      boxWidth: 15,
                      boxHeight: 2,
                      callbacks: {
                        title: function(tooltipItems) {
                          // Show phase and time at the top
                          if (tooltipItems.length > 0) {
                            const dataIndex = tooltipItems[0].dataIndex;
                            const event = session.events[dataIndex];
                            const time = tooltipItems[0].parsed.x;
                            
                            if (event && event.phase) {
                              return event.phase + ' ' + time + 'ms';
                            }
                            return time + ' ms';
                          }
                          return '';
                        },
                        label: function(context) {
                          const dataset = context.dataset;
                          // For warning datasets, just show the label without value
                          if (!dataset.showLine && dataset.pointStyle) {
                            return dataset.label;
                          }
                          // For regular line datasets, show label and value
                          return context.dataset.label + ': ' + context.formattedValue;
                        },
                        afterBody: function(tooltipItems) {
                          // Add warnings if present at this data point
                          if (tooltipItems.length > 0) {
                            const dataIndex = tooltipItems[0].dataIndex;
                            const event = session.events[dataIndex];
                            if (event && event.warnings && event.warnings.length > 0) {
                              return '\\n⚠️ Warnings:\\n' + event.warnings.join('\\n');
                            }
                          }
                        }
                      }
                    },
                    zoom: {
                      zoom: {
                        wheel: {
                          enabled: false,
                        },
                        pinch: {
                          enabled: false
                        },
                        mode: 'x',
                      },
                      pan: {
                        enabled: false,
                        mode: 'x',
                      }
                    }
                  },
                  scales: {
                    x: {
                      type: 'linear',
                      display: true,
                      min: 0,
                      max: maxDuration,
                      title: {
                        display: false
                      },
                      ticks: {
                        stepSize: 16,
                        autoSkip: false,
                        autoSkipPadding: 0,
                        maxRotation: 0,
                        minRotation: 0,
                        font: {
                          family: "'DM Sans', sans-serif"
                        },
                        callback: function(value, index, ticks) {
                          // Dynamically calculate label interval to show max 20 labels
                          let labelInterval = 5; // Start with every 80ms
                          let labelCount = Math.ceil(ticks.length / labelInterval);
                          
                          // Keep doubling interval until we have 20 or fewer labels
                          while (labelCount > 20) {
                            labelInterval *= 2;
                            labelCount = Math.ceil(ticks.length / labelInterval);
                          }
                          
                          if (index % labelInterval === 0) {
                            // Add "ms" to the last visible label
                            const isLastVisibleLabel = index + labelInterval >= ticks.length;
                            if (isLastVisibleLabel) {
                              return value + ' ms';
                            }
                            return value;
                          }
                          return '';
                        }
                      },
                      grid: {
                        display: true,
                        drawOnChartArea: true,
                        drawTicks: true,
                        color: function(context) {
                          // Calculate grid interval same as label interval
                          const ticks = context.chart.scales.x.ticks;
                          let gridInterval = 5; // Start with every 80ms
                          let labelCount = Math.ceil(ticks.length / gridInterval);
                          
                          // Keep doubling interval until we have 20 or fewer grid lines
                          while (labelCount > 20) {
                            gridInterval *= 2;
                            labelCount = Math.ceil(ticks.length / gridInterval);
                          }
                          
                          // Show grid line at same interval as labels
                          const tickValue = context.tick.value;
                          const tickIndex = Math.round(tickValue / 16); // Convert value to index
                          if (tickIndex % gridInterval === 0) {
                            return 'rgba(0, 0, 0, 0.1)';
                          }
                          return 'transparent';
                        }
                      }
                    },
                    y: {
                      display: true,
                      title: {
                        display: false
                      },
                      ticks: {
                        font: {
                          family: "'DM Sans', sans-serif"
                        }
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
              
              // Dynamically discover all numeric data fields
              if (session.events.length > 0 && session.events[0].data) {
                // Collect all unique data keys from all events
                const dataKeys = new Set();
                session.events.forEach(e => {
                  if (e.data) {
                    Object.keys(e.data).forEach(key => {
                      // Only include numeric values
                      if (typeof e.data[key] === 'number') {
                        dataKeys.add(key);
                      }
                    });
                  }
                });
                
                // Color palette for dynamic fields
                const fieldColors = [
                  '#2196F3', '#FF5722', '#4CAF50', '#FF9800', 
                  '#9C27B0', '#00BCD4', '#E91E63', '#FFC107',
                  '#795548', '#607D8B', '#3F51B5', '#009688'
                ];
                
                // Create a dataset for each data field
                let colorIndex = 0;
                Array.from(dataKeys).sort().forEach(key => {
                  const color = fieldColors[colorIndex % fieldColors.length];
                  
                  // Format the label (camelCase to Title Case)
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                  
                  datasets.push({
                    label: label,
                    data: session.events.map(e => ({ 
                      x: e.elapsedMs, 
                      y: e.data && typeof e.data[key] === 'number' ? e.data[key] : 0 
                    })),
                    borderColor: color,
                    backgroundColor: color + '20',
                    borderWidth: 2,
                    tension: 0.1
                  });
                  
                  colorIndex++;
                });
              }
              
              // Group warnings by type and create separate datasets
              const warningsByType = {};
              
              // Calculate y-axis range for positioning
              let yValues = [];
              session.events.forEach(evt => {
                if (evt.data) {
                  Object.values(evt.data).forEach(value => {
                    if (typeof value === 'number') {
                      yValues.push(value);
                    }
                  });
                }
              });
              
              const minY = Math.min(...yValues, 0);
              const maxY = Math.max(...yValues, 0);
              const range = maxY - minY || 1;
              
              // First pass: collect all unique warning types
              const uniqueWarnings = new Set();
              session.events.forEach(e => {
                if (e.warnings && e.warnings.length > 0) {
                  e.warnings.forEach(warning => uniqueWarnings.add(warning));
                }
              });
              
              // Assign stable y-positions to each warning type based on hash
              const warningPositions = {};
              Array.from(uniqueWarnings).forEach(warning => {
                const hash = hashString(warning);
                // Use hash to determine stable y-position
                const positionIndex = hash % 5; // 5 different vertical positions
                const yOffset = 0.1 + (positionIndex * 0.08);
                warningPositions[warning] = minY + (range * yOffset);
              });
              
              // Second pass: collect warnings with their stable positions
              session.events.forEach(e => {
                if (e.warnings && e.warnings.length > 0) {
                  e.warnings.forEach(warning => {
                    if (!warningsByType[warning]) {
                      warningsByType[warning] = [];
                    }
                    warningsByType[warning].push({ 
                      x: e.elapsedMs, 
                      y: warningPositions[warning]
                    });
                  });
                }
              });
              
              // Create a dataset for each warning type
              Object.entries(warningsByType).forEach(([warningType, points]) => {
                const style = getWarningStyle(warningType);
                datasets.push({
                  label: warningType,
                  data: points,
                  borderColor: style.color,
                  backgroundColor: style.color,
                  pointStyle: style.symbol,
                  pointRadius: 6,
                  showLine: false
                });
              });
              
              return { datasets };
            }
            
            // Setup event handlers
            function setupEventHandlers() {
              const clearBtn = document.getElementById('clear-all-btn');
              if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                  if (confirm('Clear all sessions?')) {
                    const container = document.getElementById('sessions-container');
                    container.innerHTML = '';
                    charts.clear();
                    masterSessions.clear();
                    
                    // Re-add the awaiting data message
                    const awaitingDiv = document.createElement('div');
                    awaitingDiv.id = 'awaiting-data';
                    awaitingDiv.className = 'awaiting-data';
                    awaitingDiv.textContent = 'Awaiting interaction event data.';
                    container.appendChild(awaitingDiv);
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
              
              // If no sessions remain, show the awaiting data message
              const container = document.getElementById('sessions-container');
              if (container && container.children.length === 0) {
                const awaitingDiv = document.createElement('div');
                awaitingDiv.id = 'awaiting-data';
                awaitingDiv.className = 'awaiting-data';
                awaitingDiv.textContent = 'Awaiting interaction event data.';
                container.appendChild(awaitingDiv);
              }
            };
            
            // Initialize dashboard
            initDashboard();
          })();
        `}</Script>
      )}
    </>
  );
}