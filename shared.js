const SUBSECTIONS = ["7.1","7.2","7.3","7.4","7.5","7.6","7.7","7.8","7.9","7.10"];
const AUTH_KEY = 'reestr_auth_v1';
const PREFILL_DRAFT_KEY = 'reestr_prefill_draft_v1';

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function escapeHtml(s){
  return String(s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function formatDate(ts){
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit', year:'numeric'});
}
function youtubeId(url){
  if(!url) return null;
  const s = String(url).trim();
  let m;
  if((m = s.match(/[?&]v=([A-Za-z0-9_-]{6,})/))) return m[1];
  if((m = s.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/))) return m[1];
  if((m = s.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{6,})/))) return m[1];
  if(/^[A-Za-z0-9_-]{10,12}$/.test(s)) return s;
  return null;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDurationLong(totalSeconds){
  totalSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if(h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function fetchSingleDuration(vid){
  return new Promise((resolve) => {
    if(typeof YT === 'undefined' || typeof YT.Player === 'undefined'){
      resolve(null);
      return;
    }
    const containerId = 'dur-fetch-' + vid.replace(/[^A-Za-z0-9_-]/g,'') + '-' + Math.random().toString(36).slice(2,8);
    const holder = document.createElement('div');
    holder.id = containerId;
    holder.style.position = 'fixed';
    holder.style.left = '-9999px';
    holder.style.top = '0';
    holder.style.width = '200px';
    holder.style.height = '150px';
    document.body.appendChild(holder);

    let settled = false;
    let player = null;

    function finish(val){
      if(settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try{ if(player && typeof player.destroy === 'function') player.destroy(); }catch(e){}
      if(holder.parentNode) holder.parentNode.removeChild(holder);
      resolve(val);
    }

    const timeoutId = setTimeout(() => finish(null), 8000);

    try{
      player = new YT.Player(containerId, {
        height: '150', width: '200', videoId: vid,
        playerVars: { 'controls': 0 },
        events: {
          onReady: function(e){
            let dur = 0;
            try{ dur = e.target.getDuration(); }catch(err){}
            if(!dur){
              setTimeout(() => {
                let d2 = 0;
                try{ d2 = e.target.getDuration(); }catch(err){}
                finish(d2 || null);
              }, 700);
            } else {
              finish(dur);
            }
          },
          onError: function(){ finish(null); }
        }
      });
    }catch(e){
      finish(null);
    }
  });
}

async function fetchVideoDurations(videoIds){
  const result = {};
  for(const vid of videoIds){
    result[vid] = await fetchSingleDuration(vid);
  }
  return result;
}

function regMarksHtml(){
  return `<span class="reg-mark reg-tl"></span><span class="reg-mark reg-tr"></span><span class="reg-mark reg-bl"></span><span class="reg-mark reg-br"></span>`;
}

function qs(name){
  return new URLSearchParams(location.search).get(name);
}

// ================= AUTH (логин/пароль, токен в localStorage) =================
function getAuth(){
  try{
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function setAuth(token, username){
  localStorage.setItem(AUTH_KEY, JSON.stringify({token, username}));
}
function clearAuth(){
  localStorage.removeItem(AUTH_KEY);
}
function getToken(){
  const a = getAuth();
  return a ? a.token : null;
}
function getUsername(){
  const a = getAuth();
  return a ? a.username : null;
}
// Редиректит на auth.html, если пользователь не залогинен. Вызывать в начале каждой защищённой страницы.
function requireAuth(){
  if(!getToken()){
    location.href = 'auth.html';
    return false;
  }
  return true;
}

// Обёртка над fetch: подставляет токен, кидает понятную ошибку, обрабатывает 401
async function api(path, opts = {}){
  const headers = Object.assign({'Content-Type':'application/json'}, opts.headers || {});
  const token = getToken();
  if(token) headers['Authorization'] = 'Bearer ' + token;
  let res;
  try{
    res = await fetch(API_BASE + path, Object.assign({}, opts, {headers}));
  }catch(e){
    throw new Error('Нет связи с сервером (' + API_BASE + '). Проверьте, что Worker задеплоен.');
  }
  if(res.status === 401){
    clearAuth();
    location.href = 'auth.html';
    throw new Error('Сессия истекла, войдите заново');
  }
  let data = null;
  try{ data = await res.json(); }catch(e){ /* no body */ }
  if(!res.ok){
    throw new Error((data && data.error) || ('Ошибка запроса: ' + res.status));
  }
  return data;
}

// ================= API-функции данных =================
async function apiGetReports(){
  const data = await api('/api/reports');
  return data.reports || [];
}
async function apiCreateReport(title){
  const data = await api('/api/reports', {method:'POST', body: JSON.stringify({title})});
  return data.report;
}
async function apiDeleteReport(id){
  await api('/api/reports/' + encodeURIComponent(id), {method:'DELETE'});
}
async function apiGetSituations(reportId){
  const data = await api('/api/reports/' + encodeURIComponent(reportId) + '/situations');
  return data.situations || {};
}
async function apiCreateSituation(reportId, sub, segments){
  const data = await api('/api/reports/' + encodeURIComponent(reportId) + '/situations', {
    method:'POST', body: JSON.stringify({sub, segments})
  });
  return data.situation;
}
async function apiUpdateSituation(situationId, segments){
  const data = await api('/api/situations/' + encodeURIComponent(situationId), {
    method:'PUT', body: JSON.stringify({segments})
  });
  return data.situation;
}
async function apiDeleteSituation(situationId){
  await api('/api/situations/' + encodeURIComponent(situationId), {method:'DELETE'});
}
async function apiGetVideos(reportId){
  const data = await api('/api/reports/' + encodeURIComponent(reportId) + '/videos');
  return data.videos || [];
}
async function apiAddVideos(reportId, urls){
  const data = await api('/api/reports/' + encodeURIComponent(reportId) + '/videos', {
    method:'POST', body: JSON.stringify({urls})
  });
  return data; // {added, videos}
}
async function apiSetVideoChecked(videoId, checked){
  const data = await api('/api/videos/' + encodeURIComponent(videoId), {
    method:'PUT', body: JSON.stringify({checked})
  });
  return data.video;
}
async function apiDeleteVideo(videoId){
  await api('/api/videos/' + encodeURIComponent(videoId), {method:'DELETE'});
}

function showToast(msg){
  const existing = document.querySelector('.toast');
  if(existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2200);
}

function topbarHtml(){
  const username = getUsername();
  return `
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark"><span>Р</span></div>
        <div class="brand-text">
          <div class="t1 mono">СИСТЕМА ФОРМИРОВАНИЯ ОТЧЁТОВ</div>
          <div class="t2">Реестр отчётов</div>
        </div>
      </div>
      ${username ? `
      <div class="user-badge">
        <span>Пользователь: <span class="uname">${escapeHtml(username)}</span></span>
        <button class="btn ghost" data-action="logout">Выйти</button>
      </div>` : ''}
    </div>
  `;
}

function bindTopbarLogout(){
  const btn = document.querySelector('[data-action="logout"]');
  if(btn) btn.addEventListener('click', () => {
    clearAuth();
    location.href = 'auth.html';
  });
}

function breadcrumbsHtml(report, sub, formLabel){
  let parts = [`<button data-nav="list">Все отчёты</button>`];
  if(report){
    parts.push(`<span class="sep">/</span>`);
    parts.push(sub ? `<button data-nav="report" data-id="${report.id}">${escapeHtml(report.title)}</button>` : `<span class="cur">${escapeHtml(report.title)}</span>`);
  }
  if(sub){
    parts.push(`<span class="sep">/</span>`);
    parts.push(formLabel ? `<button data-nav="section" data-id="${report.id}" data-sub="${sub}">Раздел ${sub}</button>` : `<span class="cur">Раздел ${sub}</span>`);
  }
  if(formLabel){
    parts.push(`<span class="sep">/</span>`);
    parts.push(`<span class="cur">${formLabel}</span>`);
  }
  return `<div class="breadcrumbs">${parts.join('')}</div>`;
}

// Реальная навигация по страницам вместо клиентского роутера
function bindNavHandlers(root){
  (root || document).querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      const view = el.dataset.nav;
      if(view === 'list') location.href = 'list.html';
      else if(view === 'report') location.href = 'report.html?id=' + encodeURIComponent(el.dataset.id);
      else if(view === 'section') location.href = 'section.html?id=' + encodeURIComponent(el.dataset.id) + '&sub=' + encodeURIComponent(el.dataset.sub);
    });
  });
}

function declineSituation(n){
  const mod100 = n % 100, mod10 = n % 10;
  if(mod100 >= 11 && mod100 <= 14) return 'ситуаций';
  if(mod10 === 1) return 'ситуация';
  if(mod10 >= 2 && mod10 <= 4) return 'ситуации';
  return 'ситуаций';
}

function declineSegment(n){
  const mod100 = n % 100, mod10 = n % 10;
  if(mod100 >= 11 && mod100 <= 14) return 'отрезков';
  if(mod10 === 1) return 'отрезок';
  if(mod10 >= 2 && mod10 <= 4) return 'отрезка';
  return 'отрезков';
}

// Приводит ситуацию к единому массиву отрезков
function situationSegments(s){
  if(s && Array.isArray(s.segments) && s.segments.length) return s.segments;
  return [{ id:'legacy', url:'', start:null, end:null, comment:'' }];
}

function whenYTReady(cb){
  if(typeof YT !== 'undefined' && typeof YT.Player !== 'undefined'){ cb(); return; }
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if(typeof YT !== 'undefined' && typeof YT.Player !== 'undefined'){
      clearInterval(iv);
      cb();
    } else if(tries > 50){
      clearInterval(iv);
      cb();
    }
  }, 200);
}
