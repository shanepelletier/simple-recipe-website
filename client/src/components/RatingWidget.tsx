import { useState } from "react";
import { Link } from "react-router";

import * as api from "../core/api";
import { useAuth } from "../core/auth-context";
import { asApiError } from "../core/client";
import type { RatingResponse } from "../core/models";

const STARS = [1, 2, 3, 4, 5];

interface Props {
  recipeId: number;
  average: number | null;
  count: number;
  userRating: number | null;
  /**
   * Handed straight up to whoever owns the Recipe, which folds it back in.
   *
   * The widget deliberately keeps no copy of the rating: one that did would
   * disagree with the summary above it the moment either changed. It also
   * means the new average comes from the response rather than being
   * recalculated here — the server has already done that arithmetic, and
   * doing it twice is two chances to get it wrong.
   */
  onRated: (response: RatingResponse) => void;
}

export function RatingWidget({ recipeId, average, count, userRating, onRated }: Props) {
  const { user } = useAuth();
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  // Preview follows the pointer on the user's own layer only. The average
  // layer underneath is context, not something the pointer is editing.
  const shown = hover ?? userRating;

  async function onClick(star: number) {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailure("");
    try {
      // Clicking the star you already chose clears the rating. There is no
      // separate "remove" control, because the obvious gesture is to click it
      // again and a second control would have to explain why it exists.
      const response =
        star === userRating ? await api.unrate(recipeId) : await api.rate(recipeId, star);
      onRated(response);
    } catch (reason) {
      setFailure(asApiError(reason).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rating">
      <div className="rating__stars" onMouseLeave={() => setHover(null)}>
        {/* Three layers, each with one job. The empty track gives the control
            a shape when nothing is set. The average sits above it, clipped to
            a fraction of the width so 4.5 really draws four and a half stars
            rather than rounding and contradicting the number below. The user's
            own stars sit on top in a translucent colour, so where both are
            present the two mix into a third tone. */}
        <span className="rating__track" aria-hidden="true">
          {STARS.map((star) => (
            <span key={star} className="star">
              ☆
            </span>
          ))}
        </span>

        <span
          className="rating__average"
          style={{ width: `${((average ?? 0) / STARS.length) * 100}%` }}
          aria-hidden="true"
        >
          {STARS.map((star) => (
            <span key={star} className="star">
              ★
            </span>
          ))}
        </span>

        {user !== null && (
          <span className="rating__user">
            {STARS.map((star) => (
              <button
                key={star}
                type="button"
                className={`star star--button${shown !== null && star <= shown ? " star--user" : ""}`}
                disabled={busy}
                onMouseEnter={() => setHover(star)}
                onFocus={() => setHover(star)}
                onBlur={() => setHover(null)}
                onClick={() => void onClick(star)}
                aria-label={
                  star === userRating
                    ? `Remove your rating of ${star} out of 5`
                    : `Rate ${star} out of 5`
                }
                aria-pressed={userRating !== null && star <= userRating}
              >
                ★
              </button>
            ))}
          </span>
        )}
      </div>

      {/* Colour is the fast summary, never the only one: two hues plus the
          blend where they overlap is exactly the encoding that fails for a
          colourblind reader, and it says nothing in a screenshot. Both numbers
          are stated here in words as well. */}
      <p className="rating__summary">
        {average === null
          ? "Not yet rated"
          : `${average} average from ${count} ${count === 1 ? "rating" : "ratings"}`}
        {userRating !== null && ` · you rated ${userRating}`}
      </p>

      {user === null && (
        <p className="rating__summary">
          <Link to="/login">Sign in</Link> to rate this recipe.
        </p>
      )}

      {failure !== "" && <p role="alert">{failure}</p>}
    </div>
  );
}
