const {db}=require('../lib/db'); const A=require('../lib/auth'); const {CATEGORIES}=require('../lib/riverlens');
module.exports=A.guard(async(req,res)=>{
  if(req.method!=='POST') return res.status(405).json({error:'Use POST'});
  const d=await db(); if(!d) return res.status(503).json({error:'Database is not connected.',code:'no_db'});
  const b=req.body||{}; const fid=parseInt(b.finding_id,10), dec=b.decision, reviewer=req.user.username, comment=String(b.comment||'').trim().slice(0,1000);
  if(!['confirm','correct','reject'].includes(dec)) return res.status(400).json({error:'Decision must be confirm, correct or reject.'});
  if(dec==='reject'&&!comment) return res.status(400).json({error:'Please give a short reason for rejecting.'});
  if(dec==='correct'&&!CATEGORIES.includes(b.category)) return res.status(400).json({error:'Choose a valid category.'});
  const f=(await d.query(`SELECT id,primary_category FROM findings WHERE id=$1`,[fid]))[0]; if(!f) return res.status(404).json({error:'Not found'});
  const status={confirm:'confirmed',correct:'corrected',reject:'rejected'}[dec];
  const fin=dec==='correct'?b.category:(dec==='confirm'?f.primary_category:null);
  await d.query(`UPDATE findings SET status=$1,reviewer=$2,review_comment=$3,reviewed_at=$4,final_category=$5 WHERE id=$6`,[status,reviewer,comment,new Date().toISOString(),fin,fid]);
  res.status(200).json({ok:true,status});
},{role:'reviewer'});
