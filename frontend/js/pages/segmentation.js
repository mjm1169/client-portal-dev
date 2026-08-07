import {
  PERSONAS,
  CHANNELS,
  SELECTION_THRESHOLD,
  getPersona,
  topChannels,
  buildPersonaSystemPrompt,
} from "../data/personas.js";

// --- BYOK (bring-your-own-key) chat settings -------------------------------
// The API key never touches our server or git: it's typed into the browser
// by whoever is testing the PoC and kept in sessionStorage only, so it
// disappears when the tab closes. Requests go straight from the browser to
// Google's Generative Language API. See the settings panel copy in the chat
// modal for the tradeoffs.
const KEY_STORAGE_KEY = "segChat:apiKey";
const MODEL_STORAGE_KEY = "segChat:model";
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

function initialsOf(persona) {
  const words = persona.name.replace(/^The\s+/i, "").split(" ").filter(Boolean);
  return ((words[0]?.[0] || "") + (words[1]?.[0] || "")).toUpperCase();
}

async function sendToGemini(persona, apiKey, model, history) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    systemInstruction: { parts: [{ text: buildPersonaSystemPrompt(persona) }] },
    contents: history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.8, maxOutputTokens: 400 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || "";
    } catch { /* ignore */ }
    throw new Error(`API error (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
  if (!text) throw new Error("No response text came back — the reply may have been blocked by a safety filter.");
  return text;
}

export function mountSegmentation(container) {
  const state = { compareIds: new Set(), view: { type: "grid" } };
  const chatHistories = {}; // personaId -> [{role:'user'|'model', text}]
  let activeChatPersonaId = null;
  let sending = false;

  container.innerHTML = `
    <div class="segmentation-page">
      <div class="segmentation-header">
        <button type="button" class="report-back-link" id="segBack">‹ Home</button>
        <h1>Segmentation Explorer</h1>
        <p class="segmentation-sub">
          Six comms personas, clustered from a "which channels do you prefer?" multi-select
          question and rounded out with standard engagement &amp; comms-audit responses.
          Click a persona for the full profile, tick two to compare, or chat with one directly.
        </p>
      </div>

      <div id="segView"></div>

      <div class="compare-bar" id="compareBar" style="display:none;">
        <span id="compareBarText"></span>
        <div>
          <button type="button" class="btn-secondary" id="compareBarClear">Clear</button>
          <button type="button" class="btn-primary" id="compareBarGo" disabled>Compare selected</button>
        </div>
      </div>
    </div>

    <div class="upload-modal-backdrop chat-modal-backdrop" id="chatBackdrop" style="display:none;" role="dialog" aria-modal="true">
      <div class="chat-modal">
        <div class="chat-modal__header">
          <div class="persona-avatar" id="chatAvatar"></div>
          <div>
            <h3 id="chatPersonaName"></h3>
            <p id="chatPersonaTagline"></p>
          </div>
          <div class="chat-header-actions">
            <button type="button" class="icon-btn" id="chatSettingsBtn" title="AI chat settings">⚙</button>
            <button type="button" class="icon-btn" id="chatCloseBtn" title="Close">✕</button>
          </div>
        </div>

        <div class="chat-settings-panel" id="chatSettingsPanel" style="display:none;">
          <p class="chat-settings-note">
            This is a bring-your-own-key demo: your API key is kept only in this browser tab's
            session storage — it's never sent anywhere but the AI provider, and never saved to
            this app's server or git. It clears when you close the tab. Only paste a key you're
            comfortable having visible in this browser's network requests.
          </p>
          <label>
            Gemini API key
            <input type="password" id="chatApiKeyInput" placeholder="AIza…" autocomplete="off">
          </label>
          <label>
            Model id
            <input type="text" id="chatModelInput" placeholder="${DEFAULT_MODEL}">
          </label>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="chatSettingsClear">Forget key</button>
            <button type="button" class="btn-primary" id="chatSettingsSave">Save</button>
          </div>
        </div>

        <div class="chat-messages" id="chatMessages"></div>

        <form class="chat-input-row" id="chatForm">
          <textarea id="chatInput" rows="1" placeholder="Ask this persona something…"></textarea>
          <button type="submit" class="btn-primary" id="chatSendBtn">Send</button>
        </form>
      </div>
    </div>
  `;

  const viewEl = container.querySelector("#segView");
  const compareBar = container.querySelector("#compareBar");
  const compareBarText = container.querySelector("#compareBarText");
  const compareBarGo = container.querySelector("#compareBarGo");
  const compareBarClear = container.querySelector("#compareBarClear");

  container.querySelector("#segBack").addEventListener("click", () => {
    window.location.hash = "/";
  });

  // --- Card / bar builders --------------------------------------------

  function personaCardHtml(p) {
    const checked = state.compareIds.has(p.id);
    const disabled = !checked && state.compareIds.size >= 2;
    return `
      <div class="persona-card">
        <div class="persona-card__top">
          <div class="persona-avatar" style="background:${p.accent}">${initialsOf(p)}</div>
          <label class="persona-compare-toggle">
            <input type="checkbox" data-action="toggle-compare" data-id="${p.id}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
            Compare
          </label>
        </div>
        <h3>${p.name}</h3>
        <p class="persona-tagline">“${p.tagline}”</p>
        <span class="persona-size-badge">${p.size}% of workforce</span>
        <div class="persona-top-channels">
          ${topChannels(p, 3).map(c => `<span class="channel-pill">${c.label}</span>`).join("")}
        </div>
        <button type="button" class="btn-secondary persona-view-btn" data-action="view-detail" data-id="${p.id}">View details →</button>
      </div>
    `;
  }

  function channelBarsHtml(p) {
    return [...CHANNELS]
      .sort((a, b) => (p.channelScores[b.id] || 0) - (p.channelScores[a.id] || 0))
      .map(c => {
        const score = p.channelScores[c.id] || 0;
        const selected = score >= SELECTION_THRESHOLD;
        return `
          <div class="pref-bar-row">
            <span class="pref-bar-row__label">${c.label}</span>
            <div class="pref-bar-track"><div class="pref-bar-fill" style="width:${score}%; background:${selected ? p.accent : "#ccc"}"></div></div>
            <span class="pref-bar-value">${score}</span>
          </div>
        `;
      }).join("");
  }

  function statTile(value, label, small) {
    return `<div class="stat-tile"><div class="stat-tile__value${small ? " stat-tile__value--sm" : ""}">${value}</div><div class="stat-tile__label">${label}</div></div>`;
  }

  function renderGrid() {
    return `<div class="persona-grid">${PERSONAS.map(personaCardHtml).join("")}</div>`;
  }

  function renderDetail(id) {
    const p = getPersona(id);
    if (!p) return `<p>Persona not found.</p>`;
    const a = p.audit;
    const d = p.demographics;

    const stats = [
      statTile(`${a.engagementScore}/100`, "Engagement score"),
      statTile(a.enps > 0 ? `+${a.enps}` : `${a.enps}`, "eNPS"),
      statTile(`${a.feelInformed}%`, "Feel informed"),
      statTile(`${a.trustLeadership}%`, "Trust leadership"),
      statTile(`${a.feelHeard}%`, "Feel heard"),
      statTile(`${a.relevance}%`, "Comms relevance"),
    ].join("");

    const demo = [
      statTile(d.ageRange, "Age range", true),
      statTile(`${d.avgTenureYears} yrs`, "Avg tenure", true),
      statTile(d.workModel, "Work model", true),
      statTile(d.primaryDepartments.join(", "), "Typical departments", true),
    ].join("");

    return `
      <button type="button" class="report-back-link" data-action="back-to-grid">‹ All personas</button>
      <div class="persona-detail">
        <div class="persona-detail__header" style="border-left-color:${p.accent}">
          <div class="persona-avatar persona-avatar--lg" style="background:${p.accent}">${initialsOf(p)}</div>
          <div>
            <h2>${p.name}</h2>
            <p class="persona-tagline">“${p.tagline}”</p>
            <span class="persona-size-badge">${p.size}% of workforce</span>
          </div>
          <button type="button" class="btn-primary" data-action="open-chat" data-id="${p.id}">Chat as this persona</button>
        </div>

        <p class="persona-summary">${p.summary}</p>

        <div class="persona-detail__grid">
          <section>
            <h3>Preferred communication channels</h3>
            <p class="section-hint">From "Which communications channels do you prefer to use?" (multi-select, ${SELECTION_THRESHOLD}+ counts as selected)</p>
            ${channelBarsHtml(p)}
          </section>
          <section>
            <h3>Engagement &amp; comms audit</h3>
            <div class="stat-tiles">${stats}</div>
            <dl class="persona-audit-list">
              <dt>Perceived comms volume</dt><dd>${a.commsVolume}</dd>
              <dt>Preferred frequency</dt><dd>${a.preferredFrequency}</dd>
              <dt>What works well</dt><dd>${a.whatWorksWell}</dd>
              <dt>Top frustration</dt><dd>${a.topFrustration}</dd>
            </dl>
          </section>
        </div>

        <section class="persona-demographics">
          <h3>Who's in this segment</h3>
          <div class="stat-tiles stat-tiles--demo">${demo}</div>
        </section>
      </div>
    `;
  }

  function compareMiniCard(p) {
    return `
      <div class="compare-persona-card" style="border-top-color:${p.accent}">
        <div class="persona-card__top">
          <div class="persona-avatar" style="background:${p.accent}">${initialsOf(p)}</div>
          <span class="persona-size-badge">${p.size}% of workforce</span>
        </div>
        <h3>${p.name}</h3>
        <p class="persona-tagline">“${p.tagline}”</p>
        <button type="button" class="btn-secondary" data-action="open-chat" data-id="${p.id}">Chat as this persona</button>
      </div>
    `;
  }

  function auditRow(label, a, b, fmt = v => v) {
    return `<tr><td>${label}</td><td>${fmt(a)}</td><td>${fmt(b)}</td></tr>`;
  }

  function renderCompare(idA, idB) {
    const A = getPersona(idA);
    const B = getPersona(idB);
    if (!A || !B) return `<p>Choose two personas to compare.</p>`;

    const channelRows = CHANNELS.map(c => {
      const sA = A.channelScores[c.id] || 0;
      const sB = B.channelScores[c.id] || 0;
      return `
        <div class="compare-channel-row">
          <div class="compare-channel-label">${c.label}</div>
          <div class="compare-dual-bar">
            <div class="compare-dual-bar-line">
              <span class="compare-dual-bar-name">${A.name}</span>
              <div class="compare-dual-bar-track"><div class="compare-dual-bar-fill" style="width:${sA}%; background:${A.accent}"></div></div>
              <span class="pref-bar-value">${sA}</span>
            </div>
            <div class="compare-dual-bar-line">
              <span class="compare-dual-bar-name">${B.name}</span>
              <div class="compare-dual-bar-track"><div class="compare-dual-bar-fill" style="width:${sB}%; background:${B.accent}"></div></div>
              <span class="pref-bar-value">${sB}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <button type="button" class="report-back-link" data-action="back-to-grid">‹ All personas</button>
      <div class="compare-header">
        ${compareMiniCard(A)}
        ${compareMiniCard(B)}
      </div>

      <section>
        <h3>Channel preference comparison</h3>
        <p class="section-hint">Preference score out of 100 (${SELECTION_THRESHOLD}+ counts as selected on the multi-select question)</p>
        ${channelRows}
      </section>

      <section>
        <h3>Engagement &amp; comms audit comparison</h3>
        <div class="table-scroll">
          <table class="modal-spec-table">
            <thead><tr><th>Metric</th><th>${A.name}</th><th>${B.name}</th></tr></thead>
            <tbody>
              ${auditRow("Engagement score", A.audit.engagementScore, B.audit.engagementScore, v => `${v}/100`)}
              ${auditRow("eNPS", A.audit.enps, B.audit.enps, v => v > 0 ? `+${v}` : `${v}`)}
              ${auditRow("Feel informed", A.audit.feelInformed, B.audit.feelInformed, v => `${v}%`)}
              ${auditRow("Trust leadership", A.audit.trustLeadership, B.audit.trustLeadership, v => `${v}%`)}
              ${auditRow("Feel heard", A.audit.feelHeard, B.audit.feelHeard, v => `${v}%`)}
              ${auditRow("Comms relevance", A.audit.relevance, B.audit.relevance, v => `${v}%`)}
              ${auditRow("Perceived volume", A.audit.commsVolume, B.audit.commsVolume)}
              ${auditRow("Preferred frequency", A.audit.preferredFrequency, B.audit.preferredFrequency)}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  // --- View + compare-selection wiring ----------------------------------

  function updateCompareBar() {
    if (state.view.type === "compare" || state.compareIds.size === 0) {
      compareBar.style.display = "none";
      return;
    }
    compareBar.style.display = "flex";
    compareBarText.textContent = `${state.compareIds.size} of 2 selected for comparison`;
    compareBarGo.disabled = state.compareIds.size !== 2;
  }

  function renderView() {
    if (state.view.type === "detail") viewEl.innerHTML = renderDetail(state.view.id);
    else if (state.view.type === "compare") viewEl.innerHTML = renderCompare(state.view.ids[0], state.view.ids[1]);
    else viewEl.innerHTML = renderGrid();
    updateCompareBar();
  }

  compareBarGo.addEventListener("click", () => {
    const ids = [...state.compareIds];
    if (ids.length === 2) {
      state.view = { type: "compare", ids };
      renderView();
    }
  });

  compareBarClear.addEventListener("click", () => {
    state.compareIds.clear();
    updateCompareBar();
    if (state.view.type === "grid") renderView();
  });

  viewEl.addEventListener("click", e => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const { action, id } = el.dataset;
    if (action === "view-detail") {
      state.view = { type: "detail", id };
      renderView();
    } else if (action === "back-to-grid") {
      state.view = { type: "grid" };
      renderView();
    } else if (action === "open-chat") {
      openChat(id);
    }
  });

  viewEl.addEventListener("change", e => {
    const cb = e.target.closest('[data-action="toggle-compare"]');
    if (!cb) return;
    const { id } = cb.dataset;
    if (cb.checked) {
      if (state.compareIds.size >= 2) { cb.checked = false; return; }
      state.compareIds.add(id);
    } else {
      state.compareIds.delete(id);
    }
    updateCompareBar();
    viewEl.querySelectorAll('[data-action="toggle-compare"]').forEach(other => {
      const otherId = other.dataset.id;
      other.disabled = !state.compareIds.has(otherId) && state.compareIds.size >= 2;
    });
  });

  renderView();

  // --- Chat modal ---------------------------------------------------------

  const chatBackdrop = container.querySelector("#chatBackdrop");
  const chatAvatar = container.querySelector("#chatAvatar");
  const chatPersonaName = container.querySelector("#chatPersonaName");
  const chatPersonaTagline = container.querySelector("#chatPersonaTagline");
  const chatMessages = container.querySelector("#chatMessages");
  const chatForm = container.querySelector("#chatForm");
  const chatInput = container.querySelector("#chatInput");
  const chatSendBtn = container.querySelector("#chatSendBtn");
  const chatSettingsBtn = container.querySelector("#chatSettingsBtn");
  const chatSettingsPanel = container.querySelector("#chatSettingsPanel");
  const chatApiKeyInput = container.querySelector("#chatApiKeyInput");
  const chatModelInput = container.querySelector("#chatModelInput");
  const chatSettingsSave = container.querySelector("#chatSettingsSave");
  const chatSettingsClear = container.querySelector("#chatSettingsClear");
  const chatCloseBtn = container.querySelector("#chatCloseBtn");

  function getStoredKey() {
    return sessionStorage.getItem(KEY_STORAGE_KEY) || "";
  }
  function getStoredModel() {
    return sessionStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
  }

  function renderMessages() {
    const history = chatHistories[activeChatPersonaId] || [];
    chatMessages.innerHTML = history.map(m => `
      <div class="chat-msg ${m.role === "user" ? "chat-msg--user" : "chat-msg--persona"}">${escapeHtml(m.text)}</div>
    `).join("") || `<div class="chat-msg chat-msg--system">Say hello — you're chatting with a simulated persona built from its dummy survey data, not a real employee.</div>`;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function openChat(id) {
    const p = getPersona(id);
    if (!p) return;
    activeChatPersonaId = id;
    chatAvatar.style.background = p.accent;
    chatAvatar.textContent = initialsOf(p);
    chatPersonaName.textContent = p.name;
    chatPersonaTagline.textContent = `“${p.tagline}”`;
    chatHistories[id] = chatHistories[id] || [];
    renderMessages();

    chatSettingsPanel.style.display = getStoredKey() ? "none" : "flex";
    chatApiKeyInput.value = getStoredKey();
    chatModelInput.value = getStoredModel();

    chatBackdrop.style.display = "flex";
    document.addEventListener("keydown", onChatEscKey);
    chatInput.focus();
  }

  function closeChat() {
    chatBackdrop.style.display = "none";
    document.removeEventListener("keydown", onChatEscKey);
  }

  function onChatEscKey(e) {
    if (e.key === "Escape") closeChat();
  }

  chatCloseBtn.addEventListener("click", closeChat);
  chatBackdrop.addEventListener("click", e => {
    if (e.target === chatBackdrop) closeChat();
  });

  chatSettingsBtn.addEventListener("click", () => {
    chatSettingsPanel.style.display = chatSettingsPanel.style.display === "none" ? "flex" : "none";
  });

  chatSettingsSave.addEventListener("click", () => {
    const key = chatApiKeyInput.value.trim();
    const model = chatModelInput.value.trim() || DEFAULT_MODEL;
    if (key) sessionStorage.setItem(KEY_STORAGE_KEY, key);
    sessionStorage.setItem(MODEL_STORAGE_KEY, model);
    chatSettingsPanel.style.display = "none";
  });

  chatSettingsClear.addEventListener("click", () => {
    sessionStorage.removeItem(KEY_STORAGE_KEY);
    chatApiKeyInput.value = "";
  });

  chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  chatForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (sending) return;

    const text = chatInput.value.trim();
    if (!text || !activeChatPersonaId) return;

    const apiKey = getStoredKey();
    if (!apiKey) {
      chatSettingsPanel.style.display = "flex";
      chatApiKeyInput.focus();
      return;
    }

    const persona = getPersona(activeChatPersonaId);
    const history = chatHistories[activeChatPersonaId];
    history.push({ role: "user", text });
    chatInput.value = "";
    renderMessages();

    sending = true;
    chatSendBtn.disabled = true;
    chatMessages.insertAdjacentHTML("beforeend", `<div class="chat-msg chat-msg--typing" id="chatTyping">${persona.name} is typing…</div>`);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const reply = await sendToGemini(persona, apiKey, getStoredModel(), history);
      history.push({ role: "model", text: reply });
      renderMessages();
    } catch (err) {
      chatMessages.querySelector("#chatTyping")?.remove();
      chatMessages.insertAdjacentHTML("beforeend", `<div class="chat-msg chat-msg--system">${escapeHtml(err.message || "Something went wrong talking to the AI provider.")}</div>`);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } finally {
      sending = false;
      chatSendBtn.disabled = false;
    }
  });
}
