(() => {
  "use strict";
  if (globalThis.__prCodeOnlyLoaded) return;
  globalThis.__prCodeOnlyLoaded = true;
  const { classifyFile, isPullRequestFiles } = globalThis.PRCodeOnlyRules;
  const { collectFiles } = globalThis.PRCodeOnlyDOM;
  const { parsePatch, patchUrl } = globalThis.PRCodeOnlyPatch;
  const KEY = "prCodeOnlyOptions";
  const options = {enabled:false, filterFiles:true};
  let host, toggle, filter, status, stats, timer=null, marked=new Set(), previousURL=location.href, statsKey="";
  const remember=(node, cls)=>{if(node){node.classList.add(cls);marked.add(node);}};
  function restore(){document.body.classList.remove("prco-active");for(const n of marked)n.classList.remove("prco-hidden-file");marked.clear();}
  function setStatus(message){if(status)status.textContent=message;}
  function createToolbar(){
    if(host?.isConnected)return;
    host=document.createElement("div");host.id="prco-toolbar";const shadow=host.attachShadow({mode:"open"});
    const style=document.createElement("style");style.textContent=":host{font:13px/1.4 system-ui,sans-serif;color-scheme:light dark}section{background:#161b22;color:#f0f6fc;border:1px solid #57606a;border-radius:10px;padding:12px;box-shadow:0 4px 20px #0005;max-width:390px}button{background:#238636;color:white;border:1px solid #3fb950;border-radius:6px;padding:7px 10px;cursor:pointer;font:inherit}button:focus-visible,input:focus-visible{outline:3px solid #58a6ff;outline-offset:3px}label{display:block;margin-top:8px;cursor:pointer}input{margin-right:7px}p{margin:8px 0 0;font-size:12px;max-width:380px}";
    const panel=document.createElement("section");panel.setAttribute("aria-label","GitHub PR Code Only");
    toggle=document.createElement("button");toggle.type="button";toggle.addEventListener("click",()=>{options.enabled=!options.enabled;persist();schedule();});panel.append(toggle);
    const label=document.createElement("label");filter=document.createElement("input");filter.type="checkbox";filter.addEventListener("change",()=>{options.filterFiles=filter.checked;persist();schedule();});label.append(filter,document.createTextNode("Ocultar arquivos que não são código"));panel.append(label);
    stats=document.createElement("p");stats.setAttribute("role","status");stats.setAttribute("aria-live","polite");panel.append(stats);
    status=document.createElement("p");status.setAttribute("role","status");status.setAttribute("aria-live","polite");panel.append(status);shadow.append(style,panel);document.body.append(host);
  }
  function persist(){chrome.storage.local.set({[KEY]:options}).catch(()=>{});}
  async function updateStats(){
    const url=patchUrl(location.pathname);if(!url){setStatus("Não foi possível localizar o patch deste PR.");return;}
    if (statsKey === url && stats?.textContent) return;
    statsKey = url;
    try{const response=await fetch(url,{credentials:"include",headers:{accept:"text/plain"}});if(!response.ok)throw new Error("HTTP "+response.status);
      const totals=parsePatch(await response.text(),classifyFile);stats.textContent="Código: +"+totals.code.added+" -"+totals.code.deleted+" · "+totals.codeFiles+" arquivos de código (de "+totals.files+" no PR)";
    }catch(error){stats.textContent="Código: contagem indisponível (patch não acessível)";console.warn("[PR Code Only] Patch:",error);}
  }
  function apply(){
    timer=null;try{restore();if(!isPullRequestFiles(location.pathname)){host?.remove();return;}createToolbar();toggle.textContent=options.enabled?"Restaurar página normal":"Ativar somente código";filter.checked=options.filterFiles;
      if(!options.enabled){setStatus("Modo normal. Ative para focar nos arquivos de código.");return;}
      const entries=collectFiles(document);let hidden=0,unknown=0;
      for(const entry of entries){const kind=classifyFile(entry.path);if(kind==="unknown")unknown++;if(options.filterFiles&&kind==="non-code"){remember(entry.treeElement,"prco-hidden-file");remember(entry.diffElement,"prco-hidden-file");hidden++;}}
      document.body.classList.add("prco-active");setStatus(hidden+" arquivos não código ocultados · "+unknown+" caminhos não identificados mantidos visíveis.");
      updateStats();
    }catch(error){restore();options.enabled=false;setStatus("Falha no filtro; página restaurada.");console.warn("[PR Code Only]",error);}}
  function schedule(){if(timer===null)timer=setTimeout(apply,150);}
  const observer=new MutationObserver(()=>{if(isPullRequestFiles(location.pathname)||marked.size||host?.isConnected)schedule();});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&options.enabled){options.enabled=false;persist();schedule();}});
  document.addEventListener("turbo:load",schedule);document.addEventListener("pjax:end",schedule);window.addEventListener("popstate",schedule);
  setInterval(()=>{if(location.href!==previousURL){previousURL=location.href;schedule();}},1000);
  function read(value){if(value&&typeof value==="object")for(const key of Object.keys(options))if(typeof value[key]==="boolean")options[key]=value[key];}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local"&&changes[KEY]){read(changes[KEY].newValue);schedule();}});
  chrome.storage.local.get(KEY).then(result=>read(result[KEY])).catch(()=>{}).finally(()=>{observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["data-path","data-file-path","title","id"]});schedule();});
})();
