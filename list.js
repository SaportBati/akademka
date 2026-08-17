const app = document.getElementById('app');

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
      location.href = 'report.html?id=' + encodeURIComponent(report.id);
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

if(requireAuth()) renderList();
