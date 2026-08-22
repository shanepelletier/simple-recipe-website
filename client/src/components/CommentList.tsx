import { useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { Link } from "react-router";

import * as api from "../core/api";
import { useAuth } from "../core/auth-context";
import { asApiError } from "../core/client";
import type { Comment } from "../core/models";
import { useApi } from "../core/useApi";

type Sort = "newest" | "oldest";

export function CommentList({ recipeId }: { recipeId: number }) {
  const [sort, setSort] = useState<Sort>("newest");

  return (
    <section>
      <h2>Comments</h2>

      <label>
        Sort
        <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>

      {/* Keyed by sort, which remounts the thread and throws away every page
          it had accumulated. Changing the order is a filter change, not "load
          more": pages fetched under two different orders would interleave
          wrongly if they were merged. The key does that reset without a single
          line of code to keep in step. */}
      <Thread key={sort} recipeId={recipeId} sort={sort} />
    </section>
  );
}

function Thread({ recipeId, sort }: { recipeId: number; sort: Sort }) {
  const { user } = useAuth();

  // Page 1 comes from the loading hook, so it gets the race guard, the
  // loading flag and the error state for free.
  const first = useApi(() => api.comments(recipeId, 1, sort), [recipeId, sort]);

  const [more, setMore] = useState<Comment[]>([]);
  // Newest-first regardless of the display order, so it only has to be
  // reversed in one place.
  const [added, setAdded] = useState<Comment[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  // Counted rather than derived from more.length, which would mean knowing the
  // server's page size and being wrong the day it changes.
  const [loadedPages, setLoadedPages] = useState(1);

  const totalPages = first.data?.pages ?? 1;

  const fetched = [...(first.data?.results ?? []), ...more];
  const comments = (
    sort === "newest" ? [...added, ...fetched] : [...fetched, ...[...added].reverse()]
  ).filter((comment) => !removed.includes(comment.id));

  async function loadMore() {
    setLoadingMore(true);
    try {
      const page = await api.comments(recipeId, loadedPages + 1, sort);
      setMore((current) => [...current, ...page.results]);
      setLoadedPages(page.page);
    } finally {
      setLoadingMore(false);
    }
  }

  if (first.loading) {
    return <p>Loading comments…</p>;
  }

  if (first.error !== null) {
    return (
      <div className="state">
        <p>Couldn&rsquo;t load the comments.</p>
        <button type="button" onClick={first.reload}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {user === null ? (
        <p>
          <Link to="/login">Sign in</Link> to leave a comment.
        </p>
      ) : (
        // A new comment is always the newest one, so where it goes depends on
        // which way the list is pointing.
        <CommentForm recipeId={recipeId} onAdded={(c) => setAdded((prev) => [c, ...prev])} />
      )}

      {comments.length === 0 ? (
        <p>No comments yet.</p>
      ) : (
        <ul className="comments">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onDeleted={() => setRemoved((prev) => [...prev, comment.id])}
            />
          ))}
        </ul>
      )}

      {loadedPages < totalPages && (
        <button type="button" onClick={() => void loadMore()} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}

function CommentItem({ comment, onDeleted }: { comment: Comment; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (busy || !confirm("Delete this comment?")) {
      return;
    }
    setBusy(true);
    try {
      await api.deleteComment(comment.id);
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="comment">
      <p>
        <strong>{comment.author}</strong>{" "}
        <time dateTime={comment.created_at}>
          {new Date(comment.created_at).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
        </time>
      </p>
      <p>{comment.body}</p>

      {comment.photo !== null && (
        // Opens the full-size image in a new tab rather than in a dialog —
        // the browser's own image viewer already zooms and pans.
        <a href={comment.photo} target="_blank" rel="noreferrer">
          <img className="comment__photo" src={comment.photo} alt="" loading="lazy" />
        </a>
      )}

      {comment.can_delete && (
        <button type="button" onClick={() => void onDelete()} disabled={busy}>
          Delete
        </button>
      )}
    </li>
  );
}

function CommentForm({
  recipeId,
  onAdded,
}: {
  recipeId: number;
  onAdded: (comment: Comment) => void;
}) {
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");
  // Clearing the photo state does not clear the input, which keeps showing the
  // old filename until its value is reset by hand.
  const fileInput = useRef<HTMLInputElement>(null);

  // A blob URL lives until it is revoked, so the previous one is released
  // whenever the choice changes. Doing it here rather than in an effect keeps
  // the object URL out of the render cycle entirely.
  function choosePhoto(file: File | null) {
    if (photo !== null) {
      URL.revokeObjectURL(photo.url);
    }
    setPhoto(file === null ? null : { file, url: URL.createObjectURL(file) });
  }

  function clearPhoto() {
    choosePhoto(null);
    if (fileInput.current !== null) {
      fileInput.current.value = "";
    }
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    setFormError("");

    try {
      const { comment } = await api.addComment(recipeId, body, photo?.file);
      onAdded(comment);
      setBody("");
      clearPhoto();
    } catch (reason) {
      const failure = asApiError(reason);
      setFieldErrors(failure.fields);
      setFormError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {formError !== "" && <p role="alert">{formError}</p>}

      <label>
        Add a comment
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          required
        />
      </label>
      {fieldErrors.body?.map((message) => (
        <p key={message} role="alert">
          {message}
        </p>
      ))}

      <label>
        Attach photo
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
        />
      </label>
      {fieldErrors.photo?.map((message) => (
        <p key={message} role="alert">
          {message}
        </p>
      ))}

      {photo !== null && (
        <div>
          <img className="comment__photo" src={photo.url} alt="Selected attachment" />
          <button type="button" onClick={clearPhoto}>
            Remove
          </button>
        </div>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}
