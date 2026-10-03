/* ENVIRONMENT, PEDESTAL (prototype section). */
import * as THREE from "three";
import { getLowPower, withQuality } from "./quality";
import { shadowTex } from "./textures";
import { C, MAT, phys } from "./materials";

/**
 * PMREM environment map: a gradient sky sphere with four soft light cards.
 * Use `.texture` as scene.environment; the caller disposes the returned render target.
 */
export function makeEnv(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const pm = new THREE.PMREMGenerator(renderer), s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(20, 32, 16), pos = geo.attributes.position as THREE.BufferAttribute, cols: number[] = [];
  const top = C("#BDB2FF"), mid = C("#2C2266"), bot = C("#0B0820");
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 20; const k = y > 0 ? mid.clone().lerp(top, Math.pow(y, 0.8)) : mid.clone().lerp(bot, Math.min(1, -y * 1.4)); cols.push(k.r, k.g, k.b); }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  const disposables: { dispose(): void }[] = [];
  const skyM = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  disposables.push(skyM);
  s.add(new THREE.Mesh(geo, skyM));
  const box = (w: number, h: number, x: number, y: number, z: number, col: string, k: number) => {
    const g = new THREE.PlaneGeometry(w, h), mm = new THREE.MeshBasicMaterial({ color: C(col).multiplyScalar(k), side: THREE.DoubleSide });
    disposables.push(g, mm);
    const m = new THREE.Mesh(g, mm); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  box(10, 7, 6, 9, 10, "#ffffff", 3.2); box(8, 8, -11, 4, -6, "#8FE9FF", 2); box(14, 3, 0, -2, 13, "#FFB8D9", 1.1); box(6, 10, 12, 2, -4, "#C9B8FF", 1.4);
  const rt = pm.fromScene(s, 0.04); pm.dispose(); geo.dispose();
  disposables.forEach((d) => d.dispose());
  return rt;
}

export interface PedestalData {
  ring: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  ring2: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  cs: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

export function makePedestal(glow: string, lowPower: boolean = getLowPower()): THREE.Group {
  return withQuality(lowPower, () => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.84, 0.12, 72), MAT.vinyl("#211A4A")); base.position.y = -0.06; base.receiveShadow = true; g.add(base);
    const topD = new THREE.Mesh(new THREE.CircleGeometry(0.8, 72), phys("#2A2260", { roughness: 0.45, clearcoat: 0.5 })); topD.rotation.x = -Math.PI / 2; topD.position.y = 0.001; topD.receiveShadow = true; g.add(topD);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.805, 0.011, 8, 96), MAT.glow(glow)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.002; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.004, 6, 96), MAT.basic(glow, { transparent: true, opacity: 0.35 })); ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.003; g.add(ring2);
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.6 })); cs.rotation.x = -Math.PI / 2; cs.position.y = 0.006; g.add(cs);
    const data: PedestalData = { ring, ring2, cs };
    g.userData = data;
    return g;
  });
}

export const pedestalData = (g: THREE.Group): PedestalData => g.userData as PedestalData;
