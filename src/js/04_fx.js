// ---------- 렌더러 + 화면 고장 후처리 셰이더 (하나로 켜고 끔) ----------
const FX = {
  renderer: null, rt: null, postScene: null, postCam: null, mat: null, scale: 1, basePR: 1,
  u: { tear: 0, inv: 0, pix: 0, hit: 0, wipe: 1, wipeOn: 0, slow: 0 },
  init(canvas) {
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.basePR = Math.min(window.devicePixelRatio || 1, 2);
    this.rt = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true });
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tD: { value: this.rt.texture }, uRes: { value: new THREE.Vector2(4, 4) }, uTime: { value: 0 },
        uTear: { value: 0 }, uInv: { value: 0 }, uPix: { value: 0 }, uHit: { value: 0 },
        uWipe: { value: 1 }, uWipeOn: { value: 0 }, uSoft: { value: 0 }, uSlow: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `
        precision mediump float;
        uniform sampler2D tD; uniform vec2 uRes; uniform float uTime,uTear,uInv,uPix,uHit,uWipe,uWipeOn,uSoft,uSlow;
        varying vec2 vUv;
        float h(float n){return fract(sin(n)*43758.5453);}
        void main(){
          vec2 uv=vUv;
          if(uPix>0.001){ float cells=mix(uRes.y, mix(34.,96.,uSoft), uPix); vec2 c=vec2(cells*uRes.x/uRes.y,cells); uv=(floor(uv*c)+.5)/c; }
          float off=0.;
          if(uTear>0.001){
            float rate=mix(14.,4.,uSoft); float t=floor(uTime*rate);
            float band=floor(uv.y*18.); float r=h(band*1.7+t*3.1);
            if(r<.42) off=(h(band+t*7.3)-.5)*.24*uTear*mix(1.,.6,uSoft);
            uv.x=fract(uv.x+off);
          }
          vec3 col=texture2D(tD,uv).rgb;
          if(off!=0.){ col.r=texture2D(tD,uv+vec2(.012*uTear,0.)).r; col.b=texture2D(tD,uv-vec2(.012*uTear,0.)).b; }
          col=mix(col,1.-col,uInv*mix(1.,.45,uSoft));
          if(uSlow>0.001){ float g=dot(col,vec3(.3,.59,.11)); col=mix(col, vec3(g*.7,g*1.05,g*1.25), uSlow*.55); }
          if(uWipeOn>.5){
            if(vUv.x>uWipe){ float g=dot(col,vec3(.299,.587,.114)); col=vec3(g)*.5; }
            if(abs(vUv.x-uWipe)<.004) col=vec3(.78,.96,.2);
          }
          vec2 d=vUv-.5; float v=dot(d,d);
          col=mix(col,vec3(1.,.3,.37),uHit*smoothstep(.06,.5,v)*mix(.9,.45,uSoft));
          col*=1.-.38*smoothstep(.18,.75,v);
          col*=.965+.035*sin(gl_FragCoord.y*3.14159);
          gl_FragColor=vec4(col,1.);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.setQuality();
  },
  setQuality() {
    const q = settings.quality;
    this.scale = q === 'low' ? 0.5 : q === 'high' ? 1 : (IS_TOUCH ? 0.75 : 1);
    this.resize();
  },
  stepDown() { // 자동 화질: 1 → 0.75 → 0.5
    if (settings.quality !== 'auto' || this.scale <= 0.5) return false;
    this.scale = this.scale > 0.8 ? 0.75 : 0.5; this.resize(); return true;
  },
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = this.basePR * this.scale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    const v = new THREE.Vector2(); this.renderer.getDrawingBufferSize(v);
    this.rt.setSize(v.x, v.y);
    this.mat.uniforms.uRes.value.set(v.x, v.y);
  },
  render(scene, cam, time) {
    const U = this.mat.uniforms, u = this.u;
    U.uTime.value = time; U.uTear.value = u.tear; U.uInv.value = u.inv; U.uPix.value = u.pix; U.uHit.value = u.hit;
    U.uWipe.value = u.wipe; U.uWipeOn.value = u.wipeOn; U.uSoft.value = settings.reduceFlash ? 1 : 0; U.uSlow.value = u.slow;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, cam);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  },
};
