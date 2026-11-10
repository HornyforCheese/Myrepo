import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve(process.argv[2] || 'windows-src');
for(const rel of ['package.json','src-tauri/tauri.conf.json','src/views/play-picker.tsx']) {
  if(!fs.existsSync(path.join(dir,rel))) throw Error('Missing Windows Tauri source: '+rel);
}
const pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
const app=JSON.parse(fs.readFileSync(path.join(dir,'src-tauri/tauri.conf.json'),'utf8'));
if(pkg.name!=='mutiny-media'||pkg.version!=='1.0.1'||app.productName!=='Mutiny Media'||app.version!=='1.0.1'||app.identifier!=='app.mutiny.media') {
  throw Error('Version guard failed: must be customized Mutiny Media Windows 1.0.1.');
}
console.log('PASS: confirmed Mutiny Media Windows 1.0.1.');
