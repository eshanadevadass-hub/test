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

/* ---- Saved palette libraries ---- */
const LIBRARY_STORAGE_KEY = 'colouristic.libraries.v1';

function genId(prefix){
  return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
}

function saveLibraryData(data){
  try{ localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(data)); }catch(e){}
}

function loadLibraryData(){
  try{
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
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
