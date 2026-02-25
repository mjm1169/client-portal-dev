import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export function mountRadial(container, user) {

  if (!user?.pages?.includes("hierarchy")) {
    container.innerHTML = "<h2>Access denied</h2>";
    return;
  }

  container.innerHTML = `
    <h2>Radial Hierarchy</h2>
    <div style="padding:10px;">
      <label for="datasetSelect">Dataset:</label>
      <select id="datasetSelect"></select>
      <select id="scoreSelector">
              <option value="Score1">Score1</option>
              <option value="Score2">Score2</option>
            </select>
    </div>
    <div id="chart"></div>
  `;

  initRadial(user.datasets || []);
}

function initRadial(datasets) {

  const select = document.getElementById("datasetSelect");

  if (!datasets.length) {
    select.innerHTML = "<option>No datasets assigned</option>";
    return;
  }

  // Populate dropdown
  datasets.forEach(ds => {
    const option = document.createElement("option");
    option.value = ds;
    option.textContent = ds;
    select.appendChild(option);
  });

  // Load first dataset immediately
  loadData(datasets[0]);

  // Change dataset
  select.addEventListener("change", e => {
    loadData(e.target.value);
  });
}

async function loadData(dataset) {
  try {
    console.log("Loading dataset:", dataset);

    const res = await fetch(`/api/hierarchy?ds=${dataset}`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    // If API already returns hierarchy object, do NOT map
    // Only clean if it is raw rows
    if (Array.isArray(data)) {
      const cleaned = data.map(row => {
        const cleanRow = {};
        Object.entries(row).forEach(([key, value]) => {
          const cleanKey = key
            .trim()
            .replace(/^\uFEFF/, "")
            .replace(/^ï»¿/, "");
          cleanRow[cleanKey] = value;
        });
        return cleanRow;
      });

      drawChart(cleaned);
    } else {
      // Already a hierarchy object
      drawChart(data);
    }

  } catch (err) {
    console.error("loadData error:", err);
  }
}

function drawChart(data) {
  const chart = document.getElementById("chart");
  chart.innerHTML = `<pre>${JSON.stringify(data.slice(0,3), null, 2)}</pre>`;

  const width = 900;
  const height = 900;
  const radius = 500;
  const levelWidth = 80;
  const radiusOuterScale = 0.1;
  const threshVal = 5;
  console.log("drawChart called");
  //console.log("Rows:", rows.length);

  // Clear previous chart
  d3.select("#chart").html("");

  // -----------------------------
  // Build hierarchy
  // -----------------------------
  
  console.log("Building hierarchy...");
  
  let hierarchyData = buildHierarchy(data);

  // Remove fake root if it only has one child
  if (
    hierarchyData.name === "Root" &&
    hierarchyData.children &&
    hierarchyData.children.length === 1
  ) {
    console.log("Promoting child as root:", hierarchyData.children[0].name);
    hierarchyData = hierarchyData.children[0];
  }

  console.log("Hierarchy built:", hierarchyData);

  if (!hierarchyData.children || hierarchyData.children.length === 0) {
    console.error("No children in hierarchyData");
    return;
  }

  //function cleanSizes(node) {
//
  //  if (!node.children || node.children.length === 0) {
  //    node.size = 0; // leaves
  //  } else {
  //    node.children.forEach(cleanSizes);
  //  }
  //}
  console.log(hierarchyData);
  // -----------------------------
  // Convert to D3 hierarchy
  // -----------------------------
  //cleanSizes(hierarchyData);

  console.log("hierarchyData",hierarchyData)
  // Stage 1: compute values

  // Stage 1: build hierarchy
  const hierarchyRoot = d3.hierarchy(hierarchyData)
  .sum(d => +d.size || 0)
  .sort((a, b) => b.value - a.value);

  console.log("hierarchyRoot:", hierarchyRoot);


  // Stage 2: create partition generator
  const partition = d3.partition()
    .size([2 * Math.PI, hierarchyRoot.height + 1])
  //.size([2 * Math.PI, radius]);


  // Stage 3: apply partition
  const root = partition(hierarchyRoot);

  console.log("partitioned root:", root);


  // Stage 4: initialize current for animation
  root.each(d => {
    d.base = {      // ← permanent geometry
      x0: d.x0,
      x1: d.x1,
      y0: d.y0,
      y1: d.y1
    };
  
    d.current = d.base; // start here
  });


  // Debug: check leaf sizes
  root.leaves().forEach(d => {
  console.log("Leaf:", d.data.name, "size:", d.data.size, "value:", d.value);
  });

  

  console.log("Chart size:", width, height, radius);

  // -----------------------------
  // Colour scale (using Score1)
  // -----------------------------

  const colors = [
    "#71769c", // <50
    "#a0a4bd", // 50-59
    "#a5dfde", // 60-69
    "#1dafad"  // >=70
  ];

  const colorScale = d3
    .scaleThreshold()
    .domain([50, 60, 70])
    .range(colors);

  // -----------------------------
  // Arc generator
  // -----------------------------
  const maxDepth = root.height + 1;
  console.log("Max depth:", maxDepth);
  root.descendants().forEach(d => {
    if (!d.y1 || !d.y0) {
      console.warn("Bad node:", d);
    }
  });
  console.log(
    "Clickable nodes:",
    root.descendants().filter(d => d.children).length
  );
  // Compress outer layers


    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(levelWidth / 2)
      .innerRadius((d) =>
        d.y0 <= 3
          ? d.y0 * levelWidth
          : (3 + (d.y0 - 3) * radiusOuterScale) * levelWidth,
      )
      .outerRadius((d) =>
        d.y1 <= 3
          ? d.y1 * levelWidth
          : (3 + (d.y1 - 3) * radiusOuterScale) * levelWidth,
      );
  // -----------------------------
  // SVG
  // -----------------------------
    
  const svg = d3.select("#chart")
    .append("svg")
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("width", width)
    .attr("height", height)
    .style("max-width", "100%")
    .style("height", "auto");
  const g = svg.append("g")
    .attr("transform", `translate(0,0)`);
  
  const pathGroup = g.append("g").attr("class", "paths");
  const labelGroup = g.append("g")
    .attr("class", "labels")
    .style("pointer-events", "none");
  /*const centerCircle = svg
    .append('circle')
    .attr('r', levelWidth)
    .attr('fill', colorScale(root.data.scores.Score1 || 0));
    function radiusScale(d) {

      if (d <= 3) {
        return d * levelWidth * 1.4; // inner = bigger
      }
    
      return (3 * levelWidth * 1.4) + (d - 3) * levelWidth * 0.7;
    }*/

    const path = pathGroup
      .selectAll("path")
      .data(root.descendants())
      .join("path")
      .attr("d", d => arc(d.current))   // ✅ FIX
      .attr("pointer-events", "all")
      .attr("fill", d => {
        const v = d.data.scores?.Score1;
        if (v == null || isNaN(v)) return "#ddd";
        return colorScale(v);
      })
      .attr("stroke", "#fff");
    path
      .filter(d => d.children && d.children.length)
      .style('cursor', 'pointer')
      .on('click', clicked);

    const format = d3.format(',d');
    path.append('title').text(
      (d) =>
        `${d
          .ancestors()
          .map((d) => d.data.name)
          .reverse()
          .join('/')}\n${format(d.value)}`,
    );
    path.raise();
    const centerText = svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('fill', 'black')
      .text(`${root.data.name}: ${root.data.scores.Score1 || 0}%`);

    const label = labelGroup
      .attr('id', 'scoresLabels')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .style('user-select', 'none')
      .selectAll('text')
      .data(root.descendants())
      .join('text')
      .style("font-size", d =>
        d.depth <= 1 ? "14px" :
        d.depth === 2 ? "12px" :
        "10px"
      )
      .attr('dy', '0.35em')
      .attr('fill-opacity', (d) => +labelVisible(d.current))
      .attr('transform', (d) => labelTransform(d.current))
      .text((d) =>
        (d.data.scores.Score1 || 0) > threshVal
          ? `${d.data.name}: ${d.data.scores.Score1 || 0}%`
          : `${d.data.name}: Redacted`,
      );

    const parent = svg
      .append('circle')
      .datum(root)
      .attr('r', levelWidth)
      .attr('fill', 'transparent')
      .attr('pointer-events', 'visibleFill')
      .on('click', clicked);

    //document.getElementById('resetButton').addEventListener('click', () => {
    //  console.log(root)
    //  clicked(null,root,d3.select('#scoreSelector').property('value')); 
    //  updateCurrentLevelsText(root);
    //  //centerText.text(`${root.name}: ${root.scores['Score1'] || 0}%`);
    //  });
    // Function to find a node by name
    function findNodeByName(name) {
      return root.descendants().find((d) => d.data.name === name);
    }    
    
   //function cardNavigation(event){
   //  const idx = Array.from(document.querySelectorAll('.info-card')).findIndex(c => c.classList.contains('active'));
   //  console.log('Current card index:', idx);
   //  if([1,2,3,4].includes(idx)){ // Prevent action if already on the first card
   //    const storyStates = [{storyNodeName: "Region1",storyScore: 'Score1'},
   //                         {storyNodeName: "NHS England",storyScore: 'Score2'},
   //                         {storyNodeName: "Region3",storyScore: 'Score3'},
   //                         {storyNodeName: "NHS",storyScore: 'Score1'}]
   //    const storyNodeName = storyStates[idx-1].storyNodeName;
   //    const storyScore = storyStates[idx-1].storyScore;
   //    clicked(null,findNodeByName(storyNodeName),storyScore); 
   //    updateCurrentLevelsText(findNodeByName(storyNodeName));
   //    scoreSelector.value = storyScore;
   //    scoreSelector.dispatchEvent(new Event('change'));
   //  }
   //}
   //document.getElementById('nextCard').addEventListener('click', cardNavigation);
   //document.getElementById('prevCard').addEventListener('click', cardNavigation);



    function clicked(event, p,selectedScore=d3.select('#scoreSelector').property('value')) {
      //console.log(p)
      //console.log(selectedScore)
      currentNode = p; // Update the reference to the current node
      console.log("Clicked node:", p.data.name, "Score:", p.data.scores[selectedScore]);
      parent.datum(p.parent || root);
      //updateChart(selectedScore, p);
        updateCurrentLevelsText(p);
        //svg.selectAll('path.background-circle').remove();
  
        root.each(
          (d) =>
            (d.target = {
              x0:
                Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) *
                2 *
                Math.PI,
              x1:
                Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) *
                2 *
                Math.PI,
              y0: Math.max(0, d.y0 - p.depth),
              y1: Math.max(0, d.y1 - p.depth)
            }),
        );
  
        const currentSelScore = d3.select('#scoreSelector').property('value');
        //console.log(currentSelScore); // Log the current selected value
        centerText.raise();
        centerText.text(
          `${p.data.name}: ${p.data.scores[currentSelScore] || 0}%`,
        );
  
        const t = svg.transition().duration(750);
         
        const newColorScale = d3
          .scaleThreshold()
          .domain([50, 60, 70, 100])
          .range([colors[0], colors[1], colors[2], colors[3]]);
        
        path
          .transition(t)
          .attr('fill', d => newColorScale(d.data.scores[selectedScore] || 0))
          .tween('data', (d) => {
            const i = d3.interpolate(d.current, d.target);
            return (t) => (d.current = i(t));
          })
          //.attr('pointer-events', d =>
          //  arcVisible(d.current) ? 'auto' : 'none'
          //)
          .attr("pointer-events", d => d.children ? "auto" : "none")
          .attrTween('d', (d) => {
            return () => arc(d.current);
          });
  
          label
          .filter(function (d) {
            return +this.getAttribute('fill-opacity') || labelVisible(d.target);
          })
          .transition(t)
          .attr('fill-opacity', (d) => +labelVisible(d.target))
          .attrTween('transform', (d) => () => labelTransform(d.current))
          .text((d) =>
          d.data.scores[selectedScore] > threshVal
            ? `${d.data.name}: ${d.data.scores[selectedScore] || 0}%`
            : `${d.data.name}: Redacted`,
            );
        //labelGroup.raise();
        path.raise();
         
    }
    const scoreSelector = document.getElementById('scoreSelector');
  
    scoreSelector.addEventListener('change', function () {
      const selectedScore = this.value;
      clicked(null,currentNode,selectedScore);
    });
  
    let currentNode = root; // Initialize to root node
  
    clicked(null,currentNode,d3.select('#scoreSelector').property('value')); // Default initialization with Score1

    function arcVisible(d) {
      return d.y1 <= hierarchyRoot.height + 1 && d.y0 >= 1;
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
      const currentDepth = p.depth;
      const visibleMaxDepth = computeMaxDepth(p);
      const visibleLevels = Math.min(visibleMaxDepth, currentDepth + 2);
      const textContent =
        currentDepth === visibleLevels
          ? `Currently showing level ${currentDepth + 1}`
          : `Currently showing levels ${currentDepth + 1} to ${visibleLevels + 1}`;
      //const textContent = `Current score: ${p.data.scores.Score1 || 0}`;
  
      const el = document.getElementById('chartStatus');
      if (el) el.textContent = textContent;
    }
  
    function computeMaxDepth(node) {
      if (!node.children || node.children.length === 0) {
        return node.depth;
      }
      return Math.max(...node.children.map(computeMaxDepth));
    }
    // Load score labels from CSV
/*     fetch('/data/qText.csv')
    .then(res => {
      if (!res.ok) throw new Error("Failed to load qText.csv");
      return res.text();
    })
    .then(text => {
    
      const data = d3.csvParse(text);
      

      const dropdown = d3.select('#scoreSelector');
    
      // Clear existing
      dropdown.selectAll('option').remove();
    
      // Add options
      data.forEach(d => {
        dropdown.append('option')
          .attr('value', d.QID)
          .text(d.Qtext);
      });
    
      // Default
      dropdown.property('value', 'Score1');
    
      // Change handler
      dropdown.on('change', function () {
      const selectedScore = this.value;
      clicked(null, currentNode, selectedScore);
    });

    }) 
    .catch(err => {
      console.error("Failed to load dropdown labels:", err);
    });*/

  console.log("Chart rendering complete");
}


function normalizeKey(k) {
  return k.replace(/^\uFEFF/, "").trim();
}
/**********************************************************
 * HIERARCHY BUILDER
 **********************************************************/

function buildHierarchy(rows) {

  // 🔥 Clean BOM from first column name if present
  rows = rows.map(row => {
    const clean = {};
    Object.keys(row).forEach(k => {
      clean[normalizeKey(k)] = row[k];
    });
    return clean;
  });

//function buildHierarchy(rows) {
  console.log("🏗 Building hierarchy from", rows.length, "rows");


  const root = {
    name: "Root",
    children: []
  };

  // Detect score columns
  const scoreColumns = Object.keys(rows[0])
    .filter(col => col.toLowerCase().startsWith("score"));

  console.log("Detected score columns:", scoreColumns);

  function getOrCreateChild(parent, name) {

    if (!parent.children) {
      parent.children = [];
    }

    let child = parent.children.find(c => c.name === name);

    if (!child) {
      child = {
        name,
        children: [],
        scores: {},
        size: 0
      };

      parent.children.push(child);
    }

    return child;
  }
  console.log("📊 Score columns:", scoreColumns);
  console.log("📐 Level columns:", Object.keys(rows[0]).filter(k => k.startsWith("Level")));

  // ----------------------------
  // BUILD TREE
  // ----------------------------

  rows.forEach(row => {

    let current = root;
    let level = 0;

    // Walk Level columns
    while (true) {

      const key = `Level${level}`;

      if (!(key in row)) break;

      const value = row[key];

      if (!value) break;

      current = getOrCreateChild(current, value.trim());

      level++;
    }

    // ----------------------------
    // ACCUMULATE SIZE
    // ----------------------------

    const rowSize = Number(row.size) || 0;

    current.size += rowSize;

    // ----------------------------
    // STORE SCORES
    // ----------------------------

    if (!current.scores) current.scores = {};

    scoreColumns.forEach(col => {

      const v = row[col];

      if (v !== null && v !== "") {
        current.scores[col] = Number(v);
      }

    });

  });


  // ----------------------------
  // CLEAN NON-LEAF SIZES
  // ----------------------------

  function cleanSizes(node) {

    if (node.children && node.children.length > 0) {

      delete node.size;

      node.children.forEach(cleanSizes);
    }
  }

  cleanSizes(root);


  // ----------------------------
  // DEBUG: CHECK LEAVES
  // ----------------------------

  function logLeaves(node) {

    if (!node.children || node.children.length === 0) {
      console.log("Leaf:", node.name, "size:", node.size);
      return;
    }

    node.children.forEach(logLeaves);
  }

  logLeaves(root);


  console.log("Hierarchy build complete");
  console.log("🌳 Root children:", root.children.length);
  return root;
}


/**********************************************************
 * DEBUG HELPERS
 **********************************************************/

window.debugHierarchy = function () {

  console.log("Debug: reloading hierarchy");

  loadHierarchy();
};

  /* ===============================
     Card carousel (left pane)
     - Non-destructive: does not touch D3 chart.
  ================================ 
(function initCardCarousel() {
  const cards = Array.from(document.querySelectorAll('.info-card'));
  if (!cards.length) return;

  const prevBtn = document.getElementById('prevCard');
  const nextBtn = document.getElementById('nextCard');
  const dotsEl = document.getElementById('cardDots');

  let idx = Math.max(0, cards.findIndex(c => c.classList.contains('active')));
  if (idx === -1) idx = 0;

  // Build dots
  if (dotsEl) {
    dotsEl.innerHTML = '';
    cards.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'card-dot' + (i === idx ? ' active' : '');
      dot.setAttribute('aria-label', `Go to card ${i + 1}`);
      dot.addEventListener('click', () => setIdx(i));
      dotsEl.appendChild(dot);
    });
  }

  function render() {
    cards.forEach((c, i) => c.classList.toggle('active', i === idx));
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.disabled = idx === cards.length - 1;

    if (dotsEl) {
      Array.from(dotsEl.children).forEach((d, i) => {
        d.classList.toggle('active', i === idx);
      });
    }
  }

  function setIdx(i) {
    idx = Math.min(cards.length - 1, Math.max(0, i));
    render();
  }

  if (prevBtn) prevBtn.addEventListener('click', () => setIdx(idx - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => setIdx(idx + 1));

  // Ensure at least one card is visible even if markup missed .active
  render();
})(); */
