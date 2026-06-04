export default {
    name: 'ping',
    alias: ['speed', 'p', 'test'],
    category: 'main',
    
    async execute(sock, msg, { args, command, body, config, startTime, isOwner, pushName, userNumber, isGroup, expResult, replyWithContext }) {
        
        const velocidad = Date.now() - startTime;
        
        const response = `᠙࣭ᜒ𝆬𖤐ֵ໊ᰰ🍪໋ຼ̷̸ֹ〪⍰᜔᮫𞄳 ¡Pong!
> Velocidad: ${velocidad}ms`;
        
        await replyWithContext(response);
    }
};