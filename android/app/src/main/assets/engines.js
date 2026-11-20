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
export function controls(main,openTitle,sectionId,reloadAddons) {
  const section=document.createElement('section'); main.prepend(section);
  function node(tag,text,parent=section){const n=document.createElement(tag); n.textContent=text; parent.append(n); return n;}
  function field(label,type='text'){const n=node('input','',node('label',label)); n.type=type; return n;}
  function choose(values){const s=node('select',''); for(const v of values)node('option',v,s); return s;}
  function btn(label,action,parent=section){const b=node('button',label,parent); b.onclick=async()=>{b.disabled=true;try{await action()}catch(e){status.textContent=e.message}finally{b.disabled=false}};}
  const status=node('p',''); status.setAttribute('role','status');
  if (sectionId === 'server') {
  node('h2','Torrents'); const magnet=field('Magnet link or info hash'), files=node('div','');
  async function show(){const t=await rpc('torrent.status'); files.replaceChildren(); node('p',t.error || [t.stage,t.name,t.total?Math.floor(100*t.done/t.total)+'%':''].filter(Boolean).join(' · '),files);
    if(t.stage==='choose-file')for(const f of t.files)btn(f.name,async()=>{await rpc('torrent.select',{index:f.index});await show()},files);
    if(['ready','downloading'].includes(t.stage))btn('Play selected file',()=>rpc('torrent.play'),files);
  }
  btn('Load torrent',async()=>{let m=magnet.value.trim();if(/^[0-9a-f]{40}$/i.test(m))m='magnet:?xt=urn:btih:'+m;await rpc('torrent.add',{magnet:m});await show()});btn('Refresh torrent',show);btn('Stop torrent',async()=>{await rpc('torrent.stop');await show()});
  return;
  }
  node('h2','Account sync');
  const form = node('fieldset','');
  const provider = node('select','',node('label','Account service',form));
  for (const name of ['stremio','nuvio']) node('option',name,provider);
  const input = (label,type) => {
    const target = node('input','',node('label',label,form));
    target.type = type; return target;
  };
  const email = input('Email','email'), pass = input('Password','password');
  const profile = input('Nuvio profile number','number');
  profile.value = 1; profile.min = 1; profile.max = 6;
  const library = node('div','');
  function resetView() {
    pass.value = ''; library.replaceChildren(); status.textContent = '';
    profile.parentElement.hidden = provider.value !== 'nuvio';
  }
  provider.onchange = resetView;
  profile.oninput = () => library.replaceChildren();
  resetView();
  function accountAction(label, run) {
    btn(label, async () => {
      form.disabled = true;
      try { await run(provider.value); } finally { form.disabled = false; }
    }, form);
  }
  accountAction('Sign in', async service => {
    await rpc('account.login',{provider:service,email:email.value,password:pass.value});
    pass.value=''; library.replaceChildren(); await reloadAddons();
    status.textContent='Signed in. Load cloud library to sync providers.';
  });
  accountAction('Load cloud library', async service => {
    const data = await rpc('account.sync',{provider:service,profile:service === 'nuvio' ? Number(profile.value) : 1});
    library.replaceChildren();
    for (const item of data.library) {
      if (!item || item.removed || item.temp) continue;
      const meta = {id:item._id || item.content_id,type:item.type || item.content_type,name:item.name,poster:item.poster};
      if (meta.id && meta.name) btn(meta.name,()=>openTitle(meta),library);
    }
    const stats = (await reloadAddons())[service];
    status.textContent = 'Library loaded · ' + (stats?.count || 0) + ' account providers · ' + (stats?.skipped || 0) + ' skipped';
  });
  accountAction('Sign out', async service => {
    await rpc('account.logout',{provider:service});
    library.replaceChildren(); pass.value=''; await reloadAddons(); status.textContent='Signed out';
  });
}
