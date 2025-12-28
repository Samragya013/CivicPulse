// JWT Authentication Middleware
export function authMiddleware(userStore) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    const decoded = userStore.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user info to request
    req.user = decoded;
    next();
  };
}

// Optional auth middleware (doesn't fail if no token)
export function optionalAuthMiddleware(userStore) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = userStore.verifyToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }

    next();
  };
}

// Admin-only middleware (requires auth + admin role)
export function adminOnlyMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}
