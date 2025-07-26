// Shared mock canvas implementation for tests
export class MockCanvas {
  width: number = 0;
  height: number = 0;
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  
  getContext() {
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      fillText: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      createImageData: jest.fn((width: number, height: number) => {
        // Create a properly aligned buffer
        const byteLength = width * height * 4;
        const buffer = new ArrayBuffer(byteLength);
        const data = new Uint8ClampedArray(buffer);
        
        return {
          data,
          width,
          height
        };
      }),
      putImageData: jest.fn()
    };
  }
}