import { Link } from "react-router";

// Aliased rather than renaming the interface: the API's vocabulary is worth
// keeping, and the clash is only inside this one file.
import type { RecipeCard as RecipeCardModel } from "../core/models";

export function RecipeCard({ recipe }: { recipe: RecipeCardModel }) {
  return (
    <Link to={`/recipes/${recipe.id}`} className="card">
      {/* Fixed aspect ratio whether or not there is a photo, so the grid
          doesn't reflow as images arrive. */}
      <div className="card__photo">
        {recipe.photo === null ? (
          <span className="card__placeholder" aria-hidden="true" />
        ) : (
          <img src={recipe.photo} loading="lazy" alt={recipe.name} />
        )}
      </div>

      <h2 className="card__name">{recipe.name}</h2>

      {/* An explicit null test, not `{recipe.rating && …}`. React renders a
          falsy *number* rather than skipping it, so the natural version puts a
          bare 0 where the rating goes — which reads as a rating of zero, a
          thing this app cannot produce, rather than as "not rated yet". */}
      {recipe.rating === null ? (
        <p className="card__rating">Not yet rated</p>
      ) : (
        <p className="card__rating">
          ★ {recipe.rating} ({recipe.rating_count})
        </p>
      )}

      {/* Already limited to three and ordered alphabetically by the server —
          re-sorting or re-slicing here would just be a second opinion that can
          disagree with the detail page. */}
      {recipe.tags.length > 0 && (
        <ul className="card__tags">
          {recipe.tags.map((tag) => (
            <li key={tag.id}>{tag.name}</li>
          ))}
        </ul>
      )}

      <p className="card__owner">{recipe.owner}</p>
    </Link>
  );
}
