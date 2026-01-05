// Firebase Authentication Middleware
let adminInstance = null;

export function setAdminInstance(admin) {
  adminInstance = admin;
}

export function authMiddleware(userStore) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    try {
      if (!adminInstance) {
        throw new Error('Firebase Admin not initialized');
      }

      // Verify Firebase ID token
      const decodedToken = await adminInstance.auth().verifyIdToken(token);
      
      // Get user profile from userStore
      const user = await userStore.getUserByFirebaseUid(decodedToken.uid);
      
      if (!user) {
        // User not in our database yet, create basic profile
        const newUser = await userStore.createOrUpdateUser({
          firebase_uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
          role: 'citizen'
        });

        req.user = {
          firebase_uid: decodedToken.uid,
          user_id: newUser.id,
          email: decodedToken.email,
          role: newUser.role,
          name: newUser.name
        };
      } else {
        req.user = {
          firebase_uid: decodedToken.uid,
          user_id: user.id,
          email: decodedToken.email,
          role: user.role,
          name: user.name
        };
      }
      
      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

// Optional auth middleware (doesn't fail if no token)
export function optionalAuthMiddleware(userStore) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      
      try {
        if (!adminInstance) {
          throw new Error('Firebase Admin not initialized');
        }

        const decodedToken = await adminInstance.auth().verifyIdToken(token);
        const user = await userStore.getUserByFirebaseUid(decodedToken.uid);
        
        if (user) {
          req.user = {
            firebase_uid: decodedToken.uid,
            user_id: user.id,
            email: decodedToken.email,
            role: user.role,
            name: user.name
          };
        }
      } catch (error) {
        // Ignore token verification errors in optional auth
        console.log('Optional auth: token verification failed');
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

