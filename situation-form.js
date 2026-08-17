const app = document.getElementById('app');
let libPlayers = [];

async function renderSituationForm(reportId, sub, sid, prefillDraft){
  app.innerHTML = topbarHtml() + `<div class="loading">Загрузка формы…</div>`;
  bindTopbarLogout();

  if(libPlayers.length){
    libPlayers.forEach(p => { try{ if(p && typeof p.destroy === 'function') p.destroy(); }catch(e){} });
    libPlayers = [];
  }

  const reports = await apiGetReports();
  const report = reports.find(r => r.id === reportId);
  if(!report){ location.href = 'list.html'; return; }

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
    location.href = `report.html?id=${encodeURIComponent(reportId)}`;
  });

  const goVideoListBtn = app.querySelector('[data-action="go-video-list"]');
  if(goVideoListBtn) goVideoListBtn.addEventListener('click', () => {
    location.href = `video-list.html?id=${encodeURIComponent(reportId)}`;
  });

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
          location.href = `report.html?id=${encodeURIComponent(reportId)}`;
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
    location.href = `report.html?id=${encodeURIComponent(reportId)}`;
  });
}

if(requireAuth()){
  const reportId = qs('id');
  const sub = qs('sub');
  const sid = qs('sid');
  if(!reportId || !sub){
    location.href = 'list.html';
  } else {
    let prefillDraft = null;
    if(qs('draft') === '1'){
      try{
        const raw = sessionStorage.getItem(PREFILL_DRAFT_KEY);
        if(raw) prefillDraft = JSON.parse(raw);
      }catch(e){}
      sessionStorage.removeItem(PREFILL_DRAFT_KEY);
    }
    renderSituationForm(reportId, sub, sid, prefillDraft);
  }
}
