// Diagnostic: lists models the key can use and times a tiny text call. Needs the access code (login first).
const {config}=require('../lib/riverlens'); const A=require('../lib/auth');
module.exports=A.guard(async(req,res)=>{
  const okCode=process.env.ACCESS_CODE&&A.same(req.query.code||'',process.env.ACCESS_CODE);
  if(!okCode&&!(req.user&&req.user.role==='reviewer')) return res.status(403).json({error:'Reviewers only. Log in as a reviewer, or add ?code=<ACCESS_CODE> to the address.'});
  const c=config(); const out={provider:c.provider,model:c.model}; res.setHeader('Cache-Control','no-store');
  if(c.provider!=='gemini'){return res.status(200).json({...out,note:'Gemini is not the active provider.'})}
  const H={'x-goog-api-key':c.key,'Content-Type':'application/json'};
  try{
    const r=await fetch(`${c.base}/v1beta/models?pageSize=200`,{headers:H}); const j=await r.json();
    out.list_status=r.status;
    out.models=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace('models/','')).filter(n=>/gemini/.test(n));
    if(!r.ok) out.list_error=JSON.stringify(j).slice(0,200);
  }catch(e){out.list_error=String(e.message||e)}
  const ping=async(label,model)=>{const t=Date.now(),ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),25000);
    try{const r=await fetch(`${c.base}/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:H,signal:ctl.signal,
      body:JSON.stringify({contents:[{parts:[{text:'Reply with the single word: ok'}]}],generationConfig:{temperature:0,maxOutputTokens:20}})});
      const j=await r.json().catch(()=>({})); out[label]={model,status:r.status,ms:Date.now()-t,reply:r.ok?(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').slice(0,40):JSON.stringify(j).slice(0,160)}}
    catch(e){out[label]={model,error:String(e.message||e),ms:Date.now()-t}} finally{clearTimeout(to)}};
  await ping('text_ping_current',c.model);
  const alt=(out.models||[]).find(n=>/flash-lite/.test(n)&&!/preview|exp/.test(n))||(out.models||[]).find(n=>/flash-lite/.test(n));
  if(alt&&alt!==c.model) await ping('text_ping_lite',alt);
  res.status(200).json(out);
});
