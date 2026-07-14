const UNLOCK_KEY = "unlocked:industryAnalytics";

function isIndustryAnalyticsUnlocked() {
  return localStorage.getItem(UNLOCK_KEY) === "true";
}

export function mountHome(container, user) {
  const unlocked = isIndustryAnalyticsUnlocked();

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
}