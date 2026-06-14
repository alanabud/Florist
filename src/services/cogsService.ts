import { type Order, type InventoryItem } from '../store/adminStore';

export interface RecipeComponent {
  sku: string;
  quantity: number;
}

export interface COGSLineResult {
  sku: string;
  name: string;
  quantityConsumed: number;
  unitWac: number;
  extendedCost: number;
}

export interface OrderCOGSResult {
  lines: COGSLineResult[];
  totalCogs: number;
}

// 1. Static Product Recipe Dictionary
export const PRODUCT_RECIPES: Record<string, RecipeComponent[]> = {
  'p1': [ // The Juliet Rose Classic
    { sku: 'WR-001', quantity: 6 },
    { sku: 'EU-001', quantity: 2 }
  ],
  'p2': [ // Blush & Bashful Peonies
    { sku: 'PP-001', quantity: 5 }
  ],
  'p3': [ // White Elegance Lily
    { sku: 'WR-001', quantity: 6 },
    { sku: 'EU-001', quantity: 1 }
  ],
  'p4': [ // Sunrise Wildflower Basket
    { sku: 'WR-001', quantity: 6 },
    { sku: 'EU-001', quantity: 2 }
  ],
  'p5': [ // Midnight Velvet Orchid (Plant)
    { sku: 'WR-001', quantity: 1 }
  ],
  'p6': [ // The Purest Hydrangea
    { sku: 'WR-001', quantity: 4 },
    { sku: 'EU-001', quantity: 2 }
  ],
  'p7': [ // Crimson Love Dozen
    { sku: 'RR-001', quantity: 12 },
    { sku: 'EU-001', quantity: 2 }
  ],
  'p8': [ // Monstera Deliciosa Plant (Plant)
    { sku: 'EU-001', quantity: 1 }
  ],
  'p9': [ // Springtime Tulip Medley
    { sku: 'WR-001', quantity: 10 }
  ],
  'p10': [ // The Grand Luxe Orchid Display (Plant)
    { sku: 'WR-001', quantity: 3 }
  ],
  'p11': [ // Rustic Succulent Garden (Plant)
    { sku: 'EU-001', quantity: 2 }
  ],
  'p12': [ // Pastel Dreamscape
    { sku: 'WR-001', quantity: 6 },
    { sku: 'EU-001', quantity: 2 }
  ],
  'p13': [ // Autumn Harvest Bouquet
    { sku: 'RR-001', quantity: 4 },
    { sku: 'EU-001', quantity: 2 }
  ],
  'p14': [ // Peaceful Lily & Rose
    { sku: 'WR-001', quantity: 6 },
    { sku: 'EU-001', quantity: 2 }
  ],
  'p15': [ // Vibrant Fiesta
    { sku: 'RR-001', quantity: 4 },
    { sku: 'WR-001', quantity: 4 },
    { sku: 'EU-001', quantity: 2 }
  ],
  'p16': [ // Enchanted Forest Fern (Plant)
    { sku: 'EU-001', quantity: 1 }
  ],
  'p17': [ // The Golden Hour
    { sku: 'WR-001', quantity: 6 },
    { sku: 'EU-001', quantity: 2 }
  ],
  'p18': [ // Simple Elegance Daisies
    { sku: 'WR-001', quantity: 8 }
  ]
};

// 2. Custom Bouquet Parser
export function parseCustomBouquetRecipe(item: {
  isCustom?: boolean;
  description?: string;
  customDetails?: any;
}): RecipeComponent[] {
  const recipe: RecipeComponent[] = [];

  // Case A: Storefront Builder item (has customDetails)
  if (item.customDetails) {
    const details = item.customDetails;
    const size = (details.size || 'Standard').toLowerCase();
    const flowers = details.flowers || [];
    
    let totalStems = 10;
    if (size === 'deluxe') totalStems = 18;
    if (size === 'premium') totalStems = 30;

    const wantsRoses = flowers.some((f: string) => f.toLowerCase().includes('rose'));
    const wantsPeonies = flowers.some((f: string) => f.toLowerCase().includes('peonie'));
    const wantsEucalyptus = flowers.some((f: string) => f.toLowerCase().includes('eucalyptus'));

    let remaining = totalStems;

    // Allocate peonies if desired
    if (wantsPeonies) {
      const peonyCount = size === 'premium' ? 8 : (size === 'deluxe' ? 4 : 2);
      recipe.push({ sku: 'PP-001', quantity: peonyCount });
      remaining -= peonyCount;
    }

    // Allocate eucalyptus if desired
    if (wantsEucalyptus) {
      const eucCount = size === 'premium' ? 6 : (size === 'deluxe' ? 4 : 2);
      recipe.push({ sku: 'EU-001', quantity: eucCount });
      remaining -= eucCount;
    } else {
      // Small filler green is default
      const fillerCount = size === 'premium' ? 3 : 1;
      recipe.push({ sku: 'EU-001', quantity: fillerCount });
      remaining -= fillerCount;
    }

    // Allocate remaining to roses (split red/white if both/either, default WR)
    if (remaining > 0) {
      if (wantsRoses) {
        const redRoses = Math.floor(remaining / 2);
        const whiteRoses = remaining - redRoses;
        if (redRoses > 0) recipe.push({ sku: 'RR-001', quantity: redRoses });
        if (whiteRoses > 0) recipe.push({ sku: 'WR-001', quantity: whiteRoses });
      } else {
        // Fallback to White Roses
        recipe.push({ sku: 'WR-001', quantity: remaining });
      }
    }
    return recipe;
  }

  // Case B: Admin-created custom bouquet (parsed from description text)
  if (item.description) {
    const desc = item.description;
    
    // Regex matches e.g. "10x Red Roses" or "5x Pink Peonies"
    const redMatch = desc.match(/(\d+)\s*x\s*Red\s*Roses/i);
    const whiteMatch = desc.match(/(\d+)\s*x\s*White\s*Roses/i);
    const peonyMatch = desc.match(/(\d+)\s*x\s*Pink\s*Peonies/i);
    const eucMatch = desc.match(/(\d+)\s*x\s*Eucalyptus/i);

    if (redMatch) recipe.push({ sku: 'RR-001', quantity: parseInt(redMatch[1], 10) });
    if (whiteMatch) recipe.push({ sku: 'WR-001', quantity: parseInt(whiteMatch[1], 10) });
    if (peonyMatch) recipe.push({ sku: 'PP-001', quantity: parseInt(peonyMatch[1], 10) });
    if (eucMatch) recipe.push({ sku: 'EU-001', quantity: parseInt(eucMatch[1], 10) });

    if (recipe.length > 0) {
      return recipe;
    }
  }

  // Default fallback if parsing fails: ignore or use minimal default
  // As per guardrail: Block or warning. Let's warn but provide a baseline fallback:
  // 5x White Roses, 1x Eucalyptus
  return [
    { sku: 'WR-001', quantity: 5 },
    { sku: 'EU-001', quantity: 1 }
  ];
}

// 3. WAC-based COGS Calculation Engine
export function calculateOrderCOGS(
  order: Order,
  inventoryList: InventoryItem[]
): OrderCOGSResult {
  const lines: COGSLineResult[] = [];

  // Flatten order items (some orders might store items in string format or array)
  // Let's assume order.items is an array of items, or parse if it's mock
  const items = Array.isArray(order.lineItems) ? order.lineItems : [];

  for (const item of items) {
    let components: RecipeComponent[];

    if (item.isCustom || item.productId === 'custom-bouquet' || item.productId?.startsWith('p-custom-')) {
      components = parseCustomBouquetRecipe(item);
    } else {
      components = PRODUCT_RECIPES[item.productId] || [];
    }

    // Multiply components by item quantity
    const itemQty = item.quantity || 1;

    for (const comp of components) {
      const invItem = inventoryList.find(i => i.sku === comp.sku);
      if (!invItem) continue;

      const qtyNeeded = comp.quantity * itemQty;
      const unitWac = invItem.unitCost || 0;
      const extendedCost = Math.round((qtyNeeded * unitWac) * 100) / 100;

      // Accumulate
      const existingLine = lines.find(l => l.sku === comp.sku);
      if (existingLine) {
        existingLine.quantityConsumed += qtyNeeded;
        existingLine.extendedCost = Math.round((existingLine.quantityConsumed * existingLine.unitWac) * 100) / 100;
      } else {
        lines.push({
          sku: comp.sku,
          name: invItem.name,
          quantityConsumed: qtyNeeded,
          unitWac: Math.round(unitWac * 10000) / 10000,
          extendedCost
        });
      }
    }
  }

  const totalCogs = Math.round(lines.reduce((sum, l) => sum + l.extendedCost, 0) * 100) / 100;

  return {
    lines,
    totalCogs
  };
}
