// =====================================================
// REQUEST LOGGER MIDDLEWARE
// Logs all incoming HTTP requests with method and URL
// =====================================================

// =====================================================
// LOGGER FUNCTION
// Logs the HTTP method and URL for every request
// Then calls next() to continue to the next middleware
// =====================================================
function logger(req, res, next) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
}

module.exports = logger;
