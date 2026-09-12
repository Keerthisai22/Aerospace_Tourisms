/* =========================================================================
   AERO ADDICTZ — front-end interactivity
   Talks to the Flask backend at API_BASE when available, otherwise falls
   back to built-in demo data so the site always works standalone.
   ========================================================================= */

const API_BASE = window.location.hostname ? `${window.location.protocol}//${window.location.hostname}:5000` : 'http://localhost:5000';

/* ---------------------------- Starfield ---------------------------- */
(function starfield() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = document.documentElement.scrollHeight;
  }

  function makeStars() {
    const count = Math.floor((w * h) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.4 + 0.2,
      speed: Math.random() * 0.4 + 0.05,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.twinkle += 0.02;
      const alpha = 0.4 + Math.sin(s.twinkle) * 0.4;
      ctx.beginPath();
      ctx.fillStyle = `rgba(247,247,255,${Math.max(0, alpha)})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      s.y += s.speed;
      if (s.y > h) s.y = 0;
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); makeStars(); });
  resize();
  makeStars();
  draw();
})();

/* ---------------------------- Navbar / mobile menu ---------------------------- */
const navBurger = document.getElementById('navBurger');
const navLinks = document.getElementById('navLinks');
navBurger.addEventListener('click', () => navLinks.classList.toggle('is-open'));
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('is-open')));

document.getElementById('navCtaBtn').addEventListener('click', () => {
  document.getElementById('seats').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('scrollCue').addEventListener('click', () => {
  document.getElementById('journeys').scrollIntoView({ behavior: 'smooth' });
});

['finalCtaBtn', 'reserveBtn'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => document.getElementById('seats').scrollIntoView({ behavior: 'smooth' }));
});

document.getElementById('watchExperienceBtn').addEventListener('click', () => {
  openChat();
  pushBotMessage("Here's the short version 🎬 — 90 seconds of thunder on the way up, total silence at the top, and Earth hanging there like it's posing for you. Want details on a specific mission?");
});

/* ---------------------------- Scroll reveal ---------------------------- */
const revealTargets = document.querySelectorAll('.journey-card, .safety-card, .section-head, .cabin-copy, .cabin-visual, .suit-copy, .suit-visual, .seat-wrap, .fleet-wrap');
revealTargets.forEach(el => el.classList.add('reveal'));

const timelineSteps = document.querySelectorAll('.timeline-step');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
    }
  });
}, { threshold: 0.2 });

revealTargets.forEach(el => observer.observe(el));
timelineSteps.forEach(el => observer.observe(el));

/* ---------------------------- Missions (fleet grid) ---------------------------- */
async function loadMissions() {
  try {
    const res = await fetch(`${API_BASE}/api/missions`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) throw new Error('bad response');
    await res.json();
    // Backend confirmed reachable — static markup already reflects the same
    // content, so nothing else to swap in for this demo build.
  } catch (e) {
    // Offline / no backend running — static markup already shown is the fallback.
  }
}
loadMissions();

document.querySelectorAll('.journey-explore').forEach(btn => {
  btn.addEventListener('click', (e) => {
    if (btn.disabled) return;
    const card = e.target.closest('.journey-card');
    const mission = card?.dataset.mission || 'mission';
    openChat();
    pushBotMessage(`Great choice — the ${mission} route is one of my favorites. Want me to walk you through pricing, training, or what to pack?`);
  });
});

/* ---------------------------- Fleet hotspots ---------------------------- */
const fleetInfo = {
  cabin: ['Passenger cabin', 'Six reclining seats, ambient lighting, and zero-g handholds within arm\'s reach of every window.'],
  windows: ['Panoramic windows', 'Radiation-rated glass with an unobstructed 180° view of Earth and the black beyond.'],
  deck: ['Flight deck', 'Two-pilot deck with full manual override, backed by triple-redundant autonomous guidance.'],
  propulsion: ['Propulsion system', 'Reusable liquid-fuel engines rated for over 100 flights before major overhaul.'],
  safety: ['Safety systems', 'Launch-abort thrusters, redundant parachutes, and a pressurized hull rated well past mission max.'],
};

const fleetPanelTitle = document.getElementById('fleetPanelTitle');
const fleetPanelText = document.getElementById('fleetPanelText');

document.querySelectorAll('#fleetShip .hotspot').forEach(dot => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('#fleetShip .hotspot').forEach(d => d.classList.remove('is-active'));
    dot.classList.add('is-active');
    const key = dot.dataset.panel;
    const [title, text] = fleetInfo[key];
    fleetPanelTitle.textContent = title;
    fleetPanelText.textContent = text;
  });
});

/* ---------------------------- Suit hotspots ---------------------------- */
const suitInfo = {
  helmet: 'Bubble helmet with an anti-fog, auto-tinting visor that reacts to sunlight in milliseconds.',
  life: 'Closed-loop life support scrubs CO₂ and holds 8 hours of breathable air, with a 2-hour emergency reserve.',
  thermal: 'Multi-layer insulation handles everything from -150°C shadow to +120°C direct sun.',
  comm: 'Encrypted, low-latency comms link straight to mission control and your crewmates.',
  mobility: 'Flexible joint bearings at the shoulders, hips, and knees for full range of motion in zero-g.',
};
const suitText = document.getElementById('suitText');
document.querySelectorAll('#suitVisual .hotspot').forEach(dot => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('#suitVisual .hotspot').forEach(d => d.classList.remove('is-active'));
    dot.classList.add('is-active');
    suitText.textContent = suitInfo[dot.dataset.suit];
  });
});

/* ---------------------------- Mission Control HUD ---------------------------- */
function animateNumber(el, target, decimals = 0, duration = 1600) {
  const start = performance.now();
  const from = 0;
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = from + (target - from) * eased;
    el.textContent = decimals ? value.toFixed(decimals) : Math.round(value).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const hudSection = document.getElementById('hud');
let hudStarted = false;
const hudObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !hudStarted) {
      hudStarted = true;
      animateNumber(document.getElementById('hudAltitude'), 100);
      animateNumber(document.getElementById('hudVelocity'), 7.8, 1);
      animateNumber(document.getElementById('hudDistance'), 400);
      document.getElementById('hudStatus').textContent = 'ORBITAL';
      startFlightClock();
    }
  });
}, { threshold: 0.3 });
hudObserver.observe(hudSection);

function startFlightClock() {
  let seconds = 9  * 3600 + 47 * 60 + 18; // 09:47:18 baseline, ticking upward
  const el = document.getElementById('hudFlightTime');
  setInterval(() => {
    seconds += 1;
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    el.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

/* ---------------------------- Seat map ---------------------------- */
const seatTypes = {
  standard: { label: 'Standard window', desc: 'A comfortable seat with a side-facing view of Earth.' },
  panoramic: { label: 'Panoramic window', desc: 'Wraparound glass for an uninterrupted, Earth-facing view.' },
  premium: { label: 'Premium observation', desc: 'The best seat on the ship — full recline, dedicated skylight, and first access to the observation deck.' },
};

const seatLayout = [
  'standard','standard','panoramic','panoramic',
  'standard','premium','premium','standard',
  'panoramic','panoramic','standard','standard',
];

const seatMap = document.getElementById('seatMap');
const seatInfo = document.getElementById('seatInfo');

seatLayout.forEach((type, i) => {
  const row = String.fromCharCode(65 + Math.floor(i / 4));
  const col = (i % 4) + 1;
  const id = `${row}0${col}`;
  const seat = document.createElement('button');
  seat.className = 'seat';
  seat.dataset.type = type;
  seat.dataset.id = id;
  seat.textContent = id;
  seat.addEventListener('click', () => {
    document.querySelectorAll('.seat').forEach(s => s.classList.remove('is-selected'));
    seat.classList.add('is-selected');
    const info = seatTypes[type];
    seatInfo.innerHTML = `
      <h4>Seat ${id}</h4>
      <p><strong>${info.label}</strong> — Earth-facing</p>
      <p>${info.desc}</p>
    `;
  });
  seatMap.appendChild(seat);
});

const legend = document.createElement('div');
legend.className = 'seat-legend';
legend.innerHTML = `
  <span><span class="legend-dot" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--aqua')}"></span>Standard window</span>
  <span><span class="legend-dot" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--violet')}"></span>Panoramic window</span>
  <span><span class="legend-dot" style="background:${getComputedStyle(document.documentElement).getPropertyValue('--yellow')}"></span>Premium observation</span>
`;
seatMap.after(legend);

/* ---------------------------- Countdown ---------------------------- */
const countdownTarget = new Date();
countdownTarget.setDate(countdownTarget.getDate() + 127);
countdownTarget.setHours(countdownTarget.getHours() + 8);

function updateCountdown() {
  const now = new Date();
  let diff = Math.max(0, countdownTarget - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  diff -= days * 1000 * 60 * 60 * 24;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  diff -= hours * 1000 * 60 * 60;
  const minutes = Math.floor(diff / (1000 * 60));
  diff -= minutes * 1000 * 60;
  const seconds = Math.floor(diff / 1000);

  document.getElementById('cdDays').textContent = String(days).padStart(2, '0');
  document.getElementById('cdHours').textContent = String(hours).padStart(2, '0');
  document.getElementById('cdMinutes').textContent = String(minutes).padStart(2, '0');
  document.getElementById('cdSeconds').textContent = String(seconds).padStart(2, '0');
}
updateCountdown();
setInterval(updateCountdown, 1000);

/* ---------------------------- AI Chat widget (Orbi) ---------------------------- */
const chatLauncher = document.getElementById('chatLauncher');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

function openChat() { chatPanel.classList.add('is-open'); }
function closeChat() { chatPanel.classList.remove('is-open'); }

chatLauncher.addEventListener('click', () => chatPanel.classList.toggle('is-open'));
chatClose.addEventListener('click', closeChat);

function pushMessage(text, who) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-bubble--${who}`;
  bubble.textContent = text;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function pushBotMessage(text) { openChat(); pushMessage(text, 'bot'); }

// Small on-device fallback so Orbi still "talks" with zero backend and zero API key.
function localOrbiReply(message) {
  const m = message.toLowerCase();
  if (m.includes('price') || m.includes('cost')) return "Suborbital starts around $250k, orbital stays are quoted per mission, and lunar is wait-list only for now — nobody's flown it yet!";
  if (m.includes('seat')) return "Head down to 'Choose your seat' — panoramic and premium seats fill up first, standard windows are still comfy though.";
  if (m.includes('safe') || m.includes('danger')) return "Every system on the Comet-9 is redundant at least twice, and every traveler completes full pre-flight certification before launch.";
  if (m.includes('gravity') || m.includes('weightless')) return "Zero gravity feels like the moment at the top of a swing that just never comes back down. Most people laugh, a few cry, everyone loves it.";
  if (m.includes('lunar') || m.includes('moon')) return "The lunar flyby is still in development — target year is 2032. Join the waitlist and you'll be first in line.";
  if (m.includes('hi') || m.includes('hello') || m.includes('hey')) return "Hey there! I'm Orbi. Ask me anything about missions, seats, safety, or the spacecraft.";
  return "Good question! I'm running in offline demo mode right now, so my answers are a little scripted — connect the AERO ADDICTZ backend for full AI-powered answers.";
}

async function askOrbi(message) {
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error('bad response');
    const data = await res.json();
    return data.reply || localOrbiReply(message);
  } catch (e) {
    return localOrbiReply(message);
  }
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  pushMessage(text, 'user');
  chatInput.value = '';

  const typing = document.createElement('div');
  typing.className = 'chat-bubble chat-bubble--bot';
  typing.textContent = 'Orbi is typing…';
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const reply = await askOrbi(text);
  typing.textContent = reply;
});

/* ---------------------------- Footer misc links ---------------------------- */
document.getElementById('aboutLink').addEventListener('click', (e) => {
  e.preventDefault();
  openChat();
  pushBotMessage("AERO ADDICTZ is a fictional space tourism company built as a demo — happy to tell you more about the (imaginary) mission!");
});
document.getElementById('contactLink').addEventListener('click', (e) => {
  e.preventDefault();
  openChat();
  pushBotMessage("For a real booking desk you'd reach us at fly@aeroaddictz.example — for this demo, just ask me anything!");
});