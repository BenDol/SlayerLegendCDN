#!/usr/bin/env node
/**
 * Build Game Asset Image Index Script
 *
 * Scans the game-assets/images directory and builds image-index.json
 * with metadata for all game images.
 *
 * This script is designed to run in GitHub Actions to automatically
 * update the image database when images are added/modified in the CDN.
 *
 * Usage:
 *   node scripts/build-game-asset-index.js [--cdn-dir <path>] [--output-dir <path>]
 *
 * Options:
 *   --cdn-dir    Path to CDN directory (default: ../game-assets/images)
 *   --output-dir Path to output directory (default: ../game-assets/images)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const getCLIArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

// Default paths (relative to CDN project scripts directory)
const CDN_DIR = path.resolve(__dirname, getCLIArg('--cdn-dir') || '../game-assets/images');
const OUTPUT_DIR = path.resolve(__dirname, getCLIArg('--output-dir') || '../game-assets/images');

// Output file path
const INDEX_PATH = path.join(OUTPUT_DIR, 'image-index.json');

/**
 * Get all images in a directory recursively
 */
async function getImagesInDirectory(dir) {
  const images = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively get images from subdirectories
        const subImages = await getImagesInDirectory(fullPath);
        images.push(...subImages);
      } else if (entry.isFile()) {
        // Check if it's an image file
        const ext = path.extname(entry.name).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
          images.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return images;
}

/**
 * Extract category from relative path
 *
 * Examples:
 *   spirits/Spirit_001.png -> 'spirits'
 *   icons/fire.png -> 'icons'
 *   equipment/weapons/sword.png -> 'equipment'
 *
 * Note: This is now unused as we extract category directly in the loop
 */
function extractCategory(relativePath) {
  const pathParts = relativePath.split('/').filter(p => p);
  return pathParts[0] || 'uncategorized';
}

/**
 * Get dimensions for an image file
 */
async function getImageDimensions(fullPath) {
  const ext = path.extname(fullPath).toLowerCase();

  // Skip SVG files (vector format)
  if (ext === '.svg') {
    return null;
  }

  try {
    const metadata = await sharp(fullPath).metadata();
    if (metadata.width && metadata.height) {
      return {
        width: metadata.width,
        height: metadata.height
      };
    }
  } catch (error) {
    console.warn(`Could not read dimensions for ${fullPath}:`, error.message);
  }

  return null;
}

/**
 * Generate keywords from filename and category
 */
function generateKeywords(filename, category, imagePath) {
  const keywords = new Set();

  // Add filename without extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  keywords.add(nameWithoutExt);

  // Add category
  keywords.add(category);

  // Add path segments (for searching by subdirectory)
  const pathParts = imagePath.split('/').filter(p => p);
  for (const part of pathParts) {
    if (part !== 'images' && part !== 'content' && part !== filename) {
      keywords.add(part);
    }
  }

  // Add common search terms based on filename patterns
  const lowerName = nameWithoutExt.toLowerCase();

  // Extract numbers (e.g., "Spirit_001" -> "001", "1")
  const numbers = lowerName.match(/\d+/g);
  if (numbers) {
    numbers.forEach(num => keywords.add(num));
  }

  // Split by underscores and dashes
  const words = lowerName.split(/[_-]/);
  words.forEach(word => {
    if (word.length > 1) {
      keywords.add(word);
    }
  });

  return Array.from(keywords);
}

/**
 * Build image indexes
 */
async function buildImageIndexes() {
  console.log('🔍 Scanning for images...');
  console.log(`CDN Directory: ${CDN_DIR}`);
  console.log(`Output Directory: ${OUTPUT_DIR}\n`);

  // Check if CDN directory exists
  try {
    await fs.access(CDN_DIR);
  } catch {
    console.error(`❌ CDN directory not found: ${CDN_DIR}`);
    console.error('Please ensure the game-assets/images directory exists.');
    process.exit(1);
  }

  // Get all images
  const imageFiles = await getImagesInDirectory(CDN_DIR);
  console.log(`Found ${imageFiles.length} images\n`);

  if (imageFiles.length === 0) {
    console.warn('⚠️ No images found in CDN directory');
    process.exit(0);
  }

  // Build image entries
  const images = [];
  let processed = 0;
  let skipped = 0;

  for (const fullPath of imageFiles) {
    try {
      // Get relative path from CDN_DIR (e.g., "icons/fire.png", "spirits/Spirit_001.png")
      const relativeToCdn = path.relative(CDN_DIR, fullPath);

      // Store as relative path (basePath /images will be in index metadata)
      const imagePath = '/' + relativeToCdn.replace(/\\/g, '/');

      // Get file stats
      const stats = await fs.stat(fullPath);
      const filename = path.basename(fullPath);

      // Extract category from path (first directory in relative path)
      const category = relativeToCdn.split(/[/\\]/)[0] || 'uncategorized';

      // Get dimensions (may be null for SVG)
      const dimensions = await getImageDimensions(fullPath);

      // Generate keywords
      const keywords = generateKeywords(filename, category, imagePath);

      // Create image entry
      const imageEntry = {
        path: imagePath,
        filename: filename,
        category: category,
        filesize: stats.size,
        keywords: keywords,
        lastModified: stats.mtime.toISOString()
      };

      // Add dimensions if available
      if (dimensions) {
        imageEntry.dimensions = dimensions;
      }

      // Add to index
      images.push(imageEntry);

      processed++;

      // Progress indicator
      if (processed % 100 === 0) {
        console.log(`Processed ${processed}/${imageFiles.length} images...`);
      }

    } catch (error) {
      console.error(`Failed to process ${fullPath}:`, error.message);
      skipped++;
    }
  }

  console.log(`\n✅ Processed ${processed} images`);
  if (skipped > 0) {
    console.log(`⚠️ Skipped ${skipped} images due to errors`);
  }

  // Build final index
  const imageIndex = {
    version: '1.0',
    path: '/images',  // Base path in CDN directory structure (game-assets/images)
    totalImages: images.length,
    generatedAt: new Date().toISOString(),
    images: images
  };

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Write index
  console.log(`\n💾 Writing image-index.json...`);
  await fs.writeFile(INDEX_PATH, JSON.stringify(imageIndex, null, 2), 'utf-8');

  // Calculate file size
  const indexStats = await fs.stat(INDEX_PATH);

  console.log(`\n📊 Summary:`);
  console.log(`  Total images: ${images.length}`);
  console.log(`  Categories: ${new Set(images.map(img => img.category)).size}`);
  console.log(`  image-index.json: ${(indexStats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\n✅ Image index built successfully!`);
}

// Run the script
buildImageIndexes().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
