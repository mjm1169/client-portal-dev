export function mountHome(container, user) {
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
}