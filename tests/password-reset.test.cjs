'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const begin='  async function cloudRequestPasswordReset(){',start=html.indexOf(begin),end=html.indexOf('\n  }\n',start);
assert.ok(start>=0&&end>start);
const fn=html.slice(start,end+4);
function mock(email,response){
 const els={cloudEmail:{value:email},cloudResetPasswordMessage:{textContent:''},cloudResetPasswordBtn:{disabled:false},cloudLoginMessage:{textContent:'Bad login'},cloudPassword:{value:'unrelated-secret'}},requests=[];
 const c={FIREBASE_API_KEY:'test-key',$:id=>els[id],fetch:async(url,options)=>{requests.push({url,options});if(response instanceof Error)throw response;return response||{ok:true}}};
 vm.createContext(c);vm.runInContext(fn,c);return {els,requests,run:()=>c.cloudRequestPasswordReset()};
}
test('visible reset control with bound handler, no old DEV login title',()=>{
 assert.match(html,/id="cloudResetPasswordBtn"[^>]*>ZAPOMENUTÉ HESLO\?/);
 assert.match(html,/id="cloudResetPasswordMessage"[^>]*role="status"/);
 assert.match(html,/\$\('cloudResetPasswordBtn'\)\.onclick=cloudRequestPasswordReset/);
 assert.doesNotMatch(html,/<h2>☁ SCOREBOARD 4\.0 DEV<\/h2>/);
});
test('email required before sending; nothing mutates password',async()=>{
 for(const address of ['', 'oops', 'a@']){const h=mock(address);await h.run();assert.equal(h.requests.length,0);assert.match(h.els.cloudResetPasswordMessage.textContent,/platný e-mail/);assert.equal(h.els.cloudResetPasswordBtn.disabled,false);assert.equal(h.els.cloudPassword.value,'unrelated-secret');}
});
test('valid address triggers anonymous POST PASSWORD_RESET and keeps identity untouched',async()=>{
 const h=mock('  test@example.cz  ');await h.run();
 assert.equal(h.requests.length,1);
 const {url,options}=h.requests[0];assert.match(url,/identitytoolkit\.googleapis\.com\/v1\/accounts:sendOobCode\?key=test-key/);
 assert.equal(options.method,'POST');assert.equal(options.headers['Content-Type'],'application/json');
 assert.deepEqual(JSON.parse(options.body),{requestType:'PASSWORD_RESET',email:'test@example.cz'});
 assert.doesNotMatch(options.body,/unrelated-secret|idToken|refreshToken/);
 assert.match(h.els.cloudResetPasswordMessage.textContent,/Pokud je e-mail registrovaný/);
 assert.equal(h.els.cloudPassword.value,'unrelated-secret');assert.equal(h.els.cloudResetPasswordBtn.disabled,false);
});
test('unknown email does not reveal whether account exists',async()=>{
 const h=mock('missing@example.cz',{ok:false,status:400,json:async()=>({error:{message:'EMAIL_NOT_FOUND'}})});await h.run();
 assert.equal(h.els.cloudResetPasswordMessage.textContent,'Pokud je e-mail registrovaný, přijde na něj odkaz pro nastavení nového hesla. Zkontroluj také spam.');
 assert.equal(h.els.cloudResetPasswordBtn.disabled,false);
});
test('network error and provider throttling do not claim an email was sent',async()=>{
 for(const [res,pattern] of [[new Error('Failed to fetch'),/Nelze se spojit/],[{ok:false,status:429,json:async()=>({error:{message:'TOO_MANY_ATTEMPTS_TRY_LATER'}})},/příliš mnoho žádostí/],[{ok:false,status:500,json:async()=>({error:{message:'INTERNAL_ERROR'}})},/nepodařilo odeslat/]]){
 const h=mock('test@example.cz',res);await h.run();assert.match(h.els.cloudResetPasswordMessage.textContent,pattern);assert.equal(h.els.cloudResetPasswordBtn.disabled,false);
 }
});
