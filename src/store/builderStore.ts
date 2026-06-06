import { create } from 'zustand';

export interface CustomBouquetState {
  occasion: string;
  colorPalette: string;
  flowers: string[];
  size: 'Standard' | 'Deluxe' | 'Premium' | null;
  budget: number;
  deliveryDate: string;
  message: string;
}

const initialState: CustomBouquetState = {
  occasion: '',
  colorPalette: '',
  flowers: [],
  size: null,
  budget: 0,
  deliveryDate: '',
  message: '',
};

interface BuilderStore {
  state: CustomBouquetState;
  updateField: <K extends keyof CustomBouquetState>(field: K, value: CustomBouquetState[K]) => void;
  reset: () => void;
}

export const useBuilderStore = create<BuilderStore>((set) => ({
  state: initialState,
  updateField: (field, value) => set((store) => ({
    state: { ...store.state, [field]: value }
  })),
  reset: () => set({ state: initialState }),
}));
