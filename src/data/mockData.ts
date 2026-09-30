export interface ItemPreset {
  name: string;
  price: number;
  category: string;
}

export const ITEM_PRESETS: ItemPreset[] = [
  { name: 'Pineapple Cake', price: 450, category: 'Cake' },
  { name: 'Black Forest Cake', price: 550, category: 'Cake' },
  { name: 'Chocolate Truffle Cake', price: 650, category: 'Cake' },
  { name: 'Red Velvet Cake', price: 700, category: 'Cake' },
  { name: 'Butterscotch Cake', price: 500, category: 'Cake' },
  { name: 'Fresh Fruit Cake', price: 750, category: 'Cake' },
  { name: 'Dutch Chocolate Cake', price: 680, category: 'Cake' },
  { name: 'Vanilla Pastry (Pcs)', price: 60, category: 'Pastry' },
  { name: 'Chocolate Pastry (Pcs)', price: 80, category: 'Pastry' },
  { name: 'Cheesecake Slice', price: 150, category: 'Pastry' },
  { name: 'Custom Fondant Theme Cake', price: 1200, category: 'Custom' },
  { name: 'Barbie / Doll 3D Cake', price: 1400, category: 'Custom' },
  { name: 'Multi-Tier Wedding Cake', price: 2500, category: 'Custom' }
];

export const INITIAL_ORDERS: any[] = [];

export const INITIAL_DELIVERY_PARTNERS: any[] = [
  { id: 'p1', name: 'Ramesh Kumar', phone: '9876543210', active: true, outlet: 'Sector 31' },
  { id: 'p2', name: 'Suresh Sharma', phone: '9876543211', active: true, outlet: 'Sector 35' },
  { id: 'p3', name: 'Amit Singh', phone: '9876543212', active: true, outlet: 'Sector 42' },
  { id: 'p4', name: 'Rahul Verma', phone: '9876543213', active: true, outlet: 'Sector 88' }
];

export const INITIAL_SHEET_CONFIG = {
  sheetId: '',
  apiKey: '',
  webhookUrl: '',
  autoSync: false,
  lastSynced: null
};

export const INITIAL_ALERTS: any[] = [];

