// =====================================================
// MONEY SERIALIZATION
// Postgres DECIMAL/NUMERIC arrives as a string from node-pg.
// API responses send two-decimal money as a JSON number.
// The database column type is unchanged.
// =====================================================

/**
 * CONVERT A DECIMAL STRING OR NUMBER TO A TWO-DECIMAL JSON NUMBER
 * 12.50 becomes 12.5. 19.99 stays 19.99. Null stays null.
 */
function asMoneyNumber(value) {
  if (value === null || value === undefined || value === '') {
    return value;
  }
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) {
    return value;
  }
  return Math.round(number * 100) / 100;
}

/**
 * COPY A ROW AND SERIALIZE unit_price WHEN THE COLUMN IS PRESENT
 */
function withUnitPrice(row) {
  if (!row || typeof row !== 'object' || !Object.prototype.hasOwnProperty.call(row, 'unit_price')) {
    return row;
  }
  return { ...row, unit_price: asMoneyNumber(row.unit_price) };
}

module.exports = { asMoneyNumber, withUnitPrice };
