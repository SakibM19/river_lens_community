// Shared logic: prompt, schema validation, provider calls. Runs in Vercel serverless functions (Node 18+).
const CATEGORIES=['visible_litter','litter_accumulation','surface_foam_or_film','unusual_surface_appearance','no_visible_indicator','image_insufficient'];
const LEVELS=['low','medium','high'];
const LIMITS='This is a visual description of one photograph only. It is not a measurement of water quality, not a judgement about safety, and it does not identify the source of any pollution.';
const PROMPT=`You are helping community volunteers document VISIBLE conditions at a river, canal or pond from one photograph.
Describe only what can be seen. Never state or imply that the water is safe or unsafe, never name a pollution source, never give chemical or health claims.
Choose exactly one primary_category from: ${CATEGORIES.join(', ')}.
- visible_litter: individual items of rubbish visible on or in the water or bank.
- litter_accumulation: many items gathered together.
- surface_foam_or_film: foam, scum or a film on the water surface.
- unusual_surface_appearance: unusual colour or surface that you cannot classify further.
- no_visible_indicator: nothing of the above is visible.
- image_insufficient: the photo is too dark, blurry, far away or does not show water.
Reply with ONLY a JSON object with exactly these keys:
{"primary_category": one of the categories, "indicators": [short strings], "evidence_description": "short text of what is visible",
 "uncertainty": {"level": "low"|"medium"|"high", "reasons": [short strings]}, "needs_human_review": true|false,
 "suggested_followup": "neutral next step such as another photo or human review", "limitations_statement": "${LIMITS}"}
Set needs_human_review to true whenever you are unsure.`;

function validate(text){
  let t=String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const a=t.indexOf('{'),b=t.lastIndexOf('}'); if(a>=0&&b>a) t=t.slice(a,b+1);
  let r; try{ r=JSON.parse(t) }catch(e){ return {err:'Response is not valid JSON'} }
  const need=['primary_category','indicators','evidence_description','uncertainty','needs_human_review','suggested_followup','limitations_statement'];
  for(const k of need) if(!(k in r)) return {err:'Missing field: '+k};
  if(!CATEGORIES.includes(r.primary_category)) return {err:'Unknown category: '+r.primary_category};
  const u=r.uncertainty; if(!u||!LEVELS.includes(u.level)||!Array.isArray(u.reasons)) return {err:'Invalid uncertainty field'};
  if(!Array.isArray(r.indicators)||typeof r.needs_human_review!=='boolean') return {err:'Invalid indicators or review flag'};
  for(const k of ['evidence_description','suggested_followup','limitations_statement']) if(typeof r[k]!=='string') return {err:'Invalid text field: '+k};
  r.indicators=r.indicators.map(String).slice(0,12); r.uncertainty.reasons=r.uncertainty.reasons.map(String).slice(0,8);
  r.limitations_statement=LIMITS; // always the fixed statement
  return {report:r};
}
function config(env=process.env){
  const forced=env.RIVERLENS_PROVIDER;
  let provider=forced||(env.GEMINI_API_KEY?'gemini':env.ANTHROPIC_API_KEY?'anthropic':null);
  if(!provider) return {provider:null};
  const model=env.RIVERLENS_MODEL||(provider==='gemini'?'gemini-3.5-flash-lite':'claude-haiku-5-5');
  return {provider,model,
    key:provider==='gemini'?env.GEMINI_API_KEY:env.ANTHROPIC_API_KEY,
    base:provider==='gemini'?(env.GEMINI_BASE_URL||'https://generativelanguage.googleapis.com'):(env.ANTHROPIC_BASE_URL||'https://api.anthropic.com')};
}
async function callModel(cfg,b64,mime,ms=30000){
  const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),ms);
  try{
    if(cfg.provider==='gemini'){
      const go=async(gc)=>{const r=await fetch(`${cfg.base}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,{method:'POST',signal:ctl.signal,
        headers:{'Content-Type':'application/json','x-goog-api-key':cfg.key},
        body:JSON.stringify({contents:[{parts:[{text:PROMPT},{inline_data:{mime_type:mime,data:b64}}]}],generationConfig:gc})});
        const j=await r.json().catch(()=>({})); return {r,j}};
      const base={temperature:0,responseMimeType:'application/json',maxOutputTokens:1500};
      // ask for light "thinking" so the answer comes back fast; fall back if the model rejects the setting
      let {r,j}=await go({...base,thinkingConfig:{thinkingLevel:process.env.RIVERLENS_THINKING||'low'}});
      if(!r.ok&&r.status===400&&/think/i.test(JSON.stringify(j))) ({r,j}=await go(base));
      if(!r.ok) throw new Error('Provider error '+r.status+': '+JSON.stringify(j).slice(0,200));
      return (j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
    }
    if(cfg.provider==='anthropic'){
      const r=await fetch(`${cfg.base}/v1/messages`,{method:'POST',signal:ctl.signal,
        headers:{'Content-Type':'application/json','x-api-key':cfg.key,'anthropic-version':'2023-06-01'},
        body:JSON.stringify({model:cfg.model,max_tokens:900,temperature:0,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:mime,data:b64}},{type:'text',text:PROMPT}]}]})});
      const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error('Provider error '+r.status+': '+JSON.stringify(j).slice(0,200));
      return (j.content||[]).map(p=>p.text||'').join('');
    }
    throw new Error('Unknown provider');
  } finally { clearTimeout(to) }
}
// Ask Google which Gemini models this key can use, best candidates first (stable before preview, lite before full).
async function discover(cfg){
  const ctl=new AbortController(), to=setTimeout(()=>ctl.abort(),6000);
  try{const r=await fetch(`${cfg.base}/v1beta/models?pageSize=200`,{headers:{'x-goog-api-key':cfg.key},signal:ctl.signal}); const j=await r.json();
    const ok=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace('models/',''))
      .filter(n=>/^gemini-/.test(n)&&/flash/.test(n)&&!/(tts|image|embed|live|audio|robotics|computer|deprecated|exp)/.test(n));
    // newest generation first (2.x models are being closed to new keys, so they go last); lite before full within a generation
    const ver=n=>{const m=n.match(/gemini-(\d+(?:\.\d+)?)/);return m?parseFloat(m[1]):0};
    const rank=n=>(ver(n)<3?1000:0)+(/lite/.test(n)?0:100)-ver(n)*10+(/preview/.test(n)?3:0);
    return ok.sort((x,y)=>rank(x)-rank(y)||x.localeCompare(y))}
  finally{clearTimeout(to)}
}
// Tries the chosen model; if it times out, is unavailable or answers badly, tries up to two other models your key supports.
// Stays inside Vercel's 60 s limit.
async function analyse(cfg,b64,mime){
  const t0=Date.now(), BUDGET=54000, log=[]; let models=[cfg.model], discovered=false;
  const transient=e=>/Provider error (429|500|502|503|504)/.test(String(e.message||e));
  for(let i=0;i<models.length&&i<5;i++){
    const m=models[i];
    for(let attempt=0;attempt<2;attempt++){
      const left=BUDGET-(Date.now()-t0); if(left<6000) break;
      try{
        const text=await callModel({...cfg,model:m},b64,mime,Math.min(i===0?20000:14000,left)); const v=validate(text);
        if(v.report) return {report:v.report,model:m,provider:cfg.provider,run_ms:Date.now()-t0};
        log.push(m+': answer not in the expected format ('+v.err+')'); break;
      }catch(e){
        const msg=String(e.message||e); log.push(m+': '+msg.replace(/This operation was aborted/,'no answer in time').replace(/^Provider error (\d+): .*"message":"([^"]{0,90}).*$/,'error $1 ($2)').slice(0,160));
        if(transient(e)&&attempt===0&&BUDGET-(Date.now()-t0)>12000){ await new Promise(r=>setTimeout(r,1500)); continue }   // "high demand": one short retry
        break;
      }
    }
    if(!discovered&&cfg.provider==='gemini'){ discovered=true; try{models=[cfg.model,...(await discover(cfg)).filter(x=>x!==cfg.model)]}catch(e){log.push('model list unavailable')} }
  }
  throw new Error(log.join(' | ')||'No time left to analyse.');
}
module.exports={CATEGORIES,LIMITS,PROMPT,validate,config,analyse};
// ---- additions for the shared-database edition
function needsReview(r){return !!(r.needs_human_review||r.primary_category==='image_insufficient'||r.uncertainty.level!=='low')}
function demoReport(stats){
  const s=stats||{},insuff=s.mean<35||s.mean>235||s.edge<2;
  const reasons=['DEMO MODE: no AI model was used, so this is NOT an analysis of what the photo shows.']; if(insuff) reasons.push('Basic image check: the photo looks too dark, too bright or too flat.');
  return {primary_category:insuff?'image_insufficient':'no_visible_indicator',indicators:[],evidence_description:'Demo mode placeholder. The site owner needs to add an AI key to get a real description.',
    uncertainty:{level:'high',reasons},needs_human_review:true,suggested_followup:'A person should review this record.',limitations_statement:LIMITS};
}
module.exports.needsReview=needsReview; module.exports.demoReport=demoReport;
