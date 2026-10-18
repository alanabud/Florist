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
  // Fallback for states without a configured rate — and for the checkout
  // summary before a state has been selected. This MUST stay 0: the previous
  // placeholder rate (5%) made the checkout "estimated tax" change mid-flow
  // once a real state was chosen ($3.25 at the fallback rate vs $3.00 for NY
  // in the 2026-10-17 certification audit). With 0, the estimate honestly
  // reads $0.00 until a state is selected; the state field is required and
  // the checkout dropdown only offers the configured states above, so a
  // submitted order always uses a real configured rate.
  'DEFAULT': { rate: 0, isDeliveryTaxable: false }
};

export const getTaxConfigForState = (stateCode: string): TaxConfig => {
  const normalizedCode = stateCode.trim().toUpperCase();
  return STATE_TAX_RATES[normalizedCode] || STATE_TAX_RATES['DEFAULT'];
};
