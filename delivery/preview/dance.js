/** Original 48-beat choreography; deterministic for playback and scrubbing. */
export const DANCE_DURATION=24;
export const DANCE_BPM=120;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const wave=(t,period,phase=0)=>Math.sin(t*Math.PI*2/period+phase);
const boundaries=[2,8,12,16,20,22];
const names=['准备起舞','交替抬腿与摆臂','双手展开','左右挥手','加快小舞步','双手举起','收势回正'];
function phrase(index,t){
  const sway=wave(t,2),slow=wave(t,4),bounce=wave(t,.5);
  // The last three values are whole-character travel; all others deform Core meshes.
  return [
    [8*sway,3*wave(t,1),-4*sway,3*sway,2*bounce,3*sway,10*sway,-5*(1-wave(t,1)),.012*sway],
    [16*sway,4*wave(t,1),-10*sway,7*sway,3*bounce,6*sway,24*sway,-9*(1-wave(t,1)),.025*sway],
    [12*slow,9*bounce,-7*slow,6*slow,5*bounce,5*slow,18*slow,-18*Math.pow(Math.sin(t*Math.PI*2),2),.019*slow],
    [18*slow,7*wave(t,2),10*wave(t,4,.5),8*slow,4*wave(t,2),6*wave(t,4,-.4),25*slow,-7*(1-wave(t,2)),.024*slow],
    [15*sway,6*bounce,-11*sway,7*sway,4*bounce,7*sway,26*sway,-12*Math.pow(Math.sin(t*Math.PI*2),2),.027*sway],
    [12*slow,4*wave(t,1),11*slow,6*slow,2*bounce,6*slow,17*slow,-6*(1-wave(t,1)),.018*slow],
    [4*slow,-12*Math.sin(Math.PI*clamp((t-22)/2,0,1)),3*slow,2*slow,3*wave(t,2),2*slow,6*slow,0,.006*slow],
  ][index];
}

function articulated(t,gain) {
  const intro=ease(t/2), fast=ease((t-15.7)/.6)*(1-ease((t-19.7)/.6));
  const step=wave(t,2)*(1-fast)+wave(t,1)*fast;
  const liftR=Math.max(0,step),liftL=Math.max(0,-step);
  let arms=[15+26*liftL,15+26*liftR,18+34*liftL,18+34*liftR];
  const open=ease((t-7.7)/.6)*(1-ease((t-11.7)/.6));
  const waveHands=ease((t-11.7)/.6)*(1-ease((t-15.7)/.6));
  const finish=ease((t-19.7)/.6);
  const blend=(b,w)=>{arms=arms.map((x,i)=>x+(b[i]-x)*w);};
  blend([43,43,48+7*wave(t,2),48-7*wave(t,2)],open);
  blend([35+17*wave(t,2),35-17*wave(t,2),42+12*wave(t,2),42-12*wave(t,2)],waveHands);
  blend([44,44,52,52],finish);
  const steps=(1-ease((t-21)/1.3))*intro;
  return {
    ParamArmR:clamp(arms[0]*gain*intro,-48,48),
    ParamArmL:clamp(-arms[1]*gain*intro,-48,48),
    ParamElbowR:clamp(arms[2]*gain*intro,-58,58),
    ParamElbowL:clamp(-arms[3]*gain*intro,-58,58),
    ParamHipR:clamp(14*liftR*gain*steps,-17,17),
    ParamHipL:clamp(-14*liftL*gain*steps,-17,17),
    ParamKneeR:clamp(-32*liftR*gain*steps,-34,34),
    ParamKneeL:clamp(32*liftL*gain*steps,-34,34),
  };
}

export function sampleDance(seconds,strength=1){
  const t=clamp(Number.isFinite(seconds)?seconds:0,0,DANCE_DURATION);
  const envelope=ease(t/.8)*(1-ease((t-22.8)/1.2));
  const section=boundaries.filter(x=>t>=x).length;
  let pose=phrase(section,t);
  for(let i=0;i<boundaries.length;i++){
    const edge=boundaries[i];
    if(Math.abs(t-edge)<.2){
      const a=phrase(i,t),b=phrase(i+1,t),mix=ease((t-edge+.2)/.4);
      pose=a.map((x,j)=>x+(b[j]-x)*mix);break;
    }
  }
  const gain=envelope*clamp(Number.isFinite(strength)?strength:1,.2,1.5);
  const blink=(center,width=.15)=>1-Math.exp(-Math.pow((t-center)/width,2));
  const eyes=Math.min(...[3.7,7.7,11.7,15.7,19.7].map(x=>blink(x)));
  return {section:names[section],beat:Math.floor(t*DANCE_BPM/60)%4,
    parameters:{
      ...articulated(t,gain),
      ParamAngleX:pose[0]*gain,ParamAngleY:pose[1]*gain,ParamAngleZ:pose[2]*gain,
      ParamBodyAngleX:clamp(pose[3]*gain*.45,-9,9),ParamBodyAngleY:clamp(pose[4]*gain*.3,-7,7),
      ParamBodyAngleZ:clamp(pose[5]*gain*.55,-9,9),
      ParamEyeLOpen:1-(1-Math.min(eyes,blink(21,.25)))*envelope,
      ParamEyeROpen:1-(1-eyes)*envelope,
      ParamMouthOpenY:envelope*(.04+.07*Math.max(0,wave(t,2))),
      ParamBreath:envelope*(.25+.18*wave(t,2)),
      ParamFrontHairSideLSwing:gain*.32*wave(t,2,-.7),
      ParamFrontHairSideRSwing:gain*.28*wave(t,2,-1),
    },transform:{x:0,y:0,rotation:0}};
}
/** Optional original electronic beat. Audio starts only after a user gesture. */
export class DanceBeat{
  constructor(){this.enabled=false;this.context=null;this.lastBeat=-1;this.nodes=new Set();}
  async enable(enabled){
    this.enabled=enabled;
    if(!enabled){this.stop();return;}
    try{this.context??=new(window.AudioContext||window.webkitAudioContext)();await this.context.resume();this.lastBeat=-1;}
    catch{this.enabled=false;}
  }
  stop(){for(const node of this.nodes){try{node.stop();}catch{}}this.nodes.clear();this.lastBeat=-1;}
  tick(state){
    if(!this.enabled||!this.context||state.mode!=='simulation'||state.profile!=='dance'||state.paused){this.stop();return;}
    const beat=Math.floor(state.time*DANCE_BPM/60);
    if(beat===this.lastBeat)return;
    this.lastBeat=beat;const ctx=this.context,now=ctx.currentTime;
    const play=(frequency,endFrequency,length,volume,type)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;
      osc.frequency.setValueAtTime(frequency,now);osc.frequency.exponentialRampToValueAtTime(endFrequency,now+length);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.006);gain.gain.exponentialRampToValueAtTime(.0001,now+length);
      osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+length+.02);
      this.nodes.add(osc);osc.onended=()=>{this.nodes.delete(osc);osc.disconnect();gain.disconnect();};
    };
    play(beat%2?180:120,beat%2?95:45,.12,.07,'sine');
    const melody=[523.25,659.25,783.99,659.25,587.33,698.46,880,783.99];
    const note=melody[beat%melody.length];play(note,note,.21,.025,'triangle');
  }
}
