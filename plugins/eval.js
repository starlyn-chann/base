import syntaxerror from 'syntax-error';
import { format } from 'util';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(__dirname);

export default {
    name: 'eval',
    alias: ['e', 'ev'],
    category: 'owner',
    
    async execute(sock, msg, { args, config, startTime, isOwner, pushName, userNumber, isGroup, replyWithContext }) {
        
        const from = msg.key.remoteJid;
        
        // Solo owner puede usar este comando
        if (!isOwner) {
            return await replyWithContext(`๑ֵ݊🍀 El comando \`${config.prefix}eval\` no existe.\n> Usa ${config.prefix}help para ver mis comandos`);
        }
        
        // Verificar si se proporcionó código
        if (!args || args.length === 0) {
            return await replyWithContext(`🌺 *Uso:* ${config.prefix}eval <codigo>\n\n> Ejemplo: ${config.prefix}eval console.log("Hola mundo")`);
        }
        
        // Mostrar que está procesando
        await sock.sendPresenceUpdate('composing', from);
        
        let code = args.join(' ').trim();
        
        // Agregar return automáticamente si es expresión simple
        if (!code.includes('return') && !code.includes(';') && !code.includes('\n')) {
            code = 'return ' + code;
        }
        
        let result;
        let syntax = '';
        
        try {
            // Definir AsyncFunction para permitir await
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            
            // Obtener el remitente citado
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
            const qsender = quotedMsg?.participant || userNumber;
            
            // Crear objeto m para compatibilidad
            const m = {
                chat: from,
                sender: userNumber,
                from: from,
                msg: msg,
                pushName: pushName,
                isGroup: isGroup
            };
            
            // Determinar si es el bot mismo
            const forMe = msg.key?.fromMe || false;
            const jid = from;
            
            // Cargar usersDb si existe
            let usersDB = {};
            try {
                const { usersDb } = await import('../handler.js');
                usersDB = usersDb;
            } catch (e) {}
            
            // Crear función con los parámetros disponibles
            const fn = new AsyncFunction(
                'sock', 'msg', 'args', 'config', 'usersDB', 'sender', 'pushName', 'from', 'qsender', 'require', 'format', 'syntaxerror', 'm', 'forMe', 'jid', 'replyWithContext',
                `try {
                    ${code}
                } catch(e) {
                    throw e;
                }`
            );
            
            // Ejecutar con todos los parámetros
            result = await fn(
                sock, msg, args, config, usersDB, userNumber, pushName, from, qsender, require, format, syntaxerror, m, forMe, jid, replyWithContext
            );
            
        } catch (err) {
            // Verificar error de sintaxis
            const syn = syntaxerror(code, 'Eval', {
                allowReturnOutsideFunction: true,
                allowAwaitOutsideFunction: true
            });
            
            if (syn) {
                syntax = '```' + syn + '```\n\n';
            }
            
            result = err;
        }
        
        // Formatear resultado
        let output = '';
        if (result !== undefined && result !== null) {
            if (typeof result === 'object' || typeof result === 'function') {
                try {
                    output = format(result, { depth: 2 });
                } catch (e) {
                    output = String(result);
                }
            } else {
                output = String(result);
            }
        } else {
            output = 'Ejecutado sin retorno';
        }
        
        // Limitar longitud del resultado
        if (output.length > 4000) {
            output = output.substring(0, 4000) + '\n\n... (resultado truncado)';
        }
        
        // Enviar resultado usando replyWithContext
        await replyWithContext(syntax + '```\n' + output + '\n```');
        
        console.log(`✅ Eval ejecutado por OWNER: ${pushName || userNumber}`);
        console.log(`📝 Código: ${code.substring(0, 100)}${code.length > 100 ? '...' : ''}`);
    }
};