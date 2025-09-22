import jwt from 'jsonwebtoken';

export function requireAuth(role = null) {
  return (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (role && payload.role !== role) return res.status(403).json({ error: 'Forbidden' });
      req.user = payload;
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
}

