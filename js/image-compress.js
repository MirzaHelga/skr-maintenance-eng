// ---------- IMAGE COMPRESS ----------
// Kompres foto di browser sebelum diupload ke Supabase Storage.
// Foto dari HP (kamera) biasanya 3-8MB; setelah resize + re-encode
// biasanya turun ke ratusan KB tanpa keliatan bedanya di layar HP.

const MAX_DIMENSION = 1600; // px, sisi terpanjang
const JPEG_QUALITY = 0.75; // 0-1

/**
 * Kompres 1 file gambar. Kalau file bukan gambar (atau gagal diproses),
 * balikin file aslinya apa adanya supaya upload tetap jalan.
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function compressImage(file) {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);

    let { width, height } = bitmap;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );

    if (!blob) return file; // toBlob gagal, fallback ke file asli

    // Kalau hasil kompres malah lebih gede dari aslinya (jarang, tapi
    // bisa kejadian buat gambar kecil/simple), pakai yang asli aja.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn("Gagal kompres foto, pakai file asli:", err);
    return file;
  }
}

/**
 * Kompres banyak file sekaligus secara paralel.
 * @param {FileList|File[]} files
 * @returns {Promise<File[]>}
 */
export async function compressImages(files) {
  return Promise.all(Array.from(files).map(compressImage));
}
