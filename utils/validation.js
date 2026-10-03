// =====================================================
// VALIDATION UTILITY FUNCTIONS
// Reusable validators for common input patterns
// =====================================================

// =====================================================
// EMAIL VALIDATION
// Returns true if email format is valid
// =====================================================
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// =====================================================
// PASSWORD STRENGTH VALIDATION
// Minimum 6 characters (can be enhanced for production)
// =====================================================
function isValidPassword(password) {
  return !!(password && password.length >= 6);
}

// =====================================================
// REQUIRED FIELD VALIDATION
// Checks if value exists and is not empty string
// =====================================================
function isRequired(value) {
  return value !== undefined && value !== null && value !== '';
}

// =====================================================
// POSITIVE NUMBER VALIDATION
// Checks if value is a valid positive number
// =====================================================
function isPositiveNumber(value) {
  const num = Number(value);
  return !isNaN(num) && num >= 0;
}

// =====================================================
// INTEGER VALIDATION
// Checks if value is a valid integer
// =====================================================
function isInteger(value) {
  const num = Number(value);
  return Number.isInteger(num);
}

// =====================================================
// INTEGER ID VALIDATION
// Accepts a non-negative integer or a digit-only string.
// Rejects floats, booleans, and numeric strings like "1.5" or "1e2".
// =====================================================
function isIntegerId(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0;
  }
  if (typeof value === 'string') {
    return /^(0|[1-9]\d*)$/.test(value);
  }
  return false;
}

// =====================================================
// ROLE VALIDATION
// Checks if role is one of the allowed values
// =====================================================
function isValidRole(role) {
  const allowedRoles = ['Admin', 'User'];
  return allowedRoles.includes(role);
}

// =====================================================
// MOVEMENT TYPE VALIDATION
// Checks if movement type is valid
// =====================================================
function isValidMovementType(type) {
  const allowedTypes = ['receive', 'issue', 'adjust'];
  return allowedTypes.includes(type);
}

// =====================================================
// EXPORT ALL VALIDATORS
// =====================================================
module.exports = {
  isValidEmail,
  isValidPassword,
  isRequired,
  isPositiveNumber,
  isInteger,
  isIntegerId,
  isValidRole,
  isValidMovementType
};
