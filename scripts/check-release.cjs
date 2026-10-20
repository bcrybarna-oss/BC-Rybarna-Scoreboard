'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..');
function applicationVersion(html){
 const patterns=[/class="modern-brand-version">v(4\.51\.\d+) RC</,/margin-top:5px">v(4\.51\.\d+) RC</,/font-size:11px">RC v(4\.51\.\d+)</,/appVersion:'v(4\.51\.\d+) RC'/];
 const versions=patterns.map(re=>{const m=html.match(re);if(!m)throw Error('Chybí aktivní místo verze: '+re);return m[1];});
 if(new Set(versions).size!==1)throw Error('Aktivní verze nejsou konzistentní: '+versions.join(', '));
 return versions[0];
}
function isApplicationPath(file){
 return file==='index.html'||file==='overlay.html'||file==='download'||/^assets\//.test(file)||/^(?:icon[^/]*|.*logo[^/]*)\.(?:png|jpg|svg|webp)$/i.test(file)||/^(?:capacitor\.config\.|android\/|ios\/)/.test(file);
}
function validateRelease({html,revize,status,baseHtml,changed=[]}){
 const version=applicationVersion(html),label='v'+version+' RC';
 const entry=revize.split(/^## /m).slice(1).find(s=>s.split('\n')[0].includes(label));
 if(!entry)throw Error('REVIZE.md nemá záznam '+label);
 if(!new RegExp('Aktuální verze:\\s*\\*\\*v'+version.replaceAll('.','\\.')+' RC\\*\\*').test(status))throw Error('PROJECT_STATUS.md neuvádí aktuální '+label);
 for(const field of ['Zadavatel','Datum','Změny','Testy','Nasazení','Omezení'])if(!new RegExp('^'+field+':\\s*\\S','m').test(entry))throw Error('Revizi chybí pole '+field);
 if(!/^Zadavatel:\s*(Dominik|Jaroslav)\s*$/m.test(entry))throw Error('Revize musí uvádět Dominika nebo Jaroslava');
 if(baseHtml){
  const base=applicationVersion(baseHtml),n=Number(version.split('.')[2]),old=Number(base.split('.')[2]);
  if(changed.some(isApplicationPath)&&n!==old+1)throw Error('Změna aplikace vyžaduje zvýšení verze podle základního main o 1: '+base+' → '+version);
  if(n<old)throw Error('Verze nesmí klesnout');
 }
 return label;
}
function main(){
 const index=process.argv.indexOf('--base'),base=index<0?null:process.argv[index+1];
 if(index>=0&&(!base||!/^[-\w./]+$/.test(base)||base.startsWith('-')))throw Error('Neplatný základ porovnání');
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024});
 const read=file=>fs.readFileSync(path.join(root,file),'utf8');
 const changed=base?git(['diff','--name-only',base,'--']).trim().split(/\r?\n/).filter(Boolean):[];
 const label=validateRelease({html:read('index.html'),revize:read('REVIZE.md'),status:read('PROJECT_STATUS.md'),baseHtml:base?git(['show',base+':index.html']):null,changed});
 console.log('PASS release: '+label+(base?' proti '+base:' – konzistence a dokumentace'));
}
module.exports={applicationVersion,isApplicationPath,validateRelease};
if(require.main===module){try{main();}catch(e){console.error('RELEASE CHECK FAILED: '+e.message);process.exitCode=1;}}
