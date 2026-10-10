const fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),preview=path.resolve(root,process.argv[2]||'delivery/preview');
(async()=>{
const {sampleDance,DANCE_DURATION}=await import(pathToFileURL(path.join(preview,'dance.js')).href);
const ids=Object.keys(sampleDance(0).parameters),fps=60,count=DANCE_DURATION*fps;
const curves=ids.map(id=>{
 const segments=[0,sampleDance(0).parameters[id]];
 for(let i=1;i<=count;i++)segments.push(0,Number((i/fps).toFixed(6)),Number(sampleDance(i/fps).parameters[id].toFixed(6)));
 return {Target:'Parameter',Id:id,Segments:segments};
});
const motion={Version:3,Meta:{Duration:DANCE_DURATION,Fps:fps,Loop:false,AreBeziersRestricted:true,CurveCount:curves.length,TotalSegmentCount:count*curves.length,TotalPointCount:(count+1)*curves.length,UserDataCount:0,TotalUserDataSize:0},FadeInTime:.25,FadeOutTime:.3,Curves:curves};
fs.writeFileSync(path.join(preview,'downloads','BlueCharacter-limbs-dance.motion3.json'),JSON.stringify(motion));
fs.copyFileSync(path.join(preview,'downloads','BlueCharacter-limbs-dance.motion3.json'),path.join(root,'delivery','BlueCharacter-limbs-dance.motion3.json'));
const model=JSON.parse(fs.readFileSync(path.join(preview,'model-v08','BlueCharacter.model3.json'),'utf8'));
model.FileReferences.Motions.Dance=[{File:'BlueCharacter.dance.motion3.json'}];
fs.copyFileSync(path.join(preview,'downloads','BlueCharacter-limbs-dance.motion3.json'),path.join(preview,'model-v08','BlueCharacter.dance.motion3.json'));
fs.writeFileSync(path.join(preview,'model-v08','BlueCharacter.model3.json'),JSON.stringify(model,null,2));
console.log('Built native Cubism dance motion:',curves.length,'curves,',DANCE_DURATION,'seconds.');
})().catch(e=>{console.error(e);process.exit(1)});
