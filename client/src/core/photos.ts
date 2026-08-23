// The client half of the rules the server enforces in recipes/photos.py.
// Duplicated on purpose: the server stays the authority, but the recipe form
// uploads a photo only *after* the recipe has saved, so a file the server was
// always going to refuse costs the user an upload and a half-finished save.
// Catching it at the moment the file is chosen makes that outcome rare.

import { useRef, useState } from "react";

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

/**
 * The photo a form is holding, and the rules for taking one.
 *
 * Both forms that upload a photo — a recipe's and a comment's — post to
 * endpoints that run the same validators, so the guards live in one hook
 * rather than in two copies that agree today.
 */
export function usePhotoChoice() {
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [photoError, setPhotoError] = useState("");
  // Clearing the photo does not clear the input, which keeps showing the old
  // filename until its value is reset by hand.
  const fileInput = useRef<HTMLInputElement>(null);

  function resetFileInput() {
    if (fileInput.current !== null) {
      fileInput.current.value = "";
    }
  }

  // A blob URL lives until it is revoked, so the previous one is released
  // whenever the choice changes. Doing it here rather than in an effect keeps
  // the object URL out of the render cycle entirely.
  function choose(file: File | null) {
    if (photo !== null) {
      URL.revokeObjectURL(photo.url);
    }
    setPhotoError("");

    const problem = file === null ? null : photoProblem(file);
    if (problem !== null) {
      setPhotoError(problem);
      setPhoto(null);
      resetFileInput();
      return;
    }

    setPhoto(file === null ? null : { file, url: URL.createObjectURL(file) });
  }

  function clear() {
    choose(null);
    resetFileInput();
  }

  /** The preview failed to decode, so the file is not the image its name
   *  claims. The server's third check is exactly this — Pillow opening the
   *  file — and the browser has already done the work by the time the preview
   *  breaks, so there is no reason to upload first and find out afterwards. */
  function rejectUndecodable() {
    clear();
    setPhotoError("Upload a valid image file.");
  }

  return { photo, photoError, setPhotoError, fileInput, choose, clear, rejectUndecodable };
}
