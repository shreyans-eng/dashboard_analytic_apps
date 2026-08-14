import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAppConfig } from '@/hooks/useAnalytics';

export type ProductId = string; // app id or 'compare'

export interface ProductMeta {
  id: string;
  brand: string;
  shortName: string;
  tagline: string;
  entity: string;
  entityIdParam: string;
  ahaAction: string;
  journey: string[];
  color?: string;
  appNameFilter?: string;
}

export const SHARED_JOURNEY = [
  'Acquire',
  'Onboard',
  'Identify',
  'Trust',
  'Collect',
  'Limit',
  'Pro',
  'Return',
] as const;

/** Static UX metadata for known apps; unknown apps get sensible defaults. */
export const PRODUCT_CATALOG: Record<string, Omit<ProductMeta, 'id' | 'color'>> = {
  banknote: {
    brand: 'Banknote AI',
    shortName: 'Banknote',
    tagline: 'Paper money identification & collection',
    entity: 'banknote',
    entityIdParam: 'banknote_id',
    ahaAction: 'first successful banknote scan',
    journey: [...SHARED_JOURNEY],
    appNameFilter: 'Banknote',
  },
  coinzy: {
    brand: 'Coinzy',
    shortName: 'Coinzy',
    tagline: 'Coin identification & collection',
    entity: 'coin',
    entityIdParam: 'coin_id',
    ahaAction: 'first successful coin scan',
    journey: [...SHARED_JOURNEY],
    appNameFilter: 'Coinzy',
  },
};

export function buildProductMeta(
  id: string,
  api?: { label?: string; color?: string },
): ProductMeta {
  const catalog = PRODUCT_CATALOG[id];
  const label = api?.label || catalog?.shortName || id;
  return {
    id,
    brand: catalog?.brand || label,
    shortName: catalog?.shortName || label,
    tagline: catalog?.tagline || `${label} product analytics`,
    entity: catalog?.entity || 'item',
    entityIdParam: catalog?.entityIdParam || 'item_id',
    ahaAction: catalog?.ahaAction || 'first successful identify',
    journey: catalog?.journey || [...SHARED_JOURNEY],
    appNameFilter: catalog?.appNameFilter || label,
    color: api?.color,
  };
}

/** @deprecated use buildProductMeta + config.products — kept for Compare/Home copy */
export const PRODUCTS = {
  banknote: { ...buildProductMeta('banknote'), id: 'banknote' as const },
  coinzy: { ...buildProductMeta('coinzy'), id: 'coinzy' as const },
};

interface ProductContextValue {
  productId: ProductId;
  product: ProductMeta;
  isCompare: boolean;
  products: ProductMeta[];
  setProductId: (id: ProductId) => void;
}

const ProductContext = createContext<ProductContextValue | null>(null);

function readStoredProduct(validIds: string[]): ProductId {
  try {
    const stored = localStorage.getItem('analytics-product');
    if (stored && (stored === 'compare' || validIds.includes(stored))) return stored;
  } catch {
    /* ignore */
  }
  return validIds[0] || 'banknote';
}

export function ProductProvider({ children }: { children: ReactNode }) {
  const { data: config } = useAppConfig();
  const apiProducts = config?.products ?? [];

  const products = useMemo(
    () =>
      apiProducts.length
        ? apiProducts.map((p) => buildProductMeta(p.id, { label: p.label, color: p.color }))
        : [buildProductMeta('banknote'), buildProductMeta('coinzy')],
    [apiProducts],
  );

  const validIds = useMemo(() => products.map((p) => p.id), [products]);

  const [productId, setProductIdState] = useState<ProductId>(() =>
    readStoredProduct(['banknote', 'coinzy']),
  );

  useEffect(() => {
    if (!validIds.length) return;
    if (productId !== 'compare' && !validIds.includes(productId)) {
      setProductIdState(validIds[0]);
    }
  }, [validIds, productId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-product', productId);
    try {
      localStorage.setItem('analytics-product', productId);
    } catch {
      /* ignore */
    }
  }, [productId]);

  const setProductId = useCallback((id: ProductId) => setProductIdState(id), []);

  const value = useMemo(() => {
    const isCompare = productId === 'compare';
    const product = isCompare
      ? products[0] || buildProductMeta('banknote')
      : products.find((p) => p.id === productId) || buildProductMeta(String(productId));
    return {
      productId,
      product,
      isCompare,
      products,
      setProductId,
    };
  }, [productId, products, setProductId]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProduct() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error('useProduct must be used within ProductProvider');
  return ctx;
}
