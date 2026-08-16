import { useId } from 'react';

export function BrandMark({ size = 52, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`ch-${id}`} x1="8" y1="4" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F6EF7" />
          <stop offset="1" stopColor="#37B7FF" />
        </linearGradient>
      </defs>
      <rect width="56" height="56" rx="16" fill={`url(#ch-${id})`} />
      <path
        d="M18 22.5c0-3.2 2.5-5.5 6.1-5.5 2.3 0 4.1.8 5.2 2.2l-2.3 2.1c-.7-.8-1.7-1.3-2.9-1.3-1.8 0-3 1.2-3 2.5 0 1.3 1.2 2.5 3 2.5h2.2v3H21.1c-1.8 0-3 1.2-3 2.6 0 1.4 1.2 2.6 3.1 2.6 1.3 0 2.3-.5 3-1.4l2.3 2.1c-1.2 1.5-3.1 2.4-5.4 2.4-3.8 0-6.3-2.4-6.3-5.6 0-1.9 1.1-3.5 2.8-4.3C19.1 25.7 18 24.2 18 22.5Z"
        fill="white"
      />
      <path d="M32.2 17h3.3v9.2H40.8v3h-5.3V39h-3.3V17Z" fill="white" />
      <circle cx="43.2" cy="42.2" r="8.2" fill="#0B1B33" />
      <path d="M39.8 42.3 42 44.5l4.8-5.2" stroke="#7CFFC2" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
