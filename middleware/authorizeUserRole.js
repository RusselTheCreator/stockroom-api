// =====================================================
// ROLE-BASED AUTHORIZATION MIDDLEWARE
// Restricts access to routes based on user role
// Must be used AFTER apiRequestJWTCheck middleware
// =====================================================

// =====================================================
// ROLE AUTHORIZATION FACTORY FUNCTION
// Returns middleware that checks if user has required role
// Usage: authorizeUserRole('Admin') or authorizeUserRole(['Admin', 'User'])
// =====================================================
function authorizeUserRole(allowedRoles) {
  // CONVERT SINGLE ROLE TO ARRAY FOR CONSISTENCY
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  // RETURN THE ACTUAL MIDDLEWARE FUNCTION
  return (req, res, next) => {
    // STEP 1: CHECK IF USER EXISTS ON REQUEST (added by JWT middleware)
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required.' 
      });
    }
    
    // STEP 2: CHECK IF USER'S ROLE IS IN ALLOWED ROLES
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied. Insufficient permissions.' 
      });
    }
    
    // STEP 3: USER HAS REQUIRED ROLE - CONTINUE
    next();
  };
}

module.exports = authorizeUserRole;
