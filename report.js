const app = document.getElementById('app');
let reportLibPlayers = [];
let pendingSegmentDraft = null;

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

  if(reportLibPlayers.length){
    reportLibPlayers.forEach(p => { try{ if(p && typeof p.destroy === 'function') p.destroy(); }catch(e){} });
    reportLibPlayers = [];
  }
  pendingSegmentDraft = null;

  let reports, sit, videoLib;
  try{
    reports = await apiGetReports();
  }catch(e){
    app.innerHTML = topbarHtml() + `<div class="empty"><div class="display">Ошибка</div><p>${escapeHtml(e.message)}</p></div>`;
    bindTopbarLogout();
    return;
  }
  const report = reports.find(r => r.id === reportId);
  if(!report){ location.href = 'list.html'; return; }
  try{
    sit = await apiGetSituations(reportId);
    videoLib = await apiGetVideos(reportId);
  }catch(e){
    app.innerHTML = topbarHtml() + `<div class="empty"><div class="display">Ошибка</div><p>${escapeHtml(e.message)}</p></div>`;
    bindTopbarLogout();
    return;
  }
  const totalSituations = SUBSECTIONS.reduce((sum,s) => sum + (sit[s]||[]).length, 0);

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

  app.querySelector('[data-action="copy-report"]').addEventListener('click', () => {
    location.href = 'copy-report.html?id=' + encodeURIComponent(reportId);
  });

  app.querySelector('[data-action="video-list"]').addEventListener('click', () => {
    location.href = 'video-list.html?id=' + encodeURIComponent(reportId);
  });

  const goVideoListQuickBtn = app.querySelector('[data-action="go-video-list-quick"]');
  if(goVideoListQuickBtn) goVideoListQuickBtn.addEventListener('click', () => {
    location.href = 'video-list.html?id=' + encodeURIComponent(reportId);
  });

  const delBtn = app.querySelector('[data-action="delete-report"]');
  delBtn.addEventListener('click', async () => {
    if(!confirm(`Удалить отчёт «${report.title}» и все его данные?`)) return;
    try{
      await apiDeleteReport(report.id);
      showToast('Отчёт удалён');
      location.href = 'list.html';
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
        sessionStorage.setItem(PREFILL_DRAFT_KEY, JSON.stringify(draft));
        location.href = `situation-form.html?id=${encodeURIComponent(reportId)}&sub=${encodeURIComponent(s)}&draft=1`;
      } else {
        location.href = `section.html?id=${encodeURIComponent(reportId)}&sub=${encodeURIComponent(s)}`;
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

if(requireAuth()){
  const reportId = qs('id');
  if(!reportId){
    location.href = 'list.html';
  } else {
    renderReport(reportId);
  }
}
