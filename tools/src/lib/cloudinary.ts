/**
 * cloudinary.ts — Image upload helper
 *
 * Uploads a local image file to Cloudinary and returns a permanent public URL.
 * Images are stored under the `age-for-discoveries` folder in your Cloudinary account,
 * named after the original file (without extension) for easy identification.
 *
 * Required env vars (in root .env):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

import { v2 as cloudinary } from 'cloudinary';
import path from 'path';

// ---------------------------------------------------------------------------
// Configure from environment (dotenv already loaded by the calling script)
// ---------------------------------------------------------------------------

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export interface UploadResult {
  publicUrl:  string;
  publicId:   string;
  width:      number;
  height:     number;
  format:     string;
  bytes:      number;
}

/**
 * Upload a local image file to Cloudinary.
 * Returns a permanent HTTPS URL suitable for the Meta Graph API.
 */
export async function uploadImage(localPath: string): Promise<UploadResult> {
  const fileName = path.basename(localPath, path.extname(localPath));

  const result = await cloudinary.uploader.upload(localPath, {
    folder:    'age-for-discoveries',
    public_id: fileName,
    overwrite: false,           // don't overwrite if same file posted again
    resource_type: 'image',
  });

  return {
    publicUrl: result.secure_url,
    publicId:  result.public_id,
    width:     result.width,
    height:    result.height,
    format:    result.format,
    bytes:     result.bytes,
  };
}

/**
 * Delete an image from Cloudinary by its public ID.
 * Useful for cleanup after a failed or cancelled post.
 */
export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}
