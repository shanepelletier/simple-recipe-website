import { useCallback, useState } from "react";
import type { SubmitEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { QuantityInput } from "../components/QuantityInput";
import { RemoveButton } from "../components/RemoveButton";
import { SortableRows } from "../components/SortableRows";
import { TagField } from "../components/TagField";
import * as api from "../core/api";
import { asApiError } from "../core/client";
import type { Recipe, Tag, UnitGroup } from "../core/models";
import { PHOTO_ACCEPT, usePhotoChoice } from "../core/photos";
import {
  blankIngredient,
  blankStep,
  completeIngredients,
  moveRow,
  removeRow,
  rowsFromRecipe,
  stepsFromRecipe,
  toRecipeBody,
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

  // Bumped when the conflict panel's Reload is pressed. It goes into the
  // editor's key, so a reload replaces the whole form — including the version
  // it will send next — rather than refreshing the data underneath state that
  // still remembers the stale one.
  const [reloads, setReloads] = useState(0);

  // All three or none. A form whose unit list never arrived can be typed into
  // and never completed — every ingredient needs a unit — so a failed units
  // call is as fatal here as a missing recipe, and saying so beats a select
  // that silently offers nothing.
  const loading = existing.loading || units.loading || tags.loading;
  const failure = existing.error ?? units.error ?? tags.error;

  // The same column the form takes, so the page doesn't change width as it
  // resolves — and the same heading, kept outside the states the way the
  // shopping list keeps its own: a recipe that is still arriving, or that
  // failed to arrive, is still the page that was asked for. The name is the
  // one part that has to wait, which is why the editor sets its own heading
  // once it has one.
  if (loading || failure !== null) {
    return (
      <div className="recipe-form">
        <h1>{recipeId === null ? "New recipe" : "Edit recipe"}</h1>
        {failure === null ? (
          <div className="state" aria-busy="true">
            <p>Loading…</p>
          </div>
        ) : (
          <div className="state">
            <p>
              {failure.status === 404 ? "That recipe doesn't exist." : "Couldn't load the recipe."}
            </p>
            {/* Nothing to retry when the recipe isn't there, so the only useful
                control is the way out. Anything else is a button that will fail
                again for the same reason. */}
            {failure.status === 404 ? (
              <Link className="btn-link" to="/">
                Back to recipes
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  existing.reload();
                  units.reload();
                  tags.reload();
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    // Remounted per recipe id, which is what resets the form when the route
    // changes. /recipes/1/edit to /recipes/2/edit matches the same route, so
    // React would otherwise reuse this instance and keep recipe 1's values —
    // unreachable by clicking, but a hand-typed URL finds it immediately.
    <Editor
      key={`${recipeId ?? "new"}:${reloads}`}
      recipe={existing.data ?? null}
      unitGroups={units.data?.groups ?? []}
      allTags={tags.data?.results ?? []}
      onReload={() => {
        existing.reload();
        setReloads((n) => n + 1);
      }}
    />
  );
}

function Editor({
  recipe,
  unitGroups,
  allTags,
  onReload,
}: {
  /** null when creating. Editing carries the id and the version together, so
   *  neither can be missing while the other is present. */
  recipe: Recipe | null;
  unitGroups: UnitGroup[];
  allTags: Tag[];
  onReload: () => void;
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
  const { photo, photoError, setPhotoError, fileInput, choose, clear, rejectUndecodable } =
    usePhotoChoice();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  // The recipe as the server last returned it, which is null until the first
  // successful save. Only reachable on screen when the photo then failed:
  // every other successful save leaves for the recipe page.
  const [saved, setSaved] = useState<Recipe | null>(null);
  // What a save will act on. After a create whose photo upload failed, that is
  // the recipe that now exists — so pressing Save again updates it instead of
  // creating a second copy of the same recipe.
  const target = saved ?? recipe;
  const storedPhoto = target?.photo ?? null;
  const savedWithoutPhoto = saved !== null && photoError !== "";

  // The tag field speaks in names because that is what it shows; the request
  // carries ids. Both directions go through the one vocabulary the form
  // loaded, so neither side has to invent the half it doesn't hold.
  const tagNames = selectedTags
    .map((id) => allTags.find((tag) => tag.id === id)?.name)
    .filter((tagName) => tagName !== undefined);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }

    const problems: Record<string, string[]> = {};
    const ready = completeIngredients(ingredients);
    if (name.trim() === "") {
      problems.name = ["Give the recipe a name."];
    }
    if (ready === null) {
      problems.ingredients = ["Every ingredient needs a quantity, a unit and a name."];
    }
    const written = steps.filter((step) => step.text.trim() !== "");
    if (written.length === 0) {
      problems.steps = ["Add at least one step."];
    }
    if (ready === null || Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError("");
    setPhotoError("");
    setConflict(false);

    const body = toRecipeBody(name.trim(), selectedTags, ready, written);

    try {
      // Branching on the recipe rather than on an id kept alongside it: the
      // id and the version are either both present or both absent, so there is
      // no state where one has to be invented.
      const { recipe: stored } =
        target === null
          ? await api.createRecipe(body)
          : await api.updateRecipe(target.id, {
              ...body,
              // Sending back the version this form was loaded against is what
              // lets the server tell "nobody touched it" from "someone did".
              version: target.version,
            });
      setSaved(stored);

      if (photo !== null) {
        // The photo has its own endpoint, so it can only go up once the recipe
        // has an id — and its own try, because by this point the recipe is
        // safely stored. Reporting a refused photo as a failed save would send
        // the user back to retype work the server already has.
        try {
          await api.uploadRecipePhoto(stored.id, photo.file);
        } catch (reason) {
          const failure = asApiError(reason);
          // The reason is in fields.photo: model validation answers with the
          // generic "Please correct the errors below." at the top level, which
          // says nothing beside a panel that already announces the failure.
          setPhotoError(failure.fields.photo?.join(" ") ?? failure.message);
          return;
        }
      }

      navigate(`/recipes/${stored.id}`);
    } catch (reason) {
      const failure = asApiError(reason);
      if (failure.status === 409) {
        setConflict(true);
        return;
      }
      setErrors(failure.fields);
      setFormError(failure.message);
    } finally {
      // Runs even on the `return` above, which matters: the conflict path has
      // to leave Save pressable so it can be tried again after a reload.
      setSaving(false);
    }
  }

  // Stable across renders because SortableRows subscribes the window to a live
  // drag with these in the dependency list; fresh closures every render would
  // tear that subscription down and rebuild it on every pointer move.
  const describeIngredient = useCallback(
    // The ingredient itself once there is one, so a control says "Remove olive
    // oil" rather than counting rows at somebody who cannot see them.
    (row: IngredientRow, index: number) =>
      row.ingredientName.trim() === "" ? `ingredient ${index + 1}` : row.ingredientName.trim(),
    [],
  );
  const describeStep = useCallback((_row: StepRow, index: number) => `step ${index + 1}`, []);
  const moveIngredient = useCallback(
    (from: number, to: number) => setIngredients((rows) => moveRow(rows, from, to)),
    [],
  );
  const moveStep = useCallback(
    (from: number, to: number) => setSteps((rows) => moveRow(rows, from, to)),
    [],
  );

  // Named, not navigate(-1). A recipe opened straight from a bookmark or a
  // hand-typed /edit URL has whatever came before it in history — another
  // site, or nothing — and Cancel should never be the control that leaves.
  function cancel() {
    navigate(target === null ? "/" : `/recipes/${target.id}`);
  }

  return (
    <form className="recipe-form" onSubmit={onSubmit}>
      {/* From the same expression the save branches on, so the heading cannot
          claim this is still a new recipe once one has been created. */}
      <h1>{target === null ? "New recipe" : `Edit ${target.name}`}</h1>

      {/* The visible payoff of the optimistic locking, so it reads as a
          designed state rather than a generic failure. The typed values stay
          on screen until the user chooses — nothing is discarded for them. */}
      {conflict && (
        <div className="conflict" role="alert">
          <h2>Someone else edited this recipe while you were working on it</h2>
          <p>Your changes haven&rsquo;t been saved.</p>
          <p>
            Reloading replaces what is on screen with their version. Copy anything you want to keep
            first.
          </p>
          <button type="button" onClick={onReload}>
            Reload
          </button>
        </div>
      )}

      {/* Two things happened and only one of them failed, so the panel has to
          say both. Left as a plain "couldn't save", the user reasonably
          concludes their recipe is gone and types it again. */}
      {savedWithoutPhoto && (
        <div className="notice" role="alert">
          <h2>Recipe saved, but the photo didn&rsquo;t upload</h2>
          <p>{photoError}</p>
          <p>
            Choose another photo and save again, or{" "}
            <Link to={`/recipes/${saved.id}`}>go to the recipe</Link> without one.
          </p>
        </div>
      )}

      {formError !== "" && <p role="alert">{formError}</p>}

      <div className="recipe-form__field">
        <label>
          Name
          <input
            value={name}
            aria-invalid={errors.name === undefined ? undefined : true}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <FieldErrors messages={errors.name} />
      </div>

      <section className="recipe-form__section">
        <h2>Photo</h2>
        {/* Drawn at the ratio the recipe page will show it at, and filled
            before there is anything in it, so choosing a photo replaces a box
            that is already there rather than pushing the rest of the form
            down as the image decodes. One photo on screen at a time: a new
            choice replaces the stored one, because that is what saving is
            about to do. */}
        <div className="recipe-form__photo">
          {photo !== null ? (
            <img src={photo.url} alt="Selected photo" onError={rejectUndecodable} />
          ) : (
            storedPhoto !== null && <img src={storedPhoto} alt="Current photo" />
          )}
        </div>
        <div className="recipe-form__photo-actions">
          <label>
            {storedPhoto === null ? "Add a photo" : "Replace photo"}
            <input
              ref={fileInput}
              type="file"
              accept={PHOTO_ACCEPT}
              onChange={(event) => choose(event.target.files?.[0] ?? null)}
            />
          </label>
          {photo !== null && (
            <button type="button" onClick={clear}>
              {/* Not "Remove" once a photo is stored: no endpoint deletes one, so
                  that label would promise something the app cannot do. All this
                  can undo is the choice. */}
              {storedPhoto === null ? "Remove" : "Keep the current photo"}
            </button>
          )}
        </div>
        {/* Only when the panel above isn't already carrying the same sentence. */}
        {!savedWithoutPhoto && (
          <FieldErrors messages={photoError === "" ? undefined : [photoError]} />
        )}
      </section>

      <section className="recipe-form__section">
        <h2>Ingredients</h2>
        {/* A list, one message per bad row, so a five-ingredient recipe says
            which line the server objected to. */}
        <FieldErrors messages={errors.ingredients} />
        <SortableRows
          className="rows"
          items={ingredients}
          describe={describeIngredient}
          onMove={moveIngredient}
        >
          {(row, index) => (
            <>
              <QuantityInput
                value={row}
                unitGroups={unitGroups}
                onChange={(value: QuantityValue) =>
                  setIngredients((rows) => updateRow(rows, row.key, value))
                }
              />
              <RemoveButton
                label={`Remove ${describeIngredient(row, index)}`}
                disabled={ingredients.length === 1}
                onClick={() => setIngredients((rows) => removeRow(rows, row.key))}
              />
            </>
          )}
        </SortableRows>
        <button
          type="button"
          onClick={() => setIngredients((rows) => [...rows, blankIngredient()])}
        >
          Add ingredient
        </button>
      </section>

      <section className="recipe-form__section">
        <h2>Steps</h2>
        <FieldErrors messages={errors.steps} />
        <SortableRows
          className="rows rows--steps"
          items={steps}
          describe={describeStep}
          onMove={moveStep}
        >
          {(row, index) => (
            <>
              {/* A rendered numeral rather than the CSS counter the detail page
                  uses for the same mark: here it has to sit after the drag
                  handle, and source order is what decides that. Same figure,
                  same muted ink — only the technique differs. */}
              <span className="rows__number">{index + 1}.</span>
              <textarea
                value={row.text}
                // The one box in this form with no visible label of its own —
                // the numeral beside it is not one, so the box carries the
                // name itself.
                aria-label={`Step ${index + 1}`}
                ref={fitToText}
                onChange={(event) => {
                  fitToText(event.target);
                  setSteps((rows) => updateRow(rows, row.key, { text: event.target.value }));
                }}
              />
              <RemoveButton
                label={`Remove ${describeStep(row, index)}`}
                disabled={steps.length === 1}
                onClick={() => setSteps((rows) => removeRow(rows, row.key))}
              />
            </>
          )}
        </SortableRows>
        <button type="button" onClick={() => setSteps((rows) => [...rows, blankStep()])}>
          Add step
        </button>
      </section>

      <section className="recipe-form__section">
        <h2 id="tags-heading">Tags</h2>
        <FieldErrors messages={errors.tags} />
        {/* The same field the grid filters with, capped at five. The control
            it replaced laid every tag out at once as a checkbox, which is a
            row that gets worse every time an admin adds a tag. */}
        <TagField
          id="recipe-tags"
          labelledBy="tags-heading"
          options={allTags}
          selected={tagNames}
          max={MAX_TAGS}
          onAdd={(tag) => setSelectedTags((current) => [...current, tag.id])}
          onRemove={(tagName) =>
            setSelectedTags((current) =>
              current.filter((id) => allTags.find((tag) => tag.id === id)?.name !== tagName),
            )
          }
        />
      </section>

      <div className="recipe-form__actions">
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save recipe"}
        </button>
        <button type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function FieldErrors({ messages }: { messages?: string[] }) {
  if (messages === undefined || messages.length === 0) {
    return null;
  }
  return (
    <ul className="field-errors" role="alert">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

/**
 * Sets a step box's height from what is written in it.
 *
 * A step is a sentence or a paragraph, and neither of those knows in advance
 * how many lines it wants. Left at a fixed two rows the box scrolls its own
 * content internally, which is the one place in this form where what you typed
 * goes out of sight while you are still typing it.
 *
 * The reset is load-bearing: scrollHeight never reports less than the height
 * already standing on the element, so without it the box could only ever grow.
 */
function fitToText(box: HTMLTextAreaElement | null) {
  if (box === null) {
    return;
  }
  box.style.height = "auto";
  box.style.height = `${box.scrollHeight}px`;
}
