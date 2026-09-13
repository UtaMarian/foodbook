import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Images, Camera, MinusCircle } from 'lucide-react';
import { createRecipeSchema, MAX_IMAGES_PER_RECIPE, type CreateRecipeInput } from '@foodbook/shared';
import { api, ApiError } from '@/lib/api';
import { pickImageFile, uploadRecipeImage, type PickedImage } from '@/lib/image';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { ChipButton } from '@/components/Chip';
import { cn } from '@/lib/utils';

interface DraftImage {
  localUri: string;
  key?: string;
  uploading: boolean;
  failed?: boolean;
}

interface DraftIngredient {
  id: string;
  quantity: string;
  unit: string;
  name: string;
}

interface DraftStep {
  id: string;
  text: string;
}

export interface RecipeFormInitial {
  title: string | null;
  description: string | null;
  prepMinutes: number | null;
  servings: number | null;
  categorySlug: string | null;
  images: { key: string; url: string }[];
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
  instructions: { text: string }[];
}

const newId = () => Math.random().toString(36).slice(2);

function draftImagesFrom(initial?: RecipeFormInitial): DraftImage[] {
  return (initial?.images ?? []).map((img) => ({ localUri: img.url, key: img.key, uploading: false }));
}

function draftIngredientsFrom(initial?: RecipeFormInitial): DraftIngredient[] {
  const list = initial?.ingredients ?? [];
  if (list.length === 0) return [{ id: newId(), quantity: '', unit: '', name: '' }];
  return list.map((i) => ({
    id: newId(),
    quantity: i.quantity !== null ? String(i.quantity) : '',
    unit: i.unit ?? '',
    name: i.name,
  }));
}

function draftStepsFrom(initial?: RecipeFormInitial): DraftStep[] {
  const list = initial?.instructions ?? [];
  if (list.length === 0) return [{ id: newId(), text: '' }];
  return list.map((s) => ({ id: newId(), text: s.text }));
}

/**
 * Formular unic pentru creare si editare. La editare, formularul retrimite
 * intreaga stare dorita (inclusiv imaginile pastrate, cu cheile lor), deci
 * aceeasi schema si aceeasi regula anti-postare-goala se aplica in ambele
 * cazuri - vezi RecipeImage.key in @foodbook/shared.
 */
export function RecipeForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: RecipeFormInitial;
  submitLabel: string;
  onSubmit: (payload: CreateRecipeInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [prepMinutes, setPrepMinutes] = useState(initial?.prepMinutes ? String(initial.prepMinutes) : '');
  const [servings, setServings] = useState(initial?.servings ? String(initial.servings) : '');
  const [categorySlug, setCategorySlug] = useState<string | null>(initial?.categorySlug ?? null);
  const [images, setImages] = useState<DraftImage[]>(() => draftImagesFrom(initial));
  const [ingredients, setIngredients] = useState<DraftIngredient[]>(() => draftIngredientsFrom(initial));
  const [steps, setSteps] = useState<DraftStep[]>(() => draftStepsFrom(initial));
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const uploading = images.some((i) => i.uploading);

  async function addImage(picked: PickedImage) {
    if (images.length >= MAX_IMAGES_PER_RECIPE) {
      setImageError(`Poți adăuga cel mult ${MAX_IMAGES_PER_RECIPE} imagini.`);
      return;
    }
    setImageError(null);
    const localUri = picked.previewUrl;
    setImages((prev) => [...prev, { localUri, uploading: true }]);
    try {
      const uploaded = await uploadRecipeImage(picked.file);
      setImages((prev) =>
        prev.map((i) => (i.localUri === localUri ? { ...i, key: uploaded.key, uploading: false } : i)),
      );
    } catch (err) {
      setImages((prev) =>
        prev.map((i) => (i.localUri === localUri ? { ...i, uploading: false, failed: true } : i)),
      );
      setImageError(err instanceof ApiError ? err.message : 'Imaginea nu s-a încărcat. Încearcă din nou.');
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void addImage(pickImageFile(file));
  }

  function removeImage(localUri: string) {
    setImages((prev) => prev.filter((i) => i.localUri !== localUri));
  }

  async function submit() {
    setError(null);

    const payload = {
      title: title.trim() || null,
      description: description.trim() || null,
      prepMinutes: prepMinutes ? Number(prepMinutes) : null,
      servings: servings ? Number(servings) : null,
      categorySlug,
      imageKeys: images.filter((i) => i.key).map((i) => i.key!),
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({
          name: i.name.trim(),
          quantity: i.quantity ? Number(i.quantity.replace(',', '.')) : null,
          unit: i.unit.trim() || null,
        })),
      instructions: steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim() })),
    };

    const parsed = createRecipeSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Verifică datele introduse');
      return;
    }

    setSaving(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Salvarea a eșuat');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Field label="Titlu" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tort de ciocolată" maxLength={140} />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-text-muted">
          Imagini ({images.length}/{MAX_IMAGES_PER_RECIPE})
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img) => (
            <div key={img.localUri} className="relative shrink-0">
              <img src={img.localUri} alt="" className="size-24 rounded-md bg-surface-alt object-cover" />
              {img.uploading ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/45">
                  <span className="text-xs font-semibold text-white">se încarcă…</span>
                </div>
              ) : null}
              {img.failed ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-danger/75">
                  <span className="text-xs font-semibold text-white">eșuat</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => removeImage(img.localUri)}
                aria-label="Elimină imaginea"
                className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-surface"
              >
                <X size={14} className="text-text" />
              </button>
            </div>
          ))}

          {images.length < MAX_IMAGES_PER_RECIPE ? (
            <>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-surface"
              >
                <Images size={22} className="text-text-muted" />
                <span className="text-xs font-semibold text-text-muted">Galerie</span>
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-surface"
              >
                <Camera size={22} className="text-text-muted" />
                <span className="text-xs font-semibold text-text-muted">Cameră</span>
              </button>
              <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileSelected} />
            </>
          ) : null}
        </div>
        {imageError ? <p className="text-xs text-danger">{imageError}</p> : null}
      </div>

      <Field
        label="Descriere"
        multiline
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Un tort simplu, perfect pentru weekend."
        maxLength={5000}
      />

      {categoriesQuery.data?.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-text-muted">Categorie</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <ChipButton active={categorySlug === null} onClick={() => setCategorySlug(null)}>
              Fără
            </ChipButton>
            {categoriesQuery.data.map((cat) => (
              <ChipButton key={cat.slug} active={categorySlug === cat.slug} onClick={() => setCategorySlug(cat.slug)}>
                {cat.emoji} {cat.name}
              </ChipButton>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex gap-3">
        <Field
          label="Timp (minute)"
          value={prepMinutes}
          onChange={(e) => setPrepMinutes(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="45"
          inputMode="numeric"
          className="flex-1"
        />
        <Field
          label="Porții"
          value={servings}
          onChange={(e) => setServings(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="8"
          inputMode="numeric"
          className="flex-1"
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-text-muted">Ingrediente</p>
        {ingredients.map((ing, index) => (
          <div key={ing.id} className="flex items-center gap-2">
            <input
              value={ing.quantity}
              onChange={(e) =>
                setIngredients((prev) => prev.map((x) => (x.id === ing.id ? { ...x, quantity: e.target.value } : x)))
              }
              placeholder="200"
              inputMode="decimal"
              className="w-16 rounded-sm border border-border bg-surface px-2 py-2.5 text-[15px] text-text placeholder:text-text-faint"
            />
            <input
              value={ing.unit}
              onChange={(e) =>
                setIngredients((prev) => prev.map((x) => (x.id === ing.id ? { ...x, unit: e.target.value } : x)))
              }
              placeholder="g"
              className="w-14 rounded-sm border border-border bg-surface px-2 py-2.5 text-[15px] text-text placeholder:text-text-faint"
            />
            <input
              value={ing.name}
              onChange={(e) =>
                setIngredients((prev) => prev.map((x) => (x.id === ing.id ? { ...x, name: e.target.value } : x)))
              }
              placeholder="făină"
              className="flex-1 rounded-sm border border-border bg-surface px-2 py-2.5 text-[15px] text-text placeholder:text-text-faint"
            />
            <button
              type="button"
              onClick={() =>
                setIngredients((prev) =>
                  prev.length === 1
                    ? [{ id: newId(), quantity: '', unit: '', name: '' }]
                    : prev.filter((x) => x.id !== ing.id),
                )
              }
              aria-label={`Elimină ingredientul ${index + 1}`}
              className="p-1"
            >
              <MinusCircle size={22} className="text-text-faint" />
            </button>
          </div>
        ))}
        <Button
          label="+ Adaugă ingredient"
          variant="secondary"
          onClick={() => setIngredients((prev) => [...prev, { id: newId(), quantity: '', unit: '', name: '' }])}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-text-muted">Mod de preparare</p>
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-alt text-xs font-bold text-text-muted',
              )}
            >
              {index + 1}
            </span>
            <textarea
              value={step.text}
              onChange={(e) => setSteps((prev) => prev.map((x) => (x.id === step.id ? { ...x, text: e.target.value } : x)))}
              placeholder="Amestecăm ingredientele uscate."
              className="min-h-11 flex-1 resize-y rounded-sm border border-border bg-surface px-2 py-2.5 text-[15px] text-text placeholder:text-text-faint"
            />
            <button
              type="button"
              onClick={() =>
                setSteps((prev) => (prev.length === 1 ? [{ id: newId(), text: '' }] : prev.filter((x) => x.id !== step.id)))
              }
              aria-label={`Elimină pasul ${index + 1}`}
              className="p-1"
            >
              <MinusCircle size={22} className="text-text-faint" />
            </button>
          </div>
        ))}
        <Button label="+ Adaugă pas" variant="secondary" onClick={() => setSteps((prev) => [...prev, { id: newId(), text: '' }])} />
      </div>

      {error ? <p className="text-center text-sm text-danger">{error}</p> : null}

      <Button label={uploading ? 'Se încarcă imaginile…' : submitLabel} onClick={submit} loading={saving} disabled={uploading} />
    </div>
  );
}
