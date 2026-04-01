// =============================================
// game.js — Controles por zona táctil
// 1 tap = golpe suave
// 2 taps = golpe duro
// 3 taps = cae y se levanta
// Long press = levita, arrastras, sueltas = cae
// =============================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---- Audio Manager ----
const SFX = {
    sounds: {},
    init() {
        const L = (k, src, vol=1, loop=false) => {
            const a = new Audio(src);
            a.volume = vol; a.loop = loop;
            this.sounds[k] = a;
        };
        L('golpe',       'sonidos/golpe.mp3',       0.9);
        L('ko',          'sonidos/ko.mp3',           1.0);
        L('levitate',    'sonidos/levitate.wav',     0.7);
        L('caida',       'sonidos/caida.mp3',        0.9);
        L('updow',       'sonidos/updow.mp3',        0.8, true);
        L('saltotijera', 'sonidos/saltotijera.mp3',  0.8, true);
        L('backflip',    'sonidos/backflip.mp3',     0.8, true);
        L('voltereta',   'sonidos/voltereta.mp3',    0.8, true);
        L('migajas',     'sonidos/migajas.mp3',      0.8, true);
        L('dance',       'sonidos/dance.mp3',        0.8, true); // loop o corto, igual se corta al golpear
        L('tada',        'sonidos/tada.mp3',         0.85);
        L('walk',        'sonidos/walk.mp3',         0.7, true);
        L('levantar',    'sonidos/levantar.wav',     0.35);
        L('talk',        'sonidos/talk.mp3',         0.5);
    },
    play(k) {
        const s = this.sounds[k];
        if (!s) return;
        s.currentTime = 0;
        s.play().catch(() => {});
    },
    stop(k) {
        const s = this.sounds[k];
        if (!s) return;
        s.pause(); s.currentTime = 0;
    }
};

// ---- Estados ----
const S = {
    LOADING:'loading', WALKIN:'walkin', IDLE:'idle',
    HIT_SOFT:'hit_soft', HIT_HARD:'hit_hard',
    FALLING:'falling', GROUND:'ground', GETUP:'getup',
    LEVITATING:'levitating', LOOPING:'looping', ENDING:'ending'
};
let state    = S.LOADING;
let hitCount = 0;   // golpes en ciclo actual (max 3)
let koCount  = 0;   // total KOs
let totalHits= 0;   // total golpes para barra

// ---- Frases ----
const IDLE_Q = [
    "Oye… ya fue 😅","¿En serio me vas a pegar?",
    "Entiendo que estés molesta…","¡Espera! ¡Hablemos!",
    "Sé que la regué 😔","¡No no no NO!",
    "¡Eso dolió! 😵","¿Podemos negociar?",
    "¡Soy tu amigo! 😭","¡Ok, merezco eso!",
    "¡Para para para!","¡No en la cara! 😤"
];
const GRAB_Q = ["¡¡NOOO!! 😱","¡¡SUÉLTAME!! 😭","¡¡POR FAVOR!! 🙏","¡¡TE LO IMPLORO!! 😰"];
let qi = 0;

// ---- DOM ----
const $  = id => document.getElementById(id);
const loaderScreen = $('loading-screen');
const loaderBar    = $('loader-bar');
const loaderPct    = $('loader-pct');
const hud          = $('hud');
const bubble       = $('speech-bubble');
const bubbleTxt    = $('bubble-text');
const satisFill    = $('satis-fill');
const satisEmoji   = $('satis-emoji');
const hitFlash     = $('hit-flash');
const koCnt        = $('ko-count');
const finalOvl     = $('final-overlay');
const tapHint      = $('tap-hint');
const pips         = [$('pip-1'),$('pip-2'),$('pip-3')];

// Touch zone: se crea en JS por si el HTML está en caché
let touchZone = $('touch-zone');
if (!touchZone) {
    touchZone = document.createElement('div');
    touchZone.id = 'touch-zone';
    touchZone.style.cssText = [
        'position:fixed', 'left:5%', 'right:5%',
        'top:8%', 'bottom:18%', 'z-index:20',
        'touch-action:none', '-webkit-tap-highlight-color:transparent'
    ].join(';');
    document.body.appendChild(touchZone);
}

// ---- Three.js ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080112);

const camera = new THREE.PerspectiveCamera(42, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0, 1.4, 5.5);
camera.lookAt(0, 1.0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
$('renderer-container').appendChild(renderer.domElement);

// Estrellas
const sv = []; for(let i=0;i<1200;i++) sv.push((Math.random()-.5)*60,(Math.random()-.5)*40,(Math.random()-.5)*60-10);
const sg = new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.Float32BufferAttribute(sv,3));
scene.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0xa855f7,size:0.04,transparent:true,opacity:0.6})));

// Suelo
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30,30), new THREE.MeshLambertMaterial({color:0x1a0533}));
floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
const grid = new THREE.GridHelper(20,20,0x4a1070,0x2d0a50); grid.position.y=0.002; scene.add(grid);

// Luces
scene.add(new THREE.AmbientLight(0x6b3090, 1.3)); // luz ambiente más brillante y menos oscura
const dl = new THREE.DirectionalLight(0xffffff, 1.8); dl.position.set(0,5,8); dl.castShadow=true; dl.shadow.mapSize.set(2048,2048); scene.add(dl);
const fillL = new THREE.DirectionalLight(0xffaeca, 0.8); fillL.position.set(-5,3,3); scene.add(fillL); // Relleno rosado más fuerte
const rimL  = new THREE.DirectionalLight(0xc98dfa, 1.0); rimL.position.set(5,6,-5);  scene.add(rimL);  // Contra luz morada más fuerte
const spot = new THREE.SpotLight(0xffefff, 3.0, 20, Math.PI*0.18, 0.4); // Spot principal con más fuerza
spot.position.set(0,8,4); spot.target.position.set(0,0,0); scene.add(spot); scene.add(spot.target);

// ---- Modelo ----
let model=null, mixer=null;
const actions={};

const ANIMS = [
    {k:'WALK',   f:'ANIMACIONES/CAMINANDO.glb'},
    {k:'IDLE',   f:'ANIMACIONES/HABLANDO.glb'},
    {k:'SOFT',   f:'ANIMACIONES/GOLPE SIMPLE.glb'},
    {k:'HARD',   f:'ANIMACIONES/GOLPE DURO.glb'},
    {k:'FALL',   f:'ANIMACIONES/GOLPE Y CAE.glb'},
    {k:'GND',    f:'ANIMACIONES/TIRADO EN EL SUELO .glb'},
    {k:'GETUP',  f:'ANIMACIONES/LEVANTANDOSE DESPUES DE CAIDA .glb'},
    {k:'BLEG',   f:'ANIMACIONES/SUPLICANDO.glb'},
    {k:'BOW',    f:'ANIMACIONES/REVERENCIA.glb'},
    {k:'NO',     f:'ANIMACIONES/NO CON LA CABEZA.glb'},
    {k:'SALTO',  f:'ANIMACIONES/SALTO TIJERA.glb'},
    {k:'BACKFLIP',  f:'ANIMACIONES/BACKFLIP.glb'},
    {k:'VOLTERETA', f:'ANIMACIONES/VOLTERETA .glb'},
    {k:'MIGAJA',    f:'ANIMACIONES/ARRASTRADO POR EL PISO.glb'},
    {k:'MOSTRAR',   f:'ANIMACIONES/mostrar.glb'},
    {k:'LAG',       f:'ANIMACIONES/LAGARTIJA.glb'},
    {k:'DANCE',     f:'ANIMACIONES/BAILANDO.glb'},
    {k:'CONF',      f:'ANIMACIONES/CONFUSO.glb'}
];

async function loadAll(){
    const ldr = new GLTFLoader();
    for(let i=0;i<ANIMS.length;i++){
        const {k,f}=ANIMS[i];
        await new Promise(res=>{
            ldr.load(f,(gltf)=>{
                if(!model){
                    model=gltf.scene;
                    model.traverse(c=>{ if(c.isMesh){c.castShadow=true;c.receiveShadow=true;} });
                    model.rotation.y=0;
                    model.position.set(0,0,-12);
                    scene.add(model);
                    mixer=new THREE.AnimationMixer(model);
                    mixer.addEventListener('finished',onDone);
                }
                if(gltf.animations.length){
                    const a=mixer.clipAction(gltf.animations[0]);
                    a.setLoop(THREE.LoopOnce,1); a.clampWhenFinished=true;
                    actions[k]=a;
                }
                const p=Math.round(((i+1)/ANIMS.length)*100);
                loaderBar.style.width=p+'%'; loaderPct.textContent=p+'%';
                res();
            },undefined,()=>res());
        });
    }
}

// ---- Play animation ----
let curAction=null, doneCb=null;
function play(k, loop=false, cb=null){
    const a=actions[k]; if(!a){if(cb)cb();return;}
    if(curAction&&curAction!==a) curAction.fadeOut(0.2);
    doneCb=cb;
    a.reset();
    a.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce, Infinity);
    a.clampWhenFinished=!loop;
    a.fadeIn(0.2); a.play();
    curAction=a;
}
function onDone(e){ if(e.action===curAction&&doneCb){const c=doneCb;doneCb=null;c();} }

// ---- Walk-In ----
function walkin(){
    state=S.WALKIN; model.position.set(0,0,-12);
    SFX.play('walk');          // sonido de pasos
    play('WALK',true);
    const t0=performance.now(), dur=4200;
    (function step(now){
        const t=Math.min((now-t0)/dur,1);
        const e=t<.5?2*t*t:-1+(4-2*t)*t;
        model.position.z=-12+(0-(-12))*e;
        if(t<1) requestAnimationFrame(step);
        else {
            SFX.stop('walk');  // detener pasos al llegar
            startIdle();
        }
    })(t0);
}

// ---- Idle ----
let idleTimer=null;
function startIdle(){
    state=S.IDLE; play('IDLE',true);
    showBubble(IDLE_Q[qi%IDLE_Q.length]); qi++;
    clearInterval(idleTimer);
    idleTimer=setInterval(()=>{ if(state===S.IDLE){showBubble(IDLE_Q[qi%IDLE_Q.length]);qi++;} },3500);
    tapHint.classList.remove('hidden');
}

// ---- Un solo golpe (ejecutado inmediatamente por cada toque) ----
const BLOCKED = [S.FALLING, S.GROUND, S.GETUP, S.LEVITATING, S.LOOPING, S.WALKIN, S.LOADING];

function doHit() {
    if (BLOCKED.includes(state)) return;
    clearInterval(idleTimer);
    tapHint.classList.add('hidden');
    hideBubble();

    SFX.play('golpe');
    flashScreen();
    hitCount++;
    totalHits++;
    updatePips();

    if (hitCount >= 3) {
        doFallSeq();
        return;
    }

    state = S.HIT_SOFT;
    const msg = hitCount === 1 ? '¡Ay! 😖' : '¡Eso dolió! 😤';
    showBubble(msg);
    setTimeout(hideBubble, 900);
    play('SOFT', false, () => { if (state === S.HIT_SOFT) startIdle(); });
}

// ---- Secuencia de caída (KO) ----
function doFallSeq(){
    state = S.FALLING;
    pips.forEach(p=>p.classList.add('hit'));
    if(pips[2]) pips[2].classList.add('hard');
    showBubble('¡¡¡NOOOO!!! 😵‍💫');
    // Primero golpe duro, luego cae, luego suena el KO al impactar el suelo
    play('HARD', false, ()=>{
        play('FALL', false, ()=>{
            SFX.play('ko');   // suena al tocar el suelo
            state = S.GROUND; play('GND', true); hideBubble();
            setTimeout(()=>{
                state = S.GETUP;
                SFX.play('levantar');   // sonido al levantarse
                showBubble('Ugh… me levanto… 😮‍💨');
                play('GETUP', false, ()=>{
                    koCount++; hitCount=0; koCnt.textContent=koCount;
                    resetPips(); setTimeout(hideBubble, 600);
                    startIdle();
                });
            }, 1800);
        });
    });
}

// ---- Levitar ----
let isLev=false, levX=0, floatP=0;

function stopExtras() {
    ['updow', 'saltotijera', 'backflip', 'voltereta', 'dance', 'tada', 'migajas'].forEach(s => SFX.stop(s));
    document.getElementById('photo-frame').classList.add('hidden');
}

function startLev(){
    // Permite levitar desde IDLE o desde un ejercicio en bucle
    if(state !== S.IDLE && state !== S.LOOPING) return;

    // Limpiar estado de ejercicio si estaba en bucle
    stopExtras();
    if(model) model.rotation.y = 0;
    loopRot = 0; loopAnimKey = null;

    clearInterval(idleTimer); tapHint.classList.add('hidden');
    isLev=true; state=S.LEVITATING; levX=model.position.x;
    SFX.play('levitate');
    if(navigator.vibrate) navigator.vibrate(80);
    play('BLEG',true);
    showBubble(GRAB_Q[Math.floor(Math.random()*GRAB_Q.length)]);
}

function moveLev(clientX){
    if(!isLev)return;
    // Mapea posición X de pantalla a mundo (-3 a 3)
    const nx=(clientX/innerWidth)*2-1;
    levX=nx*3;
}

function endLev(){
    if(!isLev)return;
    isLev=false;
    model.position.x=0; model.position.y=0; model.rotation.z=0;
    state=S.FALLING; hideBubble();
    SFX.stop('levitate');  // cortar levitate inmediatamente
    SFX.play('caida');     // luego suena la caída
    showBubble('¡¡AY!! 😵');
    koCount++; hitCount=0; totalHits++; koCnt.textContent=koCount;
    flashScreen(); resetPips();
    play('FALL',false,()=>{
        SFX.play('ko');    // suena el ko al tocar el suelo
        state=S.GROUND; play('GND',true); hideBubble();
        setTimeout(()=>{
            state=S.GETUP; model.position.set(0,0,0);
            SFX.play('levantar');
            showBubble('¡Me caíste muy bien...! 😅');
            play('GETUP',false,()=>{
                setTimeout(hideBubble,600);
                startIdle();
            });
        },1800);
    });
    if(navigator.vibrate) navigator.vibrate([50,30,100]);
}

// Ending desactivado — el juego es infinito
function showEnding(){ startIdle(); }
// ---- UI Helpers ----
function showBubble(t){bubbleTxt.textContent=t;bubble.classList.remove('hidden');}
function hideBubble(){bubble.classList.add('hidden');}
function flashScreen(){hitFlash.classList.add('flash');setTimeout(()=>hitFlash.classList.remove('flash'),180);}
function updatePips(){for(let i=0;i<3;i++){if(i<hitCount)pips[i].classList.add('hit');else pips[i].classList.remove('hit','hard');}}
function resetPips(){pips.forEach(p=>p.classList.remove('hit','hard'));}

// ---- FAB Menu ----
const fabMain = document.getElementById('fab-main');
const fabSub  = document.getElementById('fab-sub');
const btnLag  = document.getElementById('btn-lagartija');
const btnSalt = document.getElementById('btn-salto');
const btnBack = document.getElementById('btn-backflip');
const btnVolt = document.getElementById('btn-voltereta');
const btnMiga = document.getElementById('btn-migajear');
const btnBail = document.getElementById('btn-bailar');
const btnFoto = document.getElementById('btn-foto');
let fabOpen = false;
let fotoCounter = 1;

function toggleFab(){
    fabOpen = !fabOpen;
    fabSub.classList.toggle('fab-sub-hidden', !fabOpen);
    fabMain.classList.toggle('open', fabOpen);
}

fabMain.addEventListener('click', e=>{ e.stopPropagation(); toggleFab(); });
fabMain.addEventListener('touchend', e=>{ e.preventDefault(); e.stopPropagation(); toggleFab(); },{passive:false});

let loopRot = 0;
let loopAnimKey = null;

function playExtra(animKey, bubbleTxt2, rot=0){
    if (state !== S.IDLE && state !== S.LOOPING) return;

    // Detener sonidos de ejercicios anteriores
    stopExtras();

    // Restaurar rotación previa
    if (model) model.rotation.y = 0;

    clearInterval(idleTimer);
    tapHint.classList.add('hidden');
    toggleFab();
    state = S.LOOPING;
    loopRot = rot;
    loopAnimKey   = animKey;

    if (model) model.rotation.y = rot;
    showBubble(bubbleTxt2);
    play(animKey, true);

    if (animKey === 'LAG')       SFX.play('updow');
    if (animKey === 'SALTO')     SFX.play('saltotijera');
    if (animKey === 'BACKFLIP')  SFX.play('backflip');
    if (animKey === 'VOLTERETA') SFX.play('voltereta');
    if (animKey === 'MIGAJA')    SFX.play('migajas');
    if (animKey === 'DANCE')     SFX.play('dance');
    if (animKey === 'MOSTRAR') {
        SFX.play('tada');
        document.getElementById('photo-img').src = 'images/' + fotoCounter + '.jpeg';
        document.getElementById('photo-frame').classList.remove('hidden');
        fotoCounter = fotoCounter >= 9 ? 1 : fotoCounter + 1;
    }
}

function stopLoop(){
    if (state !== S.LOOPING) return;
    stopExtras();
    if (model) model.rotation.y = 0;
    loopRot = 0;
    loopAnimKey   = null;
    hideBubble();
    startIdle();
}

btnLag.addEventListener('click',  e=>{ e.stopPropagation(); playExtra('LAG',  '¡Dame 20! 💪', Math.PI/2); });
btnSalt.addEventListener('click', e=>{ e.stopPropagation(); playExtra('SALTO','¡Salto tijera go! ✂️', 0); });
btnBack.addEventListener('click', e=>{ e.stopPropagation(); playExtra('BACKFLIP','¡Modo ninja! 🤸', 0); });
btnVolt.addEventListener('click', e=>{ e.stopPropagation(); playExtra('VOLTERETA','¡Rodaaaaando! 🔄', Math.PI); });
btnMiga.addEventListener('click', e=>{ e.stopPropagation(); playExtra('MIGAJA','¡Modo oruga! 🐛', Math.PI); });
btnBail.addEventListener('click', e=>{ e.stopPropagation(); playExtra('DANCE','¡A bailar! 🕺', 0); });
btnFoto.addEventListener('click', e=>{ e.stopPropagation(); playExtra('MOSTRAR','Tadaaaa! 🎩', 0); });

btnLag.addEventListener('touchend',  e=>{ e.preventDefault(); e.stopPropagation(); playExtra('LAG',  '¡Dame 20! 💪', Math.PI/2); },{passive:false});
btnSalt.addEventListener('touchend', e=>{ e.preventDefault(); e.stopPropagation(); playExtra('SALTO','¡Salto tijera go! ✂️', 0); },{passive:false});
btnBack.addEventListener('touchend', e=>{ e.preventDefault(); e.stopPropagation(); playExtra('BACKFLIP','¡Modo ninja! 🤸', 0); },{passive:false});
btnVolt.addEventListener('touchend', e=>{ e.preventDefault(); e.stopPropagation(); playExtra('VOLTERETA','¡Rodaaaaando! 🔄', Math.PI); },{passive:false});
btnMiga.addEventListener('touchend', e=>{ e.preventDefault(); e.stopPropagation(); playExtra('MIGAJA','¡Modo oruga! 🐛', Math.PI); },{passive:false});
btnBail.addEventListener('touchend', e=>{ e.preventDefault(); e.stopPropagation(); playExtra('DANCE','¡A bailar! 🕺', 0); },{passive:false});
btnFoto.addEventListener('touchend', e=>{ e.preventDefault(); e.stopPropagation(); playExtra('MOSTRAR','Tadaaaa! 🎩', 0); },{passive:false});

// Cerrar menú si se toca fuera
document.addEventListener('touchstart', e=>{
    if(fabOpen && !document.getElementById('fab-wrap').contains(e.target)) toggleFab();
},{passive:true});


// ===================================================
// CONTROLES: zona de toque invisible sobre el personaje
// ===================================================
let tapCount=0, tapTimer=null, lpTimer=null, lpFired=false;
const TAP_WIN=380;   // ventana para acumular taps (ms)
const LP_MS=550;     // ms para long press

// Cada toque = un golpe inmediato (sin ventana de acumulación)
function execTaps(_n){
    // Ya no se usa — cada tap ejecuta doHit() directamente
    doHit();
}

touchZone.addEventListener('touchstart', e=>{
    e.preventDefault();
    // Permitir interacción desde IDLE, LOOPING o cuando ya levita
    if(state!==S.IDLE && state!==S.LOOPING && !isLev) return;
    lpFired=false;
    lpTimer=setTimeout(()=>{
        // Long press = levitar (desde IDLE o ejercicio en bucle)
        if(state!==S.IDLE && state!==S.LOOPING) return;
        lpFired=true;
        clearTimeout(tapTimer); tapCount=0;
        startLev();
    }, LP_MS);
},{passive:false});

touchZone.addEventListener('touchmove', e=>{
    e.preventDefault();
    if(!isLev)return;
    moveLev(e.touches[0].clientX);
},{passive:false});

touchZone.addEventListener('touchend', e=>{
    e.preventDefault();
    clearTimeout(lpTimer);

    if(isLev){ endLev(); return; }
    if(lpFired) return;

    // Durante ejercicio: toque = parar bucle Y golpear inmediatamente
    if(state===S.LOOPING){
        stopExtras();
        if(model) model.rotation.y = 0;
        loopRot = 0; loopAnimKey = null;
        hideBubble(); clearInterval(idleTimer);
        state = S.IDLE; // pasar a IDLE sin animar, doHit lo interrumpe
        doHit();
        return;
    }

    // Golpe inmediato — sin esperar ventana de acumulación
    doHit();
},{passive:false});

// Fallback mouse (desktop / pruebas)
touchZone.addEventListener('click', ()=>{
    if(state===S.LOOPING){ stopLoop(); return; }
    doHit();
});

// ===================================================
// RENDER LOOP
// ===================================================
let camT=0;
const clock=new THREE.Clock();

function animate(){
    requestAnimationFrame(animate);
    const dt=clock.getDelta();
    if(mixer) mixer.update(dt);

    // Levitar: flotar y seguir dedo
    if(isLev && model){
        floatP+=dt*2.5;
        model.position.x+=(levX-model.position.x)*0.1;
        const ty=1.8+Math.sin(floatP)*0.12;
        model.position.y+=(ty-model.position.y)*0.08;
        model.rotation.z=Math.sin(floatP*0.7)*0.1;
    } else if(model){
        model.rotation.z+=(0-model.rotation.z)*0.1;
    }

    // Sutil balanceo de cámara
    if(!isLev){
        camT+=dt;
        camera.position.x=Math.sin(camT*0.3)*0.15;
        camera.position.y=1.4+Math.sin(camT*0.5)*0.05;
    }

    renderer.render(scene,camera);
}

window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
});

// ---- Start ----
SFX.init();
animate(); // render loop corre desde el inicio (muestra fondo 3D durante carga)

loadAll().then(()=>{
    // Ocultar pantalla de carga
    loaderScreen.classList.add('fade-out');
    setTimeout(()=>{ loaderScreen.style.display='none'; }, 900);

    // Mostrar botón de inicio
    const startScreen = document.getElementById('start-screen');
    const startBtn    = document.getElementById('start-btn');
    startScreen.classList.remove('hidden');

    function beginGame(){
        startScreen.classList.add('hidden');

        // Desbloquear TODOS los audios con este gesto del usuario
        Object.values(SFX.sounds).forEach(a=>{
            const saved = a.volume;
            a.volume = 0;
            a.play().then(()=>{ a.pause(); a.currentTime=0; a.volume=saved; }).catch(()=>{ a.volume=saved; });
        });

        // Mostrar HUD y FAB
        hud.classList.remove('hidden');
        document.getElementById('fab-wrap').classList.remove('hidden');

        // Iniciar caminata (el audio ya está desbloqueado)
        setTimeout(walkin, 100);
    }

    startBtn.addEventListener('click',    beginGame, { once: true });
    startBtn.addEventListener('touchend', e=>{ e.preventDefault(); beginGame(); }, { once: true, passive: false });
});
