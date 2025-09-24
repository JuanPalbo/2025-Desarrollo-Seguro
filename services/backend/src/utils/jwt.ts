import jwt from 'jsonwebtoken';
//Se cambia "secreto_super_seguro" por una variable de entorno para eliminar la vulnerabilidad de credenciales embebidas
const Secreto = process.env.JWT_SECRET

const generateToken = (userId: string) => {
  return jwt.sign(
    { id: userId }, 
    Secreto, 
    { expiresIn: '1h' }
  );
};

const verifyToken = (token: string) => {
  return jwt.verify(token, Secreto);
};

export default {
  generateToken,
  verifyToken
}