import {
  PERSONAS,
  CHANNELS,
  SELECTION_THRESHOLD,
  getPersona,
  topChannels,
  buildPersonaSystemPrompt,
} from "../data/personas.js";
import { GROUP_CHAT_SCRIPT } from "../data/groupChatScript.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- BYOK (bring-your-own-key) chat settings -------------------------------
// The API key never touches our server or git: it's typed into the browser
// by whoever is testing the PoC and kept in sessionStorage only, so it
// disappears when the tab closes. Requests go straight from the browser to
// Google's Generative Language API. See the settings panel copy in the chat
// modal for the tradeoffs.
const KEY_STORAGE_KEY = "segChat:apiKey";
const MODEL_STORAGE_KEY = "segChat:model";
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

// Shared by the 1:1 chat modal and the "join the conversation" group chat —
// one key, saved once, works in both places.
function getStoredKey() {
  return sessionStorage.getItem(KEY_STORAGE_KEY) || "";
}
function getStoredModel() {
  return sessionStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
}

// Each persona's colored circle shows its segment number (1-6) rather than
// initials — keeps the six segments easy to tell apart at a glance without
// implying these are real named individuals in a way that reads as literal.
function workforceBarHtml(persona) {
  const segments = [...PERSONAS]
    .sort((a, b) => a.number - b.number)
    .map(seg => `<div class="workforce-bar__seg" style="width:${seg.size}%; background:${seg.accent}; opacity:${seg.id === persona.id ? 1 : 0.1}"></div>`)
    .join("");
  return `
    <div class="workforce-bar">
      <span class="persona-size-badge">${persona.size}% of workforce</span>
      <div class="workforce-bar__track">${segments}</div>
    </div>
  `;
}

async function callGemini(apiKey, model, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

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

async function sendToGemini(persona, apiKey, model, history) {
  return callGemini(apiKey, model, {
    systemInstruction: { parts: [{ text: buildPersonaSystemPrompt(persona) }] },
    contents: history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.8, maxOutputTokens: 400 },
  });
}

const GROUP_CHAT_INSTRUCTION =
  "You're now in a live group call with several colleagues, continuing the conversation you were " +
  "just having. Other people's lines in this thread are prefixed with their name so you know who " +
  "said which — yours are not, since they're your own words. Reply naturally and briefly, as you " +
  "would out loud on a call (1-3 sentences), and don't add a name prefix to your own reply.";

// Turns a shared, multi-party transcript (the scripted intro plus whatever's
// been said live since "Join the conversation") into the strict user/model
// turn sequence the Gemini API expects, from one persona's point of view:
// their own lines become "model" turns, everyone else's (other personas AND
// the human user) become "user" turns prefixed with who said them.
function groupHistoryFor(persona, transcript) {
  const turns = transcript.map(entry => (
    entry.speakerId === persona.id
      ? { role: "model", text: entry.text }
      : { role: "user", text: `${entry.speakerName}: ${entry.text}` }
  ));
  return [{ role: "user", text: GROUP_CHAT_INSTRUCTION }, ...turns];
}

// --- Deciding who replies ---------------------------------------------------
// Two-tier, cheapest-first: a named mention costs nothing and is unambiguous
// ("Margaret, does that work for you?" -> only Margaret). Otherwise, one
// lightweight routing call picks who'd realistically chime in, so a general
// question doesn't always drag all six into replying. Either step can come
// back empty, so the last resort is everyone — better a noisy reply than a
// message that visibly goes nowhere.

function detectAddressedPersonas(text) {
  return PERSONAS
    .filter(p => new RegExp(`\\b${p.name.split(" ")[0]}\\b`, "i").test(text))
    .sort((a, b) => a.number - b.number);
}

const ROUTER_SYSTEM_INSTRUCTION =
  "You are a silent routing assistant for a simulated employee comms group chat. You never speak " +
  "in the conversation yourself — you only decide, given the roster and the latest message, which " +
  "people would realistically jump in to reply, based on their communication style and interests. " +
  "Usually 1-3 people; it's fine to pick just one, or occasionally none if the message doesn't " +
  "really call for a reply from this group. Respond with ONLY a JSON array of ids from the roster " +
  'and nothing else, e.g. ["some-id","other-id"].';

function personaRosterText() {
  return PERSONAS.map(p =>
    `- id "${p.id}": ${p.name}, ${p.archetype.toLowerCase()}. "${p.tagline}" Favours ${topChannels(p, 2).map(c => c.label).join(" and ")}.`
  ).join("\n");
}

async function routeGroupMessage(apiKey, model, transcript, latestMessage) {
  const recent = transcript.slice(-8).map(e => `${e.speakerName}: ${e.text}`).join("\n") || "(nothing said yet)";
  const prompt = `Roster:\n${personaRosterText()}\n\nRecent conversation:\n${recent}\n\nNewest message: "${latestMessage}"\n\nWhich people would realistically reply? JSON array of ids only.`;

  const text = await callGemini(apiKey, model, {
    systemInstruction: { parts: [{ text: ROUTER_SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 80, responseMimeType: "application/json" },
  });

  const ids = JSON.parse(text);
  return Array.isArray(ids) ? ids.map(id => getPersona(id)).filter(Boolean) : [];
}

async function pickRespondents(apiKey, model, transcript, text) {
  const named = detectAddressedPersonas(text);
  if (named.length > 0) return named;

  try {
    const routed = await routeGroupMessage(apiKey, model, transcript, text);
    if (routed.length > 0) return routed.sort((a, b) => a.number - b.number);
  } catch (err) {
    console.warn("Group chat routing call failed, defaulting to everyone replying:", err);
  }
  return [...PERSONAS].sort((a, b) => a.number - b.number);
}

// --- Entry point: landing choice -------------------------------------------

export function mountSegmentation(container) {
  renderLanding(container);
}

function renderLanding(container) {
  container.innerHTML = `
    <div class="segmentation-page segmentation-landing">
      <div class="segmentation-header">
        <button type="button" class="report-back-link" id="segBack">‹ Home</button>
        <h1>Segmentation Explorer</h1>
        <p class="segmentation-sub">
          Six comms personas, clustered from a "which channels do you prefer?" multi-select
          question and rounded out with standard engagement &amp; comms-audit responses.
        </p>
      </div>

      <div class="landing-choices">
        <button type="button" class="landing-choice-card" data-choice="meet">
          <h2>Meet the segments</h2>
          <p>Watch the six personas join a simulated team call, one by one — largest segment
             first — talking in their own words.</p>
          <span class="landing-choice-cta">Start the call →</span>
        </button>
        <button type="button" class="landing-choice-card" data-choice="explore">
          <h2>Explore the data</h2>
          <p>Jump straight to the persona grid, detail profiles, side-by-side comparisons,
             and 1:1 chat.</p>
          <span class="landing-choice-cta">View the data →</span>
        </button>
      </div>
    </div>
  `;

  container.querySelector("#segBack").addEventListener("click", () => {
    window.location.hash = "/";
  });
  container.querySelector('[data-choice="explore"]').addEventListener("click", () => {
    mountExplorer(container);
  });
  container.querySelector('[data-choice="meet"]').addEventListener("click", () => {
    mountMeetSegments(container);
  });
}

// --- "Meet the segments": scripted group-chat cold open ---------------------

function mountMeetSegments(container) {
  container.innerHTML = `
    <div class="group-chat-section">
      <div class="group-chat-header">
        <div>
          <button type="button" class="report-back-link" id="meetSegBack">‹ Home</button>
          <h1>Meet the segments</h1>
          <p class="segmentation-sub">
            The six personas, dropping into a call one by one — largest segment first.
          </p>
        </div>
        <div class="group-chat-actions">
          <label class="group-chat-voice-toggle" id="voiceToggleWrap" style="display:none;">
            <input type="checkbox" id="voiceToggle"> 🔊 Read aloud
          </label>
          <button type="button" class="btn-secondary" id="skipToData">Skip to the data →</button>
        </div>
      </div>

      <div class="group-chat-participants" id="groupChatParticipants"></div>
      <div class="group-chat-messages" id="groupChatMessages"></div>
      <div class="group-chat-join-panel" id="groupJoinPanel"></div>
    </div>

    <div id="explorerMount"></div>
  `;

  container.querySelector("#meetSegBack").addEventListener("click", () => {
    window.speechSynthesis?.cancel();
    window.location.hash = "/";
  });

  const explorerMount = container.querySelector("#explorerMount");
  mountExplorer(explorerMount); // renders straight away; sequence above just delays scrolling to it

  const participantsEl = container.querySelector("#groupChatParticipants");
  const messagesEl = container.querySelector("#groupChatMessages");
  const skipBtn = container.querySelector("#skipToData");
  const joinPanel = container.querySelector("#groupJoinPanel");
  const voiceToggleWrap = container.querySelector("#voiceToggleWrap");
  const voiceToggle = container.querySelector("#voiceToggle");

  // Speech synthesis is a real, no-key-needed browser API — offer it, but
  // only if it's actually present (and don't assume any voices are loaded).
  if (window.speechSynthesis) voiceToggleWrap.style.display = "inline-flex";

  let cancelled = false;
  const joined = new Set();

  // Shared memory for the live phase: everything said in the scripted intro
  // plus everything said once the human joins, in one flat log. Each live
  // reply is built from this, so personas stay aware of the whole call, not
  // just what happened after they started actually thinking for themselves.
  const groupTranscript = [];
  let hasJoinedConversation = false;
  let groupSending = false;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function scrollToExplorer() {
    explorerMount.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // The button lives at the bottom of the conversation rather than in the
  // header — it only makes sense once there's actually a conversation to
  // join, so it appears right where that conversation currently ends.
  function enableJoinButton() {
    if (hasJoinedConversation || joinPanel.querySelector("#joinConversationBtn")) return;
    joinPanel.innerHTML = `
      <button type="button" class="btn-primary" id="joinConversationBtn">Join the conversation</button>
    `;
    joinPanel.querySelector("#joinConversationBtn").addEventListener("click", startJoinedConversation);
  }

  skipBtn.addEventListener("click", () => {
    cancelled = true;
    window.speechSynthesis?.cancel();
    enableJoinButton(); // skipping still means the scripted part is "done"
    scrollToExplorer();
  });

  function speak(persona, text) {
    return new Promise(resolve => {
      if (!voiceToggle.checked || !window.speechSynthesis) { resolve(); return; }
      const utter = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) utter.voice = voices[(persona.number - 1) % voices.length];
      // Nudge pitch per persona so even a reused voice sounds a little
      // distinct from the last one — a cheap stand-in for six real voices.
      utter.pitch = 0.85 + ((persona.number % 3) * 0.12);

      // speechSynthesis has a long history of just never firing 'end' in some
      // browsers/states (backgrounded tab, no voices installed, etc.) — a
      // hard timeout means a flaky voice engine delays the sequence instead
      // of freezing it outright.
      let settled = false;
      const settle = () => { if (!settled) { settled = true; resolve(); } };
      const fallbackTimer = setTimeout(settle, 12000);
      utter.onend = () => { clearTimeout(fallbackTimer); settle(); };
      utter.onerror = () => { clearTimeout(fallbackTimer); settle(); };
      window.speechSynthesis.speak(utter);
    });
  }

  function addParticipant(persona) {
    if (joined.has(persona.id)) return;
    joined.add(persona.id);
    participantsEl.insertAdjacentHTML("beforeend", `
      <div class="group-chat-participant">
        <div class="persona-avatar" style="background:${persona.accent}; color:${persona.avatarText}">${persona.number}</div>
        <span>${persona.name}</span>
      </div>
    `);
    messagesEl.insertAdjacentHTML("beforeend", `<div class="group-chat-system-note">${persona.name} joined the call</div>`);
  }

  function wordCount(text) {
    return text.trim().split(/\s+/).length;
  }

  function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
  }

  // How long the "…" bubble sits there before the message lands — modelling
  // typing time, not reading time.
  function typingDelay(text) {
    return clamp(500 + wordCount(text) * 200, 900, 2200);
  }

  // How long the message then sits on screen, alone, before the next thing
  // happens — modelling reading it at roughly a read-aloud pace (~150 words
  // a minute, i.e. ~400ms/word) rather than a skim. This is the pause that
  // was missing before: text was landing and immediately getting buried by
  // the next "typing…" bubble.
  function readingDelay(text) {
    return clamp(wordCount(text) * 100 + 300, 1400, 6500);
  }

  async function addMessage(persona, text) {
    const typingId = `group-chat-typing-${Date.now()}-${persona.number}`;
    messagesEl.insertAdjacentHTML("beforeend", `
      <div class="group-chat-msg group-chat-msg--typing" id="${typingId}">
        <div class="persona-avatar" style="background:${persona.accent}; color:${persona.avatarText}">${persona.number}</div>
        <div class="group-chat-msg__bubble" style="--persona-accent:${persona.accent}">
          <span class="group-chat-msg__name">${persona.name}</span>
          <span class="typing-dots"><span></span><span></span><span></span></span>
        </div>
      </div>
    `);
    await sleep(typingDelay(text));
    if (cancelled) return;

    document.getElementById(typingId)?.remove();
    messagesEl.insertAdjacentHTML("beforeend", `
      <div class="group-chat-msg">
        <div class="persona-avatar" style="background:${persona.accent}; color:${persona.avatarText}">${persona.number}</div>
        <div class="group-chat-msg__bubble" style="--persona-accent:${persona.accent}">
          <span class="group-chat-msg__name">${persona.name}</span>
          ${escapeHtml(text)}
        </div>
      </div>
    `);
    // Scripted lines join the same log the live replies read from, so
    // whoever the human ends up talking to already "remembers" this part.
    groupTranscript.push({ speakerId: persona.id, speakerName: persona.name, text });

    if (voiceToggle.checked) {
      // The audio itself paces this — just a small breather once it ends.
      await speak(persona, text);
      await sleep(500);
    } else {
      await sleep(readingDelay(text));
    }
  }

  async function playScript() {
    for (const event of GROUP_CHAT_SCRIPT) {
      if (cancelled) return;
      const persona = getPersona(event.personaId);
      if (!persona) continue;

      if (event.type === "join") {
        addParticipant(persona);
        await sleep(700);
      } else {
        await addMessage(persona, event.text);
      }
    }
    if (!cancelled) {
      enableJoinButton();
      await sleep(600);
      scrollToExplorer();
    }
  }

  // --- "Join the conversation": live, AI-generated group chat ------------
  // Same visible thread as the scripted intro above, continued for real.
  // Every persona replies to each message you send, in segment-size order,
  // each grounded in its own data plus the full transcript so far (scripted
  // and live) via groupHistoryFor().

  function scrollLatestIntoView() {
    messagesEl.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function addLiveReply(persona, apiKey, model) {
    const typingId = `group-chat-live-typing-${Date.now()}-${persona.number}`;
    messagesEl.insertAdjacentHTML("beforeend", `
      <div class="group-chat-msg group-chat-msg--typing" id="${typingId}">
        <div class="persona-avatar" style="background:${persona.accent}; color:${persona.avatarText}">${persona.number}</div>
        <div class="group-chat-msg__bubble" style="--persona-accent:${persona.accent}">
          <span class="group-chat-msg__name">${persona.name}</span>
          <span class="typing-dots"><span></span><span></span><span></span></span>
        </div>
      </div>
    `);
    scrollLatestIntoView();

    try {
      const reply = await sendToGemini(persona, apiKey, model, groupHistoryFor(persona, groupTranscript));
      document.getElementById(typingId)?.remove();
      groupTranscript.push({ speakerId: persona.id, speakerName: persona.name, text: reply });
      messagesEl.insertAdjacentHTML("beforeend", `
        <div class="group-chat-msg">
          <div class="persona-avatar" style="background:${persona.accent}; color:${persona.avatarText}">${persona.number}</div>
          <div class="group-chat-msg__bubble" style="--persona-accent:${persona.accent}">
            <span class="group-chat-msg__name">${persona.name}</span>
            ${escapeHtml(reply)}
          </div>
        </div>
      `);
      scrollLatestIntoView();
      await speak(persona, reply);
    } catch (err) {
      document.getElementById(typingId)?.remove();
      messagesEl.insertAdjacentHTML("beforeend", `<div class="group-chat-system-note">${persona.name} didn't reply — ${escapeHtml(err.message || "something went wrong talking to the AI provider.")}</div>`);
      scrollLatestIntoView();
    }
  }

  function renderJoinPanel() {
    const hasKey = !!getStoredKey();
    joinPanel.innerHTML = `
      <div class="chat-settings-panel" id="groupChatSettingsPanel" style="display:${hasKey ? "none" : "flex"};">
        <p class="chat-settings-note">
          Bring-your-own-key, same as the 1:1 chat: kept only in this browser tab's session
          storage, never sent anywhere but the AI provider, never saved to this app's server
          or git. Save it once here and it works in both places.
        </p>
        <label>
          Gemini API key
          <input type="password" id="groupChatApiKeyInput" placeholder="AIza…" autocomplete="off" value="${getStoredKey()}">
        </label>
        <label>
          Model id
          <input type="text" id="groupChatModelInput" placeholder="${DEFAULT_MODEL}" value="${getStoredModel()}">
        </label>
        <div class="modal-actions">
          <button type="button" class="btn-primary" id="groupChatSettingsSave">Save</button>
        </div>
      </div>
      <form class="chat-input-row" id="groupChatForm">
        <textarea id="groupChatInput" rows="1" placeholder="Say something to the group…"></textarea>
        <button type="submit" class="btn-primary" id="groupChatSendBtn">Send</button>
      </form>
    `;

    const settingsPanel = joinPanel.querySelector("#groupChatSettingsPanel");
    const apiKeyInput = joinPanel.querySelector("#groupChatApiKeyInput");
    const modelInput = joinPanel.querySelector("#groupChatModelInput");
    const form = joinPanel.querySelector("#groupChatForm");
    const input = joinPanel.querySelector("#groupChatInput");
    const sendBtn = joinPanel.querySelector("#groupChatSendBtn");

    joinPanel.querySelector("#groupChatSettingsSave").addEventListener("click", () => {
      const key = apiKeyInput.value.trim();
      const model = modelInput.value.trim() || DEFAULT_MODEL;
      if (key) sessionStorage.setItem(KEY_STORAGE_KEY, key);
      sessionStorage.setItem(MODEL_STORAGE_KEY, model);
      if (key) settingsPanel.style.display = "none";
    });

    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (groupSending) return;

      const text = input.value.trim();
      if (!text) return;

      const apiKey = getStoredKey();
      if (!apiKey) {
        settingsPanel.style.display = "flex";
        apiKeyInput.focus();
        return;
      }

      // Render immediately — who ends up replying is decided next, but
      // there's no reason to make the user's own message wait on that.
      const priorTranscript = groupTranscript.slice();
      groupTranscript.push({ speakerId: "user", speakerName: "You", text });
      messagesEl.insertAdjacentHTML("beforeend", `
        <div class="group-chat-msg group-chat-msg--you">
          <div class="group-chat-msg__bubble">${escapeHtml(text)}</div>
        </div>
      `);
      input.value = "";
      scrollLatestIntoView();

      groupSending = true;
      sendBtn.disabled = true;
      input.disabled = true;

      const model = getStoredModel();
      const respondents = await pickRespondents(apiKey, model, priorTranscript, text);
      for (const persona of respondents) {
        await addLiveReply(persona, apiKey, model);
      }

      groupSending = false;
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    });
  }

  function startJoinedConversation() {
    if (hasJoinedConversation) return;
    hasJoinedConversation = true;

    messagesEl.insertAdjacentHTML("beforeend", `
      <div class="group-chat-system-note">
        You joined the call — from here, replies are generated live by AI (via your saved API
        key), grounded in each persona's own data, not scripted like the introduction above.
      </div>
    `);
    scrollLatestIntoView();
    renderJoinPanel(); // replaces the button in #groupJoinPanel with the input
  }

  playScript();
}

// --- "Explore the data": overview grid, detail profiles, compare, and the
// 1:1 chat modal. Called into whatever root element the current entry point
// wants it rendered into (the page directly, or beneath the group chat).
function mountExplorer(container) {
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
          <div class="persona-avatar" style="background:${p.accent}; color:${p.avatarText}">${p.number}</div>
          <label class="persona-compare-toggle">
            <input type="checkbox" data-action="toggle-compare" data-id="${p.id}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
            Compare
          </label>
        </div>
        <h3>${p.name}</h3>
        <p class="persona-archetype">${p.archetype}</p>
        <p class="persona-tagline">“${p.tagline}”</p>
        ${workforceBarHtml(p)}
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
            <div class="pref-bar-row__top">
              <span class="pref-bar-row__label">${c.label}</span>
              <span class="pref-bar-value">${score}</span>
            </div>
            <div class="pref-bar-track"><div class="pref-bar-fill" style="width:${score}%; background:${selected ? p.accent : "#ccc"}"></div></div>
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
      <div class="persona-detail" style="--persona-accent:${p.accent}">
        <div class="persona-detail__header" style="border-left-color:${p.accent}">
          <div class="persona-avatar persona-avatar--lg" style="background:${p.accent}; color:${p.avatarText}">${p.number}</div>
          <div>
            <h2>${p.name}</h2>
            <p class="persona-archetype">${p.archetype}</p>
            <p class="persona-tagline">“${p.tagline}”</p>
            ${workforceBarHtml(p)}
          </div>
          <button type="button" class="btn-primary" data-action="open-chat" data-id="${p.id}" style="background:${p.accent}; border-color:${p.accent}; color:${p.avatarText}">Chat with ${p.name}</button>
        </div>

        <p class="persona-summary">${p.summary}</p>

        <div class="persona-detail__grid">
          <section class="detail-card">
            <h3>Preferred communication channels</h3>
            <p class="section-hint">From "Which communications channels do you prefer to use?" (multi-select, ${SELECTION_THRESHOLD}+ counts as selected)</p>
            ${channelBarsHtml(p)}
          </section>
          <section class="detail-card">
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

        <section class="persona-demographics detail-card">
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
          <div class="persona-avatar" style="background:${p.accent}; color:${p.avatarText}">${p.number}</div>
        </div>
        <h3>${p.name}</h3>
        <p class="persona-archetype">${p.archetype}</p>
        <p class="persona-tagline">“${p.tagline}”</p>
        ${workforceBarHtml(p)}
        <button type="button" class="btn-secondary" data-action="open-chat" data-id="${p.id}" style="background:${p.accent}; border-color:${p.accent}; color:${p.avatarText}">Chat with ${p.name}</button>
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

  function renderMessages() {
    const history = chatHistories[activeChatPersonaId] || [];
    const persona = getPersona(activeChatPersonaId);
    const placeholder = getStoredKey()
      ? `<div class="chat-msg chat-msg--system">Save your API key below and ${persona?.name || "this persona"} will say hello. You're chatting with a simulated persona built from its dummy survey data, not a real employee.</div>`
      : `<div class="chat-msg chat-msg--system">Add your API key below to start chatting. You're chatting with a simulated persona built from its dummy survey data, not a real employee.</div>`;
    chatMessages.innerHTML = history.map(m => `
      <div class="chat-msg ${m.role === "user" ? "chat-msg--user" : "chat-msg--persona"}">${escapeHtml(m.text)}</div>
    `).join("") || placeholder;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function openChat(id) {
    const p = getPersona(id);
    if (!p) return;
    activeChatPersonaId = id;
    chatAvatar.style.background = p.accent;
    chatAvatar.style.color = p.avatarText;
    chatAvatar.textContent = p.number;
    chatPersonaName.textContent = p.name;
    chatPersonaTagline.textContent = `${p.archetype} — “${p.tagline}”`;
    chatHistories[id] = chatHistories[id] || [];
    renderMessages();

    chatSettingsPanel.style.display = getStoredKey() ? "none" : "flex";
    chatApiKeyInput.value = getStoredKey();
    chatModelInput.value = getStoredModel();

    chatBackdrop.style.display = "flex";
    document.addEventListener("keydown", onChatEscKey);
    chatInput.focus();

    // Key already saved from a previous persona this session — greet
    // straight away rather than waiting on a Save click that isn't coming.
    if (getStoredKey()) sendOpeningGreeting();
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
    if (key) sendOpeningGreeting();
  });

  // Has the persona say hello first, so saving a key feels like walking into
  // a live conversation rather than an empty text box. Only fires once per
  // persona per page load — if there's already a message in the thread
  // (e.g. the key was just being re-saved), it stays quiet.
  async function sendOpeningGreeting() {
    if (!activeChatPersonaId || sending) return;
    const history = chatHistories[activeChatPersonaId];
    if (!history || history.length > 0) return;

    const apiKey = getStoredKey();
    if (!apiKey) return;
    const persona = getPersona(activeChatPersonaId);

    sending = true;
    chatSendBtn.disabled = true;
    chatMessages.innerHTML = `<div class="chat-msg chat-msg--typing" id="chatTyping">${persona.name} is typing…</div>`;
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const kickoff = [{ role: "user", text: "(Start the conversation: say a brief, natural, in-character hello to open the chat. 1-2 sentences, no more.)" }];
      const reply = await sendToGemini(persona, apiKey, getStoredModel(), kickoff);
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
  }

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
