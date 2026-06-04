import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'savefile',
    alias: [],
    category: 'owner',
    
    async execute(sock, msg, { args, config, startTime, isOwner, pushName, userNumber, isGroup, replyWithContext, isBotSelf }) {
        
        const from = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // Solo owner puede usar este comando
        if (!isOwner) {
            return await replyWithContext(`๑ֵ݊🍀 El comando \`${config.prefix}savefile\` no existe.\n> Usa ${config.prefix}help para ver mis comandos`);
        }
        
        // Verificar si se proporcionó nombre de archivo
        if (!args || args.length === 0) {
            return await replyWithContext(`💐 *Debes proporcionar el nombre de un archivo y responder a un texto*\n> *Ejemplo* » ${config.prefix}savefile plugins/ping.js\n> ${config.prefix}savefile index.js`);
        }
        
        // Verificar si se respondió a un mensaje
        if (!quoted) {
            return await replyWithContext(`💐 *Debes responder a un texto*`);
        }
        
        // Verificar si el mensaje citado es de texto
        const messageType = Object.keys(quoted)[0];
        
        if (messageType !== 'conversation' && messageType !== 'extendedTextMessage') {
            return await replyWithContext(`💐 *Debes responder a un texto*`);
        }
        
        // Obtener el texto del mensaje citado
        const texto = quoted.conversation || 
                     quoted.extendedTextMessage?.text || 
                     '';
        
        if (!texto.trim()) {
            return await replyWithContext(`💐 *El texto está vacío*`);
        }
        
        // Mostrar que está procesando
        await sock.sendPresenceUpdate('composing', from);
        
        // Obtener nombre del archivo
        const fileName = args[0];
        
        // Prevenir acceso a directorios padres
        if (fileName.includes('..')) {
            return await replyWithContext(`💐 *Nombre no válido*\n> No se permiten rutas con '..'`);
        }
        
        // Obtener la ruta base del proyecto
        const baseDir = path.resolve(__dirname, '..');
        const filePath = path.join(baseDir, fileName);
        
        // Crear directorios si no existen
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`📁 Directorio creado: ${dirPath}`);
        }
        
        // Verificar si el archivo ya existe
        const fileExists = fs.existsSync(filePath);
        
        // Guardar/actualizar el archivo
        fs.writeFileSync(filePath, texto, 'utf8');
        
        // Verificar que se guardó correctamente
        if (!fs.existsSync(filePath)) {
            throw new Error('No se pudo crear el archivo');
        }
        
        // Obtener estadísticas del archivo
        const stats = fs.statSync(filePath);
        
        // Responder según si se creó o actualizó
        if (fileExists) {
            await replyWithContext(`🌹 *Archivo Actualizado*\n\n🍃 *Nombre:* ${fileName}\n🍃 *Tamaño:* ${stats.size} bytes\n🍃 *Modificado:* ${new Date().toLocaleTimeString()}\n\n> Archivo actualizado correctamente.`);
        } else {
            await replyWithContext(`💤 *Archivo Creado*\n\n🍃 *Nombre:* ${fileName}\n🍃 *Tamaño:* ${stats.size} bytes\n🍃 *Ruta:* ${filePath}\n🍃 *Creado:* ${new Date().toLocaleTimeString()}\n\n> Archivo creado correctamente.`);
        }
        
        console.log(`✅ Archivo ${fileExists ? 'actualizado' : 'creado'}: ${fileName} por OWNER ${pushName || userNumber}`);
    }
};