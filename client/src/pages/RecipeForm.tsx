import { useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { QuantityInput } from "../components/QuantityInput";
import * as api from "../core/api";
import { asApiError } from "../core/client";
import type { Recipe, Tag, UnitGroup } from "../core/models";
import { PHOTO_ACCEPT, photoProblem } from "../core/photos";
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
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  // The recipe as the server last returned it, which is null until the first
  // successful save. Only reachable on screen when the photo then failed:
  // every other successful save leaves for the recipe page.
  const [saved, setSaved] = useState<Recipe | null>(null);
  // Clearing the photo state does not clear the input, which keeps showing the
  // old filename until its value is reset by hand.
  const fileInput = useRef<HTMLInputElement>(null);

  // What a save will act on. After a create whose photo upload failed, that is
  // the recipe that now exists — so pressing Save again updates it instead of
  // creating a second copy of the same recipe.
  const target = saved ?? recipe;
  const storedPhoto = target?.photo ?? null;
  const savedWithoutPhoto = saved !== null && photoError !== "";

  // A blob URL lives until it is revoked, so the previous one is released
  // whenever the choice changes. Doing it here rather than in an effect keeps
  // the object URL out of the render cycle entirely.
  function choosePhoto(file: File | null) {
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

  function resetFileInput() {
    if (fileInput.current !== null) {
      fileInput.current.value = "";
    }
  }

  function clearPhoto() {
    choosePhoto(null);
    resetFileInput();
  }

  /** The preview failed to decode, so the file is not the image its name
   *  claims. The server's third check is exactly this — Pillow opening the
   *  file — and the browser has already done the work by the time the preview
   *  breaks, so there is no reason to save first and find out afterwards. */
  function rejectUndecodablePhoto() {
    clearPhoto();
    setPhotoError("Upload a valid image file.");
  }

  function toggleTag(tagId: number) {
    setSelectedTags((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  }

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

  const tagsFull = selectedTags.length >= MAX_TAGS;

  return (
    <form onSubmit={onSubmit}>
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

      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <FieldErrors messages={errors.name} />

      <h2>Photo</h2>
      {/* One photo on screen at a time: a new choice replaces the stored one
          in the preview, because that is what saving is about to do. */}
      {photo !== null ? (
        <img
          className="form__photo"
          src={photo.url}
          alt="Selected photo"
          onError={rejectUndecodablePhoto}
        />
      ) : (
        storedPhoto !== null && (
          <img className="form__photo" src={storedPhoto} alt="Current photo" />
        )
      )}
      <div className="detail__actions">
        <label>
          {storedPhoto === null ? "Add a photo" : "Replace photo"}
          <input
            ref={fileInput}
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
          />
        </label>
        {photo !== null && (
          <button type="button" onClick={clearPhoto}>
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

      <h2>Ingredients</h2>
      {/* A list, one message per bad row, so a five-ingredient recipe says
          which line the server objected to. */}
      <FieldErrors messages={errors.ingredients} />
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
      <FieldErrors messages={errors.steps} />
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
      <FieldErrors messages={errors.tags} />
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
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save recipe"}
        </button>
        <button type="button" onClick={() => navigate(-1)}>
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
