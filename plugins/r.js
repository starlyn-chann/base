import cp, { exec as _exec } from 'child_process';
import { promisify } from 'util';

const exec = promisify(_exec).bind(cp);

export default {
    name: 'r',
    alias: ['exec', 'ejecutar'],
    category: 'owner',
    
    async execute(sock, msg, { args, config, startTime, isOwner, pushName, userNumber, isGroup, replyWithContext }) {
        
        const text = args.join(' ').trim();
        
        if (!text) {
            return await replyWithContext(`《✧》 Debes escribir un comando a ejecutar.`);
        }
        
        // Solo owner puede usar este comando
        if (!isOwner) {
            return await replyWithContext(`๑ֵ݊🍀 El comando \`${config.prefix}r\` no existe.\n> Usa ${config.prefix}help para ver mis comandos`);
        }
        
        let o;
        try {
            await sock.sendMessage(msg.key.remoteJid, { react: { text: '🕒', key: msg.key } });
            o = await exec(text);
            await sock.sendMessage(msg.key.remoteJid, { react: { text: '✔️', key: msg.key } });
        } catch (e) {
            o = e;
            await sock.sendMessage(msg.key.remoteJid, { react: { text: '✖️', key: msg.key } });
        } finally {
            const { stdout, stderr } = o;
            if (stdout?.trim()) {
                await replyWithContext(stdout);
            }
            if (stderr?.trim()) {
                await replyWithContext(stderr);
            }
        }
    }
};