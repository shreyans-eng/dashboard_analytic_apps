import { PRODUCT_CATALOG, productColor } from '@/lib/product';

interface Props {
  product: string;
  size?: number;
  className?: string;
}

export default function AppMark({ product, size = 28, className = '' }: Props) {
  const catalog = PRODUCT_CATALOG[product];
  const src = catalog?.logo;
  const alt = catalog?.shortName || product;
  const color = catalog?.color || productColor(product);

  if (!src) {
    return (
      <span
        className={`app-mark app-mark-fallback ${className}`.trim()}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(10, size * 0.42),
          background: color,
          color: '#0C2525',
        }}
        aria-hidden
      >
        {String(alt || '?').slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className={`app-mark ${className}`.trim()}
      src={src}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
    />
  );
}
