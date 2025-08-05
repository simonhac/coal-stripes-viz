'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function OpenElectricityHeader() {
  const pathname = usePathname();
  
  const navItems = [
    { label: 'Tracker', href: 'https://explore.openelectricity.org.au', external: true },
    { label: 'Facilities', href: 'https://explore.openelectricity.org.au/facilities', external: true },
    { label: 'Scenarios', href: 'https://openelectricity.org.au/scenarios', external: true },
    { label: 'Records', href: 'https://openelectricity.org.au/records', external: true },
    { label: 'Analysis', href: 'https://openelectricity.org.au/analysis', external: true },
    { label: 'About', href: 'https://openelectricity.org.au/about', external: true },
  ];
  
  const isActive = (href: string) => {
    if (href.startsWith('http')) return false;
    return pathname === href || pathname.startsWith(href + '/');
  };
  
  return (
    <header className="border-b fixed top-0 left-0 right-0 z-50" style={{ backgroundColor: '#faf9f6', borderBottom: '1px solid #e5e5e5' }}>
      <div className="mx-auto px-4 py-3 lg:py-4" style={{ maxWidth: '1200px' }}>
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img 
              src="/openelectricity-logo.svg" 
              alt="Open Electricity"
              className="h-7 lg:h-8"
              style={{ height: '28px', width: 'auto' }}
            />
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => (
              item.external ? (
                <a
                  key={item.label}
                  href={item.href}
                  className="opennem-nav-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`opennem-nav-link ${isActive(item.href) ? 'opennem-nav-link-active' : ''}`}
                >
                  {item.label}
                </Link>
              )
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}