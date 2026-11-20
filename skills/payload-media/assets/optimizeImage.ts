const MAX_EDGE = 2560
const WEBP_QUALITY = 0.82
const JPEG_QUALITY = 0.85
const SKIPPED_TYPES = new Set(['image/svg+xml', 'image/gif'])

export function isOptimizableImage(file: File): boolean {
  return file.type.startsWith('image/') && !SKIPPED_TYPES.has(file.type)
}

function replaceExtension(name: string, extension: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  return `${base}.${extension}`
}

async function encode(canvas: OffscreenCanvas, type: string, quality: number): Promise<Blob | null> {
  const blob = await canvas.convertToBlob({ type, quality })
  return blob.type === type ? blob : null
}

// Resizes to MAX_EDGE and re-encodes as WebP in the browser.
// Returns the original file when optimization is unsupported, fails, or would not make the file smaller.
export async function optimizeImage(file: File): Promise<File> {
  if (!isOptimizableImage(file) || typeof OffscreenCanvas === 'undefined') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)

    const webp = await encode(canvas, 'image/webp', WEBP_QUALITY)
    const output = webp ?? (file.type === 'image/jpeg' ? await encode(canvas, 'image/jpeg', JPEG_QUALITY) : null)
    if (!output || output.size >= file.size) return file

    const extension = output.type === 'image/webp' ? 'webp' : 'jpg'
    return new File([output], replaceExtension(file.name, extension), { type: output.type, lastModified: Date.now() })
  } catch {
    return file
  } finally {
    bitmap.close()
  }
}
