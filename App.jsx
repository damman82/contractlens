import { useState, useCallback, useRef, useEffect } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const RISK_COLORS = {
  high:   { bg:"#E8433A", light:"#FDF0EF", border:"#F5C5C2", text:"#E8433A" },
  medium: { bg:"#E8900A", light:"#FEF6E4", border:"#F5D998", text:"#B86D00" },
  low:    { bg:"#2E7D46", light:"#EDF6F0", border:"#A8D9B8", text:"#2E7D46" },
};

const ANALYSIS_STEPS = [
  { label:"Uploading document",         icon:"↑", duration:600  },
  { label:"Reading contract structure", icon:"📄", duration:900  },
  { label:"Scanning for risk clauses",  icon:"🔍", duration:1100 },
  { label:"Checking IP & liability",    icon:"⚖️", duration:900  },
  { label:"Identifying missing terms",  icon:"○", duration:700  },
  { label:"Preparing your report",      icon:"✦", duration:500  },
];

const CHAT_SYSTEM = (summary, contractType, risks) =>
  `You are a friendly contract attorney assistant. The user uploaded a ${contractType} contract.
Summary: ${summary}
Key risks: ${(risks||[]).map(r=>`- ${r.title} (${r.severity}): ${r.explanation}`).join("\n")}
Answer questions in plain English, 2-4 sentences. Always note you're AI, not a substitute for a real lawyer.`;

const FRIENDLY_ERRORS = {
  "Too many requests": "You've hit the hourly limit. Take a break and try again in an hour.",
  "timed out": "That contract was too large to process in time. Try uploading just the key pages.",
  "API key": "Something is misconfigured on our end. Please try again later.",
  "Failed to fetch": "Can't reach the server. Check your internet connection and try again.",
  "parse": "We had trouble reading the AI response. Please try again.",
};

function friendlyError(msg) {
  for (const [key, friendly] of Object.entries(FRIENDLY_ERRORS)) {
    if (msg?.toLowerCase().includes(key.toLowerCase())) return friendly;
  }
  return "Something went wrong. Please try again.";
}

// ─── SVG Illustrations ────────────────────────────────────────────────────────

const IllustrationDocument = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <rect x="16" y="8" width="42" height="56" rx="3" stroke="#1a1a1a" strokeWidth="1.8" fill="none"/>
    <path d="M26 24 Q40 22 50 24" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <path d="M26 32 Q38 30 52 32" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <path d="M26 40 Q35 38 46 40" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <path d="M26 48 Q33 47 40 48" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <path d="M30 8 L30 16 L16 16" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
    <circle cx="58" cy="58" r="12" fill="#F5C842" stroke="#1a1a1a" strokeWidth="1.5"/>
    <path d="M53 58 L56.5 61.5 L63 55" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IllustrationMagnify = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <circle cx="26" cy="26" r="16" stroke="#1a1a1a" strokeWidth="1.8" fill="none"/>
    <line x1="37" y1="37" x2="52" y2="52" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M19 22 Q23 18 28 20" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    <circle cx="26" cy="26" r="8" fill="#F5C842" opacity="0.35"/>
  </svg>
);
const IllustrationWarning = () => (
  <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
    <path d="M24 6 L44 40 H4 Z" stroke="#1a1a1a" strokeWidth="1.8" fill="#FEF6E4" strokeLinejoin="round"/>
    <line x1="24" y1="20" x2="24" y2="30" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="24" cy="35" r="1.5" fill="#1a1a1a"/>
  </svg>
);
const IllustrationCheck = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="18" stroke="#1a1a1a" strokeWidth="1.8" fill="#EDF6F0"/>
    <path d="M15 24 L21 30 L33 18" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IllustrationShield = ({ size=64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <path d="M32 6 L54 16 L54 34 C54 46 32 58 32 58 C32 58 10 46 10 34 L10 16 Z" stroke="#1a1a1a" strokeWidth="1.8" fill="#F5C842" opacity="0.35"/>
    <path d="M22 32 L28 38 L42 26" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IllustrationStar = ({ size=48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M24 4 L28.5 17.5 L43 17.5 L31.5 26 L36 39.5 L24 31 L12 39.5 L16.5 26 L5 17.5 L19.5 17.5 Z" stroke="#1a1a1a" strokeWidth="1.5" fill="#F5C842" strokeLinejoin="round"/>
  </svg>
);
const IllustrationUpload = ({ size=64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <rect x="8" y="36" width="48" height="20" rx="4" stroke="#1a1a1a" strokeWidth="1.8" fill="#F5C842" opacity="0.4"/>
    <path d="M32 8 L32 36" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
    <path d="M20 20 L32 8 L44 20" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="48" cy="46" r="4" fill="#1a1a1a"/>
  </svg>
);
const IllustrationPen = ({ size=64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <path d="M44 8 L56 20 L20 56 L8 56 L8 44 Z" stroke="#1a1a1a" strokeWidth="1.8" fill="#A8D9FF" opacity="0.5" strokeLinejoin="round"/>
    <path d="M38 14 L50 26" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 56 L14 50" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const ScribbleUnderline = ({ color="#F5C842", width=120 }) => (
  <svg width={width} height="10" viewBox={`0 0 ${width} 10`} fill="none">
    <path d={`M2 7 Q${width/4} 2 ${width/2} 6 Q${width*3/4} 10 ${width-2} 5`} stroke={color} strokeWidth="3" strokeLinecap="round" fill="none"/>
  </svg>
);
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

// ─── Global CSS ───────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Nunito:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #F7F4EE; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:#F0EDE6} ::-webkit-scrollbar-thumb{background:#D4CEBC;border-radius:3px}

  /* Buttons */
  .sketch-btn{background:#1a1a1a;color:#F7F4EE;border:none;border-radius:50px;padding:13px 32px;font-family:'Nunito',sans-serif;font-weight:700;font-size:15px;cursor:pointer;transition:all 0.15s;display:inline-block}
  .sketch-btn:hover{background:#333;transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.15)}
  .sketch-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
  .sketch-btn-yellow{background:#F5C842;color:#1a1a1a;border:1.5px solid #1a1a1a;border-radius:50px;padding:13px 32px;font-family:'Nunito',sans-serif;font-weight:700;font-size:15px;cursor:pointer;transition:all 0.15s;box-shadow:3px 3px 0 #1a1a1a}
  .sketch-btn-yellow:hover{transform:translateY(-2px);box-shadow:4px 5px 0 #1a1a1a}
  .sketch-btn-outline{background:transparent;color:#1a1a1a;border:1.5px solid #1a1a1a;border-radius:50px;padding:9px 20px;font-family:'Nunito',sans-serif;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.15s}
  .sketch-btn-outline:hover{background:#1a1a1a;color:#F7F4EE}

  /* Upload */
  .upload-zone{border:2px dashed #C8C0A8;border-radius:20px;transition:all 0.2s;cursor:pointer;background:#FDFAF5}
  .upload-zone:hover,.upload-zone.drag{border-color:#1a1a1a;background:#FAF7F0}

  /* Cards */
  .sticky-card{border-radius:4px;padding:22px;border:1.5px solid rgba(0,0,0,0.1);box-shadow:3px 4px 0 rgba(0,0,0,0.12);transition:transform 0.15s}
  .sticky-card:hover{transform:translateY(-3px)}
  .risk-card-side{border-radius:14px;padding:14px 16px;cursor:pointer;border:1.5px solid #E8E2D6;background:#FDFAF5;transition:all 0.15s;font-family:'Nunito',sans-serif}
  .risk-card-side:hover{border-color:#1a1a1a;transform:translateX(3px)}
  .risk-card-side.active{border-color:#1a1a1a;background:#fff;box-shadow:3px 3px 0 #1a1a1a}
  .detail-box{background:#FDFAF5;border:1.5px solid #E8E2D6;border-radius:14px;padding:18px 20px}
  .clause-box{background:#FDF0EF;border-left:3px solid #E8433A;padding:14px 16px;border-radius:0 10px 10px 0;font-style:italic;font-size:13px;color:#555;line-height:1.65;font-family:'Nunito',sans-serif}
  .revision-box{background:#EDF6F0;border-left:3px solid #2E7D46;padding:14px 16px;border-radius:0 10px 10px 0;font-size:13px;color:#2a4a2e;line-height:1.65;font-family:'Nunito',sans-serif}

  /* Tabs + badges */
  .tab-pill{padding:8px 20px;border-radius:50px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;transition:all 0.15s;background:transparent;color:#888;border:1.5px solid #D4CEBC}
  .tab-pill.active{background:#1a1a1a;color:#F7F4EE;border-color:#1a1a1a}
  .tab-pill:not(.active):hover{border-color:#1a1a1a;color:#1a1a1a}
  .risk-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:50px;font-family:'Nunito',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px}

  /* Nav */
  .nav-link{font-family:'Nunito',sans-serif;font-size:14px;font-weight:600;color:#666;text-decoration:none;cursor:pointer;transition:color 0.15s;background:none;border:none;padding:0}
  .nav-link:hover,.nav-link.active-nav{color:#1a1a1a}
  .nav-link.active-nav{border-bottom:2px solid #F5C842;padding-bottom:2px}

  /* Chat */
  .chat-bubble-user{background:#1a1a1a;color:#F7F4EE;border-radius:18px 18px 4px 18px;padding:12px 16px;font-family:'Nunito',sans-serif;font-size:14px;line-height:1.55;max-width:85%;align-self:flex-end}
  .chat-bubble-ai{background:#fff;border:1.5px solid #E0DAC8;color:#1a1a1a;border-radius:18px 18px 18px 4px;padding:12px 16px;font-family:'Nunito',sans-serif;font-size:14px;line-height:1.55;max-width:85%;align-self:flex-start}
  .chat-input{width:100%;border:1.5px solid #E0DAC8;border-radius:50px;padding:12px 20px;font-family:'Nunito',sans-serif;font-size:14px;background:#FDFAF5;color:#1a1a1a;outline:none;transition:border-color 0.15s}
  .chat-input:focus{border-color:#1a1a1a}
  .chip-question{background:#F0EDE6;border:1.5px solid #D4CEBC;border-radius:50px;padding:7px 14px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;white-space:nowrap}
  .chip-question:hover{background:#1a1a1a;color:#F7F4EE;border-color:#1a1a1a}

  /* Before/after toggle */
  .before-after-toggle{display:flex;background:#F0EDE6;border:1.5px solid #D4CEBC;border-radius:50px;padding:3px;width:fit-content}
  .ba-btn{padding:5px 14px;border-radius:50px;border:none;font-family:'Nunito',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;background:transparent;color:#888}
  .ba-btn.active{background:#1a1a1a;color:#F7F4EE}

  /* Progress */
  .progress-step{display:flex;align-items:center;gap:12px;padding:10px 0;transition:all 0.3s}
  .progress-step.done .step-icon{background:#1a1a1a;color:#F5C842;border-color:#1a1a1a}
  .progress-step.active .step-icon{background:#F5C842;color:#1a1a1a;border-color:#1a1a1a;box-shadow:0 0 0 4px rgba(245,200,66,0.2)}
  .progress-step.pending .step-icon{background:#F0EDE6;color:#aaa;border-color:#D4CEBC}
  .step-icon{width:36px;height:36px;border-radius:50%;border:1.5px solid;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;transition:all 0.3s;font-family:'Nunito',sans-serif;font-weight:700}

  /* Pricing */
  .pricing-card{background:#FDFAF5;border:1.5px solid #E0DAC8;border-radius:20px;padding:32px;transition:all 0.2s}
  .pricing-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,0.08)}

  /* Examples */
  .example-card{background:#FDFAF5;border:1.5px solid #E0DAC8;border-radius:16px;padding:24px;cursor:pointer;transition:all 0.15s}
  .example-card:hover{border-color:#1a1a1a;transform:translateY(-2px);box-shadow:4px 4px 0 #1a1a1a}

  /* Step connector */
  .step-line{position:absolute;left:23px;top:52px;bottom:-8px;width:1.5px;background:repeating-linear-gradient(to bottom,#D4CEBC 0,#D4CEBC 6px,transparent 6px,transparent 12px)}

  /* Email input */
  .email-input{width:100%;border:1.5px solid #E0DAC8;border-radius:12px;padding:13px 16px;font-family:'Nunito',sans-serif;font-size:14px;background:#fff;color:#1a1a1a;outline:none;transition:border-color 0.15s}
  .email-input:focus{border-color:#1a1a1a}

  /* Modal overlay */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)}
  .modal-box{background:#F7F4EE;border:1.5px solid #1a1a1a;border-radius:24px;padding:40px;max-width:480px;width:100%;box-shadow:8px 8px 0 #1a1a1a;position:relative}

  /* Animations */
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  .fade-up{animation:fadeUp 0.5s ease forwards}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .fade-in{animation:fadeIn 0.3s ease forwards}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes wobble{0%,100%{transform:rotate(-1.5deg)}50%{transform:rotate(1.5deg)}}
  .wobble{animation:wobble 3.5s ease-in-out infinite;display:inline-block}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .pulse{animation:pulse 1.4s ease-in-out infinite}
  @keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
  .typing-dot{animation:typing 1.2s ease infinite;display:inline-block;width:6px;height:6px;background:#aaa;border-radius:50%}
  @keyframes modalIn{from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
  .modal-box{animation:modalIn 0.25s ease forwards}

  /* ── MOBILE RESPONSIVE ── */
  @media (max-width: 768px) {
    /* Nav */
    .nav-desktop{display:none !important}
    .nav-mobile-menu{display:flex !important}

    /* Hero */
    .hero-title{font-size:32px !important;letter-spacing:-0.5px !important}
    .hero-sub{font-size:15px !important}

    /* 3-col grids → 1-col */
    .grid-3col{grid-template-columns:1fr !important}
    .grid-2col{grid-template-columns:1fr !important}
    .grid-pricing{grid-template-columns:1fr !important}
    .grid-footer{grid-template-columns:1fr 1fr !important;gap:24px !important}

    /* Risk panel layout */
    .risk-panel{grid-template-columns:1fr !important}
    .risk-sidebar{display:flex !important;flex-direction:row !important;overflow-x:auto !important;gap:8px !important;padding-bottom:4px}
    .risk-card-side{flex-shrink:0;min-width:160px}

    /* Score sticky → inline */
    .score-sticky{display:none !important}
    .score-inline{display:flex !important}

    /* Report header */
    .report-header{grid-template-columns:1fr !important}

    /* Tabs scroll */
    .tabs-row{overflow-x:auto !important;-webkit-overflow-scrolling:touch;padding-bottom:4px;flex-wrap:nowrap !important}
    .tabs-row::-webkit-scrollbar{display:none}

    /* Chat */
    .chat-bubble-user,.chat-bubble-ai{max-width:95% !important}

    /* Key dates scroll */
    .dates-row{overflow-x:auto !important;flex-wrap:nowrap !important}

    /* Page padding */
    .page-pad{padding-top:40px !important;padding-bottom:40px !important}

    /* Upload zone */
    .upload-zone{padding:32px 20px !important}

    /* Sticky cards */
    .feature-cards{gap:12px !important}
    .sticky-card{transform:none !important}

    /* Pricing featured card */
    .pricing-featured-badge{display:block}
  }

  @media (max-width: 480px) {
    .hero-title{font-size:27px !important}
    .modal-box{padding:28px 20px}
    .sketch-btn{padding:12px 24px;font-size:14px}
    .sketch-btn-yellow{padding:12px 24px;font-size:14px}
  }
`;

// ─── Email Capture Modal ──────────────────────────────────────────────────────

function EmailModal({ onSubmit, onSkip }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!email.includes("@")) return;
    // In production: POST to /api/subscribe or your email tool (Resend, Loops, etc.)
    console.log("Email captured:", email);
    setSubmitted(true);
    setTimeout(() => onSubmit(email), 1200);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onSkip()}>
      <div className="modal-box">
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div className="wobble" style={{ marginBottom:16, display:"inline-block" }}>
            <IllustrationShield size={72} />
          </div>
          <h2 style={{ fontFamily:"'Lora',serif", fontSize:26, fontWeight:700, lineHeight:1.2, marginBottom:8 }}>
            Your report is ready
          </h2>
          <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:15, color:"#666", lineHeight:1.6 }}>
            Get your full risk analysis. Enter your email to save a copy and receive contract tips.
          </p>
        </div>

        {!submitted ? (
          <>
            <input
              className="email-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              autoFocus
              style={{ marginBottom:12 }}
            />
            <button
              className="sketch-btn"
              onClick={handleSubmit}
              disabled={!email.includes("@")}
              style={{ width:"100%", marginBottom:12 }}
            >
              See my risk report →
            </button>
            <button
              onClick={onSkip}
              style={{ width:"100%", background:"none", border:"none", fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#aaa", cursor:"pointer", padding:"4px" }}
            >
              Skip for now
            </button>
            <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, color:"#bbb", textAlign:"center", marginTop:12, lineHeight:1.5 }}>
              No spam. Unsubscribe anytime. We never share your data.
            </p>
          </>
        ) : (
          <div style={{ textAlign:"center", padding:"16px 0" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>✓</div>
            <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:700, color:"#2E7D46" }}>Got it — loading your report</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Legal Disclaimer ─────────────────────────────────────────────────────────

function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div style={{ background:"#FEF6E4", borderBottom:"1.5px solid #F5D998", padding:"10px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
      <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#7A5800", lineHeight:1.5 }}>
        <strong>⚠ Not legal advice.</strong> ContractLens is an AI tool for informational purposes only. For important contracts, always consult a qualified attorney.
      </p>
      <button onClick={() => setDismissed(true)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#aaa", flexShrink:0, lineHeight:1 }}>×</button>
    </div>
  );
}

// ─── Result Disclaimer ────────────────────────────────────────────────────────

function ResultDisclaimer() {
  return (
    <div style={{ background:"#FEF6E4", border:"1.5px solid #F5D998", borderRadius:12, padding:"14px 18px", marginBottom:28, display:"flex", gap:12, alignItems:"flex-start" }}>
      <span style={{ fontSize:18, flexShrink:0 }}>⚠</span>
      <div>
        <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:13, color:"#7A5800", marginBottom:3 }}>AI analysis — not legal advice</div>
        <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#7A5800", lineHeight:1.55 }}>
          This report is generated by AI and may miss issues or contain errors. For any contract involving significant money, employment, or legal obligation, please review with a qualified lawyer before signing.
        </p>
      </div>
    </div>
  );
}

// ─── Error Box with Retry ─────────────────────────────────────────────────────

function ErrorBox({ message, onRetry }) {
  return (
    <div style={{ maxWidth:500, margin:"0 auto", padding:"12px 18px 16px", background:"#FDF0EF", border:"1.5px solid #F5C5C2", borderRadius:14 }}>
      <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, color:"#E8433A", marginBottom:10, lineHeight:1.5 }}>
        {message}
      </div>
      {onRetry && (
        <button className="sketch-btn-outline" onClick={onRetry} style={{ fontSize:13, padding:"7px 18px", borderColor:"#E8433A", color:"#E8433A" }}>
          Try again
        </button>
      )}
    </div>
  );
}

// ─── Progress Loader ──────────────────────────────────────────────────────────

function AnalysisLoader({ step }) {
  return (
    <div style={{ maxWidth:400, margin:"80px auto", padding:"0 24px", textAlign:"center" }}>
      <div className="wobble" style={{ marginBottom:28 }}><IllustrationMagnify /></div>
      <h2 style={{ fontFamily:"'Lora',serif", fontSize:24, fontWeight:700, fontStyle:"italic", marginBottom:6 }}>Reading your contract...</h2>
      <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#888", marginBottom:32 }}>This usually takes 10–20 seconds</p>
      <div style={{ background:"#E8E2D6", borderRadius:99, height:6, marginBottom:32, overflow:"hidden" }}>
        <div style={{ height:"100%", background:"#1a1a1a", borderRadius:99, width:`${Math.min(100,((step+1)/ANALYSIS_STEPS.length)*100)}%`, transition:"width 0.6s ease" }}/>
      </div>
      <div style={{ textAlign:"left" }}>
        {ANALYSIS_STEPS.map((s,i) => {
          const state = i < step ? "done" : i === step ? "active" : "pending";
          return (
            <div key={i} className={`progress-step ${state}`}>
              <div className="step-icon">
                {state==="done" ? "✓" : state==="active" ? <span className="pulse">{s.icon}</span> : s.icon}
              </div>
              <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, fontWeight:state==="active"?700:500, color:state==="done"?"#2E7D46":state==="active"?"#1a1a1a":"#aaa", transition:"all 0.3s" }}>
                {s.label}
                {state==="active" && <span style={{ marginLeft:6 }}>
                  <span className="typing-dot" style={{ animationDelay:"0ms" }}/>
                  <span className="typing-dot" style={{ animationDelay:"150ms", marginLeft:3 }}/>
                  <span className="typing-dot" style={{ animationDelay:"300ms", marginLeft:3 }}/>
                </span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Before/After ─────────────────────────────────────────────────────────────

function BeforeAfter({ clause, revision }) {
  const [view, setView] = useState("before");
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#888" }}>
          {view==="before" ? "⚠ Original clause" : "✓ Suggested revision"}
        </span>
        <div className="before-after-toggle">
          <button className={`ba-btn ${view==="before"?"active":""}`} onClick={()=>setView("before")}>Before</button>
          <button className={`ba-btn ${view==="after"?"active":""}`} onClick={()=>setView("after")}>After</button>
        </div>
      </div>
      {view==="before"
        ? <div className="clause-box fade-in">"{clause}"</div>
        : <div className="revision-box fade-in"><span style={{ fontWeight:700, color:"#2E7D46", marginRight:4 }}>Suggested:</span>"{revision}"</div>
      }
    </div>
  );
}

// ─── Contract Chat ────────────────────────────────────────────────────────────

function ContractChat({ result }) {
  const [messages, setMessages] = useState([
    { role:"ai", text:`I've read your ${result.contractType}. Ask me anything about it — what clauses mean, whether something is normal, or what you should push back on.` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef();

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role:"user", text:msg }]);
    setLoading(true);
    try {
      const history = messages.map(m => ({ role:m.role==="ai"?"assistant":"user", content:m.text }));
      const response = await fetch("/api/chat", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          messages:[...history, { role:"user", content:msg }],
          systemPrompt: CHAT_SYSTEM(result.summary, result.contractType, result.risks||[]),
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role:"ai", text:data.reply }]);
    } catch(err) {
      setMessages(prev => [...prev, { role:"ai", text:"Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background:"#FDFAF5", border:"1.5px solid #E0DAC8", borderRadius:20, overflow:"hidden" }}>
      <div style={{ borderBottom:"1.5px solid #E0DAC8", padding:"16px 20px", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:34, height:34, background:"#F5C842", border:"1.5px solid #1a1a1a", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"2px 2px 0 #1a1a1a", flexShrink:0 }}>
          <ChatIcon />
        </div>
        <div>
          <div style={{ fontFamily:"'Lora',serif", fontWeight:700, fontSize:15 }}>Ask about your contract</div>
          <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, color:"#888" }}>AI assistant — not a substitute for legal advice</div>
        </div>
      </div>
      <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:12, minHeight:200, maxHeight:300, overflowY:"auto" }}>
        {messages.map((m,i) => <div key={i} className={m.role==="user"?"chat-bubble-user":"chat-bubble-ai"}>{m.text}</div>)}
        {loading && (
          <div className="chat-bubble-ai" style={{ display:"flex", gap:4, alignItems:"center" }}>
            <span className="typing-dot" style={{ animationDelay:"0ms" }}/>
            <span className="typing-dot" style={{ animationDelay:"150ms" }}/>
            <span className="typing-dot" style={{ animationDelay:"300ms" }}/>
          </div>
        )}
        <div ref={chatEndRef}/>
      </div>
      {messages.length <= 1 && (
        <div style={{ padding:"0 20px 12px", display:"flex", gap:8, flexWrap:"wrap" }}>
          {["Is this contract fair?","What's the biggest risk?","Can I negotiate the non-compete?","What happens if I breach this?"].map((q,i) => (
            <button key={i} className="chip-question" onClick={()=>sendMessage(q)}>{q}</button>
          ))}
        </div>
      )}
      <div style={{ borderTop:"1.5px solid #E0DAC8", padding:"12px 16px", display:"flex", gap:10, alignItems:"center" }}>
        <input className="chat-input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),sendMessage())} placeholder="Ask anything about this contract..." disabled={loading} />
        <button onClick={()=>sendMessage()} disabled={!input.trim()||loading} style={{ width:40, height:40, borderRadius:"50%", border:"1.5px solid #1a1a1a", background:input.trim()&&!loading?"#1a1a1a":"#F0EDE6", color:input.trim()&&!loading?"#F7F4EE":"#aaa", display:"flex", alignItems:"center", justifyContent:"center", cursor:input.trim()&&!loading?"pointer":"default", transition:"all 0.15s", flexShrink:0 }}>
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav({ page, setPage, showBack, onBack }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav style={{ borderBottom:"1.5px solid #E0DAC8", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#F7F4EE", position:"sticky", top:0, zIndex:100 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }} onClick={()=>{ setPage("home"); setMobileOpen(false); }}>
        <div style={{ width:32, height:32, background:"#F5C842", border:"1.5px solid #1a1a1a", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"2px 2px 0 #1a1a1a" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <span style={{ fontFamily:"'Lora',serif", fontWeight:700, fontSize:18, letterSpacing:"-0.3px" }}>ContractLens</span>
      </div>

      {/* Desktop nav */}
      <div className="nav-desktop" style={{ display:"flex", gap:28, alignItems:"center" }}>
        <button className={`nav-link ${page==="how"?"active-nav":""}`} onClick={()=>setPage("how")}>How it works</button>
        <button className={`nav-link ${page==="pricing"?"active-nav":""}`} onClick={()=>setPage("pricing")}>Pricing</button>
        <button className={`nav-link ${page==="examples"?"active-nav":""}`} onClick={()=>setPage("examples")}>Examples</button>
        {showBack && <button className="sketch-btn-outline" onClick={onBack}>← New analysis</button>}
        {page!=="home" && !showBack && <button className="sketch-btn" style={{ padding:"9px 22px", fontSize:13 }} onClick={()=>setPage("home")}>Try it free →</button>}
      </div>

      {/* Mobile hamburger */}
      <button className="nav-mobile-menu" onClick={()=>setMobileOpen(!mobileOpen)}
        style={{ display:"none", background:"none", border:"1.5px solid #D4CEBC", borderRadius:8, padding:"6px 10px", cursor:"pointer", flexDirection:"column", gap:4 }}>
        {[0,1,2].map(i => <span key={i} style={{ width:20, height:2, background:"#1a1a1a", borderRadius:2, display:"block" }}/>)}
      </button>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#F7F4EE", borderBottom:"1.5px solid #E0DAC8", padding:"16px 24px", display:"flex", flexDirection:"column", gap:16, zIndex:99 }}>
          {[["How it works","how"],["Pricing","pricing"],["Examples","examples"]].map(([label,pg]) => (
            <button key={pg} className={`nav-link ${page===pg?"active-nav":""}`} onClick={()=>{ setPage(pg); setMobileOpen(false); }} style={{ fontSize:16, textAlign:"left" }}>{label}</button>
          ))}
          {showBack && <button className="sketch-btn-outline" onClick={()=>{ onBack(); setMobileOpen(false); }}>← New analysis</button>}
          {page!=="home" && !showBack && <button className="sketch-btn" style={{ textAlign:"center" }} onClick={()=>{ setPage("home"); setMobileOpen(false); }}>Try it free →</button>}
        </div>
      )}
    </nav>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({ setPage }) {
  return (
    <div style={{ borderTop:"1.5px solid #E0DAC8", background:"#F0EDE6" }}>
      <div className="grid-footer" style={{ maxWidth:960, margin:"0 auto", padding:"48px 24px 32px", display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:40 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <div style={{ width:28, height:28, background:"#F5C842", border:"1.5px solid #1a1a1a", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"2px 2px 0 #1a1a1a" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <span style={{ fontFamily:"'Lora',serif", fontWeight:700, fontSize:16 }}>ContractLens</span>
          </div>
          <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#888", lineHeight:1.7, maxWidth:240 }}>AI-powered contract risk analysis. Not a substitute for legal advice.</p>
        </div>
        {[
          { label:"Product", links:[["How it works","how"],["Pricing","pricing"],["Examples","examples"]] },
          { label:"Legal",   links:[["Privacy Policy","home"],["Terms of Service","home"],["Cookie Policy","home"]] },
          { label:"Company", links:[["About","home"],["Blog","home"],["Contact","home"]] },
        ].map(col => (
          <div key={col.label}>
            <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:12, textTransform:"uppercase", letterSpacing:1, color:"#888", marginBottom:12 }}>{col.label}</div>
            {col.links.map(([label,pg]) => (
              <div key={label} onClick={()=>setPage(pg)} style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#555", marginBottom:8, cursor:"pointer" }}
                onMouseOver={e=>e.target.style.color="#1a1a1a"} onMouseOut={e=>e.target.style.color="#555"}>{label}</div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop:"1px solid #E0DAC8", padding:"20px 24px", textAlign:"center" }}>
        <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, color:"#aaa" }}>© 2025 ContractLens. All rights reserved.</p>
      </div>
    </div>
  );
}

// ─── Score (inline, mobile-only) ─────────────────────────────────────────────

function ScoreInline({ result }) {
  const c = RISK_COLORS[result.overallRisk];
  return (
    <div className="score-inline" style={{ display:"none", alignItems:"center", gap:12, background:result.overallRisk==="high"?"#FFD6D4":result.overallRisk==="medium"?"#FEF6C8":"#D4F5DE", border:"1.5px solid #1a1a1a", borderRadius:14, padding:"12px 18px", marginBottom:20 }}>
      <div style={{ fontFamily:"'Lora',serif", fontSize:40, fontWeight:700, lineHeight:1 }}>{result.riskScore}</div>
      <div>
        <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#555" }}>risk score</div>
        <span className="risk-badge" style={{ background:c.light, color:c.text, border:`1.5px solid ${c.border}`, marginTop:4, display:"inline-flex" }}>● {result.overallRisk} risk</span>
      </div>
    </div>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeRisk, setActiveRisk] = useState(null);
  const [tab, setTab] = useState("risks");
  const [showChat, setShowChat] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [pendingResult, setPendingResult] = useState(null);
  const fileRef = useRef();
  const stepTimerRef = useRef([]);

  const handleFile = (f) => {
    if (!f) return;
    const allowed = ["application/pdf","image/jpeg","image/png","image/webp","image/gif"];
    if (!allowed.includes(f.type)) { setError("Please upload a PDF or image file (JPG, PNG, WebP, or PDF)."); return; }
    if (f.size > 20 * 1024 * 1024) { setError("File is too large. Please upload a file under 20MB."); return; }
    setFile(f); setResult(null); setError(null);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]);
  }, []);

  const startStepAnimation = () => {
    setLoadStep(0);
    let elapsed = 0;
    stepTimerRef.current.forEach(clearTimeout);
    stepTimerRef.current = [];
    ANALYSIS_STEPS.forEach((s,i) => {
      const t = setTimeout(()=>setLoadStep(i), elapsed);
      stepTimerRef.current.push(t);
      elapsed += s.duration;
    });
  };

  const runAnalysis = async () => {
    if (!file) return;
    setLoading(true); setError(null); setShowChat(false);
    startStepAnimation();
    try {
      const base64 = await new Promise((res,rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("Failed to read file"));
        r.readAsDataURL(file);
      });

      const response = await fetch("/api/analyze", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ fileData:base64, mediaType:file.type }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      return data;
    } catch(err) {
      throw err;
    } finally {
      stepTimerRef.current.forEach(clearTimeout);
      setLoading(false);
    }
  };

  const analyze = async () => {
    try {
      const data = await runAnalysis();
      // Show email capture before revealing results
      setPendingResult(data);
      setShowEmailModal(true);
    } catch(err) {
      setError(friendlyError(err.message));
    }
  };

  const revealResult = (data) => {
    setShowEmailModal(false);
    setResult(data);
    setPendingResult(null);
    setActiveRisk(data.risks?.[0]?.id || null);
    setTab("risks");
  };

  const reset = () => { setFile(null); setResult(null); setError(null); setShowChat(false); setPendingResult(null); };

  return (
    <div>
      {showEmailModal && pendingResult && (
        <EmailModal
          onSubmit={()=>revealResult(pendingResult)}
          onSkip={()=>revealResult(pendingResult)}
        />
      )}

      <div style={{ maxWidth:960, margin:"0 auto", padding:"0 24px" }}>

        {/* ── Upload ── */}
        {!result && !loading && (
          <div>
            <div className="page-pad" style={{ textAlign:"center", padding:"72px 0 56px" }}>
              <div className="wobble" style={{ marginBottom:20 }}><IllustrationDocument /></div>
              <h1 className="hero-title" style={{ fontFamily:"'Lora',serif", fontSize:46, fontWeight:700, lineHeight:1.15, letterSpacing:"-1px", marginBottom:8 }}>
                The contract analyser<br /><span style={{ fontStyle:"italic" }}>that protects you</span>
              </h1>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
                <ScribbleUnderline color="#F5C842" width={340} />
              </div>
              <p className="hero-sub" style={{ fontFamily:"'Nunito',sans-serif", fontSize:17, color:"#666", maxWidth:420, margin:"0 auto 36px", lineHeight:1.65, fontWeight:500 }}>
                Upload any contract — NDA, employment, lease, SaaS — and get a plain-English risk report in seconds.
              </p>

              <div
                className={`upload-zone ${dragOver?"drag":""}`}
                onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={onDrop}
                onClick={()=>fileRef.current?.click()}
                style={{ maxWidth:500, margin:"0 auto 20px", padding:"48px 32px" }}
              >
                <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])} />
                {file ? (
                  <div>
                    <div style={{ width:52, height:52, background:"#F5C842", border:"1.5px solid #1a1a1a", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", boxShadow:"3px 3px 0 #1a1a1a" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:15, marginBottom:4 }}>{file.name}</div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#888" }}>{(file.size/1024).toFixed(1)} KB · Click to change</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ margin:"0 auto 16px", width:56 }}><IllustrationMagnify /></div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:16, marginBottom:6 }}>Drop your contract here</div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#888" }}>PDF, JPG, PNG, WebP · up to 20MB</div>
                  </div>
                )}
              </div>

              {error && <div style={{ maxWidth:500, margin:"0 auto 16px" }}><ErrorBox message={error} onRetry={file ? analyze : null} /></div>}
              {file && !error && (
                <button className="sketch-btn" onClick={analyze} style={{ fontSize:16, padding:"14px 44px" }}>
                  Analyse contract →
                </button>
              )}
            </div>

            <div className="feature-cards grid-3col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, paddingBottom:80 }}>
              {[
                { color:"#F5C842", title:"Risk Detection",   body:"Flags one-sided clauses, unusual terms, and liability traps in plain English.", rot:"-1.5deg" },
                { color:"#A8D9FF", title:"Missing Clauses",  body:"Spots what's NOT in the contract — protections you should have but don't.", rot:"1deg" },
                { color:"#C8F5D0", title:"Negotiation Tips", body:"Specific, actionable suggestions to push back on before signing.", rot:"-0.5deg" },
              ].map(card => (
                <div key={card.title} className="sticky-card" style={{ background:card.color, transform:`rotate(${card.rot})` }}>
                  <div style={{ fontFamily:"'Lora',serif", fontWeight:700, fontSize:18, marginBottom:10 }}>{card.title}</div>
                  <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, color:"#333", lineHeight:1.6 }}>{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && <AnalysisLoader step={loadStep} />}

        {/* ── Results ── */}
        {result && (
          <div className="fade-up" style={{ paddingTop:40, paddingBottom:80 }}>

            <ResultDisclaimer />

            {/* Report header */}
            <div className="report-header" style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:24, alignItems:"start", marginBottom:32 }}>
              <div>
                <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{result.contractType}</div>
                <h2 style={{ fontFamily:"'Lora',serif", fontSize:34, fontWeight:700, lineHeight:1.2, marginBottom:6 }}>Your Risk Report</h2>
                <div style={{ marginBottom:16 }}><ScribbleUnderline color="#F5C842" width={180} /></div>
                <ScoreInline result={result} />
                <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:15, color:"#555", lineHeight:1.7, maxWidth:540, marginBottom:16 }}>{result.summary}</p>
                {result.parties?.length > 0 && (
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {result.parties.map((p,i) => (
                      <span key={i} style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, fontWeight:600, background:"#F0EDE6", border:"1.5px solid #D4CEBC", borderRadius:50, padding:"4px 14px" }}>{p}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="score-sticky sticky-card" style={{ background:result.overallRisk==="high"?"#FFD6D4":result.overallRisk==="medium"?"#FEF6C8":"#D4F5DE", width:150, textAlign:"center", padding:"24px 20px", transform:"rotate(1.5deg)" }}>
                <div style={{ fontFamily:"'Lora',serif", fontSize:52, fontWeight:700, lineHeight:1 }}>{result.riskScore}</div>
                <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#555", marginTop:4 }}>risk score</div>
                <div style={{ marginTop:10 }}>
                  <span className="risk-badge" style={{ background:RISK_COLORS[result.overallRisk].light, color:RISK_COLORS[result.overallRisk].text, border:`1.5px solid ${RISK_COLORS[result.overallRisk].border}` }}>
                    ● {result.overallRisk} risk
                  </span>
                </div>
              </div>
            </div>

            {/* Key dates */}
            {result.keyDates?.length > 0 && (
              <div className="dates-row" style={{ display:"flex", gap:10, marginBottom:28, flexWrap:"wrap" }}>
                {result.keyDates.map((d,i) => (
                  <div key={i} style={{ background:"#FDFAF5", border:"1.5px solid #E0DAC8", borderRadius:12, padding:"10px 16px", flexShrink:0 }}>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#888", marginBottom:3 }}>{d.label}</div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, fontWeight:600 }}>{d.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="tabs-row" style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
              {[["risks",`⚠ Risks (${result.risks?.length||0})`],["positives","✓ Positives"],["missing","○ Missing"],["tips","↗ Negotiate"]].map(([k,label]) => (
                <button key={k} className={`tab-pill ${tab===k?"active":""}`} onClick={()=>setTab(k)} style={{ flexShrink:0 }}>{label}</button>
              ))}
            </div>

            {/* Risks */}
            {tab==="risks" && (
              <div className="risk-panel" style={{ display:"grid", gridTemplateColumns:result.risks?.length>1?"260px 1fr":"1fr", gap:16 }}>
                {result.risks?.length > 1 && (
                  <div className="risk-sidebar" style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {result.risks.map(r => {
                      const c = RISK_COLORS[r.severity];
                      return (
                        <div key={r.id} className={`risk-card-side ${activeRisk===r.id?"active":""}`} onClick={()=>setActiveRisk(r.id)}>
                          <span className="risk-badge" style={{ background:c.light, color:c.text, border:`1px solid ${c.border}`, marginBottom:6, display:"inline-flex" }}>{r.severity}</span>
                          <div style={{ fontWeight:600, fontSize:13, lineHeight:1.35 }}>{r.title}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div>
                  {result.risks?.filter(r=>result.risks.length===1||r.id===activeRisk).map(r => {
                    const c = RISK_COLORS[r.severity];
                    return (
                      <div key={r.id} style={{ background:c.light, border:`1.5px solid ${c.border}`, borderRadius:18, padding:28 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                          <IllustrationWarning />
                          <div>
                            <span className="risk-badge" style={{ background:"#fff", color:c.text, border:`1.5px solid ${c.border}`, marginBottom:4, display:"inline-flex" }}>{r.severity} risk</span>
                            <div style={{ fontFamily:"'Lora',serif", fontSize:18, fontWeight:700 }}>{r.title}</div>
                          </div>
                        </div>
                        <BeforeAfter clause={r.clause} revision={r.suggestedRevision||"Consult an attorney for a fair revision of this clause."} />
                        <div className="detail-box" style={{ marginBottom:14 }}>
                          <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#888", marginBottom:8 }}>Why it's risky</div>
                          <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, color:"#333", lineHeight:1.7 }}>{r.explanation}</p>
                        </div>
                        <div style={{ background:"#F5C842", border:"1.5px solid #1a1a1a", borderRadius:12, padding:"14px 18px", boxShadow:"3px 3px 0 #1a1a1a" }}>
                          <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, marginBottom:6 }}>What to do</div>
                          <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, lineHeight:1.65 }}>{r.recommendation}</p>
                        </div>
                      </div>
                    );
                  })}
                  {(!result.risks||result.risks.length===0) && (
                    <div style={{ textAlign:"center", padding:48, background:"#EDF6F0", border:"1.5px solid #A8D9B8", borderRadius:18 }}>
                      <IllustrationCheck />
                      <div style={{ fontFamily:"'Lora',serif", fontSize:18, fontWeight:600, marginTop:16 }}>No significant risks found</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab==="positives" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {result.positives?.map((p,i) => (
                  <div key={i} style={{ display:"flex", gap:14, alignItems:"flex-start", background:"#EDF6F0", border:"1.5px solid #A8D9B8", borderRadius:14, padding:"16px 20px" }}>
                    <span style={{ color:"#2E7D46", fontSize:18, flexShrink:0 }}>✓</span>
                    <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, color:"#333", lineHeight:1.65 }}>{p}</span>
                  </div>
                ))}
                {(!result.positives||result.positives.length===0)&&<div style={{ fontFamily:"'Nunito',sans-serif", color:"#888", textAlign:"center", padding:40 }}>No notable positive clauses found.</div>}
              </div>
            )}

            {tab==="missing" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {result.missingClauses?.map((m,i) => (
                  <div key={i} style={{ display:"flex", gap:14, alignItems:"flex-start", background:"#FEF6E4", border:"1.5px solid #F5D998", borderRadius:14, padding:"16px 20px" }}>
                    <span style={{ color:"#E8900A", fontSize:16, flexShrink:0, marginTop:2 }}>○</span>
                    <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, color:"#333", lineHeight:1.65 }}>{m}</span>
                  </div>
                ))}
                {(!result.missingClauses||result.missingClauses.length===0)&&<div style={{ fontFamily:"'Nunito',sans-serif", color:"#888", textAlign:"center", padding:40 }}>No missing clauses identified.</div>}
              </div>
            )}

            {tab==="tips" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {result.negotiationTips?.map((t,i) => (
                  <div key={i} style={{ display:"flex", gap:16, alignItems:"flex-start", background:"#FDFAF5", border:"1.5px solid #E0DAC8", borderRadius:14, padding:"16px 20px" }}>
                    <span style={{ fontFamily:"'Lora',serif", fontStyle:"italic", fontWeight:700, fontSize:20, color:"#F5C842", WebkitTextStroke:"1px #1a1a1a", flexShrink:0 }}>{i+1}</span>
                    <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, color:"#333", lineHeight:1.65 }}>{t}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Chat */}
            <div style={{ marginTop:40 }}>
              {!showChat ? (
                <div style={{ textAlign:"center" }}>
                  <div style={{ background:"#FDFAF5", border:"1.5px solid #E0DAC8", borderRadius:18, padding:"28px 32px", display:"inline-flex", flexDirection:"column", alignItems:"center", gap:12, maxWidth:"100%" }}>
                    <div style={{ width:44, height:44, background:"#F5C842", border:"1.5px solid #1a1a1a", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"3px 3px 0 #1a1a1a" }}><ChatIcon /></div>
                    <div>
                      <div style={{ fontFamily:"'Lora',serif", fontSize:17, fontWeight:700, marginBottom:4 }}>Have questions about this contract?</div>
                      <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#888" }}>Ask our AI attorney assistant anything.</div>
                    </div>
                    <button className="sketch-btn-yellow" onClick={()=>setShowChat(true)} style={{ padding:"10px 28px", fontSize:14 }}>Ask about this contract →</button>
                  </div>
                </div>
              ) : (
                <div className="fade-up">
                  <div style={{ fontFamily:"'Lora',serif", fontSize:22, fontWeight:700, marginBottom:6 }}>Ask about your contract</div>
                  <div style={{ marginBottom:16 }}><ScribbleUnderline color="#F5C842" width={160} /></div>
                  <ContractChat result={result} />
                </div>
              )}
            </div>

            <div style={{ marginTop:28, textAlign:"center" }}>
              <button className="sketch-btn-outline" onClick={reset}>← Analyse another contract</button>
            </div>
          </div>
        )}
      </div>
      {!result && !loading && <Footer setPage={()=>{}} />}
    </div>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorksPage({ setPage }) {
  const steps = [
    { n:"01", icon:<IllustrationUpload size={48}/>, color:"#F5C842", title:"Upload your contract", body:"Drag and drop any PDF, photo, or image of your contract. We support NDAs, employment agreements, leases, SaaS terms, freelance agreements, and more." },
    { n:"02", icon:<IllustrationMagnify/>, color:"#A8D9FF", title:"AI reads every clause", body:"Our AI reads the entire document, understanding context, intent, and legal language. It cross-references contract patterns to spot problems and one-sided terms." },
    { n:"03", icon:<IllustrationShield size={48}/>, color:"#C8F5D0", title:"Get your risk report", body:"Within seconds you receive a full breakdown: severity-rated risks, before/after clause rewrites, what's missing, and what to do about it." },
    { n:"04", icon:<IllustrationPen size={48}/>, color:"#FFD6F5", title:"Chat & negotiate", body:"Ask our AI attorney follow-up questions, then use your report to push back on unfair clauses and sign only when you're fully informed." },
  ];
  return (
    <div className="fade-up">
      <div style={{ maxWidth:760, margin:"0 auto", padding:"64px 24px 80px" }}>
        <div style={{ textAlign:"center", marginBottom:72 }}>
          <div className="wobble" style={{ marginBottom:20 }}><IllustrationShield size={80}/></div>
          <h1 style={{ fontFamily:"'Lora',serif", fontSize:42, fontWeight:700, lineHeight:1.15, letterSpacing:"-0.8px", marginBottom:8 }}>How ContractLens<br /><span style={{ fontStyle:"italic" }}>works</span></h1>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}><ScribbleUnderline color="#F5C842" width={260} /></div>
          <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:16, color:"#666", maxWidth:440, margin:"0 auto", lineHeight:1.65 }}>From upload to insight in under 30 seconds.</p>
        </div>
        <div style={{ marginBottom:64 }}>
          {steps.map((s,i) => (
            <div key={s.n} style={{ display:"flex", gap:28, marginBottom:40, position:"relative" }}>
              {i < steps.length-1 && <div className="step-line"/>}
              <div style={{ flexShrink:0, width:48, height:48, background:s.color, border:"1.5px solid #1a1a1a", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"3px 3px 0 #1a1a1a", fontFamily:"'Lora',serif", fontWeight:700, fontSize:14 }}>{s.n}</div>
              <div style={{ flex:1, paddingTop:6 }}>
                <div style={{ marginBottom:10 }}>{s.icon}</div>
                <h3 style={{ fontFamily:"'Lora',serif", fontSize:22, fontWeight:700, marginBottom:8 }}>{s.title}</h3>
                <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:15, color:"#555", lineHeight:1.7 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign:"center", background:"#F5C842", border:"1.5px solid #1a1a1a", borderRadius:20, padding:"48px 32px", boxShadow:"6px 6px 0 #1a1a1a" }}>
          <div className="wobble" style={{ marginBottom:16 }}><IllustrationDocument /></div>
          <h2 style={{ fontFamily:"'Lora',serif", fontSize:28, fontWeight:700, marginBottom:12 }}>Ready to protect yourself?</h2>
          <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:15, color:"#555", marginBottom:24, lineHeight:1.6 }}>Upload your first contract free. No account needed.</p>
          <button className="sketch-btn" onClick={()=>setPage("home")} style={{ fontSize:16, padding:"14px 44px" }}>Analyse a contract →</button>
        </div>
      </div>
      <Footer setPage={setPage} />
    </div>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function PricingPage({ setPage }) {
  const plans = [
    { name:"Free", price:"$0", period:"forever", featured:false, desc:"For individuals who occasionally need to check a contract.", features:["3 analyses per month","PDF & image upload","Risk score & summary","Before/after clause viewer","AI contract chat"], cta:"Get started free" },
    { name:"Pro", price:"$19", period:"per month", featured:true, desc:"For freelancers and self-employed professionals.", features:["Unlimited analyses","Everything in Free","Missing clause detection","Negotiation tips","Export to PDF","Priority processing"], cta:"Start 7-day free trial" },
    { name:"Team", price:"$49", period:"per month", featured:false, desc:"For small teams reviewing contracts together.", features:["Everything in Pro","Up to 5 members","Shared history","Team dashboard","API access (beta)"], cta:"Start free trial" },
  ];
  const faqs = [
    { q:"Is this a substitute for a lawyer?", a:"No. ContractLens is a first-pass tool to help you understand what you're signing. For high-stakes contracts, always consult a qualified attorney." },
    { q:"What file types do you support?", a:"PDF, JPG, PNG, and WebP. Photos of printed contracts work too." },
    { q:"Is my contract data private?", a:"Yes. Documents are processed securely and never stored or used to train AI models." },
    { q:"Can I cancel anytime?", a:"Absolutely. No contracts, no commitments. Cancel in one click." },
  ];
  return (
    <div className="fade-up">
      <div style={{ maxWidth:960, margin:"0 auto", padding:"64px 24px 80px" }}>
        <div style={{ textAlign:"center", marginBottom:60 }}>
          <h1 style={{ fontFamily:"'Lora',serif", fontSize:42, fontWeight:700, lineHeight:1.15, letterSpacing:"-0.8px", marginBottom:8 }}>Simple, honest<br /><span style={{ fontStyle:"italic" }}>pricing</span></h1>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}><ScribbleUnderline color="#F5C842" width={220} /></div>
          <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:16, color:"#666", maxWidth:400, margin:"0 auto", lineHeight:1.65 }}>Start free, upgrade when you need more.</p>
        </div>
        <div className="grid-pricing" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:20, marginBottom:72, alignItems:"start" }}>
          {plans.map(plan => (
            <div key={plan.name} className="pricing-card" style={{ background:plan.featured?"#1a1a1a":"#FDFAF5", color:plan.featured?"#F7F4EE":"#1a1a1a", border:plan.featured?"1.5px solid #1a1a1a":"1.5px solid #E0DAC8", boxShadow:plan.featured?"6px 6px 0 #F5C842":"none" }}>
              {plan.featured && <div style={{ background:"#F5C842", color:"#1a1a1a", fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, padding:"4px 12px", borderRadius:50, display:"inline-block", marginBottom:16, border:"1px solid #1a1a1a" }}>Most Popular</div>}
              <div style={{ fontFamily:"'Lora',serif", fontSize:22, fontWeight:700, marginBottom:4 }}>{plan.name}</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:6 }}>
                <span style={{ fontFamily:"'Lora',serif", fontSize:40, fontWeight:700 }}>{plan.price}</span>
                <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:plan.featured?"#aaa":"#888" }}>/{plan.period}</span>
              </div>
              <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:plan.featured?"#bbb":"#666", marginBottom:24, lineHeight:1.6 }}>{plan.desc}</p>
              <div style={{ marginBottom:28 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10 }}>
                    <span style={{ color:plan.featured?"#F5C842":"#2E7D46", fontSize:15, flexShrink:0 }}>✓</span>
                    <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, color:plan.featured?"#ddd":"#444", lineHeight:1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={()=>setPage("home")} style={{ width:"100%", padding:"12px", borderRadius:50, border:plan.featured?"2px solid #F5C842":"1.5px solid #1a1a1a", background:plan.featured?"#F5C842":"#1a1a1a", color:plan.featured?"#1a1a1a":"#F7F4EE", fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:14, cursor:"pointer", transition:"all 0.15s" }}>{plan.cta}</button>
            </div>
          ))}
        </div>
        <div style={{ maxWidth:640, margin:"0 auto" }}>
          <h2 style={{ fontFamily:"'Lora',serif", fontSize:28, fontWeight:700, marginBottom:6, textAlign:"center" }}>Frequently asked questions</h2>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:36 }}><ScribbleUnderline color="#F5C842" width={200} /></div>
          {faqs.map((faq,i) => (
            <div key={i} style={{ borderBottom:"1.5px solid #E0DAC8", padding:"20px 0" }}>
              <div style={{ fontFamily:"'Lora',serif", fontSize:17, fontWeight:600, marginBottom:8 }}>{faq.q}</div>
              <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, color:"#666", lineHeight:1.7 }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
      <Footer setPage={setPage} />
    </div>
  );
}

// ─── Examples ─────────────────────────────────────────────────────────────────

function ExamplesPage({ setPage }) {
  const [active, setActive] = useState(0);
  const examples = [
    { type:"NDA", color:"#F5C842", rot:"-1deg", title:"Mutual NDA — Tech Startup", summary:"A non-disclosure agreement between a SaaS startup and a potential enterprise client. Appears mutual but contains several one-sided clauses.", riskScore:72, overallRisk:"high",
      risks:[{ severity:"high", title:"One-way Confidential Information", clause:"'Confidential Information' shall mean any information disclosed by Company to Recipient...", explanation:"The definition only protects Company's information. Your disclosures as Recipient are not protected.", recommendation:"Request a symmetrical definition protecting both parties.", suggestedRevision:"'Confidential Information' means any information disclosed by either Party to the other, whether orally or in writing, that is designated confidential or reasonably should be understood to be confidential." }],
      positives:["Carve-out for publicly available information","Proper jurisdiction clause"],
      missing:["No data destruction clause on termination"],
      tips:["Make the definition mutual","Negotiate survival period to 2 years"],
    },
    { type:"Employment", color:"#A8D9FF", rot:"1deg", title:"Full-time Employment — Marketing", summary:"Employment agreement for a marketing manager. Contains a broad IP clause that could claim your personal projects.", riskScore:58, overallRisk:"medium",
      risks:[{ severity:"high", title:"Broad IP ownership clause", clause:"Any inventions or creative works created by Employee during employment shall be the sole property of Employer.", explanation:"'During employment' with no restriction could claim personal projects done outside office hours.", recommendation:"Negotiate to limit this to work done during working hours using company resources.", suggestedRevision:"Any inventions created by Employee during working hours, using Company resources, and directly related to Employee's role shall belong to Employer. Personal work on own time without Company resources is excluded." }],
      positives:["Clear salary structure","28 days PTO specified"],
      missing:["No remote work policy","No equipment clause"],
      tips:["Get IP limited to company time and resources","Define 'competitor' narrowly in non-compete"],
    },
    { type:"Freelance", color:"#C8F5D0", rot:"-0.5deg", title:"Freelance Design Contract", summary:"Project-based contract for a UI/UX designer. Generally fair but missing key payment protections.", riskScore:34, overallRisk:"low",
      risks:[{ severity:"medium", title:"No kill fee clause", clause:"[No clause found]", explanation:"No kill fee means if the client cancels mid-project, you have no right to compensation for work completed.", recommendation:"Add a kill fee of 25–50% of remaining value if client cancels.", suggestedRevision:"If Client terminates this Agreement after work has commenced, Client shall pay a kill fee of 50% of the remaining contract value plus full payment for all work completed to date, within 14 days." }],
      positives:["IP transfers only upon full payment","Revisions limited to 3 rounds"],
      missing:["No kill fee","No late payment interest"],
      tips:["Add a kill fee clause","Add 1.5% monthly interest on late payments"],
    },
  ];
  const ex = examples[active];
  const c = RISK_COLORS[ex.overallRisk];
  return (
    <div className="fade-up">
      <div style={{ maxWidth:960, margin:"0 auto", padding:"64px 24px 80px" }}>
        <div style={{ textAlign:"center", marginBottom:52 }}>
          <div className="wobble" style={{ marginBottom:20 }}><IllustrationStar size={72}/></div>
          <h1 style={{ fontFamily:"'Lora',serif", fontSize:42, fontWeight:700, lineHeight:1.15, letterSpacing:"-0.8px", marginBottom:8 }}>Example analyses</h1>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}><ScribbleUnderline color="#F5C842" width={200} /></div>
          <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:16, color:"#666", maxWidth:440, margin:"0 auto", lineHeight:1.65 }}>See how ContractLens reads real contract types, including before/after clause rewrites.</p>
        </div>
        <div className="grid-3col" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:40 }}>
          {examples.map((e,i) => (
            <div key={i} className="example-card" onClick={()=>setActive(i)} style={{ borderColor:active===i?"#1a1a1a":"#E0DAC8", boxShadow:active===i?"4px 4px 0 #1a1a1a":"none", transform:active===i?"translateY(-2px)":"none" }}>
              <div className="sticky-card" style={{ background:e.color, padding:"6px 14px", transform:`rotate(${e.rot})`, display:"inline-block", marginBottom:12, fontSize:12, fontFamily:"'Nunito',sans-serif", fontWeight:700 }}>{e.type}</div>
              <div style={{ fontFamily:"'Lora',serif", fontSize:15, fontWeight:600, lineHeight:1.35 }}>{e.title}</div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10 }}>
                <span style={{ fontFamily:"'Lora',serif", fontWeight:700, fontSize:22 }}>{e.riskScore}</span>
                <span className="risk-badge" style={{ background:RISK_COLORS[e.overallRisk].light, color:RISK_COLORS[e.overallRisk].text, border:`1px solid ${RISK_COLORS[e.overallRisk].border}` }}>● {e.overallRisk}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background:"#FDFAF5", border:"1.5px solid #E0DAC8", borderRadius:20, padding:36 }}>
          <div className="report-header" style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:16, alignItems:"start", marginBottom:28 }}>
            <div>
              <div style={{ marginBottom:8 }}><span className="sticky-card" style={{ background:ex.color, padding:"5px 14px", transform:`rotate(${ex.rot})`, display:"inline-block", fontSize:12, fontFamily:"'Nunito',sans-serif", fontWeight:700 }}>{ex.type}</span></div>
              <h2 style={{ fontFamily:"'Lora',serif", fontSize:24, fontWeight:700, marginBottom:8 }}>{ex.title}</h2>
              <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:14, color:"#666", lineHeight:1.7 }}>{ex.summary}</p>
            </div>
            <div className="sticky-card score-sticky" style={{ background:ex.overallRisk==="high"?"#FFD6D4":ex.overallRisk==="medium"?"#FEF6C8":"#D4F5DE", width:130, textAlign:"center", padding:"20px 16px", transform:"rotate(1.5deg)", flexShrink:0 }}>
              <div style={{ fontFamily:"'Lora',serif", fontSize:44, fontWeight:700, lineHeight:1 }}>{ex.riskScore}</div>
              <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#555", marginTop:4 }}>risk score</div>
              <div style={{ marginTop:8 }}><span className="risk-badge" style={{ background:c.light, color:c.text, border:`1.5px solid ${c.border}`, fontSize:10 }}>● {ex.overallRisk}</span></div>
            </div>
          </div>
          {ex.risks.map((r,i) => {
            const rc = RISK_COLORS[r.severity];
            return (
              <div key={i} style={{ background:rc.light, border:`1.5px solid ${rc.border}`, borderRadius:14, padding:20, marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <span className="risk-badge" style={{ background:"#fff", color:rc.text, border:`1.5px solid ${rc.border}` }}>{r.severity} risk</span>
                  <span style={{ fontFamily:"'Lora',serif", fontWeight:600, fontSize:15 }}>{r.title}</span>
                </div>
                <BeforeAfter clause={r.clause} revision={r.suggestedRevision} />
                <p style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#555", lineHeight:1.6, marginBottom:10 }}>{r.explanation}</p>
                <div style={{ background:"#F5C842", border:"1.5px solid #1a1a1a", borderRadius:10, padding:"10px 14px", boxShadow:"2px 2px 0 #1a1a1a" }}>
                  <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, fontWeight:700 }}>What to do: </span>
                  <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:13 }}>{r.recommendation}</span>
                </div>
              </div>
            );
          })}
          <div className="grid-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}>
            <div>
              <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#888", marginBottom:10 }}>✓ Positives</div>
              {ex.positives.map((p,i) => <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}><span style={{ color:"#2E7D46" }}>✓</span><span style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#444" }}>{p}</span></div>)}
            </div>
            <div>
              <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"#888", marginBottom:10 }}>○ Missing</div>
              {ex.missing.map((m,i) => <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}><span style={{ color:"#E8900A" }}>○</span><span style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#444" }}>{m}</span></div>)}
            </div>
          </div>
          <div style={{ textAlign:"center" }}>
            <button className="sketch-btn-yellow" onClick={()=>setPage("home")}>Analyse your own contract →</button>
          </div>
        </div>
      </div>
      <Footer setPage={setPage} />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("home");
  return (
    <div style={{ minHeight:"100vh", background:"#F7F4EE", color:"#1a1a1a", fontFamily:"'Lora',Georgia,serif" }}>
      <style>{GLOBAL_CSS}</style>
      <DisclaimerBanner />
      <Nav page={page} setPage={setPage} showBack={false} />
      {page==="home"     && <HomePage    setPage={setPage} />}
      {page==="how"      && <HowItWorksPage setPage={setPage} />}
      {page==="pricing"  && <PricingPage    setPage={setPage} />}
      {page==="examples" && <ExamplesPage   setPage={setPage} />}
    </div>
  );
}
