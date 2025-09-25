// src/services/fileService.ts
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import db from '../db';

const unlink = promisify(fs.unlink);

// Funcion auxiliar para tener un directorio seguro para almacenar los uploads de archivos
const UPLOADS_DIR = path.resolve("uploads");

function getSafePath(filePath: string): string {
  const resolvedPath = path.resolve(filePath); // Convierte cualquier file path ingresado a una ruta absoluta
  if (!resolvedPath.startsWith(UPLOADS_DIR)) {
    throw new Error("Invalid file path"); // Si el path absoluto no empieza con el directorio de uploads se lanza un error y no se continua
  }
  return resolvedPath;
}



class FileService {
  static async saveProfilePicture(
    userId: string,
    file: any //Express.Multer.File
  ): Promise<string> {
    const user = await db('users')
      .select('picture_path')
      .where({ id: userId })
      .first();
    if (!user) throw new Error('User not found');

    if (user.picture_path) {
      //try { await unlink(path.resolve(user.picture_path)); } catch { /*ignore*/ }
      try { await unlink(getSafePath(user.picture_path)); } catch { /*ignore*/ } // Se usa la funcion aux definida arriba para asegurar que el path es seguro
    }


    await db('users')
      .update({ picture_path:  getSafePath(file.path) }) // Se usa la funcion aux definida arriba para asegurar que el path almacenado en la bd este chequeado
      .where({ id: userId });

    return `${process.env.API_BASE_URL}/uploads/${path.basename(file.path)}`;
  }

  static async getProfilePicture(userId: string) {
    const user = await db('users')
      .select('picture_path')
      .where({ id: userId })
      .first();
    if (!user || !user.picture_path) throw new Error('No profile picture');

    const filePath = user.picture_path;
    const stream   = fs.createReadStream(filePath);
    const ext      = path.extname(filePath).toLowerCase();
    const contentType =
      ext === '.png'  ? 'image/png'  :
      ext === '.jpg'  ? 'image/jpeg' :
      ext === '.jpeg'? 'image/jpeg' : 
      'application/octet-stream';

    return { stream, contentType };
  }

  static async deleteProfilePicture(userId: string) {
    const user = await db('users')
      .select('picture_path')
      .where({ id: userId })
      .first();
    if (!user || !user.picture_path) throw new Error('No profile picture');

    //try { await unlink(path.resolve(user.picture_path)); } catch { /*ignore*/ }
    try { await unlink(getSafePath(user.picture_path)); } catch { /*ignore*/ } // Se usa la funcion aux definida arriba para asegurar que el path es seguro

    await db('users')
      .update({ picture_path: null })
      .where({ id: userId });
  }
}

export default FileService;
