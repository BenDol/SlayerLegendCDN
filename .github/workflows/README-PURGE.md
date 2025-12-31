# Image Purge Workflow

## Overview

The `purge-old-images.yml` workflow allows the repository owner to delete user-uploaded images older than a specified date.

## Security

- **Owner-only**: Only the repository owner can run this workflow
- **Manual trigger**: Must be manually triggered via GitHub Actions UI
- **Dry run by default**: Always runs in preview mode unless explicitly disabled

## Usage

### 1. Navigate to Actions

Go to: `https://github.com/BenDol/SlayerLegendCDN/actions/workflows/purge-old-images.yml`

### 2. Click "Run workflow"

### 3. Configure parameters

**cutoff_date** (required)
- Format: `YYYY-MM-DD`
- Example: `2025-01-01`
- Deletes all images uploaded **on or before** this date (inclusive, up to 23:59:59)

**dry_run** (optional, default: `true`)
- `true`: Preview what would be deleted (no actual deletion)
- `false`: Actually delete the files

### 4. Run the workflow

## Workflow Steps

1. **Verify Owner**: Checks that the runner is the repository owner
2. **Scan Metadata**: Reads all image metadata files to check upload dates
3. **Preview/Delete**: Shows or deletes files older than cutoff date
4. **Commit**: Commits the deletions (if not dry run)
5. **Regenerate Index**: Triggers image index regeneration automatically

## Example Usage

### Preview what would be deleted

```
cutoff_date: 2025-06-01
dry_run: true
```

Output:
```
🗑️  Would delete: 2025-05-15T10:30:00.000Z
    - user-content/images/other/2025/05/abc123.jpg
    - user-content/images/other/2025/05/abc123.webp
    - user-content/images/other/2025/05/abc123-metadata.json

========================================
Purge Summary
========================================
Images to delete: 15
Images kept: 42
Total size freed: 23.45 MB

⚠️  DRY RUN: No files were actually deleted
To delete for real, set dry_run to false
========================================
```

### Actually delete files

```
cutoff_date: 2025-06-01
dry_run: false
```

Output:
```
[Same preview as above]

✅ Files deleted successfully
✅ Triggered image index regeneration
```

## What Gets Deleted

For each image older than the cutoff date:
- Original image file (`{imageId}.jpg/png/etc`)
- WebP version (`{imageId}.webp`)
- Metadata file (`{imageId}-metadata.json`)

## Safety Features

1. **Owner verification**: Fails immediately if not run by repository owner
2. **Dry run default**: Always previews first unless explicitly disabled
3. **Date validation**: Validates cutoff date format before proceeding
4. **Metadata-based**: Only deletes images with valid metadata (no orphan cleanup)
5. **Automatic index update**: Ensures index stays synchronized

## Notes

- Images without `uploadedAt` or `uploadDate` in metadata are skipped
- The workflow uses metadata timestamps, not file modification times
- After deletion, the image index is automatically regenerated
- Total size freed is reported in the summary

## Maintenance Schedule Suggestion

Consider running this workflow:
- Monthly: Delete images older than 6 months
- Quarterly: Delete images older than 1 year
- Annually: Major cleanup of very old content

## Error Handling

If the workflow fails:
- **Not owner**: Only repository owner can run this
- **Invalid date**: Use `YYYY-MM-DD` format
- **No metadata**: Images without metadata are skipped (reported in summary)
