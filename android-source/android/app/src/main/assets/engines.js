/** Android native-engine controls. All remote operations use the origin-scoped RPC bridge. */
const pending = new Map();
window.addEventListener('mutiny-cs3-updated',()=>window.mutinyRefreshCs3?.());
export function rpc(method, args = {}) {
  if (!window.Mutiny) return Promise.reject(Error('Native features need a current Android System WebView.'));
  window.Mutiny.onmessage = event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    const task = pending.get(message.id); if (!task) return;
    pending.delete(message.id); clearTimeout(task.timer);
    if (message.error) task.reject(Error(message.error)); else task.resolve(message.result);
  };
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(id); reject(Error('Request timed out')); }, method === 'cloudstream.importUrl' ? 600000 : 120000);
    pending.set(id, {resolve, reject, timer});
    try { window.Mutiny.postMessage(JSON.stringify({id, method, args})); }
    catch (error) { pending.delete(id); clearTimeout(timer); reject(error); }
  });
}
export function controls(main, openTitle) {
  const root = document.createElement('section'); root.className='engine-controls';
  const status = document.createElement('p'); status.className='note'; status.setAttribute('role','status');
  const add=(parent,tag,label,className)=>{const element=document.createElement(tag);if(label!=null)element.textContent=label;if(className)element.className=className;parent.append(element);return element;};
  const group=(label,open=false)=>{const details=add(root,'details',null,'setting-group');details.open=open;add(details,'summary',label);const body=add(details,'div',null,'setting-group-body');return body;};
  const field=(parent,label,type='text',placeholder='')=>{const wrap=add(parent,'label',label,'setting-field');const node=add(wrap,'input');node.type=type;node.placeholder=placeholder;return node;};
  const choose=(parent,label,values)=>{const wrap=add(parent,'label',label,'setting-field');const node=add(wrap,'select');for(const [value,text] of values){const option=add(node,'option',text);option.value=value;}return node;};
  const button=(parent,label,fn)=>{
    const node=add(parent,'button',label);node.type='button';
    node.onclick=async()=>{node.disabled=true;try{await fn()}catch(error){status.textContent=error.message||'Operation failed';}finally{node.disabled=false;}};return node;
  };
  add(root,'h2','Media engines');
  add(root,'p','Open a section to configure torrent streaming, account synchronisation and CloudStream repositories. No games or game services are included.','note');
  const torrent=group('Torrent and magnet streaming');
  const magnet=field(torrent,'Magnet link or info hash','text','magnet:?xt=urn:btih:…');magnet.autocomplete='off';
  const torrentButtons=add(torrent,'div',null,'row'), torrentResult=add(torrent,'div',null,'torrent-result');
  async function showTorrent(){
    const t=await rpc('torrent.status');torrentResult.replaceChildren();
    add(torrentResult,'p',t.error||[t.stage,t.name,t.total?Math.floor(100*t.done/t.total)+'%':''].filter(Boolean).join(' · ')||'No torrent running');
    if(t.total>0){const progress=add(torrentResult,'progress');progress.max=t.total;progress.value=Math.min(t.done||0,t.total);}
    if(t.stage==='choose-file'&&Array.isArray(t.files)) for(const f of t.files)button(torrentResult,f.name,async()=>{await rpc('torrent.select',{index:f.index});await showTorrent();});
    if(['ready','downloading'].includes(t.stage)) button(torrentResult,'▶ Play selected file',()=>rpc('torrent.play'));
  }
  button(torrentButtons,'Load torrent',async()=>{let value=magnet.value.trim();if(/^[a-f0-9]{40}$/i.test(value))value='magnet:?xt=urn:btih:'+value;await rpc('torrent.add',{magnet:value});await showTorrent();});
  button(torrentButtons,'Refresh torrent',showTorrent);
  button(torrentButtons,'Stop torrent',async()=>{await rpc('torrent.stop');await showTorrent();});
  const account=group('Stremio and Nuvio accounts');
  const provider=choose(account,'Account provider',[['stremio','Stremio'],['nuvio','Nuvio']]);
  const email=field(account,'Email','email'), password=field(account,'Password','password');password.autocomplete='current-password';
  const profileWrap=add(account,'div',null,'profile-selection'), profile=field(profileWrap,'Nuvio profile number (1–6)','number');profile.min=1;profile.max=6;profile.value=1;
  provider.addEventListener('change',()=>{profileWrap.hidden=provider.value!=='nuvio';showAccount().catch(()=>{});});profileWrap.hidden=true;
  const accountStatus=add(account,'p','Checking account status…','note');
  async function showAccount(){const data=await rpc('account.status'), selected=data[provider.value];accountStatus.textContent=selected?.signedIn?'Signed in as '+(selected.email||provider.value):'Not signed in to '+provider.value;}
  const accountActions=add(account,'div',null,'row');
  button(accountActions,'Sign in',async()=>{await rpc('account.login',{provider:provider.value,email:email.value,password:password.value});password.value='';await showAccount();status.textContent='Signed in';});
  button(accountActions,'Sign out',async()=>{await rpc('account.logout',{provider:provider.value});await showAccount();status.textContent='Signed out';});
  const cloud=add(account,'div',null,'cloud-library');
  button(account,'Load cloud library',async()=>{
    const data=await rpc('account.sync',{provider:provider.value,profile:provider.value==='nuvio'?Number(profile.value):1});
    cloud.replaceChildren();
    const items=(Array.isArray(data.library)?data.library:[]).filter(x=>!x.removed&&!x.temp).map(x=>({id:x._id||x.content_id,type:x.type||x.content_type,name:x.name||x.title||'Untitled',poster:x.poster||'',releaseInfo:x.releaseInfo||''})).filter(x=>x.id&&['movie','series'].includes(x.type));
    add(cloud,'p',items.length+' title(s) returned by '+provider.value+'.');
    const libraryButtons=add(cloud,'div',null,'row');
    button(libraryButtons,'Merge into My library',async()=>{window.dispatchEvent(new CustomEvent('mutiny-library-import',{detail:items}));status.textContent=items.length+' titles merged into your device library';});
    for(const item of items.slice(0,50))button(cloud,item.name,()=>openTitle(item));
    if(items.length>50)add(cloud,'p','Showing the first 50 titles here. Merge to see the full collection.','note');
    const addons=Array.isArray(data.addons)?data.addons:[];
    if(addons.length)button(cloud,'Import '+addons.length+' cloud add-on(s)',async()=>{window.dispatchEvent(new CustomEvent('mutiny-addons-import',{detail:addons}));status.textContent='Valid add-on manifests will be checked before importing';});
  });
  const cloudstream=group('CloudStream extensions');
  add(cloudstream,'p','Import and manage .cs3 extensions from a repository or your device. Packages are validated and stored locally. Provider execution is not yet supported: imported extensions will not appear in search or playback until a compatible CloudStream runtime is integrated. Only import code from sources you trust.','note');
  const installed=add(cloudstream,'div',null,'cloudstream-installed');
  async function refreshInstalled(){
    if(!window.Mutiny) {installed.replaceChildren(add(document.createElement('div'),'p','Installed extensions are available in the Android app.','note'));return;}
    const packages=await rpc('cloudstream.list');
    if(!root.isConnected && root.parentNode) return;
    installed.replaceChildren();
    add(installed,'h3','Imported packages');
    if(!packages.length)add(installed,'p','No .cs3 packages imported yet.','note');
    for(const item of packages) {
      const row=add(installed,'div',null,'box');
      add(row,'strong',item.name||item.pluginClassName||'CloudStream extension');
      add(row,'p',[item.version?'v'+item.version:'',item.bytes?Math.round(item.bytes/1024)+' KiB':'','Imported, inactive'].filter(Boolean).join(' · '),'small');
      button(row,'Remove',async()=>{await rpc('cloudstream.remove',{sha256:item.sha256});await refreshInstalled();status.textContent='Extension removed.';});
    }
  }
  button(cloudstream,'Import local .cs3 file',()=>{
    if(!window.Mutiny) throw Error('Open the installed Android app to import local files');
    location.href='mutiny://cs3';
  });
  button(cloudstream,'Refresh imported packages',refreshInstalled);
  const cloudRepo=field(cloudstream,'Repository index URL','url','https://example.org/repo.json');
  const cloudResults=add(cloudstream,'div',null,'cloudstream-list');
  button(cloudstream,'Discover extensions',async()=>{
    const catalog=await rpc('cloudstream.discover',{url:cloudRepo.value.trim()});
    cloudResults.replaceChildren();
    const extensions=Array.isArray(catalog.extensions)?catalog.extensions:[];
    add(cloudResults,'p',catalog.repository+': '+extensions.length+' extension(s) discovered.','note');
    if(catalog.failedLists)add(cloudResults,'p',catalog.failedLists+' index list(s) could not be loaded.','note');
    for(const extension of extensions.slice(0,150)){
      const line=add(cloudResults,'div',null,'box');
      add(line,'strong',String(extension.name||'Extension'));
      add(line,'p',[extension.description,extension.language,extension.version?'v'+extension.version:''].filter(Boolean).join(' · '),'small');
      button(line,'Import .cs3',async()=>{
        if(!window.Mutiny)throw Error('Import requires the installed Android app');
        const data=await rpc('cloudstream.importUrl',{url:extension.downloadUrl,fileHash:extension.fileHash||''});
        await refreshInstalled();
        status.textContent=data.name+' imported and validated. Runtime execution is not yet enabled.';
      });
    }
  });
  // Android's document picker returns to the existing WebView; refresh its package list.
  window.mutinyRefreshCs3=()=>{if(root.isConnected)refreshInstalled().catch(error=>{status.textContent=error.message||'Could not refresh extensions';});};
  if(window.Mutiny)refreshInstalled().catch(error=>{status.textContent=error.message||'Could not read installed extensions';});
  root.append(status);main.append(root);
  if(window.Mutiny){showAccount().catch(()=>{accountStatus.textContent='Account status unavailable';});}
  return root;
}
