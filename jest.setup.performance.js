// Setup for performance tests

// Mock performance.now() if not available
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  };
}

// Mock canvas for Node.js environment
class MockCanvas {
  width = 0;
  height = 0;
  
  getContext() {
    const imageData = new Uint8ClampedArray(4);
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      getImageData: jest.fn(() => ({ data: imageData, width: 1, height: 1 })),
      putImageData: jest.fn(),
    };
  }
}

global.OffscreenCanvas = MockCanvas;

// Suppress console logs during tests except for performance results
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

global.console.log = (...args) => {
  // Allow performance test output
  const firstArg = args[0]?.toString() || '';
  if (firstArg.includes('===') || 
      firstArg.includes('Performance') ||
      firstArg.includes('Results:') || 
      firstArg.includes('Distribution:') ||
      firstArg.includes('tiles') ||
      firstArg.includes('render time') ||
      firstArg.includes('Standard deviation') ||
      firstArg.includes('Cache') ||
      firstArg.includes('Memory') ||
      firstArg.includes('ms') ||
      firstArg.includes('MB') ||
      firstArg.includes('operations/second')) {
    originalLog(...args);
  }
};

// Suppress warnings and non-critical errors
global.console.warn = () => {};
global.console.error = (...args) => {
  const firstArg = args[0]?.toString() || '';
  if (firstArg.includes('Critical') || firstArg.includes('FATAL')) {
    originalError(...args);
  }
};