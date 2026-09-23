// =====================================================
// UNIT TESTS - VALIDATION UTILITIES
// Tests for validation helper functions
// =====================================================

const {
  isValidEmail,
  isValidPassword,
  isRequired,
  isPositiveNumber,
  isInteger,
  isValidRole,
  isValidMovementType
} = require('../../utils/validation');

describe('Validation Utilities', () => {
  
  describe('isValidEmail', () => {
    test('should return true for valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });
    
    test('should return false for invalid email', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });
  
  describe('isValidPassword', () => {
    test('should return true for valid password', () => {
      expect(isValidPassword('password123')).toBe(true);
      expect(isValidPassword('123456')).toBe(true);
    });
    
    test('should return false for invalid password', () => {
      expect(isValidPassword('12345')).toBe(false);
      expect(isValidPassword('')).toBe(false);
      expect(isValidPassword(null)).toBe(false);
    });
  });
  
  describe('isRequired', () => {
    test('should return true for valid values', () => {
      expect(isRequired('text')).toBe(true);
      expect(isRequired(0)).toBe(true);
      expect(isRequired(false)).toBe(true);
    });
    
    test('should return false for invalid values', () => {
      expect(isRequired(null)).toBe(false);
      expect(isRequired(undefined)).toBe(false);
      expect(isRequired('')).toBe(false);
    });
  });
  
  describe('isPositiveNumber', () => {
    test('should return true for positive numbers', () => {
      expect(isPositiveNumber(0)).toBe(true);
      expect(isPositiveNumber(10)).toBe(true);
      expect(isPositiveNumber(99.99)).toBe(true);
      expect(isPositiveNumber('42')).toBe(true);
    });
    
    test('should return false for negative or invalid numbers', () => {
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber('abc')).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
    });
  });
  
  describe('isInteger', () => {
    test('should return true for integers', () => {
      expect(isInteger(0)).toBe(true);
      expect(isInteger(100)).toBe(true);
      expect(isInteger(-50)).toBe(true);
    });
    
    test('should return false for non-integers', () => {
      expect(isInteger(10.5)).toBe(false);
      expect(isInteger('abc')).toBe(false);
      expect(isInteger(NaN)).toBe(false);
    });
  });
  
  describe('isValidRole', () => {
    test('should return true for valid roles', () => {
      expect(isValidRole('Admin')).toBe(true);
      expect(isValidRole('User')).toBe(true);
    });
    
    test('should return false for invalid roles', () => {
      expect(isValidRole('SuperAdmin')).toBe(false);
      expect(isValidRole('admin')).toBe(false);
      expect(isValidRole('')).toBe(false);
    });
  });
  
  describe('isValidMovementType', () => {
    test('should return true for valid movement types', () => {
      expect(isValidMovementType('receive')).toBe(true);
      expect(isValidMovementType('issue')).toBe(true);
      expect(isValidMovementType('adjust')).toBe(true);
    });
    
    test('should return false for invalid movement types', () => {
      expect(isValidMovementType('transfer')).toBe(false);
      expect(isValidMovementType('Receive')).toBe(false);
      expect(isValidMovementType('')).toBe(false);
    });
  });
  
});
