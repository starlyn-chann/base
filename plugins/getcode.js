import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'getcode',
    alias: [],
    category: 'owner',
    
    async execute(sock, msg, { args, config, startTime, isOwner, pushName, userNumber, isGroup, replyWithContext, isBotSelf }) {
        
        const from = msg.key.remoteJid;
        
        // Solo owner puede usar este comando
        if (!isOwner) {
            return await replyWithContext(`๑ֵ݊🍀 El comando \`${config.prefix}getcode\` no existe.\n> Usa ${config.prefix}help para ver mis comandos`);
        }
        
        // Verificar que se proporcionó un nombre de archivo
        if (!args || args.length === 0) {
            return await replyWithContext(`🌾 *Debes proporcionar el nombre de un archivo*\n\n> Ejemplo: ${config.prefix}getcode plugins/ping.js\n> Ejemplo: ${config.prefix}getcode handler.js`);
        }
        
        const fileName = args[0].trim();
        
        // Obtener ruta base (directorio raíz del proyecto)
        const baseDir = path.resolve(__dirname, '..');
        let filePath;
        
        // Si el archivo tiene una ruta relativa
        if (fileName.includes('/') || fileName.includes('\\')) {
            filePath = path.join(baseDir, fileName);
        } else {
            // Buscar en diferentes carpetas comunes
            const possiblePaths = [
                path.join(baseDir, fileName),
                path.join(baseDir, 'plugins', fileName),
                path.join(baseDir, 'lib', fileName),
                path.join(baseDir, 'utils', fileName),
                path.join(baseDir, 'handlers', fileName),
                path.join(baseDir, 'data', fileName),
                path.join(baseDir, 'temp', fileName)
            ];
            
            // Encontrar la primera ruta que existe
            for (const possiblePath of possiblePaths) {
                if (fs.existsSync(possiblePath) && fs.statSync(possiblePath).isFile()) {
                    filePath = possiblePath;
                    break;
                }
            }
            
            // Si no se encontró, usar la ruta en plugins
            if (!filePath) {
                filePath = path.join(baseDir, 'plugins', fileName);
            }
        }
        
        // Verificar si el archivo existe
        if (!fs.existsSync(filePath)) {
            return await replyWithContext(`🌴 *El archivo* \`${fileName}\` *no existe*\n\n📁 *Rutas buscadas:*\n- plugins/${fileName}\n- lib/${fileName}\n- data/${fileName}\n- ${fileName}`);
        }
        
        // Verificar que sea un archivo
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            return await replyWithContext(`🌴 *${fileName}* no es un archivo válido`);
        }
        
        // Verificar tamaño del archivo (máx 5MB)
        const fileSizeMB = stats.size / (1024 * 1024);
        if (fileSizeMB > 5) {
            return await replyWithContext(`🌴 *El archivo es demasiado grande* (${fileSizeMB.toFixed(2)}MB)\n> Máximo permitido: 5MB`);
        }
        
        // Leer el contenido del archivo
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Enviar el código usando replyWithContext
        await replyWithContext(fileContent);
        
        console.log(`📄 Archivo enviado: ${filePath} (${stats.size} bytes) por OWNER ${pushName || userNumber}`);
    }
};