// setupTests.js - Simple test setup
/**
 * Configuración Global de Tests
 * Variables de entorno y helpers para pruebas
 */

// Variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.MONGODB_URI = 'mongodb://localhost:27017/barber-shop-test';

// Helpers globales para tests
global.createMockUser = (overrides = {}) => ({
  _id: 'user123',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashedPassword',
  role: 'client',
  isActive: true,
  ...overrides
});

global.createMockBarber = (overrides = {}) => ({
  _id: 'barber123',
  name: 'Test Barber',
  user: 'user456',
  isActive: true,
  totalSales: 0,
  totalRevenue: 0,
  ...overrides
});

global.createMockSale = (overrides = {}) => ({
  _id: 'sale123',
  barber: 'barber123',
  client: 'client456',
  services: [],
  products: [],
  total: 25000,
  paymentMethod: 'cash',
  status: 'completed',
  date: new Date(),
  ...overrides
});

global.createMockProduct = (overrides = {}) => ({
  _id: 'product123',
  name: 'Test Product',
  category: 'styling',
  price: 15000,
  cost: 8000,
  stock: 20,
  minStock: 5,
  isActive: true,
  ...overrides
});

console.log('Test environment configured successfully');
