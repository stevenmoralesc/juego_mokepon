// ==========================================
// 1. CLASES DEL JUEGO (POO)
// ==========================================
class Mokepon {
    constructor(nombre, imagen, vida) {
        this.nombre = nombre;
        this.imagen = imagen;
        this.vida = vida;
        this.ataques = [];
    }
}

// ==========================================
// 2. CONFIGURACIÓN Y ESTADO DE LA APLICACIÓN
// ==========================================
const mokes = [
    { nombre: 'Hipodoge', img: './assets/mokepons_mokepon_hipodoge_attack.png', ataques: ['💧','💧','💧','🔥','🌱'] },
    { nombre: 'Capipepo', img: './assets/mokepons_mokepon_capipepo_attack.png', ataques: ['🌱','🌱','🌱','💧','🔥'] },
    { nombre: 'Ratigueya', img: './assets/mokepons_mokepon_ratigueya_attack.png', ataques: ['🔥','🔥','🔥','🌱','💧'] }
];

let mokepones = [];
let ataqueJugador;
let ataqueEnemigo;
let ataquesMokeponEnemigo = [];

// Variables de control de combate y victoria
let vidasJugador = 3;
let vidasEnemigo = 3;
let contadorTurnos = 0; // Controla que no se excedan los 5 ataques totales

// ==========================================
// 3. CENTRALIZACIÓN DE ACCESOS AL DOM
// ==========================================
const DOM = {
    sectionAtaque: document.getElementById("seleccionar-ataque"),
    sectionMokepon: document.getElementById("seleccionar-mokepon"),
    sectionReiniciar: document.getElementById("reiniciar"),
    botonEligeMokepon: document.getElementById("boton-elegir-mokepon"),
    botonReiniciar: document.getElementById("boton-reiniciar"),
    contenedorTarjetas: document.getElementById("contenedorTarjetas"),
    contenedorAtaques: document.getElementById("contenedorAtaques"),
    spanMokeponJugador: document.getElementById("mokepon-jugador"),
    spanMokeponEnemigo: document.getElementById("mokepon-enemigo"),
    spanVidasJugador: document.getElementById("vidas-jugador"),
    spanVidasEnemigo: document.getElementById("vidas-enemigo"),
    sectionMensajes: document.getElementById("resultado"),
    historialJugador: document.getElementById("ataques-jugador"),
    historialEnemigo: document.getElementById("ataques-enemigo")
};

// ==========================================
// 4. FLUJO PRINCIPAL E INICIALIZACIÓN
// ==========================================
function inicializarMokepones() {
    mokes.forEach(m => {
        let nuevoMokepon = new Mokepon(m.nombre, m.img, 3);
        nuevoMokepon.ataques = m.ataques;
        mokepones.push(nuevoMokepon);
    });
}

function iniciarJuego() {
    inicializarMokepones();

    // Renderizar las tarjetas de personajes de forma dinámica
    mokepones.forEach((mokepon) => {
        const tarjetaHtml = `
        <input type="radio" name="mascota" id="${mokepon.nombre}" />
        <label class="tarjeta-de-mokepon" for="${mokepon.nombre}">
            <p>${mokepon.nombre}</p>
            <img src="${mokepon.imagen}" alt="${mokepon.nombre}">
        </label>
        `;
        DOM.contenedorTarjetas.innerHTML += tarjetaHtml;
    });

    // Listeners del sistema global
    DOM.botonEligeMokepon.addEventListener("click", eligeMokeponJugador);
    DOM.botonReiniciar.addEventListener("click", () => location.reload());
}

// ==========================================
// 5. LÓGICA DE SELECCIÓN DE PERSONAJES
// ==========================================
function eligeMokeponJugador() {
    const opcionSeleccionada = document.querySelector('input[name="mascota"]:checked');
    
    if (!opcionSeleccionada) {
        alert("Por favor, selecciona una mascota para continuar.");
        return;
    }

    const nombreMascota = opcionSeleccionada.id;
    DOM.spanMokeponJugador.textContent = nombreMascota;

    // Cambiar visualmente de pantalla
    DOM.sectionMokepon.style.display = "none";
    DOM.sectionAtaque.style.display = "flex";

    prepararAtaquesJugador(nombreMascota);
    eligeMokeponEnemigo();
}

function eligeMokeponEnemigo() {
    const indiceAleatorio = Math.floor(Math.random() * mokepones.length);
    const enemigo = mokepones[indiceAleatorio];

    DOM.spanMokeponEnemigo.textContent = enemigo.nombre;
    // Hacemos una copia superficial de la lista de ataques del bot
    ataquesMokeponEnemigo = [...enemigo.ataques]; 
}

function prepararAtaquesJugador(nombreMascota) {
    const personaje = mokepones.find(m => m.nombre === nombreMascota);
    
    // Inyectar un botón interactivo por cada ataque real que posee el Mokepon
    personaje.ataques.forEach((ataque, index) => {
        const botonHtml = `
        <button class="boton-ataque" data-ataque="${ataque}" id="btn-${index}">
            ${ataque}
        </button>
        `;
        DOM.contenedorAtaques.innerHTML += botonHtml;
    });

    // Escuchar el clic de ataque mediante delegación individual controlada
    document.querySelectorAll(".boton-ataque").forEach(boton => {
        boton.addEventListener("click", (e) => {
            ataqueJugador = e.target.dataset.ataque;
            e.target.disabled = true;
            e.target.style.opacity = "0.5";
            
            ejecutarTurnoEnemigo();
        });
    });
}

// ==========================================
// 6. LOGICA DE COMBATE ASÍNCRONA POR TURNOS
// ==========================================
function ejecutarTurnoEnemigo() {
    // El bot consume aleatoriamente un ataque de su propia pool
    const indiceAleatorio = Math.floor(Math.random() * ataquesMokeponEnemigo.length);
    ataqueEnemigo = ataquesMokeponEnemigo[indiceAleatorio];
    
    // Lo removemos de sus disponibles para que no lance ataques fantasmas
    ataquesMokeponEnemigo.splice(indiceAleatorio, 1);
    
    procesarResultadoTurno();
}

function procesarResultadoTurno() {
    let resultado;
    contadorTurnos++; // Se contabiliza el round jugado

    if (ataqueJugador === ataqueEnemigo) {
        resultado = "EMPATE 🤝";
    } else if (
        (ataqueJugador === "🔥" && ataqueEnemigo === "🌱") ||
        (ataqueJugador === "💧" && ataqueEnemigo === "🔥") ||
        (ataqueJugador === "🌱" && ataqueEnemigo === "💧")
    ) {
        resultado = "GANASTE 🌟";
        vidasEnemigo--;
        DOM.spanVidasEnemigo.textContent = vidasEnemigo;
    } else {
        resultado = "PERDISTE 💔";
        vidasJugador--;
        DOM.spanVidasJugador.textContent = vidasJugador;
    }

    mostrarMensajes(resultado);
    verificarFinDelJuego();
}

function mostrarMensajes(resultado) {
    DOM.sectionMensajes.textContent = resultado;

    const pJugador = document.createElement("p");
    pJugador.textContent = `Atacó con ${ataqueJugador}`;
    DOM.historialJugador.appendChild(pJugador);

    const pEnemigo = document.createElement("p");
    pEnemigo.textContent = `Atacó con ${ataqueEnemigo}`;
    DOM.historialEnemigo.appendChild(pEnemigo);
}

// ==========================================
// 7. RESOLUCIÓN Y CONTROL DE CIERRE
// ==========================================
function verificarFinDelJuego() {
    // REGLA: El juego termina si alguien se queda sin vidas O si se agotan los 5 ataques totales
    if (vidasJugador === 0 || vidasEnemigo === 0 || contadorTurnos === 5) {
        desactivarTodosLosAtaques();
        DOM.sectionReiniciar.style.display = "block";

        // Desempate por puntos/vidas si se llegó al límite de turnos
        if (vidasJugador === vidasEnemigo) {
            DOM.sectionMensajes.textContent = "¡Fin del juego! Ha sido un Empate Final. 🤝";
        } else if (vidasJugador > vidasEnemigo) {
            DOM.sectionMensajes.textContent = "¡Felicidades! Ganaste la partida por puntos 🏆";
        } else {
            DOM.sectionMensajes.textContent = "Has sido derrotado por el enemigo... ☠️";
        }
    }
}

function desactivarTodosLosAtaques() {
    document.querySelectorAll(".boton-ataque").forEach(b => b.disabled = true);
}

// Disparador de inicio de la aplicación
window.addEventListener("load", iniciarJuego);