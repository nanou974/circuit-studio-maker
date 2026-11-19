import {describe,expect,it,vi} from 'vitest';
import {buildRequest,draftToBuilder,generateModuleDraft,guessElectrical,ModuleDraftSchema,parsePinoutText} from '../src/aiModule';

describe('ai module drafts',()=>{
 const draft=ModuleDraftSchema.parse({name:'BME280',pins:[{label:'VCC',side:'left',electrical:'power-in',voltage:3.3},{label:'GND',side:'left',electrical:'ground'},{label:'SDA',side:'left'},{label:'SDA',side:'right'}]});
 it('lays pins out inside the board with unique ids',()=>{
  const l=draftToBuilder(draft);
  expect(new Set(l.pins.map(p=>p.id)).size).toBe(4);
  for(const p of l.pins){expect(Math.abs(p.localPosition![0])).toBeLessThanOrEqual(l.dimensions[0]/2);expect(Math.abs(p.localPosition![1])).toBeLessThanOrEqual(l.dimensions[1]/2)}
  expect(l.pins.find(p=>p.id==='GND')!.voltage).toBe(0);
 });
 it('grows the board for many pins',()=>{
  const d=ModuleDraftSchema.parse({name:'x',height:5,pins:Array.from({length:30},(_,i)=>({label:`P${i}`,side:'left'}))});
  expect(draftToBuilder(d).dimensions[1]).toBeGreaterThanOrEqual(29*2.54);
 });
 it('parses plain pinout text',()=>{
  const pins=parsePinoutText('1. VCC, left\n2) GND, right\n# c\nSDA');
  expect(pins.map(p=>[p.label,p.side])).toEqual([['VCC','left'],['GND','right'],['SDA','left']]);
  expect(guessElectrical('GND')).toBe('ground');
 });
 it('sends a plain JSON request (no forced tool) and parses the text reply',async()=>{
  const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({content:[{type:'text',text:'```json\n'+JSON.stringify({name:'M',pins:[{label:'A',side:'top'}]})+'\n```'}]}),{status:200}));
  const d=await generateModuleDraft({provider:'anthropic',apiKey:'k',description:'d',pinout:'',fetchImpl:fetchImpl as unknown as typeof fetch});
  expect(d.pins[0].label).toBe('A');
  const [,init]=fetchImpl.mock.calls[0] as unknown as [string,RequestInit];
  expect((init.headers as Record<string,string>)['x-api-key']).toBe('k');
  const req=buildRequest({apiKey:'k',description:'d',pinout:''}) as Record<string,unknown>;expect(req.tool_choice).toBeUndefined();expect(req.tools).toBeUndefined();
 });
 it('rejects bad responses and http errors',async()=>{
  const bad=async()=>new Response(JSON.stringify({content:[{type:'tool_use',input:{name:'M',pins:[]}}]}),{status:200});
  await expect(generateModuleDraft({provider:'anthropic',apiKey:'k',description:'d',pinout:'',fetchImpl:bad as unknown as typeof fetch})).rejects.toThrow(/invalid/);
  const err=async()=>new Response(JSON.stringify({error:{message:'bad key'}}),{status:401});
  await expect(generateModuleDraft({provider:'anthropic',apiKey:'k',description:'d',pinout:'',fetchImpl:err as unknown as typeof fetch})).rejects.toThrow(/401.*bad key/);
 });
 it('calls Gemini with a header key and inline image, tolerating fenced JSON',async()=>{
  const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'```json {"name":"HC-SR04","width":45,"pins":[{"label":"VCC","side":"bottom"}],"warnings":["size estimated"]} ```'}]}}]}),{status:200}));
  const d=await generateModuleDraft({provider:'gemini',apiKey:'g',description:'',pinout:'',image:{mediaType:'image/jpeg',base64:'AAA'},fetchImpl:fetchImpl as unknown as typeof fetch});
  expect(d.warnings).toEqual(['size estimated']);
  const [url,init]=fetchImpl.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).not.toContain('key=');expect((init.headers as Record<string,string>)['x-goog-api-key']).toBe('g');
  expect(String(init.body)).toContain('inline_data');
 });
 it('calls OpenRouter in chat-completions format',async()=>{
  const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'{"name":"X","pins":[{"label":"A","side":"left"}]}'}}]}),{status:200}));
  const d=await generateModuleDraft({provider:'openrouter',apiKey:'o',description:'x',pinout:'',fetchImpl:fetchImpl as unknown as typeof fetch});
  expect(d.name).toBe('X');
  const [url,init]=fetchImpl.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toContain('openrouter.ai');expect((init.headers as Record<string,string>).authorization).toBe('Bearer o');
 });
 it('explains rate limits',async()=>{
  const lim=async()=>new Response(JSON.stringify({error:{message:'quota'}}),{status:429});
  await expect(generateModuleDraft({provider:'gemini',apiKey:'g',description:'x',pinout:'',fetchImpl:lim as unknown as typeof fetch})).rejects.toThrow(/rate limit/);
 });
});
it('retries when the service is overloaded (503)',async()=>{
  vi.useFakeTimers();
  let n=0;
  const fetchImpl=vi.fn(async()=>++n<2?new Response(JSON.stringify({error:{message:'high demand'}}),{status:503}):new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({name:'M',pins:[{label:'A',side:'top'}]})}]}}]}),{status:200}));
  const p=generateModuleDraft({provider:'gemini',apiKey:'k',description:'d',pinout:'',fetchImpl:fetchImpl as unknown as typeof fetch});
  await vi.advanceTimersByTimeAsync(2100);
  expect((await p).pins[0].label).toBe('A');
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
});
it('converts mounting holes from top-left offsets to board-centred coordinates',()=>{
  const d=ModuleDraftSchema.parse({name:'TFT',width:98,height:56,pins:[{label:'A',side:'right'}],holes:[{fromLeft:5.99,fromTop:5.98,diameter:3.2},{fromLeft:98,fromTop:70,diameter:3}]});
  const l=draftToBuilder(d);
  expect(l.holes).toEqual([{x:-43.01,y:22.02,diameter:3.2}]);
});
it('clips over-long text instead of rejecting the draft',()=>{
  const long='x'.repeat(500);
  const d=ModuleDraftSchema.parse({name:'M',description:long,warnings:[long],pins:[{label:'A',side:'left',notes:long,functions:[long]}]});
  expect(d.warnings[0]).toHaveLength(240);
  expect(d.pins[0].notes).toHaveLength(240);
  expect(d.pins[0].functions?.[0]).toHaveLength(40);
  expect(d.description).toHaveLength(500);
});
it('keeps the corner radius, clamped to half the shortest side',()=>{
  const d=ModuleDraftSchema.parse({name:'M',width:20,height:12,pins:[{label:'A',side:'top'}],cornerRadius:30});
  expect(draftToBuilder(d).cornerRadius).toBe(6);
  expect(draftToBuilder(ModuleDraftSchema.parse({name:'M',pins:[{label:'A',side:'top'}]})).cornerRadius).toBe(0);
});

