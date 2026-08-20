'use client'

import Image from 'next/image'

const BRANDS = [
  { name: 'Amazon', domain: 'amazon.com' },
  { name: 'LinkedIn', domain: 'linkedin.com' },
  { name: 'Walmart', domain: 'walmart.com' },
  { name: 'GitHub', domain: 'github.com' },
  { name: 'Reddit', domain: 'reddit.com' },
  { name: 'Zillow', domain: 'zillow.com' },
  { name: 'Booking.com', domain: 'booking.com' },
  { name: 'Etsy', domain: 'etsy.com' },
  { name: 'Crunchbase', domain: 'crunchbase.com' },
  { name: 'Home Depot', domain: 'homedepot.com' },
  { name: 'Perplexity', domain: 'perplexity.ai' },
  { name: 'TikTok', domain: 'tiktok.com' },
]

export function HeroGraphic() {
  return (
    <div className="relative aspect-square w-full max-w-[500px] mx-auto">
      {/* Background structure - rotates slowly */}
      <div 
        className="absolute inset-0"
        style={{ animation: 'spin-slow 60s linear infinite' }}
      >
        {/* Concentric rings to match the theme's structural feel */}
        <div className="absolute inset-4 rounded-full border border-gutter opacity-50" />
        <div className="absolute inset-16 rounded-full border border-gutter opacity-75" />
        <div className="absolute inset-28 rounded-full border border-gutter" />

        {/* Crosshairs */}
        <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-gutter opacity-50" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-gutter opacity-50" />
      </div>

      {/* Center Bright Data point */}
      <div className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gutter bg-surface shadow-sm p-3">
        <img src="/bd-logo.png" alt="Bright Data" className="h-full w-full object-contain" />
      </div>

      {/* Floating Logos */}
      {BRANDS.map((brand, i) => {
        const total = BRANDS.length
        const angle = (i / total) * Math.PI * 2 - Math.PI / 2
        // Distribute between outer (48%) and inner (30%) radius
        const radius = i % 2 === 0 ? 46 : 30
        
        const x = 50 + Math.cos(angle) * radius
        const y = 50 + Math.sin(angle) * radius

        return (
          <div
            key={brand.name}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              animation: `float ${3 + (i % 3)}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.2}s`,
            }}
          >
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gutter bg-surface p-2 shadow-sm transition-transform group-hover:scale-125 group-hover:shadow-md group-hover:z-20">
              {/* Fallback initial */}
              <span className="absolute inset-0 flex items-center justify-center font-mono text-body font-bold text-muted opacity-50 group-hover:opacity-100">
                {brand.name[0]}
              </span>
              
              {/* Using Google favicons as it's rarely blocked by adblockers */}
              <img
                src={`https://www.google.com/s2/favicons?domain=${brand.domain}&sz=128`}
                alt={brand.name}
                className="relative z-10 h-full w-full object-contain transition-transform group-hover:scale-110"
                onError={(e) => {
                  // Hide image if it fails, revealing the fallback initial
                  (e.target as HTMLImageElement).style.opacity = '0'
                }}
              />
            </div>
            
            {/* Label below */}
            <div className="absolute top-full left-1/2 mt-2 -translate-x-1/2 whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
              <span className="rounded bg-ink px-2 py-1 font-mono text-micro text-white">
                {brand.name}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
