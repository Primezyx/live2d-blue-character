const fs=require('fs'),path=require('path'),assert=require('assert/strict');
let playwright;try{playwright=require('./web-deps/node_modules/playwright');}catch{playwright=require('playwright');}
const {chromium}=playwright;
const root=path.resolve(__dirname,'..'),out=path.join(root,'validation','coordinated-dance-v08');fs.mkdirSync(out,{recursive:true});
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const errors=[],failedRequests=[],report={checks:[],poses:[]};
try{
 const page=await browser.newPage({viewport:{width:1380,height:1080},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)failedRequests.push({url:r.url(),status:r.status()});});
 await page.goto((process.env.PREVIEW_URL||'http://127.0.0.1:8881/')+'?dance=1&revision=dance-v08',{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>window.previewApp?.viewer,{},{timeout:60000});
 const ready=await page.evaluate(()=>({core:previewApp.readyInfo.coreVersion,counts:previewApp.viewer.getModelCounts(),state:previewApp.capture.getState()}));
 assert.equal(ready.state.profile,'dance');assert.equal(ready.state.mode,'simulation');
 report.core=ready.core;report.counts=ready.counts;report.checks.push('Real Cubism model loaded and dance autoplay started');
 const math=await page.evaluate(async()=>{
   const {sampleDance}=await import('./dance.js');const ps=previewApp.viewer.getParameters();let maxStep=0;
   let prev;
   for(let i=0;i<=1440;i++){
     const pose=sampleDance(i/60);
     for(const [id,value]of Object.entries(pose.parameters)){
       const p=ps.find(x=>x.id===id);if(!p||!Number.isFinite(value)||value<p.min-1e-6||value>p.max+1e-6)throw Error('Invalid parameter '+id);
       if(prev)maxStep=Math.max(maxStep,Math.abs(value-prev.parameters[id]));
     }
     prev=pose;
   }
   return {maxStep,first:sampleDance(0),last:sampleDance(24)};
 });
 for(const id of Object.keys(math.first.parameters))assert(Math.abs(math.first.parameters[id]-math.last.parameters[id])<1e-8);
 report.math=math;report.checks.push('All 1,441 sampled poses are finite and within actual Core parameter ranges; endpoints match');

 const jointEvidence=await page.evaluate(()=>{
   const v=previewApp.viewer;previewApp.capture.stop();v.reset();v.renderNow();
   const base=v.getDrawableState(),ids=['ParamArmR','ParamElbowR','ParamArmL','ParamElbowL','ParamHipR','ParamKneeR','ParamHipL','ParamKneeL'];
   const evidence=[];
   for(const id of ids){
     v.reset();v.setParameter(id,id.includes('Arm')?40:id.includes('Elbow')?50:16);v.renderNow();
     const current=v.getDrawableState();
     const changed=current.positions.map((vertices,i)=>({mesh:current.ids[i],delta:Math.max(...vertices.map((n,j)=>Math.abs(n-base.positions[i][j])))})).filter(x=>x.delta>1e-5);
     evidence.push({id,changed});
   }
   v.reset();previewApp.capture.startSimulation('dance');
   return evidence;
 });
 for(const e of jointEvidence){assert.equal(e.changed.length,1,e.id+' should affect exactly its own limb');assert(e.changed[0].delta>.01,e.id+' must visibly bend a limb');}
 report.jointEvidence=jointEvidence;report.checks.push('All eight joints independently move exactly the intended real limb mesh');
 const coordination=await page.evaluate(async()=>{
   const {sampleDance}=await import('./dance.js');return [sampleDance(2.5).parameters,sampleDance(3.5).parameters];
 });
 assert(coordination[0].ParamHipR>10&&Math.abs(coordination[0].ParamHipL)<.001);
 assert(coordination[1].ParamHipL< -10&&Math.abs(coordination[1].ParamHipR)<.001);
 assert(Math.abs(coordination[0].ParamArmL)>Math.abs(coordination[0].ParamArmR));
 assert(Math.abs(coordination[1].ParamArmR)>Math.abs(coordination[1].ParamArmL));
 report.checks.push('Left/right leg lifts alternate and opposite arms lead the step');
 const topology=await page.evaluate(()=>{
   const v=previewApp.viewer,c=previewApp.capture;c.seek(0);v.renderNow();
   const base=v.getDrawableState();
   const area=(p,a,b,c)=>(p[b*2]-p[a*2])*(p[c*2+1]-p[a*2+1])-(p[b*2+1]-p[a*2+1])*(p[c*2]-p[a*2]);
   let flipped=0;const byMesh={},examples=[];
   for(const strength of [.2,1,1.5]){c.setOptions({strength});
   for(let t=0;t<=24;t+=.125){
     c.seek(t);v.renderNow();const now=v.getDrawableState();
     for(let m=0;m<now.ids.length;m++){
       if(!/Handwear|Legwear/.test(now.ids[m]))continue;
       const ix=now.indices[m];
       for(let k=0;k<ix.length;k+=3){
         const a=area(base.positions[m],ix[k],ix[k+1],ix[k+2]),b=area(now.positions[m],ix[k],ix[k+1],ix[k+2]);
         if(Math.abs(a)>1e-9&&a*b < -1e-12){flipped++;byMesh[now.ids[m]]=(byMesh[now.ids[m]]||0)+1;if(examples.length<10)examples.push({t,strength,mesh:now.ids[m],triangle:k/3,a,b});}
       }
     }
   }
   }
   c.setOptions({strength:1});
   return {samples:579,flipped,byMesh,examples};
 });
 report.topology=topology;
 assert.equal(topology.flipped,0,'No limb triangle may reverse orientation at low/default/maximum dance strength');report.checks.push('579 real Core poses across three strengths contain no reversed limb triangles');

 for(const t of [0,2.5,3.5,8.5,12.5,13.5,17.25,20.5,23.25,24]){
   const actual=await page.evaluate(t=>{
     previewApp.capture.seek(t);previewApp.viewer.renderNow();
     return {time:t,state:previewApp.viewer.getState(),drawables:previewApp.viewer.getDrawableState()};
   },t);
   if(t===0)report.neutral=actual;
   report.poses.push(actual);
   const frame=await page.evaluate(()=>previewApp.viewer.capture());fs.writeFileSync(path.join(out,'canvas-'+String(t).replace('.','-')+'.png'),Buffer.from(frame.split(',')[1],'base64'));
   await page.locator('#stage').screenshot({path:path.join(out,'pose-'+String(t).replace('.','-')+'.png')});
 }
 const base=report.poses[0].drawables.positions;
 let maxVertexDelta=0;
 for(const pose of report.poses)pose.drawables.positions.forEach((mesh,i)=>mesh.forEach((n,j)=>maxVertexDelta=Math.max(maxVertexDelta,Math.abs(n-base[i][j]))));
 assert(maxVertexDelta>0.005,'Dance should change actual Core vertices');
 report.maxVertexDelta=maxVertexDelta;report.checks.push('Real mesh vertices move across choreography poses');
 await page.evaluate(()=>previewApp.capture.seek(3.25));
 const frozen=await page.evaluate(()=>({state:previewApp.viewer.getState(),mesh:previewApp.viewer.getDrawableState()}));
 await page.waitForTimeout(350);
 const frozenLater=await page.evaluate(()=>({state:previewApp.viewer.getState(),mesh:previewApp.viewer.getDrawableState()}));
 assert.deepEqual(frozen,frozenLater);report.checks.push('Pause freezes Core geometry, parameters and root travel');
 await page.screenshot({path:path.join(out,'preview.png')});
 await page.click('#dance-sound');await page.click('#capture-pause');
 await page.waitForFunction(()=>previewApp.capture.time>3.8);
 const audio=await page.evaluate(()=>({enabled:previewApp.danceBeat.enabled,state:previewApp.danceBeat.context?.state,beat:previewApp.danceBeat.lastBeat}));
 assert(audio.enabled&&audio.state==='running'&&audio.beat>=0);report.audio=audio;
 await page.click('#capture-stop');
 const stopped=await page.evaluate(()=>({mode:previewApp.capture.mode,transform:previewApp.viewer.getState().stageTransform,nodes:previewApp.danceBeat.nodes.size}));
 assert.equal(stopped.mode,'idle');assert.deepEqual(stopped.transform,{x:0,y:0,rotation:0});assert.equal(stopped.nodes,0);
 report.checks.push('Optional beat starts from a click; stop silences it and restores position');
 await page.click('#dance-play');
 await page.evaluate(()=>{previewApp.capture.seek(23.7);previewApp.capture.resume();});
 await page.waitForFunction(()=>previewApp.capture.paused&&previewApp.capture.time===24);
 const done=await page.evaluate(()=>({state:previewApp.capture.getState(),transform:previewApp.viewer.getState().stageTransform}));
 for(const n of Object.values(done.transform))assert(Math.abs(n)<1e-8);report.checks.push('One-shot dance completes and returns to neutral');
 await page.check('#dance-loop');
 await page.click('#dance-play');
 await page.evaluate(()=>{previewApp.capture.seek(23.85);previewApp.capture.resume();});
 await page.waitForFunction(()=>previewApp.capture.time<2&&!previewApp.capture.paused);
 report.checks.push('Loop restarts the timeline without pausing');
 await page.click('[data-profile="face"]');
 const other=await page.evaluate(()=>({profile:previewApp.capture.profile,transform:previewApp.viewer.getState().stageTransform}));
 assert.equal(other.profile,'face');assert.deepEqual(other.transform,{x:0,y:0,rotation:0});
 await page.click('#reset-all');report.checks.push('Existing demo and reset controls still work');
 await page.setViewportSize({width:390,height:844});
 await page.click('#dance-play');await page.evaluate(()=>previewApp.capture.seek(3.25));
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 assert.equal(overflow,false);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
 report.checks.push('Mobile layout has no horizontal overflow');
 // Validate the exported .motion3 with the actual pinned Cubism motion parser.
 await page.evaluate(async()=>{
   previewApp.capture.stop();previewApp.viewer.destroy();
   const oldCanvas=document.querySelector('#model-canvas'),freshCanvas=document.createElement('canvas');freshCanvas.id='model-canvas';oldCanvas.replaceWith(freshCanvas);
   const {createViewer}=await import('./runtime.js');
   window.nativeDance=await createViewer({canvas:document.querySelector('#model-canvas'),modelUrl:'./model-v08/BlueCharacter.model3.json'});
   if(!await nativeDance.playMotion('Dance'))throw Error('Native Dance did not start');
 });
 await page.waitForTimeout(1800);
 const native=await page.evaluate(()=>({state:nativeDance.getState(),mesh:nativeDance.getDrawableState()}));
 assert(Object.values(native.state.parameters).some((n,i)=>Math.abs(n)>0.1));
 assert(Math.abs(native.state.parameters.ParamBodyAngleX)>0.2,'Native motion must animate body parameter');
 report.nativeMotion={parameters:native.state.parameters,loaded:true};report.checks.push('Exported native motion loaded and animates through real Cubism motion manager');
 assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
 report.passed=true;report.errors=errors;report.failedRequests=failedRequests;
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:true,checks:report.checks,core:report.core,maxVertexDelta},null,2));
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
