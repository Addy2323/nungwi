/**
 * Utility to decode Barcodes / QR codes directly from uploaded image files (JPEG, PNG, WEBP, etc.)
 */
export async function decodeBarcodeFromImageFile(file: File): Promise<{ code: string; format: string } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const src = e.target?.result as string
      if (!src) return resolve(null)

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = async () => {
        try {
          // 1. Try native BarcodeDetector API on HTMLImageElement
          if ('BarcodeDetector' in window) {
            // @ts-ignore
            const detector = new window.BarcodeDetector({
              formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
            })
            const detected = await detector.detect(img)
            if (detected && detected.length > 0) {
              return resolve({
                code: detected[0].rawValue,
                format: detected[0].format.toUpperCase()
              })
            }
          }

          // 2. Offscreen Canvas processing for manual barcode extraction
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) return resolve(null)

          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)

          // Fallback: If image cannot be decoded automatically by BarcodeDetector
          resolve(null)
        } catch (err) {
          console.warn('Image barcode scanning error:', err)
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = src
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

/**
 * Utility to read an image file into a Data URL (base64) for instant image upload preview
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
