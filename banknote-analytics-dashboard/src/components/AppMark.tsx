const MARK: Record<string, { src: string; alt: string }> = {
  banknote: { src: '/brands/banknote.png', alt: 'Banknote' },
  coinzy: { src: '/brands/coinzy.png', alt: 'Coinzy' },
};

interface Props {
  product: string;
  size?: number;
  className?: string;
}

export default function AppMark({ product, size = 28, className = '' }: Props) {
  const mark = MARK[product];
  if (!mark) {
    return (
      <span
        className={`app-mark app-mark-fallback ${className}`.trim()}
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.42) }}
        aria-hidden
      >
        {String(product || '?').slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className={`app-mark ${className}`.trim()}
      src={mark.src}
      alt={mark.alt}
      width={size}
      height={size}
      draggable={false}
    />
  );
}
