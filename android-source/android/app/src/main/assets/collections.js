/** On-device user collections; no external account mutation until explicitly synced. */
const KEY='mutiny.android.collections.v1';
const LIMIT=100;
const normal=id=>String(id||'').trim().slice(0,150);
function safeState(raw){
  if(!Array.isArray(raw))return [];
  return raw.slice(0,LIMIT).filter(item=>item&&typeof item.name==='string'&&Array.isArray(item.ids))
    .map(item=>({id:normal(item.id),name:item.name.trim().slice(0,60),ids:[...new Set(item.ids.map(normal).filter(Boolean))].slice(0,2000)}))
    .filter(item=>item.id&&item.name);
}
export function getCollections(store=globalThis.localStorage){
  try{return safeState(JSON.parse(store.getItem(KEY)||'[]'));}catch{return [];}
}
function storeCollections(items,store=globalThis.localStorage){
  const clean=safeState(items);store.setItem(KEY,JSON.stringify(clean));return clean;
}
export function collectionKey(meta){return String(meta?.type||'movie')+':'+normal(meta?.id);}
export function createCollection(name){
  const title=String(name||'').trim();
  if(title.length<1||title.length>60)throw Error('Collection names must be 1–60 characters');
  const existing=getCollections();
  if(existing.some(item=>item.name.toLowerCase()===title.toLowerCase()))throw Error('A collection with this name already exists');
  if(existing.length>=LIMIT)throw Error('Too many collections');
  const id='collection-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
  storeCollections([...existing,{id,name:title,ids:[]}]);return id;
}
export function toggleCollection(id,meta){
  const key=collectionKey(meta),items=getCollections(),target=items.find(x=>x.id===id);
  if(!target)throw Error('Collection no longer exists');
  target.ids=target.ids.includes(key)?target.ids.filter(x=>x!==key):[...target.ids,key];
  storeCollections(items);return target.ids.includes(key);
}
export function removeCollection(id){storeCollections(getCollections().filter(item=>item.id!==id));}
export function collectionMembers(id,metas){const group=getCollections().find(x=>x.id===id);return group?metas.filter(x=>group.ids.includes(collectionKey(x))):[];}
export function collectionPicker(meta,announce=()=>{}){
  const root=document.createElement('section');root.className='collection-picker';
  const h=document.createElement('h3');h.textContent='Collections';root.append(h);
  const list=document.createElement('div');root.append(list);
  function refresh(){list.replaceChildren();
    const groups=getCollections();
    if(!groups.length){const hint=document.createElement('p');hint.textContent='Create a collection in My library first.';hint.className='note';list.append(hint);}
    for(const item of groups){const label=document.createElement('label');label.className='setting-check';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=item.ids.includes(collectionKey(meta));
      checkbox.addEventListener('change',()=>{toggleCollection(item.id,meta);announce('Collection updated');});
      label.append(checkbox,document.createTextNode(item.name));list.append(label);}
  }
  refresh();return root;
}
export function collectionManager(parent,saved,displayGrid,announce=()=>{}){
  const root=document.createElement('section');root.className='collections-panel';
  const heading=document.createElement('h2');heading.textContent='Collections';root.append(heading);
  const form=document.createElement('form'),field=document.createElement('input');field.placeholder='New collection name';field.maxLength=60;field.setAttribute('aria-label','New collection name');
  const add=document.createElement('button');add.type='submit';add.textContent='Create';
  form.append(field,add);form.addEventListener('submit',event=>{event.preventDefault();try{createCollection(field.value);field.value='';refresh();announce('Collection created')}catch(e){announce(e.message)}});root.append(form);
  const content=document.createElement('div');root.append(content);
  function refresh(){content.replaceChildren();
    for(const item of getCollections()){
      const section=document.createElement('section');section.className='collection-section';
      const title=document.createElement('h3');title.textContent=item.name+' · '+item.ids.length+' titles';section.append(title);
      const remove=document.createElement('button');remove.type='button';remove.textContent='Delete collection';
      remove.addEventListener('click',()=>{if(confirm('Delete collection “'+item.name+'”?')){removeCollection(item.id);refresh();announce('Collection deleted')}});
      section.append(remove);
      const matches=collectionMembers(item.id,saved);if(matches.length)section.append(displayGrid(matches));else{const hint=document.createElement('p');hint.className='note';hint.textContent='Open a saved title to add it to this collection.';section.append(hint);}
      content.append(section);
    }
  }
  refresh();parent.append(root);
}
