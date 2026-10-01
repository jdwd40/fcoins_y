import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../../utils/formatPrice.ts';
import { priceFlashDirection, type PriceFlashDirection } from '../../utils/priceFlash.ts';

// Unit price with a brief up/down flash when the polled value changes.
// The flash is decorative only (Delta carries direction in text) and the
// animation is disabled under prefers-reduced-motion.

interface PriceProps {
  value: number;
  /** Show the flash tint when the value changes between renders. */
  flash?: boolean;
  className?: string;
}

export function Price({ value, flash = false, className = '' }: PriceProps) {
  const previousRef = useRef<number | null>(null);
  const [flashDir, setFlashDir] = useState<PriceFlashDirection>(null);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    const dir = priceFlashDirection(previousRef.current, value);
    previousRef.current = value;
    if (flash && dir !== null) {
      setFlashDir(dir);
      setFlashKey((key) => key + 1);
    }
  }, [value, flash]);

  const flashClass = flashDir === 'up' ? 'price-flash-up' : flashDir === 'down' ? 'price-flash-down' : '';
  return (
    <span key={flashKey} className={`price-flash font-mono tnum px-0.5 ${flashClass} ${className}`.trim()}>
      {formatPrice(value)}
    </span>
  );
}
