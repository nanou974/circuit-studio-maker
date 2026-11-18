import { useRef, useState } from 'react';
import { Sparkles, ImagePlus, X } from 'lucide-react';
import {
  AiModuleError, DEFAULT_PROVIDER, PROVIDERS, draftToBuilder, generateModuleDraft, parsePinoutText, prepareImage,
  type AiInput, type BuilderLayout, type ModuleDraft, type Provider,
} from './aiModule';

type Props = {
  onApply: (layout: BuilderLayout, meta: { name: string; category: string; description: string }) => void;
  currentName: string;
};

const PREF = 'c3d-ai-provider';
const keyName = (p: Provider) => `c3d-ai-key-${p}`;
const read = (s: Storage, k: string) => { try { return s.getItem(k) ?? ''; } catch { return ''; } };

export function AiAssistant({ onApply }: Props) {
  const [provider, setProvider] = useState<Provider>(() => { const p = read(localStorage, PREF) as Provider; return p in PROVIDERS ? p : DEFAULT_PROVIDER; });
  const [apiKey, setApiKey] = useState(() => read(sessionStorage, keyName(provider)) || read(localStorage, keyName(provider)));
  const [remember, setRemember] = useState(() => !!read(localStorage, keyName(provider)));
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [pinout, setPinout] = useState('');
  const [image, setImage] = useState<AiInput['image']>();
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [draft, setDraft] = useState<ModuleDraft>();
  const abort = useRef<AbortController | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const info = PROVIDERS[provider];

  const changeProvider = (p: Provider) => {
    setProvider(p);
    setModel('');
    setApiKey(read(sessionStorage, keyName(p)) || read(localStorage, keyName(p)));
    setRemember(!!read(localStorage, keyName(p)));
    try { localStorage.setItem(PREF, p); } catch { /* ignore */ }
  };
  const persistKey = () => {
    try {
      sessionStorage.removeItem(keyName(provider)); localStorage.removeItem(keyName(provider));
      if (apiKey.trim()) (remember ? localStorage : sessionStorage).setItem(keyName(provider), apiKey.trim());
    } catch { /* storage unavailable: key lives only in memory */ }
  };

  const pickImage = async (file?: File) => {
    if (!file) return;
    try {
      setImage(await prepareImage(file));
      setImageUrl(URL.createObjectURL(file));
      setStatus('');
    } catch (e) { setStatus(e instanceof Error ? e.message : 'Could not read the image.'); }
  };

  const apply = (d: ModuleDraft) => {
    onApply(draftToBuilder(d), { name: d.name, category: d.category, description: d.description });
    setWarnings(d.warnings);
  };

  const run = async () => {
    persistKey();
    abort.current?.abort();
    abort.current = new AbortController();
    setBusy(true); setStatus('Analysing…'); setWarnings([]);
    try {
      const d = await generateModuleDraft({ provider, apiKey, model, description, pinout, image, signal: abort.current.signal });
      apply(d);
      setDraft(d);
      setStatus(`Filled the workshop with ${d.pins.length} pins. Review name, size and pins before saving.`);
    } catch (e) {
      if ((e as Error).name === 'AbortError') setStatus('Cancelled.');
      else setStatus(e instanceof AiModuleError || e instanceof Error ? e.message : 'AI request failed.');
    } finally { setBusy(false); }
  };

  // No key / no network: build the PCB straight from a pasted pinout.
  const offline = () => {
    const pins = parsePinoutText(pinout);
    if (!pins.length) { setStatus('Paste one pin per line, e.g. "VCC, left".'); return; }
    apply({ name: 'Custom module', category: 'Modules', description, pins, warnings: [] });
    setStatus(`Created ${pins.length} pins from the text (no AI).`);
  };

  return (
    <div className="builder-section ai-assistant">
      <span className="section-title"><Sparkles size={13} /> AI ASSISTANT</span>
      <p className="help-copy">Add a photo, a description and/or a pinout. The AI proposes name, description, size and pins; you correct everything in the workshop before saving. The board is a procedural PCB, not a 3D scan.</p>
      <label className="builder-field">AI provider
        <select value={provider} onChange={e => changeProvider(e.target.value as Provider)}>
          {(Object.keys(PROVIDERS) as Provider[]).map(p => <option key={p} value={p}>{PROVIDERS[p].label}</option>)}
        </select>
      </label>
      <label className="builder-field">API key
        <input type="password" autoComplete="off" placeholder={info.keyHint} value={apiKey} onChange={e => setApiKey(e.target.value)} />
      </label>
      <p className="help-copy">{info.free ? 'Free, no card needed: ' : ''}<a href={info.keyUrl} target="_blank" rel="noreferrer">create a key</a>. It is sent only to the provider, straight from your browser, and never saved in projects or exports. Your image and text go to that service{provider === 'gemini' ? '; on the free tier Google may use them to improve its products' : ''}.</p>
      <label className="builder-field inline"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember key on this device</label>
      <label className="builder-field">Model <small>(optional)</small>
        <input value={model} placeholder={info.model} onChange={e => setModel(e.target.value)} />
      </label>
      <div className="ai-image">
        {imageUrl
          ? <div className="ai-thumb"><img src={imageUrl} alt="Reference" /><button className="icon-button small" aria-label="Remove image" onClick={() => { setImage(undefined); URL.revokeObjectURL(imageUrl); setImageUrl(''); }}><X size={13} /></button></div>
          : <button className="secondary-action" onClick={() => fileRef.current?.click()}><ImagePlus size={14} /> Add module photo</button>}
        <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={e => { void pickImage(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <label className="builder-field">Description / module name
        <textarea rows={3} placeholder="e.g. BME280 I2C temperature/pressure sensor breakout, 3.3 V" value={description} onChange={e => setDescription(e.target.value)} />
      </label>
      <label className="builder-field">Pinout (optional)
        <textarea rows={5} placeholder={'VCC, left\nGND, left\nSCL, left\nSDA, left'} value={pinout} onChange={e => setPinout(e.target.value)} />
      </label>
      <div className="ai-actions">
        <button className="primary-action" disabled={busy} onClick={run}><Sparkles size={14} /> {busy ? 'Working…' : draft ? 'Regenerate' : 'Generate with AI'}</button>
        {busy && <button className="secondary-action" onClick={() => abort.current?.abort()}>Cancel</button>}
        <button className="secondary-action" disabled={busy} onClick={offline}>Pins from text only</button>
      </div>
      {status && <p className="help-copy" role="status">{status}</p>}
      {warnings.length > 0 && <ul className="ai-warnings" role="note">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
    </div>
  );
}
