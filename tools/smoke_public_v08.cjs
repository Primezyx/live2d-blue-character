const fs=require('fs'),path=require('path'),assert=require('assert/strict');
let playwright;try{playwright=require('./web-deps/node_modules/playwright');}catch{playwright=require('playwright');}
const {chromium}=playwright;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1380,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8881/?dance=1&v=limbs-v08',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.previewApp?.viewer&&previewApp.capture.time>.3);
  const info=await page.evaluate(()=>({label:document.querySelector('#model-label').textContent,download:document.querySelector('#download').getAttribute('href'),motion:document.querySelector('.dance-actions a').getAttribute('href'),counts:previewApp.viewer.getModelCounts(),state:previewApp.capture.getState()}));
  assert.equal(info.counts.parameters,24);assert.equal(info.counts.drawables,14);
  assert.equal(info.download,'./downloads/model-v08.zip');assert.equal(info.motion,'./downloads/BlueCharacter-limbs-dance.motion3.json');
  assert.equal(info.state.profile,'dance');assert(info.label.includes('肢体舞蹈'));
  await page.evaluate(()=>previewApp.capture.seek(3.5));
  await page.screenshot({path:path.resolve(__dirname,'../delivery/preview-v08.png')});
  assert.deepEqual(errors,[]);
  const out=path.resolve(__dirname,'../validation/public-preview-v08.json');
  fs.writeFileSync(out,JSON.stringify({passed:true,...info,errors},null,2));
  console.log(JSON.stringify({passed:true,label:info.label,counts:info.counts,url:page.url()}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
