import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'eteivm-secret-change-in-production-2026'

declare global {
  namespace Express {
    interface Request {
      user?: any
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Access Denied: No Token Provided' })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ status: 'error', message: 'Access Denied: Invalid Token' })
    }
    req.user = user
    next()
  })
}
