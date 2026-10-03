/* ShaderGradient-style animated background: domain-warped simplex noise
   blended through the album palette, plus film grain and vignette. */
(function () {
  const canvas = document.getElementById("bg");
  const gl = canvas && canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
  if (!gl) { canvas && canvas.remove(); return; }

  const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const frag = `
    precision mediump float;
    uniform vec2 uRes; uniform float uTime; uniform float uScroll; uniform vec2 uMouse;
    uniform vec3 uBg, uC1, uC2, uC3;

    vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
      vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main(){
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 p = uv; p.x *= uRes.x / uRes.y;
      float t = uTime * 0.045;
      p += uMouse * 0.08;
      p.y += uScroll * 1.6;

      vec2 q = vec2(snoise(p * 1.1 + t), snoise(p * 1.1 - t + 5.2));
      float n1 = snoise(p * 0.8 + q * 1.5 + vec2(t * 2.0, -t));
      float n2 = snoise(p * 1.4 - q * 1.2 + vec2(-t, t * 1.5) + 3.7);
      float n3 = snoise(p * 0.6 + q + 9.1 - t);

      vec3 col = uBg;
      col = mix(col, uC2, smoothstep(-0.4, 0.7, n1) * 0.95);
      col = mix(col, uC1, smoothstep(0.2, 1.0, n2) * 0.6);
      col = mix(col, uC3, smoothstep(0.5, 1.0, n3 * n1 + 0.3) * 0.4);

      // keep it moody: pull toward the background color overall
      col = mix(uBg, col, 0.7);
      col *= 1.0 - 0.6 * pow(length(uv - vec2(0.5, 0.45)), 1.6);
      col += (hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.045;
      gl_FragColor = vec4(col, 1.0);
    }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, vert), fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) { canvas.remove(); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U("uRes"), uTime = U("uTime"), uScroll = U("uScroll"), uMouse = U("uMouse");
  const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const pal = (window.SITE && window.SITE.palette) || {};
  gl.uniform3fv(U("uBg"), hex(pal.bg || "#0b0806"));
  gl.uniform3fv(U("uC1"), hex(pal.orange || "#c4622d"));
  gl.uniform3fv(U("uC2"), hex(pal.brown || "#2a1810"));
  gl.uniform3fv(U("uC3"), hex(pal.amber || "#e0a35c"));

  // Render at reduced resolution — it's a soft gradient, so this is invisible and saves mobile GPUs.
  const SCALE = 0.45;
  function resize() {
    const w = Math.max(1, Math.floor(innerWidth * SCALE)), h = Math.max(1, Math.floor(innerHeight * SCALE));
    canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); gl.uniform2f(uRes, w, h);
  }
  resize(); addEventListener("resize", resize);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", e => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = 0.5 - e.clientY / innerHeight; }, { passive: true });

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = window.__bg = { scroll: 0 };
  let start = performance.now(), running = true;

  function frame(now) {
    if (!running) return;
    mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
    gl.uniform1f(uTime, reduced ? 12.0 : (now - start) / 1000);
    gl.uniform1f(uScroll, state.scroll);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (reduced) addEventListener("scroll", () => requestAnimationFrame(frame), { passive: true });

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running && !reduced) requestAnimationFrame(frame);
  });
})();
