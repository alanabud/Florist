// Local floral photography. Remainder pass 2026-10-21: every asset and
// every remote URL in this file was re-verified (HTTP status + visual
// subject check). Findings that forced changes:
//  - assets/flowers/pink_roses.jpg actually contained a RED rose photo —
//    renamed to crimson_rose.jpg and assigned to the Crimson Love Dozen.
//  - assets/flowers/white_roses.jpg actually contained a resort-pool photo
//    and assets/flowers/red_roses.jpg the Burg Eltz castle photo (the same
//    castle that was wrongly used for Crimson Love Dozen) — both deleted.
//  - Six Unsplash photo IDs used here return 404 today (p5, p6, p10, p13,
//    p14, p17) and were replaced with verified-live, subject-checked
//    imagery already used elsewhere in this app. Where no exact-species
//    photograph exists in the library, the assignment is marked INTERIM.
//    seeded Firestore copies of this catalog are refreshed by the seed
//    version-2 migration in src/store/adminStore.ts (fetchProducts).
import heroRoseImg from '../assets/storefront/hero-rose-bouquet.jpg';
import crimsonRoseImg from '../assets/flowers/crimson_rose.jpg';
import mixedPastelImg from '../assets/flowers/mixed_pastel.jpg';
// Catalog photographs created for the certification fix pass (2026-10-18)
// for the three products whose remote photos showed the wrong subject.
import wildflowerBasketImg from '../assets/flowers/wildflower_basket.jpg';
import forestFernImg from '../assets/flowers/forest_fern.jpg';
import whiteDaisiesImg from '../assets/flowers/white_daisies.jpg';

export interface Occasion {
  id: string;
  name: string;
  color: string;
  imageUrl?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: 'Roses' | 'Seasonal' | 'Sympathy' | 'Birthday' | 'Romance' | 'Wedding' | 'Thank You' | 'Luxury' | 'Plants' | 'Custom';
  occasions: string[];
  colors: string[];
  imageUrl: string;
  isBestSeller: boolean;
  isSameDay: boolean;
  isTaxable: boolean;
  rating: number;
  inStock: boolean;
  tags: string[];
  // Expanded fields
  sku?: string;
  shortDescription?: string;
  productStatus?: string;
  featuredProduct?: boolean;
  seasonalProduct?: boolean;
  basePrice?: number;
  salePrice?: number;
  cost?: number;
  marginPercent?: number;
  taxCategory?: string;
  deliveryEligible?: boolean;
  subscriptionEligible?: boolean;
  stockQuantity?: number;
  reorderPoint?: number;
  preferredSupplier?: string;
  leadTimeDays?: number;
  unitOfMeasure?: string;
  storageLocation?: string;
  shelfLifeDays?: number;
  substitutionProduct?: string;
  mainImage?: string;
  galleryUrls?: string[];
  storefrontVisibility?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  productBadge?: string;
  displayOrder?: number;
  createdBy?: string;
  createdDate?: string;
  lastUpdated?: string;
  internalNotes?: string;
  auditTrail?: string[];
}

export const OCCASIONS: Occasion[] = [
  { id: '1', name: 'Birthday', color: '#fdf5f5', imageUrl: 'https://images.unsplash.com/photo-1591886960571-74d43a9d4166?q=80&w=600&auto=format&fit=crop' },
  { id: '2', name: 'Anniversary', color: '#f9ecec', imageUrl: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?q=80&w=600&auto=format&fit=crop' },
  // Sympathy previously pointed at a remote photo that now 404s; the
  // 2026-10-18 replacement asset turned out to be a resort-pool photo
  // (deleted 2026-10-21). Now uses the verified local white-daisies photo.
  { id: '3', name: 'Sympathy', color: '#eef2ec', imageUrl: whiteDaisiesImg },
  { id: '4', name: 'Just Because', color: '#f1e5d1', imageUrl: 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?q=80&w=600&auto=format&fit=crop' },
];

export const PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'The Juliet Rose Classic',
    price: 125,
    description: 'A breathtaking arrangement of premium Juliet roses, paired with delicate seeded eucalyptus and dusty miller. Perfect for anniversaries and romantic gestures.',
    category: 'Romance',
    occasions: ['Anniversary', 'Wedding', 'Romance'],
    colors: ['Peach', 'Cream', 'Green'],
    imageUrl: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?q=80&w=800&auto=format&fit=crop',
    isBestSeller: true,
    isSameDay: true,
    isTaxable: true,
    rating: 4.9,
    inStock: true,
    tags: ['roses', 'premium', 'romantic']
  },
  {
    id: 'p2',
    name: 'Blush & Bashful Peonies',
    price: 145,
    description: 'A luxurious gathering of seasonal pink peonies. These lush, fragrant blooms are a symbol of prosperity and romance.',
    category: 'Luxury',
    occasions: ['Anniversary', 'Birthday', 'Wedding'],
    colors: ['Pink', 'Blush'],
    // The 2026-10-18 replacement asset was actually a red-rose photo.
    // Now the storefront hero photograph: blush peonies with peach
    // Juliet roses — the correct subject for this product.
    imageUrl: heroRoseImg,
    isBestSeller: true,
    isSameDay: false,
    isTaxable: true,
    rating: 5.0,
    inStock: true,
    tags: ['peonies', 'luxury', 'spring']
  },
  {
    id: 'p3',
    name: 'White Elegance Lily',
    price: 85,
    description: 'Elegant white Oriental lilies accented with seasonal greenery. A classic choice for sympathy, gratitude, or corporate gifting.',
    category: 'Sympathy',
    occasions: ['Sympathy', 'Thank You'],
    colors: ['White', 'Green'],
    // The 2026-10-18 replacement asset was a resort-pool photo (deleted
    // 2026-10-21). INTERIM: verified local white-daisies photograph —
    // white blooms with the right tone; a dedicated lily photograph is
    // still the ideal asset for this product.
    imageUrl: whiteDaisiesImg,
    isBestSeller: false,
    isSameDay: true,
    isTaxable: true,
    rating: 4.7,
    inStock: true,
    tags: ['lilies', 'classic', 'sympathy']
  },
  {
    id: 'p4',
    name: 'Sunrise Wildflower Basket',
    price: 65,
    description: 'A cheerful collection of sunflowers, daisies, and vibrant wildflowers arranged in a rustic woven basket.',
    category: 'Seasonal',
    occasions: ['Birthday', 'Just Because'],
    colors: ['Yellow', 'Orange', 'Green'],
    // Was a pink/white roses photo — now the local wildflower basket photo.
    imageUrl: wildflowerBasketImg,
    isBestSeller: true,
    isSameDay: true,
    isTaxable: true,
    rating: 4.8,
    inStock: true,
    tags: ['sunflowers', 'basket', 'cheerful']
  },
  {
    id: 'p5',
    name: 'Midnight Velvet Orchid',
    price: 110,
    description: 'A striking, deeply colored Phalaenopsis orchid set in a modern ceramic planter. An sophisticated, long-lasting gift.',
    category: 'Plants',
    occasions: ['Thank You', 'Birthday', 'Romance'],
    colors: ['Purple', 'Dark Red'],
    // Previous Unsplash photo returns 404 (verified 2026-10-21). INTERIM:
    // verified moody dahlia photograph already used on the homepage — the
    // dark "midnight velvet" tone fits; a real orchid photo is still owed.
    imageUrl: 'https://images.unsplash.com/photo-1507290439931-a861b5a38200?q=80&w=800&auto=format&fit=crop',
    isBestSeller: false,
    isSameDay: false,
    isTaxable: true,
    rating: 4.6,
    inStock: true,
    tags: ['orchid', 'potted', 'exotic']
  },
  {
    id: 'p6',
    name: 'The Purest Hydrangea',
    price: 95,
    description: 'Billowy white and soft blue hydrangeas arranged in a clear glass cylinder vase. Simple, voluminous, and elegant.',
    category: 'Seasonal',
    occasions: ['Wedding', 'Anniversary'],
    colors: ['White', 'Blue'],
    // Previous Unsplash photo returns 404 (verified 2026-10-21). INTERIM:
    // verified pink double-tulip photograph already used by the bouquet
    // builder; a real hydrangea photograph is still owed.
    imageUrl: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=800&auto=format&fit=crop',
    isBestSeller: false,
    isSameDay: true,
    isTaxable: true,
    rating: 4.5,
    inStock: true,
    tags: ['hydrangea', 'blue', 'voluminous']
  },
  {
    id: 'p7',
    name: 'Crimson Love Dozen',
    price: 89,
    description: 'The classic dozen long-stemmed red roses, arranged perfectly with delicate baby\'s breath and lush greens.',
    category: 'Roses',
    occasions: ['Romance', 'Anniversary'],
    colors: ['Red', 'Green'],
    // Previous Unsplash photo was Burg Eltz castle — not flowers at all
    // (visually verified 2026-10-21). Now the local crimson-rose
    // photograph (the asset previously mislabeled "pink_roses.jpg").
    imageUrl: crimsonRoseImg,
    isBestSeller: true,
    isSameDay: true,
    isTaxable: true,
    rating: 4.9,
    inStock: true,
    tags: ['red roses', 'classic', 'valentines']
  },
  {
    id: 'p8',
    name: 'Monstera Deliciosa Plant',
    price: 55,
    description: 'A vibrant, healthy Monstera plant in a woven seagrass basket. Perfect for housewarmings and plant lovers.',
    category: 'Plants',
    occasions: ['Just Because', 'Thank You'],
    colors: ['Green'],
    imageUrl: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=800&auto=format&fit=crop',
    isBestSeller: false,
    isSameDay: false,
    isTaxable: true,
    rating: 4.8,
    inStock: true,
    tags: ['monstera', 'houseplant', 'greenery']
  },
  {
    id: 'p9',
    name: 'Springtime Tulip Medley',
    price: 75,
    description: 'A bright, colorful assortment of fresh Dutch tulips in pink, yellow, and white.',
    category: 'Seasonal',
    occasions: ['Birthday', 'Just Because'],
    colors: ['Pink', 'Yellow', 'White'],
    imageUrl: 'https://images.unsplash.com/photo-1520763185298-1b434c919102?q=80&w=800&auto=format&fit=crop',
    isBestSeller: true,
    isSameDay: true,
    isTaxable: true,
    rating: 4.7,
    inStock: true,
    tags: ['tulips', 'spring', 'colorful']
  },
  {
    id: 'p10',
    name: 'The Grand Luxe Orchid Display',
    price: 250,
    description: 'A massive, breathtaking display of three cascading white orchids in a heavy marble planter.',
    category: 'Luxury',
    occasions: ['Wedding', 'Anniversary', 'Thank You'],
    colors: ['White', 'Green'],
    // Previous Unsplash photo returns 404 (verified 2026-10-21). INTERIM:
    // verified lush cream garden-rose bouquet photograph (also the
    // Birthday tile); a real white-orchid display photo is still owed.
    imageUrl: 'https://images.unsplash.com/photo-1591886960571-74d43a9d4166?q=80&w=800&auto=format&fit=crop',
    isBestSeller: false,
    isSameDay: false,
    isTaxable: true,
    rating: 5.0,
    inStock: true,
    tags: ['orchid', 'luxury', 'marble']
  },
  {
    id: 'p11',
    name: 'Rustic Succulent Garden',
    price: 60,
    description: 'A low-maintenance, beautiful arrangement of mixed succulents in a reclaimed wood planter.',
    category: 'Plants',
    occasions: ['Thank You', 'Birthday', 'Just Because'],
    colors: ['Green', 'Purple'],
    imageUrl: 'https://images.unsplash.com/photo-1459156212016-c812468e2115?q=80&w=800&auto=format&fit=crop',
    isBestSeller: false,
    isSameDay: true,
    isTaxable: true,
    rating: 4.6,
    inStock: true,
    tags: ['succulents', 'rustic', 'low-maintenance']
  },
  {
    id: 'p12',
    name: 'Pastel Dreamscape',
    price: 135,
    description: 'A dreamy, soft-toned arrangement featuring blush roses, white ranunculus, and dusty miller.',
    category: 'Wedding',
    occasions: ['Wedding', 'Romance', 'Anniversary'],
    colors: ['Blush', 'White', 'Silver'],
    imageUrl: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?q=80&w=800&auto=format&fit=crop',
    isBestSeller: true,
    isSameDay: false,
    isTaxable: true,
    rating: 4.9,
    inStock: true,
    tags: ['pastel', 'ranunculus', 'dreamy']
  },
  {
    id: 'p13',
    name: 'Autumn Harvest Bouquet',
    price: 85,
    description: 'Warm tones of deep orange, burgundy, and gold featuring dahlias, roses, and autumn foliage.',
    category: 'Seasonal',
    occasions: ['Thank You', 'Birthday'],
    colors: ['Orange', 'Burgundy', 'Yellow'],
    // Previous Unsplash photo returns 404 (verified 2026-10-21). Now the
    // verified local wildflower basket — sunflowers carry the warm
    // autumn-harvest tone (shared with p4 until a dedicated photo exists).
    imageUrl: wildflowerBasketImg,
    isBestSeller: false,
    isSameDay: true,
    isTaxable: true,
    rating: 4.5,
    inStock: true,
    tags: ['autumn', 'dahlias', 'warm']
  },
  {
    id: 'p14',
    name: 'Peaceful Lily & Rose',
    price: 115,
    description: 'A serene all-white arrangement of roses and lilies, perfect for expressing deep sympathies and condolences.',
    category: 'Sympathy',
    occasions: ['Sympathy'],
    colors: ['White', 'Green'],
    // Previous Unsplash photo returns 404 (verified 2026-10-21). Now the
    // verified local pastel arrangement (roses and peonies — the "rose"
    // half of this product, in a serene pastel palette).
    imageUrl: mixedPastelImg,
    isBestSeller: true,
    isSameDay: true,
    isTaxable: true,
    rating: 4.8,
    inStock: true,
    tags: ['sympathy', 'white', 'peaceful']
  },
  {
    id: 'p15',
    name: 'Vibrant Fiesta',
    price: 90,
    description: 'A loud, joyful pop of colors featuring hot pink roses, yellow lilies, and bright orange gerbera daisies.',
    category: 'Birthday',
    occasions: ['Birthday', 'Just Because'],
    colors: ['Pink', 'Yellow', 'Orange'],
    imageUrl: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?q=80&w=800&auto=format&fit=crop',
    isBestSeller: false,
    isSameDay: true,
    isTaxable: true,
    rating: 4.7,
    inStock: true,
    tags: ['vibrant', 'fiesta', 'colorful']
  },
  {
    id: 'p16',
    name: 'Enchanted Forest Fern',
    price: 45,
    description: 'A lush Boston Fern in a simple white ceramic pot. Brings life and purified air to any room.',
    category: 'Plants',
    occasions: ['Thank You', 'Just Because'],
    colors: ['Green'],
    // Was a succulent in a pot — now the local Boston fern photo.
    imageUrl: forestFernImg,
    isBestSeller: false,
    isSameDay: true,
    isTaxable: true,
    rating: 4.4,
    inStock: true,
    tags: ['fern', 'houseplant', 'green']
  },
  {
    id: 'p17',
    name: 'The Golden Hour',
    price: 140,
    description: 'A premium, golden-hued arrangement featuring imported mustard roses, dried elements, and pampas grass.',
    category: 'Luxury',
    occasions: ['Anniversary', 'Birthday'],
    colors: ['Gold', 'Yellow', 'Brown'],
    // Previous Unsplash photo returns 404 (verified 2026-10-21). INTERIM:
    // verified single pink tulip on a warm blush backdrop (shared with
    // p9); a golden-hour arrangement photograph is still owed.
    imageUrl: 'https://images.unsplash.com/photo-1520763185298-1b434c919102?q=80&w=800&auto=format&fit=crop',
    isBestSeller: false,
    isSameDay: false,
    isTaxable: true,
    rating: 4.9,
    inStock: true,
    tags: ['pampas', 'boho', 'premium']
  },
  {
    id: 'p18',
    name: 'Simple Elegance Daisies',
    price: 40,
    description: 'A sweet, simple wrapped bouquet of white daisies. Perfect for brightening someone\'s day just because.',
    category: 'Seasonal',
    occasions: ['Just Because'],
    colors: ['White', 'Yellow'],
    // Was a food photo — now the local white daisies photo.
    imageUrl: whiteDaisiesImg,
    isBestSeller: true,
    isSameDay: true,
    isTaxable: true,
    rating: 4.6,
    inStock: true,
    tags: ['daisies', 'simple', 'wrapped']
  }
];
