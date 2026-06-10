export interface TaxConfig {
  rate: number;
  isDeliveryTaxable: boolean;
}

export const STATE_TAX_RATES: Record<string, TaxConfig> = {
  'CA': { rate: 0.0725, isDeliveryTaxable: false },
  'NY': { rate: 0.04, isDeliveryTaxable: true },
  'TX': { rate: 0.0625, isDeliveryTaxable: true },
  'FL': { rate: 0.06, isDeliveryTaxable: false },
  'IL': { rate: 0.0625, isDeliveryTaxable: false },
  'PA': { rate: 0.06, isDeliveryTaxable: false },
  'OH': { rate: 0.0575, isDeliveryTaxable: true },
  'GA': { rate: 0.04, isDeliveryTaxable: true },
  'NC': { rate: 0.0475, isDeliveryTaxable: true },
  'MI': { rate: 0.06, isDeliveryTaxable: false },
  // Default fallback for MVP (could be 0 for states with no sales tax like OR, DE, MT, NH, AK)
  'DEFAULT': { rate: 0.05, isDeliveryTaxable: false }
};

export const getTaxConfigForState = (stateCode: string): TaxConfig => {
  const normalizedCode = stateCode.trim().toUpperCase();
  return STATE_TAX_RATES[normalizedCode] || STATE_TAX_RATES['DEFAULT'];
};
