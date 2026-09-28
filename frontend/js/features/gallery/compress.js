/** Resize + re-encode in the browser before upload (saves the user's data). The server re-encodes again and never trusts this output. */
const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));

export async function compressImage(file, maxSide = 1600, quality = 0.8) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("That file can't be read as an image. Try a JPEG, PNG or WebP photo."); }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  let blob = await toBlob(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);   // Safari can't encode WebP
  return blob && blob.size < file.size ? blob : file;
}
