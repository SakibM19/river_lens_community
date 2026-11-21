const R=require('./riverlens');
const iso=()=>new Date().toISOString();
async function runAnalysis(d,id,b64,stats){
  const cfg=R.config(); const base=[iso()]; let f;
  if(!cfg.provider){ const r=R.demoReport(stats); f={model:'demo-heuristic',mode:'demo',report:r,cat:r.primary_category,unc:'high',nr:1,ms:0,err:null,ok:true}; }
  else { try{ if(!process.env.RIVERLENS_MODEL&&cfg.provider==='gemini'){ try{const w=(await d.query(`SELECT model FROM findings WHERE mode='cloud' AND report_json IS NOT NULL ORDER BY id DESC LIMIT 1`))[0]; if(w&&w.model) cfg.model=w.model}catch(e){} }
         const x=await R.analyse(cfg,b64,'image/jpeg'); f={model:x.model,mode:'cloud',report:x.report,cat:x.report.primary_category,unc:x.report.uncertainty.level,nr:R.needsReview(x.report)?1:0,ms:x.run_ms,err:null,ok:true} }
         catch(e){ f={model:cfg.model,mode:'cloud',report:null,cat:null,unc:null,nr:1,ms:0,err:String(e.message||e).slice(0,600),ok:false} } }
  await d.query(`INSERT INTO findings(observation_id,created_at,model,mode,report_json,primary_category,uncertainty,needs_review,status,run_ms,error) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ai_draft',$9,$10)`,
    [id,iso(),f.model,f.mode,f.report?JSON.stringify(f.report):null,f.cat,f.unc,f.nr,f.ms,f.err]);
  await d.query(`UPDATE observations SET status=$1 WHERE id=$2`,[f.ok?'done':'failed',id]);
}
module.exports={runAnalysis};
