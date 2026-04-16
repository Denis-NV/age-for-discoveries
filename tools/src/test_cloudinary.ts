import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: '/sessions/adoring-peaceful-curie/mnt/age-for-discovery/.env' });

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

console.log('Cloudinary config set. Testing upload...');

cloudinary.uploader.upload(
  '/sessions/adoring-peaceful-curie/mnt/age-for-discovery/processed/PXL_20260406_152316459_feed.jpg',
  { folder: 'age-for-discoveries', public_id: 'test_upload_debug', overwrite: true, resource_type: 'image' }
).then(r => {
  console.log('✓ Upload success:', r.secure_url);
  process.exit(0);
}).catch((err: any) => {
  console.error('✗ Upload error:', err.message ?? err);
  console.error('Full error:', JSON.stringify(err, null, 2));
  process.exit(1);
});
