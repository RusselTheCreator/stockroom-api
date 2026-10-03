// =====================================================
// UNIT TESTS - AI PROVIDER
// Tests for AI provider abstraction layer
// =====================================================

const { getAIProvider } = require('../../services/aiProvider');

describe('AI Provider', () => {
  
  // SAVE ORIGINAL ENV VARS
  const originalEnv = process.env.AI_PROVIDER;
  
  afterAll(() => {
    // RESTORE ORIGINAL ENV
    process.env.AI_PROVIDER = originalEnv;
  });
  
  describe('getAIProvider', () => {
    test('should return MockProvider by default', () => {
      process.env.AI_PROVIDER = 'mock';
      const provider = getAIProvider();
      expect(provider.name).toBe('mock');
    });
    
    test('should return MockProvider for invalid provider', () => {
      process.env.AI_PROVIDER = 'invalid';
      const provider = getAIProvider();
      expect(provider.name).toBe('mock');
    });
  });
  
  describe('MockProvider', () => {
    let provider;
    
    beforeEach(() => {
      process.env.AI_PROVIDER = 'mock';
      provider = getAIProvider();
    });
    
    test('should generate reorder advice', async () => {
      const stockData = [
        {
          product_id: 1,
          product_name: 'Widget',
          sku: 'WID-001',
          warehouse_id: 1,
          warehouse_name: 'Main',
          quantity: 10,
          reorder_level: 50
        }
      ];
      
      const result = await provider.generateReorderAdvice(stockData);
      
      expect(result.provider).toBe('mock');
      expect(result.advice).toBeInstanceOf(Array);
      expect(result.advice.length).toBe(1);
      expect(result.advice[0].product_id).toBe(1);
      expect(result.advice[0].priority).toBe('MEDIUM');
    });
    
    test('should handle out-of-stock items with HIGH priority', async () => {
      const stockData = [
        {
          product_id: 2,
          product_name: 'Gadget',
          sku: 'GAD-001',
          warehouse_id: 1,
          warehouse_name: 'Main',
          quantity: 0,
          reorder_level: 20
        }
      ];
      
      const result = await provider.generateReorderAdvice(stockData);
      
      expect(result.advice[0].priority).toBe('HIGH');
    });
    

    test('should echo grounded names and counts and strip password fields', async () => {
      const context = {
        orders: {
          tracked: false,
          message: 'This application does not track purchase or sales orders.'
        },
        products: {
          count: 1,
          rows: [{ name: 'Standard Widget', sku: 'WIDGET-001', password_hash: 'should-not-leak' }]
        }
      };

      const result = await provider.answerQuestion('Any open orders?', context);

      expect(result.answer).toContain('Standard Widget');
      expect(result.answer).toContain('count 1');
      expect(result.answer).toContain('does not track purchase or sales orders');
      expect(result.answer).not.toContain('should-not-leak');
      expect(JSON.stringify(result.context_used)).not.toContain('should-not-leak');
      expect(JSON.stringify(result.context_used)).not.toMatch(/password/i);
    });

    test('should answer questions', async () => {
      const context = {
        total_products: 10,
        total_warehouses: 2,
        low_stock_count: 3
      };
      
      const result = await provider.answerQuestion('How many products?', context);
      
      expect(result.provider).toBe('mock');
      expect(result.question).toBe('How many products?');
      expect(result.answer).toContain('10 products');
      expect(result.answer).toContain('2 warehouses');
    });
  });
  
});
