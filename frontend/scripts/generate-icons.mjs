// Generates the PWA icon set from the parish's icon painting of Abune Aregawi.
//
// The crops are not arbitrary. The source is a photograph of a whole painted
// scene, and a whole scene is unreadable at the ~48px a launcher draws. Both
// boxes were chosen by rendering candidates at that size and comparing; see the
// "Icon source" section of the plan before changing them.
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const SOURCE = path.join(PUBLIC, 'abune_aregawi.jpg');

// Tight on the saint's head: hat, white cross, face, beard. What survives small.
const SUBJECT = { left: 155, top: 95, width: 520, height: 520 };

// The same centre, widened by 1/0.8, so SUBJECT lands inside the maskable safe
// circle and Android's mask crops background rather than the face.
const SUBJECT_WITH_BLEED = { left: 90, top: 30, width: 650, height: 650 };

// The source is a photograph of a dim wall painting; this lifts it just enough.
const enhance = (pipeline) => pipeline.modulate({ saturation: 1.15 }).linear(1.12, -10);

// Level 9 is zlib's slowest/smallest setting, and adaptiveFiltering lets the
// encoder pick the best per-scanline filter instead of one filter for the
// whole image. Both are lossless — same pixels, same crops, verified by
// decoding both variants back to raw pixel buffers and diffing them — they
// just spend more CPU finding a smaller encoding, a one-time cost paid here
// at generation time, not by a member's phone. Measured on this artwork,
// adaptiveFiltering is the one that actually matters: compressionLevel alone
// only trims ~2% off the source photograph, but adding adaptiveFiltering
// takes the 512px icon from ~706KB to ~544KB (~23% further, ~24.2% off the
// original 718KB). sharp/libvips also supports a lossy indexed-palette PNG mode
// (`palette: true`, ~167KB here) and WebP (lossless ~420KB, lossy ~100KB at
// q90) — both meaningfully smaller still, but palette mode discards colour
// precision and WebP is a different file type than the `image/png` the
// manifest declares, so neither is used here without a deliberate call to
// change the icon format.
const PNG_OPTS = { compressionLevel: 9, adaptiveFiltering: true };

const run = async () => {
  await enhance(sharp(SOURCE).extract(SUBJECT).resize(512, 512))
    .png(PNG_OPTS).toFile(path.join(PUBLIC, 'icon-512.png'));

  await enhance(sharp(SOURCE).extract(SUBJECT).resize(192, 192))
    .png(PNG_OPTS).toFile(path.join(PUBLIC, 'icon-192.png'));

  await enhance(sharp(SOURCE).extract(SUBJECT_WITH_BLEED).resize(512, 512))
    .png(PNG_OPTS).toFile(path.join(PUBLIC, 'icon-512-maskable.png'));

  console.log('PWA icons written to public/');
};

run().catch((err) => { console.error(err); process.exit(1); });
