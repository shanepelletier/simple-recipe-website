import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { CommentList } from "../components/CommentList";
import { RatingWidget } from "../components/RatingWidget";
import * as api from "../core/api";
import { useAuth } from "../core/auth-context";
import { asApiError } from "../core/client";
import type { RatingResponse, Recipe } from "../core/models";
import { useApi } from "../core/useApi";

export default function RecipeDetail() {
  const { id } = useParams();
  // useParams gives string | undefined under strict. Converting once here
  // beats sprinkling Number(id) through the file.
  const recipeId = Number(id);

  const { data, loading, error, setData } = useApi(() => api.recipe(recipeId), [recipeId]);

  if (loading) {
    return <p>Loading recipe…</p>;
  }

  if (error !== null) {
    // A missing recipe is a different thing from a broken server, and saying
    // so is the difference between "you followed a dead link" and "we're down".
    return (
      <h1>{error.status === 404 ? "That recipe doesn't exist." : "Couldn't load the recipe."}</h1>
    );
  }

  if (data === null) {
    return null;
  }

  // Captured after the null check, because the closure below outlives this
  // render and TypeScript will not carry the narrowing into it.
  const recipe = data.recipe;

  // The page owns the Recipe, so folding a rating response back into it
  // happens here rather than in the widget. Everything the response carries is
  // the server's own arithmetic; none of it is recomputed.
  const onRated = (response: RatingResponse) =>
    setData({
      recipe: {
        ...recipe,
        user_rating: response.rating,
        rating: response.recipe.rating,
        rating_count: response.recipe.rating_count,
      },
    });

  return <Loaded recipe={recipe} onRated={onRated} />;
}

function Loaded({ recipe, onRated }: { recipe: Recipe; onRated: (r: RatingResponse) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [addedToList, setAddedToList] = useState(false);

  async function run(action: () => Promise<void>) {
    if (busy) {
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await action();
    } catch (reason) {
      setActionError(asApiError(reason).message);
    } finally {
      setBusy(false);
    }
  }

  function onDelete() {
    if (!confirm(`Delete "${recipe.name}"? This cannot be undone.`)) {
      return;
    }
    void run(async () => {
      await api.deleteRecipe(recipe.id);
      navigate("/");
    });
  }

  function onCopy() {
    void run(async () => {
      const { recipe: copy } = await api.copyRecipe(recipe.id);
      navigate(`/recipes/${copy.id}`);
    });
  }

  function onAddToShoppingList() {
    const count = recipe.ingredients.length;
    // Adding the same recipe twice doubles the quantities on purpose, so this
    // asks rather than silently no-opping or silently doubling.
    const noun = count === 1 ? "ingredient" : "ingredients";
    if (!confirm(`Add ${count} ${noun} to your shopping list?`)) {
      return;
    }
    void run(async () => {
      await api.addRecipeToShoppingList(recipe.id);
      setAddedToList(true);
    });
  }

  return (
    <article>
      <div className="detail__photo">
        {recipe.photo === null ? (
          <span className="card__placeholder" aria-hidden="true" />
        ) : (
          <img src={recipe.photo} alt={recipe.name} />
        )}
      </div>

      <h1>{recipe.name}</h1>
      <p>by {recipe.owner}</p>

      <RatingWidget
        recipeId={recipe.id}
        average={recipe.rating}
        count={recipe.rating_count}
        userRating={recipe.user_rating}
        onRated={onRated}
      />

      {recipe.copied_from_username !== "" && (
        <p>
          Copied from{" "}
          {recipe.copied_from_id === null ? (
            // The original was deleted, but the attribution survives it —
            // which is the whole reason the username is stored alongside the
            // foreign key.
            recipe.copied_from_username
          ) : (
            <Link to={`/recipes/${recipe.copied_from_id}`}>{recipe.copied_from_username}</Link>
          )}
        </p>
      )}

      {recipe.tags.length > 0 && (
        <ul className="card__tags">
          {recipe.tags.map((tag) => (
            <li key={tag.id}>{tag.name}</li>
          ))}
        </ul>
      )}

      <h2>Ingredients</h2>
      <ul>
        {recipe.ingredients.map((item) => (
          // The server's formatter is the single source of this string.
          // Rebuilding it here would be a second implementation of plurals
          // and the "of" rule, free to disagree with the shopping list.
          <li key={item.id}>{item.display}</li>
        ))}
      </ul>

      <h2>Steps</h2>
      <ol>
        {recipe.steps.map((step) => (
          <li key={step.id}>{step.text}</li>
        ))}
      </ol>

      {actionError !== "" && <p role="alert">{actionError}</p>}

      <div className="detail__actions">
        {recipe.can_edit && (
          <>
            <Link to={`/recipes/${recipe.id}/edit`}>Edit</Link>
            <button type="button" onClick={onDelete} disabled={busy}>
              Delete
            </button>
          </>
        )}

        {user !== null && (
          <>
            <button type="button" onClick={onCopy} disabled={busy}>
              Copy this recipe
            </button>
            <button type="button" onClick={onAddToShoppingList} disabled={busy}>
              Add all to shopping list
            </button>
          </>
        )}
      </div>

      {addedToList && (
        <p>
          Added to your <Link to="/shopping-list">shopping list</Link>.
        </p>
      )}

      <CommentList recipeId={recipe.id} />
    </article>
  );
}
