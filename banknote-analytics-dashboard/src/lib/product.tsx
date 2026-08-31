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
import { useAuth } from '@/lib/auth';
import { canAccessPage } from '@/lib/access';

export type ProductId = string; // app id or 'compare'

/** Chart / chrome colors that stay readable on dark and light. */
export const BRAND_COLORS: Record<string, string> = {
  banknote: '#30ED9D',
  coinzy: '#c9787a',
};

export const COMPARE_COLOR = '#F0A924';
export const FALLBACK_PRODUCT_COLOR = '#94a3b8';

export function productColor(id: string, fallback = FALLBACK_PRODUCT_COLOR): string {
  return BRAND_COLORS[id] || fallback;
}

export interface ProductMeta {
  id: string;
  brand: string;
  shortName: string;
  tagline: string;
  entity: string;
  entityIdParam: string;
  ahaAction: string;
  journey: string[];
  color: string;
  logo?: string;
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
export const PRODUCT_CATALOG: Record<string, Omit<ProductMeta, 'id'>> = {
  banknote: {
    brand: 'Banknote AI',
    shortName: 'Banknote',
    tagline: 'Paper money identification & collection',
    entity: 'banknote',
    entityIdParam: 'banknote_id',
    ahaAction: 'first successful banknote scan',
    journey: [...SHARED_JOURNEY],
    appNameFilter: 'Banknote',
    color: BRAND_COLORS.banknote,
    logo: '/brands/banknote.png',
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
    color: BRAND_COLORS.coinzy,
    logo: '/brands/coinzy.png',
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
    color: api?.color || catalog?.color || productColor(id),
    logo: catalog?.logo,
  };
}

interface ProductContextValue {
  productId: ProductId;
  product: ProductMeta;
  isCompare: boolean;
  canCompare: boolean;
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
  const { user } = useAuth();
  const apiProducts = config?.products ?? [];

  const products = useMemo(() => {
    if (apiProducts.length) {
      return apiProducts.map((p) => buildProductMeta(p.id, { label: p.label, color: p.color }));
    }
    if (!user || user.isAdmin) {
      return [buildProductMeta('banknote'), buildProductMeta('coinzy')];
    }
    return user.permissions.products
      .filter((id) => id !== '*')
      .map((id) => buildProductMeta(id));
  }, [apiProducts, user]);

  const canCompare = Boolean(
    products.length >= 2 && canAccessPage(user, 'compare'),
  );

  const validIds = useMemo(() => products.map((p) => p.id), [products]);

  const [productId, setProductIdState] = useState<ProductId>(() =>
    readStoredProduct(['banknote', 'coinzy']),
  );

  useEffect(() => {
    if (!validIds.length) return;
    if (productId === 'compare' && !canCompare) {
      setProductIdState(validIds[0]);
      return;
    }
    if (productId !== 'compare' && !validIds.includes(productId)) {
      setProductIdState(validIds[0]);
    }
  }, [validIds, productId, canCompare]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-product', productId);
    const active = products.find((p) => p.id === productId);
    const color =
      productId === 'compare' ? COMPARE_COLOR : active?.color || productColor(productId);
    root.style.setProperty('--product-color', color);
    try {
      localStorage.setItem('analytics-product', productId);
    } catch {
      /* ignore */
    }
  }, [productId, products]);

  const setProductId = useCallback((id: ProductId) => {
    if (id === 'compare' && !canCompare) return;
    if (id !== 'compare' && validIds.length && !validIds.includes(id)) return;
    setProductIdState(id);
  }, [canCompare, validIds]);

  const value = useMemo(() => {
    const isCompare = productId === 'compare' && canCompare;
    const product = isCompare
      ? products[0] || buildProductMeta('banknote')
      : products.find((p) => p.id === productId) || buildProductMeta(String(productId));
    return {
      productId: isCompare ? 'compare' : product.id,
      product,
      isCompare,
      canCompare,
      products,
      setProductId,
    };
  }, [productId, products, setProductId, canCompare]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProduct() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error('useProduct must be used within ProductProvider');
  return ctx;
}
