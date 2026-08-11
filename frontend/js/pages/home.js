const UNLOCK_KEY = "unlocked:industryAnalytics";
const EXEC_UNLOCK_KEY = "unlocked:execDashboard";

function isIndustryAnalyticsUnlocked() {
  return localStorage.getItem(UNLOCK_KEY) === "true";
}

function isExecDashboardUnlocked() {
  return localStorage.getItem(EXEC_UNLOCK_KEY) === "true";
}

export function mountHome(container, user) {
  const unlocked = isIndustryAnalyticsUnlocked();
  const execUnlocked = isExecDashboardUnlocked();

  container.innerHTML = `
    <div class="home">

      <h1 class="home-title">Welcome</h1>

      <div class="feature-card" id="goRadial">

        <div class="feature-card__image">
          <img src="assets/RadialExCard.png" alt="Radial chart preview">
        </div>

        <div class="feature-card__content">
          <h2>Explore Radial Chart</h2>
          <p>
            Visualise your data with an interactive radial hierarchy chart.
            Explore patterns, drill into regions, and uncover insights.
          </p>

        </div>

      </div>

      ${/*
      <div class="feature-card" id="goUserRadial">

        <div class="feature-card__image">
          <img src="assets/RadialExCard.png" alt="Radial chart preview">
        </div>

        <div class="feature-card__content">
          <h2>Uploaded Radial Chart</h2>
          <p>
            Visualise your own uploaded data with an interactive radial hierarchy chart.
          </p>

        </div>

      </div>
      */ ''}

      <div class="feature-card" id="goScrollytelling">

        <div class="feature-card__image">
          <img src="assets/scrolly_icon.png" alt="Scrollytelling report preview">
        </div>

        <div class="feature-card__content">
          <h2>Scrollytelling Report</h2>
          <p>
            Scroll through a narrative report with animated charts
            highlighting the key findings.
          </p>

        </div>

      </div>

      <div class="feature-card" id="goSegmentation">

        <div class="feature-card__image">
          <img src="assets/segmentation_icon.svg" alt="Segmentation explorer preview">
        </div>

        <div class="feature-card__content">
          <h2>Segmentation Explorer</h2>
          <p>
            Explore employee comms personas, compare any two side by side,
            and chat directly with a persona to test messages on them.
          </p>
        </div>

      </div>

      <div class="feature-card${unlocked ? '' : ' feature-card--locked'}" id="goIndustryAnalytics">

        <div class="feature-card__image">
          <img src="assets/Industry_analytics_icon.png" alt="Industry analytics reports preview">
          <div class="feature-card__lock-overlay" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">
              <rect x="5" y="11" width="14" height="9" rx="1.5"/>
              <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
            </svg>
          </div>
        </div>

        <div class="feature-card__content">
          <h2>Industry Analytics Reports</h2>
          <p>
            Benchmark your organisation against industry-wide analytics
            and emerging trends.
          </p>

        </div>

      </div>

      <div class="feature-card${execUnlocked ? '' : ' feature-card--locked'}" id="goExecDashboard">

        <div class="feature-card__image feature-card__image--placeholder" aria-hidden="true">
          <span class="feature-card__placeholder-emoji">📈</span>
          <div class="feature-card__lock-overlay" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">
              <rect x="5" y="11" width="14" height="9" rx="1.5"/>
              <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
            </svg>
          </div>
        </div>

        <div class="feature-card__content">
          <h2>Executive Dashboard</h2>
          <p>
            A high-level view built for leadership, surfacing the metrics
            that matter most at a glance.
          </p>

        </div>

      </div>

    </div>

    <div class="upload-modal-backdrop" id="accessModalBackdrop" role="dialog"
         aria-modal="true" aria-labelledby="accessModalTitle" style="display:none;">
      <div class="upload-modal">
        <h2 id="accessModalTitle">Access required</h2>
        <p>You don't have access to this product. I agree to pay K&amp;B ££££ for access.</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="accessModalNo">No</button>
          <button type="button" class="btn-primary" id="accessModalYes">Yes</button>
        </div>
      </div>
    </div>

    <div class="upload-modal-backdrop" id="execModalBackdrop" role="dialog"
         aria-modal="true" aria-labelledby="execModalTitle" style="display:none;">
      <div class="upload-modal">
        <h2 id="execModalTitle">Access required</h2>
        <p>You don't have access to this section. Please pay £££ to Matty to unlock it.</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="execModalNo">No way</button>
          <button type="button" class="btn-primary" id="execModalYes">Fine</button>
        </div>
      </div>
    </div>
  `;

  // Navigation
  container.querySelector('#goRadial').addEventListener('click', () => {
    window.location.hash = "/radial";
  });
  // container.querySelector('#goUserRadial').addEventListener('click', () => {
  //   window.location.hash = "/userradial";
  // });
  container.querySelector('#goScrollytelling').addEventListener('click', () => {
    window.location.hash = "/scrollytelling";
  });
  container.querySelector('#goSegmentation').addEventListener('click', () => {
    window.location.hash = "/segmentation";
  });

  // Industry Analytics Reports — gated behind a mock "access" confirmation
  const industryCard   = container.querySelector('#goIndustryAnalytics');
  const accessBackdrop = container.querySelector('#accessModalBackdrop');
  const accessYes      = container.querySelector('#accessModalYes');
  const accessNo       = container.querySelector('#accessModalNo');

  function onEscKey(e) {
    if (e.key === 'Escape') closeAccessModal();
  }

  function openAccessModal() {
    accessBackdrop.style.display = 'flex';
    document.addEventListener('keydown', onEscKey);
  }

  function closeAccessModal() {
    accessBackdrop.style.display = 'none';
    document.removeEventListener('keydown', onEscKey);
  }

  industryCard.addEventListener('click', () => {
    if (isIndustryAnalyticsUnlocked()) {
      window.location.hash = "/industryanalytics";
    } else {
      openAccessModal();
    }
  });

  accessNo.addEventListener('click', closeAccessModal);
  accessBackdrop.addEventListener('click', e => {
    if (e.target === accessBackdrop) closeAccessModal();
  });

  accessYes.addEventListener('click', () => {
    localStorage.setItem(UNLOCK_KEY, 'true');
    industryCard.classList.remove('feature-card--locked');
    closeAccessModal();
  });

  // Executive Dashboard — fake locked section, gated behind a joke "payment" prompt
  const execCard     = container.querySelector('#goExecDashboard');
  const execBackdrop = container.querySelector('#execModalBackdrop');
  const execYes      = container.querySelector('#execModalYes');
  const execNo       = container.querySelector('#execModalNo');

  function onExecEscKey(e) {
    if (e.key === 'Escape') closeExecModal();
  }

  function openExecModal() {
    execBackdrop.style.display = 'flex';
    document.addEventListener('keydown', onExecEscKey);
  }

  function closeExecModal() {
    execBackdrop.style.display = 'none';
    document.removeEventListener('keydown', onExecEscKey);
  }

  execCard.addEventListener('click', () => {
    if (isExecDashboardUnlocked()) {
      window.location.hash = "/supercool";
    } else {
      openExecModal();
    }
  });

  execNo.addEventListener('click', closeExecModal);
  execBackdrop.addEventListener('click', e => {
    if (e.target === execBackdrop) closeExecModal();
  });

  execYes.addEventListener('click', () => {
    localStorage.setItem(EXEC_UNLOCK_KEY, 'true');
    execCard.classList.remove('feature-card--locked');
    closeExecModal();
    window.location.hash = "/supercool";
  });
}