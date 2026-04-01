// =============================================
// intro.js — Para Negrita 💜
// =============================================

// --- Audio Manager (listo para cuando tengas los sonidos) ---
const AudioMgr = {
    sounds: {},
    init() {
        // Descomenta cuando tengas los archivos en assets/sounds/
        // this.sounds.bg    = new Audio('assets/sounds/intro_bg.mp3');  this.sounds.bg.loop = true; this.sounds.bg.volume = 0.35;
        // this.sounds.turn  = new Audio('assets/sounds/page_turn.mp3');
        // this.sounds.chime = new Audio('assets/sounds/chime.mp3');
        // this.sounds.heart = new Audio('assets/sounds/heart.mp3');
    },
    play(name) {
        const s = this.sounds[name];
        if (!s) return;
        s.currentTime = 0;
        s.play().catch(() => {});
    },
    stop(name) {
        const s = this.sounds[name];
        if (s) s.pause();
    }
};

// --- Particle Canvas Background ---
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function createParticles() {
    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 14000);
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.8 + 0.3,
            dx: (Math.random() - 0.5) * 0.25,
            dy: -(Math.random() * 0.4 + 0.1),
            alpha: Math.random() * 0.6 + 0.1,
            color: Math.random() > 0.5 ? '168,85,247' : '247,37,133'
        });
    }
}

function drawParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#080112');
    grad.addColorStop(0.5, '#110220');
    grad.addColorStop(1, '#0d0118');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
        ctx.fill();

        p.x += p.dx;
        p.y += p.dy;
        if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
    });
    requestAnimationFrame(drawParticles);
}

// --- Slide Manager ---
let currentSlide = 0;
const totalSlides = 4;
let isAnimating = false;

function goToSlide(index) {
    if (isAnimating || index === currentSlide) return;
    if (index < 0 || index >= totalSlides) return;
    isAnimating = true;

    AudioMgr.play('turn');

    const old = document.getElementById(`slide-${currentSlide}`);
    const next = document.getElementById(`slide-${index}`);

    old.classList.remove('active');
    currentSlide = index;
    next.classList.add('active');

    // Trigger reveal animations
    setTimeout(() => {
        const lines = next.querySelectorAll('.reveal-line');
        lines.forEach(l => l.classList.add('visible'));

        // CTA wrapper special
        const cta = next.querySelector('#cta-wrapper');
        if (cta) setTimeout(() => cta.classList.add('visible'), 600);

        // Hearts rain on last slide
        if (index === 3) spawnHearts();

        isAnimating = false;
    }, 150);

    // Update nav dots
    document.querySelectorAll('.nav-dot').forEach((d, i) => {
        d.classList.toggle('active', i === currentSlide);
    });
}

function nextSlide() { goToSlide(currentSlide + 1); }

// --- Typewriter Effect ---
function typewriter(element, text, speed, onDone) {
    let i = 0;
    element.textContent = '';
    const timer = setInterval(() => {
        element.textContent += text[i];
        i++;
        if (i >= text.length) {
            clearInterval(timer);
            element.classList.add('done');
            if (onDone) onDone();
        }
    }, speed);
}

// --- Hearts Rain ---
function spawnHearts() {
    const container = document.getElementById('hearts-rain');
    if (!container) return;
    const emojis = ['💜', '🌸', '✨', '💫', '💜', '💕'];
    const total = 22;
    for (let i = 0; i < total; i++) {
        setTimeout(() => {
            const h = document.createElement('span');
            h.className = 'float-heart';
            h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            h.style.left = Math.random() * 90 + 5 + '%';
            h.style.bottom = '-10px';
            h.style.animationDuration = (3 + Math.random() * 2) + 's';
            h.style.fontSize = (0.9 + Math.random() * 0.8) + 'rem';
            container.appendChild(h);
            setTimeout(() => h.remove(), 5000);
        }, i * 200);
    }
    AudioMgr.play('heart');
}

// --- Events ---
document.addEventListener('click', e => {
    if (e.target.closest('.nav-dot')) return;
    if (e.target.closest('.skip-btn')) return;
    if (e.target.closest('.cta-button')) return;
    nextSlide();
});

document.querySelectorAll('.nav-dot').forEach(dot => {
    dot.addEventListener('click', e => {
        e.stopPropagation();
        goToSlide(parseInt(dot.dataset.index));
    });
});

document.getElementById('skip-btn').addEventListener('click', e => {
    e.stopPropagation();
    goToSlide(3);
});

document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
    if (e.key === 'ArrowLeft') goToSlide(currentSlide - 1);
});

// Touch / swipe
let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', e => {
    const dx = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 50) dx > 0 ? nextSlide() : goToSlide(currentSlide - 1);
    else if (Math.abs(dx) < 15) nextSlide();
});

// --- Init ---
window.addEventListener('resize', () => { resizeCanvas(); createParticles(); });
resizeCanvas();
createParticles();
drawParticles();
AudioMgr.init();

// Typewriter on first slide
setTimeout(() => {
    const tw = document.getElementById('tw-main');
    typewriter(tw, 'Negrita...', 90, () => {
        // Pulse the tap hint
    });
}, 500);
