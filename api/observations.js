const {db}=require('../lib/db'); const A=require('../lib/auth'); const {runAnalysis}=require('../lib/analysis');
const iso=()=>new Date().toISOString();
const LIST=`SELECT o.id,o.created_at,o.site,o.note,o.status AS obs_status,o.user_id,u.username AS author,u.role AS author_role,
 f.id AS finding_id,f.primary_category,f.uncertainty,f.needs_review,f.status AS finding_status,f.mode,f.model,f.error,f.final_category,f.reviewer,
 (SELECT COUNT(*) FROM likes l WHERE l.observation_id=o.id) AS likes,
 (SELECT COUNT(*) FROM comments c WHERE c.observation_id=o.id) AS comments,
 (SELECT COUNT(*) FROM likes l2 WHERE l2.observation_id=o.id AND l2.user_id=$1) AS mine
 FROM observations o LEFT JOIN users u ON u.id=o.user_id LEFT JOIN findings f ON f.id=(SELECT MAX(id) FROM findings WHERE observation_id=o.id) ORDER BY o.id DESC LIMIT 500`;
module.exports=A.guard(async(req,res)=>{
  const d=await db(); if(!d) return res.status(503).json({error:'Database is not connected.',code:'no_db'});
  if(req.method==='GET'){const rows=await d.query(LIST,[req.user?req.user.id:0]);
    return res.status(200).json(rows.map(r=>({...r,user_id:r.user_id==null?null:Number(r.user_id),likes:Number(r.likes),comments:Number(r.comments),mine:Number(r.mine)>0})))}
  if(req.method!=='POST') return res.status(405).json({error:'Use GET or POST'});
  if(!req.user) return res.status(401).json({error:'Please log in to share a photo.',code:'login'});
  if(!A.limit(req,'create',20)) return res.status(429).json({error:'Too many uploads. Please wait a minute.'});
  const b=req.body||{}; const img=b.image,th=b.thumb;
  if(typeof img!=='string'||img.length<100||img.length>3_500_000) return res.status(400).json({error:'Send a resized JPEG as base64 (max about 2.5 MB).'});
  if(th&&(typeof th!=='string'||th.length>200_000)) return res.status(400).json({error:'Thumbnail too large.'});
  const site=String(b.site||'').trim().slice(0,120)||'Unspecified', note=String(b.note||'').trim().slice(0,1000);
  const stats=b.stats&&typeof b.stats==='object'?{mean:+b.stats.mean||0,edge:+b.stats.edge||0}:null;
  const ins=await d.query(`INSERT INTO observations(created_at,site,note,image_b64,thumb_b64,stats,status,user_id) VALUES($1,$2,$3,$4,$5,$6,'analysing',$7) RETURNING id`,[iso(),site,note,img,th||null,stats?JSON.stringify(stats):null,req.user.id]);
  const id=Number(ins[0].id); await runAnalysis(d,id,img,stats);
  res.status(201).json({id});
});
