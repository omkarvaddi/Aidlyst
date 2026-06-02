import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  Brain,
  Clock,
  Command,
  Cpu,
  FileText,
  FolderOpen,
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

const API = 'http://127.0.0.1:8788/api';

const HOT_MEMORY = {
  priorities: [
    'Affiliate-only Shopify hardening',
    'Remove cart, checkout, quick-add, accelerated checkout, and discount UX',
    'Confirm custom.affiliate_url for outbound products',
    'Publish Terms, Privacy, Affiliate Disclosure, Medical Disclaimer, and Advertising Policy',
    'Test aidlyst_product_link_click for every outbound partner click',
    'QA product cards, category routes, images, risk level, and retailer URLs',
  ],
};

const AGENTS = [
  { id: 'friday', name: 'Friday', icon: Sparkles, role: 'Executive operator', voice: { prefer: ['Daniel', 'George', 'Ryan', 'Google UK English Male'], lang: 'en-GB', rate: 1.02, pitch: 0.82 }, style: 'calm, polished, dryly funny' },
  { id: 'arjun', name: 'Arjun', icon: Cpu, role: 'Engineering agent', voice: { prefer: ['Microsoft Mark', 'Google US English'], lang: 'en-US', rate: 1.05, pitch: 0.92 }, style: 'direct, technical, zero fluff' },
  { id: 'maya', name: 'Maya', icon: Radio, role: 'Launch and marketing', voice: { prefer: ['Microsoft Zira', 'Samantha', 'Google US English'], lang: 'en-US', rate: 1.06, pitch: 1.05 }, style: 'sharp, brand-aware, practical' },
  { id: 'ava', name: 'Ava', icon: ShieldCheck, role: 'Compliance guard', voice: { prefer: ['Microsoft Sonia', 'Hazel', 'Google UK English Female'], lang: 'en-GB', rate: 0.98, pitch: 0.98 }, style: 'measured, careful, risk-focused' },
  { id: 'marcus', name: 'Marcus', icon: Gauge, role: 'Finance and analytics', voice: { prefer: ['Microsoft David', 'Alex', 'Google US English'], lang: 'en-US', rate: 1.0, pitch: 0.88 }, style: 'numbers-first, skeptical, useful' },
  { id: 'lena', name: 'Lena', icon: Brain, role: 'Brain and UX synthesis', voice: { prefer: ['Microsoft Jenny', 'Karen', 'Google US English'], lang: 'en-US', rate: 1.04, pitch: 1.02 }, style: 'clear, human, synthesis-heavy' },
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
  'Use the Obsidian brain and build the Aidlyst launch plan.',
  'Run a compliance scan on the Aidlyst model.',
  'Create the affiliate-only Shopify build spec.',
  'Tell me what could break launch.',
  'Make this sound less AI and more founder-grade.',
];

function getAgent(id) {
  return AGENTS.find((agent) => agent.id === id) || AGENTS[0];
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

function chooseVoice(agent, voices) {
  const preferred = agent.voice.prefer.map((name) => name.toLowerCase());
  return voices.find((voice) => preferred.some((name) => voice.name.toLowerCase().includes(name)))
    || voices.find((voice) => voice.lang === agent.voice.lang)
    || voices.find((voice) => voice.lang?.startsWith('en'))
    || null;
}

function speak(text, agent, voices) {
  if (!('speechSynthesis' in window)) return;
  const clean = text.replace(/\n+/g, '. ').replace(/[*_`#]/g, '').trim();
  const short = clean.length > 420 ? `${clean.slice(0, 390)}. Full briefing is on screen.` : clean;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(short);
  const voice = chooseVoice(agent, voices);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || agent.voice.lang;
  utterance.rate = agent.voice.rate;
  utterance.pitch = agent.voice.pitch;
  window.speechSynthesis.speak(utterance);
}

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Friday server request failed');
  return json;
}

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ResponsePanel({ response, agent }) {
  return <div className="response-panel">{response.split('\n\n').filter(Boolean).map((paragraph, index) => <div className="response-paragraph" key={`${paragraph}-${index}`}>{paragraph}</div>)}<div className="signature">{agent.name} · {agent.role}</div></div>;
}

function App() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('LOCAL');
  const [status, setStatus] = useState('STARTING');
  const [server, setServer] = useState(null);
  const [response, setResponse] = useState('Friday online. Local-first Aidlyst command center initialized. I can use hot memory now; connect the local server and OpenAI API key for full command behavior. Very dramatic, but also useful.');
  const [sources, setSources] = useState([]);
  const [history, setHistory] = useState([]);
  const [files, setFiles] = useState([]);
  const [activeModule, setActiveModule] = useState('Aidlyst');
  const [activeAgentId, setActiveAgentId] = useState('friday');
  const { supported, listening, setListening, recognitionRef } = useSpeech();
  const voices = useVoices();
  const clock = useClock();
  const activeAgent = getAgent(activeAgentId);
  const AgentIcon = activeAgent.icon;

  useEffect(() => {
    fetch(`${API}/health`).then((res) => res.json()).then((data) => {
      setServer(data);
      setStatus(data.openaiConfigured ? 'SERVER + AI ONLINE' : 'SERVER ONLINE · API KEY NEEDED');
    }).catch(() => {
      setStatus('LOCAL SERVER OFFLINE');
      setServer(null);
    });
  }, []);

  const run = async (text) => {
    const command = text.trim();
    if (!command) return;
    const agent = getAgent(activeAgentId);
    setInput(command);
    setMode('THINKING');
    setStatus(`${agent.name.toUpperCase()} ROUTING`);
    setResponse(`${agent.name}: On it. Checking the local brain first, then I’ll answer like a normal human and not a bullet-point machine.`);

    try {
      let brain = { sources: [] };
      try { brain = await api('/brain/search', { query: command, max: 6 }); } catch { brain = { sources: [] }; }
      setSources(brain.sources || []);
      const ai = await api('/ai/respond', { prompt: command, agent: agent.name, sources: brain.sources || [] });
      const final = ai.response || 'No response returned.';
      setResponse(final);
      setMode(ai.offline ? 'LOCAL FALLBACK' : 'CHATGPT + BRAIN');
      setStatus('READY');
      setHistory((items) => [{ command, mode: ai.offline ? 'LOCAL' : 'AI', agent: agent.name, time: new Date().toLocaleTimeString() }, ...items].slice(0, 7));
      speak(final, agent, voices);
    } catch (error) {
      const fallback = `${agent.name}: I tried to route that through the local server, but hit this: ${error.message}. Check that the server is running on 8788 and that your .env is configured. Tiny inconvenience. We continue.`;
      setResponse(fallback);
      setStatus('ACTION FAILED');
      speak(fallback, agent, voices);
    }
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

  const activateModule = (module) => {
    setActiveModule(module.name);
    setActiveAgentId(module.agent);
    const agent = getAgent(module.agent);
    const msg = `${agent.name} is now active for ${module.name}. ${agent.role} loaded. I will keep the theatrics tasteful.`;
    setResponse(msg);
    speak(msg, agent, voices);
  };

  const openApp = async (name) => {
    try {
      const result = await api('/local/app', { name });
      const msg = `${activeAgent.name}: ${result.app} launched locally. Assuming Windows cooperated, which is always a bold assumption.`;
      setResponse(msg);
      speak(msg, activeAgent, voices);
    } catch (error) {
      setResponse(`${activeAgent.name}: I could not launch ${name}. ${error.message}`);
    }
  };

  const listLocal = async () => {
    try {
      const result = await api('/local/list', { path: `${window.navigator.userAgent.includes('Windows') ? 'C:/Users/omkar/Desktop/Aidlyst' : '.'}` });
      setFiles(result.entries || []);
      setResponse(`${activeAgent.name}: I pulled the local Aidlyst folder listing. Nothing exploded. That is progress.`);
    } catch (error) {
      setResponse(`${activeAgent.name}: File listing failed. ${error.message}`);
    }
  };

  const brainState = server?.vaultConfigured ? 'VAULT CONFIGURED' : 'VAULT PATH NEEDED';
  const aiState = server?.openaiConfigured ? 'AI ONLINE' : 'API KEY NEEDED';

  return <main className="jarvis-shell">
    <div className="scanline" /><div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="hud-top glass-panel"><div className="asset-lockup"><div className="aidlyst-mark">A</div><div><span className="eyebrow">AIDLYST LOCAL COMMAND</span><strong>Friday Control System</strong></div></div><div className="hud-status-row"><span><Clock size={14} /> {clock}</span><span><Gauge size={14} /> {mode}</span><span><ShieldCheck size={14} /> SAFE ACTIONS</span><span><Brain size={14} /> {brainState}</span></div></header>
    <aside className="left-rail glass-panel"><div className="section-label">COMMAND MODULES</div>{MODULES.map((module) => { const Icon = module.icon; return <button className={`module ${activeModule === module.name ? 'module-active' : ''}`} key={module.name} onClick={() => activateModule(module)}><Icon size={18} /><span>{module.name}</span><small>{module.status}</small></button>; })}<div className="mini-card"><div className="mini-card-title"><Lock size={14} /> Local Safety</div><p>Apps and files open only through the local server allowlist. Dangerous command execution is not enabled. We are building a command center, not a self-destruct button.</p></div></aside>
    <section className="command-core glass-panel"><div className="core-topline"><span className="status-pill"><Zap size={15} /> {status}</span><span className="status-pill muted-pill"><Radio size={15} /> {aiState}</span></div><div className={`holo-orb ${listening ? 'is-listening' : ''}`}><div className="ring ring-one" /><div className="ring ring-two" /><div className="ring ring-three" /><div className="axis axis-x" /><div className="axis axis-y" /><div className="orb-core"><AgentIcon size={58} /><span>{activeAgent.name}</span></div></div><div className="core-copy"><span className="eyebrow">{activeAgent.role}</span><h1>Local Aidlyst control, online.</h1><p>Black-and-blue command interface, local server controls, Obsidian brain retrieval, and OpenAI API responses when configured.</p></div><div className="composer-wrap"><button className={`mic-button ${listening ? 'hot' : ''}`} onClick={listening ? stopVoice : startVoice}>{listening ? <MicOff size={24} /> : <Mic size={24} />}</button><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') run(input); }} placeholder={`Ask ${activeAgent.name} to route work, inspect Aidlyst, or brief the brain...`} /><button className="execute" onClick={() => run(input)}>Execute</button></div>{!supported && <p className="browser-note">Browser speech recognition unavailable. Use Chrome or Edge for voice mode.</p>}<div className="agent-strip">{AGENTS.map((agent) => { const Icon = agent.icon; return <button className={activeAgentId === agent.id ? 'agent-card active-agent' : 'agent-card'} key={agent.id} onClick={() => setActiveAgentId(agent.id)}><Icon size={16} /><strong>{agent.name}</strong><small>{agent.role}</small></button>; })}</div><div className="quick-grid">{QUICK_COMMANDS.map((command) => <button key={command} onClick={() => run(command)}><Command size={14} /> {command}</button>)}</div><ResponsePanel response={response} agent={activeAgent} /></section>
    <aside className="right-rail glass-panel"><div className="section-label">LOCAL CONTROLS</div><div className="agent-console"><AgentIcon size={22} /><div><strong>{activeAgent.name}</strong><span>{activeAgent.role}</span><small>{activeAgent.style}</small></div></div><div className="quick-grid local-grid"><button onClick={() => openApp('obsidian')}><Brain size={14} /> Open Obsidian</button><button onClick={() => openApp('vscode')}><Cpu size={14} /> Open VS Code</button><button onClick={() => openApp('edge')}><FolderOpen size={14} /> Open Edge</button><button onClick={listLocal}><FileText size={14} /> List Aidlyst Files</button></div><div className="metric-grid"><div className="metric"><span>{server ? 'ON' : 'OFF'}</span><strong>Local server</strong></div><div className="metric"><span>{server?.openaiConfigured ? 'ON' : 'KEY'}</span><strong>OpenAI</strong></div><div className="metric"><span>{sources.length}</span><strong>Brain sources</strong></div><div className="metric"><span>{files.length}</span><strong>Local files</strong></div></div><div className="panel-block"><h3><Target size={16} /> Aidlyst Directives</h3>{HOT_MEMORY.priorities.map((priority, index) => <div className="directive" key={priority}><span>{index + 1}</span><p>{priority}</p></div>)}</div><div className="panel-block"><h3><Search size={16} /> Brain Sources</h3>{sources.length ? sources.map((source) => <div className="source-card" key={source.name}><strong>{source.name}</strong><small>score {source.score}</small><p>{source.excerpt}</p></div>) : <p className="muted-text">Ask a Deep Brain question after configuring FRIDAY_OBSIDIAN_VAULT.</p>}</div><div className="panel-block"><h3><Terminal size={16} /> Local Files</h3>{files.length ? files.map((file) => <div className="history-row" key={file.name}><small>{file.type}</small><span>{file.name}</span></div>) : <p className="muted-text">Click “List Aidlyst Files” to inspect the local project folder.</p>}</div><div className="panel-block"><h3><Terminal size={16} /> Command History</h3>{history.length ? history.map((item) => <div className="history-row" key={`${item.command}-${item.time}`}><small>{item.time} · {item.mode} · {item.agent}</small><span>{item.command}</span></div>) : <p className="muted-text">No directives executed yet.</p>}</div></aside>
    <footer className="hud-footer"><span><Activity size={14} /> UI: 8787</span><span><AlertTriangle size={14} /> SERVER: 8788</span><span><Layers size={14} /> MODULE: {activeModule.toUpperCase()}</span></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
