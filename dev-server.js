// Local runner that mimics Vercel: node dev-server.js -> http://localhost:3000
// Without a Neon database, try: DATABASE_URL=sqlite:./local.db node dev-server.js
const http=require('http'),fs=require('fs'),path=require('path');
const PORT=process.env.PORT||3000;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://x');
  if(url.pathname.startsWith('/api/')){
    const name=url.pathname.slice(5).replace(/[^a-z]/g,''); const f=path.join(__dirname,'api',name+'.js');
    if(!fs.existsSync(f)){res.statusCode=404;return res.end('{}')}
    let body=''; for await(const c of req) body+=c;
    try{req.body=body?JSON.parse(body):{}}catch(e){req.body={}}
    req.query=Object.fromEntries(url.searchParams);
    res.status=c=>{res.statusCode=c;return res}; res.json=o=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(o))};
    return require(f)(req,res);
  }
  let p=url.pathname==='/'?'/index.html':url.pathname; const f=path.join(__dirname,'public',path.normalize(p).replace(/^(\.\.[\/\\])+/,''));
  if(!f.startsWith(path.join(__dirname,'public'))||!fs.existsSync(f)){res.statusCode=404;return res.end('Not found')}
  res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream'); res.end(fs.readFileSync(f));
}).listen(PORT,()=>console.log('RiverLens on http://localhost:'+PORT));
