/* MATERIALS + GEOMETRY HELPERS (prototype section). */
import * as THREE from "three";
import { buildIsLow } from "./quality";

type PhysParams = THREE.MeshPhysicalMaterialParameters;
type BasicParams = THREE.MeshBasicMaterialParameters;

/** sRGB hex to linear Color (the renderer outputs sRGB). */
export const C = (h: string): THREE.Color => new THREE.Color(h).convertSRGBToLinear();

/**
 * MeshPhysicalMaterial factory. In low-power builds it returns a MeshStandardMaterial
 * with the same parameters minus clearcoat / clearcoatRoughness.
 */
export function physical(params: PhysParams): THREE.MeshStandardMaterial {
  if (buildIsLow()) {
    const { clearcoat: _c, clearcoatRoughness: _cr, ...rest } = params;
    return new THREE.MeshStandardMaterial(rest);
  }
  return new THREE.MeshPhysicalMaterial(params);
}

export const phys = (h: string, o?: PhysParams): THREE.MeshStandardMaterial =>
  physical(Object.assign({ color: C(h), roughness: 0.5, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.4 }, o || {}));

export const MAT = {
  skin: (h: string) => phys(h, { roughness: 0.58, clearcoat: 0.12, clearcoatRoughness: 0.6 }),
  fabric: (h: string) => phys(h, { roughness: 0.86, clearcoat: 0 }),
  vinyl: (h: string) => phys(h, { roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  hair: (h: string) => phys(h, { roughness: 0.4, clearcoat: 0.55, clearcoatRoughness: 0.3 }),
  metal: (h: string) => phys(h, { roughness: 0.26, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.12 }),
  dark: () => phys("#140D2E", { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }),
  glow: (h: string) => new THREE.MeshBasicMaterial({ color: C(h), toneMapped: false }),
  basic: (h: string, o?: BasicParams) => new THREE.MeshBasicMaterial(Object.assign({ color: C(h), toneMapped: false }, o || {})),
};

export const shadeHex = (h: string, f: number): string => {
  const c = new THREE.Color(h);
  c.multiplyScalar(f);
  return "#" + c.getHexString();
};

export function sph(r: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 24): THREE.Mesh {
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), m);
  s.position.set(x, y, z);
  return s;
}

export function cap(r: number, len: number, m: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), m));
  const a = sph(r, m, 0, len / 2),
    b = sph(r, m, 0, -len / 2);
  g.add(a, b);
  return g;
}

export function lathe(pts: [number, number][], m: THREE.Material, seg = 40): THREE.Mesh {
  return new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg), m);
}

export function rrShape(w: number, h: number, r: number): THREE.Shape {
  r = Math.max(0.0005, Math.min(r, w / 2 - 0.0005, h / 2 - 0.0005));
  const s = new THREE.Shape(),
    x = -w / 2,
    y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function rbox(w: number, h: number, d: number, r: number, m: THREE.Material): THREE.Mesh {
  const b = Math.min(r * 0.6, d * 0.3, w * 0.25, h * 0.25);
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, r - b), {
    depth: Math.max(0.001, d - 2 * b),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 6,
    curveSegments: 12,
  });
  g.center();
  return new THREE.Mesh(g, m);
}

export function rrPlane(w: number, h: number, r: number, m: THREE.Material): THREE.Mesh {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 12),
    p = g.attributes.position as THREE.BufferAttribute,
    uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  uv.needsUpdate = true;
  return new THREE.Mesh(g, m);
}

/** Skull radii. */
export const SK = { rx: 0.42, ry: 0.395, rz: 0.403 };

export interface SurfPoint {
  p: THREE.Vector3;
  n: THREE.Vector3;
  q: THREE.Quaternion;
}

export function surf(yaw: number, pitch: number, out = 0, rx = SK.rx, ry = SK.ry, rz = SK.rz): SurfPoint {
  const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const p = new THREE.Vector3(d.x * rx, d.y * ry, d.z * rz);
  const n = new THREE.Vector3(d.x / rx, d.y / ry, d.z / rz).normalize();
  p.addScaledVector(n, out);
  return { p, n, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n) };
}

export const place = <T extends THREE.Object3D>(o: T, s: SurfPoint): T => {
  o.position.copy(s.p);
  o.quaternion.copy(s.q);
  return o;
};

type Disposable = THREE.Object3D & {
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
  isSprite?: boolean;
};

/**
 * Dispose geometries and materials under `o`. Sprite geometry is shared by three
 * and is skipped. Material.dispose() does not dispose its textures, so the shared
 * cached textures in TEX stay alive.
 */
export function disposeObj(o: THREE.Object3D): void {
  o.traverse((node) => {
    const n = node as Disposable;
    if (n.geometry && !n.isSprite) n.geometry.dispose();
    if (n.material) ([] as THREE.Material[]).concat(n.material).forEach((m) => m.dispose());
  });
}
