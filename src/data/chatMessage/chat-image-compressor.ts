import { Logger } from '@nestjs/common';
import * as fs from 'fs';

/**
 * sharp's shipped type declarations (`dist/index.d.mts`) describe an ESM
 * named/default export, but under this project's `moduleResolution: "Node"`
 * TypeScript resolves that same file for *both* `import` and `import
 * ... = require(...)` syntax — while the actual CommonJS build
 * (`dist/index.cjs`, what Node loads at runtime) only does
 * `module.exports = Sharp`. Any ES-import spelling therefore either fails to
 * compile or compiles to a runtime `undefined` call. Requiring it directly
 * sidesteps the mismatched types and matches what Node actually loads.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

const logger = new Logger('ChatImageCompressor');

/**
 * Max width/height (px) chat images are downscaled to. Large enough for
 * full-screen viewing on any device, small enough to cut typical phone
 * camera photos (3000px+) down significantly.
 */
const MAX_DIMENSION = 1920;

const JPEG_QUALITY = 82;
const WEBP_QUALITY = 82;

/**
 * Re-encodes a chat image in place to reduce storage size.
 *
 * Animated GIFs and non-image mimetypes are left untouched — GIF frames
 * would need dedicated handling, and PDFs aren't image data.
 *
 * @returns the new file size in bytes, or null if the file was left as-is.
 */
export async function compressChatImageInPlace(
  absPath: string,
  mimeType: string,
): Promise<number | null> {
  if (mimeType === 'image/gif') {
    return null;
  }

  try {
    // Read into memory first and hand sharp a Buffer rather than the path.
    // On Windows, libvips can intermittently fail to open a file that was
    // written to disk moments earlier (the multer temp upload, in this
    // case) with an opaque "UNKNOWN: unknown error" — reading via Node's fs
    // module sidesteps that race entirely.
    const originalBuffer = fs.readFileSync(absPath);

    const pipeline = sharp(originalBuffer)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      });

    let buffer: Buffer;
    switch (mimeType) {
      case 'image/jpeg':
        buffer = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
        break;
      case 'image/png':
        buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
        break;
      case 'image/webp':
        buffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
        break;
      default:
        return null;
    }

    if (buffer.length >= originalBuffer.length) {
      return null;
    }

    fs.writeFileSync(absPath, buffer);
    return buffer.length;
  } catch (error) {
    logger.warn(
      `No se pudo comprimir la imagen de chat (${absPath}): ${error.message}`,
    );
    return null;
  }
}
