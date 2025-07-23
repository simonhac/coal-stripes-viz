import { TileTest } from '@/components/TileTest';
import { TileViewport } from '@/components/TileViewport';

export default function TileTestPage() {
  return (
    <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Tile System Performance Test</h1>
      
      <TileViewport 
        facilityName="Eraring"
        unitHeights={[30, 30, 40, 30]}
        startYear={2019}
        endYear={2024}
      />
      
      <hr style={{ margin: '40px 0' }} />
      
      <TileTest />
    </main>
  );
}