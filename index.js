/**
 * Mokepon - Servidor Multijugador
 * 
 * Responsabilidades:
 *  - Gestionar jugadores conectados
 *  - Sincronizar posiciones en el mapa
 *  - Arbitrar el combate por turnos (fuente de verdad única)
 */

const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Constantes ──────────────────────────────────────────────────────────────

const PUERTO            = 8080;
const MAX_JUGADORES     = 20;   // Límite para evitar crecimiento ilimitado en memoria
const MAX_RONDAS_CACHE  = 50;   // Cuántas rondas guardamos en el historial antes de limpiar

// Tabla de ventajas: ataque -> a qué ataque derrota
const VENTAJAS = {
    '🔥': '🌱',
    '💧': '🔥',
    '🌱': '💧',
};

// ─── Modelos de datos ─────────────────────────────────────────────────────────

class Jugador {
    constructor(id) {
        this.id          = id;
        this.x           = 0;
        this.y           = 0;
        this.mokepon     = null;   // { nombre }
        this.enemigoId   = null;
        this.esMiTurno   = false;
        this.vidas       = 3;
        this.rondaActual = 1;
        // Registro de ataque por número de ronda: { 1: '🔥', 2: '💧', ... }
        this.ataquesPorRonda = {};
    }

    asignarMokepon(nombre)      { this.mokepon = { nombre }; }
    actualizarPosicion(x, y)   { this.x = x; this.y = y; }
}

// ─── Estado global del servidor ───────────────────────────────────────────────

const jugadores = [];

// Historial de resultados: { "idJugador_ronda": "GANASTE 🌟" | "PERDISTE 💔" | "EMPATE 🤝" }
// Se usa para que cada cliente pueda leer el resultado de su ronda reciente.
const historialCombates = {};

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Devuelve el jugador por su ID, o null si no existe. */
function buscarJugador(id) {
    return jugadores.find(j => j.id === id) ?? null;
}

/** Determina el resultado de un enfrentamiento desde la perspectiva del atacante. */
function calcularResultado(ataquePropio, ataqueRival) {
    if (ataquePropio === ataqueRival)          return 'EMPATE 🤝';
    if (VENTAJAS[ataquePropio] === ataqueRival) return 'GANASTE 🌟';
    return 'PERDISTE 💔';
}

/**
 * Limpia entradas antiguas del historial cuando supera el límite.
 * Previene el crecimiento ilimitado de memoria en sesiones largas.
 */
function limpiarHistorialSiNecesario() {
    const claves = Object.keys(historialCombates);
    if (claves.length > MAX_RONDAS_CACHE) {
        // Eliminar las entradas más antiguas (primeras en el objeto)
        claves.slice(0, claves.length - MAX_RONDAS_CACHE).forEach(k => {
            delete historialCombates[k];
        });
    }
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

/** Registra un nuevo jugador y devuelve su ID único. */
app.get('/unirse', (req, res) => {
    if (jugadores.length >= MAX_JUGADORES) {
        return res.status(503).send('Servidor lleno. Inténtalo más tarde.');
    }

    const id      = `${Math.random()}`;
    const jugador = new Jugador(id);
    jugadores.push(jugador);

    console.log(`[+] Jugador conectado: ${id}. Total: ${jugadores.length}`);
    res.send(id);
});

/** Asigna el mokepon elegido a un jugador. */
app.post('/mokepon/:jugadorId', (req, res) => {
    const jugador = buscarJugador(req.params.jugadorId);
    const nombre  = req.body.mokepon;

    if (!jugador || !nombre) {
        return res.status(400).send('Jugador no encontrado o datos incompletos.');
    }

    jugador.asignarMokepon(nombre);
    console.log(`[*] ${jugador.id} eligió: ${nombre}`);
    res.status(200).end();
});

/** Actualiza la posición del jugador en el mapa. */
app.post('/mokepon/:jugadorId/posicion', (req, res) => {
    const jugador = buscarJugador(req.params.jugadorId);

    if (!jugador) return res.status(404).end();

    jugador.actualizarPosicion(
        Number(req.body.x) || 0,
        Number(req.body.y) || 0
    );
    res.status(200).end();
});

/**
 * Registra una colisión entre dos jugadores e inicia el combate.
 * El primer turno se decide al azar si aún no se ha asignado.
 */
app.post('/mokepon/:jugadorId/colision', (req, res) => {
    const jugador = buscarJugador(req.params.jugadorId);
    const enemigo = buscarJugador(req.body.enemigoId);

    if (!jugador || !enemigo) return res.status(404).end();

    // Enlazar combatientes
    jugador.enemigoId = enemigo.id;
    enemigo.enemigoId = jugador.id;

    // Solo asignamos turno inicial si ninguno tiene turno todavía
    if (!jugador.esMiTurno && !enemigo.esMiTurno) {
        const empiezaJugador = Math.random() > 0.5;
        jugador.esMiTurno = empiezaJugador;
        enemigo.esMiTurno = !empiezaJugador;
        console.log(`[COMBATE] ${jugador.id} vs ${enemigo.id}. Empieza: ${empiezaJugador ? jugador.id : enemigo.id}`);
    }

    res.status(200).end();
});

/**
 * Endpoint principal de sincronización.
 * Devuelve la lista de enemigos visibles, el estado del turno
 * y el resultado de la última ronda completada.
 */
app.get('/mokepon/:jugadorId/enemigos', (req, res) => {
    const jugador = buscarJugador(req.params.jugadorId);

    if (!jugador) return res.status(404).json({ error: 'Jugador no encontrado' });

    const enemigos = jugadores.filter(j => j.id !== jugador.id && j.mokepon !== null);

    // Buscar el resultado de la ronda que acaba de resolverse (rondaActual - 1)
    let resultadoRonda    = null;
    let ataqueRival       = null;
    const rondaEvaluada   = jugador.rondaActual - 1;

    if (jugador.enemigoId && rondaEvaluada > 0) {
        const claveHistorial = `${jugador.id}_${rondaEvaluada}`;
        const enemigo        = buscarJugador(jugador.enemigoId);

        if (historialCombates[claveHistorial]) {
            resultadoRonda = historialCombates[claveHistorial];
            ataqueRival    = enemigo?.ataquesPorRonda[rondaEvaluada] ?? null;
        }
    }

    const enemigo = jugador.enemigoId ? buscarJugador(jugador.enemigoId) : null;

    res.json({
        enemigos,
        enemigoId:     jugador.enemigoId,
        esMiTurno:     jugador.esMiTurno,
        resultadoRonda,
        ataqueRival,
        vidasJugador:  jugador.vidas,
        vidasEnemigo:  enemigo?.vidas ?? 0,
    });
});

/**
 * Recibe el ataque del jugador y, si ambos han atacado en la misma ronda,
 * resuelve el resultado y avanza el contador de ronda.
 */
app.post('/mokepon/:jugadorId/ataque', (req, res) => {
    const jugador = buscarJugador(req.params.jugadorId);
    const ataque  = req.body.ataque;

    if (!jugador || !jugador.esMiTurno || !ataque) {
        return res.status(400).end();
    }

    const enemigo      = buscarJugador(jugador.enemigoId);
    const rondaActual  = jugador.rondaActual;

    // Guardar ataque y ceder el turno
    jugador.ataquesPorRonda[rondaActual] = ataque;
    jugador.esMiTurno = false;

    if (!enemigo) return res.status(200).end();

    const ataqueEnemigo = enemigo.ataquesPorRonda[rondaActual];

    if (ataqueEnemigo) {
        // Ambos atacaron: resolver el combate
        const resultadoJugador = calcularResultado(ataque, ataqueEnemigo);
        const resultadoEnemigo = calcularResultado(ataqueEnemigo, ataque);

        // Aplicar daño (fuente de verdad única: el servidor)
        if (resultadoJugador === 'PERDISTE 💔' && jugador.vidas > 0) jugador.vidas--;
        if (resultadoEnemigo === 'PERDISTE 💔' && enemigo.vidas > 0)  enemigo.vidas--;

        // Guardar en historial y limpiar si es necesario
        historialCombates[`${jugador.id}_${rondaActual}`] = resultadoJugador;
        historialCombates[`${enemigo.id}_${rondaActual}`] = resultadoEnemigo;
        limpiarHistorialSiNecesario();

        console.log(`[RONDA ${rondaActual}] ${jugador.id}: ${ataque} vs ${ataqueEnemigo} → ${resultadoJugador}`);

        // Avanzar ronda y dar turno al enemigo
        jugador.rondaActual++;
        enemigo.rondaActual++;
        enemigo.esMiTurno = true;

    } else {
        // El enemigo aún no atacó: es su turno
        enemigo.esMiTurno = true;
    }

    res.status(200).end();
});

// ─── Inicio ───────────────────────────────────────────────────────────────────

app.listen(PUERTO, () => {
    console.log(`\n🎮 Servidor Mokepon escuchando en http://localhost:${PUERTO}\n`);
});
