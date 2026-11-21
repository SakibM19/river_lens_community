// Accounts: signed session cookie -> user row (id, username, role). Roles: 'user' | 'reviewer'.
const crypto=require('crypto');
const secret=()=>process.env.SESSION_SECRET||process.env.ACCESS_CODE||crypto.createHash('sha256').update(String(process.env.DATABASE_URL||process.env.POSTGRES_URL||'riverlens')).digest('hex');
const mac=p=>crypto.createHmac('sha256',secret()).update(p).digest('hex');
function cookie(req,name){const m=(req.headers.cookie||'').split(/;\s*/).find(c=>c.startsWith(name+'='));return m?decodeURIComponent(m.slice(name.length+1)):''}
function same(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function uidFrom(req){const [id,exp,sig]=cookie(req,'rl_sess').split('.');if(!id||!exp||!sig)return 0;
  if(!same(sig,mac(id+'.'+exp))||Date.now()>+exp)return 0;return parseInt(id,10)||0}
async function currentUser(req){const id=uidFrom(req);if(!id)return null;const {db}=require('./db');const d=await db();if(!d)return null;
  const u=(await d.query(`SELECT id,username,role FROM users WHERE id=$1`,[id]))[0];return u?{id:Number(u.id),username:u.username,role:u.role}:null}
const secure=req=>(req.headers['x-forwarded-proto']||'').includes('https')?'; Secure':'';
function setSession(req,res,uid){const exp=Date.now()+30*864e5;
  res.setHeader('Set-Cookie',`rl_sess=${uid}.${exp}.${mac(uid+'.'+exp)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure(req)}`)}
function clearSession(req,res){res.setHeader('Set-Cookie',`rl_sess=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure(req)}`)}
const hits=new Map();
function limit(req,key,max,ms=60000){const ip=(req.headers['x-forwarded-for']||'').split(',')[0]||'anon',k=key+ip,now=Date.now();
  const a=(hits.get(k)||[]).filter(t=>now-t<ms);if(a.length>=max)return false;a.push(now);hits.set(k,a);return true}
// guard(fn,{role}): role undefined = anyone (req.user set if logged in), 'user' = must be logged in, 'reviewer' = reviewers only
const guard=(fn,{role}={})=>async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method==='POST'&&!/application\/json/i.test(req.headers['content-type']||'')) return res.status(415).json({error:'Send JSON.'});
    req.user=await currentUser(req);
    if(role&&!req.user) return res.status(401).json({error:'Please log in first.',code:'login'});
    if(role==='reviewer'&&req.user.role!=='reviewer') return res.status(403).json({error:'Only reviewers can do that.'});
    return await fn(req,res)
  }catch(e){ console.error(e); return res.status(500).json({error:'Server error: '+String(e.message||e).slice(0,200)}) }
};
module.exports={currentUser,setSession,clearSession,limit,guard,same};
