/**
 * 商城购物车（T5.3 · 客户端本地状态，无服务端购物车接口）
 *
 * 技术选型：契约禁止新增依赖（无 zustand），用 React context + useReducer 自实现；
 * localStorage 持久化（key `philia.cart`），刷新/跨页一致。
 *
 * 挂载方式：App.tsx 路由表不归本任务改（只许加 4 条路由），故各商城页面自行用
 * <CartProvider> 包裹页面内容；页面切换时新挂载的 Provider 从 localStorage 还原，
 * 跨页状态天然一致，页面内则是实时 context 状态。
 *
 * 单店限制（对齐服务端 mall.createOrder 的 BAD_REQUEST「一次下单仅支持同一门店」）：
 * addItem 检测到车内已有其他门店商品时返回 'conflict' 且不改状态，
 * 由 UI 弹确认「购物车仅限同一门店商品，将清空原购物车？」，确认后调 replaceWith。
 */

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'philia.cart';

/** 单行最大数量（与服务端 createOrder qty ≤ 99 对齐） */
export const MAX_QTY = 99;

export interface CartItem {
  productId: string;
  storeId: string;
  storeName: string;
  name: string;
  /** 加入时单价快照（分）；下单金额由服务端重算，此处仅展示 */
  priceFen: number;
  image: string | null;
  /** 加入时库存快照，用于步进器上限提示 */
  stock: number;
  qty: number;
  checked: boolean;
}

/** 加车入参（qty 缺省 1） */
export interface AddInput {
  productId: string;
  storeId: string;
  storeName: string;
  name: string;
  priceFen: number;
  image: string | null;
  stock: number;
  qty?: number;
}

export type AddResult = 'ok' | 'conflict';

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'add'; input: Required<AddInput> }
  | { type: 'replaceWith'; input: Required<AddInput> }
  | { type: 'setQty'; productId: string; qty: number }
  | { type: 'remove'; productId: string }
  | { type: 'toggle'; productId: string }
  | { type: 'toggleAll'; checked: boolean }
  | { type: 'clearChecked' }
  | { type: 'clearAll' };

/** 数量收敛：1 ~ min(stock, 99)；stock ≤ 0 时允许 1（由结算时服务端拦截，展示「库存不足」） */
function clampQty(qty: number, stock: number): number {
  const cap = Math.max(1, Math.min(stock, MAX_QTY));
  return Math.max(1, Math.min(Math.round(qty), cap));
}

function toItem(input: Required<AddInput>, checked: boolean): CartItem {
  return {
    productId: input.productId,
    storeId: input.storeId,
    storeName: input.storeName,
    name: input.name,
    priceFen: input.priceFen,
    image: input.image,
    stock: input.stock,
    qty: clampQty(input.qty, input.stock),
    checked,
  };
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const idx = state.items.findIndex((it) => it.productId === action.input.productId);
      if (idx >= 0) {
        const items = state.items.slice();
        const cur = items[idx]!;
        // 同商品合并数量（对齐服务端 createOrder 的多行合并语义）
        items[idx] = {
          ...cur,
          qty: clampQty(cur.qty + action.input.qty, cur.stock),
          checked: true,
        };
        return { items };
      }
      return { items: [...state.items, toItem(action.input, true)] };
    }
    case 'replaceWith':
      return { items: [toItem(action.input, true)] };
    case 'setQty': {
      const items = state.items.map((it) =>
        it.productId === action.productId ? { ...it, qty: clampQty(action.qty, it.stock) } : it,
      );
      return { items };
    }
    case 'remove':
      return { items: state.items.filter((it) => it.productId !== action.productId) };
    case 'toggle':
      return {
        items: state.items.map((it) =>
          it.productId === action.productId ? { ...it, checked: !it.checked } : it,
        ),
      };
    case 'toggleAll':
      return { items: state.items.map((it) => ({ ...it, checked: action.checked })) };
    case 'clearChecked':
      return { items: state.items.filter((it) => !it.checked) };
    case 'clearAll':
      return { items: [] };
    default:
      return state;
  }
}

/** localStorage 还原（形状校验，坏数据静默丢弃） */
function loadInitial(): CartState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return { items: [] };
    const items: CartItem[] = [];
    for (const it of parsed.items) {
      const o = it as Partial<CartItem> | null;
      if (
        o &&
        typeof o.productId === 'string' &&
        typeof o.storeId === 'string' &&
        typeof o.name === 'string' &&
        typeof o.priceFen === 'number' &&
        typeof o.qty === 'number'
      ) {
        items.push({
          productId: o.productId,
          storeId: o.storeId,
          storeName: typeof o.storeName === 'string' ? o.storeName : '门店',
          name: o.name,
          priceFen: o.priceFen,
          image: typeof o.image === 'string' ? o.image : null,
          stock: typeof o.stock === 'number' ? o.stock : MAX_QTY,
          qty: clampQty(o.qty, typeof o.stock === 'number' ? o.stock : MAX_QTY),
          checked: o.checked !== false,
        });
      }
    }
    return { items };
  } catch {
    return { items: [] };
  }
}

export interface CartApi {
  items: CartItem[];
  /** 角标数量（总件数） */
  count: number;
  /** 车内门店（空车为 null） */
  storeId: string | null;
  checkedItems: CartItem[];
  checkedTotalFen: number;
  allChecked: boolean;
  /** 加车；车内已有其他门店商品时返回 'conflict' 且不改状态 */
  addItem(input: AddInput): AddResult;
  /** 跨店确认后：清空原购物车并加入本商品 */
  replaceWith(input: AddInput): void;
  setQty(productId: string, qty: number): void;
  remove(productId: string): void;
  toggle(productId: string): void;
  toggleAll(checked: boolean): void;
  /** 下单成功后移除已结算的勾选项 */
  clearChecked(): void;
  clearAll(): void;
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  // 持久化：任何状态变化写回 localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 隐私模式等写失败：退化为纯内存购物车
    }
  }, [state]);

  const api = useMemo<CartApi>(() => {
    const items = state.items;
    const checkedItems = items.filter((it) => it.checked);
    return {
      items,
      count: items.reduce((n, it) => n + it.qty, 0),
      storeId: items[0]?.storeId ?? null,
      checkedItems,
      checkedTotalFen: checkedItems.reduce((sum, it) => sum + it.priceFen * it.qty, 0),
      allChecked: items.length > 0 && items.every((it) => it.checked),
      addItem(input) {
        const full: Required<AddInput> = { ...input, qty: input.qty ?? 1 };
        const foreign = items.some((it) => it.storeId !== full.storeId);
        if (foreign) return 'conflict';
        dispatch({ type: 'add', input: full });
        return 'ok';
      },
      replaceWith(input) {
        dispatch({ type: 'replaceWith', input: { ...input, qty: input.qty ?? 1 } });
      },
      setQty(productId, qty) {
        dispatch({ type: 'setQty', productId, qty });
      },
      remove(productId) {
        dispatch({ type: 'remove', productId });
      },
      toggle(productId) {
        dispatch({ type: 'toggle', productId });
      },
      toggleAll(checked) {
        dispatch({ type: 'toggleAll', checked });
      },
      clearChecked() {
        dispatch({ type: 'clearChecked' });
      },
      clearAll() {
        dispatch({ type: 'clearAll' });
      },
    };
  }, [state]);

  return createElement(CartContext.Provider, { value: api }, children);
}

/** 取购物车 API；必须在 <CartProvider> 内使用 */
export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart 必须在 <CartProvider> 内使用');
  return ctx;
}
