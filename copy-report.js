const app = document.getElementById('app');

async function renderCopyReportView(reportId){
  app.innerHTML = topbarHtml() + `<div class="loading">Загрузка отчёта…</div>`;
  bindTopbarLogout();

  const reports = await apiGetReports();
  const report = reports.find(r => r.id === reportId);
  if(!report){ location.href = 'list.html'; return; }

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
    location.href = `report.html?id=${encodeURIComponent(reportId)}`;
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

if(requireAuth()){
  const reportId = qs('id');
  if(!reportId){
    location.href = 'list.html';
  } else {
    renderCopyReportView(reportId);
  }
}
