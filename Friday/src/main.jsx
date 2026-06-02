import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, Brain, CheckCircle2, Clock, Command, Cpu, FileText, Gauge, Layers, Lock, Mic, MicOff, Radio, Search, ShieldCheck, Sparkles, Target, Terminal, Zap } from 'lucide-react';
import './styles.css';

const HOT_MEMORY = {
  identity: 'Aidlyst is an affiliate-first health-product discovery, comparison, and referral platform for trusted home-health deals.',
  mission: 'Make home-health product shopping easier, safer, and more transparent by combining comparison content, retailer options, price/availability checks, compliance-aware product notes, and outbound partner links.',
  posture: 'Aidlyst should be useful without becoming a healthcare provider. Compare, summarize, route, and disclose. Do not diagnose, prescribe, treat, or imply medical appropriateness.',
  commerce: 'Launch as affiliate-only. Product cards and pages should route to partner links. Direct selling is future-only after seller-of-record, returns, tax, insurance, labeling, and product-liability review.',
  compliance: 'No medical advice, diagnosis, treatment claims, prescription handling, emergency guidance, sensitive health-data collection, or unsupported FDA/medical claims.',
  ctas: ['Find better prices faster', 'View deal', 'Visit partner', 'Request info'],
  tracking: 'aidlyst_product_link_click with product_id, product_title, product_vendor, product_url, outbound_url, placement, timestamp.',
  priorities: [
    'Verify aidlyst.com domain contact information',
    'Apply affiliate-only Shopify theme hardening',
    'Remove cart, checkout, quick-add, accelerated checkout, and discount UX',
    'Confirm product metafield custom.affiliate_url on every outbound product',
    'Replace all MediDeal remnants with Aidlyst',
    'Publish Terms, Privacy, Affiliate Disclosure, Medical Disclaimer, and Advertising Policy',
    'Set up analytics event testing for outbound partner clicks',
    'Review first 25-40 products for images, risk level, URLs, FDA notes, and last_checked',
    'Complete desktop polish pass for hero, cards, category grid, and readability',
  ],
  prohibited: [
    'Do not sell prescription-only products through a simple cart',
    'Do not ask for diagnoses, prescriptions, insurance information, clinician notes, or treatment plans',
    'Do not say Aidlyst vets medical products unless a documented vetting protocol exists',
    'Do not imply sponsored placement means medical endorsement, safety, effectiveness, or best choice',
  ],
};

const MODULES = [
  { name: 'Brain', icon: Brain, status: 'Vault search' },
  { name: 'Aidlyst', icon: Target, status: 'Asset mode' },
  { name: 'Build', icon: Cpu, status: 'Dev console' },
  { name: 'Launch', icon: Radio, status: 'P0 tracking' },
  { name: 'Compliance', icon: ShieldCheck, status: 'Guardrails' },
  { name: 'Analytics', icon: Activity, status: 'Click events' },
];

const QUICK_COMMANDS = [
  'What should I work on next?',
  'Use the brain and build the Aidlyst launch plan.',
  'Run a compliance scan.',
  'Create the affiliate-only build spec.',
  'What should we avoid saying?',
  'Show launch blockers.',
];

const DEEP_TERMS = ['plan','strategy','build','spec','codex','legal','medical','compliance','launch','shopify','affiliate','develop','formulate','production','partner','finance','marketing','risk','policy','sales'];
const FAST_TERMS = ['what is','next step','status','quick','summarize','blockers','priority'];

function classify(text) {
  const q = text.toLowerCase();
  if (DEEP_TERMS.some((term) => q.includes(term))) return 'DEEP BRAIN';
  if (FAST_TERMS.some((term) => q.includes(term)) || q.length < 92) return 'FAST OPS';
  return 'FAST OPS';
}

function tokenize(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
}

function scoreNotes(query, notes) {
  const terms = [...new Set(tokenize(query))];
  return notes.map((note) => {
    const haystack = `${note.name} ${note.content}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    const firstHit = terms.map((term) => haystack.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
    const start = Math.max(0, firstHit - 120);
    const excerpt = note.content.slice(start, start + 360).replace(/\s+/g, ' ').trim();
    return { ...note, score, excerpt };
  }).filter((note) => note.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
}

function sourceSummary(matches) {
  if (!matches.length) return 'No local Obsidian source file is loaded yet. Load the vault to move from hot-memory mode into full brain-grounded mode.';
  return matches.map((match) => `- ${match.name}: ${match.excerpt || 'Relevant Aidlyst brain note located.'}`).join('\n');
}

function fastAnswer(query) {
  const q = query.toLowerCase();
  if (q.includes('what is aidlyst') || q.includes('business model')) {
    return `Executive Summary\n${HOT_MEMORY.identity}\n\nOperating Model\n${HOT_MEMORY.commerce}\n\nCurrent Directive\nKeep the experience affiliate-first: ${HOT_MEMORY.ctas.slice(1, 3).join(' / ')}.`;
  }
  if (q.includes('next') || q.includes('priority') || q.includes('blocker')) {
    return `Priority Stack\n1. ${HOT_MEMORY.priorities[1]}\n2. ${HOT_MEMORY.priorities[2]}\n3. ${HOT_MEMORY.priorities[5]}\n\nFriday Assessment\nThe highest leverage move is checkout hardening before more design polish.`;
  }
  if (q.includes('track') || q.includes('posthog') || q.includes('analytics') || q.includes('click')) {
    return `Analytics Directive\nTrack outbound partner intent with: ${HOT_MEMORY.tracking}\n\nOperational Rule\nEvery product card and product page partner CTA should emit the same event schema.`;
  }
  if (q.includes('avoid') || q.includes('compliance') || q.includes('medical')) {
    return `Compliance Guard\n${HOT_MEMORY.compliance}\n\nUnsafe Language\n${HOT_MEMORY.prohibited.map((item) => `- ${item}`).join('\n')}`;
  }
  return `On it. Aidlyst remains affiliate-first, compliance-safe, and partner-link driven. Next best action: ${HOT_MEMORY.priorities[1]}.`;
}

function deepAnswer(query, matches) {
  const q = query.toLowerCase();
  const brain = sourceSummary(matches);
  if (q.includes('compliance') || q.includes('medical') || q.includes('avoid') || q.includes('risk')) {
    return `Executive Summary\nAidlyst should operate as a comparison/referral platform, not a healthcare provider. The site can compare product options and route users to partners, but it must not recommend treatment or imply clinical appropriateness.\n\nWhat The Brain Says\n${brain}\n\nCompliance Guardrails\n- ${HOT_MEMORY.compliance}\n- Do not collect sensitive medical details unless a future workflow explicitly adds privacy notice, consent, and legal review.\n- Sponsored or affiliate placement must not imply product quality, medical safety, effectiveness, or endorsement.\n\nRecommended Action\nInstall a copy guard in Friday that flags diagnosis, cure, treatment, prescription, emergency, and unsupported FDA language before it reaches Aidlyst pages.\n\nNext 3 Moves\n1. Publish Medical Disclaimer and Affiliate Disclosure.\n2. QA the first 25-40 products for risk level and claim language.\n3. Keep product CTA language to View deal / Visit partner / Request info.`;
  }
  if (q.includes('build') || q.includes('shopify') || q.includes('affiliate') || q.includes('spec') || q.includes('codex')) {
    return `Executive Summary\nThe build should harden Aidlyst into affiliate-only mode and make Friday the command system that monitors that operating model.\n\nWhat The Brain Says\n${brain}\n\nImplementation Spec\n1. Product cards use custom.affiliate_url when present and emit ${HOT_MEMORY.tracking}\n2. Product pages show View deal / Visit partner, not Add to cart.\n3. Cart, checkout, quick-add, accelerated checkout, discount UX, and cart mutation endpoints are blocked or hidden.\n4. Footer legal pages are visible before public launch.\n5. Friday tracks active mission context: launch blockers, compliance risks, product QA, and next build task.\n\nRisk Controls\n- Keep direct sales disabled unless Aidlyst becomes seller of record for a specific reviewed low-risk product.\n- Do not route complex devices into a simple checkout flow. Use referral/lead-gen with consent instead.\n\nNext 3 Moves\n1. Run storefront QA for all checkout surfaces.\n2. Confirm every published product has an approved partner URL.\n3. Test aidlyst_product_link_click in dataLayer/GA4/PostHog.`;
  }
  if (q.includes('launch') || q.includes('plan') || q.includes('strategy')) {
    return `Executive Summary\nFriday recommends a compliance-first launch sequence: harden affiliate commerce, clean brand/legal surfaces, validate analytics, then publish.\n\nWhat The Brain Says\n${brain}\n\nLaunch Plan\nPhase 1 - Control The Storefront\n- Remove checkout/cart language and prevent purchase-path confusion.\n- Confirm product CTA language: ${HOT_MEMORY.ctas.join(' / ')}.\n\nPhase 2 - Legal + Trust\n- Publish Terms, Privacy, Affiliate Disclosure, Medical Disclaimer, and Advertising Policy.\n- Avoid claims that Aidlyst medically vets or recommends products.\n\nPhase 3 - Attribution\n- Standardize ${HOT_MEMORY.tracking}\n- Verify events from product cards and product pages.\n\nPhase 4 - Product QA\n- Review first 25-40 products for images, retailer URLs, risk level, FDA notes, and last_checked.\n\nNext 3 Moves\n1. Finish affiliate-only hardening.\n2. Publish legal/footer pages.\n3. Run desktop polish only after the core operating risk is controlled.`;
  }
  return `Executive Summary\nFriday is treating this as an Aidlyst asset. The correct operating posture is affiliate-first, compliance-safe, and focused on trusted home-health comparison.\n\nWhat The Brain Says\n${brain}\n\nRecommended Action\nRoute this request through Deep Brain mode when it affects product claims, launch strategy, revenue model, legal posture, or Shopify implementation.\n\nNext 3 Moves\n1. Protect the affiliate-only model.\n2. Confirm legal and disclosure pages.\n3. Ship only polished, risk-reviewed product experiences.`;
}

function answer(query, mode, matches) {
  return mode === 'DEEP BRAIN' ? deepAnswer(query, matches) : fastAnswer(query);
}

function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    setSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
  }, []);
  return { supported, listening, setListening, recognitionRef };
}

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const short = text.length > 230 ? `${text.slice(0, 210)}. Full tactical output is on screen.` : text;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(short.replace(/\n+/g, '. '));
  utterance.rate = 1.04;
  utterance.pitch = 0.86;
  window.speechSynthesis.speak(utterance);
}

function ResponsePanel({ response }) {
  const lines = response.split('\n');
  return <div className="response-panel">{lines.map((line, index) => {
    if (!line.trim()) return <div className="response-gap" key={`gap-${index}`} />;
    const isTitle = !line.startsWith('-') && !/^\d+\./.test(line) && line.length < 44;
    return <div className={isTitle ? 'response-title' : 'response-line'} key={`${line}-${index}`}>{line}</div>;
  })}</div>;
}

function App() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('FAST OPS');
  const [status, setStatus] = useState('STANDING BY');
  const [response, setResponse] = useState('Friday online. Aidlyst command asset initialized. Load the Obsidian brain, speak a command, or select a mission chip.');
  const [notes, setNotes] = useState([]);
  const [sources, setSources] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeModule, setActiveModule] = useState('Aidlyst');
  const { supported, listening, setListening, recognitionRef } = useSpeech();
  const clock = useClock();
  const fileRef = useRef(null);

  const run = (text) => {
    const command = text.trim();
    if (!command) return;
    const nextMode = classify(command);
    const matches = scoreNotes(command, notes);
    setInput(command);
    setMode(nextMode);
    setSources(matches);
    setHistory((items) => [{ command, mode: nextMode, time: new Date().toLocaleTimeString() }, ...items].slice(0, 6));
    setStatus(nextMode === 'FAST OPS' ? 'RESPONDING' : 'BRAIN SCAN ACTIVE');
    setResponse(nextMode === 'FAST OPS' ? 'On it.' : 'Checking the Aidlyst brain. Formulating a tactical answer.');
    window.setTimeout(() => {
      const final = answer(command, nextMode, matches);
      setResponse(final);
      setStatus('READY');
      speak(final);
    }, nextMode === 'FAST OPS' ? 220 : 900);
  };

  const startVoice = () => {
    if (!supported || !recognitionRef.current) return;
    const recognition = recognitionRef.current;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(' ');
      setInput(transcript);
      if (event.results[event.results.length - 1].isFinal) run(transcript);
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    setStatus('LISTENING');
    recognition.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const loadBrain = async (files) => {
    const markdownFiles = [...files].filter((file) => file.name.toLowerCase().endsWith('.md'));
    const loaded = [];
    for (const file of markdownFiles.slice(0, 400)) loaded.push({ name: file.webkitRelativePath || file.name, content: await file.text() });
    setNotes(loaded);
    setStatus(`${loaded.length} BRAIN NOTES LOADED`);
    setResponse(loaded.length ? `Brain Online\n${loaded.length} markdown notes loaded from the selected vault. Friday will now ground Deep Brain answers in local Aidlyst context.` : 'No markdown files detected. Select the root folder of the Obsidian vault.');
  };

  const brainLoaded = notes.length > 0;
  const missionProgress = brainLoaded ? 'OBSIDIAN LINKED' : 'HOT MEMORY ONLY';

  return <main className="jarvis-shell">
    <div className="scanline" /><div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="hud-top glass-panel"><div className="asset-lockup"><div className="aidlyst-mark">A</div><div><span className="eyebrow">AIDLYST ASSET</span><strong>Friday Command Intelligence</strong></div></div><div className="hud-status-row"><span><Clock size={14} /> {clock}</span><span><Gauge size={14} /> {mode}</span><span><ShieldCheck size={14} /> SAFE MODE</span><span><Brain size={14} /> {missionProgress}</span></div></header>
    <aside className="left-rail glass-panel"><div className="section-label">COMMAND MODULES</div>{MODULES.map(({ name, icon: Icon, status: moduleStatus }) => <button className={`module ${activeModule === name ? 'module-active' : ''}`} key={name} onClick={() => setActiveModule(name)}><Icon size={18} /><span>{name}</span><small>{moduleStatus}</small></button>)}<button className="brain-load" onClick={() => fileRef.current?.click()}><FileText size={17} /> Load Obsidian Brain</button><input ref={fileRef} type="file" multiple hidden onChange={(event) => loadBrain(event.target.files)} {...{ webkitdirectory: 'true', directory: 'true' }} /><div className="mini-card"><div className="mini-card-title"><Lock size={14} /> Operating Boundary</div><p>Affiliate-first. No medical advice. No checkout until seller-of-record review.</p></div></aside>
    <section className="command-core glass-panel"><div className="core-topline"><span className="status-pill"><Zap size={15} /> {status}</span><span className="status-pill muted-pill"><Radio size={15} /> VOICE {supported ? 'READY' : 'TEXT ONLY'}</span></div><div className={`holo-orb ${listening ? 'is-listening' : ''}`}><div className="ring ring-one" /><div className="ring ring-two" /><div className="ring ring-three" /><div className="axis axis-x" /><div className="axis axis-y" /><div className="orb-core"><Sparkles size={58} /><span>FRIDAY</span></div></div><div className="core-copy"><span className="eyebrow">FOUNDER COMMAND CENTER</span><h1>Aidlyst intelligence, online.</h1><p>Fast voice ops for tactical answers. Deep Brain mode for launch planning, affiliate commerce, compliance guardrails, and product strategy.</p></div><div className="composer-wrap"><button className={`mic-button ${listening ? 'hot' : ''}`} onClick={listening ? stopVoice : startVoice}>{listening ? <MicOff size={24} /> : <Mic size={24} />}</button><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') run(input); }} placeholder="Speak or type a directive for Friday..." /><button className="execute" onClick={() => run(input)}>Execute</button></div>{!supported && <p className="browser-note">Browser speech recognition unavailable. Use Chrome or Edge for voice mode.</p>}<div className="quick-grid">{QUICK_COMMANDS.map((command) => <button key={command} onClick={() => run(command)}><Command size={14} /> {command}</button>)}</div><ResponsePanel response={response} /></section>
    <aside className="right-rail glass-panel"><div className="section-label">MISSION TELEMETRY</div><div className="metric-grid"><div className="metric"><span>P0</span><strong>Affiliate hardening</strong></div><div className="metric"><span>SAFE</span><strong>Medical boundary</strong></div><div className="metric"><span>{notes.length}</span><strong>Brain notes</strong></div><div className="metric"><span>{sources.length}</span><strong>Sources active</strong></div></div><div className="panel-block"><h3><Target size={16} /> Current Directives</h3>{HOT_MEMORY.priorities.slice(0, 6).map((priority, index) => <div className="directive" key={priority}><span>{index + 1}</span><p>{priority}</p></div>)}</div><div className="panel-block"><h3><Search size={16} /> Brain Sources</h3>{sources.length ? sources.map((source) => <div className="source-card" key={source.name}><strong>{source.name}</strong><small>confidence score {source.score}</small><p>{source.excerpt}</p></div>) : <p className="muted-text">Load the Obsidian vault or run a Deep Brain directive to surface context.</p>}</div><div className="panel-block"><h3><Terminal size={16} /> Command History</h3>{history.length ? history.map((item) => <div className="history-row" key={`${item.command}-${item.time}`}><small>{item.time} · {item.mode}</small><span>{item.command}</span></div>) : <p className="muted-text">No directives executed yet.</p>}</div></aside>
    <footer className="hud-footer"><span><Activity size={14} /> SYSTEM: FRIDAY ONLINE</span><span><AlertTriangle size={14} /> COMPLIANCE GUARD ENABLED</span><span><Layers size={14} /> ACTIVE MODULE: {activeModule.toUpperCase()}</span></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
