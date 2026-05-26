// ==========================================
// 1. CLASES
// ==========================================
class Mokepon {
    constructor(nombre, imagen, vida, fotoMapa, x = 580, y = 280) {
        this.nombre = nombre;
        this.imagen = imagen;
        this.vida = vida;
        this.ataques = [];
        this.x = x;       
        this.y = y;       
        this.ancho = 50;   
        this.alto = 50;    
        this.mapaFoto = new Image();
        this.mapaFoto.src = fotoMapa;
        this.velocidadX = 0;
        this.velocidadY = 0;
    }
}

// ==========================================
// 2. CONFIGURACIÓN Y VARIABLES
// ==========================================
const mokes = [
    { 
        nombre: 'Hipodoge', 
        img: './assets/mokepons_mokepon_hipodoge_attack.png', 
        ataques: ['💧','💧','💧','🔥','🌱'], 
        fotoMapa: './assets/hipodoge.png',
        mapaX: 130,
        mapaY: 320 
    },
    { 
        nombre: 'Capipepo', 
        img: './assets/mokepons_mokepon_capipepo_attack.png', 
        ataques: ['🌱','🌱','🌱','💧','🔥'], 
        fotoMapa: './assets/capipepo.png',
        mapaX: 415,
        mapaY: 280 
    },
    { 
        nombre: 'Ratigueya', 
        img: './assets/mokepons_mokepon_ratigueya_attack.png', 
        ataques: ['🔥','🔥','🔥','🌱','💧'], 
        fotoMapa: './assets/ratigueya.png',
        mapaX: 95,
        mapaY: 80 
    }
];

let mokepones = [];
let enemigosMapa = []; 
let mascotaJugadorObjeto; 
let ataqueJugador;
let ataqueEnemigo;
let ataquesMokeponEnemigo = [];

let vidasJugador = 3;
let vidasEnemigo = 3;
let contadorTurnos = 0; 

// ==========================================
// 3. CENTRALIZACIÓN DE ACCESOS
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
    historialEnemigo: document.getElementById("ataques-enemigo"),
    sectionMapa: document.getElementById("ver-mapa"),
    canvas: document.getElementById("canvas"),
    btnArriba: document.getElementById("boton-arriba"),
    btnAbajo: document.getElementById("boton-abajo"),
    btnIzquierda: document.getElementById("boton-izquierda"),
    btnDerecha: document.getElementById("boton-derecha")
};

let lienzo; 
let intervalo;
let mapaBackground = new Image();
mapaBackground.src = './assets/mokemap.png';

// ==========================================
// 4. FLUJO PRINCIPAL E INICIALIZACIÓN
// ==========================================
function inicializarMokepones() {
    mokes.forEach(m => {
        let nuevoMokepon = new Mokepon(m.nombre, m.img, 3, m.fotoMapa);
        nuevoMokepon.ataques = m.ataques;
        mokepones.push(nuevoMokepon);
    });
}

function iniciarJuego() {
    inicializarMokepones();
    lienzo = DOM.canvas.getContext("2d");

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

    DOM.botonEligeMokepon.addEventListener("click", eligeMokeponJugador);
    DOM.botonReiniciar.addEventListener("click", () => location.reload());
    
    DOM.btnArriba.addEventListener("mousedown", moverArriba);
    DOM.btnAbajo.addEventListener("mousedown", moverAbajo);
    DOM.btnIzquierda.addEventListener("mousedown", moverIzquierda);
    DOM.btnDerecha.addEventListener("mousedown", moverDerecha);
    DOM.btnArriba.addEventListener("mouseup", detenerMovimiento);
    DOM.btnAbajo.addEventListener("mouseup", detenerMovimiento);
    DOM.btnIzquierda.addEventListener("mouseup", detenerMovimiento);
    DOM.btnDerecha.addEventListener("mouseup", detenerMovimiento);
    
    DOM.btnArriba.addEventListener("touchstart", moverArriba);
    DOM.btnAbajo.addEventListener("touchstart", moverAbajo);
    DOM.btnIzquierda.addEventListener("touchstart", moverIzquierda);
    DOM.btnDerecha.addEventListener("touchstart", moverDerecha);
    DOM.btnArriba.addEventListener("touchend", detenerMovimiento);
    DOM.btnAbajo.addEventListener("touchend", detenerMovimiento);
    DOM.btnIzquierda.addEventListener("touchend", detenerMovimiento);
    DOM.btnDerecha.addEventListener("touchend", detenerMovimiento);

    moverConTeclado();
}

// ==========================================
// 5. LÓGICA DE EXPLORACIÓN Y ENEMIGOS
// ==========================================
function generarEnemigosDelMapa(nombreMascotaJugador) {
    const opcionesEnemigos = mokes.filter(m => m.nombre !== nombreMascotaJugador);

    opcionesEnemigos.forEach(enemigoData => {
        let enemigoInstancia = new Mokepon(
            enemigoData.nombre, 
            enemigoData.img, 
            3, 
            enemigoData.fotoMapa, 
            enemigoData.mapaX,
            enemigoData.mapaY
        );
        enemigoInstancia.ataques = enemigoData.ataques;
        enemigosMapa.push(enemigoInstancia);
    });
}

function eligeMokeponJugador() {
    const opcionSeleccionada = document.querySelector('input[name="mascota"]:checked');
    
    if (!opcionSeleccionada) {
        alert("Por favor, selecciona una mascota para continuar.");
        return;
    }

    const nombreMascota = opcionSeleccionada.id;
    DOM.spanMokeponJugador.textContent = nombreMascota;

    mascotaJugadorObjeto = mokepones.find(m => m.nombre === nombreMascota);

    DOM.sectionMokepon.style.display = "none";
    DOM.sectionMapa.style.display = "flex";

    generarEnemigosDelMapa(nombreMascota);

    intervalo = setInterval(pintarCanvas, 20);

    prepararAtaquesJugador(nombreMascota);
}

// ==========================================
// 6. MOTOR GRÁFICO Y RENDERING CORREGIDO
// ==========================================
function pintarCanvas() {
    mascotaJugadorObjeto.x += mascotaJugadorObjeto.velocidadX;
    mascotaJugadorObjeto.y += mascotaJugadorObjeto.velocidadY;

    lienzo.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
    lienzo.drawImage(mapaBackground, 0, 0, DOM.canvas.width, DOM.canvas.height);
    
    lienzo.drawImage(
        mascotaJugadorObjeto.mapaFoto,
        mascotaJugadorObjeto.x,
        mascotaJugadorObjeto.y,
        mascotaJugadorObjeto.ancho,
        mascotaJugadorObjeto.alto
    );

    enemigosMapa.forEach(enemigo => {
        lienzo.shadowBlur = 15;
        lienzo.shadowColor = "#FFD700";
        lienzo.shadowOffsetX = 0;
        lienzo.shadowOffsetY = 0;

        lienzo.drawImage(
            enemigo.mapaFoto,
            enemigo.x,
            enemigo.y,
            enemigo.ancho,
            enemigo.alto
        );

        lienzo.shadowBlur = 0;
        lienzo.shadowColor = "transparent";

        if(mascotaJugadorObjeto.velocidadX !== 0 || mascotaJugadorObjeto.velocidadY !== 0) {
            revisarColision(enemigo);
        }
    });
}

function revisarColision(enemigo) {
    const enemigoArriba = enemigo.y;
    const enemigoAbajo = enemigo.y + enemigo.alto;
    const enemigoIzquierda = enemigo.x;
    const enemigoDerecha = enemigo.x + enemigo.ancho;

    const jugadorArriba = mascotaJugadorObjeto.y;
    const jugadorAbajo = mascotaJugadorObjeto.y + mascotaJugadorObjeto.alto;
    const jugadorIzquierda = mascotaJugadorObjeto.x;
    const jugadorDerecha = mascotaJugadorObjeto.x + mascotaJugadorObjeto.ancho;

    if (
        jugadorAbajo < enemigoArriba ||
        jugadorArriba > enemigoAbajo ||
        jugadorDerecha < enemigoIzquierda ||
        jugadorIzquierda > enemigoDerecha
    ) {
        return; 
    }

    detenerMovimiento();
    clearInterval(intervalo); 

    DOM.spanMokeponEnemigo.textContent = enemigo.nombre;
    ataquesMokeponEnemigo = [...enemigo.ataques];

    alert(`¡Cuidado! Te has encontrado con un ${enemigo.nombre} salvaje ⚔️`);
    
    DOM.sectionMapa.style.display = "none";
    DOM.sectionAtaque.style.display = "flex";
}

// ==========================================
// 7. LÓGICA DE COMBATE
// ==========================================
function prepararAtaquesJugador(nombreMascota) {
    DOM.contenedorAtaques.innerHTML = ""; 
    const personaje = mokepones.find(m => m.nombre === nombreMascota);
    personaje.ataques.forEach((ataque, index) => {
        const botonHtml = `<button class="boton-ataque" data-ataque="${ataque}" id="btn-${index}">${ataque}</button>`;
        DOM.contenedorAtaques.innerHTML += botonHtml;
    });

    document.querySelectorAll(".boton-ataque").forEach(boton => {
        boton.addEventListener("click", (e) => {
            ataqueJugador = e.target.dataset.ataque;
            e.target.disabled = true;
            e.target.style.opacity = "0.5";
            ejecutarTurnoEnemigo();
        });
    });
}

function ejecutarTurnoEnemigo() {
    const indiceAleatorio = Math.floor(Math.random() * ataquesMokeponEnemigo.length);
    ataqueEnemigo = ataquesMokeponEnemigo[indiceAleatorio];
    ataquesMokeponEnemigo.splice(indiceAleatorio, 1);
    procesarResultadoTurno();
}

function procesarResultadoTurno() {
    let resultado;
    contadorTurnos++;
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

function verificarFinDelJuego() {
    if (vidasJugador === 0 || vidasEnemigo === 0 || contadorTurnos === 5) {
        desactivarTodosLosAtaques();
        DOM.sectionReiniciar.style.display = "block";
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

// ==========================================
// 8. CONTROLES DE MOVIMIENTO
// ==========================================
function moverDerecha() { mascotaJugadorObjeto.velocidadX = 5; }
function moverIzquierda() { mascotaJugadorObjeto.velocidadX = -5; }
function moverArriba() { mascotaJugadorObjeto.velocidadY = -5; }
function moverAbajo() { mascotaJugadorObjeto.velocidadY = 5; }

function moverConTeclado() {
    window.addEventListener("keydown", (e) => {
        switch (e.key) {
            case "ArrowRight": moverDerecha(); break;
            case "ArrowLeft": moverIzquierda(); break;
            case "ArrowUp": moverArriba(); break;
            case "ArrowDown": moverAbajo(); break;
        }
    });

    window.addEventListener("keyup", (e) => {
        if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) {
            detenerMovimiento();
        }
    });
}

function detenerMovimiento() {
    mascotaJugadorObjeto.velocidadX = 0;
    mascotaJugadorObjeto.velocidadY = 0;
}

window.addEventListener("load", iniciarJuego);