// Scripted (not AI-generated) dialogue for the "Meet the segments" intro
// sequence: personas "join a call" one by one, largest segment first, each
// new arrival getting a couple of exchanges with whoever's already there.
// It's hand-written rather than live LLM output on purpose — this plays on
// page load with no API key required, and needs to read as a tight, curated
// two-minute cold open rather than an unpredictable live conversation.
//
// Join order (by segment size): Margaret 22% -> Tom 20% -> Daniel 18% ->
// Priya 16% -> Chloe 12% -> Marcus 12%.

export const GROUP_CHAT_SCRIPT = [
  { type: "join", personaId: "traditional-emailer" },
  { type: "join", personaId: "multichannel-pragmatist" },

  { type: "message", personaId: "traditional-emailer", text: "Morning! Guessing we're here to talk comms preferences again?" },
  { type: "message", personaId: "multichannel-pragmatist", text: "Ha, yep. I'll take it wherever it lands, honestly — email, Teams, doesn't matter to me." },
  { type: "message", personaId: "traditional-emailer", text: "Not for me. If it's not in my inbox with a proper subject line, I've probably not seen it." },
  { type: "message", personaId: "multichannel-pragmatist", text: "Fair enough. I did notice the last town hall invite went out on four different channels though. A bit much." },

  { type: "join", personaId: "face-to-face-believer" },
  { type: "message", personaId: "face-to-face-believer", text: "Sorry I'm late — didn't even see the invite until my manager mentioned it in our morning huddle." },
  { type: "message", personaId: "traditional-emailer", text: "That's basically my point though, Daniel — just for email instead of managers." },
  { type: "message", personaId: "face-to-face-believer", text: "Ha, fair. Honestly I don't fully trust something until I've heard it from him directly." },

  { type: "join", personaId: "social-connector" },
  { type: "message", personaId: "social-connector", text: "Sorry all, jumping in from the Yammer thread about this exact thing 🙂" },
  { type: "message", personaId: "multichannel-pragmatist", text: "There's a Yammer thread about this?" },
  { type: "message", personaId: "social-connector", text: "There's always a Yammer thread, Tom." },

  { type: "join", personaId: "quiet-disengaged" },
  { type: "message", personaId: "quiet-disengaged", text: "Hi — sorry, only just saw this had started." },
  { type: "message", personaId: "social-connector", text: "No worries! We're just comparing notes on comms channels." },
  { type: "message", personaId: "quiet-disengaged", text: "Most of it kind of passes me by if I'm honest. Nothing personal." },

  { type: "join", personaId: "visual-video-learner" },
  { type: "message", personaId: "visual-video-learner", text: "Hey — could someone drop this as a two-minute video instead? I'm on shift, can't really read a long thread right now." },
  { type: "message", personaId: "quiet-disengaged", text: "Same problem here, honestly." },
  { type: "message", personaId: "traditional-emailer", text: "See, this is exactly why one channel never works for everyone." },
  { type: "message", personaId: "multichannel-pragmatist", text: "Yeah. Maybe just don't send everything six times either, though." },
];
