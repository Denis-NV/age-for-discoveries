import path from 'path';
import sharp from 'sharp';
import fs from 'fs-extra';

const ROOT      = path.resolve(__dirname, '../../');
const INBOX     = path.join(ROOT, 'inbox');
const PROCESSED = path.join(ROOT, 'processed');

const TARGET_W = 1080;
const TARGET_H = 1350; // 4:5

interface ProcessConfig {
  input:       string;
  output:      string;
  brightness?: number;
  saturation?: number;
}

async function processImage(cfg: ProcessConfig): Promise<void> {
  const inputPath  = path.join(INBOX,     cfg.input);
  const outputPath = path.join(PROCESSED, cfg.output);

  // Auto-rotate per EXIF, then get real dimensions
  const img  = sharp(inputPath).rotate();
  const meta = await img.metadata();
  const w = meta.width!;
  const h = meta.height!;

  // Center-crop to 4:5
  let cropW: number, cropH: number, left: number, top: number;
  if (w / h > 4 / 5) {
    cropH = h;
    cropW = Math.round(h * 4 / 5);
    left  = Math.round((w - cropW) / 2);
    top   = 0;
  } else {
    cropW = w;
    cropH = Math.round(w * 5 / 4);
    left  = 0;
    top   = Math.round((h - cropH) / 2);
  }

  await img
    .extract({ left, top, width: cropW, height: cropH })
    .resize(TARGET_W, TARGET_H)
    .modulate({ brightness: cfg.brightness ?? 1.0, saturation: cfg.saturation ?? 1.1 })
    .sharpen()
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  console.log(`  ✓ ${cfg.output}`);
}

const CAROUSEL_1: ProcessConfig[] = [
  { input: 'PXL_20260517_103350584.jpg',    output: 'c1_01_manueline_buttress.jpg',  saturation: 1.15 },
  { input: 'PXL_20260517_110110015.jpg',    output: 'c1_02_charola_exterior.jpg',    saturation: 1.15 },
  { input: 'PXL_20260517_103216737.MP.jpg', output: 'c1_03_manueline_window.jpg',    saturation: 1.1  },
  { input: 'PXL_20260517_103532570.MP.jpg', output: 'c1_04_charola_altarpiece.jpg',  brightness: 1.1, saturation: 1.1 },
  { input: 'PXL_20260517_103557077.MP.jpg', output: 'c1_05_charola_paintings.jpg',   brightness: 1.05, saturation: 1.1 },
  { input: 'PXL_20260517_103630655.jpg',    output: 'c1_06_denis_looking_up.jpg',    brightness: 1.05, saturation: 1.1 },
  { input: 'PXL_20260517_105505065.MP.jpg', output: 'c1_07_grille_looking_in.jpg',   brightness: 1.2  },
  { input: 'PXL_20260517_105510901.jpg',    output: 'c1_08_crucifixion_grille.jpg',  brightness: 1.15 },
  { input: 'PXL_20260517_104459621.MP.jpg', output: 'c1_09_cloister_fountain.jpg',   saturation: 1.15 },
  { input: 'PXL_20260517_102322794.MP.jpg', output: 'c1_10_courtyard_arch.jpg',      saturation: 1.1  },
];

const CAROUSEL_2: ProcessConfig[] = [
  { input: 'PXL_20260517_101716182.MP.jpg', output: 'c2_01_painted_ceiling.jpg',     brightness: 1.1, saturation: 1.2 },
  { input: 'PXL_20260517_104717497.jpg',    output: 'c2_02_gilded_ceiling.jpg',      brightness: 1.05, saturation: 1.1 },
  { input: 'PXL_20260517_104725403.jpg',    output: 'c2_03_grand_hall.jpg',          brightness: 1.05, saturation: 1.05 },
  { input: 'PXL_20260517_102648415.MP.jpg', output: 'c2_04_cloister_columns.jpg',    saturation: 1.1  },
  { input: 'PXL_20260517_105101992.MP.jpg', output: 'c2_05_dormitory_corridor.jpg',  brightness: 1.15 },
  { input: 'PXL_20260517_105127008.jpg',    output: 'c2_06_knight_cell.jpg',         brightness: 1.25 },
  { input: 'PXL_20260517_105136126.MP.jpg', output: 'c2_07_cell_window.jpg',         brightness: 1.15 },
  { input: 'PXL_20260517_105143400.MP.jpg', output: 'c2_08_cell_view_garden.jpg',    saturation: 1.1  },
  { input: 'PXL_20260517_105737395.MP.jpg', output: 'c2_09_window_silhouettes.jpg',  brightness: 1.05 },
  { input: 'PXL_20260517_102858542.MP.jpg', output: 'c2_10_refectory_hall.jpg',      brightness: 1.05, saturation: 1.05 },
];

async function main(): Promise<void> {
  await fs.ensureDir(PROCESSED);

  console.log('\n  Carousel 1 — The Templar Cross on the Caravel Sail');
  for (const cfg of CAROUSEL_1) await processImage(cfg);

  console.log('\n  Carousel 2 — Where Knights Actually Lived');
  for (const cfg of CAROUSEL_2) await processImage(cfg);

  console.log('\n  ✓ All 20 images processed.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
