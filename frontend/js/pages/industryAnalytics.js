export async function mountIndustryAnalytics(container) {
  container.innerHTML = `
    <div class="reports-page">
      <div class="reports-content">
        <h1>Industry Analytics Reports</h1>
        <div class="chart-loading" id="reportsStatus">Loading reports&hellip;</div>
        <ul class="report-list" id="reportList" style="display:none;"></ul>
      </div>
    </div>
  `;

  const statusEl = container.querySelector('#reportsStatus');
  const listEl   = container.querySelector('#reportList');

  try {
    const res = await fetch('/api/reports/industry_analytics');

    if (!res.ok) {
      statusEl.textContent = res.status === 403
        ? "You don't have access to any industry analytics reports."
        : 'Could not load reports.';
      return;
    }

    const { files = [] } = await res.json();

    if (files.length === 0) {
      statusEl.textContent = 'No reports available yet.';
      return;
    }

    listEl.innerHTML = files.map(f => `
      <li class="report-item">
        <div class="report-item__info">
          <span class="report-item__name">${f.blobName}</span>
          <span class="report-item__client">${f.client}</span>
        </div>
        <div class="report-item__actions">
          <a class="btn-secondary" href="${f.viewUrl}" target="_blank" rel="noopener">View</a>
          <a class="btn-primary" href="${f.downloadUrl}" download="${f.blobName}">Download</a>
        </div>
      </li>
    `).join('');

    listEl.style.display = '';
    statusEl.style.display = 'none';
  } catch {
    statusEl.textContent = 'Could not load reports.';
  }
}
