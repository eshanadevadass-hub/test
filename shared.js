/* Every page except home.html requires an active local profile -- redirect
   to the gate immediately (before the rest of this file, or the page's own
   script, does any real work) rather than waiting until the bottom-of-file
   init block, to keep the flash of protected content as short as possible.
   getActiveAccount/loadAccountsData below are function declarations, so
   they're hoisted and safe to call from here -- but ACCOUNTS_STORAGE_KEY is
   a const those functions read, and a const is NOT usable before its own
   declaration line runs (the "temporal dead zone"), so it has to be defined
   here too rather than left down with the rest of the accounts code. */
const ACCOUNTS_STORAGE_KEY = 'colouristic.accounts.v1';
function currentPageFile(){
  const last = location.pathname.split('/').pop();
  return last || 'index.html';
}
function hasUsernameConflict(account){
  const data = loadAccountsData();
  return data.accounts.some(a=>a.id!==account.id && a.username.toLowerCase()===account.username.toLowerCase());
}
function enforceAccountGate(){
  const page = currentPageFile();
  if(page==='home.html') return;
  const account = getActiveAccount();
  if(!account){
    const dest = 'home.html?next='+encodeURIComponent(page+location.search+location.hash);
    location.replace(dest);
    return;
  }
  if(page!=='profile.html' && hasUsernameConflict(account)){
    location.replace('profile.html?usernameConflict=1');
  }
}
enforceAccountGate();

function hslToRgb(h,s,l){
  s/=100; l/=100;
  const c=(1-Math.abs(2*l-1))*s;
  const hp=h/60;
  const x=c*(1-Math.abs(hp%2-1));
  let r=0,g=0,b=0;
  if(hp>=0&&hp<1){r=c;g=x;} else if(hp<2){r=x;g=c;}
  else if(hp<3){g=c;b=x;} else if(hp<4){g=x;b=c;}
  else if(hp<5){r=x;b=c;} else {r=c;b=x;}
  const m=l-c/2;
  return [Math.round((r+m)*255),Math.round((g+m)*255),Math.round((b+m)*255)];
}
function hslToHex(h,s,l){
  const [r,g,b]=hslToRgb(h,s,l);
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function rgbToHsl(r,g,b){
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0, s=0, l=(max+min)/2;
  if(max!==min){
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h*=60;
  }
  return {h, s:s*100, l:l*100};
}
function expandHex3(hex){
  return '#'+hex.slice(1).split('').map(c=>c+c).join('');
}

/* WCAG 2 contrast math -- shared by the wheel's base-vs-black/white check
   and the palette generator's all-pairs contrast matrix. */
function relLuminance(r,g,b){
  const lin = v=>{ v/=255; return v<=0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
  return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
}
function contrastRatio(rgb1, rgb2){
  const L1 = relLuminance(rgb1[0],rgb1[1],rgb1[2]);
  const L2 = relLuminance(rgb2[0],rgb2[1],rgb2[2]);
  const lighter = Math.max(L1,L2), darker = Math.min(L1,L2);
  return (lighter+0.05)/(darker+0.05);
}
function contrastLevel(ratio){
  if(ratio>=7) return {label:'AAA', pass:true};
  if(ratio>=4.5) return {label:'AA', pass:true};
  if(ratio>=3) return {label:'AA Large', pass:true};
  return {label:'Fail', pass:false};
}

/* ---- Tonal remix ----
   A flat palette of 5-ish colours isn't enough to actually build something
   with -- you need lighter/darker steps for hover states, borders, disabled
   text, and so on. This turns any single swatch into a 7-step tint-to-shade
   ramp, keeping hue fixed and gently pulling saturation down toward the
   extremes (a very light tint or very dark shade of a highly saturated
   colour looks more natural a little desaturated than neon). Lightness
   offsets are relative to the input, not fixed stops, so the ramp always
   passes through the original colour in the middle. */
function generateTonalScale(h, s, l){
  const offsets = [45, 30, 15, 0, -15, -30, -45];
  return offsets.map(off=>({
    h,
    s: Math.max(0, Math.min(100, s - Math.abs(off)*0.15)),
    l: Math.max(4, Math.min(96, l+off))
  }));
}
function renderTonalRemix(container, colors){
  container.innerHTML = '';
  colors.forEach(c=>{
    const r = parseInt(c.hex.slice(1,3),16), g = parseInt(c.hex.slice(3,5),16), b = parseInt(c.hex.slice(5,7),16);
    const hsl = rgbToHsl(r,g,b);
    const scale = generateTonalScale(hsl.h, hsl.s, hsl.l);

    const row = document.createElement('div');
    row.className = 'tonal-remix-row';

    const label = document.createElement('span');
    label.className = 'tonal-remix-label';
    label.textContent = c.label || c.hex;
    label.title = c.label || c.hex;

    const strip = document.createElement('div');
    strip.className = 'tonal-remix-strip';
    scale.forEach(step=>{
      const stepHex = hslToHex(step.h, step.s, step.l).toUpperCase();
      const sw = document.createElement('div');
      sw.className = 'tonal-remix-swatch';
      sw.style.background = stepHex;
      sw.title = stepHex+' — click to copy';
      sw.addEventListener('click', ()=>{
        navigator.clipboard.writeText(stepHex);
        addRecentColor(stepHex);
        sw.classList.add('chip-pulse');
        setTimeout(()=>sw.classList.remove('chip-pulse'), 500);
      });
      strip.appendChild(sw);
    });

    row.appendChild(label);
    row.appendChild(strip);
    container.appendChild(row);
  });
}

/* ---- Background context preview ----
   The same colour reads completely differently depending on what surrounds
   it (simultaneous contrast) -- this shows one colour sitting on a curated
   spread of common real backgrounds (paper white, dark-mode navy, pure
   black/white, greys) plus its own complementary hue, so you can sanity-
   check "does this still work" rather than judging it floating alone on
   the app's own dark background. */
function backgroundPreviewSwatches(h, s, l){
  return [
    {label:'White', hex:'#FFFFFF'},
    {label:'Black', hex:'#000000'},
    {label:'Dark grey', hex:'#2A2A2A'},
    {label:'Cream', hex:'#F5F0E6'},
    {label:'Dark navy', hex:'#1A1F2E'},
    {label:'Complementary', hex: hslToHex((h+180)%360, Math.max(s,40), 50).toUpperCase()},
  ];
}
function renderBackgroundPreview(container, hex){
  container.innerHTML = '';
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const hsl = rgbToHsl(r,g,b);
  backgroundPreviewSwatches(hsl.h, hsl.s, hsl.l).forEach(bg=>{
    const br = parseInt(bg.hex.slice(1,3),16), bgg = parseInt(bg.hex.slice(3,5),16), bb = parseInt(bg.hex.slice(5,7),16);
    const bgIsLight = relLuminance(br,bgg,bb) > 0.4;

    const tile = document.createElement('div');
    tile.className = 'bg-preview-tile';
    tile.style.background = bg.hex;

    const text = document.createElement('span');
    text.className = 'bg-preview-text';
    text.style.color = hex;
    text.textContent = hex.toUpperCase();

    const label = document.createElement('span');
    label.className = 'bg-preview-label';
    label.style.color = bgIsLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';
    label.textContent = bg.label;

    tile.appendChild(text);
    tile.appendChild(label);
    container.appendChild(tile);
  });
}

function rgbToLab(r,g,b){
  let [R,G,B] = [r,g,b].map(v=>{
    v/=255;
    return v>0.04045 ? Math.pow((v+0.055)/1.055,2.4) : v/12.92;
  });
  const X = R*0.4124+G*0.3576+B*0.1805;
  const Y = R*0.2126+G*0.7152+B*0.0722;
  const Z = R*0.0193+G*0.1192+B*0.9505;
  const Xn=0.95047, Yn=1.0, Zn=1.08883;
  const f = t=> t>0.008856 ? Math.cbrt(t) : (7.787*t+16/116);
  const fx=f(X/Xn), fy=f(Y/Yn), fz=f(Z/Zn);
  const L = 116*fy-16;
  const a = 500*(fx-fy);
  const bb = 200*(fy-fz);
  return {L,a,b:bb};
}

/* A curated (not exhaustive) list of human-readable colour names, specified as
   HSL so they're generated from the same colour math as everything else in the
   app rather than hand-picked hex values. Matched by nearest Lab distance
   (perceptually closer to how people judge "which named colour is this" than
   RGB or HSL distance would be). */
const COLOR_NAMES = [
  {n:'Black',h:0,s:0,l:0}, {n:'Jet Black',h:0,s:0,l:6}, {n:'Charcoal',h:0,s:0,l:15},
  {n:'Graphite',h:0,s:0,l:25}, {n:'Slate Gray',h:220,s:8,l:38}, {n:'Gray',h:0,s:0,l:50},
  {n:'Ash Gray',h:0,s:0,l:65}, {n:'Silver',h:0,s:0,l:82}, {n:'Snow White',h:0,s:0,l:95}, {n:'White',h:0,s:0,l:100},
  {n:'Ivory',h:45,s:35,l:94}, {n:'Cream',h:42,s:45,l:90}, {n:'Beige',h:38,s:35,l:80},
  {n:'Sand',h:35,s:32,l:68}, {n:'Tan',h:32,s:35,l:56}, {n:'Camel',h:30,s:40,l:48},
  {n:'Khaki',h:52,s:30,l:58}, {n:'Taupe',h:28,s:15,l:42}, {n:'Chestnut',h:22,s:35,l:32},
  {n:'Mahogany',h:14,s:45,l:26}, {n:'Espresso',h:22,s:40,l:16}, {n:'Chocolate',h:22,s:35,l:24},
  {n:'Pale Pink',h:350,s:55,l:88}, {n:'Blush',h:345,s:55,l:85}, {n:'Salmon',h:10,s:65,l:78},
  {n:'Crimson',h:350,s:70,l:45}, {n:'Coral',h:8,s:72,l:62}, {n:'Brick Red',h:8,s:55,l:32},
  {n:'Maroon',h:355,s:55,l:24}, {n:'Ruby',h:350,s:65,l:38}, {n:'Wine',h:352,s:60,l:26},
  {n:'Rose',h:350,s:55,l:52}, {n:'Dusty Rose',h:340,s:30,l:55}, {n:'Raspberry',h:340,s:65,l:42},
  {n:'Peach',h:22,s:70,l:80}, {n:'Apricot',h:28,s:65,l:70}, {n:'Tangerine',h:24,s:80,l:55},
  {n:'Burnt Orange',h:20,s:65,l:35}, {n:'Rust',h:18,s:50,l:38}, {n:'Copper',h:20,s:55,l:42},
  {n:'Terracotta',h:14,s:50,l:48}, {n:'Amber',h:38,s:80,l:52}, {n:'Gold',h:42,s:75,l:52},
  {n:'Bronze',h:35,s:55,l:35}, {n:'Marigold',h:42,s:85,l:56}, {n:'Mustard',h:44,s:60,l:42},
  {n:'Wheat',h:40,s:50,l:75}, {n:'Butter',h:50,s:70,l:82}, {n:'Lemon',h:52,s:80,l:65},
  {n:'Straw',h:48,s:45,l:65}, {n:'Chartreuse',h:75,s:60,l:55}, {n:'Olive',h:65,s:45,l:30},
  {n:'Avocado',h:75,s:40,l:32}, {n:'Moss',h:95,s:30,l:35}, {n:'Sage',h:100,s:22,l:58},
  {n:'Mint',h:150,s:45,l:80}, {n:'Seafoam',h:155,s:45,l:75}, {n:'Green',h:120,s:55,l:42},
  {n:'Grass Green',h:105,s:50,l:45}, {n:'Emerald',h:150,s:60,l:38}, {n:'Jade',h:155,s:50,l:42},
  {n:'Forest Green',h:140,s:55,l:22}, {n:'Pine',h:150,s:35,l:25}, {n:'Aqua',h:180,s:55,l:75},
  {n:'Turquoise',h:178,s:65,l:52}, {n:'Teal',h:185,s:60,l:36}, {n:'Deep Teal',h:190,s:60,l:20},
  {n:'Powder Blue',h:200,s:55,l:82}, {n:'Sky Blue',h:200,s:65,l:62}, {n:'Steel Blue',h:205,s:45,l:45},
  {n:'Cerulean',h:205,s:65,l:48}, {n:'Denim',h:210,s:40,l:42}, {n:'Cobalt',h:215,s:65,l:42},
  {n:'Blue',h:220,s:65,l:52}, {n:'Navy',h:222,s:55,l:24}, {n:'Sapphire',h:228,s:65,l:38},
  {n:'Periwinkle',h:235,s:55,l:78}, {n:'Indigo',h:245,s:50,l:42}, {n:'Slate Blue',h:255,s:40,l:52},
  {n:'Lavender',h:265,s:45,l:83}, {n:'Violet',h:268,s:50,l:52}, {n:'Deep Purple',h:270,s:45,l:26},
  {n:'Orchid',h:288,s:55,l:58}, {n:'Lilac',h:295,s:40,l:80}, {n:'Plum',h:300,s:50,l:38},
  {n:'Eggplant',h:300,s:45,l:22}, {n:'Grape',h:290,s:45,l:32}, {n:'Magenta',h:312,s:65,l:50},
  {n:'Fuchsia',h:322,s:70,l:52}, {n:'Hot Pink',h:328,s:80,l:62}, {n:'Pink',h:335,s:65,l:70},
  {n:'Mauve',h:328,s:28,l:56}, {n:'Berry',h:335,s:55,l:36}
];

/* Curated starter palette packs (library.html) -- ready-made themed
   palettes people can drop straight into their own library instead of
   building one from scratch. Specified as HSL, like COLOR_NAMES, so
   they're generated from the same colour math as everything else. */
const STARTER_PACKS = [
  { id:'autumn', name:'Autumn', desc:'Warm oranges and deep, earthy tones.', colors:[
    {h:20,s:65,l:45,label:'Burnt orange'}, {h:5,s:55,l:35,label:'Deep red'}, {h:45,s:60,l:45,label:'Mustard'},
    {h:20,s:40,l:25,label:'Chestnut'}, {h:42,s:45,l:88,label:'Cream'}
  ]},
  { id:'pastel', name:'Pastel', desc:'Soft, muted tones with a gentle touch.', colors:[
    {h:340,s:60,l:85,label:'Pastel pink'}, {h:265,s:50,l:85,label:'Lavender'}, {h:150,s:45,l:85,label:'Mint'},
    {h:200,s:60,l:85,label:'Baby blue'}, {h:50,s:65,l:85,label:'Buttery yellow'}
  ]},
  { id:'cyberpunk', name:'Cyberpunk', desc:'High-contrast neon against near-black.', colors:[
    {h:330,s:90,l:55,label:'Hot pink'}, {h:195,s:100,l:55,label:'Electric blue'}, {h:130,s:90,l:50,label:'Neon green'},
    {h:280,s:70,l:30,label:'Deep purple'}, {h:260,s:30,l:8,label:'Near-black'}
  ]},
  { id:'ocean', name:'Ocean', desc:'Deep blues and teals with a sandy shore.', colors:[
    {h:220,s:55,l:20,label:'Deep navy'}, {h:185,s:60,l:38,label:'Teal'}, {h:160,s:40,l:70,label:'Seafoam'},
    {h:38,s:35,l:78,label:'Sandy beige'}, {h:8,s:70,l:65,label:'Coral'}
  ]},
  { id:'desert', name:'Desert', desc:'Sun-baked terracotta and dusty neutrals.', colors:[
    {h:14,s:55,l:48,label:'Terracotta'}, {h:35,s:35,l:70,label:'Sand'}, {h:350,s:30,l:65,label:'Dusty rose'},
    {h:95,s:20,l:55,label:'Sage'}, {h:200,s:30,l:70,label:'Sun-bleached blue'}
  ]},
  { id:'forest', name:'Forest', desc:'Deep greens and earthy woodland browns.', colors:[
    {h:145,s:45,l:22,label:'Forest green'}, {h:85,s:30,l:38,label:'Moss'}, {h:25,s:35,l:22,label:'Bark'},
    {h:30,s:15,l:70,label:'Mushroom'}, {h:180,s:15,l:80,label:'Morning mist'}
  ]},
  { id:'sunset', name:'Sunset', desc:'Warm gold and orange fading into dusk purple.', colors:[
    {h:265,s:45,l:25,label:'Dusk purple'}, {h:320,s:60,l:45,label:'Magenta'}, {h:25,s:80,l:55,label:'Orange'},
    {h:42,s:75,l:55,label:'Gold'}, {h:15,s:65,l:82,label:'Pale pink'}
  ]},
  { id:'monochrome', name:'Monochrome', desc:'A warm-neutral grayscale, five tones deep.', colors:[
    {h:30,s:5,l:10,label:'Near-black'}, {h:30,s:5,l:28,label:'Charcoal'}, {h:30,s:5,l:48,label:'Mid grey'},
    {h:30,s:5,l:72,label:'Light grey'}, {h:30,s:8,l:94,label:'Off-white'}
  ]},
  { id:'tropical', name:'Tropical', desc:'Saturated, sun-drenched brights.', colors:[
    {h:330,s:85,l:60,label:'Hot pink'}, {h:90,s:75,l:50,label:'Lime'}, {h:175,s:70,l:50,label:'Turquoise'},
    {h:30,s:90,l:55,label:'Mango'}, {h:50,s:90,l:60,label:'Sunny yellow'}
  ]},
  { id:'winter', name:'Winter', desc:'Icy blues and frosted neutrals.', colors:[
    {h:200,s:25,l:92,label:'Frost'}, {h:200,s:55,l:75,label:'Ice blue'}, {h:220,s:50,l:22,label:'Deep navy'},
    {h:210,s:10,l:60,label:'Silver'}, {h:185,s:35,l:70,label:'Pale teal'}
  ]},
  { id:'vintage', name:'Vintage', desc:'Muted, sun-faded 70s tones.', colors:[
    {h:45,s:55,l:48,label:'Mustard'}, {h:15,s:50,l:42,label:'Burnt sienna'}, {h:75,s:35,l:35,label:'Avocado'},
    {h:185,s:30,l:40,label:'Dusty teal'}, {h:40,s:40,l:85,label:'Cream'}
  ]},
  { id:'jewel', name:'Jewel Tones', desc:'Rich, saturated gemstone colours.', colors:[
    {h:150,s:65,l:32,label:'Emerald'}, {h:215,s:70,l:35,label:'Sapphire'}, {h:350,s:70,l:38,label:'Ruby'},
    {h:275,s:50,l:42,label:'Amethyst'}, {h:35,s:75,l:48,label:'Topaz'}
  ]},
  { id:'candy', name:'Candy', desc:'Playful, sugar-sweet brights.', colors:[
    {h:325,s:80,l:70,label:'Bubblegum'}, {h:195,s:75,l:75,label:'Cotton candy'}, {h:55,s:85,l:70,label:'Lemon'},
    {h:280,s:60,l:55,label:'Grape'}, {h:155,s:60,l:70,label:'Mint'}
  ]},
  { id:'galaxy', name:'Galaxy', desc:'Deep cosmic indigo and violet, starlit.', colors:[
    {h:250,s:55,l:18,label:'Deep indigo'}, {h:270,s:55,l:40,label:'Violet'}, {h:240,s:20,l:92,label:'Starlight'},
    {h:320,s:55,l:55,label:'Nebula pink'}, {h:225,s:60,l:35,label:'Cosmic blue'}
  ]},
  { id:'coffee', name:'Coffee', desc:'Cozy espresso, caramel, and warm milk.', colors:[
    {h:20,s:45,l:15,label:'Espresso'}, {h:22,s:40,l:32,label:'Coffee'}, {h:32,s:55,l:50,label:'Caramel'},
    {h:35,s:35,l:75,label:'Latte'}, {h:38,s:30,l:92,label:'Milk foam'}
  ]},
];

let _colorNamesLab = null;
function nearestColorName(hex){
  if(!_colorNamesLab){
    _colorNamesLab = COLOR_NAMES.map(c=>{
      const [r,g,b] = hslToRgb(c.h,c.s,c.l);
      return {n:c.n, lab:rgbToLab(r,g,b)};
    });
  }
  const clean = hex[0]==='#' ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0,2),16), g = parseInt(clean.slice(2,4),16), b = parseInt(clean.slice(4,6),16);
  const lab = rgbToLab(r,g,b);
  let best=null, bestDist=Infinity;
  for(const c of _colorNamesLab){
    const dL=lab.L-c.lab.L, da=lab.a-c.lab.a, db=lab.b-c.lab.b;
    const dist = dL*dL+da*da+db*db;
    if(dist<bestDist){ bestDist=dist; best=c.n; }
  }
  return best;
}
function appendColorName(infoEl, hex){
  const nameEl = document.createElement('p');
  nameEl.className = 'swatch-name';
  nameEl.textContent = nearestColorName(hex);
  infoEl.appendChild(nameEl);
  return nameEl;
}

// Wheels next to a lightness control must re-call this with the current lightness on every change, not just on init.
function paintStaticWheel(targetCtx, targetSize, lightness=55){
  const c = targetSize/2, rad = c-4;
  const imgData = targetCtx.createImageData(targetSize,targetSize);
  for(let y=0;y<targetSize;y++){
    for(let x=0;x<targetSize;x++){
      const dx=x-c, dy=y-c;
      const dist=Math.sqrt(dx*dx+dy*dy);
      const idx=(y*targetSize+x)*4;
      if(dist<=rad){
        let angle=Math.atan2(dy,dx)*180/Math.PI;
        angle=(angle+90+360)%360;
        const sat=Math.min(dist/rad,1)*100;
        const [r,g,b]=hslToRgb(angle,sat,lightness);
        imgData.data[idx]=r; imgData.data[idx+1]=g; imgData.data[idx+2]=b;
        const edge=rad-dist;
        imgData.data[idx+3]=edge<1.5?Math.max(0,edge/1.5)*255:255;
      } else {
        imgData.data[idx+3]=0;
      }
    }
  }
  targetCtx.putImageData(imgData,0,0);
}

function injectCvdFilters(){
  if(document.getElementById('cvd-protanopia')) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML =
    '<svg width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden;">'
      + '<defs>'
        + '<filter id="cvd-protanopia" color-interpolation-filters="sRGB">'
          + '<feColorMatrix type="matrix" values="0.567 0.433 0.000 0 0 0.558 0.442 0.000 0 0 0.000 0.242 0.758 0 0 0 0 0 1 0"/>'
        + '</filter>'
        + '<filter id="cvd-deuteranopia" color-interpolation-filters="sRGB">'
          + '<feColorMatrix type="matrix" values="0.625 0.375 0.000 0 0 0.700 0.300 0.000 0 0 0.000 0.300 0.700 0 0 0 0 0 1 0"/>'
        + '</filter>'
        + '<filter id="cvd-tritanopia" color-interpolation-filters="sRGB">'
          + '<feColorMatrix type="matrix" values="0.950 0.050 0.000 0 0 0.000 0.433 0.567 0 0 0.000 0.475 0.525 0 0 0 0 0 1 0"/>'
        + '</filter>'
        /* Lighting preview: a per-channel gain (diagonal matrix), like a simplified camera white-balance shift.
           Not a spectral render — just an honest approximation of how each light source's colour temperature
           pushes RGB relative to the sRGB (D65, ~6500K) reference white this app otherwise assumes. */
        + '<filter id="light-warm" color-interpolation-filters="sRGB">'
          + '<feColorMatrix type="matrix" values="1.20 0 0 0 0 0 1.00 0 0 0 0 0 0.65 0 0 0 0 0 1 0"/>'
        + '</filter>'
        + '<filter id="light-daylight" color-interpolation-filters="sRGB">'
          + '<feColorMatrix type="matrix" values="1.05 0 0 0 0 0 1.00 0 0 0 0 0 0.90 0 0 0 0 0 1 0"/>'
        + '</filter>'
        + '<filter id="light-cool" color-interpolation-filters="sRGB">'
          + '<feColorMatrix type="matrix" values="0.78 0 0 0 0 0 0.95 0 0 0 0 0 1.25 0 0 0 0 0 1 0"/>'
        + '</filter>'
      + '</defs>'
    + '</svg>';
  document.body.insertBefore(wrapper.firstElementChild, document.body.firstChild);
}

const CVD_STORAGE_KEY = 'colouristic.cvdPreview.v1';
const GRAYSCALE_STORAGE_KEY = 'colouristic.grayscalePreview.v1';
const LIGHTING_STORAGE_KEY = 'colouristic.lightingPreview.v1';
let currentCvdMode = 'none';
let currentGrayscale = false;
let currentLightingMode = 'none';

function updatePreviewFilter(){
  const parts = [];
  if(currentCvdMode!=='none') parts.push('url(#cvd-'+currentCvdMode+')');
  if(currentLightingMode!=='none') parts.push('url(#light-'+currentLightingMode+')');
  if(currentGrayscale) parts.push('grayscale(1)');
  document.documentElement.style.setProperty('--preview-filter', parts.length ? parts.join(' ') : 'none');
}

function applyCvdMode(mode){
  currentCvdMode = mode;
  updatePreviewFilter();
}
function initCvdControl(){
  const sel = document.getElementById('cvdSelect');
  if(!sel) return;
  let saved = 'none';
  try{ saved = localStorage.getItem(CVD_STORAGE_KEY) || 'none'; }catch(e){}
  sel.value = saved;
  applyCvdMode(saved);
  sel.addEventListener('change', e=>{
    const mode = e.target.value;
    applyCvdMode(mode);
    try{ localStorage.setItem(CVD_STORAGE_KEY, mode); }catch(e){}
  });
}

function applyGrayscaleMode(on){
  currentGrayscale = on;
  updatePreviewFilter();
}
function initGrayscaleControl(){
  const btn = document.getElementById('grayscaleToggle');
  if(!btn) return;
  let saved = false;
  try{ saved = localStorage.getItem(GRAYSCALE_STORAGE_KEY) === '1'; }catch(e){}
  btn.classList.toggle('active', saved);
  applyGrayscaleMode(saved);
  btn.addEventListener('click', ()=>{
    const isOn = !btn.classList.contains('active');
    btn.classList.toggle('active', isOn);
    applyGrayscaleMode(isOn);
    try{ localStorage.setItem(GRAYSCALE_STORAGE_KEY, isOn ? '1' : '0'); }catch(e){}
  });
}

function applyLightingMode(mode){
  currentLightingMode = mode;
  updatePreviewFilter();
}
function initLightingControl(){
  const sel = document.getElementById('lightingSelect');
  if(!sel) return;
  let saved = 'none';
  try{ saved = localStorage.getItem(LIGHTING_STORAGE_KEY) || 'none'; }catch(e){}
  sel.value = saved;
  applyLightingMode(saved);
  sel.addEventListener('change', e=>{
    const mode = e.target.value;
    applyLightingMode(mode);
    try{ localStorage.setItem(LIGHTING_STORAGE_KEY, mode); }catch(e){}
  });
}

const TEXTURE_STORAGE_KEY = 'colouristic.texturePreview.v1';
const TEXTURE_CLASSES = ['texture-fur','texture-cotton','texture-satin','texture-paint'];

function applyTextureMode(mode){
  document.documentElement.classList.remove(...TEXTURE_CLASSES);
  if(mode!=='none') document.documentElement.classList.add('texture-'+mode);
}
function initTextureControl(){
  const sel = document.getElementById('textureSelect');
  if(!sel) return;
  let saved = 'none';
  try{ saved = localStorage.getItem(TEXTURE_STORAGE_KEY) || 'none'; }catch(e){}
  sel.value = saved;
  applyTextureMode(saved);
  sel.addEventListener('change', e=>{
    const mode = e.target.value;
    applyTextureMode(mode);
    try{ localStorage.setItem(TEXTURE_STORAGE_KEY, mode); }catch(e){}
  });
}

function asciiSafe(str){
  return String(str).replace(/[^\x20-\x7E]/g, '');
}

function scrapeSwatches(gridId){
  return Array.from(document.querySelectorAll('#'+gridId+' .swatch')).map(card=>{
    const hex = card.querySelector('.swatch-hex').textContent.trim();
    const roleEl = card.querySelector('.swatch-role');
    return { hex: hex, label: roleEl ? roleEl.textContent.trim() : '' };
  });
}

function triggerDownload(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function exportPaletteAsPNG(swatches, filename){
  if(!swatches.length) return;
  const cols = Math.min(swatches.length, 4);
  const rows = Math.ceil(swatches.length/cols);
  const swWidth = 180, swHeight = 190, padding = 24, headerHeight = 60;
  const width = cols*swWidth + padding*2;
  const height = rows*swHeight + padding*2 + headerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#15141b';
  ctx.fillRect(0,0,width,height);
  ctx.fillStyle = '#f2efe9';
  ctx.font = '600 20px sans-serif';
  ctx.fillText('Colouristic palette', padding, 38);

  swatches.forEach((sw,i)=>{
    const col = i%cols, row = Math.floor(i/cols);
    const x = padding + col*swWidth;
    const y = headerHeight + padding + row*swHeight;
    ctx.fillStyle = sw.hex;
    ctx.fillRect(x, y, swWidth-14, swHeight-36);
    ctx.fillStyle = '#f2efe9';
    ctx.font = '500 15px monospace';
    ctx.fillText(sw.hex.toUpperCase(), x, y+swHeight-20);
    if(sw.label){
      ctx.fillStyle = '#9c98ab';
      ctx.font = '400 12px sans-serif';
      ctx.fillText(sw.label, x, y+swHeight-4);
    }
  });

  canvas.toBlob(blob=>{
    if(blob) triggerDownload(blob, filename+'.png');
  });
}

function pdfEscape(str){
  return asciiSafe(str).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
}

function exportPaletteAsPDF(swatches, filename, title){
  if(!swatches.length) return;
  title = asciiSafe(title || 'Colouristic palette');
  const pageWidth = 612, pageHeight = 792, margin = 50, cols = 2;
  const swWidth = (pageWidth - margin*2 - 20)/cols;
  const swHeight = 100;

  let content = 'BT /F1 24 Tf '+margin+' '+(pageHeight-margin)+' Td ('+pdfEscape(title)+') Tj ET\n';
  swatches.forEach((sw,i)=>{
    const col = i%cols, row = Math.floor(i/cols);
    const x = margin + col*(swWidth+20);
    const y = pageHeight - margin - 60 - row*(swHeight+40) - swHeight;
    const r = (parseInt(sw.hex.slice(1,3),16)/255).toFixed(3);
    const g = (parseInt(sw.hex.slice(3,5),16)/255).toFixed(3);
    const b = (parseInt(sw.hex.slice(5,7),16)/255).toFixed(3);
    content += r+' '+g+' '+b+' rg\n';
    content += x+' '+y+' '+swWidth.toFixed(1)+' '+swHeight+' re f\n';
    content += '0 0 0 rg\n';
    content += 'BT /F1 11 Tf '+x+' '+(y-16)+' Td ('+pdfEscape(sw.hex.toUpperCase())+') Tj ET\n';
    if(sw.label){
      content += '0.4 0.4 0.4 rg\n';
      content += 'BT /F1 9 Tf '+x+' '+(y-30)+' Td ('+pdfEscape(sw.label)+') Tj ET\n';
    }
  });

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageWidth+' '+pageHeight+'] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length '+content.length+' >>\nstream\n'+content+'endstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj,i)=>{
    offsets.push(pdf.length);
    pdf += (i+1)+' 0 obj\n'+obj+'\nendobj\n';
  });
  const xrefOffset = pdf.length;
  pdf += 'xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
  for(let i=1;i<=objects.length;i++){
    pdf += String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  }
  pdf += 'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xrefOffset+'\n%%EOF';

  triggerDownload(new Blob([pdf],{type:'application/pdf'}), filename+'.pdf');
}

function makeSwatchCard(hex, roleText){
  const card = document.createElement('div');
  card.className = 'swatch';
  const colorDiv = document.createElement('div');
  colorDiv.className = 'swatch-color cvd-target';
  colorDiv.style.background = hex;
  colorDiv.title = 'Click to copy '+hex;
  colorDiv.addEventListener('click', ()=>{
    navigator.clipboard.writeText(hex.toUpperCase());
    addRecentColor(hex);
    const label = card.querySelector('.swatch-hex');
    const original = hex.toUpperCase();
    label.textContent = 'Copied';
    label.classList.add('copied-flag');
    setTimeout(()=>{ label.textContent=original; label.classList.remove('copied-flag'); },1000);
  });
  const info = document.createElement('div');
  info.className = 'swatch-info';
  const hexLabel = document.createElement('p');
  hexLabel.className = 'swatch-hex';
  hexLabel.textContent = hex.toUpperCase();
  info.appendChild(hexLabel);
  appendColorName(info, hex);
  if(roleText){
    const roleLabel = document.createElement('p');
    roleLabel.className = 'swatch-role';
    roleLabel.textContent = roleText;
    info.appendChild(roleLabel);
  }
  card.appendChild(colorDiv);
  card.appendChild(info);
  return card;
}

function genId(prefix){
  return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
}

/* ---- Local accounts ----
   Everything about an account -- password, libraries, game stats -- lives
   only in this browser's localStorage; there's no account server, so none
   of that can sync across devices or be recovered if it's cleared. The one
   exception is the username itself: see the "Global username uniqueness"
   block further down, which optionally checks a shared Firestore registry
   so two people on different devices can't end up with the same one.
   Passwords are SHA-256 hashed before storage so they're not sitting in
   localStorage as plain text, but that's hygiene, not real security:
   anyone with access to this browser's storage can still see everything.
   Signed-out ("Guest") data keeps using the original, unnamespaced keys,
   so nothing already saved gets hidden by adding this feature.
   ACCOUNTS_STORAGE_KEY itself is declared at the top of this file, not
   here -- see the comment there. */

function loadAccountsData(){
  try{
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return { accounts: [], activeAccountId: null };
}
function saveAccountsData(data){
  try{ localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(data)); }catch(e){}
}
function getActiveAccount(){
  const data = loadAccountsData();
  if(!data.activeAccountId) return null;
  return data.accounts.find(a=>a.id===data.activeAccountId) || null;
}
function namespacedKey(baseKey){
  const acct = getActiveAccount();
  return acct ? baseKey+'::'+acct.id : baseKey;
}
async function hashPassword(pw){
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
/* ---- Global username uniqueness (optional Firebase backend) ----
   Everything else here is local-only by design, but a username only really
   means "yours" if nobody else -- on any device -- can also be using it,
   and that needs something outside localStorage to check against. This
   talks to a small Firestore collection (just the username strings, as
   document IDs, nothing else -- no passwords, no personal data) if
   firebase-config.js has been filled in with a real project. If it hasn't,
   sign-up/rename quietly fall back to the original per-device-only check
   instead of breaking. Firestore security rules (see firebase-config.js's
   comment / project setup notes) allow creating a username doc only if it
   doesn't already exist, and never allow update/delete from the client --
   so a claimed username is reserved permanently, even past a rename away
   from it. That's a deliberate tradeoff: this app has no real server-side
   auth, so allowing deletes would let anyone free up (and steal) someone
   else's username. */
function firebaseUsernamesReady(){
  return typeof firebase !== 'undefined'
    && !!window.FIREBASE_CONFIG
    && !!window.FIREBASE_CONFIG.apiKey
    && window.FIREBASE_CONFIG.apiKey.indexOf('PASTE_')!==0;
}
let _firebaseApp = null;
function usernamesCollection(){
  if(!_firebaseApp) _firebaseApp = firebase.initializeApp(window.FIREBASE_CONFIG);
  return firebase.firestore().collection('usernames');
}
async function checkUsernameAvailableGlobally(username){
  const doc = await usernamesCollection().doc(username.toLowerCase()).get();
  return !doc.exists;
}
async function claimUsernameGlobally(username){
  await usernamesCollection().doc(username.toLowerCase()).set({createdAt: firebase.firestore.FieldValue.serverTimestamp()});
}
async function reserveUsernameGlobally(username){
  if(!firebaseUsernamesReady()) return {ok:true};
  try{
    const available = await checkUsernameAvailableGlobally(username);
    if(!available) return {ok:false, error:'That username is already taken.'};
    await claimUsernameGlobally(username);
    return {ok:true};
  }catch(e){
    if(e && e.code==='permission-denied') return {ok:false, error:'That username is already taken.'};
    return {ok:false, error:"Couldn't verify that username right now -- check your connection and try again."};
  }
}

async function signUp(username, password){
  username = (username||'').trim();
  if(!username) return {ok:false, error:'Enter a username.'};
  if(!password || password.length<4) return {ok:false, error:'Password must be at least 4 characters.'};
  const data = loadAccountsData();
  if(data.accounts.some(a=>a.username.toLowerCase()===username.toLowerCase())){
    return {ok:false, error:'That username is already taken on this device.'};
  }
  const reserved = await reserveUsernameGlobally(username);
  if(!reserved.ok) return reserved;
  const account = {id:genId('acct'), username, passwordHash: await hashPassword(password), createdAt:Date.now()};
  data.accounts.push(account);
  data.activeAccountId = account.id;
  saveAccountsData(data);
  notifyAccountChanged();
  return {ok:true, account};
}
async function logIn(username, password){
  const data = loadAccountsData();
  const account = data.accounts.find(a=>a.username.toLowerCase()===(username||'').trim().toLowerCase());
  if(!account) return {ok:false, error:'No account with that username on this device.'};
  if(await hashPassword(password) !== account.passwordHash) return {ok:false, error:'Incorrect password.'};
  data.activeAccountId = account.id;
  saveAccountsData(data);
  notifyAccountChanged();
  return {ok:true, account};
}
function logOut(){
  const data = loadAccountsData();
  data.activeAccountId = null;
  saveAccountsData(data);
  notifyAccountChanged();
}
async function updateUsername(newUsername){
  newUsername = (newUsername||'').trim();
  if(!newUsername) return {ok:false, error:'Enter a username.'};
  const data = loadAccountsData();
  const account = data.accounts.find(a=>a.id===data.activeAccountId);
  if(!account) return {ok:false, error:'No active account.'};
  const taken = data.accounts.some(a=>a.id!==account.id && a.username.toLowerCase()===newUsername.toLowerCase());
  if(taken) return {ok:false, error:'That username is already taken on this device.'};
  if(newUsername.toLowerCase()!==account.username.toLowerCase()){
    const reserved = await reserveUsernameGlobally(newUsername);
    if(!reserved.ok) return reserved;
  }
  account.username = newUsername;
  saveAccountsData(data);
  notifyAccountChanged();
  return {ok:true, account};
}
async function updatePassword(currentPassword, newPassword){
  const data = loadAccountsData();
  const account = data.accounts.find(a=>a.id===data.activeAccountId);
  if(!account) return {ok:false, error:'No active account.'};
  if(await hashPassword(currentPassword||'') !== account.passwordHash) return {ok:false, error:'Current password is incorrect.'};
  if(!newPassword || newPassword.length<4) return {ok:false, error:'New password must be at least 4 characters.'};
  account.passwordHash = await hashPassword(newPassword);
  saveAccountsData(data);
  return {ok:true};
}
function notifyAccountChanged(){
  renderAccountBar();
  window.dispatchEvent(new CustomEvent('colouristic:accountchanged'));
}

/* Profile photos: stored as a small square JPEG data URL directly on the
   account object (localStorage only, like everything else here). Center-
   cropped and downscaled to keep each one a few KB rather than dumping a
   multi-megabyte phone photo straight into localStorage. */
function resizeImageToDataUrl(file, size, quality){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const srcSize = Math.min(img.width, img.height);
      const sx = (img.width-srcSize)/2, sy = (img.height-srcSize)/2;
      ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = ()=>{ URL.revokeObjectURL(img.src); reject(new Error('Could not read that image.')); };
    img.src = URL.createObjectURL(file);
  });
}
function setAccountAvatar(dataUrl){
  const data = loadAccountsData();
  const account = data.accounts.find(a=>a.id===data.activeAccountId);
  if(!account) return;
  account.avatarDataUrl = dataUrl;
  saveAccountsData(data);
  renderAccountBar();
}
function removeAccountAvatar(){
  const data = loadAccountsData();
  const account = data.accounts.find(a=>a.id===data.activeAccountId);
  if(!account) return;
  delete account.avatarDataUrl;
  saveAccountsData(data);
  renderAccountBar();
}

function renderAccountBar(){
  const bar = document.getElementById('accountBar');
  if(!bar) return;
  bar.innerHTML = '';
  const account = getActiveAccount();
  if(!account) return;

  const avatarBtn = document.createElement('button');
  avatarBtn.type = 'button';
  avatarBtn.className = 'account-avatar-btn';
  avatarBtn.title = 'Edit profile';
  if(account.avatarDataUrl){
    const img = document.createElement('img');
    img.src = account.avatarDataUrl;
    img.alt = '';
    avatarBtn.appendChild(img);
  } else {
    avatarBtn.textContent = account.username.charAt(0).toUpperCase();
  }
  avatarBtn.addEventListener('click', ()=>{ location.href = 'profile.html'; });

  const label = document.createElement('span');
  label.className = 'account-label';
  label.textContent = 'Signed in as '+account.username;

  const outBtn = document.createElement('button');
  outBtn.className = 'iconbtn'; outBtn.type = 'button';
  outBtn.textContent = 'Log out';
  outBtn.addEventListener('click', ()=>{ logOut(); location.href = 'home.html'; });

  bar.appendChild(avatarBtn); bar.appendChild(label); bar.appendChild(outBtn);
}
function initAccountControl(){
  renderAccountBar();
}

/* ---- Saved palette libraries ---- */
const LIBRARY_STORAGE_KEY_BASE = 'colouristic.libraries.v1';

function saveLibraryData(data){
  try{ localStorage.setItem(namespacedKey(LIBRARY_STORAGE_KEY_BASE), JSON.stringify(data)); }catch(e){}
}

function loadLibraryData(){
  try{
    const raw = localStorage.getItem(namespacedKey(LIBRARY_STORAGE_KEY_BASE));
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && Array.isArray(parsed.libraries) && parsed.libraries.length) return parsed;
    }
  }catch(e){}
  const initial = { libraries: [ { id: genId('lib'), name: 'My Library', palettes: [] } ] };
  saveLibraryData(initial);
  return initial;
}

function createLibrary(name){
  const data = loadLibraryData();
  const lib = { id: genId('lib'), name: (name||'').trim() || 'Untitled library', palettes: [] };
  data.libraries.push(lib);
  saveLibraryData(data);
  return lib;
}

function renameLibrary(libraryId, newName){
  const data = loadLibraryData();
  const lib = data.libraries.find(l=>l.id===libraryId);
  if(lib && newName && newName.trim()) lib.name = newName.trim();
  saveLibraryData(data);
  return data;
}

function deleteLibrary(libraryId){
  const data = loadLibraryData();
  data.libraries = data.libraries.filter(l=>l.id!==libraryId);
  if(!data.libraries.length) data.libraries.push({ id: genId('lib'), name: 'My Library', palettes: [] });
  saveLibraryData(data);
  return data;
}

function savePaletteToLibrary(libraryId, name, colors){
  const data = loadLibraryData();
  const lib = data.libraries.find(l=>l.id===libraryId) || data.libraries[0];
  const palette = { id: genId('pal'), name: (name||'').trim() || 'Untitled palette', colors, createdAt: Date.now() };
  lib.palettes.unshift(palette);
  saveLibraryData(data);
  return palette;
}

function renamePaletteInLibrary(libraryId, paletteId, newName){
  const data = loadLibraryData();
  const lib = data.libraries.find(l=>l.id===libraryId);
  if(lib){
    const pal = lib.palettes.find(p=>p.id===paletteId);
    if(pal && newName && newName.trim()) pal.name = newName.trim();
  }
  saveLibraryData(data);
  return data;
}

function deletePaletteFromLibrary(libraryId, paletteId){
  const data = loadLibraryData();
  const lib = data.libraries.find(l=>l.id===libraryId);
  if(lib) lib.palettes = lib.palettes.filter(p=>p.id!==paletteId);
  saveLibraryData(data);
  return data;
}

/* ---- Recently used colours tray ----
   A small floating strip, injected on every tool page (not home.html), that
   remembers the last few colours picked or copied anywhere in the app so
   they're one click away in whichever tool you're in next. Clicking a chip
   hands the hex to the current page's own applyRecentColor, if it defines
   one (each tool decides what "select" means for itself -- set the wheel's
   base colour, drop into a mood-finder slot, jump to the wheel, etc.).
   Pages that don't define one just get the hex copied to the clipboard. */
const RECENT_COLORS_KEY_BASE = 'colouristic.recentColors.v1';
const MAX_RECENT_COLORS = 10;

function getRecentColors(){
  try{
    const raw = localStorage.getItem(namespacedKey(RECENT_COLORS_KEY_BASE));
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return [];
}
function saveRecentColors(list){
  try{ localStorage.setItem(namespacedKey(RECENT_COLORS_KEY_BASE), JSON.stringify(list)); }catch(e){}
}
function addRecentColor(hex){
  if(!hex) return;
  hex = (/^#[0-9a-fA-F]{3}$/.test(hex) ? expandHex3(hex) : hex).toUpperCase();
  if(!/^#[0-9A-F]{6}$/.test(hex)) return;
  const list = getRecentColors().filter(h=>h!==hex);
  list.unshift(hex);
  saveRecentColors(list.slice(0, MAX_RECENT_COLORS));
  renderRecentColorsTray();
}

let recentColorsTrayEl = null;
function renderRecentColorsTray(){
  if(!recentColorsTrayEl) return;
  const list = getRecentColors();
  recentColorsTrayEl.classList.toggle('visible', list.length>0);
  const chipsWrap = recentColorsTrayEl.querySelector('.recent-colors-chips');
  chipsWrap.innerHTML = '';
  list.forEach(hex=>{
    const chip = document.createElement('div');
    chip.className = 'recent-color-chip';
    chip.style.background = hex;
    chip.title = hex+' — click to use';
    chip.addEventListener('click', ()=>{
      if(typeof window.applyRecentColor === 'function') window.applyRecentColor(hex);
      else navigator.clipboard.writeText(hex);
      chip.classList.add('chip-pulse');
      setTimeout(()=>chip.classList.remove('chip-pulse'), 500);
    });
    chipsWrap.appendChild(chip);
  });
}

function initRecentColorsTray(){
  if(currentPageFile()==='home.html') return;
  if(recentColorsTrayEl) return;

  recentColorsTrayEl = document.createElement('div');
  recentColorsTrayEl.className = 'recent-colors-tray';

  const label = document.createElement('span');
  label.className = 'recent-colors-label';
  label.textContent = 'Recent';

  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'recent-colors-chips';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'recent-colors-clear';
  clearBtn.textContent = '×';
  clearBtn.title = 'Clear recent colours';
  clearBtn.addEventListener('click', ()=>{
    saveRecentColors([]);
    renderRecentColorsTray();
  });

  recentColorsTrayEl.appendChild(label);
  recentColorsTrayEl.appendChild(chipsWrap);
  recentColorsTrayEl.appendChild(clearBtn);
  document.body.appendChild(recentColorsTrayEl);

  renderRecentColorsTray();
}

const GAME_STORAGE_KEY_BASE = 'colouristic.gameStats.v1';

/* ---- Eyedropper ----
   Wraps the browser's native EyeDropper API (Chromium only, as of writing)
   so a page just drops a button with a known id in its markup and calls
   this once. Picking a colour reuses the same "what does selecting mean
   here" hook the recent-colours tray uses (window.applyRecentColor), so
   there's nothing page-specific to write beyond that. Hides the button
   entirely on browsers that don't support the API rather than showing
   something that can only ever fail. */
function initEyedropperButton(buttonId){
  const btn = document.getElementById(buttonId);
  if(!btn) return;
  if(!('EyeDropper' in window)){
    btn.style.display = 'none';
    return;
  }
  btn.addEventListener('click', async ()=>{
    try{
      const result = await new EyeDropper().open();
      const hex = result.sRGBHex.toUpperCase();
      addRecentColor(hex);
      if(typeof window.applyRecentColor === 'function') window.applyRecentColor(hex);
      else navigator.clipboard.writeText(hex);
    }catch(e){
      // AbortError when the user cancels (Escape / click elsewhere) -- not a real error.
    }
  });
}

function attachExportButtons(containerId, gridId, filenameBase, pdfTitle, defaultPaletteName){
  const container = document.getElementById(containerId);
  if(!container) return;
  const row = document.createElement('div');
  row.className = 'actions';
  row.style.marginTop = '14px';

  function flash(btn, label){
    const original = btn.textContent;
    btn.textContent = label;
    setTimeout(()=>{ btn.textContent = original; }, 1200);
  }

  function makeBtn(text, handler){
    const btn = document.createElement('button');
    btn.className = 'iconbtn';
    btn.type = 'button';
    btn.textContent = text;
    btn.addEventListener('click', ()=>{
      const swatches = scrapeSwatches(gridId);
      if(!swatches.length) return;
      handler(swatches, btn);
    });
    return btn;
  }

  const pngBtn = makeBtn('Download PNG', sw=>{ exportPaletteAsPNG(sw, filenameBase); flash(pngBtn,'Saved'); });
  const pdfBtn = makeBtn('Download PDF', sw=>{ exportPaletteAsPDF(sw, filenameBase, pdfTitle); flash(pdfBtn,'Saved'); });
  const saveBtn = makeBtn('Save to library', ()=>{
    form.style.display = form.style.display==='none' ? 'flex' : 'none';
    if(form.style.display==='flex') renderForm();
  });

  row.appendChild(pngBtn);
  row.appendChild(pdfBtn);
  row.appendChild(saveBtn);
  container.appendChild(row);

  const form = document.createElement('div');
  form.className = 'save-to-library-form';
  form.style.display = 'none';
  container.appendChild(form);

  function renderForm(){
    const data = loadLibraryData();
    form.innerHTML = '';

    const librarySelect = document.createElement('select');
    librarySelect.className = 'cvd-select';
    data.libraries.forEach(lib=>{
      const opt = document.createElement('option');
      opt.value = lib.id;
      opt.textContent = lib.name;
      librarySelect.appendChild(opt);
    });

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'hex-guess-input';
    nameInput.style.cssText = 'width:180px;font-size:13px;padding:8px 12px;';
    nameInput.value = defaultPaletteName || 'My palette';
    nameInput.setAttribute('aria-label','Palette name');

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'iconbtn';
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.addEventListener('click', ()=>{
      const swatches = scrapeSwatches(gridId);
      if(!swatches.length) return;
      savePaletteToLibrary(librarySelect.value, nameInput.value, swatches);
      form.style.display = 'none';
      flash(saveBtn, 'Saved!');
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'iconbtn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', ()=>{ form.style.display = 'none'; });

    form.appendChild(librarySelect);
    form.appendChild(nameInput);
    form.appendChild(confirmBtn);
    form.appendChild(cancelBtn);
  }
}

injectCvdFilters();
initCvdControl();
initGrayscaleControl();
initLightingControl();
initTextureControl();
initAccountControl();
initRecentColorsTray();
