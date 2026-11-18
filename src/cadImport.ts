import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/** STEP / IGES / BREP files are tessellated in the browser (OpenCascade WASM, lazy-loaded) and re-packed as GLB. */
export const CAD_EXTENSIONS = /\.(step|stp|iges|igs|brep)$/i;
export const isCadFile = (name: string) => CAD_EXTENSIONS.test(name);

type OcctMesh = { name?: string; color?: [number, number, number]; attributes: { position: { array: number[] }; normal?: { array: number[] } }; index: { array: number[] } };
type OcctResult = { success: boolean; meshes: OcctMesh[] };
type Occt = { ReadStepFile(b: Uint8Array, p: unknown): OcctResult; ReadIgesFile(b: Uint8Array, p: unknown): OcctResult; ReadBrepFile(b: Uint8Array, p: unknown): OcctResult };
let occtPromise: Promise<Occt> | undefined;

async function loadOcct(): Promise<Occt> {
  if (!occtPromise) {
    occtPromise = (async () => {
      const [{ default: init }, { default: wasmUrl }] = await Promise.all([
        import('occt-import-js'),
        import('occt-import-js/dist/occt-import-js.wasm?url'),
      ]);
      return (await init({ locateFile: () => wasmUrl })) as Occt;
    })();
    occtPromise.catch(() => { occtPromise = undefined; });
  }
  return occtPromise;
}

export async function cadToGlb(file: File): Promise<Uint8Array> {
  const occt = await loadOcct();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const params = { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.001, angularDeflection: 0.5 };
  const lower = file.name.toLowerCase();
  const result = /\.(iges|igs)$/.test(lower) ? occt.ReadIgesFile(bytes, params) : lower.endsWith('.brep') ? occt.ReadBrepFile(bytes, params) : occt.ReadStepFile(bytes, params);
  if (!result.success || !result.meshes.length) throw new Error('Could not read this CAD file (no solid geometry found).');
  const group = new THREE.Group();
  for (const m of result.meshes) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
    if (m.attributes.normal) g.setAttribute('normal', new THREE.Float32BufferAttribute(m.attributes.normal.array, 3));
    else g.computeVertexNormals();
    g.setIndex(m.index.array);
    const c = m.color ?? [0.7, 0.7, 0.72];
    group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(c[0], c[1], c[2]), metalness: 0.2, roughness: 0.6 })));
  }
  const glb = await new GLTFExporter().parseAsync(group, { binary: true }) as ArrayBuffer;
  return new Uint8Array(glb);
}
