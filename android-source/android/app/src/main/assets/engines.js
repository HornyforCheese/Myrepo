const pending = new Map();
export function rpc(method,args={}) {
  if (!window.Mutiny) return Promise.reject(Error('Update Android System WebView to use native features.'));
  window.Mutiny.onmessage = event => {
    const message = JSON.parse(event.data), task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id); clearTimeout(task.timer);
    if (message.error) task.reject(Error(message.error)); else task.resolve(message.result);
  };
  return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const timer=setTimeout(()=>{pending.delete(id); reject(Error('Request timed out'));},120000);
    pending.set(id,{resolve,reject,timer}); window.Mutiny.postMessage(JSON.stringify({id,method,args}));
  });
}
export function controls(main,openTitle) {
  const section=document.createElement('section'); main.prepend(section);
  function node(tag,text,parent=section){const n=document.createElement(tag); n.textContent=text; parent.append(n); return n;}
  function field(label,type='text'){const n=node('input','',node('label',label)); n.type=type; return n;}
  function choose(values){const s=node('select',''); for(const v of values)node('option',v,s); return s;}
  function btn(label,action,parent=section){const b=node('button',label,parent); b.onclick=async()=>{b.disabled=true;try{await action()}catch(e){status.textContent=e.message}finally{b.disabled=false}};}
  const status=node('p',''); status.setAttribute('role','status');
  node('h2','Torrents'); const magnet=field('Magnet link or info hash'), files=node('div','');
  async function show(){const t=await rpc('torrent.status'); files.replaceChildren(); node('p',t.error || [t.stage,t.name,t.total?Math.floor(100*t.done/t.total)+'%':''].filter(Boolean).join(' · '),files);
    if(t.stage==='choose-file')for(const f of t.files)btn(f.name,async()=>{await rpc('torrent.select',{index:f.index});await show()},files);
    if(['ready','downloading'].includes(t.stage))btn('Play selected file',()=>rpc('torrent.play'),files);
  }
  btn('Load torrent',async()=>{let m=magnet.value.trim();if(/^[0-9a-f]{40}$/i.test(m))m='magnet:?xt=urn:btih:'+m;await rpc('torrent.add',{magnet:m});await show()});btn('Refresh torrent',show);btn('Stop torrent',async()=>{await rpc('torrent.stop');await show()});
  node('h2','Account sync');const provider=choose(['stremio','nuvio']),email=field('Email','email'),pass=field('Password','password'),profile=field('Nuvio profile number','number');profile.value=1;
  btn('Sign in',async()=>{await rpc('account.login',{provider:provider.value,email:email.value,password:pass.value});pass.value='';status.textContent='Signed in'});
  const library=node('div','');
  btn('Load cloud library',async()=>{const data=await rpc('account.sync',{provider:provider.value,profile:Number(profile.value)});library.replaceChildren(); for(const i of data.library.filter(x=>!x.removed&&!x.temp)){const m={id:i._id||i.content_id,type:i.type||i.content_type,name:i.name,poster:i.poster};btn(m.name,()=>openTitle(m),library)}status.textContent='Library loaded'});
  btn('Sign out',async()=>{await rpc('account.logout',{provider:provider.value});library.replaceChildren();status.textContent='Signed out'});
  node('h2','AI search'); const ai=choose(['openrouter','groq','gemini']),model=field('Provider model ID'),key=field('API key','password'),query=field('Describe a movie, series or game'),kind=choose(['media','games']);
  btn('Save AI settings',async()=>{await rpc('ai.save',{provider:ai.value,model:model.value,key:key.value});key.value='';status.textContent='AI settings saved'});
  const suggestions=node('div','');
  btn('Find recommendations',async()=>{const raw=await rpc('ai.suggest',{query:query.value,kind:kind.value});const list=JSON.parse(raw.slice(raw.indexOf('['),raw.lastIndexOf(']')+1));suggestions.replaceChildren();for(const item of list)node('p',[item.title,item.year,item.reason].filter(Boolean).join(' · '),suggestions)});
  node('h2','Games');const search=field('Steam game title'),games=node('div','');
  btn('Search Steam',async()=>{const data=await rpc('public.get',{url:'https://store.steampowered.com/api/storesearch/?l=english&cc=US&term='+encodeURIComponent(search.value)});games.replaceChildren();for(const g of data.items||[])btn(g.name,()=>{location.href='mutiny://external?url='+encodeURIComponent('https://store.steampowered.com/app/'+Number(g.id)+'/')},games)});
  btn('Installed Android games',async()=>{games.replaceChildren();const list=await rpc('games.installed');if(!list.length)node('p','No installed games found',games);for(const g of list)btn(g.name,()=>rpc('games.launch',{package:g.package}),games)});
  btn('Open Steam Link',()=>rpc('games.launch',{package:'com.valvesoftware.steamlink'}));
}
