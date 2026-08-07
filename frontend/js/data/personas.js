// Dummy data for the Segmentation Explorer.
//
// Personas were built as if derived from a multi-select survey question —
// "Which communications channels do you prefer to use?" — clustered against
// standard employee engagement / comms-audit questions. All figures are
// illustrative (PoC only), not real survey output.

export const CHANNELS = [
  { id: "email", label: "Email" },
  { id: "meetings", label: "Team meetings" },
  { id: "face2face", label: "Face-to-face / manager 1:1s" },
  { id: "im", label: "Instant messaging (Teams / Slack)" },
  { id: "social", label: "Enterprise social (Yammer / Workplace)" },
  { id: "intranet", label: "Intranet / portal" },
  { id: "video", label: "Video & town halls" },
  { id: "print", label: "Posters / noticeboards" },
  { id: "sms", label: "Text / SMS" },
];

// A channel counts as "selected" on the underlying multi-select question
// once its preference score crosses this line.
export const SELECTION_THRESHOLD = 50;

export const PERSONAS = [
  {
    id: "traditional-emailer",
    name: "The Traditional Emailer",
    tagline: "If it matters, it belongs in my inbox.",
    accent: "#131B5A",
    size: 22,
    demographics: {
      ageRange: "45–60",
      avgTenureYears: 11,
      workModel: "Office-based",
      primaryDepartments: ["Finance", "Operations", "Admin & Support"],
    },
    channelScores: {
      email: 95, meetings: 78, intranet: 55, im: 30,
      face2face: 40, social: 8, video: 25, print: 20, sms: 10,
    },
    quote: "If it's important, put it in writing and send it to my inbox — I'll read it properly and keep it for reference.",
    summary: "Long-tenured, office-based staff who trust the written record. They read thoroughly and want a paper trail, but can miss anything that's only announced verbally or socially.",
    audit: {
      engagementScore: 74,
      enps: 18,
      feelInformed: 81,
      trustLeadership: 70,
      feelHeard: 58,
      relevance: 66,
      commsVolume: "About right",
      preferredFrequency: "Weekly digest",
      whatWorksWell: "Clear, well-structured emails with a consistent sender and subject format.",
      topFrustration: "Too many messages arriving through channels they don't check regularly.",
    },
  },
  {
    id: "face-to-face-believer",
    name: "The Face-to-Face Believer",
    tagline: "I trust what my manager tells me in person.",
    accent: "#A8631B",
    size: 18,
    demographics: {
      ageRange: "35–55",
      avgTenureYears: 8,
      workModel: "Frontline / on-site",
      primaryDepartments: ["Manufacturing", "Retail", "Field Operations"],
    },
    channelScores: {
      face2face: 96, meetings: 85, video: 40, email: 35,
      im: 20, social: 12, intranet: 18, print: 45, sms: 30,
    },
    quote: "I don't really trust an email until my manager's told me the same thing in person.",
    summary: "Frontline and supervisory staff who rely on their line manager as the credible source. Formal channels feel remote to them; cascade briefings land far better than a broadcast email.",
    audit: {
      engagementScore: 68,
      enps: 5,
      feelInformed: 62,
      trustLeadership: 74,
      feelHeard: 80,
      relevance: 70,
      commsVolume: "Too little",
      preferredFrequency: "As it happens, in real time",
      whatWorksWell: "Short team briefings where they can ask questions on the spot.",
      topFrustration: "Finding out about changes from a colleague before their manager tells them.",
    },
  },
  {
    id: "social-connector",
    name: "The Social Connector",
    tagline: "The real conversation happens on Yammer.",
    accent: "#0F6B72",
    size: 16,
    demographics: {
      ageRange: "22–30",
      avgTenureYears: 2,
      workModel: "Hybrid",
      primaryDepartments: ["Marketing", "Digital", "Graduate scheme"],
    },
    channelScores: {
      social: 90, im: 88, video: 60, sms: 45,
      email: 42, meetings: 38, intranet: 30, face2face: 25, print: 5,
    },
    quote: "Yammer's basically where the real conversation happens, not the all-staff email.",
    summary: "Early-career, digitally fluent staff who expect two-way, informal, always-on communication. They engage well but can feel unheard by top-down, one-way channels.",
    audit: {
      engagementScore: 79,
      enps: 32,
      feelInformed: 75,
      trustLeadership: 65,
      feelHeard: 72,
      relevance: 84,
      commsVolume: "About right",
      preferredFrequency: "Daily / always-on",
      whatWorksWell: "Informal updates they can react to, comment on, or ask follow-up questions about.",
      topFrustration: "One-way broadcasts with no way to respond or discuss.",
    },
  },
  {
    id: "multichannel-pragmatist",
    name: "The Multi-Channel Pragmatist",
    tagline: "I'll take the update wherever it lands first.",
    accent: "#6B2D5C",
    size: 20,
    demographics: {
      ageRange: "30–45",
      avgTenureYears: 6,
      workModel: "Hybrid",
      primaryDepartments: ["IT", "Project Management", "Corporate functions"],
    },
    channelScores: {
      email: 80, im: 82, intranet: 70, meetings: 60,
      video: 45, social: 35, face2face: 30, sms: 15, print: 5,
    },
    quote: "I'll take the update wherever it lands first — I'm checking three of these anyway.",
    summary: "Busy, channel-agnostic staff already juggling several tools. They're easy to reach but quick to tune out anything that feels duplicated across channels.",
    audit: {
      engagementScore: 81,
      enps: 28,
      feelInformed: 85,
      trustLeadership: 76,
      feelHeard: 70,
      relevance: 80,
      commsVolume: "About right",
      preferredFrequency: "Daily",
      whatWorksWell: "Concise updates that respect their time and aren't repeated verbatim everywhere.",
      topFrustration: "The same announcement resent across every channel with no new information.",
    },
  },
  {
    id: "quiet-disengaged",
    name: "The Quiet Disengaged",
    tagline: "Most of it washes over me either way.",
    accent: "#4B5563",
    size: 12,
    demographics: {
      ageRange: "Mixed",
      avgTenureYears: 3,
      workModel: "Dispersed / frontline",
      primaryDepartments: ["Distribution", "Contact Centre", "Site-based roles"],
    },
    channelScores: {
      email: 40, meetings: 30, face2face: 35, im: 25,
      social: 15, intranet: 20, video: 22, print: 18, sms: 20,
    },
    quote: "Honestly, most of it washes over me — I'll hear about anything important eventually.",
    summary: "A flight-risk segment with low engagement across every channel, not just a channel-preference issue. Reaching them needs a trust and relevance fix as much as a delivery-method fix.",
    audit: {
      engagementScore: 41,
      enps: -22,
      feelInformed: 38,
      trustLeadership: 33,
      feelHeard: 29,
      relevance: 35,
      commsVolume: "Too much (but irrelevant)",
      preferredFrequency: "Rarely engages regardless of frequency",
      whatWorksWell: "Nothing scored highly — the lowest-friction option is usually whatever their manager repeats most.",
      topFrustration: "Comms that feel like they're written for head office, not for their role.",
    },
  },
  {
    id: "visual-video-learner",
    name: "The Visual & Video Learner",
    tagline: "A two-minute video tells me more than a page of text.",
    accent: "#A83232",
    size: 12,
    demographics: {
      ageRange: "25–40",
      avgTenureYears: 4,
      workModel: "Site-based, no regular desk/email access",
      primaryDepartments: ["Warehouse", "Production", "Field engineering"],
    },
    channelScores: {
      video: 92, print: 65, social: 50, meetings: 55,
      face2face: 48, sms: 35, email: 20, im: 18, intranet: 15,
    },
    quote: "A two-minute video from the CEO tells me more than a page of text ever will.",
    summary: "Staff with limited or no regular email/desk access who absorb visual and spoken content far better than dense text. Noticeboards and short videos at shift changeovers work best.",
    audit: {
      engagementScore: 70,
      enps: 12,
      feelInformed: 66,
      trustLeadership: 68,
      feelHeard: 60,
      relevance: 73,
      commsVolume: "About right",
      preferredFrequency: "Weekly",
      whatWorksWell: "Short videos and posters placed where they already gather (canteen, shift changeover).",
      topFrustration: "Being sent long text documents they have no easy way to read on shift.",
    },
  },
];

export function getPersona(id) {
  return PERSONAS.find(p => p.id === id) || null;
}

export function selectedChannels(persona) {
  return CHANNELS
    .filter(c => (persona.channelScores[c.id] || 0) >= SELECTION_THRESHOLD)
    .sort((a, b) => persona.channelScores[b.id] - persona.channelScores[a.id]);
}

export function topChannels(persona, n = 3) {
  return [...CHANNELS]
    .sort((a, b) => (persona.channelScores[b.id] || 0) - (persona.channelScores[a.id] || 0))
    .slice(0, n);
}

// Builds the system prompt used to make an LLM roleplay as this persona in
// the chat panel, grounded in its dummy survey data so answers stay
// consistent with the segment rather than generic.
export function buildPersonaSystemPrompt(persona) {
  const channels = selectedChannels(persona)
    .map(c => `${c.label} (preference score ${persona.channelScores[c.id]}/100)`)
    .join("; ");

  const d = persona.demographics;
  const a = persona.audit;

  return [
    `You are roleplaying as "${persona.name}", a persona representing ${persona.size}% of the workforce in an internal communications & employee engagement segmentation study. Stay in character as ONE typical employee from this segment — speak in first person, informally, as a real employee would in a quick chat, not as a corporate summary.`,
    ``,
    `Your profile:`,
    `- Tagline: "${persona.tagline}"`,
    `- Age range: ${d.ageRange}; average tenure: ${d.avgTenureYears} years; work model: ${d.workModel}`,
    `- Typical departments: ${d.primaryDepartments.join(", ")}`,
    `- Preferred communication channels (from a "which channels do you prefer?" multi-select question): ${channels}`,
    `- Representative quote: "${persona.quote}"`,
    `- Background: ${persona.summary}`,
    ``,
    `Engagement / comms audit results for this segment:`,
    `- Overall engagement score: ${a.engagementScore}/100`,
    `- eNPS: ${a.enps}`,
    `- "I feel well informed": ${a.feelInformed}% agree`,
    `- "I trust senior leadership communications": ${a.trustLeadership}% agree`,
    `- "I feel comfortable giving feedback / feel heard": ${a.feelHeard}% agree`,
    `- "Communications are relevant to my role": ${a.relevance}% agree`,
    `- Perception of comms volume: ${a.commsVolume}`,
    `- Preferred frequency: ${a.preferredFrequency}`,
    `- What works well for them: ${a.whatWorksWell}`,
    `- Their top frustration: ${a.topFrustration}`,
    ``,
    `Answer questions the way this person would, drawing on the data above. Keep replies short and conversational (2-5 sentences) unless asked for more detail. Never break character or mention that you are an AI, a language model, or that this is simulated/dummy data — just answer as this employee.`,
  ].join("\n");
}
