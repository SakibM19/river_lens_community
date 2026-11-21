const $=s=>document.querySelector(s);
const qs=new URLSearchParams(location.search);
let role='member', sub=qs.get('mode')==='up'?'up':'in';
async function post(b){const r=await fetch('/api/auth',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});let d={};try{d=await r.json()}catch(e){}if(!r.ok)throw new Error(d.error||('Error '+r.status));return d}
function paint(){const rev=role==='reviewer';if(rev)sub='in';
 $('#tabMember').classList.toggle('on',!rev);$('#tabRev').classList.toggle('on',rev);$('#subSeg').hidden=rev;
 $('#subIn').classList.toggle('on',sub==='in');$('#subUp').classList.toggle('on',sub==='up');
 $('#hint').hidden=rev||sub!=='up';$('#revNote').hidden=!rev;$('#go').textContent=rev?'Log in as reviewer':(sub==='in'?'Log in':'Create account');
 $('#p').autocomplete=sub==='up'&&!rev?'new-password':'current-password';$('#msg').textContent=''}
$('#tabMember').onclick=()=>{role='member';paint()};$('#tabRev').onclick=()=>{role='reviewer';paint()};
$('#subIn').onclick=()=>{sub='in';paint()};$('#subUp').onclick=()=>{sub='up';paint()};
$('#lf').onsubmit=async e=>{e.preventDefault();const m=$('#msg');m.textContent='';
 try{await post({action:role==='reviewer'||sub==='in'?'login':'register',as:role,username:$('#u').value,password:$('#p').value});location.href='/'}catch(err){m.textContent=err.message}};
$('#outBtn').onclick=async()=>{try{await post({action:'logout'})}catch(e){}location.href='/login.html?out=1'};
(async()=>{if(qs.get('out'))$('#outMsg').hidden=false;
 try{const s=await (await fetch('/api/status',{credentials:'same-origin'})).json();
  if(s.user){$('#formCard').hidden=true;$('#already').hidden=false;$('#whoLine').textContent='Signed in as '+s.user.username+(s.user.role==='reviewer'?' (reviewer)':'')+'.'}}catch(e){}
 paint()})();
