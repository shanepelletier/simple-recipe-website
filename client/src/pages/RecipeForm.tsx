import { useState } from "react";
import type { SubmitEvent } from "react";
import { useNavigate, useParams } from "react-router";

import { QuantityInput } from "../components/QuantityInput";
import * as api from "../core/api";
import type { Recipe, Tag, UnitGroup } from "../core/models";
import {
  blankIngredient,
  blankStep,
  completeIngredients,
  moveRow,
  removeRow,
  rowsFromRecipe,
  stepsFromRecipe,
  updateRow,
} from "../core/rows";
import type { IngredientRow, QuantityValue, StepRow } from "../core/rows";
import { useApi } from "../core/useApi";
import { useUnits } from "../core/units";

const MAX_TAGS = 5;

export default function RecipeForm() {
  const { id } = useParams();
  const recipeId = id === undefined ? null : Number(id);

  const existing = useApi(
    async () => (recipeId === null ? null : (await api.recipe(recipeId)).recipe),
    [recipeId],
  );
  const units = useUnits();
  const tags = useApi(() => api.tags(), []);

  if (existing.loading || units.loading || tags.loading) {
    return <p>Loading…</p>;
  }

  if (existing.error !== null) {
    return (
      <h1>
        {existing.error.status === 404 ? "That recipe doesn't exist." : "Couldn't load the recipe."}
      </h1>
    );
  }

  return (
    // Remounted per recipe id, which is what resets the form when the route
    // changes. /recipes/1/edit to /recipes/2/edit matches the same route, so
    // React would otherwise reuse this instance and keep recipe 1's values —
    // unreachable by clicking, but a hand-typed URL finds it immediately.
    <Editor
      key={recipeId ?? "new"}
      recipe={existing.data ?? null}
      unitGroups={units.data?.groups ?? []}
      allTags={tags.data?.results ?? []}
    />
  );
}

function Editor({
  recipe,
  unitGroups,
  allTags,
}: {
  recipe: Recipe | null;
  unitGroups: UnitGroup[];
  allTags: Tag[];
}) {
  const navigate = useNavigate();

  const [name, setName] = useState(recipe?.name ?? "");
  const [selectedTags, setSelectedTags] = useState<number[]>(
    recipe?.tags.map((tag) => tag.id) ?? [],
  );
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    recipe === null ? [blankIngredient()] : rowsFromRecipe(recipe),
  );
  const [steps, setSteps] = useState<StepRow[]>(
    recipe === null ? [blankStep()] : stepsFromRecipe(recipe),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleTag(tagId: number) {
    setSelectedTags((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const problems: Record<string, string> = {};
    if (name.trim() === "") {
      problems.name = "Give the recipe a name.";
    }
    if (completeIngredients(ingredients) === null) {
      problems.ingredients = "Every ingredient needs a quantity, a unit and a name.";
    }
    if (steps.every((step) => step.text.trim() === "")) {
      problems.steps = "Add at least one step.";
    }
    setErrors(problems);
  }

  const tagsFull = selectedTags.length >= MAX_TAGS;

  return (
    <form onSubmit={onSubmit}>
      <h1>{recipe === null ? "New recipe" : `Edit ${recipe.name}`}</h1>

      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {errors.name !== undefined && <p role="alert">{errors.name}</p>}

      <h2>Ingredients</h2>
      {errors.ingredients !== undefined && <p role="alert">{errors.ingredients}</p>}
      <ol className="rows">
        {ingredients.map((row, index) => (
          // Keyed by row.key, never by index. Keyed by index, React reuses the
          // node at position 2 for whatever row is now at position 2, so
          // deleting the first of three leaves the inputs showing the old
          // row's text and a move-up swaps the values straight back.
          <li key={row.key}>
            <QuantityInput
              value={row}
              unitGroups={unitGroups}
              onChange={(value: QuantityValue) =>
                setIngredients((rows) => updateRow(rows, row.key, value))
              }
            />
            <RowControls
              index={index}
              count={ingredients.length}
              onMove={(to) => setIngredients((rows) => moveRow(rows, index, to))}
              onRemove={() => setIngredients((rows) => removeRow(rows, row.key))}
            />
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setIngredients((rows) => [...rows, blankIngredient()])}>
        Add ingredient
      </button>

      <h2>Steps</h2>
      {errors.steps !== undefined && <p role="alert">{errors.steps}</p>}
      <ol className="rows">
        {steps.map((row, index) => (
          <li key={row.key}>
            <textarea
              value={row.text}
              rows={2}
              onChange={(event) =>
                setSteps((rows) => updateRow(rows, row.key, { text: event.target.value }))
              }
            />
            <RowControls
              index={index}
              count={steps.length}
              onMove={(to) => setSteps((rows) => moveRow(rows, index, to))}
              onRemove={() => setSteps((rows) => removeRow(rows, row.key))}
            />
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setSteps((rows) => [...rows, blankStep()])}>
        Add step
      </button>

      <h2>Tags</h2>
      <p>
        {selectedTags.length} of {MAX_TAGS} tags selected
      </p>
      <ul className="tag-picker">
        {allTags.map((tag) => {
          const checked = selectedTags.includes(tag.id);
          return (
            <li key={tag.id}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  // Disabling the unselected ones once five are chosen beats
                  // letting the server reject a sixth. The server is still the
                  // authority; this just means nobody meets it by accident.
                  disabled={!checked && tagsFull}
                  onChange={() => toggleTag(tag.id)}
                />
                {tag.name}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="detail__actions">
        <button type="submit">Save recipe</button>
        <button type="button" onClick={() => navigate(-1)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RowControls({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <span className="rows__controls">
      <button type="button" onClick={() => onMove(index - 1)} disabled={index === 0}>
        Move up
      </button>
      <button type="button" onClick={() => onMove(index + 1)} disabled={index === count - 1}>
        Move down
      </button>
      <button type="button" onClick={onRemove} disabled={count === 1}>
        Remove
      </button>
    </span>
  );
}
