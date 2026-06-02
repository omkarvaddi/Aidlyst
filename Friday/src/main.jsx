import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  Brain,
  Clock,
  Command,
  Cpu,
  FileText,
  Gauge,
  Layers,
  Lock,
  Mic,
  MicOff,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
  Zap,
} from 'lucide-react';
import './styles.css';

const HOT_MEMORY = {
  identity: 'Aidlyst is an affiliate-first health-product discovery, comparison, and referral platform for trusted home-health deals.',
  posture: 'Aidlyst should help people compare and route to trusted partners without pretending to be a doctor, pharmacy, insurer, or medical device seller of record.',
  commerce: 'Launch as affiliate-only. Product cards and product pages should route to partner links. Direct selling is future-only after seller-of-record, tax, returns, insurance, labeling, and liability review.',
  compliance: 'No diagnosis, treatment guidance, prescriptions, emergency guidance, sensitive health intake, or unsupported FDA/medical claims.',
  tracking: 'aidlyst_product_link_click with product_id, product_title, product_vendor, product_url, outbound_url, placement, timestamp.',
  priorities: [
    'Apply affiliate-only Shopify theme hardening',
    'Remove cart, checkout, quick-add, accelerated checkout, and discount UX',
    'Confirm product metafield custom.affiliate_url on every outbound product',
    'Publish Terms, Privacy, Affiliate Disclosure, Medical Disclaimer, and Advertising Policy',
    'Set up analytics event testing for outbound partner clicks',
    'Review first 25-40 products for images, risk level, URLs, FDA notes, and last_checked',
    'Complete the desktop polish pass after checkout risk is controlled',
  ],
};

const AGENTS = [
  { id: 'friday', name: 'Friday', icon: Sparkles, role: 'Executive operator', module: 'Aidlyst', voice: { prefer: ['Daniel', 'George', 'Ryan', 'Google UK English Male'], lang: 'en-GB', rate: 1.02, pitch: 0.82 }, style: 'calm, polished, dryly funny' },
  { id: 'arjun', name: 'Arjun', icon: Cpu, role: 'Engineering agent', module: 'Build', voice: { prefer: ['Microsoft Mark', 'Google US English'], lang: 'en-US', rate: 1.05, pitch: 0.92 }, style: 'direct, technical, zero fluff' },
  { id: 'maya', name: 'Maya', icon: Radio, role: 'Launch and marketing', module: 'Launch', voice: { prefer: ['Microsoft Zira', 'Samantha', 'Google US English'], lang: 'en-US', rate: 1.06, pitch: 1.05 }, style: 'sharp, brand-aware, practical' },
  { id: 'ava', name: 'Ava', icon: ShieldCheck, role: 'Compliance guard', module: 'Compliance', voice: { prefer: ['Microsoft Sonia', 'Hazel', 'Google UK English Female'], lang: 'en-GB', rate: 0.98, pitch: 0.98 }, style: 'measured, careful, risk-focused' },
  { id: 'marcus', name: 'Marcus', icon: Gauge, role: 'Finance and analytics', module: 'Analytics', voice: { prefer: ['Microsoft David', 'Alex', 'Google US English'], lang: 'en-US', rate: 1.0, pitch: 0.88 }, style: 'numbers-first, skeptical, useful' },
  { id: 'lena', name: 'Lena', icon: Brain, role: 'Brain and UX synthesis', module: 'Brain', voice: { prefer: ['Microsoft Jenny', 'Karen', 'Google US English'], lang: 'en-US', rate: 1.04, pitch: 1.02 }, style: 'clear, human, synthesis-heavy' },
];

const MODULES = [
  { name: 'Brain', icon: Brain, status: 'Vault search', agent: 'lena' },
  { name: 'Aidlyst', icon: Target, status: 'Asset mode', agent: 'friday' },
  { name: 'Build', icon: Cpu, status: 'Dev console', agent: 'arjun' },
  { name: 'Launch', icon: Radio, status: 'P0 tracking', agent: 'maya' },
  { name: 'Compliance', icon: ShieldCheck, status: 'Guardrails', agent: 'ava' },
  { name: 'Analytics', icon: Activity, status: 'Click events', agent: 'marcus' },
];

const QUICK_COMMANDS = [
  'What should I work on next?',
  'Use the brain and build the Aidlyst launch plan.',
  'Run a compliance scan.',
  'Create the affiliate-only build spec.',
  'Tell me what could break launch.',
  'Make this less AI and more founder-grade.',
];

const DEEP_TERMS = ['plan','strategy','build','spec','codex','legal','medical','compliance','launch','shopify','affiliate','develop','formulate','production','partner','finance','marketing','risk','policy','sales','copy','founder'];
const FAST_TERMS = ['what is','next step','status','quick','summarize','blockers','priority'];

function getAgent(id) {
  return AGENTS.find((agent) => agent.id === id) || AGENTS[0];
}

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
  if (!matches.length) return 'I am running on hot memory because the Obsidian vault is not loaded yet. That is enough for operating rules, but not enough for true brain-grounded strategy.';
  return matches.map((match) => `${match.name}: ${match.excerpt || 'Relevant Aidlyst brain note located.'}`).join('\n');
}

function agentOpener(agent, mode) {
  if (agent.id === 'ava') return mode === 'DEEP BRAIN' ? 'I checked this with the compliance lights on. Slightly less glamorous, much safer.' : 'Compliance read: nothing on fire yet, which is my preferred aesthetic.';
  if (agent.id === 'arjun') return mode === 'DEEP BRAIN' ? 'I looked at this like a build problem. The answer is not more features; it is fewer failure paths.' : 'Engineering read: tighten the path, then polish it.';
  if (agent.id === 'maya') return mode === 'DEEP BRAIN' ? 'Brand read: Aidlyst needs to feel trusted before it feels flashy. Flash can wait five minutes.' : 'Launch read: make the next action obvious.';
  if (agent.id === 'marcus') return mode === 'DEEP BRAIN' ? 'Numbers read: attribution first, vibes second. Annoying, but profitable.' : 'Analytics read: if we cannot track it, it did not happen.';
  if (agent.id === 'lena') return mode === 'DEEP BRAIN' ? 'Brain read: I pulled the relevant context and condensed the useful bits.' : 'Brain read: keep the interface human and the decision clean.';
  return mode === 'DEEP BRAIN' ? 'Understood. I ran the deeper pass and kept the theatrics just below billionaire-lab levels.' : 'Understood. Here is the clean version.';
}

function fastAnswer(query, agent) {
  const q = query.toLowerCase();
  const opener = agentOpener(agent, 'FAST OPS');

  if (q.includes('what is aidlyst') || q.includes('business model')) {
    return `${opener}\n\nAidlyst is an affiliate-first comparison and referral platform for home-health products. The useful version is simple: help someone find the right category, compare options, then send them to a trusted partner. Aidlyst should not pretend to diagnose, prescribe, or medically recommend anything. That is how lawsuits get invited to dinner.`;
  }

  if (q.includes('next') || q.includes('priority') || q.includes('blocker')) {
    return `${opener}\n\nYour next move is checkout hardening. Remove cart, checkout, quick-add, and anything that makes Aidlyst look like the seller of record. Once that is clean, publish the legal pages and test the outbound click event. Design polish comes after the risk surface is under control. Annoying order, correct order.`;
  }

  if (q.includes('track') || q.includes('analytics') || q.includes('click')) {
    return `${opener}\n\nTrack every outbound partner click as ${HOT_MEMORY.tracking}. Product cards and product pages should use the same event schema so you can actually compare performance later instead of performing advanced archaeology in analytics.`;
  }

  if (q.includes('avoid') || q.includes('compliance') || q.includes('medical')) {
    return `${opener}\n\nAvoid diagnosis, treatment advice, prescriptions, emergency guidance, sensitive health intake, and unsupported FDA or medical claims. Safer language is compare, learn, view partner, request info, and check with a qualified professional. It sounds less heroic, but it keeps the company alive.`;
  }

  return `${opener}\n\nKeep Aidlyst affiliate-first, compliance-safe, and partner-link driven. The highest leverage move is still affiliate-only Shopify hardening before launch polish.`;
}

function deepAnswer(query, matches, agent) {
  const q = query.toLowerCase();
  const brain = sourceSummary(matches);
  const opener = agentOpener(agent, 'DEEP BRAIN');

  if (q.includes('compliance') || q.includes('medical') || q.includes('avoid') || q.includes('risk')) {
    return `${opener}\n\nHere is the real boundary: Aidlyst can help people compare products and route to partners, but it cannot act like a doctor, pharmacist, insurer, or emergency support line. Keep the language in the world of shopping assistance, education, and partner referral.\n\nBrain context:\n${brain}\n\nMy recommendation is to install a copy guard inside the Aidlyst workflow. If copy says cure, treat, diagnose, prescribe, clinically proven, FDA approved without documentation, or safe for your condition, Friday should flag it before it ships. The humor level there should be zero. The margin for regulatory nonsense is also zero.\n\nThe next move is practical: publish the Medical Disclaimer and Affiliate Disclosure, QA the first batch of products, and keep all CTAs to View deal, Visit partner, or Request info.`;
  }

  if (q.includes('build') || q.includes('shopify') || q.includes('affiliate') || q.includes('spec') || q.includes('codex')) {
    return `${opener}\n\nTreat the build as a risk-control system first and a storefront second. Product cards should use custom.affiliate_url, emit ${HOT_MEMORY.tracking}, and never imply Aidlyst is selling the product unless that product has gone through seller-of-record review.\n\nBrain context:\n${brain}\n\nThe clean implementation is this: strip cart and checkout UI, remove quick-add and accelerated checkout, replace purchase language with partner language, and make every outbound click observable. Then add legal pages in the footer and run a product QA pass. Glamorous? No. Useful? Very. Billion-dollar companies are usually built on boring controls that nobody screenshots.`;
  }

  if (q.includes('launch') || q.includes('plan') || q.includes('strategy')) {
    return `${opener}\n\nThe Aidlyst launch plan should happen in this order: control the storefront, publish trust/legal surfaces, validate attribution, then polish the desktop experience. If we reverse that order, we get a beautiful site with a compliance leak. That is just a lawsuit wearing cologne.\n\nBrain context:\n${brain}\n\nToday I would harden affiliate-only mode, confirm every product has a partner URL, publish the legal pages, and test outbound click tracking. After that, focus on the high-end interface: cleaner hero alignment, tighter cards, stronger category pathways, and copy that feels helpful instead of medically overconfident.`;
  }

  if (q.includes('human') || q.includes('ai') || q.includes('copy')) {
    return `${opener}\n\nThe fastest way to make Aidlyst sound human is to stop announcing strategy and start sounding useful. Say: “Compare trusted home-health options and visit the partner when you are ready.” Do not say: “We revolutionize healthcare purchasing through optimized intelligence infrastructure.” That sentence should be placed in a museum for crimes against clarity.\n\nBrain context:\n${brain}\n\nWrite like a smart operator explaining the next step to a real person. Short sentences. Clear benefit. No fake certainty. No medical promises.`;
  }

  return `${opener}\n\nThe operating posture is clear: Aidlyst should be affiliate-first, compliance-safe, and brutally clear about what it does and does not do. It helps users compare and route. It does not diagnose, treat, prescribe, or sell complex medical devices through a casual checkout.\n\nBrain context:\n${brain}\n\nMy move would be to protect the business model first, then polish the product experience until it feels inevitable.`;
}

function answer(query, mode, matches, agent) {
  return mode === 'DEEP BRAIN' ? deepAnswer(query, matches, agent) : fastAnswer(query, agent);
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

function useVoices() {
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);
  return voices;
}

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function chooseVoice(agent, voices) {
  const preferred = agent.voice.prefer.map((name) => name.toLowerCase());
  return voices.find((voice) => preferred.some((name) => voice.name.toLowerCase().includes(name)))
    || voices.find((voice) => voice.lang === agent.voice.lang)
    || voices.find((voice) => voice.lang?.startsWith('en'))
    || null;
}

function speechPreview(text) {
  const trimmed = text.replace(/\n+/g, '. ').replace(/[*_`#]/g, '').trim();
  if (trimmed.length <= 360) return trimmed;
  return `${trimmed.slice(0, 340)}. Full briefing is on screen.`;
}

function speak(text, agent, voices) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(speechPreview(text));
  const voice = chooseVoice(agent, voices);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || agent.voice.lang;
  utterance.rate = agent.voice.rate;
  utterance.pitch = agent.voice.pitch;
  window.speechSynthesis.speak(utterance);
}

function ResponsePanel({ response, agent }) {
  const paragraphs = response.split('\n\n').filter(Boolean);
  return <div className="response-panel">{paragraphs.map((paragraph, index) => <div className="response-paragraph" key={`${paragraph}-${index}`}>{paragraph}</div>)}<div className="signature">{agent.name} · {agent.role}</div></div>;
}

function App() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('FAST OPS');
  const [status, setStatus] = useState('STANDING BY');
  const [response, setResponse] = useState('Friday online. Aidlyst command asset initialized. Select an agent, load the Obsidian brain, or give me a directive. I will try to keep the billionaire-lab energy tasteful.');
  const [notes, setNotes] = useState([]);
  const [sources, setSources] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeModule, setActiveModule] = useState('Aidlyst');
  const [activeAgentId, setActiveAgentId] = useState('friday');
  const { supported, listening, setListening, recognitionRef } = useSpeech();
  const voices = useVoices();
  const clock = useClock();
  const fileRef = useRef(null);
  const activeAgent = getAgent(activeAgentId);
  const AgentIcon = activeAgent.icon;

  const run = (text) => {
    const command = text.trim();
    if (!command) return;
    const nextMode = classify(command);
    const matches = scoreNotes(command, notes);
    const agent = getAgent(activeAgentId);
    setInput(command);
    setMode(nextMode);
    setSources(matches);
    setHistory((items) => [{ command, mode: nextMode, agent: agent.name, time: new Date().toLocaleTimeString() }, ...items].slice(0, 6));
    setStatus(nextMode === 'FAST OPS' ? `${agent.name.toUpperCase()} RESPONDING` : `${agent.name.toUpperCase()} THINKING`);
    setResponse(nextMode === 'FAST OPS' ? `${agent.name}: on it.` : `${agent.name}: checking the brain and tightening the answer.`);
    window.setTimeout(() => {
      const final = answer(command, nextMode, matches, agent);
      setResponse(final);
      setStatus('READY');
      speak(final, agent, voices);
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
    const message = loaded.length ? `Brain online. ${loaded.length} markdown notes loaded. Deep Brain mode is now grounded in your Aidlyst context. Lovely. The machine has been given reading material.` : 'No markdown files detected. Select the root folder of the Obsidian vault.';
    setResponse(message);
    speak(message, activeAgent, voices);
  };

  const activateModule = (module) => {
    setActiveModule(module.name);
    setActiveAgentId(module.agent);
    const agent = getAgent(module.agent);
    const message = `${agent.name} is now active for ${module.name}. ${agent.role} profile loaded.`;
    setResponse(message);
    speak(message, agent, voices);
  };

  const brainLoaded = notes.length > 0;
  const missionProgress = brainLoaded ? 'OBSIDIAN LINKED' : 'HOT MEMORY ONLY';

  return <main className="jarvis-shell">
    <div className="scanline" /><div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="hud-top glass-panel"><div className="asset-lockup"><div className="aidlyst-mark">A</div><div><span className="eyebrow">AIDLYST ASSET</span><strong>Friday Command Intelligence</strong></div></div><div className="hud-status-row"><span><Clock size={14} /> {clock}</span><span><Gauge size={14} /> {mode}</span><span><ShieldCheck size={14} /> SAFE MODE</span><span><Brain size={14} /> {missionProgress}</span></div></header>
    <aside className="left-rail glass-panel"><div className="section-label">COMMAND MODULES</div>{MODULES.map((module) => { const Icon = module.icon; return <button className={`module ${activeModule === module.name ? 'module-active' : ''}`} key={module.name} onClick={() => activateModule(module)}><Icon size={18} /><span>{module.name}</span><small>{module.status}</small></button>; })}<button className="brain-load" onClick={() => fileRef.current?.click()}><FileText size={17} /> Load Obsidian Brain</button><input ref={fileRef} type="file" multiple hidden onChange={(event) => loadBrain(event.target.files)} {...{ webkitdirectory: 'true', directory: 'true' }} /><div className="mini-card"><div className="mini-card-title"><Lock size={14} /> Operating Boundary</div><p>Affiliate-first. No medical advice. No checkout until seller-of-record review.</p></div></aside>
    <section className="command-core glass-panel"><div className="core-topline"><span className="status-pill"><Zap size={15} /> {status}</span><span className="status-pill muted-pill"><Radio size={15} /> VOICE {supported ? 'READY' : 'TEXT ONLY'}</span></div><div className={`holo-orb ${listening ? 'is-listening' : ''}`}><div className="ring ring-one" /><div className="ring ring-two" /><div className="ring ring-three" /><div className="axis axis-x" /><div className="axis axis-y" /><div className="orb-core"><AgentIcon size={58} /><span>{activeAgent.name}</span></div></div><div className="core-copy"><span className="eyebrow">{activeAgent.role}</span><h1>Aidlyst intelligence, online.</h1><p>{activeAgent.name} is active in {activeAgent.style} mode. Speak naturally; Friday will route the work and keep the answer useful.</p></div><div className="composer-wrap"><button className={`mic-button ${listening ? 'hot' : ''}`} onClick={listening ? stopVoice : startVoice}>{listening ? <MicOff size={24} /> : <Mic size={24} />}</button><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') run(input); }} placeholder={`Ask ${activeAgent.name} for a directive...`} /><button className="execute" onClick={() => run(input)}>Execute</button></div>{!supported && <p className="browser-note">Browser speech recognition unavailable. Use Chrome or Edge for voice mode.</p>}<div className="agent-strip">{AGENTS.map((agent) => { const Icon = agent.icon; return <button className={activeAgentId === agent.id ? 'agent-card active-agent' : 'agent-card'} key={agent.id} onClick={() => setActiveAgentId(agent.id)}><Icon size={16} /><strong>{agent.name}</strong><small>{agent.role}</small></button>; })}</div><div className="quick-grid">{QUICK_COMMANDS.map((command) => <button key={command} onClick={() => run(command)}><Command size={14} /> {command}</button>)}</div><ResponsePanel response={response} agent={activeAgent} /></section>
    <aside className="right-rail glass-panel"><div className="section-label">MISSION TELEMETRY</div><div className="agent-console"><AgentIcon size={22} /><div><strong>{activeAgent.name}</strong><span>{activeAgent.role}</span><small>Voice profile: {voices.length ? 'available browser voice selected' : 'loading browser voices'}</small></div></div><div className="metric-grid"><div className="metric"><span>P0</span><strong>Affiliate hardening</strong></div><div className="metric"><span>SAFE</span><strong>Medical boundary</strong></div><div className="metric"><span>{notes.length}</span><strong>Brain notes</strong></div><div className="metric"><span>{sources.length}</span><strong>Sources active</strong></div></div><div className="panel-block"><h3><Target size={16} /> Current Directives</h3>{HOT_MEMORY.priorities.slice(0, 6).map((priority, index) => <div className="directive" key={priority}><span>{index + 1}</span><p>{priority}</p></div>)}</div><div className="panel-block"><h3><Search size={16} /> Brain Sources</h3>{sources.length ? sources.map((source) => <div className="source-card" key={source.name}><strong>{source.name}</strong><small>confidence score {source.score}</small><p>{source.excerpt}</p></div>) : <p className="muted-text">Load the Obsidian vault or run a Deep Brain directive to surface context.</p>}</div><div className="panel-block"><h3><Terminal size={16} /> Command History</h3>{history.length ? history.map((item) => <div className="history-row" key={`${item.command}-${item.time}`}><small>{item.time} · {item.mode} · {item.agent}</small><span>{item.command}</span></div>) : <p className="muted-text">No directives executed yet.</p>}</div></aside>
    <footer className="hud-footer"><span><Activity size={14} /> SYSTEM: FRIDAY ONLINE</span><span><AlertTriangle size={14} /> COMPLIANCE GUARD ENABLED</span><span><Layers size={14} /> ACTIVE MODULE: {activeModule.toUpperCase()}</span></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
