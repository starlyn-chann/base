import { 
    makeWASocket,
    useMultiFileAuthState, 
    DisconnectReason, 
    Browsers,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidDecode
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode-terminal';
import chalk from "chalk";
import NodeCache from 'node-cache';
import cfonts from 'cfonts';
import readlineSync from "readline-sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = await import('./config.js').then(m => m.default || m);
import handler from './handler.js';

const msgRetryCounterCache = new NodeCache();

const sessionName = "./sessions";
const methodCodeQR = process.argv.includes("--qr");
const methodCode = process.argv.includes("code") || process.argv.includes("--code");
let phoneNumber = "";
let phoneInput = "";
let opcion;

const DIGITS = (s = "") => String(s).replace(/\D/g, "");
function normalizePhoneForPairing(input) {
    let s = DIGITS(input);
    if (!s) return "";
    if (s.startsWith("0")) s = s.replace(/^0+/, "");
    if (s.length === 10 && s.startsWith("3")) s = "57" + s;
    if (s.startsWith("52") && !s.startsWith("521") && s.length >= 12) s = "521" + s.slice(2);
    if (s.startsWith("54") && !s.startsWith("549") && s.length >= 11) s = "549" + s.slice(2);
    return s;
}

// Crear carpetas necesarias
const folders = ['data', 'temp', 'sessions', 'plugins'];
folders.forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
});

// Limpiar carpeta temp
function cleanTempFolder() {
    const tempPath = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempPath)) return;
    try {
        const files = fs.readdirSync(tempPath);
        let deletedCount = 0;
        files.forEach(file => {
            const filePath = path.join(tempPath, file);
            try {
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            } catch (err) {}
        });
        if (deletedCount > 0) {
            console.log(chalk.gray(`[ 🗑️ ] Cache tmp: ${deletedCount} archivos eliminados`));
        }
    } catch (error) {}
}

function startTempCleaner() {
    cleanTempFolder();
    setInterval(() => cleanTempFolder(), 5 * 60 * 1000);
}

// Mostrar banner
console.clear();

const { say } = cfonts;
say('Roxy-Migurdia', {
    font: 'chrome',
    align: 'center',
    gradient: ['red', 'magenta']
});

say(`Powered by Moonlight Staff`, {
    font: 'console',
    align: 'center',
    gradient: ['red', 'magenta']
});

console.log(chalk.magentaBright('\n❀ Iniciando...\n'));

// Seleccionar método de conexión
if (methodCodeQR) {
    opcion = "1";
} else if (methodCode) {
    opcion = "2";
} else if (!fs.existsSync("./sessions/creds.json")) {
    console.log(chalk.bold.white("\nSeleccione una opción:"));
    console.log(chalk.blueBright("1. Con código QR"));
    console.log(chalk.cyan("2. Con código de texto de 8 dígitos"));
    opcion = readlineSync.question(chalk.bold.white("--> "));
    
    while (!/^[1-2]$/.test(opcion)) {
        console.log(chalk.bold.redBright(`No se permiten numeros que no sean 1 o 2`));
        opcion = readlineSync.question("--> ");
    }
    
    if (opcion === "2") {
        console.log(chalk.bold.redBright(`\nPor favor, Ingrese el número de WhatsApp.\n${chalk.bold.yellowBright("Ejemplo: +5219992042946")}\n${chalk.bold.magentaBright('---> ')}`));
        phoneInput = readlineSync.question("");
        phoneNumber = normalizePhoneForPairing(phoneInput);
    }
}

startTempCleaner();

let plugins = new Map();
let currentSock = null;
let reconexion = 0;
const intentos = 15;

async function cargarPlugins() {
    const pluginsDir = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
        return;
    }
    
    const pluginFiles = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    plugins.clear();
    
    for (const file of pluginFiles) {
        try {
            const filePath = path.join(pluginsDir, file);
            const fileUrl = `file://${filePath}?update=${Date.now()}`;
            const pluginModule = await import(fileUrl);
            const pluginData = pluginModule.default || pluginModule;
            
            if (pluginData.name) {
                plugins.set(pluginData.name.toLowerCase(), pluginData);
                
                if (pluginData.alias && Array.isArray(pluginData.alias)) {
                    pluginData.alias.forEach(alias => {
                        plugins.set(alias.toLowerCase(), pluginData);
                    });
                }
                console.log(chalk.green(`✅ Plugin cargado: ${pluginData.name}`));
            }
        } catch (error) {
            console.log(chalk.red(`❌ Error cargando plugin ${file}: ${error.message}`));
        }
    }
    console.log(chalk.cyan(`📦 Total: ${plugins.size} comando(s) disponibles`));
}

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionName);
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            browser: Browsers.macOS('Chrome'),
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
            },
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            msgRetryCounterCache,
        });

        currentSock = sock;
        global.client = sock;

        await cargarPlugins();

        if (opcion === "2" && !fs.existsSync("./sessions/creds.json")) {
            setTimeout(async () => {
                try {
                    if (!state.creds.registered) {
                        const pairing = await sock.requestPairingCode(phoneNumber);
                        const codeBot = pairing?.match(/.{1,4}/g)?.join("-") || pairing;
                        console.log(chalk.bold.white(chalk.bgMagenta(`\n🔢 Código de emparejamiento:`)), chalk.bold.white(chalk.white(codeBot)));
                        console.log(chalk.gray('📱 Ingresa este código en WhatsApp > Dispositivos vinculados\n'));
                    }
                } catch (err) {
                    console.log(chalk.red("Error al generar código: " + err.message));
                }
            }, 3000);
        }

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { qr, connection, lastDisconnect } = update;
            
            if (qr && (opcion === '1' || methodCodeQR)) {
                console.log(chalk.green.bold("\n[ ✿ ] Escanea este código QR\n"));
                qrcode.generate(qr, { small: true });
            }

            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode || 0;
                
                if (reason === DisconnectReason.loggedOut) {
                    console.log(chalk.red("Sesión cerrada. Eliminando..."));
                    process.exit(1);
                } else if (reason === DisconnectReason.connectionReplaced) {
                    console.log(chalk.yellow("Conexión reemplazada"));
                    return;
                } else {
                    reconexion++;
                    if (reconexion > intentos) {
                        console.log(chalk.red(`Demasiados reintentos (${intentos}). Reinicia manualmente.`));
                        process.exit(1);
                    }
                    const delay = Math.min(3000 * reconexion, 30000);
                    console.log(chalk.yellow(`Desconexión, reconectando en ${delay/1000}s...`));
                    setTimeout(() => startBot(), delay);
                }
            }

            if (connection === "open") {
                reconexion = 0;
                const userName = sock.user?.name || "Desconocido";
                console.log(chalk.green.bold(`\n[ ✿ ] Conectado a: ${userName}`));
                console.log(chalk.green(`\n✅ ${config.nombre} ${config.nombre2} lista! Usa ${config.prefix}ping para probar.\n`));
            }
        });

        sock.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const msg = chatUpdate.messages[0];
                if (!msg?.message) return;
                if (msg.key?.remoteJid === 'status@broadcast') return;
                
                // Procesar mensaje efímero
                if (Object.keys(msg.message)[0] === 'ephemeralMessage') {
                    msg.message = msg.message.ephemeralMessage.message;
                }
                
                // Ignorar mensajes del sistema
                if (msg.key.fromMe && msg.key.id.startsWith('3EB0')) return;
                
                await handler(sock, msg, plugins, config);
            } catch (err) {
                console.log(chalk.red('Error en mensaje:'), err);
            }
        });

        sock.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                const decode = jidDecode(jid) || {};
                return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
            }
            return jid;
        };

        return sock;
        
    } catch (error) {
        console.log(chalk.red(`Error: ${error.message}`));
        console.log(chalk.yellow('🔄 Reintentando en 5 segundos...'));
        setTimeout(() => startBot(), 5000);
    }
}

startBot();

process.once('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Cerrando bot...\n'));
    if (currentSock) {
        try { currentSock.end(); } catch (e) {}
    }
    process.exit(0);
});