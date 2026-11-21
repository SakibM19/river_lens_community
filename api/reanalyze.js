const {db}=require('../lib/db'); const A=require('../lib/auth'); const {runAnalysis}=require('../lib/analysis');
module.exports=A.guard(async(req,res)=>{
  if(req.method!=='POST') return res.status(405).json({error:'Use POST'});
  if(!A.limit(req,'create',20)) return res.status(429).json({error:'Too many requests. Please wait a minute.'});
  const d=await db(); if(!d) return res.status(503).json({error:'Database is not connected.',code:'no_db'});
  const id=parseInt((req.body||{}).id,10); const o=(await d.query(`SELECT image_b64,stats,user_id FROM observations WHERE id=$1`,[id]))[0];
  if(!o) return res.status(404).json({error:'Not found'});
  if(req.user.role!=='reviewer'&&Number(o.user_id)!==req.user.id) return res.status(403).json({error:'Only the author or a reviewer can re-run the analysis.'});
  await runAnalysis(d,id,o.image_b64,o.stats?JSON.parse(o.stats):null); res.status(200).json({ok:true});
},{role:'user'});
