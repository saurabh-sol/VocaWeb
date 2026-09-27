/**
 * Sample sites for the landing-page build demo. Each one is real HTML and CSS that the
 * demo writes into a live preview frame section by section, the way a v1 build lands.
 */

export interface DemoSection {
  /** What the build log says while this block is written. */
  log: string;
  html: string;
}

export interface DemoSite {
  id: string;
  /** Short label for the picker. */
  label: string;
  /** How the request reaches VocaWeb in the demo. */
  mode: 'chat' | 'voice';
  prompt: string;
  css: string;
  sections: DemoSection[];
}

const BASE_CSS = `
*{box-sizing:border-box;margin:0}
html{scroll-behavior:smooth;scrollbar-width:none}
html::-webkit-scrollbar{display:none}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.5}
a{color:inherit;text-decoration:none}
section,header,footer{animation:land .6s cubic-bezier(.16,1,.3,1) both}
@keyframes land{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){section,header,footer{animation:none}}
`;

const bakery: DemoSite = {
  id: 'bakery',
  label: 'Bakery',
  mode: 'chat',
  prompt: 'A site for my bakery with the menu and opening hours',
  css: `${BASE_CSS}
body{background:#fbf3e4;color:#2a1a10}
.nav{display:flex;justify-content:space-between;align-items:center;padding:30px 72px;font-weight:600}
.nav b{font-size:26px;letter-spacing:-.5px}
.nav span{display:flex;gap:34px;font-size:17px}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;padding:40px 72px 80px;align-items:center}
.hero h1{font-size:92px;line-height:.96;letter-spacing:-3.5px;font-weight:700}
.hero h1 i{font-style:normal;color:#c2410c}
.hero p{font-size:22px;margin:26px 0 34px;max-width:460px;color:#6b4a35}
.btn{display:inline-block;background:#2a1a10;color:#fbf3e4;padding:18px 30px;border-radius:999px;font-weight:600;font-size:18px}
.loaf{aspect-ratio:1;border-radius:50% 50% 46% 54%/58% 56% 44% 42%;background:radial-gradient(circle at 34% 30%,#f2b872,#c2410c 62%,#7c2d12)}
.menu{background:#2a1a10;color:#fbf3e4;padding:72px}
.menu h2{font-size:48px;letter-spacing:-1.5px;margin-bottom:34px}
.menu ul{list-style:none;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:0 64px}
.menu li{display:flex;justify-content:space-between;padding:20px 0;border-bottom:1px dashed #6b4a35;font-size:21px}
.menu li span{color:#f2b872}
.hours{display:flex;justify-content:space-between;align-items:center;padding:56px 72px;font-size:20px}
.hours b{font-size:30px;letter-spacing:-.8px}
`,
  sections: [
    {
      log: 'Header and hero',
      html: `<header class="nav"><b>Ovenlight</b><span><a>Menu</a><a>Hours</a><a>Find us</a></span></header>
<section class="hero"><div><h1>Bread worth the <i>early alarm.</i></h1><p>Sourdough, laminated pastry and strong coffee, baked from 4am on Carver Street.</p><a class="btn">See the menu</a></div><div class="loaf"></div></section>`,
    },
    {
      log: 'Menu section',
      html: `<section class="menu"><h2>Out of the oven today</h2><ul><li>Country sourdough<span>7.50</span></li><li>Butter croissant<span>3.80</span></li><li>Cardamom bun<span>4.20</span></li><li>Seeded rye<span>8.00</span></li><li>Pain au chocolat<span>4.40</span></li><li>Flat white<span>3.60</span></li></ul></section>`,
    },
    {
      log: 'Opening hours',
      html: `<footer class="hours"><b>Open Tuesday to Sunday</b><span>7:00 to 15:00, or until the shelves are empty</span></footer>`,
    },
  ],
};

const portfolio: DemoSite = {
  id: 'portfolio',
  label: 'Portfolio',
  mode: 'voice',
  prompt: 'Make me a portfolio, I shoot product photography',
  css: `${BASE_CSS}
body{background:#0c0c0d;color:#f4f4f2}
.nav{display:flex;justify-content:space-between;padding:32px 72px;font-size:17px;color:#a1a1a1}
.nav b{color:#f4f4f2;font-weight:600}
.hero{padding:70px 72px 60px}
.hero h1{font-size:118px;line-height:.92;letter-spacing:-5px;font-weight:600;max-width:1000px}
.hero h1 i{font-style:normal;color:#d4ff3a}
.hero p{font-size:22px;color:#a1a1a1;margin-top:30px;max-width:520px}
.grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;grid-auto-rows:230px;gap:16px;padding:0 72px 72px}
.grid div{border-radius:14px}
.grid .a{grid-row:span 2;background:linear-gradient(160deg,#d4ff3a,#3f6212)}
.grid .b{background:linear-gradient(200deg,#fb7185,#881337)}
.grid .c{background:linear-gradient(140deg,#e5e5e5,#525252)}
.grid .d{grid-column:span 2;background:linear-gradient(100deg,#38bdf8,#1e3a8a)}
.contact{display:flex;justify-content:space-between;align-items:center;padding:52px 72px;border-top:1px solid #2a2a2a;font-size:20px}
.contact b{font-size:34px;letter-spacing:-1px;font-weight:600}
.contact a{border:1.5px solid #f4f4f2;padding:16px 28px;border-radius:999px}
`,
  sections: [
    {
      log: 'Header and intro',
      html: `<header class="nav"><b>Mira Okafor</b><span>Work &nbsp; About &nbsp; Contact</span></header>
<section class="hero"><h1>Objects, lit like <i>characters.</i></h1><p>Product and still-life photography for brands that sweat the details.</p></section>`,
    },
    {
      log: 'Work grid',
      html: `<section class="grid"><div class="a"></div><div class="b"></div><div class="c"></div><div class="d"></div></section>`,
    },
    {
      log: 'Contact strip',
      html: `<footer class="contact"><b>Booking shoots for spring</b><a>Start a project</a></footer>`,
    },
  ],
};

const trailApp: DemoSite = {
  id: 'app',
  label: 'App launch',
  mode: 'chat',
  prompt: 'Landing page for a hiking app with three features and a signup',
  css: `${BASE_CSS}
body{background:#eef4ee;color:#0f2417}
.nav{display:flex;justify-content:space-between;align-items:center;padding:30px 72px;font-size:17px}
.nav b{font-size:24px;letter-spacing:-.5px}
.nav a{background:#0f2417;color:#eef4ee;padding:12px 22px;border-radius:10px;font-weight:600}
.hero{padding:56px 72px 76px;max-width:1040px}
.hero h1{font-size:104px;line-height:.95;letter-spacing:-4.5px;font-weight:700}
.hero h1 i{font-style:normal;color:#15803d}
.hero p{font-size:23px;color:#3f5a48;margin:28px 0 0;max-width:560px}
.feats{display:grid;grid-template-columns:1.5fr 1fr;gap:18px;padding:0 72px 72px}
.feats div{border-radius:18px;padding:34px;min-height:230px;display:flex;flex-direction:column;justify-content:flex-end}
.feats h3{font-size:30px;letter-spacing:-1px}
.feats p{font-size:18px;opacity:.8;margin-top:6px}
.feats .a{grid-row:span 2;background:#0f2417;color:#eef4ee}
.feats .b{background:#bbf7d0}
.feats .c{background:#fde68a}
.join{display:flex;gap:14px;align-items:center;padding:0 72px 72px}
.join input{flex:1;max-width:460px;padding:20px 22px;border-radius:12px;border:2px solid #0f2417;font-size:19px;background:#fff}
.join a{background:#15803d;color:#fff;padding:20px 30px;border-radius:12px;font-weight:600;font-size:19px}
`,
  sections: [
    {
      log: 'Header and hero',
      html: `<header class="nav"><b>Ridgeline</b><a>Get the app</a></header>
<section class="hero"><h1>Know the trail <i>before your boots do.</i></h1><p>Offline maps, honest difficulty ratings and weather that updates at the trailhead.</p></section>`,
    },
    {
      log: 'Feature grid',
      html: `<section class="feats"><div class="a"><h3>Maps that work with no signal</h3><p>Download a region once and keep it.</p></div><div class="b"><h3>Rated by hikers</h3><p>Not by marketing.</p></div><div class="c"><h3>Trailhead weather</h3><p>Hour by hour.</p></div></section>`,
    },
    {
      log: 'Signup form',
      html: `<section class="join"><input placeholder="you@example.com" aria-label="Email"><a>Join the beta</a></section>`,
    },
  ],
};

export const DEMO_SITES: DemoSite[] = [bakery, portfolio, trailApp];

/** Empty document the preview frame starts from. Styles stay off until the build applies them. */
export function demoShell(site: DemoSite): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1200"><style id="site-css" media="not all">${site.css}</style></head><body></body></html>`;
}
