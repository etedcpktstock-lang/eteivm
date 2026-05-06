import { Request, Response, NextFunction } from 'express';

/**
 * Access Level → Role mapping:
 *   4 = SUPER_ADMIN — everything, including managing other admins
 *   3 = ADMIN       — full operations + settings, but cannot edit SUPER_ADMIN
 *   2 = OFFICER     — operations (receive/issue/return/transfer/logistics)
 *   1 = STAFF       — basic operations, view own data only
 */

const ACCESS_LEVEL_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  OFFICER: 2,
  STAFF: 1,
};

/**
 * Middleware factory — requires user to have at least one of the specified roles.
 * SUPER_ADMIN (level 4) always passes regardless of role argument.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Access Denied: Not authenticated' });
    }

    const userLevel = ACCESS_LEVEL_HIERARCHY[user.role] ?? 0;

    // SUPER_ADMIN bypasses all checks
    if (userLevel >= 4) {
      return next();
    }

    // Check if user's role is in the allowed list
    const allowed = roles.some(r => {
      // Exact role match
      if (user.role === r) return true;
      // Access level match (e.g. "ADMIN" also matches role "SUPER_ADMIN" if level >= 3)
      const requiredLevel = ACCESS_LEVEL_HIERARCHY[r] ?? 0;
      return userLevel >= requiredLevel && requiredLevel > 0;
    });

    if (!allowed) {
      return res.status(403).json({
        status: 'error',
        message: `Access Denied: Requires role ${roles.join(' or ')}`,
      });
    }

    next();
  };
}

/**
 * Middleware factory — requires minimum access_level (1-4)
 */
export function requireAccessLevel(minLevel: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Access Denied: Not authenticated' });
    }

    const userLevel = ACCESS_LEVEL_HIERARCHY[user.role] ?? 0;

    if (userLevel < minLevel) {
      return res.status(403).json({
        status: 'error',
        message: `Access Denied: Requires access level ${minLevel}+`,
      });
    }

    next();
  };
}

/**
 * Helper to get access level from role name
 */
export function getAccessLevel(role: string): number {
  return ACCESS_LEVEL_HIERARCHY[role] ?? 0;
}
