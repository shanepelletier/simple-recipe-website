// The client half of the rules the server enforces in recipes/photos.py.
// Duplicated on purpose: the server stays the authority, but the recipe form
// uploads a photo only *after* the recipe has saved, so a file the server was
// always going to refuse costs the user an upload and a half-finished save.
// Catching it at the moment the file is chosen makes that outcome rare.

/** Matches settings.MAX_UPLOAD_BYTES. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Matches ALLOWED_EXTENSIONS. */
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

/** For a file input's accept attribute, from the same list rather than a
 *  second copy of it that can drift. */
export const PHOTO_ACCEPT = ALLOWED_EXTENSIONS.join(",");

/**
 * Null when the file is fine, otherwise the reason.
 *
 * Worded exactly as the server words it, so the message doesn't change
 * depending on which side happened to catch the file.
 *
 * Takes only the two properties it reads rather than a whole File: the
 * extension is what the server checks, not the browser's MIME guess, and a
 * test can then state a size instead of building a 5 MB blob.
 */
export function photoProblem(file: Pick<File, "name" | "size">): string | null {
  if (file.size > MAX_PHOTO_BYTES) {
    return `Image must be smaller than ${MAX_PHOTO_BYTES / (1024 * 1024)} MB.`;
  }
  if (!ALLOWED_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))) {
    return "Image must be a JPG, PNG, or WebP file.";
  }
  return null;
}
