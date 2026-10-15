import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
export default function Football({replay=0,opening=false,lang='zh',onComplete}:{replay?:number;opening?:boolean;lang?:'zh'|'en';onComplete?:()=>void}){
  const host=useRef<HTMLDivElement>(null);const initialIntro=useRef(sessionStorage.getItem('wcl-kickoff-v2')!=='seen');const [fallback,setFallback]=useState(false);const [intro,setIntro]=useState(initialIntro.current);
  const [leaving,setLeaving]=useState(false),complete=useRef(onComplete),skip=useRef<HTMLButtonElement>(null);complete.current=onComplete;
  useEffect(()=>{if(!opening)return;const overflow=document.body.style.overflow,focused=document.activeElement as HTMLElement;document.body.style.overflow='hidden';skip.current?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')complete.current?.();if(e.key==='Tab'){e.preventDefault();skip.current?.focus();}};document.addEventListener('keydown',escape);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',escape);focused?.focus();};},[opening]);
  useEffect(()=>{
    if(!host.current)return;const fly=(opening||replay>0||initialIntro.current)&&!matchMedia('(prefers-reduced-motion: reduce)').matches;setIntro(fly);setLeaving(false);if(!opening)sessionStorage.setItem('wcl-kickoff-v2','seen');
    const el=host.current;let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{setFallback(true);if(opening){const timer=setTimeout(()=>complete.current?.(),500);return()=>clearTimeout(timer);}return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);el.appendChild(renderer.domElement);
    const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(0,1.5,8);camera.lookAt(0,0,0);
    if(opening){camera.position.set(0,0,8);camera.lookAt(0,0,0);}
    scene.add(new THREE.HemisphereLight(0xfff8e7,0x153f33,3));
    const key=new THREE.DirectionalLight(0xffebc2,5);key.position.set(-3,5,5);scene.add(key);
    const rim=new THREE.DirectionalLight(0xb9eac6,4);rim.position.set(4,2,-3);scene.add(rim);
    const ball=new THREE.Group();scene.add(ball);
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(1,64,48),new THREE.MeshStandardMaterial({color:0xeeeade,roughness:.58,metalness:.03})));
    const icoGeometry=new THREE.IcosahedronGeometry(1,0),ico=icoGeometry.getAttribute('position');const directions:THREE.Vector3[]=[];
    for(let i=0;i<ico.count;i++){const v=new THREE.Vector3().fromBufferAttribute(ico,i).normalize();if(!directions.some(d=>d.distanceTo(v)<.001))directions.push(v);}
    icoGeometry.dispose();
    // Twelve curved pentagons, following the vertex directions of an icosahedron.
    directions.forEach(n=>{
      const u=new THREE.Vector3(0,1,0);if(Math.abs(n.y)>.9)u.set(1,0,0);
      u.cross(n).normalize();const v=new THREE.Vector3().crossVectors(n,u).normalize();const vertices:number[]=[];
      const point=(a:number,r:number)=>n.clone().addScaledVector(u,Math.cos(a)*r).addScaledVector(v,Math.sin(a)*r).normalize().multiplyScalar(1.004);
      for(let j=0;j<5;j++){
        const a=j*Math.PI*2/5,b=(j+1)*Math.PI*2/5;const p=point(a,.37),q=point(b,.37);
        const N=12;const vertex=(u:number,v:number)=>n.clone().multiplyScalar(1-u-v).addScaledVector(p,u).addScaledVector(q,v).normalize().multiplyScalar(1.009);
        for(let u=0;u<N;u++)for(let v=0;v<N-u;v++){
          vertices.push(...vertex(u/N,v/N).toArray(),...vertex((u+1)/N,v/N).toArray(),...vertex(u/N,(v+1)/N).toArray());
          if(u+v<N-1)vertices.push(...vertex((u+1)/N,v/N).toArray(),...vertex((u+1)/N,(v+1)/N).toArray(),...vertex(u/N,(v+1)/N).toArray());
        }
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
      ball.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x14251f,roughness:.75,side:THREE.DoubleSide})));
    });
    // Hexagon seams: the neighbouring pentagons are linked along great-circle arcs.
    directions.forEach((a,i)=>directions.slice(i+1).forEach(b=>{if(a.distanceTo(b)>1.1)return;const pa=a.clone().lerp(b,.35).normalize(),pb=a.clone().lerp(b,.65).normalize();const pts=Array.from({length:9},(_,k)=>pa.clone().lerp(pb,k/8).normalize().multiplyScalar(1.008));ball.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x797d70,transparent:true,opacity:.42})));}));
    const field=new THREE.Group();field.position.y=-1.45;field.rotation.x=-Math.PI/2;scene.add(field);
    const grid=new THREE.GridHelper(16,24,0x7b9d72,0x486b56);grid.rotation.x=Math.PI/2;field.add(grid);
    const circle=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:100},(_,i)=>new THREE.Vector3(Math.cos(i/100*Math.PI*2)*2.2,Math.sin(i/100*Math.PI*2)*2.2,.01))),new THREE.LineBasicMaterial({color:0xc2c39b,transparent:true,opacity:.4}));field.add(circle);
    const halo=new THREE.Mesh(new THREE.RingGeometry(1.7,1.72,100),new THREE.MeshBasicMaterial({color:0xe2b66a,transparent:true,opacity:.5,side:THREE.DoubleSide}));halo.position.z=-1.2;scene.add(halo);
    if(opening){halo.visible=false;field.visible=false;}
    let w=el.clientWidth,h=el.clientHeight;const resize=()=>{w=el.clientWidth;h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};resize();const ro=new ResizeObserver(resize);ro.observe(el);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const duration=reduced?650:1850;const introTimer=setTimeout(()=>{if(opening)complete.current?.();else setIntro(false);},opening?duration:1200);const fadeTimer=opening?setTimeout(()=>setLeaving(true),duration-300):undefined;const start=performance.now();let raf=0;let mx=0,my=0;
    const move=(e:PointerEvent)=>{const r=el.getBoundingClientRect();mx=(e.clientX-r.left)/r.width-.5;my=(e.clientY-r.top)/r.height-.5;};el.addEventListener('pointermove',move);
    const animate=()=>{const t=(performance.now()-start)/1000;
      if(opening){const p=Math.min(t/1.7,1);if(reduced){ball.position.set(0,0,0);ball.rotation.set(.2,.4,0);}else{ball.position.set(-1.6*(1-p),-.7*(1-p)+.65*Math.sin(p*Math.PI),-18+25*Math.pow(p,2.25));ball.rotation.set(-p*4,p*8,-p*.9);}}
      else if(fly&&t<1.15){const p=Math.min(t/1.15,1);ball.position.z=p<.64 ? -14+19*Math.pow(p/.64,2.3) : 5*(1-(p-.64)/.36);ball.position.y=.4*Math.sin(p*Math.PI);ball.rotation.set(p*3,p*6,p*.7);}else{ball.position.z=0;ball.position.y=reduced?0:Math.sin(t*.75)*.12;ball.rotation.y=reduced?.3:t*.17+mx*.3;ball.rotation.x=my*.25;}
      renderer.render(scene,camera);if(!reduced||t<.1)raf=requestAnimationFrame(animate);
    };animate();
    return()=>{clearTimeout(introTimer);clearTimeout(fadeTimer);cancelAnimationFrame(raf);ro.disconnect();el.removeEventListener('pointermove',move);scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();const m=o.material;(Array.isArray(m)?m:[m]).forEach(x=>x.dispose());}});renderer.dispose();renderer.domElement.remove();};
  },[replay,opening]);
  return <div className={'football-scene '+(opening?'kickoff-opening'+(leaving?' is-leaving':''):intro&&!fallback?'in-flight':'')} ref={host} role={opening?'dialog':undefined} aria-modal={opening?true:undefined} aria-label={opening?(lang==='zh'?'开场动画：3D 足球飞向镜头':'Opening animation: a 3D football flies toward you'):'3D football'}>{fallback&&<div className="fallback-ball">⚽</div>}{opening?<button ref={skip} className="skip-intro" onClick={()=>complete.current?.()}>{lang==='zh'?'跳过动画':'Skip animation'} →</button>:intro&&!fallback&&<><div className="kickoff-title">WORLD CUP DATA LAB<span>KICK OFF / 2026</span></div><button className="skip-intro" onClick={()=>setIntro(false)}>SKIP →</button></>}</div>;
}
