/**
 * Twin roadside barriers for TinyTorque.
 *
 * Pure geometry and 2-D swept-circle collision. No Three.js dependency.
 * Rails sit outside the tarmac, leaving a narrow grass runoff.
 * All visual geometry and collisions use the exact same segments.
 */
export const DEFAULT_RUNOFF = 2.5;
export const DEFAULT_CAR_RADIUS = 1.30;
export const WALL_HEIGHT = 1.55;

export function createGuardrailTrack(center, roadWidth, runoff = DEFAULT_RUNOFF) {
  if (!Array.isArray(center) || center.length < 3) {
    throw new Error('At least three centerline points are required');
  }
  const count=center.length;
  const distance=roadWidth/2+runoff;
  const sides=[-1,1].map(side=>{
    const points=center.map((point,i)=>{
      const previous=center[(i+count-1)%count];
      const next=center[(i+1)%count];
      const dx=next.x-previous.x,dz=next.z-previous.z;
      const mag=Math.hypot(dx,dz)||1;
      return {x:point.x+side*dz/mag*distance,z:point.z-side*dx/mag*distance};
    });
    return {
      side,points,
      segments:points.map((a,i)=>{
        const b=points[(i+1)%count];
        const dx=b.x-a.x,dz=b.z-a.z,mag=Math.hypot(dx,dz)||1;
        return {i,ax:a.x,az:a.z,bx:b.x,bz:b.z,
          outX:side*dz/mag,outZ:-side*dx/mag,
          dx,dz,len2:dx*dx+dz*dz};
      })
    };
  });
  return {sides,count,roadWidth,runoff,distance};
}
export function projectToSegment(x,z,segment) {
  const t=Math.max(0,Math.min(1,((x-segment.ax)*segment.dx+(z-segment.az)*segment.dz)/Math.max(segment.len2,1e-9)));
  const px=segment.ax+t*segment.dx;
  const pz=segment.az+t*segment.dz;
  return {px,pz,t,dist2:(x-px)**2+(z-pz)**2,
    signed:(x-px)*segment.outX+(z-pz)*segment.outZ};
}
/**
 * Continuously detect crossing of a line segment with a moving circle.
 * Returns earliest contact against a rail side on the expected route section.
 * Local indexed searches avoid accidental impacts with nearby hairpin branches.
 */
export function collideWithGuardrails(state, rails, progressIndex, dt, options = {}) {
  const radius=options.radius??DEFAULT_CAR_RADIUS;
  const restitution=options.restitution??0.17;
  const friction=options.friction??0.21;
  const window=Math.min(rails.count>>1,options.window??21);
  const count=rails.count;
  const oldX=options.oldX??state.x-state.vx*dt;
  const oldZ=options.oldZ??state.z-state.vz*dt;
  let impacts=0,maxImpact=0;
  // Up to three resolution passes handle inside corners and simultaneous contacts.
  for(let attempt=0;attempt<3;attempt++) {
    let collision=null,priority=Infinity;
    for(const side of rails.sides) {
      for(let d=-window;d<=window;d++) {
        const seg=side.segments[(progressIndex+d+count)%count];
        const proj=projectToSegment(state.x,state.z,seg);
        // A line-strip collision uses the wall's inward-facing normal.
        // Endpoint contacts are considered near the segment but not across a distant branch.
        const reach=(proj.t===0||proj.t===1)?radius+0.65:radius+0.08;
        if(proj.dist2>(reach+Math.max(0,proj.signed))**2 &&
            proj.signed < -radius)continue;
        if(proj.signed<=-radius)continue;
        // Only accept the corridor side for this segment. In severe overlap
        // select the strongest penetration, otherwise the nearest segment.
        const penalty=(proj.signed+radius);
        const score=proj.dist2 - Math.min(penalty,8)*1.2;
        if(score<priority) {priority=score;collision={seg,proj};}
      }
    }
    if(!collision)break;
    const {seg,proj}=collision;
    // Project toward the inside of the race course.
    const push=Math.min(80,proj.signed+radius+.018);
    state.x-=seg.outX*push;
    state.z-=seg.outZ*push;
    const outwardSpeed=state.vx*seg.outX+state.vz*seg.outZ;
    if(outwardSpeed>0) {
      const tx=-seg.outZ,tz=seg.outX;
      const tangentSpeed=state.vx*tx+state.vz*tz;
      const impact=Math.abs(outwardSpeed);
      maxImpact=Math.max(maxImpact,impact);
      state.vx=tx*tangentSpeed*(1-friction)-seg.outX*outwardSpeed*restitution;
      state.vz=tz*tangentSpeed*(1-friction)-seg.outZ*outwardSpeed*restitution;
      state.yawRate=(state.yawRate||0)*.75+Math.max(-.75,Math.min(.75,tangentSpeed*.009))*seg.outX;
      impacts++;
    }
  }
  state.speed=Math.hypot(state.vx,state.vz);
  return {impacts,maxImpact};
}
