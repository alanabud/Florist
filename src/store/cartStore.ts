import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string; // unique ID for the cart item (since custom bouquets might have different configurations but same product ID)
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  isCustom?: boolean;
  customDetails?: unknown;
  isTaxable?: boolean;
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getTaxableSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,

      addItem: (item) => {
        set((state) => {
          // If it's a standard product, check if it already exists
          if (!item.isCustom) {
            const existingItem = state.items.find(i => i.productId === item.productId && !i.isCustom);
            if (existingItem) {
              return {
                items: state.items.map(i => 
                  i.id === existingItem.id 
                    ? { ...i, quantity: i.quantity + item.quantity }
                    : i
                ),
                isDrawerOpen: true,
              };
            }
          }
          
          // Otherwise, add as new item
          const newItem = { ...item, id: crypto.randomUUID() };
          return {
            items: [...state.items, newItem],
            isDrawerOpen: true,
          };
        });
      },

      removeItem: (id) => set((state) => ({
        items: state.items.filter(item => item.id !== id)
      })),

      updateQuantity: (id, quantity) => set((state) => {
        if (quantity <= 0) {
          return { items: state.items.filter(item => item.id !== id) };
        }
        return {
          items: state.items.map(item => item.id === id ? { ...item, quantity } : item)
        };
      }),

      clearCart: () => set({ items: [] }),

      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
      },

      getTaxableSubtotal: () => {
        return get().items.reduce((total, item) => {
          // If isTaxable is explicitly false, it's non-taxable, otherwise default true
          const isTaxable = item.isTaxable !== false;
          return isTaxable ? total + (item.price * item.quantity) : total;
        }, 0);
      }
    }),
    {
      name: 'bloompro-cart',
      partialize: (state) => ({ items: state.items }), // Only persist items, not drawer state
    }
  )
);
