export type CropArea = {
  x: number
  y: number
  width: number
  height: number
}

export async function getCroppedFile(
  imageSrc: string,
  crop: CropArea,
  originalFile: File,
): Promise<File> {
  const image = new Image()
  image.src = imageSrc

  await new Promise((resolve, reject) => {
    image.onload = () => resolve(null)
    image.onerror = (e) => reject(e)
  })

  const canvas = document.createElement("canvas")
  // Pastikan output kotak
  const size = Math.min(crop.width, crop.height)
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Canvas context tidak tersedia")
  }

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    size,
    size,
    0,
    0,
    size,
    size,
  )

  const fileExt = originalFile.name.split(".").pop() || "jpg"

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) {
        reject(new Error("Gagal membuat blob dari canvas"))
        return
      }
      resolve(b)
    }, originalFile.type || "image/jpeg")
  })

  const croppedFile = new File([blob], originalFile.name.replace(/\.[^/.]+$/, "") + `-cropped.${fileExt}`, {
    type: blob.type,
  })

  return croppedFile
}


