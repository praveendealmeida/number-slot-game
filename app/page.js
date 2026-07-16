'use client'

import dynamic from 'next/dynamic'

const WardrobeConfigurator = dynamic(
  () => import('./configurator'),
  { 
    ssr: false,
    loading: () => (
      <div style={{
        width: '100%', height: '100vh', display: 'flex', 
        alignItems: 'center', justifyContent: 'center',
        background: '#f7f6f3', color: '#EFC01E',
        fontFamily: "'Poppins', sans-serif",
        flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '0.05em' }}>Plan My Wardrobe</div>
        <div style={{ fontSize: 12, color: '#9c968e' }}>Loading Wardrobe Studio...</div>
      </div>
    )
  }
)

export default function Page() {
  return <WardrobeConfigurator />
}
