const express = require('express');
const app = express();
app.use(express.json());

const ADMIN_PHONE = '593997767840';
let baseDeConocimiento = { leads: {}, configPendiente: null };

// --- ENDPOINT WEBHOOK ---
app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    if (!entry?.messages) return res.sendStatus(200);

    const msg = entry.messages[0];
    const from = msg.from;
    const type = msg.type;
    const text = type === 'text' ? msg.text.body : "";

    // 1. MANEJO DE VOZ (Seguridad y Calidad)
    if (type === 'voice') {
        enviarRespuesta(from, "Hola, gracias por su mensaje. Por políticas de calidad y para registrar correctamente su solicitud en nuestro sistema, ¿sería tan amable de escribirme brevemente lo que necesita? Así le ayudo de inmediato.");
        return res.sendStatus(200);
    }

    // 2. COMANDOS DE ADMINISTRADOR
    if (from === ADMIN_PHONE) {
        if (text.startsWith('[SYS_CONFIG]')) {
            baseDeConocimiento.configPendiente = text.replace('[SYS_CONFIG]', '').trim();
            enviarRespuesta(from, "Nueva configuración recibida. ¿Confirma que desea aplicarla? (Responda: CONFIRMAR)");
            return res.sendStatus(200);
        }
        if (text === 'CONFIRMAR' && baseDeConocimiento.configPendiente) {
            console.log("Sistema actualizado:", baseDeConocimiento.configPendiente);
            baseDeConocimiento.configPendiente = null;
            enviarRespuesta(from, "Protocolo cargado. Esperando interacción.");
            return res.sendStatus(200);
        }
        if (text.startsWith('/resumen')) {
            generarReporte(from, text.split(' ')[1]);
            return res.sendStatus(200);
        }
    }

    // 3. LÓGICA DE ATENCIÓN (Máquina de Estados)
    atenderCliente(from, text);
    res.sendStatus(200);
});

function atenderCliente(phone, text) {
    let lead = baseDeConocimiento.leads[phone] || { score: 0, etapa: 'saludo', data: {} };

    // Lógica consultiva gradual
    if (lead.etapa === 'saludo') {
        enviarRespuesta(phone, "¿Qué servicio o solución buscaba consultar hoy?");
        lead.etapa = 'indagacion';
    } else {
        // Calificación invisible + Indagación natural
        lead.score += 10; 
        if (!lead.data.nombre) {
            lead.data.nombre = text;
            enviarRespuesta(phone, "Perfecto, ¿en qué ciudad o sector se encuentra?");
        } else if (!lead.data.ubicacion) {
            lead.data.ubicacion = text;
            enviarRespuesta(phone, "Entendido. ¿Me indica el producto o servicio específico que requiere?");
        }
        // ... (Aquí se extendería a los niveles 2 y 3)
    }

    baseDeConocimiento.leads[phone] = lead;
    if (lead.score > 80) enviarReporte(ADMIN_PHONE, lead);
}

// --- FUNCIONES AUXILIARES ---
function enviarRespuesta(to, mensaje) {
    // Aquí insertarías tu llamada a la API de Meta (axios.post...)
    console.log(`Enviando a ${to}: ${mensaje}`);
}

function generarReporte(admin, nombre) {
    // Lógica de resumen solicitada
    console.log(`Reporte generado para ${nombre}`);
}

app.listen(process.env.PORT || 3000, () => console.log('Bot activo.'));
