const app = document.getElementById('app');

async function renderVideoList(reportId){
  app.innerHTML = topbarHtml() + `<div class="loading">Загрузка списка видео…</div>`;
  bindTopbarLogout();
  const reports = await apiGetReports();
  const report = reports.find(r => r.id === reportId);
  if(!report){ location.href = 'list.html'; return; }
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
  app.querySelector('[data-action="back-to-report"]').addEventListener('click', () => {
    location.href = `report.html?id=${encodeURIComponent(reportId)}`;
  });
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

if(requireAuth()){
  const reportId = qs('id');
  if(!reportId){
    location.href = 'list.html';
  } else {
    renderVideoList(reportId);
  }
}
