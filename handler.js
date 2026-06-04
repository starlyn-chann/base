import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta a la base de datos de usuarios
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Asegurar que la carpeta data exista
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Cargar base de datos - CORREGIDO: usar arreglo []
let usersDb = [];
try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    usersDb = JSON.parse(data);
    // Si por alguna razón no es un arreglo, convertirlo
    if (!Array.isArray(usersDb)) {
        console.log(chalk.yellow('⚠️ users.json no era un arreglo, reiniciando...'));
        usersDb = [];
        fs.writeFileSync(USERS_FILE, JSON.stringify(usersDb, null, 2));
    }
} catch (e) {
    console.log(chalk.yellow(`No se encontró la base de datos. Se creará una nueva.`));
    usersDb = [];
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersDb, null, 2));
}

// Función para limpiar número
function cleanNumber(number) {
    if (!number) return 'Desconocido';
    return number.replace(/@.+/, '').split(':')[0];
}

// Función para guardar usuarios
function saveUsersDb() {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(usersDb, null, 2));
        return true;
    } catch (error) {
        console.error(chalk.red('Error guardando usuarios:'), error);
        return false;
    }
}

// Calcular nivel basado en EXP
function calculateLevel(exp) {
    let level = 1;
    let expNeeded = 100;
    let currentExp = exp;
    
    while (currentExp >= expNeeded) {
        currentExp -= expNeeded;
        level++;
        expNeeded = Math.floor(100 * Math.pow(1.5, level - 1));
    }
    
    return { level, currentExp, expNeeded };
}

// Registrar usuario y actualizar EXP (SIN AVISOS)
function registerUser(msg) {
    try {
        const isGroup = msg.key.remoteJid.includes('@g.us');
        const number = isGroup 
            ? cleanNumber(msg.key.participant)
            : cleanNumber(msg.key.remoteJid);
        const pushName = msg.pushName || 'Usuario';
        const fecha = new Date().toLocaleString('es-MX');

        const userIndex = usersDb.findIndex(user => user.number === number);

        if (userIndex !== -1) {
            // Actualizar pushName si cambió
            if (usersDb[userIndex].pushName !== pushName) {
                usersDb[userIndex].pushName = pushName;
            }
            // Incrementar contador de comandos
            if (typeof usersDb[userIndex].cmds === 'undefined') {
                usersDb[userIndex].cmds = 0;
            }
            usersDb[userIndex].cmds += 1;
            
            // Actualizar EXP (sin avisos)
            if (typeof usersDb[userIndex].exp === 'undefined') {
                usersDb[userIndex].exp = 0;
            }
            if (typeof usersDb[userIndex].nivel === 'undefined') {
                usersDb[userIndex].nivel = 1;
            }
            
            // Agregar EXP (entre 200 y 500)
            const earnedExp = Math.floor(Math.random() * (500 - 200 + 1)) + 200;
            usersDb[userIndex].exp += earnedExp;
            
            // Calcular nuevo nivel
            const levelData = calculateLevel(usersDb[userIndex].exp);
            usersDb[userIndex].nivel = levelData.level;
            
        } else {
            // Nuevo usuario
            usersDb.push({ 
                pushName: pushName,
                number: number,
                nivel: 1,
                exp: 0,
                fecha: fecha,
                cmds: 1
            });
        }
        saveUsersDb();
        return number;
    } catch (err) {
        console.error(chalk.red('Error en registerUser:'), err.message);
        return null;
    }
}

// Responder con contexto del canal
async function replyWithContext(sock, msg, text, config, mentions = []) {
    try {
        const from = msg.key.remoteJid;
        
        await sock.sendMessage(from, {
            text: text,
            mentions: mentions,
            contextInfo: {
                mentionedJid: mentions,
                forwardingScore: 9999999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.canalId || '',
                    serverMessageId: 0,
                    newsletterName: config.canalNombre || ''
                }
            }
        }, { quoted: msg });
        
        return true;
    } catch (error) {
        console.error('Error enviando mensaje:', error);
        return false;
    }
}

// Handler principal
const handler = async (sock, msg, plugins, config) => {
    try {
        // Obtener el cuerpo del mensaje (soporte completo para botones)
        let body = '';
        
        if (msg.message?.conversation) {
            body = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
            body = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage?.caption) {
            body = msg.message.imageMessage.caption;
        } else if (msg.message?.videoMessage?.caption) {
            body = msg.message.videoMessage.caption;
        } else if (msg.message?.buttonsResponseMessage?.selectedButtonId) {
            body = msg.message.buttonsResponseMessage.selectedButtonId;
        } else if (msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
            body = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
        } else if (msg.message?.templateButtonReplyMessage?.selectedId) {
            body = msg.message.templateButtonReplyMessage.selectedId;
        } else if (msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
            try {
                const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
                body = params.id || '';
            } catch (e) {
                body = '';
            }
        } else if (msg.message?.interactiveResponseMessage?.selectedButtonId) {
            body = msg.message.interactiveResponseMessage.selectedButtonId;
        } else if (msg.message?.interactiveResponseMessage?.selectedRowId) {
            body = msg.message.interactiveResponseMessage.selectedRowId;
        }
        
        if (!body) return;
        
        // Determinar si es grupo
        const isGroup = msg.key.remoteJid.includes('@g.us');
        
        // Obtener número del sender
        let senderNumber;
        
        if (isGroup) {
            senderNumber = cleanNumber(msg.key.participant);
        } else {
            senderNumber = cleanNumber(msg.key.remoteJid);
        }
        
        const pushName = msg.pushName || 'Usuario';
        
        // LOG EN COLOR AZUL
        console.log(chalk.blue('╭────────────────'));
        console.log(chalk.blue(`│<⌗> Nombre: ${pushName}`));
        console.log(chalk.blue(`│<⌗> Msg: ${body.substring(0, 100)}`));
        console.log(chalk.blue(`│<⌗> Grupo: ${isGroup ? 'si' : 'no'}`));
        console.log(chalk.blue(`│<⌗> Número: ${senderNumber}`));
        console.log(chalk.blue('╰────────────────'));
        
        // Verificar si es comando (empieza con prefijo)
        if (!body.startsWith(config.prefix)) return;
        
        // Registrar usuario y contar comando (solo si no es el propio bot)
        if (!msg.key.fromMe) {
            registerUser(msg);
        }
        
        // Extraer comando y argumentos
        const args = body.slice(config.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        if (!commandName) return;
        
        // Buscar plugin (por nombre o alias)
        const plugin = plugins.get(commandName);
        
        if (!plugin) {
            console.log(chalk.yellow(`Comando no encontrado: ${commandName}`));
            await replyWithContext(sock, msg, 
                `๑ֵ݊🍀 El comando \`${config.prefix}${commandName}\` no existe.\n> Usa ${config.prefix}help para ver mis comandos`,
                config
            );
            return;
        }
        
        // Verificar si es owner
        const isOwner = config.owner && config.owner.some(ownerNum => {
            const cleanOwner = ownerNum.replace(/\D/g, '');
            return cleanOwner === senderNumber;
        });
        
        try {
            console.log(chalk.green(`🎮 Comando: ${config.prefix}${commandName} | Usuario: ${pushName} (${senderNumber})`));
            
            const startTime = Date.now();
            
            // Obtener JID del remitente para menciones
            const senderJid = isGroup ? msg.key.participant : msg.key.remoteJid;
            
            // Ejecutar plugin
            await plugin.execute(sock, msg, {
                args,
                command: commandName,
                body,
                config,
                startTime,
                isOwner,
                pushName,
                userNumber: senderNumber,
                senderJid: senderJid,
                isGroup,
                replyWithContext: (text, mentions = []) => replyWithContext(sock, msg, text, config, mentions),
                usersDb: usersDb,
                saveUsersDb: saveUsersDb
            });
            
        } catch (err) {
            console.log(chalk.red(`Error en ${commandName}:`), err.message);
            await replyWithContext(sock, msg,
                `❌ Error al ejecutar \`${config.prefix}${commandName}\`\n\n${err.message}`,
                config
            );
        }
        
    } catch (err) {
        console.log(chalk.red('Error en handler (general):'), err.message);
    }
};

export default handler;

export { 
    usersDb, 
    registerUser, 
    saveUsersDb,
    cleanNumber,
    replyWithContext,
    calculateLevel
};