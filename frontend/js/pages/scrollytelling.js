export async function mountScrollytelling(container) {
  container.innerHTML = `
    <div class="scrollytelling-page">
      <div class="chart-loading" id="scrollyStatus">Loading report&hellip;</div>
      <div class="reports-content" id="scrollyPicker" style="display:none;">
        <h1>Select a report</h1>
        <ul class="report-list" id="scrollyList"></ul>
      </div>
      <button type="button" id="scrollyBack" class="report-back-link" style="display:none;">All reports</button>
      <iframe
        class="scrollytelling-frame"
        id="scrollyFrame"
        title="Report"
        style="display:none;"
      ></iframe>
    </div>
  `;

  const statusEl = container.querySelector('#scrollyStatus');
  const pickerEl = container.querySelector('#scrollyPicker');
  const listEl   = container.querySelector('#scrollyList');
  const backEl   = container.querySelector('#scrollyBack');
  const frame    = container.querySelector('#scrollyFrame');

  let files = [];

  function showFrame(file) {
    frame.src = file.viewUrl;
    frame.style.display = '';
    pickerEl.style.display = 'none';
    backEl.style.display = files.length > 1 ? '' : 'none';
  }

  function showPicker() {
    frame.style.display = 'none';
    frame.src = '';
    backEl.style.display = 'none';
    pickerEl.style.display = '';
  }

  backEl.addEventListener('click', showPicker);

  try {
    const res = await fetch('/api/reports/scrollytelling');

    if (!res.ok) {
      statusEl.textContent = res.status === 403
        ? "You don't have access to this report."
        : 'Could not load this report.';
      return;
    }

    const body = await res.json();
    files = body.files || [];

    if (files.length === 0) {
      statusEl.textContent = 'No reports available yet.';
      return;
    }

    statusEl.style.display = 'none';

    if (files.length === 1) {
      showFrame(files[0]);
      return;
    }

    listEl.innerHTML = files.map((f, i) => `
      <li class="report-item">
        <div class="report-item__info">
          <span class="report-item__name">${f.title || f.client}</span>
          <span class="report-item__client">${f.description || f.blobName}</span>
        </div>
        <div class="report-item__actions">
          <button type="button" class="btn-primary" data-index="${i}">View</button>
        </div>
      </li>
    `).join('');

    listEl.querySelectorAll('button[data-index]').forEach(btn => {
      btn.addEventListener('click', () => showFrame(files[Number(btn.dataset.index)]));
    });

    pickerEl.style.display = '';
  } catch {
    statusEl.textContent = 'Could not load this report.';
  }
}
