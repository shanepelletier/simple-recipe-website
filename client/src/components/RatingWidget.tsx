import { useState } from "react";
import { Link, useLocation } from "react-router";

import * as api from "../core/api";
import { useAuth } from "../core/auth-context";
import { asApiError } from "../core/client";
import type { RatingResponse } from "../core/models";
import { returnTo, withNext } from "../core/next";

const STARS = [1, 2, 3, 4, 5];

// Drawn rather than the ★/☆ characters: a font glyph carries side bearing —
// blank space inside its own box before the ink starts — and the average
// layer clips a star mid-width to draw a fraction like 3.25. Clipped inside
// that bearing, a quarter star showed as a single stray pixel instead of a
// recognizable quarter. This path fills its 24x24 box edge to edge, so the
// same width clip reveals a proportional slice instead.
const STAR_PATH =
  "M12 1 L14.47 8.6 L22.46 8.6 L16 13.3 L18.47 20.9 L12 16.2 L5.53 20.9 L8 13.3 L1.54 8.6 L9.53 8.6 Z";

function StarIcon({ outline = false }: { outline?: boolean }) {
  return (
    <svg className="star-icon" viewBox="0 0 24 24" aria-hidden="true">
      {outline ? (
        <path d={STAR_PATH} fill="none" stroke="currentColor" strokeWidth="1.6" />
      ) : (
        <path d={STAR_PATH} fill="currentColor" />
      )}
    </svg>
  );
}

interface Props {
  recipeId: number;
  average: number | null;
  count: number;
  userRating: number | null;
  /** True for the recipe's own author — they can't rate their own recipe. */
  isOwner: boolean;
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

export function RatingWidget({ recipeId, average, count, userRating, isOwner, onRated }: Props) {
  const { user } = useAuth();
  const location = useLocation();
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  // Preview follows the pointer on the user's own layer only. The average
  // layer underneath is context, not something the pointer is editing.
  const shown = hover ?? userRating;

  // The stars round the average to the nearest half; the text below states
  // the exact figure. A star's outer points are thin, so clipping one at an
  // arbitrary width — a quarter, a third — reveals only a sliver of the tip
  // rather than anything read as "a quarter of a star." Halves are the
  // finest fraction whose clip still lands past the point into the star's
  // body, where there's enough width for the fill to look proportional.
  const displayAverage = average === null ? 0 : Math.round(average * 2) / 2;

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
            own stars sit on top: opaque green where the average doesn't reach,
            so an above-average rating still reads clearly against the paper,
            and a partial-alpha blend only over the stars the average fills,
            so a star carrying both reads as a third tone instead of hiding one. */}
        <span className="rating__track" aria-hidden="true">
          {STARS.map((star) => (
            <span key={star} className="star">
              <StarIcon outline />
            </span>
          ))}
        </span>

        <span
          className="rating__average"
          style={{ width: `${(displayAverage / STARS.length) * 100}%` }}
          aria-hidden="true"
        >
          {STARS.map((star) => (
            <span key={star} className="star">
              <StarIcon />
            </span>
          ))}
        </span>

        {user !== null && !isOwner && (
          <span className="rating__user">
            {STARS.map((star) => (
              <button
                key={star}
                type="button"
                className={`star star--button${
                  shown === null || star > shown
                    ? ""
                    : // Only a star the average actually reaches underneath needs the
                      // translucent blend; past that, plain alpha over bare paper reads
                      // as a washed-out grey barely different from an unrated star, so
                      // the rest of the user's own stars go opaque instead.
                      star <= displayAverage
                      ? " star--user-blend"
                      : " star--user"
                }`}
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
                <StarIcon />
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
          {/* Carries the recipe along: the offer is to rate *this* one, so
              landing on the grid afterwards fails the sentence it just read. */}
          <Link to={withNext("/login", returnTo(location))}>Sign in</Link> to rate this recipe.
        </p>
      )}

      {isOwner && <p className="rating__summary">You can't rate your own recipe.</p>}

      {failure !== "" && <p role="alert">{failure}</p>}
    </div>
  );
}
