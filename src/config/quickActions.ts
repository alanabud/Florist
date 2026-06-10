export type QuickAction = {
  id: string;
  label: string;
  icon: string;
  description: string;
  shortcut?: string;
  type: 'modal' | 'route' | 'storeAction';
  target: string;
  group: 'Create' | 'Business';
  toast?: {
    success?: string;
    error?: string;
  };
};

export const QUICK_ACTIONS: QuickAction[] = [
  // GROUP: Create
  {
    id: 'newOrder',
    label: 'New Order',
    icon: 'ShoppingBag',
    description: 'Create a customer order or walk-in sale',
    shortcut: '⌥ N',
    type: 'modal',
    target: 'newOrder',
    group: 'Create',
    toast: { success: 'Order form initialized' }
  },
  {
    id: 'customBouquet',
    label: 'Create Bouquet',
    icon: 'Flower2',
    description: 'Start a premium arrangement build',
    shortcut: '⌥ B',
    type: 'modal',
    target: 'customBouquet',
    group: 'Create',
    toast: { success: 'Custom builder ready' }
  },
  {
    id: 'newCustomer',
    label: 'Add Customer',
    icon: 'Users',
    description: 'Add a customer to CRM profile index',
    shortcut: '⌥ C',
    type: 'modal',
    target: 'newCustomer',
    group: 'Create',
    toast: { success: 'CRM registry form opened' }
  },
  {
    id: 'newDelivery',
    label: 'Schedule Delivery',
    icon: 'Truck',
    description: 'Dispatch driver and assign route',
    shortcut: '⌥ D',
    type: 'modal',
    target: 'newDelivery',
    group: 'Create',
    toast: { success: 'Delivery planner opened' }
  },

  // GROUP: Business
  {
    id: 'newInventory',
    label: 'Restock Inventory',
    icon: 'Boxes',
    description: 'Stock raw materials and inventory stems',
    shortcut: '⌥ I',
    type: 'modal',
    target: 'newInventory',
    group: 'Business',
    toast: { success: 'Receive manifest opened' }
  },
  {
    id: 'newJournal',
    label: 'Post Journal Entry',
    icon: 'BookOpen',
    description: 'Enter a manual general ledger transaction',
    shortcut: '⌥ J',
    type: 'modal',
    target: 'newJournal',
    group: 'Business',
    toast: { success: 'Journal book ready' }
  },
  {
    id: 'exportPDF',
    label: 'Export Executive PDF',
    icon: 'FileDown',
    description: 'Generate high-fidelity business operations PDF',
    type: 'storeAction',
    target: 'exportPDF',
    group: 'Business',
    toast: { success: 'Downloading executive business PDF report...' }
  },
  {
    id: 'exportExcel',
    label: 'Export Detailed Excel',
    icon: 'FileSpreadsheet',
    description: 'Generate multi-sheet financial Excel log',
    type: 'storeAction',
    target: 'exportExcel',
    group: 'Business',
    toast: { success: 'Downloading detailed Excel workbook...' }
  },
  {
    id: 'viewLedger',
    label: 'View Ledger',
    icon: 'Landmark',
    description: 'Open general ledger and balance sheet log',
    type: 'route',
    target: '/admin/finance',
    group: 'Business'
  },
  {
    id: 'viewStorefront',
    label: 'View Storefront',
    icon: 'Store',
    description: 'Open public shop preview',
    type: 'route',
    target: '/',
    group: 'Business'
  }
];
