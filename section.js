const app = document.getElementById('app');

async function renderSection(reportId, sub){
  app.innerHTML = topbarHtml() + `<div class="loading">Загрузка раздела…</div>`;
  bindTopbarLogout();
  const reports = await apiGetReports();
  const report = reports.find(r => r.id === reportId);
  if(!report){ location.href = 'list.html'; return; }
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
  if(newBtn) newBtn.addEventListener('click', () => {
    location.href = `situation-form.html?id=${encodeURIComponent(reportId)}&sub=${encodeURIComponent(sub)}`;
  });

  app.querySelectorAll('[data-action="edit-sit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      location.href = `situation-form.html?id=${encodeURIComponent(reportId)}&sub=${encodeURIComponent(sub)}&sid=${encodeURIComponent(btn.dataset.sid)}`;
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

if(requireAuth()){
  const reportId = qs('id');
  const sub = qs('sub');
  if(!reportId || !sub){
    location.href = 'list.html';
  } else {
    renderSection(reportId, sub);
  }
}
