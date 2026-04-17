//import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as d3 from "d3";
export function mountRadial(container, user) {
  renderLayout(container);
  initCardCarousel(container);
  setTimeout(() => loadData(container, user), 0);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
function renderLayout(container) {
  container.innerHTML = `
    <div class="app">
      <aside class="side-pane" aria-label="Chart explanation">
        <div class="card-carousel">
          <div class="card-stage">
            <section class="info-card active">
              <h1>Interactive ONS radial chart</h1>
              <p>This chart represents a hierarchy. Each segment size is proportional to its value, and colour indicates score banding.</p>
              <p>Use the dropdown on the chart to switch score views.</p>
              <h2>Navigation</h2>
              <p>The buttons at the bottom of this pane will take you through the key points we've found</p>
              <h2>How to read it</h2>
              <p>Start from the centre (Level 1) and move outward through levels. Each ring represents a deeper level in the hierarchy.</p>
              <p>Click segments to explore (where enabled).</p>
              <h2>Colour meaning</h2>
              <p>Colours map to score thresholds. The legend in the chart panel shows the bands for the current score selection.</p>
              <h2>Labels</h2>
              <p>Labels appear on segments where space allows. As the chart scales down, labels scale with it to preserve proportion.</p>
              <h2>Tips</h2>
              <p>If you're presenting this, keep the chart visible while stepping through these cards using Back / Next.</p>
              <p>On smaller screens, the cards area scrolls if needed.</p>
            </section>

            <section class="info-card">
              <h1>Region 1</h1>
              <p>Region1 scores low on pride, but there are pockets of positivity in some Trusts</p>
            </section>

            <section class="info-card">
              <h1>NHS England</h1>
              <p>NHS England has moderately company advocacy scores but there is a clear split between low scores in Region 1 and high scores in other regions.</p>
            </section>

            <section class="info-card">
              <h1>Region 3</h1>
              <p>Region 3 has consistent low scores on the senior leader metric.</p>
            </section>

            <section class="info-card">
              <h1>Summary</h1>
              <p>Explore further by clicking on segments of interest. Use the centre circle to go back a level and the reset button to completely reset the chart.</p>
            </section>
          </div>

          <div class="card-nav" aria-label="Card navigation">
            <button type="button" id="prevCard">Back</button>
            <div class="card-dots" id="cardDots" aria-label="Card position"></div>
            <button type="button" id="nextCard">Next</button>
          </div>
        </div>
      </aside>

      <main class="chart-pane" aria-label="Chart">
        <div class="chart-overlay">
          <div class="chart-controls">
            <div class="control-group">
              <label for="scoreSelector">Score</label>
              <select id="scoreSelector"></select>
            </div>
            <div class="control-actions">
              <button id="resetButton" class="btn-secondary">Show root</button>
              <button id="downloadSVG" class="btn-secondary">Download</button>
            </div>
          </div>
          <div class="chart-status" id="chartStatus"></div>
          <div class="chart-legend" id="chartLegend"></div>
        </div>
        <div id="chart">
          <div class="chart-loading">Loading chart…</div>
        </div>
      </main>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Card carousel
// ---------------------------------------------------------------------------
function initCardCarousel(container) {
  const cards = Array.from(container.querySelectorAll('.info-card'));
  if (!cards.length) return;

  const prevBtn = container.querySelector('#prevCard');
  const nextBtn = container.querySelector('#nextCard');
  const dotsEl  = container.querySelector('#cardDots');

  let idx = cards.findIndex(c => c.classList.contains('active'));
  if (idx === -1) idx = 0;

  dotsEl.innerHTML = '';
  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'card-dot' + (i === idx ? ' active' : '');
    dot.addEventListener('click', () => setIdx(i));
    dotsEl.appendChild(dot);
  });

  function render() {
    cards.forEach((c, i) => c.classList.toggle('active', i === idx));
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === cards.length - 1;
    Array.from(dotsEl.children).forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  function setIdx(i) {
    idx = Math.max(0, Math.min(cards.length - 1, i));
    render();
  }

  prevBtn.addEventListener('click', () => setIdx(idx - 1));
  nextBtn.addEventListener('click', () => setIdx(idx + 1));
  render();
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------
async function loadData(container, user, projectId = null) {
  try {
    if (!user.userDetails) {
      console.warn("No user detected");
      return;
    }

    const chartEl = container.querySelector('#chart');
    const url = projectId ? `/api/me?project=${encodeURIComponent(projectId)}` : `/api/me`;
    const res = await fetch(url);

    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = "/.auth/login/aad";
        return;
      }
      if (res.status === 403) {
        chartEl.innerHTML = `<div class="chart-loading">No dataset assigned to your account. Please contact your administrator.</div>`;
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.projects && data.projects.length > 1) {
      renderProjectDropdown(container, data.projects, data.currentProject, selected => {
        loadData(container, user, selected);
      });
    }

    requestAnimationFrame(() => drawChart(data.tree, data.scores, chartEl));

  } catch (err) {
    console.error("loadData error", err);
  }
}

function renderProjectDropdown(container, projects, currentProject, onChange) {
  const actions = container.querySelector('.control-actions');
  if (!actions) return;

  let select = container.querySelector('#projectSelector');
  if (select) {
    select.value = currentProject;
    return;
  }

  select = document.createElement('select');
  select.id = 'projectSelector';
  select.className = 'project-selector';

  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    if (p === currentProject) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => onChange(select.value));
  actions.appendChild(select);
}

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------
function drawChart(data, scores, chartEl) {
  const chart = chartEl;
  chart.innerHTML = "";

  const size             = 800;
  const radius           = size / 2;
  const levelWidth       = radius / 3.5;
  const radiusOuterScale = 0.1;
  const threshVal        = 5;

  let hierarchyData = data;
  if (
    hierarchyData.name === "Root" &&
    hierarchyData.children &&
    hierarchyData.children.length === 1
  ) {
    hierarchyData = hierarchyData.children[0];
  }

  if (!hierarchyData.children || hierarchyData.children.length === 0) {
    console.error("No children in hierarchyData");
    return;
  }

  const hierarchyRoot = d3.hierarchy(hierarchyData)
    .sum(d => +d.size || 0)
    .sort((a, b) => b.value - a.value);

  const partition = d3.partition()
    .size([2 * Math.PI, hierarchyRoot.height + 1]);

  const root = partition(hierarchyRoot);

  root.each(d => {
    d.base    = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 };
    d.current = d.base;
  });

  const colors = ["#71769c", "#a0a4bd", "#a5dfde", "#1dafad"];

  const colorScale = d3.scaleThreshold()
    .domain([50, 60, 70])
    .range(colors);

  const labels = ['Scores below 50', 'Scores 50-60', 'Scores 60-70', 'Scores above 70', 'Redacted'];

  (function renderOverlayLegend() {
    const legendEl = document.getElementById('chartLegend');
    if (!legendEl) return;
    const items = colors.map((c, i) => ({ color: c, label: labels[i] })).filter(d => d.label);
    legendEl.innerHTML = items.map(d =>
      `<div class="chart-legend-item">
         <span class="chart-legend-swatch" style="background:${d.color}"></span>
         <span class="chart-legend-label">${d.label}</span>
       </div>`
    ).join('');
  })();

  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => {
      const diff = d.x1 - d.x0;
      return diff >= 2 * Math.PI - 1e-6 ? d.x1 - 1e-4 : d.x1;
    })
    .padAngle(d => d.depth === 0 ? 0 : Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(levelWidth / 2)
    .innerRadius(d =>
      d.y0 <= 3 ? d.y0 * levelWidth : (3 + (d.y0 - 3) * radiusOuterScale) * levelWidth
    )
    .outerRadius(d =>
      d.y1 <= 3 ? d.y1 * levelWidth : (3 + (d.y1 - 3) * radiusOuterScale) * levelWidth
    );

  const svg = d3.select(chart)
    .append("svg")
    .attr("viewBox", [-size / 2, -size / 2, size, size])
    .attr("width",  "100%")
    .attr("height", "100%")
    .style("max-width", "100%")
    .style("height", "auto");

  const g          = svg.append("g").attr("transform", "translate(0,0)");
  const pathGroup  = g.append("g").attr("class", "paths");
  const labelGroup = g.append("g")
    .attr("class", "labels")
    .style("pointer-events", "none");

  const labelSize = d => {
    const angularSpan   = d.x1 - d.x0;
    const radialMid     = ((d.y0 + d.y1) / 2) * levelWidth;
    const radialWidth   = (d.y1 - d.y0) * levelWidth;
    const chars         = d.data.name.length;
    const arcLength     = angularSpan * radialMid;
    const charWidth     = 0.9 + (chars * 0.001);
    const sizeFromArc   = arcLength * 0.5;
    const sizeFromWidth = radialWidth / (chars * charWidth);
    return Math.min(Math.max(Math.min(sizeFromArc, sizeFromWidth), 6), 14);
  };

  const path = pathGroup
    .selectAll("path")
    .data(root.descendants())
    .join("path")
    .attr("d", d => arc(d.current))
    .attr("pointer-events", "all")
    .attr("fill", d => {
      const v = d.data.scores?.Score1;
      if (v == null || isNaN(v)) return "#ddd";
      return colorScale(v);
    })
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round");

  path
    .filter(d => d.children && d.children.length)
    .style('cursor', 'pointer')
    .on('click', clicked);

  const format = d3.format(',d');
  path.append('title').text(d =>
    `${d.ancestors().map(d => d.data.name).reverse().join('/')}\n${format(d.value)}`
  );
  path.raise();

  const centerText = svg
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .style('fill', 'black')
    .style('pointer-events', 'none')
    .attr('pointer-events', 'none')
    .text(`${root.data.name}: ${root.data.scores.Score1 || 0}%`);

  const label = labelGroup
    .attr('id', 'scoresLabels')
    .attr('pointer-events', 'none')
    .style('pointer-events', 'none')
    .attr('text-anchor', 'middle')
    .style('user-select', 'none')
    .selectAll('text')
    .data(root.descendants())
    .join('text')
    .style("font-size", d => `${labelSize(d)}`)
    .attr('dy', '0.35em')
    .attr('fill-opacity', d => +labelVisible(d.current))
    .attr('transform', d => labelTransform(d.current))
    .text(d =>
      (d.data.scores.Score1 || 0) > threshVal
        ? `${d.data.name}: ${d.data.scores.Score1 || 0}%`
        : `${d.data.name}: Redacted`
    );

  const parent = svg
    .append('circle')
    .datum(root)
    .attr('r', levelWidth)
    .attr('fill', 'transparent')
    .attr('pointer-events', 'all')
    .style('cursor', 'pointer')
    .on('click', clicked);

  let currentNode = root;

  populateScoreDropdown(scores, selectedScore => {
    clicked(null, currentNode, selectedScore);
  });

  clicked(null, currentNode, d3.select('#scoreSelector').property('value'));

  function clicked(event, p, selectedScore = d3.select('#scoreSelector').property('value')) {
    currentNode = p;
    parent.datum(p.parent || root);
    updateCurrentLevelsText(p);

    root.each(d => (d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth)
    }));

    const currentSelScore = d3.select('#scoreSelector').property('value');
    centerText.raise();
    centerText.text(`${p.data.name}: ${p.data.scores[currentSelScore] || 0}%`);

    const t = svg.transition().duration(750);

    document.getElementById('resetButton').addEventListener('click', () => {
      clicked(null, root);
    });

    const newColorScale = d3.scaleThreshold()
      .domain([50, 60, 70, 100])
      .range([colors[0], colors[1], colors[2], colors[3]]);

    path
      .transition(t)
      .attr('fill', d => newColorScale(d.data.scores[selectedScore] || 0))
      .attr("stroke", d => (d.depth === p.depth ? "none" : "#fff"))
      .tween('data', d => {
        const i = d3.interpolate(d.current, d.target);
        return tVal => (d.current = i(tVal));
      })
      .attr("pointer-events", d => d.children ? "auto" : "none")
      .attrTween('d', d => () => arc(d.current));

    label
      .filter(function(d) {
        return +this.getAttribute('fill-opacity') || labelVisible(d.target);
      })
      .transition(t)
      .attr('fill-opacity', d => +labelVisible(d.target))
      .attrTween('transform', d => () => labelTransform(d.current))
      .text(d =>
        d.data.scores[selectedScore] > threshVal
          ? `${d.data.name}: ${d.data.scores[selectedScore] || 0}%`
          : `${d.data.name}: Redacted`
      );

    label.style("font-size", d => {
      const proxy = { x0: d.target.x0, x1: d.target.x1, y0: d.target.y0, y1: d.target.y1, data: d.data };
      return `${labelSize(proxy)}`;
    });

    path.raise();
  }

  function labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
  }

  function labelTransform(d) {
    const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
    const y = ((d.y0 + d.y1) / 2) * levelWidth;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }

  function updateCurrentLevelsText(p) {
    const currentDepth    = p.depth;
    const visibleMaxDepth = computeMaxDepth(p);
    const visibleLevels   = Math.min(visibleMaxDepth, currentDepth + 2);
    const textContent     = currentDepth === visibleLevels
      ? `Currently showing level ${currentDepth + 1}`
      : `Currently showing levels ${currentDepth + 1} to ${visibleLevels + 1}`;
    const el = document.getElementById('chartStatus');
    if (el) el.textContent = textContent;
  }

  function computeMaxDepth(node) {
    if (!node.children || node.children.length === 0) return node.depth;
    return Math.max(...node.children.map(computeMaxDepth));
  }
}

// ---------------------------------------------------------------------------
// Score dropdown
// ---------------------------------------------------------------------------
function populateScoreDropdown(scores, onChangeCallback) {
  const dropdown = d3.select('#scoreSelector');
  dropdown.selectAll('option').remove();

  scores.forEach(s => {
    dropdown.append('option').attr('value', s.id).text(s.label);
  });

  if (scores.length > 0) dropdown.property('value', scores[0].id);

  dropdown.on('change', function() {
    if (onChangeCallback) onChangeCallback(this.value);
  });

  document.getElementById("downloadSVG").addEventListener("click", downloadSVG);
}

// ---------------------------------------------------------------------------
// SVG download
// ---------------------------------------------------------------------------
function inlineAllStyles(svgNode) {
  const allElements = svgNode.querySelectorAll("*");
  const svgStyle    = window.getComputedStyle(svgNode);
  for (let i = 0; i < svgStyle.length; i++) {
    svgNode.style.setProperty(svgStyle[i], svgStyle.getPropertyValue(svgStyle[i]));
  }
  allElements.forEach(el => {
    const cs = window.getComputedStyle(el);
    for (let i = 0; i < cs.length; i++) el.style.setProperty(cs[i], cs.getPropertyValue(cs[i]));
  });
}

function downloadSVG() {
  try {
    const svgEl = document.querySelector("#chart svg");
    if (!svgEl) {
      console.error("No SVG found");
      return;
    }

    const clonedSvg = svgEl.cloneNode(true);

    const fontCSS = `
      <style>
        @font-face {
          font-family: 'Barlow';
          src: url(data:font/woff2;base64,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) format('woff2');
          font-weight: 400;
          font-style: normal;
        }
        text {
          font-family: 'Barlow', sans-serif;
        }
      </style>
    `;

    const defs = document.createElement("defs");
    defs.innerHTML = fontCSS;
    clonedSvg.insertBefore(defs, clonedSvg.firstChild);

    inlineAllStyles(clonedSvg);

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clonedSvg);

    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);

    const a = document.createElement("a");
    a.href = url;
    a.download = "chart.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

  } catch (err) {
    console.error("Error downloading SVG:", err);
  }
}
