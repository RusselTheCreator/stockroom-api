// =====================================================
// JWT AUTHENTICATION MIDDLEWARE
// Validates JWT tokens from Authorization header
// Extracts user info and attaches to req.user
// =====================================================

const jwt = require('jsonwebtoken');
require('dotenv').config();

// =====================================================
// JWT VERIFICATION MIDDLEWARE
// Checks for valid Bearer token in Authorization header
// If valid, decodes token and attaches user to req.user
// If invalid or missing, returns 401 or 403 error
// =====================================================
function apiRequestJWTCheck(req, res, next) {
  // STEP 1: GET THE AUTHORIZATION HEADER FROM THE REQUEST
  const authHeader = req.headers.authorization;
  
  // STEP 2: CHECK IF AUTHORIZATION HEADER EXISTS
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Access denied. No token provided.' 
    });
  }
  
  // STEP 3: EXTRACT TOKEN FROM "Bearer <token>" FORMAT
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
  
  // STEP 4: VERIFY THE TOKEN USING JWT_SECRET
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // STEP 5: ATTACH DECODED USER INFO TO REQUEST OBJECT
    // This makes user data available in all subsequent middleware/routes
    req.user = decoded;
    
    // STEP 6: CONTINUE TO NEXT MIDDLEWARE OR ROUTE HANDLER
    next();
    
  } catch (error) {
    // STEP 7: TOKEN IS INVALID OR EXPIRED
    return res.status(403).json({ 
      error: 'Invalid or expired token.' 
    });
  }
}

module.exports = apiRequestJWTCheck;
