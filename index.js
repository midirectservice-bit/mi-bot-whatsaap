const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// --- CONFIGURACIÓN ---
const ADMIN_PHONE = '593997767840';
const VERIFY_TOKEN = 'mi_clave_secreta_123'; // Clave exacta solicitada
const ACCESS_TOKEN = process.env.ACCESS_TOKEN; 
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// --- 1. VERIFICACIÓN DEL WEBHOOK ---
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook verificado exitosamente con la clave: ' + VERIFY_TOKEN);
        res.status(200).send(challenge);
    } else {
        res.status(403).send('Token de verificación incorrecto');
    }
});

// --- 2. RECEPCIÓN DE MENSAJES ---
app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    if (!entry?.messages) return res.sendStatus(200);

    const msg = entry.messages[0];
    const from = msg.from;
    const type = msg.type;
    const text = type === 'text' ? msg.text.body : "";

    // Gestión de voz
    if (type === 'voice') {
        await enviarRespuesta(from, "Hola, gracias por su mensaje. Por políticas de calidad y para registrar correctamente su solicitud en nuestro sistema, ¿sería tan amable de escribirme brevemente lo que necesita? Así le ayudo de inmediato.");
        return res.sendStatus(200);
    }

    // Comandos Admin
    if (from === ADMIN_PHONE) {
        if (text.startsWith('[SYS_CONFIG]')) {
            baseDeConocimiento.configPendiente = text.replace('[SYS_CONFIG]', '').trim();
            await enviarRespuesta(from, "Nueva configuración recibida. ¿Confirma que desea aplicarla? (Responda: CONFIRMAR)");
            return res.sendStatus(200);
        }
        if (text.trim().toUpperCase() === 'CONFIRMAR' && baseDeConocimiento.configPendiente) {
            baseDeConocimiento.configPendiente = null;
            await enviarRespuesta(from, "Protocolo cargado. Esperando interacción.");
            return res.sendStatus(200);
        }
    }

    atenderCliente(from, text);
    res.sendStatus(200);
});

// --- LÓGICA DE ATENCIÓN ---
let baseDeConocimiento = { leads: {}, configPendiente: null };

async function atenderCliente(phone, text) {
    let lead = baseDeConocimiento.leads[phone] || { score: 0, etapa: 'saludo', data: {} };
    if (lead.etapa === 'saludo') {
        await enviarRespuesta(phone, "¿Qué servicio o solución buscaba consultar hoy?");
        lead.etapa = 'indagacion';
    } else {
        lead.score += 10;
        if (!lead.data.nombre) {
            lead.data.nombre = text;
            await enviarRespuesta(phone, "Entendido. ¿Podría indicarme en qué ciudad o sector se encuentra?");
        } else if (!lead.data.ubicacion) {
            lead.data.ubicacion = text;
            await enviarRespuesta(phone, "Excelente. ¿En qué producto o servicio específico estaba interesado?");
        }
    }
    baseDeConocimiento.leads[phone] = lead;
}

async function enviarRespuesta(to, mensaje) {
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: { messaging_product: "whatsapp", to: to, type: "text", text: { body: mensaje } }
        });
    } catch (e) { console.error("Error al enviar:", e.response?.data || e.message); }
}

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Servidor activo en puerto ${port}`));
