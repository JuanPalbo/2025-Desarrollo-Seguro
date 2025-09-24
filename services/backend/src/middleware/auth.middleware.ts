import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
//Se cambia "secreto_super_seguro" por una variable de entorno para eliminar la vulnerabilidad de credenciales embebidas
const Secreto = process.env.JWT_SECRET

interface JwtPayload {
  id: string;
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, Secreto);
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export default authenticateJWT;