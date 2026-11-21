const {db}=require('../lib/db'); const A=require('../lib/auth');
module.exports=async(req,res)=>{
  try{
    const d=await db(); if(!d) return res.status(503).end('No database');
    const id=parseInt(req.query.id,10); const col=req.query.thumb?'COALESCE(thumb_b64,image_b64)':'image_b64';
    const r=(await d.query(`SELECT ${col} AS img FROM observations WHERE id=$1`,[id]))[0];
    if(!r) return res.status(404).end('Not found');
    res.setHeader('Content-Type','image/jpeg'); res.setHeader('Cache-Control','public, max-age=3600');
    res.statusCode=200; res.end(Buffer.from(r.img,'base64'));
  }catch(e){ console.error(e); res.statusCode=500; res.end('Error') }
};
