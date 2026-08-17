const SUBSECTIONS = ["7.1","7.2","7.3","7.4","7.5","7.6","7.7","7.8","7.9","7.10"];
const AUTH_KEY = 'reestr_auth_v1';

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
    nav({view:'auth'});
    throw new Error('Сессия истекла, войдите заново');
  }
  let data = null;
  try{ data = await res.json(); }catch(e){ /* no body */ }
  if(!res.ok){
    throw new Error((data && data.error) || ('Ошибка запроса: ' + res.status));
  }
  return data;
}

// ================= API-функции данных (замена localStorage) =================
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

let route = {view:'auth'};
const app = document.getElementById('app');
let ytPlayer = null;
let libPlayers = [];
let reportLibPlayers = [];
let pendingSegmentDraft = null;


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

function nav(r){
  if(ytPlayer && typeof ytPlayer.destroy === 'function'){
    try { ytPlayer.destroy(); } catch(e){}
    ytPlayer = null;
  }
  if(libPlayers.length){
    libPlayers.forEach(p => { try{ if(p && typeof p.destroy === 'function') p.destroy(); }catch(e){} });
    libPlayers = [];
  }
  if(reportLibPlayers.length){
    reportLibPlayers.forEach(p => { try{ if(p && typeof p.destroy === 'function') p.destroy(); }catch(e){} });
    reportLibPlayers = [];
  }

  if(!(r && r.view === 'situation-form')){
    pendingSegmentDraft = null;
  }

  if(r.view !== 'auth' && !getToken()){
    r = {view:'auth'};
  }

  route = r;
  render();
  window.scrollTo(0,0);
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
  const btn = app.querySelector('[data-action="logout"]');
  if(btn) btn.addEventListener('click', () => {
    clearAuth();
    showToast('Вы вышли из системы');
    nav({view:'auth'});
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


async function render(){
  if(route.view === 'auth') return renderAuth();
  if(route.view === 'list') return renderList();
  if(route.view === 'report') return renderReport(route.id);
  if(route.view === 'section') return renderSection(route.id, route.sub);
  if(route.view === 'situation-form') return renderSituationForm(route.id, route.sub, route.sid);
  if(route.view === 'video-list') return renderVideoList(route.id);
}

// ================= AUTH SCREEN =================
function renderAuth(){
  app.innerHTML = topbarHtml() + `
    <div class="auth-wrap">
      <div class="auth-card">
        ${regMarksHtml()}
        <div class="auth-brand">
          <div class="brand-mark"><span>Р</span></div>
          <div class="brand-text">
            <div class="t1 mono">РЕЕСТР ОТЧЁТОВ</div>
            <div class="t2" style="font-size:16px;">Вход в систему</div>
          </div>
        </div>
        <div class="auth-tabs">
          <button type="button" class="auth-tab active" data-tab="login">Вход</button>
          <button type="button" class="auth-tab" data-tab="register">Регистрация</button>
        </div>
        <div class="field">
          <label>Логин</label>
          <input type="text" id="auth-username" autocomplete="username" placeholder="Ваш логин">
        </div>
        <div class="field" style="margin-bottom:6px;">
          <label>Пароль</label>
          <input type="password" id="auth-password" autocomplete="current-password" placeholder="Пароль">
        </div>
        <button class="btn solid auth-submit" id="auth-submit-btn">Войти</button>
        <div class="auth-err" id="auth-err"></div>
        <div class="auth-hint" id="auth-hint">Нет аккаунта? Переключитесь на «Регистрация» выше.</div>
      </div>
    </div>
  `;
  bindTopbarLogout();

  let mode = 'login';
  const tabs = app.querySelectorAll('.auth-tab');
  const submitBtn = app.querySelector('#auth-submit-btn');
  const hint = app.querySelector('#auth-hint');
  const errEl = app.querySelector('#auth-err');
  const userInp = app.querySelector('#auth-username');
  const passInp = app.querySelector('#auth-password');

  function setMode(m){
    mode = m;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === m));
    submitBtn.textContent = m === 'login' ? 'Войти' : 'Зарегистрироваться';
    hint.textContent = m === 'login' ? 'Нет аккаунта? Переключитесь на «Регистрация» выше.' : 'Уже есть аккаунт? Переключитесь на «Вход» выше.';
    errEl.style.display = 'none';
  }
  tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.tab)));

  async function doSubmit(){
    const username = userInp.value.trim();
    const password = passInp.value;
    errEl.style.display = 'none';
    if(!username || !password){
      errEl.textContent = 'Введите логин и пароль';
      errEl.style.display = 'block';
      return;
    }
    submitBtn.disabled = true;
    const prevText = submitBtn.textContent;
    submitBtn.textContent = 'Подождите…';
    try{
      const path = mode === 'login' ? '/api/login' : '/api/register';
      const data = await api(path, {method:'POST', body: JSON.stringify({username, password})});
      setAuth(data.token, data.username);
      showToast(mode === 'login' ? 'Добро пожаловать!' : 'Аккаунт создан');
      nav({view:'list'});
    }catch(e){
      errEl.textContent = e.message || 'Ошибка входа';
      errEl.style.display = 'block';
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = prevText;
    }
  }
  submitBtn.addEventListener('click', doSubmit);
  [userInp, passInp].forEach(inp => inp.addEventListener('keydown', e => { if(e.key === 'Enter') doSubmit(); }));
  setMode('login');
  userInp.focus();
}


async function renderList(){
  app.innerHTML = topbarHtml() + `<div class="loading">Загрузка…</div>`;
  bindTopbarLogout();
  let reports;
  try{
    reports = await apiGetReports();
  }catch(e){
    app.innerHTML = topbarHtml() + `<div class="empty"><div class="display">Ошибка загрузки</div><p>${escapeHtml(e.message)}</p></div>`;
    bindTopbarLogout();
    return;
  }
  reports.sort((a,b)=> b.createdAt - a.createdAt);

  let rows = '';
  if(reports.length === 0){
    rows = `
      <div class="empty">
        <div class="display">Реестр пуст</div>
        <p>Создайте первый отчёт — внутри появятся разделы 7.1–7.10.</p>
        <button class="btn solid" data-action="new-report">+ Новый отчёт</button>
      </div>`;
  } else {
    const situCounts = await Promise.all(reports.map(r => apiGetSituations(r.id).catch(()=>({}))));
    rows = `
      <div class="registry">
        <div class="registry-head">
          <div>№</div><div>Наименование отчёта</div><div>Создан</div><div>Заполненность</div><div></div>
        </div>
        ${reports.map((r,i) => {
          const sit = situCounts[i];
          const filled = SUBSECTIONS.filter(s => (sit[s]||[]).length > 0).length;
          return `
          <div class="registry-row" data-nav="report" data-id="${r.id}">
            <div class="reg-num mono">${r.code}</div>
            <div class="reg-title">${escapeHtml(r.title)}</div>
            <div class="reg-date">${formatDate(r.createdAt)}</div>
            <div class="reg-progress">${SUBSECTIONS.map(s => `<div class="dot ${((sit[s]||[]).length>0)?'filled':''}" title="${s}"></div>`).join('')}<span class="reg-date" style="margin-left:8px;">${filled}/${SUBSECTIONS.length}</span></div>
            <div class="reg-arrow">›</div>
          </div>`;
        }).join('')}
      </div>`;
  }

  app.innerHTML = topbarHtml() + `
    <div class="page-head">
      <div>
        <h1>Все отчёты</h1>
        <p>Полный список сформированных отчётов реестра</p>
      </div>
      ${reports.length ? `<button class="btn solid" data-action="new-report">+ Новый отчёт</button>` : ''}
    </div>
    ${rows}
  `;

  bindTopbarLogout();
  bindNavHandlers();
  const newBtn = app.querySelector('[data-action="new-report"]');
  if(newBtn) newBtn.addEventListener('click', openNewReportModal);
}

function openNewReportModal(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <h3>Новый отчёт</h3>
      <input type="text" id="rep-title" placeholder="Наименование отчёта">
      <div class="modal-actions">
        <button class="btn ghost" data-action="modal-cancel">Отмена</button>
        <button class="btn solid" data-action="modal-save">Создать</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay.addEventListener('click', e => { if(e.target === overlay) closeModal(); });

  const inp = overlay.querySelector('#rep-title');
  inp.focus();

  overlay.querySelector('[data-action="modal-cancel"]').addEventListener('click', closeModal);

  overlay.querySelector('[data-action="modal-save"]').addEventListener('click', async () => {
    const title = inp.value.trim();
    if(!title){ inp.focus(); return; }
    const saveBtn = overlay.querySelector('[data-action="modal-save"]');
    saveBtn.disabled = true;
    try{
      const report = await apiCreateReport(title);
      closeModal();
      showToast('Отчёт создан');
      nav({view:'report', id: report.id});
    }catch(e){
      showToast(e.message || 'Ошибка создания отчёта');
      saveBtn.disabled = false;
    }
  });

  inp.addEventListener('keydown', e => {
    if(e.key === 'Enter') overlay.querySelector('[data-action="modal-save"]').click();
    if(e.key === 'Escape') closeModal();
  });
}

function repVideoItemsHtml(library){
  return library.map((item, idx) => `
    <div class="lib-item ${item.checked ? 'is-checked' : ''}" data-idx="${idx}">
      <div class="lib-item-head">
        <a class="lib-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a>
        <button type="button" class="btn-check ${item.checked ? 'checked' : ''}" title="Отметить как проверенное" data-action="rep-toggle-check" data-idx="${idx}">${item.checked ? '✓ Проверено' : 'Проверить'}</button>
      </div>
      <div class="video-preview" id="rep-lib-player-${idx}">
        <div class="placeholder"><div class="glyph">📺</div><div>Загрузка плеера…</div></div>
      </div>
      <div class="timecode-controls">
        <button type="button" class="btn-timecode" id="rep-lib-tc-btn-${idx}" data-idx="${idx}" disabled>
          <span>⏱</span> Отметить начало
        </button>
        <button type="button" class="btn-timecode btn-timecode-full" id="rep-lib-full-${idx}" data-idx="${idx}" disabled>
          Целиком
        </button>
      </div>
    </div>
  `).join('');
}

async function renderReport(reportId){
  app.innerHTML = topbarHtml() + `<div class="loading">Загрузка отчёта…</div>`;
  bindTopbarLogout();
  let reports, sit, videoLib;
  try{
    reports = await apiGetReports();
  }catch(e){
    app.innerHTML = topbarHtml() + `<div class="empty"><div class="display">Ошибка</div><p>${escapeHtml(e.message)}</p></div>`;
    bindTopbarLogout();
    return;
  }
  const report = reports.find(r => r.id === reportId);
  if(!report){ nav({view:'list'}); return; }
  try{
    sit = await apiGetSituations(reportId);
    videoLib = await apiGetVideos(reportId);
  }catch(e){
    app.innerHTML = topbarHtml() + `<div class="empty"><div class="display">Ошибка</div><p>${escapeHtml(e.message)}</p></div>`;
    bindTopbarLogout();
    return;
  }
  const totalSituations = SUBSECTIONS.reduce((sum,s) => sum + (sit[s]||[]).length, 0);

  pendingSegmentDraft = null;

  app.innerHTML = `
    <div class="sf-wrap">
      <div class="sf-top">
        <div class="sf-brand">
          <div class="brand-mark"><span>Р</span></div>
          ${breadcrumbsHtml(report, null)}
        </div>
        <div class="sf-title">
          <h1>${escapeHtml(report.title)}</h1>
          <p>Отчёт № ${report.code} • создан ${formatDate(report.createdAt)}</p>
        </div>
        <div class="sf-top-actions">
          <button class="btn ghost" style="padding:8px 14px; font-size:12px;" data-action="video-list">Список видео (${videoLib.length})</button>
          <button class="btn danger" style="padding:8px 14px; font-size:12px;" data-action="delete-report">Удалить</button>
          <button class="btn solid" style="padding:8px 14px; font-size:12px;" data-action="copy-report">Копировать</button>
        </div>
      </div>

      <div class="sf-split">
        <div class="sf-pane sf-pane-left">
          ${regMarksHtml()}
          <div class="stamp" style="width:100%; margin-bottom:22px;">
            <div class="cell"><div class="lbl">Дата создания</div><div class="val">${formatDate(report.createdAt)}</div></div>
            <div class="cell"><div class="lbl">Разделов</div><div class="val">${SUBSECTIONS.length}</div></div>
            <div class="cell"><div class="lbl">Ситуаций всего</div><div class="val">${totalSituations}</div></div>
            <div class="cell"><div class="lbl">Заполнено</div><div class="val">${SUBSECTIONS.filter(s=>(sit[s]||[]).length>0).length} / ${SUBSECTIONS.length}</div></div>
          </div>
          <div id="pending-banner"></div>
          <div class="sub-grid" id="sub-grid">
            ${SUBSECTIONS.map(s => {
              const n = (sit[s]||[]).length;
              return `
              <div class="sub-card" data-sub="${s}">
                <div class="code">${s}</div>
                <div class="count">${n>0 ? `<b>${n}</b> ${declineSituation(n)}` : 'нет ситуаций'}</div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="sf-pane sf-pane-right">
          <h3>Быстрая разметка по видео (${videoLib.length})</h3>
          ${videoLib.length ? repVideoItemsHtml(videoLib) : `
            <div class="empty" style="padding:26px 12px;">
              <p style="margin:0 0 14px;">Список видео отчёта пуст. Добавьте туда ссылки, чтобы находить моменты прямо здесь.</p>
              <button class="btn ghost" data-action="go-video-list-quick" style="width:100%; font-size:12px;">Перейти к списку видео</button>
            </div>`}
        </div>
      </div>
    </div>
  `;

  bindNavHandlers();

  const copyBtn = app.querySelector('[data-action="copy-report"]');
  copyBtn.addEventListener('click', async () => {
    await renderCopyReportView(reportId, report);
  });

  const videoListBtn = app.querySelector('[data-action="video-list"]');
  videoListBtn.addEventListener('click', () => nav({view:'video-list', id: reportId}));

  const goVideoListQuickBtn = app.querySelector('[data-action="go-video-list-quick"]');
  if(goVideoListQuickBtn) goVideoListQuickBtn.addEventListener('click', () => nav({view:'video-list', id: reportId}));

  const delBtn = app.querySelector('[data-action="delete-report"]');
  delBtn.addEventListener('click', async () => {
    if(!confirm(`Удалить отчёт «${report.title}» и все его данные?`)) return;
    try{
      await apiDeleteReport(report.id);
      showToast('Отчёт удалён');
      nav({view:'list'});
    }catch(e){
      showToast(e.message || 'Ошибка удаления');
    }
  });

  function renderPendingBanner(){
    const bannerEl = app.querySelector('#pending-banner');
    const subGridEl = app.querySelector('#sub-grid');
    if(!bannerEl) return;
    if(!pendingSegmentDraft){
      bannerEl.innerHTML = '';
      if(subGridEl) subGridEl.classList.remove('armed');
      return;
    }
    const timeLabel = (pendingSegmentDraft.start != null && pendingSegmentDraft.end != null)
      ? `${formatTime(pendingSegmentDraft.start)}–${formatTime(pendingSegmentDraft.end)}`
      : 'весь ролик';
    bannerEl.innerHTML = `
      <div class="pending-banner">
        <div>
          <div class="pending-banner-title">Отрезок отмечен: <span class="mono">${timeLabel}</span></div>
          <div class="pending-banner-sub">Нажмите на раздел ниже — форма откроется сразу с этим отрезком, останется вписать данные</div>
        </div>
        <button type="button" class="icon-btn danger" title="Отменить" data-action="cancel-pending">✕</button>
      </div>`;
    if(subGridEl) subGridEl.classList.add('armed');
    bannerEl.querySelector('[data-action="cancel-pending"]').addEventListener('click', () => {
      pendingSegmentDraft = null;
      renderPendingBanner();
    });
  }
  renderPendingBanner();

  app.querySelectorAll('.sub-card').forEach(card => {
    card.addEventListener('click', () => {
      const s = card.dataset.sub;
      if(pendingSegmentDraft){
        const draft = pendingSegmentDraft;
        pendingSegmentDraft = null;
        nav({view:'situation-form', id: reportId, sub: s, sid: null, prefillDraft: draft});
      } else {
        nav({view:'section', id: reportId, sub: s});
      }
    });
  });

  function setPendingSegment(seg){
    pendingSegmentDraft = { id: uid(), url: seg.url, start: seg.start, end: seg.end };
    renderPendingBanner();
    showToast('Отрезок отмечен — выберите раздел 7.1–7.10 слева');
  }


  const repLibState = {};

  function resetRepLibSelection(idx){
    const st = repLibState[idx];
    if(st){ st.start = null; }
    const tcBtn = app.querySelector(`#rep-lib-tc-btn-${idx}`);
    if(tcBtn){ tcBtn.innerHTML = '<span>⏱</span> Отметить начало'; tcBtn.classList.remove('active'); tcBtn.disabled = !(st && st.player); }
  }

  function initRepLibPlayer(idx, url){
    const vid = youtubeId(url);
    const playerHost = app.querySelector(`#rep-lib-player-${idx}`);
    if(!playerHost) return;

    if(!vid){
      playerHost.innerHTML = `<div class="placeholder"><div class="glyph">⚠️</div><div>Некорректная ссылка</div></div>`;
      return;
    }
    if(typeof YT === 'undefined' || typeof YT.Player === 'undefined'){
      playerHost.innerHTML = `<div class="placeholder"><div class="glyph">⚠️</div><div>YouTube API не загружен</div></div>`;
      return;
    }

    playerHost.innerHTML = '';
    repLibState[idx] = repLibState[idx] || {};
    repLibState[idx].start = null;
    resetRepLibSelection(idx);

    try{
      const player = new YT.Player(`rep-lib-player-${idx}`, {
        height: '100%', width: '100%', videoId: vid,
        playerVars: { playsinline: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: function(){
            const tcBtn = app.querySelector(`#rep-lib-tc-btn-${idx}`);
            if(tcBtn) tcBtn.disabled = false;
            const fullBtn = app.querySelector(`#rep-lib-full-${idx}`);
            if(fullBtn) fullBtn.disabled = false;
          },
          onError: function(e){ console.warn('YT rep-lib error', e.data); }
        }
      });
      repLibState[idx].player = player;
      reportLibPlayers.push(player);
    }catch(e){
      console.error('YT rep-lib init error', e);
      playerHost.innerHTML = `<div class="placeholder"><div class="glyph">⚠️</div><div>Ошибка инициализации плеера</div></div>`;
    }
  }

  whenYTReady(() => {
    videoLib.forEach((item, idx) => initRepLibPlayer(idx, item.url));
  });

  videoLib.forEach((item, idx) => {
    const tcBtn = app.querySelector(`#rep-lib-tc-btn-${idx}`);
    const fullBtn = app.querySelector(`#rep-lib-full-${idx}`);
    if(!tcBtn) return;
    tcBtn.addEventListener('click', () => {
      const st = repLibState[idx];
      if(!st || !st.player || typeof st.player.getCurrentTime !== 'function'){
        showToast('Плеер ещё не готов');
        return;
      }
      const currentTime = st.player.getCurrentTime();
      if(st.start == null){
        st.start = currentTime;
        tcBtn.innerHTML = `<span>⏱</span> Начало: ${formatTime(currentTime)}. Отметить конец`;
        tcBtn.classList.add('active');
      } else {
        const start = Math.min(st.start, currentTime);
        const end = Math.max(st.start, currentTime);
        setPendingSegment({ url: item.url, start, end });
        resetRepLibSelection(idx);
      }
    });

    if(fullBtn){
      fullBtn.addEventListener('click', () => {
        setPendingSegment({ url: item.url, start: null, end: null });
      });
    }
  });

  app.querySelectorAll('[data-action="rep-toggle-check"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx, 10);
      const item = videoLib[idx];
      if(!item) return;
      const newChecked = !item.checked;
      try{
        await apiSetVideoChecked(item.id, newChecked);
        item.checked = newChecked;
        const itemEl = btn.closest('.lib-item');
        if(itemEl) itemEl.classList.toggle('is-checked', newChecked);
        btn.classList.toggle('checked', newChecked);
        btn.textContent = newChecked ? '✓ Проверено' : 'Проверить';
        showToast(newChecked ? 'Видео отмечено как проверенное' : 'Отметка снята');
      }catch(err){
        showToast(err.message || 'Ошибка сохранения');
      }
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

// ---------- VIDEO LIBRARY (список видео отчёта) ----------
async function renderVideoList(reportId){
  app.innerHTML = topbarHtml() + `<div class="loading">Загрузка списка видео…</div>`;
  bindTopbarLogout();
  const reports = await apiGetReports();
  const report = reports.find(r => r.id === reportId);
  if(!report){ nav({view:'list'}); return; }
  const library = await apiGetVideos(reportId);
  const checkedCount = library.filter(v => v.checked).length;

  app.innerHTML = topbarHtml() + breadcrumbsHtml(report, null, 'Список видео') + `
    <div class="form-page" style="max-width:820px;">
      <div class="page-head">
        <div>
          <h1>Список видео отчёта</h1>
          <p>${escapeHtml(report.title)} • эти видео будут доступны при добавлении ситуаций во всех разделах</p>
        </div>
      </div>

      <div class="form-card">
        ${regMarksHtml()}
        <div class="field" style="margin-bottom:14px;">
          <label>Добавить ссылки (каждая — с новой строки)</label>
          <textarea id="vl-input" rows="5" placeholder="https://www.youtube.com/watch?v=...&#10;https://youtu.be/..."></textarea>
          <div class="err" id="vl-err">Не найдено ни одной корректной ссылки на YouTube</div>
        </div>
        <button class="btn solid" data-action="vl-add">+ Добавить в список</button>
      </div>

      <div class="page-head" style="margin-top:30px; margin-bottom:16px;">
        <div><h1 style="font-size:18px;">В списке: ${library.length}</h1><p>Проверено: ${checkedCount} / ${library.length}</p></div>
      </div>
      <div id="vl-list" class="sit-list">${renderVideoLibraryItems(library)}</div>

      <div class="form-footer">
        <button class="btn ghost" data-action="back-to-report">Назад к отчёту</button>
      </div>
    </div>
  `;

  bindNavHandlers();
  app.querySelector('[data-action="back-to-report"]').addEventListener('click', () => nav({view:'report', id: reportId}));
  bindVideoLibraryRemoveHandlers(reportId);
  bindVideoLibraryCheckHandlers(reportId);

  app.querySelector('[data-action="vl-add"]').addEventListener('click', async () => {
    const raw = app.querySelector('#vl-input').value;
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean).filter(l => youtubeId(l));
    if(lines.length === 0){
      app.querySelector('#vl-err').style.display = 'block';
      return;
    }
    app.querySelector('#vl-err').style.display = 'none';
    try{
      const result = await apiAddVideos(reportId, lines);
      showToast(`Добавлено видео: ${result.added}`);
      renderVideoList(reportId);
    }catch(e){
      showToast(e.message || 'Ошибка добавления');
    }
  });
}

function renderVideoLibraryItems(library){
  if(!library.length){
    return `<div class="empty"><div class="display">Список пуст</div><p>Вставьте ссылки на YouTube-видео выше — они появятся здесь и будут доступны в панели при добавлении ситуаций.</p></div>`;
  }
  return library.map((item) => {
    const vid = youtubeId(item.url);
    const thumb = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : '';
    return `
    <div class="sit-card ${item.checked ? 'is-checked' : ''}">
      <a class="sit-thumb" style="${thumb ? `background-image:url('${thumb}')` : ''}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
        <span class="play">▶</span>
      </a>
      <div class="sit-body">
        <a class="sit-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a>
        ${item.checked ? `<span class="checked-badge" style="margin-top:8px;">✓ Проверено</span>` : ''}
      </div>
      <div class="sit-actions">
        <div class="card-actions-row">
          <button class="btn-check ${item.checked ? 'checked' : ''}" title="Отметить как проверенное" data-action="vl-toggle-check" data-id="${item.id}">${item.checked ? '✓ Проверено' : 'Проверить'}</button>
          <button class="icon-btn danger" title="Удалить из списка" data-action="vl-remove" data-id="${item.id}">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function bindVideoLibraryRemoveHandlers(reportId){
  app.querySelectorAll('[data-action="vl-remove"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try{
        await apiDeleteVideo(btn.dataset.id);
        showToast('Видео удалено из списка');
        renderVideoList(reportId);
      }catch(e){
        showToast(e.message || 'Ошибка удаления');
      }
    });
  });
}

function bindVideoLibraryCheckHandlers(reportId){
  app.querySelectorAll('[data-action="vl-toggle-check"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const isChecked = btn.classList.contains('checked');
      try{
        await apiSetVideoChecked(btn.dataset.id, !isChecked);
        showToast(!isChecked ? 'Видео отмечено как проверенное' : 'Отметка снята');
        renderVideoList(reportId);
      }catch(e){
        showToast(e.message || 'Ошибка сохранения');
      }
    });
  });
}

// ---------- COPY REPORT VIEW ----------
async function renderCopyReportView(reportId, report){
  app.innerHTML = topbarHtml() + breadcrumbsHtml(report, null, 'Копирование отчёта') + `
    <div class="form-page" style="max-width:900px;">
      <div class="page-head">
        <div>
          <h1>Отчёт для копирования</h1>
          <p>${escapeHtml(report.title)}</p>
        </div>
        <button class="btn solid" data-action="copy-to-clipboard">Копировать в буфер</button>
      </div>

      <div class="form-card">
        <div class="field">
          <label>Сформированный отчёт</label>
          <textarea id="report-output" rows="30" readonly></textarea>
        </div>

        <div class="form-footer">
          <button class="btn ghost" data-action="back-to-report">Назад к отчёту</button>
        </div>
      </div>
    </div>
  `;

  bindNavHandlers();

  app.querySelector('[data-action="back-to-report"]').addEventListener('click', () => {
    nav({view:'report', id: reportId});
  });

  app.querySelector('[data-action="copy-to-clipboard"]').addEventListener('click', async () => {
    const textarea = app.querySelector('#report-output');
    textarea.select();
    try {
      await navigator.clipboard.writeText(textarea.value);
      showToast('Отчёт скопирован в буфер обмена');
    } catch(e) {
      showToast('Ошибка копирования');
    }
  });

  const sitData = await apiGetSituations(reportId);
  const library = await apiGetVideos(reportId);
  let reportText = '';
  const seenVideoIdsFromSituations = new Set();
  const uniqueVideosFromSituations = [];

  for(const sub of SUBSECTIONS){
    const list = (sitData[sub] || []).slice().sort((a,b)=>a.createdAt - b.createdAt);
    if(list.length > 0){
      reportText += `${sub}:\n`;
      for(const s of list){
        const segs = situationSegments(s);
        for(const sg of segs){
          const vid = youtubeId(sg.url);
          if(sg.start != null && sg.end != null){
            const linkBase = vid ? `https://youtu.be/${vid}` : sg.url;
            reportText += `${linkBase}?t=${Math.floor(sg.start)} до ${formatTime(sg.end)} - ${sg.comment || ''}\n`;
          } else {
            reportText += `${sg.url} - ${sg.comment || ''}\n`;
          }
          if(vid && !seenVideoIdsFromSituations.has(vid)){
            seenVideoIdsFromSituations.add(vid);
            uniqueVideosFromSituations.push({ vid, url: `https://youtu.be/${vid}` });
          }
        }
      }
      reportText += '\n';
    }
  }

  let uniqueVideos = [];
  if(library.length){
    const seen = new Set();
    for(const item of library){
      const vid = youtubeId(item.url);
      if(vid && !seen.has(vid)){
        seen.add(vid);
        uniqueVideos.push({ vid, url: item.url, checked: !!item.checked });
      }
    }
  } else {
    uniqueVideos = uniqueVideosFromSituations;
  }

  const outputArea = app.querySelector('#report-output');
  const copyBtn = app.querySelector('[data-action="copy-to-clipboard"]');
  outputArea.value = reportText.trim();

  if(uniqueVideos.length === 0){
    return;
  }

  copyBtn.disabled = true;
  outputArea.value = reportText.trim() + '\n\n---\nПодсчёт длительности видео…';

  const durations = await fetchVideoDurations(uniqueVideos.map(v => v.vid));

  let listBlock = 'ОБЩИЙ СПИСОК ВИДЕО:\n';
  let totalSeconds = 0;
  let anyUnknown = false;
  for(const v of uniqueVideos){
    const d = durations[v.vid];
    if(typeof d === 'number' && isFinite(d) && d > 0){
      totalSeconds += d;
      listBlock += `${v.url} [${formatDurationLong(d)}]\n`;
    } else {
      anyUnknown = true;
      listBlock += `${v.url} [длительность не определена]\n`;
    }
  }
  listBlock += `\nОбщая длительность всех видео: ${formatDurationLong(totalSeconds)}${anyUnknown ? ' (без учёта видео с неопределённой длительностью)' : ''}`;

  reportText = reportText.trim() + '\n\n' + listBlock;
  outputArea.value = reportText;
  copyBtn.disabled = false;
}

// ---------- SECTION (SITUATIONS) VIEW ----------
async function renderSection(reportId, sub){
  app.innerHTML = topbarHtml() + `<div class="loading">Загрузка раздела…</div>`;
  bindTopbarLogout();
  const reports = await apiGetReports();
  const report = reports.find(r => r.id === reportId);
  if(!report){ nav({view:'list'}); return; }
  const sitData = await apiGetSituations(reportId);
  const list = (sitData[sub] || []).slice().sort((a,b)=>b.createdAt - a.createdAt);

  const cards = list.length ? list.map(s => {
    const segs = situationSegments(s);
    const primaryUrl = segs[0].url;
    const yid = youtubeId(primaryUrl);
    const thumb = yid ? `https://img.youtube.com/vi/${yid}/hqdefault.jpg` : '';
    const uniqueLinks = [...new Set(segs.map(sg => sg.url).filter(Boolean))];
    const descHtml = segs.map(sg => {
      const timeLabel = (sg.start != null && sg.end != null) ? `<span class="mono" style="color:var(--accent-2);">${formatTime(sg.start)}–${formatTime(sg.end)}</span> ` : '';
      return `${timeLabel}${escapeHtml(sg.comment || '')}`;
    }).join('<br>');
    return `
    <div class="sit-card">
      <a class="sit-thumb" style="${thumb ? `background-image:url('${thumb}')` : ''}" href="${escapeHtml(primaryUrl)}" target="_blank" rel="noopener">
        <span class="play">▶</span>
      </a>
      <div class="sit-body">
        <div class="sit-meta">Добавлено ${formatDate(s.createdAt)} • ${segs.length} ${declineSegment(segs.length)}</div>
        <div class="sit-desc">${descHtml}</div>
        ${uniqueLinks.map(u => `<a class="sit-link" href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(u)}</a>`).join('')}
      </div>
      <div class="sit-actions">
        <div class="card-actions-row">
          <button class="icon-btn" title="Редактировать" data-action="edit-sit" data-sid="${s.id}">✎</button>
          <button class="icon-btn danger" title="Удалить" data-action="del-sit" data-sid="${s.id}">✕</button>
        </div>
      </div>
    </div>`;
  }).join('') : `
    <div class="empty">
      <div class="display">В разделе ${sub} пока пусто</div>
      <p>Добавьте первую ситуацию: выберите отрезки из списка видео отчёта на панели справа.</p>
      <button class="btn solid" data-action="new-sit">+ Добавить ситуацию</button>
    </div>`;

  app.innerHTML = topbarHtml() + breadcrumbsHtml(report, sub) + `
    <div class="page-head">
      <div>
        <h1>Раздел ${sub}</h1>
        <p>${escapeHtml(report.title)}</p>
      </div>
      ${list.length ? `<button class="btn solid" data-action="new-sit">+ Добавить ситуацию</button>` : ''}
    </div>
    <div class="sit-list">${cards}</div>
  `;

  bindNavHandlers();
  const newBtn = app.querySelector('[data-action="new-sit"]');
  if(newBtn) newBtn.addEventListener('click', () => nav({view:'situation-form', id: reportId, sub, sid: null}));

  app.querySelectorAll('[data-action="edit-sit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      nav({view:'situation-form', id: reportId, sub, sid: btn.dataset.sid});
    });
  });
  app.querySelectorAll('[data-action="del-sit"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if(!confirm('Удалить эту ситуацию?')) return;
      try{
        await apiDeleteSituation(btn.dataset.sid);
        showToast('Ситуация удалена');
        renderSection(reportId, sub);
      }catch(e){
        showToast(e.message || 'Ошибка удаления');
      }
    });
  });
}

// ---------- SITUATION FORM ----------
async function renderSituationForm(reportId, sub, sid){
  app.innerHTML = topbarHtml() + `<div class="loading">Загрузка формы…</div>`;
  bindTopbarLogout();

  const prefillDraft = route.prefillDraft || null;
  if(route.prefillDraft) delete route.prefillDraft;

  const reports = await apiGetReports();
  const report = reports.find(r => r.id === reportId);
  if(!report){ nav({view:'list'}); return; }

  let existing = null;
  if(sid){
    const allSits = await apiGetSituations(reportId);
    existing = (allSits[sub]||[]).find(s => s.id === sid);
  }

  const isEdit = !!existing;
  const pageTitle = isEdit ? `Редактирование ситуации` : `Новая ситуация`;
  const library = await apiGetVideos(reportId);

  let segments = isEdit
    ? situationSegments(existing).map(sg => ({
        id: (sg.id && sg.id !== 'legacy') ? sg.id : uid(),
        url: sg.url, start: sg.start, end: sg.end, comment: sg.comment || ''
      }))
    : [];

  const libraryItemsHtml = library.map((item, idx) => `
    <div class="lib-item ${item.checked ? 'is-checked' : ''}" data-idx="${idx}">
      <div class="lib-item-head">
        <a class="lib-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a>
        <button type="button" class="btn-check ${item.checked ? 'checked' : ''}" title="Отметить как проверенное" data-action="sf-toggle-check" data-idx="${idx}">${item.checked ? '✓ Проверено' : 'Проверить'}</button>
      </div>
      <div class="video-preview" id="lib-player-${idx}">
        <div class="placeholder"><div class="glyph">📺</div><div>Загрузка плеера…</div></div>
      </div>
      <div class="timecode-controls">
        <button type="button" class="btn-timecode" id="lib-tc-btn-${idx}" data-idx="${idx}" disabled>
          <span>⏱</span> Отметить начало
        </button>
        <button type="button" class="btn-timecode btn-timecode-full" id="lib-full-${idx}" data-idx="${idx}" disabled>
          Целиком
        </button>
      </div>
    </div>
  `).join('');

  app.innerHTML = `
    <div class="sf-wrap">
      <div class="sf-top">
        <div class="sf-brand">
          <div class="brand-mark"><span>Р</span></div>
          ${breadcrumbsHtml(report, sub, pageTitle)}
        </div>
        <div class="sf-title">
          <h1>${pageTitle}</h1>
          <p>Раздел ${sub} • ${escapeHtml(report.title)}</p>
        </div>
        <div class="sf-top-actions">
          <button class="btn ghost" data-action="cancel-form">Отмена</button>
          <button class="btn solid" data-action="save-form">${isEdit ? 'Сохранить изменения' : 'Добавить ситуацию'}</button>
        </div>
      </div>

      <div class="sf-split">
        <div class="sf-pane sf-pane-left">
          ${regMarksHtml()}
          <div class="field" id="draft-section" style="margin-bottom:22px; display:none;">
            <label>Черновики — впишите комментарий и подтвердите</label>
            <div class="draft-list" id="draft-list"></div>
          </div>
          <div class="field" style="margin-bottom:8px;">
            <label>Отрезки в этой ситуации</label>
            <div class="seg-list" id="seg-list"></div>
            <div class="err" id="f-seg-err">Добавьте хотя бы один отрезок из панели справа</div>
          </div>
        </div>

        <div class="sf-pane sf-pane-right">
          <h3>Видео из списка отчёта (${library.length}) — плееры загружены</h3>
          ${library.length ? libraryItemsHtml : `
            <div class="empty" style="padding:26px 12px;">
              <p style="margin:0 0 14px;">Список видео отчёта пуст. Добавьте туда ссылки, чтобы они появились здесь.</p>
              <button class="btn ghost" data-action="go-video-list" style="width:100%; font-size:12px;">Перейти к списку видео</button>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  bindNavHandlers();

  app.querySelector('[data-action="cancel-form"]').addEventListener('click', () => {
    nav({view:'report', id: reportId});
  });

  const goVideoListBtn = app.querySelector('[data-action="go-video-list"]');
  if(goVideoListBtn) goVideoListBtn.addEventListener('click', () => nav({view:'video-list', id: reportId}));

  let drafts = [];
  if(prefillDraft){
    drafts.push({ id: prefillDraft.id || uid(), url: prefillDraft.url, start: prefillDraft.start, end: prefillDraft.end, comment: '' });
  }

  async function saveSituation(){
    if(!segments.length){
      app.querySelector('#f-seg-err').style.display = 'block';
      return false;
    }
    app.querySelector('#f-seg-err').style.display = 'none';

    const payloadSegments = segments.map(sg => ({ id: sg.id, url: sg.url, start: sg.start, end: sg.end, comment: sg.comment }));

    try{
      if(isEdit){
        await apiUpdateSituation(existing.id, payloadSegments);
      } else {
        await apiCreateSituation(reportId, sub, payloadSegments);
      }
      return true;
    }catch(e){
      showToast(e.message || 'Ошибка сохранения');
      return false;
    }
  }

  function renderDraftList(){
    const section = app.querySelector('#draft-section');
    const listEl = app.querySelector('#draft-list');
    if(!drafts.length){
      section.style.display = 'none';
      listEl.innerHTML = '';
      return;
    }
    section.style.display = 'block';
    listEl.innerHTML = drafts.map(d => {
      const timeLabel = (d.start != null && d.end != null) ? `${formatTime(d.start)}–${formatTime(d.end)}` : 'весь ролик';
      return `
      <div class="draft-item" data-id="${d.id}">
        <div class="seg-meta">${timeLabel} <span style="color:var(--muted);">•</span> <a href="${escapeHtml(d.url)}" target="_blank" rel="noopener" style="color:var(--accent-2);">${escapeHtml(d.url)}</a></div>
        <textarea class="draft-comment-input" id="draft-comment-${d.id}" rows="2" placeholder="Комментарий к отрезку">${escapeHtml(d.comment || '')}</textarea>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button type="button" class="btn solid" style="flex:1; font-size:12.5px; padding:8px 10px;" data-action="draft-confirm" data-id="${d.id}">+ Добавить отрезок</button>
          <button type="button" class="btn ghost" style="font-size:12.5px; padding:8px 10px;" data-action="draft-discard" data-id="${d.id}">Отменить</button>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('[data-action="draft-confirm"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const d = drafts.find(x => x.id === id);
        if(!d) return;
        const comment = (app.querySelector(`#draft-comment-${id}`).value || '').trim();
        segments.push({ id: uid(), url: d.url, start: d.start, end: d.end, comment });
        drafts = drafts.filter(x => x.id !== id);
        const ok = await saveSituation();
        if(ok){
          showToast(isEdit ? 'Изменения сохранены' : 'Отрезок сохранён — ситуация добавлена');
          nav({view:'report', id: reportId});
        } else {
          renderSegList();
          renderDraftList();
        }
      });
    });
    listEl.querySelectorAll('[data-action="draft-discard"]').forEach(btn => {
      btn.addEventListener('click', () => {
        drafts = drafts.filter(x => x.id !== btn.dataset.id);
        renderDraftList();
      });
    });
  }
  renderDraftList();
  if(prefillDraft){
    const seedId = prefillDraft.id || drafts[0]?.id;
    setTimeout(() => {
      const ta = app.querySelector(`#draft-comment-${seedId}`);
      if(ta) ta.focus();
    }, 60);
  }

  function renderSegList(){
    const segListEl = app.querySelector('#seg-list');
    if(!segments.length){
      segListEl.innerHTML = `<div class="empty" style="padding:22px 14px;"><p style="margin:0;">Пока не добавлено ни одного отрезка. Выберите видео справа, отметьте начало и конец (или добавьте видео целиком) и нажмите «Добавить отрезок».</p></div>`;
      return;
    }
    segListEl.innerHTML = segments.map(sg => {
      const timeLabel = (sg.start != null && sg.end != null) ? `${formatTime(sg.start)}–${formatTime(sg.end)}` : 'весь ролик';
      return `
      <div class="seg-item">
        <button type="button" class="icon-btn danger seg-remove" title="Удалить отрезок" data-action="remove-segment" data-id="${sg.id}">✕</button>
        <div class="seg-meta">${timeLabel} <span style="color:var(--muted);">•</span> <a href="${escapeHtml(sg.url)}" target="_blank" rel="noopener" style="color:var(--accent-2);">${escapeHtml(sg.url)}</a></div>
        <div class="seg-comment">${sg.comment ? escapeHtml(sg.comment) : '<span style="color:var(--muted);">без комментария</span>'}</div>
      </div>`;
    }).join('');
    segListEl.querySelectorAll('[data-action="remove-segment"]').forEach(btn => {
      btn.addEventListener('click', () => {
        segments = segments.filter(sg => sg.id !== btn.dataset.id);
        renderSegList();
      });
    });
  }
  renderSegList();

  const libState = {};

  function resetLibSelection(idx){
    const st = libState[idx];
    if(st){ st.start = null; st.pendingEnd = null; }
    const tcBtn = app.querySelector(`#lib-tc-btn-${idx}`);
    if(tcBtn){ tcBtn.innerHTML = '<span>⏱</span> Отметить начало'; tcBtn.classList.remove('active'); tcBtn.disabled = !(st && st.player); }
  }

  function initLibPlayer(idx, url){
    const vid = youtubeId(url);
    const playerHost = app.querySelector(`#lib-player-${idx}`);
    if(!playerHost) return;

    if(!vid){
      playerHost.innerHTML = `<div class="placeholder"><div class="glyph">⚠️</div><div>Некорректная ссылка</div></div>`;
      return;
    }
    if(typeof YT === 'undefined' || typeof YT.Player === 'undefined'){
      playerHost.innerHTML = `<div class="placeholder"><div class="glyph">⚠️</div><div>YouTube API не загружен</div></div>`;
      return;
    }

    playerHost.innerHTML = '';
    libState[idx] = libState[idx] || {};
    libState[idx].start = null;
    libState[idx].pendingEnd = null;
    resetLibSelection(idx);

    try{
      const player = new YT.Player(`lib-player-${idx}`, {
        height: '100%', width: '100%', videoId: vid,
        playerVars: { playsinline: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: function(){
            const tcBtn = app.querySelector(`#lib-tc-btn-${idx}`);
            if(tcBtn) tcBtn.disabled = false;
            const fullBtn = app.querySelector(`#lib-full-${idx}`);
            if(fullBtn) fullBtn.disabled = false;
          },
          onError: function(e){ console.warn('YT lib error', e.data); }
        }
      });
      libState[idx].player = player;
      libPlayers.push(player);
    }catch(e){
      console.error('YT lib init error', e);
      playerHost.innerHTML = `<div class="placeholder"><div class="glyph">⚠️</div><div>Ошибка инициализации плеера</div></div>`;
    }
  }

  whenYTReady(() => {
    library.forEach((item, idx) => initLibPlayer(idx, item.url));
  });

  library.forEach((item, idx) => {
    const tcBtn = app.querySelector(`#lib-tc-btn-${idx}`);
    const fullBtn = app.querySelector(`#lib-full-${idx}`);
    if(!tcBtn) return;
    tcBtn.addEventListener('click', () => {
      const st = libState[idx];
      if(!st || !st.player || typeof st.player.getCurrentTime !== 'function'){
        showToast('Плеер ещё не готов');
        return;
      }
      const currentTime = st.player.getCurrentTime();
      if(st.start == null){
        st.start = currentTime;
        tcBtn.innerHTML = `<span>⏱</span> Начало: ${formatTime(currentTime)}. Отметить конец`;
        tcBtn.classList.add('active');
      } else {
        const start = Math.min(st.start, currentTime);
        const end = Math.max(st.start, currentTime);
        drafts.push({ id: uid(), url: item.url, start, end, comment: '' });
        renderDraftList();
        showToast('Добавлено в черновики — впишите комментарий слева');
        resetLibSelection(idx);
      }
    });

    if(fullBtn){
      fullBtn.addEventListener('click', () => {
        drafts.push({ id: uid(), url: item.url, start: null, end: null, comment: '' });
        renderDraftList();
        showToast('Добавлено в черновики — впишите комментарий слева');
      });
    }
  });

  app.querySelectorAll('[data-action="sf-toggle-check"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx, 10);
      const item = library[idx];
      if(!item) return;
      const newChecked = !item.checked;
      try{
        await apiSetVideoChecked(item.id, newChecked);
        item.checked = newChecked;
        const itemEl = btn.closest('.lib-item');
        if(itemEl) itemEl.classList.toggle('is-checked', newChecked);
        btn.classList.toggle('checked', newChecked);
        btn.textContent = newChecked ? '✓ Проверено' : 'Проверить';
        showToast(newChecked ? 'Видео отмечено как проверенное' : 'Отметка снята');
      }catch(err){
        showToast(err.message || 'Ошибка сохранения');
      }
    });
  });

  app.querySelector('[data-action="save-form"]').addEventListener('click', async () => {
    if(drafts.length){
      showToast('Завершите черновики слева: добавьте или отмените');
      return;
    }
    const ok = await saveSituation();
    if(!ok) return;
    showToast(isEdit ? 'Изменения сохранены' : 'Ситуация добавлена');
    nav({view:'report', id: reportId});
  });
}


// ---------- shared nav binder ----------
function bindNavHandlers(){
  app.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      const view = el.dataset.nav;
      if(view === 'list') nav({view:'list'});
      else if(view === 'report') nav({view:'report', id: el.dataset.id});
      else if(view === 'section') nav({view:'section', id: el.dataset.id, sub: el.dataset.sub});
    });
  });
}

// ---------- запуск ----------
nav(getToken() ? {view:'list'} : {view:'auth'});
