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
  { id: '3', name: 'Sympathy', color: '#eef2ec', imageUrl: 'https://images.unsplash.com/photo-1508611116238-6b83f05f426c?q=80&w=600&auto=format&fit=crop' },
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
    imageUrl: 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?q=80&w=800&auto=format&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1508611116238-6b83f05f426c?q=80&w=800&auto=format&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1591886960571-74d43a9d4166?q=80&w=800&auto=format&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1508110546313-05f48866e4a2?q=80&w=800&auto=format&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1559868725-78363737b9d6?q=80&w=800&auto=format&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1506456015502-39c288fdb72d?q=80&w=800&auto=format&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1473215234509-54d90ceb7e65?q=80&w=800&auto=format&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1542458428-1f1cc7d043d8?q=80&w=800&auto=format&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=800&auto=format&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1555239121-f09bf26ea137?q=80&w=800&auto=format&fit=crop',
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
    imageUrl: 'https://images.unsplash.com/photo-1560717845-968823efbee1?q=80&w=800&auto=format&fit=crop',
    isBestSeller: true,
    isSameDay: true,
    isTaxable: true,
    rating: 4.6,
    inStock: true,
    tags: ['daisies', 'simple', 'wrapped']
  }
];
