import * as THREE from "three";

/**
 * GPU particles: every particle's motion is a closed-form function of time and its seed,
 * evaluated in the vertex shader, so a field costs one instanced draw call and no
 * per-frame CPU work. "Field" kinds wrap in a box that follows the player (they only
 * exist near the camera); "anchored" kinds move around a per-instance origin (lamps, the
 * workshop, flowers, ponds) that the CPU re-picks about once a second.
 */
export type ParticleKind =
  | "leaf"
  | "petal"
  | "sand"
  | "haze"
  | "mist"
  | "rain"
  | "mote"
  | "spark"
  | "butterfly"
  | "firefly";

const KIND_ID: Record<ParticleKind, number> = {
  leaf: 0,
  petal: 1,
  sand: 2,
  haze: 3,
  mist: 4,
  rain: 5,
  mote: 6,
  spark: 7,
  butterfly: 8,
  firefly: 9,
};

export const ADDITIVE: ReadonlySet<ParticleKind> = new Set([
  "mote",
  "spark",
  "firefly",
]);

export type ParticleUniforms = {
  uTime: { value: number };
  uCenter: { value: THREE.Vector3 };
  uBox: { value: THREE.Vector3 };
  uSize: { value: number };
  uOpacity: { value: number };
  uGust: { value: number };
  uColor: { value: THREE.Color };
  uColor2: { value: THREE.Color };
};

const VERT = /* glsl */ `
  attribute vec4 aSeed;
  attribute vec3 aOrigin;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec3 uBox;
  uniform float uSize;
  uniform float uGust;
  varying vec2 vUv;
  varying float vFade;
  varying float vSeed;
  varying float vLife;

  vec3 wrapField(vec3 p) {
    return uCenter + mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
  }
  float edgeFade(vec3 p) {
    vec3 l = abs(p - uCenter) / (uBox * 0.5);
    return (1.0 - smoothstep(0.7, 1.0, max(l.x, l.z))) * (1.0 - smoothstep(0.75, 1.0, l.y));
  }

  void main() {
    vUv = position.xy + 0.5;
    float w = aSeed.w;
    vSeed = w;
    vLife = 0.0;
    float t = uTime;
    vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 p = vec3(0.0);
    vec2 scale = vec2(uSize);
    float rot = 0.0;
    vFade = 1.0;
#if KIND == 5
    // Rain: world-space streaks stretched along the fall direction.
    p = aSeed.xyz * uBox;
    p.y -= t * (13.0 + w * 4.0);
    p.x += t * (0.6 + uGust * 3.0);
    p = wrapField(p);
    vFade = edgeFade(p);
    vec3 axis = normalize(vec3(0.05 + uGust * 0.22, -1.0, 0.03));
    vec3 side = normalize(cross(axis, cameraPosition - p));
    vec3 wp = p + side * position.x * 0.025 + axis * position.y * 0.6;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
#else
  #if KIND == 0 || KIND == 1
    // Falling leaves (0) and drifting petals (1): tumble and sway.
    float fall = KIND == 0 ? 0.55 + w * 0.45 : 0.25 + w * 0.25;
    float drift = KIND == 0 ? 0.35 : 0.75;
    p = aSeed.xyz * uBox;
    p.y -= t * fall;
    p.x += t * drift * (1.0 + uGust * 2.0) + sin(t * 0.9 + w * 20.0) * 0.7;
    p.z += cos(t * 0.7 + w * 13.0) * 0.6 + t * 0.12;
    p = wrapField(p);
    vFade = edgeFade(p);
    rot = t * (1.2 + w * 2.0) + w * 6.0;
    scale = KIND == 0 ? vec2(0.17, 0.12) : vec2(0.09, 0.07);
    scale.x *= 0.35 + 0.65 * abs(sin(t * (2.0 + w * 2.0) + w * 10.0));
  #elif KIND == 2
    // Sand gusts: fast, low streaks along the wind.
    p = aSeed.xyz * uBox;
    p.x += t * (5.0 + w * 3.0);
    p.z += t * 1.2;
    p.y += sin(t * 2.0 + w * 30.0) * 0.18;
    p = wrapField(p);
    vFade = edgeFade(p);
    scale = vec2(0.5, 0.05) * (0.6 + w);
    rot = 0.05;
  #elif KIND == 3 || KIND == 4
    // Heat shimmer (3) and ground mist (4): big slow quads hugging the ground.
    p = aSeed.xyz * uBox;
    p.x += t * 0.15;
    p.z += sin(t * 0.05 + w * 9.0) * 1.5;
    p = wrapField(p);
    vFade = edgeFade(p);
    scale = KIND == 3 ? vec2(3.2, 1.1) : vec2(6.5, 2.0) * (0.7 + w * 0.6);
  #elif KIND == 6
    // Light motes rising around the crystal lamps.
    float life = fract(t * 0.07 + w * 3.7);
    vLife = life;
    float r = 0.35 + aSeed.x * 0.6;
    p = aOrigin + vec3(sin(t * 0.5 + w * 20.0) * r, 0.2 + life * 2.4, cos(t * 0.43 + w * 11.0) * r);
    vFade = sin(life * 3.14159);
    scale = vec2(0.09) * (0.8 + 0.4 * sin(t * 3.0 + w * 30.0));
  #elif KIND == 7
    // Sparks: short bursts from the workshop anvil.
    float slot = floor(t * 0.6);
    float burst = step(0.45, fract(sin(slot * 12.9898) * 43758.5453));
    float life = fract(t * 0.6) * (1.2 + w * 0.6);
    vLife = life;
    vec2 dir = normalize(aSeed.xz - 0.5 + 1e-3) * (0.5 + aSeed.y);
    p = aOrigin + vec3(dir.x * life * 0.9, 0.85 + life * 1.6 - life * life * 2.2, dir.y * life * 0.9);
    vFade = burst * (1.0 - smoothstep(0.4, 1.0, life));
    scale = vec2(0.05);
  #elif KIND == 8
    // Butterflies: lazy loops over the garden with flapping wings.
    p = aOrigin + vec3(
      sin(t * 0.55 + w * 30.0) * 1.3 + sin(t * 1.7 + w * 5.0) * 0.25,
      0.55 + sin(t * 1.3 + w * 9.0) * 0.25,
      sin(t * 0.43 + w * 17.0) * 1.3);
    scale = vec2(0.17, 0.13);
    scale.x *= 0.25 + 0.75 * abs(sin(t * 13.0 + w * 40.0));
  #elif KIND == 9
    // Fireflies: slow wander near the grass and ponds, blinking.
    p = aOrigin + vec3(
      sin(t * 0.31 + w * 21.0) * 1.4,
      0.35 + 0.5 * (0.5 + 0.5 * sin(t * 0.47 + w * 13.0)),
      cos(t * 0.27 + w * 17.0) * 1.4);
    vFade = smoothstep(0.35, 1.0, sin(t * (0.9 + w * 0.8) + w * 50.0));
    scale = vec2(0.12);
  #endif
    float c = cos(rot);
    float s = sin(rot);
    vec2 q = position.xy * scale;
    q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    vec3 wp = p + camR * q.x + camU * q.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
#endif
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  varying float vFade;
  varying float vSeed;
  varying float vLife;

  void main() {
    vec2 c = vUv - 0.5;
    vec3 col = mix(uColor, uColor2, fract(vSeed * 7.31));
    float a = 1.0;
#if KIND == 0 || KIND == 1
    // A pointed leaf / a round petal.
    float d = KIND == 0 ? length(c * vec2(1.0, 1.0 + abs(c.x) * 3.0)) : length(c);
    a = smoothstep(0.5, 0.42, d);
    col *= 0.85 + 0.3 * (0.5 - c.y);
#elif KIND == 2
    a = smoothstep(0.5, 0.0, abs(c.y)) * smoothstep(0.5, 0.1, abs(c.x));
#elif KIND == 3
    float band = sin(vUv.y * 26.0 + uTime * 3.0 + sin(vUv.x * 7.0 + uTime * 1.3) * 2.0) * 0.5 + 0.5;
    a = band * smoothstep(0.5, 0.15, length(c * vec2(1.0, 1.6)));
#elif KIND == 4
    a = smoothstep(0.5, 0.0, length(c * vec2(1.0, 1.4)));
    a *= a;
#elif KIND == 5
    a = smoothstep(0.5, 0.0, abs(c.x)) * smoothstep(0.5, 0.2, abs(c.y));
#elif KIND == 6 || KIND == 7 || KIND == 9
    float d = length(c);
    a = smoothstep(0.5, 0.0, d);
    a = a * a + smoothstep(0.12, 0.0, d);
#elif KIND == 8
    // Two wings: lobes either side of a thin body.
    vec2 q = vec2(abs(c.x) - 0.24, c.y);
    float wing = smoothstep(0.26, 0.2, length(q * vec2(1.0, 1.25)));
    float body = smoothstep(0.05, 0.02, abs(c.x)) * smoothstep(0.32, 0.25, abs(c.y));
    a = max(wing, body);
    col = mix(col, vec3(0.08, 0.06, 0.05), body);
#endif
    a *= uOpacity * vFade;
    if (a < 0.004) discard;
#if ADDITIVE == 1
    gl_FragColor = vec4(col * a, 1.0);
#else
    gl_FragColor = vec4(col, a);
#endif
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createParticleMaterial(
  kind: ParticleKind,
  colors: [string, string]
): { material: THREE.ShaderMaterial; uniforms: ParticleUniforms } {
  const uniforms: ParticleUniforms = {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector3() },
    uBox: { value: new THREE.Vector3(20, 8, 20) },
    uSize: { value: 0.1 },
    uOpacity: { value: 0 },
    uGust: { value: 0 },
    uColor: { value: new THREE.Color(colors[0]) },
    uColor2: { value: new THREE.Color(colors[1]) },
  };
  const additive = ADDITIVE.has(kind);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: { KIND: KIND_ID[kind], ADDITIVE: additive ? 1 : 0 },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  return { material, uniforms };
}

/** An instanced unit quad with per-instance seeds (and origins for anchored kinds). */
export function createParticleGeometry(
  count: number,
  seed: number
): THREE.InstancedBufferGeometry {
  const quad = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index;
  g.setAttribute("position", quad.getAttribute("position"));
  const seeds = new Float32Array(count * 4);
  let s = seed >>> 0 || 1;
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
  g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
  g.setAttribute(
    "aOrigin",
    new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
  );
  g.instanceCount = count;
  return g;
}
