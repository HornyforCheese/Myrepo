#!/usr/bin/env node
/** Linux-specific UI corrections for the pinned Mutiny Media 1.0.1 source. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
function once(src,anchor,label){
  const at=src.indexOf(anchor);
  if(at<0||src.indexOf(anchor,at+anchor.length)>=0)throw Error("Unrecognised "+label+" source; not patching");
  return at;
}
export function repairSidebar(src){
  if(src.includes("MUTINY_LINUX_SIDEBAR_BRAND")){
    if(src.includes('src="/kids/wheel.png"')||src.includes("                Harb\n")) throw Error("Incomplete logo migration");
    return src;
  }
  for(const [label,anchor] of [
    ["kids logo",'                Harb\n                <img\n                  src="/kids/wheel.png"'],
    ["standard logo",'                Harb\n                <span\n']
  ]){
    const from=once(src,anchor,label),tail="\n                r\n              </span>";
    const end=src.indexOf(tail,from+anchor.length);
    if(end<0||end-from>1600)throw Error("Unexpected "+label+" ending");
    src=src.slice(0,from)+"                Mutiny Media"+src.slice(end+"\n                r".length);
  }
  const bt=String.fromCharCode(96);
  const expr=String.fromCharCode(36)+"{collapsed ? \"\" : \"lg:h-10 lg:w-10\"}";
  const old='<HarborMark className={'+bt+'h-9 w-9 shrink-0 '+expr+bt+'} />';
  once(src,old,"sidebar mark");
  src=src.replace(old,'<img src="/mutiny-mark.png" alt="Mutiny Media" draggable={false} className={'+bt+'h-9 w-9 shrink-0 object-contain '+expr+bt+'} />');
  const imp='import { HarborMark } from "@/components/icons/harbor-mark";\n';
  once(src,imp,"sidebar mark import");
  return src.replace(imp,"// MUTINY_LINUX_SIDEBAR_BRAND: preserve user-selected custom artwork.\n");
}
export function repairOfflineBanner(src){
  if(src.includes("MUTINY_LINUX_NETWORK_SIGNAL"))return src;
  const a='  const hasSaved = items.some((d) => d.status === "done");';
  once(src,a,"offline state");
  src=src.replace(a,a+'\n  // MUTINY_LINUX_NETWORK_SIGNAL: WebKitGTK flag alone cannot prove providers are offline.\n  const linuxDesktop = typeof navigator !== "undefined" &&\n    /\bLinux\b/i.test(navigator.userAgent) && !/\bAndroid\b/i.test(navigator.userAgent);');
  const redirect='if (!navigator.onLine && hasSaved) setView("downloads");';
  once(src,redirect,"offline view change");
  src=src.replace(redirect,'if (!linuxDesktop && !navigator.onLine && hasSaved) setView("downloads");');
  const banner="  if (online) return null;";
  once(src,banner,"offline banner");
  return src.replace(banner,"  if (online || linuxDesktop) return null;");
}
export function repairBigPictureStatus(src){
  if(src.includes("MUTINY_LINUX_BP_NETWORK_SIGNAL"))return src;
  const a="  const online = useOnline();";
  once(src,a,"Big Picture signal");
  src=src.replace(a,a+'\n  // MUTINY_LINUX_BP_NETWORK_SIGNAL: hide uncertain Linux connectivity glyph.\n  const linuxDesktop = typeof navigator !== "undefined" &&\n    /\bLinux\b/i.test(navigator.userAgent) && !/\bAndroid\b/i.test(navigator.userAgent);');
  const start="      {online ? (\n        <Wifi strokeWidth={2}";
  const end='className="h-[clamp(14px,1.9vh,22px)] w-auto text-danger" />\n      )}';
  once(src,start,"Big Picture wifi start");once(src,end,"Big Picture wifi end");
  return src.replace(start,"      {!linuxDesktop && (online ? (\n        <Wifi strokeWidth={2}")
    .replace(end,'className="h-[clamp(14px,1.9vh,22px)] w-auto text-danger" />\n      ))}');
}
export function repairLinuxUi(root){
  const ops=[["src/chrome/sidebar.tsx",repairSidebar],["src/chrome/offline-banner.tsx",repairOfflineBanner],["src/views/big-picture/bp-status.tsx",repairBigPictureStatus]];
  const planned=ops.map(([rel,edit])=>{
    const filename=path.join(root,rel),before=fs.readFileSync(filename,"utf8");
    return {filename,before,after:edit(before)};
  });
  const logo=path.join(here,"..","public","mutiny-mark.png");
  if(!fs.existsSync(logo)||fs.statSync(logo).size===0)throw Error("Missing Mutiny brand asset");
  for(const p of planned)if(p.before!==p.after)fs.writeFileSync(p.filename,p.after,"utf8");
  const dest=path.join(root,"public","mutiny-mark.png");
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(logo,dest);
  console.log("Patched Linux sidebar and conservative offline presentation; source files edited: "+planned.filter(p=>p.before!==p.after).length);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error("Usage: node tools/repair-linux-ui.mjs <source-directory>");
  repairLinuxUi(path.resolve(process.argv[2]));
}
