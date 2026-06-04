/**
 * Mokepon - Lógica del Cliente
 *
 * Estructura:
 *  1. Configuración y datos del juego
 *  2. Clase Mokepon
 *  3. Estado de la aplicación (centralizado)
 *  4. Referencias al DOM
 *  5. Inicialización
 *  6. Flujo de selección de mascota
 *  7. Motor gráfico (canvas)
 *  8. Red - comunicación con el servidor
 *  9. Combate
 * 10. Controles de movimiento
 */

// ─── 1. Configuración y datos ─────────────────────────────────────────────────

const API_URL     = 'http://localhost:8080';
const VELOCIDAD   = 5;   // Píxeles por frame de movimiento
const FPS_CANVAS  = 50;  // Milisegundos entre frames del canvas (20fps)
const POLL_RED    = 500; // Milisegundos entre consultas al servidor

/**
 * Catálogo de mokepones disponibles.
 * Los ataques representan la distribución de movimientos del personaje:
 * más de un tipo = mayor frecuencia de ese elemento.
 */
const CATALOGO_MOKEPONES = [
    {
        nombre:   'Hipodoge',
        img:      './assets/mokepons_mokepon_hipodoge_attack.png',
        fotoMapa: './assets/hipodoge.png',
        ataques:  ['💧', '💧', '💧', '🔥', '🌱'],
        mapaX:    130,
        mapaY:    320,
    },
    {
        nombre:   'Capipepo',
        img:      './assets/mokepons_mokepon_capipepo_attack.png',
        fotoMapa: './assets/capipepo.png',
        ataques:  ['🌱', '🌱', '🌱', '💧', '🔥'],
        mapaX:    415,
        mapaY:    280,
    },
    {
        nombre:   'Ratigueya',
        img:      './assets/mokepons_mokepon_ratigueya_attack.png',
        fotoMapa: './assets/ratigueya.png',
        ataques:  ['🔥', '🔥', '🔥', '🌱', '💧'],
        mapaX:    95,
        mapaY:    80,
    },
];

// ─── 2. Clase Mokepon ─────────────────────────────────────────────────────────

class Mokepon {
    constructor({ nombre, img, fotoMapa, ataques, mapaX = 0, mapaY = 0 }) {
        this.nombre     = nombre;
        this.imagen     = img;
        this.ataques    = ataques;
        this.x          = mapaX;
        this.y          = mapaY;
        this.ancho      = 50;
        this.alto       = 50;
        this.velocidadX = 0;
        this.velocidadY = 0;
        this.id         = null; // ID del servidor (solo para enemigos)

        // Precargar imagen del mapa
        this.mapaFoto     = new Image();
        this.mapaFoto.src = fotoMapa;
    }

    /** Calcula los límites del bounding box para detección de colisión. */
    getBounds() {
        return {
            arriba:    this.y,
            abajo:     this.y + this.alto,
            izquierda: this.x,
            derecha:   this.x + this.ancho,
        };
    }
}

// ─── 3. Estado de la aplicación ───────────────────────────────────────────────

/**
 * Estado centralizado: toda la información mutable vive aquí.
 * Evita variables globales dispersas que son difíciles de rastrear.
 */
const estado = {
    jugadorId:       null,     // ID asignado por el servidor
    jugador:         null,     // Instancia Mokepon del jugador

    enemigosMapa:    [],       // Lista de Mokepon visibles en el mapa
    ataqueJugador:   null,     // Ataque elegido en el turno actual
    ataqueEnemigo:   null,     // Ataque del rival (recibido del servidor)

    vidasJugador:    3,
    vidasEnemigo:    3,

    intervaloCanvas: null,     // ID del setInterval del loop gráfico
    intervaloBatalla: null,    // ID del setInterval del polling de combate
};

// ─── 4. Referencias al DOM ────────────────────────────────────────────────────

const DOM = {
    // Secciones
    seccionSeleccion: document.getElementById('seleccionar-mokepon'),
    seccionMapa:      document.getElementById('ver-mapa'),
    seccionCombate:   document.getElementById('seleccionar-ataque'),
    seccionReiniciar: document.getElementById('reiniciar'),

    // Botones principales
    btnElegir:        document.getElementById('boton-elegir-mokepon'),
    btnReiniciar:     document.getElementById('boton-reiniciar'),

    // Selección de mascota
    contenedorTarjetas: document.getElementById('contenedorTarjetas'),

    // Combate - información
    nombreJugador:    document.getElementById('mokepon-jugador'),
    nombreEnemigo:    document.getElementById('mokepon-enemigo'),
    vidasJugador:     document.getElementById('vidas-jugador'),
    vidasEnemigo:     document.getElementById('vidas-enemigo'),
    mensajeResultado: document.getElementById('resultado'),
    historialJugador: document.getElementById('ataques-jugador'),
    historialEnemigo: document.getElementById('ataques-enemigo'),

    // Combate - ataques
    contenedorAtaques: document.getElementById('contenedorAtaques'),

    // Mapa
    canvas:           document.getElementById('canvas'),

    // Botones de movimiento
    btnArriba:        document.getElementById('boton-arriba'),
    btnAbajo:         document.getElementById('boton-abajo'),
    btnIzquierda:     document.getElementById('boton-izquierda'),
    btnDerecha:       document.getElementById('boton-derecha'),
};

// Contexto 2D del canvas (se asigna en iniciarJuego)
let ctx;

// Imagen de fondo del mapa (precargada una sola vez)
const mapaBackground    = new Image();
mapaBackground.src      = './assets/mokemap.png';

// ─── 5. Inicialización ────────────────────────────────────────────────────────

function iniciarJuego() {
    ctx = DOM.canvas.getContext('2d');

    renderizarTarjetasMokepones();
    registrarEventos();
    unirseAlServidor();
}

/** Genera las tarjetas de selección de mokepon en el DOM. */
function renderizarTarjetasMokepones() {
    // Construir todo el HTML de una vez para un solo reflow del DOM
    const html = CATALOGO_MOKEPONES.map(m => `
        <input type="radio" name="mascota" id="${m.nombre}" />
        <label class="tarjeta-de-mokepon" for="${m.nombre}">
            <p>${m.nombre}</p>
            <img src="${m.img}" alt="${m.nombre}">
        </label>
    `).join('');

    DOM.contenedorTarjetas.innerHTML = html;
}

/** Registra todos los event listeners de la aplicación en un solo lugar. */
function registrarEventos() {
    DOM.btnElegir.addEventListener('click', onElegirMokepon);
    DOM.btnReiniciar.addEventListener('click', () => location.reload());

    // Controles de movimiento: se unifican mouse, touch y teclado
    const mapaMovimiento = [
        { btn: DOM.btnArriba,     mover: moverArriba     },
        { btn: DOM.btnAbajo,      mover: moverAbajo      },
        { btn: DOM.btnIzquierda,  mover: moverIzquierda  },
        { btn: DOM.btnDerecha,    mover: moverDerecha    },
    ];

    mapaMovimiento.forEach(({ btn, mover }) => {
        btn.addEventListener('mousedown',  mover);
        btn.addEventListener('touchstart', mover, { passive: true });
        btn.addEventListener('mouseup',    detenerMovimiento);
        btn.addEventListener('touchend',   detenerMovimiento, { passive: true });
    });

    // Teclado
    window.addEventListener('keydown', onTeclaPresionada);
    window.addEventListener('keyup',   onTeclaSoltada);
}

// ─── 6. Selección de mascota ──────────────────────────────────────────────────

function onElegirMokepon() {
    const seleccionado = document.querySelector('input[name="mascota"]:checked');

    if (!seleccionado) {
        alert('Por favor, selecciona una mascota para continuar.');
        return;
    }

    const datos = CATALOGO_MOKEPONES.find(m => m.nombre === seleccionado.id);

    // Crear la instancia del jugador con los datos del catálogo
    estado.jugador = new Mokepon(datos);
    DOM.nombreJugador.textContent = datos.nombre;

    // Notificar al servidor y transicionar a la pantalla del mapa
    enviarMokeponeAlServidor(datos.nombre);
    renderizarBotonesDeAtaque(datos.ataques);

    DOM.seccionSeleccion.style.display = 'none';
    DOM.seccionMapa.style.display      = 'flex';

    estado.intervaloCanvas = setInterval(loopCanvas, FPS_CANVAS);
}

// ─── 7. Motor gráfico (canvas) ────────────────────────────────────────────────

/**
 * Loop principal del canvas.
 * SOLO se ocupa de: actualizar posición, dibujar y sincronizar posición con el servidor.
 * La lógica de red para el combate se maneja en un intervalo separado.
 */
function loopCanvas() {
    actualizarPosicionJugador();
    dibujarFrame();
    sincronizarPosicionServidor();
    verificarColisiones();
    consultarEnemigosEnMapa();
}

function actualizarPosicionJugador() {
    estado.jugador.x += estado.jugador.velocidadX;
    estado.jugador.y += estado.jugador.velocidadY;
}

function dibujarFrame() {
    ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
    ctx.drawImage(mapaBackground, 0, 0, DOM.canvas.width, DOM.canvas.height);

    // Dibujar jugador
    ctx.drawImage(
        estado.jugador.mapaFoto,
        estado.jugador.x,
        estado.jugador.y,
        estado.jugador.ancho,
        estado.jugador.alto,
    );

    // Dibujar enemigos con efecto de brillo
    estado.enemigosMapa.forEach(enemigo => {
        ctx.shadowBlur    = 15;
        ctx.shadowColor   = '#FFD700';
        ctx.drawImage(enemigo.mapaFoto, enemigo.x, enemigo.y, enemigo.ancho, enemigo.alto);
        ctx.shadowBlur    = 0;
        ctx.shadowColor   = 'transparent';
    });
}

/** Comprueba colisiones solo si el jugador se está moviendo. */
function verificarColisiones() {
    const enMovimiento = estado.jugador.velocidadX !== 0 || estado.jugador.velocidadY !== 0;
    if (!enMovimiento) return;

    estado.enemigosMapa.forEach(enemigo => {
        if (hayColision(estado.jugador, enemigo)) {
            detenerMovimiento();
            notificarColisionAlServidor(enemigo.id);
        }
    });
}

/** Algoritmo AABB (Axis-Aligned Bounding Box) para detectar colisiones. */
function hayColision(a, b) {
    const ba = a.getBounds();
    const bb = b.getBounds();

    // Si cualquier lado de A no se superpone con B, no hay colisión
    return !(
        ba.abajo     < bb.arriba    ||
        ba.arriba    > bb.abajo     ||
        ba.derecha   < bb.izquierda ||
        ba.izquierda > bb.derecha
    );
}

// ─── 8. Red - comunicación con el servidor ────────────────────────────────────

/** Solicita un ID único al servidor para identificar a este jugador. */
async function unirseAlServidor() {
    try {
        const res = await fetch(`${API_URL}/unirse`);
        if (!res.ok) throw new Error(await res.text());

        estado.jugadorId = await res.text();
        console.log('[+] Conectado con ID:', estado.jugadorId);
    } catch (err) {
        console.error('[!] Error al conectarse al servidor:', err);
        alert('No se pudo conectar al servidor. ¿Está corriendo en el puerto 8080?');
    }
}

function enviarMokeponeAlServidor(nombre) {
    fetch(`${API_URL}/mokepon/${estado.jugadorId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mokepon: nombre }),
    }).catch(err => console.warn('[!] Error al enviar mokepon:', err));
}

function sincronizarPosicionServidor() {
    fetch(`${API_URL}/mokepon/${estado.jugadorId}/posicion`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ x: estado.jugador.x, y: estado.jugador.y }),
    }).catch(() => {}); // Silenciamos errores de posición para no saturar la consola
}

/** Obtiene la lista de otros jugadores en el mapa y actualiza enemigosMapa. */
function consultarEnemigosEnMapa() {
    fetch(`${API_URL}/mokepon/${estado.jugadorId}/enemigos`)
        .then(res => res.ok ? res.json() : null)
        .then(datos => {
            if (!datos) return;

            // Si ya hay un combate en curso, iniciamos el modo batalla y salimos
            if (datos.enemigoId) {
                iniciarModoBatalla(datos);
                return;
            }

            // Construir objetos Mokepon para cada rival visible en el mapa
            estado.enemigosMapa = datos.enemigos
                .map(enemigoServidor => {
                    const datosBase = CATALOGO_MOKEPONES.find(
                        m => m.nombre === enemigoServidor.mokepon?.nombre
                    );
                    if (!datosBase) return null;

                    const mokepon = new Mokepon({
                        ...datosBase,
                        mapaX: enemigoServidor.x ?? 0,
                        mapaY: enemigoServidor.y ?? 0,
                    });
                    mokepon.id = enemigoServidor.id;
                    return mokepon;
                })
                .filter(Boolean);
        })
        .catch(() => {});
}

function notificarColisionAlServidor(enemigoId) {
    fetch(`${API_URL}/mokepon/${estado.jugadorId}/colision`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ enemigoId }),
    }).catch(err => console.warn('[!] Error al notificar colisión:', err));
}

function enviarAtaqueAlServidor(ataque) {
    fetch(`${API_URL}/mokepon/${estado.jugadorId}/ataque`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ataque }),
    }).catch(err => console.warn('[!] Error al enviar ataque:', err));
}

/**
 * Polling del estado de la batalla.
 * Se ejecuta cada POLL_RED ms una vez que comienza el combate.
 */
function consultarEstadoBatalla() {
    fetch(`${API_URL}/mokepon/${estado.jugadorId}/enemigos`)
        .then(res => res.ok ? res.json() : null)
        .then(datos => {
            if (datos) sincronizarBatalla(datos);
        })
        .catch(() => {});
}

// ─── 9. Combate ───────────────────────────────────────────────────────────────

/**
 * Transiciona del mapa a la pantalla de combate.
 * Solo se llama una vez por batalla (cuando se detecta el enemigoId por primera vez).
 */
function iniciarModoBatalla(datos) {
    // Detener el canvas y arrancar el polling de batalla
    if (estado.intervaloCanvas) {
        clearInterval(estado.intervaloCanvas);
        estado.intervaloCanvas = null;
    }
    if (!estado.intervaloBatalla) {
        estado.intervaloBatalla = setInterval(consultarEstadoBatalla, POLL_RED);
    }

    DOM.seccionMapa.style.display    = 'none';
    DOM.seccionCombate.style.display = 'flex';

    sincronizarBatalla(datos);
}

/**
 * Actualiza la interfaz de combate con los datos más recientes del servidor.
 * Se llama en cada ciclo del polling.
 */
function sincronizarBatalla({ enemigoId, enemigos, esMiTurno, resultadoRonda, ataqueRival, vidasJugador, vidasEnemigo }) {
    // Actualizar vidas desde el servidor (fuente de verdad)
    if (vidasJugador !== undefined) {
        estado.vidasJugador = vidasJugador;
        estado.vidasEnemigo = vidasEnemigo;
        DOM.vidasJugador.textContent = vidasJugador;
        DOM.vidasEnemigo.textContent = vidasEnemigo;
    }

    // Mostrar nombre del enemigo
    const datosEnemigo = enemigos.find(e => e.id === enemigoId);
    if (datosEnemigo?.mokepon?.nombre) {
        DOM.nombreEnemigo.textContent = datosEnemigo.mokepon.nombre;
    }

    // Verificar fin de juego
    if (estado.vidasJugador === 0 || estado.vidasEnemigo === 0) {
        clearInterval(estado.intervaloBatalla);
        desactivarBotonesDeAtaque();
        mostrarFinDeJuego();
        return;
    }

    // Procesar resultado de la ronda recién completada
    if (resultadoRonda && ataqueRival && !esMiTurno) {
        const yaSeMusetro = DOM.mensajeResultado.textContent === resultadoRonda;
        if (!yaSeMusetro) {
            estado.ataqueEnemigo = ataqueRival;
            mostrarResultadoRonda(resultadoRonda);
        }
    }

    // Gestionar estado de los botones según el turno
    if (esMiTurno) {
        DOM.mensajeResultado.textContent = '¡Es tu turno! Elige un ataque ⚔️';
        activarBotonesDeAtaque();
    } else if (!resultadoRonda) {
        DOM.mensajeResultado.textContent = 'Esperando al oponente... ⏳';
        estado.ataqueEnemigo = null;
        desactivarBotonesDeAtaque();
    }
}

/** Genera los botones de ataque del mokepon elegido. */
function renderizarBotonesDeAtaque(ataques) {
    const html = ataques.map((ataque, i) => `
        <button class="boton-ataque" data-ataque="${ataque}" id="btn-ataque-${i}">
            ${ataque}
        </button>
    `).join('');

    DOM.contenedorAtaques.innerHTML = html;

    DOM.contenedorAtaques.querySelectorAll('.boton-ataque').forEach(btn => {
        btn.addEventListener('click', onAtaqueElegido);
    });
}

function onAtaqueElegido(e) {
    const ataque = e.currentTarget.dataset.ataque;
    estado.ataqueJugador = ataque;

    // Deshabilitar todos los botones inmediatamente para evitar doble clic
    desactivarBotonesDeAtaque();
    enviarAtaqueAlServidor(ataque);
}

/** Agrega una entrada al historial visual de ataques de ambos lados. */
function mostrarResultadoRonda(resultado) {
    DOM.mensajeResultado.textContent = resultado;

    const entradaJugador = document.createElement('p');
    entradaJugador.textContent = `Atacó con ${estado.ataqueJugador}`;
    DOM.historialJugador.appendChild(entradaJugador);

    const entradaEnemigo = document.createElement('p');
    entradaEnemigo.textContent = `Atacó con ${estado.ataqueEnemigo}`;
    DOM.historialEnemigo.appendChild(entradaEnemigo);
}

function mostrarFinDeJuego() {
    const { vidasJugador, vidasEnemigo } = estado;
    let mensaje;

    if (vidasJugador === vidasEnemigo) {
        mensaje = '¡Empate Final! Ambos cayeron juntos. 🤝';
    } else if (vidasJugador > vidasEnemigo) {
        mensaje = '¡Victoria! Ganaste la batalla. 🏆';
    } else {
        mensaje = '¡Derrota! Fuiste vencido en batalla. ☠️';
    }

    DOM.mensajeResultado.textContent   = mensaje;
    DOM.seccionReiniciar.style.display = 'block';
}

function activarBotonesDeAtaque() {
    DOM.contenedorAtaques.querySelectorAll('.boton-ataque').forEach(btn => {
        btn.disabled = false;
    });
}

function desactivarBotonesDeAtaque() {
    DOM.contenedorAtaques.querySelectorAll('.boton-ataque').forEach(btn => {
        btn.disabled = true;
    });
}

// ─── 10. Controles de movimiento ──────────────────────────────────────────────

function moverDerecha()   { estado.jugador.velocidadX =  VELOCIDAD; }
function moverIzquierda() { estado.jugador.velocidadX = -VELOCIDAD; }
function moverArriba()    { estado.jugador.velocidadY = -VELOCIDAD; }
function moverAbajo()     { estado.jugador.velocidadY =  VELOCIDAD; }

function detenerMovimiento() {
    if (!estado.jugador) return;
    estado.jugador.velocidadX = 0;
    estado.jugador.velocidadY = 0;
}

const TECLAS_MOVIMIENTO = {
    ArrowRight: moverDerecha,
    ArrowLeft:  moverIzquierda,
    ArrowUp:    moverArriba,
    ArrowDown:  moverAbajo,
};

function onTeclaPresionada(e) {
    const accion = TECLAS_MOVIMIENTO[e.key];
    if (accion) accion();
}

function onTeclaSoltada(e) {
    if (e.key in TECLAS_MOVIMIENTO) detenerMovimiento();
}

// ─── Punto de entrada ─────────────────────────────────────────────────────────

window.addEventListener('load', iniciarJuego);
