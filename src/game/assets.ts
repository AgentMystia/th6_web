import { TH07_DATA } from '../data/th07-data';
import { Anm } from '../formats/anm';

export type AnmKey = keyof typeof TH07_DATA.anm;

export interface GameAssets {
  anms: Record<AnmKey, Anm>;
  images: Record<string, HTMLImageElement>;
}

// Images extracted from the ANM entries (thanm -x 7), flattened by basename,
// plus the JPEG menu backdrops shipped directly inside Th07.dat.
const IMAGE_FILES: Record<string, string> = {
  etama: 'assets/th07-img/etama.png',
  etama2: 'assets/th07-img/etama2.png',
  etama3: 'assets/th07-img/etama3.png',
  etama4: 'assets/th07-img/etama4.png',
  stg1enm: 'assets/th07-img/stg1enm.png',
  stg1bg: 'assets/th07-img/stg1bg.png',
  player00: 'assets/th07-img/player00.png',
  player01: 'assets/th07-img/player01.png',
  player02: 'assets/th07-img/player02.png',
  eff01: 'assets/th07-img/eff01.png',
  ascii: 'assets/th07-img/ascii.png',
  asciis: 'assets/th07-img/asciis.png',
  pause: 'assets/th07-img/pause.png',
  title01: 'assets/th07-img/title01.png',
  title02: 'assets/th07-img/title02.png',
  select01: 'assets/th07-img/select01.png',
  select02: 'assets/th07-img/select02.png',
  sl_pl00: 'assets/th07-img/sl_pl00.png',
  sl_pl01: 'assets/th07-img/sl_pl01.png',
  sl_pl02: 'assets/th07-img/sl_pl02.png',
  sl_pltx: 'assets/th07-img/sl_pltx.png',
  sl_text: 'assets/th07-img/sl_text.png',
  replay00: 'assets/th07-img/replay00.png',
  std1txt: 'assets/th07-img/std1txt.png',
  face_01_00: 'assets/th07-img/face_01_00.png',
  face_rm00: 'assets/th07-img/face_rm00.png',
  face_rm01: 'assets/th07-img/face_rm01.png',
  face_mr00: 'assets/th07-img/face_mr00.png',
  face_mr01: 'assets/th07-img/face_mr01.png',
  face_sk00: 'assets/th07-img/face_sk00.png',
  face_sk01: 'assets/th07-img/face_sk01.png',
  front: 'assets/th07-img/front.png',
  ename: 'assets/th07-img/ename.png',
  loading: 'assets/th07-img/loading.png',
  title00: 'assets/th07-img/title00.jpg',
  select00: 'assets/th07-img/select00.jpg',
  th07logo: 'assets/th07-img/th07logo.jpg'
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image ${src}`));
    img.src = src;
  });
}

export async function loadAssets(): Promise<GameAssets> {
  const anms = Object.fromEntries(
    Object.entries(TH07_DATA.anm).map(([key, b64]) => [key, new Anm(b64 as string, key)])
  ) as Record<AnmKey, Anm>;
  const images: Record<string, HTMLImageElement> = {};
  await Promise.all(
    Object.entries(IMAGE_FILES).map(async ([key, src]) => {
      images[key] = await loadImage(src);
    })
  );
  return { anms, images };
}
