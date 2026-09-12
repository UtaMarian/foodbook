import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { createRecipeSchema, MAX_IMAGES_PER_RECIPE, type CreateRecipeInput } from '@foodbook/shared';
import { api, ApiError } from '../lib/api';
import { pickFromLibrary, takePhoto, uploadRecipeImage, type PickedImage } from '../lib/image';
import { Button, Field } from './ui';
import { radius, spacing, useColors } from '../theme';

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
  const c = useColors();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [prepMinutes, setPrepMinutes] = useState(initial?.prepMinutes ? String(initial.prepMinutes) : '');
  const [servings, setServings] = useState(initial?.servings ? String(initial.servings) : '');
  const [categorySlug, setCategorySlug] = useState<string | null>(initial?.categorySlug ?? null);
  const [images, setImages] = useState<DraftImage[]>(() => draftImagesFrom(initial));
  const [ingredients, setIngredients] = useState<DraftIngredient[]>(() => draftIngredientsFrom(initial));
  const [steps, setSteps] = useState<DraftStep[]>(() => draftStepsFrom(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const uploading = images.some((i) => i.uploading);

  async function addImage(source: 'library' | 'camera') {
    if (images.length >= MAX_IMAGES_PER_RECIPE) {
      Alert.alert('Limita atinsă', `Poți adăuga cel mult ${MAX_IMAGES_PER_RECIPE} imagini.`);
      return;
    }
    let picked: PickedImage | null = null;
    try {
      picked = source === 'camera' ? await takePhoto() : await pickFromLibrary();
    } catch (err) {
      Alert.alert('Permisiune refuzată', err instanceof Error ? err.message : 'Acces refuzat');
      return;
    }
    if (!picked) return;

    const localUri = picked.uri;
    setImages((prev) => [...prev, { localUri, uploading: true }]);
    try {
      const uploaded = await uploadRecipeImage(picked);
      setImages((prev) =>
        prev.map((i) => (i.localUri === localUri ? { ...i, key: uploaded.key, uploading: false } : i)),
      );
    } catch (err) {
      setImages((prev) =>
        prev.map((i) => (i.localUri === localUri ? { ...i, uploading: false, failed: true } : i)),
      );
      Alert.alert(
        'Imaginea nu s-a încărcat',
        err instanceof ApiError ? err.message : 'Încearcă din nou.',
      );
    }
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
    <View style={styles.container}>
      <Field
        label="Titlu"
        value={title}
        onChangeText={setTitle}
        placeholder="Tort de ciocolată"
        maxLength={140}
      />

      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
          Imagini ({images.length}/{MAX_IMAGES_PER_RECIPE})
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {images.map((img) => (
            <View key={img.localUri}>
              <Image
                source={{ uri: img.localUri }}
                style={[styles.thumb, { backgroundColor: c.surfaceAlt }]}
                contentFit="cover"
              />
              {img.uploading ? (
                <View style={styles.thumbOverlay}>
                  <Text style={styles.thumbOverlayText}>se încarcă…</Text>
                </View>
              ) : null}
              {img.failed ? (
                <View style={[styles.thumbOverlay, { backgroundColor: 'rgba(179,38,30,0.75)' }]}>
                  <Text style={styles.thumbOverlayText}>eșuat</Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => removeImage(img.localUri)}
                style={[styles.thumbRemove, { backgroundColor: c.surface, borderColor: c.border }]}
                accessibilityLabel="Elimină imaginea"
              >
                <Ionicons name="close" size={14} color={c.text} />
              </Pressable>
            </View>
          ))}

          {images.length < MAX_IMAGES_PER_RECIPE ? (
            <>
              <Pressable
                onPress={() => void addImage('library')}
                style={[styles.addThumb, { borderColor: c.border, backgroundColor: c.surface }]}
              >
                <Ionicons name="images-outline" size={22} color={c.textMuted} />
                <Text style={[styles.addThumbText, { color: c.textMuted }]}>Galerie</Text>
              </Pressable>
              <Pressable
                onPress={() => void addImage('camera')}
                style={[styles.addThumb, { borderColor: c.border, backgroundColor: c.surface }]}
              >
                <Ionicons name="camera-outline" size={22} color={c.textMuted} />
                <Text style={[styles.addThumbText, { color: c.textMuted }]}>Cameră</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </View>

      <Field
        label="Descriere"
        value={description}
        onChangeText={setDescription}
        placeholder="Un tort simplu, perfect pentru weekend."
        multiline
        maxLength={5000}
      />

      {categoriesQuery.data?.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Categorie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            <Pressable
              onPress={() => setCategorySlug(null)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: categorySlug === null ? c.primary : c.surfaceAlt,
                  borderColor: c.border,
                },
              ]}
            >
              <Text style={{ color: categorySlug === null ? c.primaryText : c.textMuted, fontWeight: '600' }}>
                Fără
              </Text>
            </Pressable>
            {categoriesQuery.data.map((cat) => (
              <Pressable
                key={cat.slug}
                onPress={() => setCategorySlug(cat.slug)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: categorySlug === cat.slug ? c.primary : c.surfaceAlt,
                    borderColor: c.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: categorySlug === cat.slug ? c.primaryText : c.textMuted,
                    fontWeight: '600',
                  }}
                >
                  {cat.emoji} {cat.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field
            label="Timp (minute)"
            value={prepMinutes}
            onChangeText={(t) => setPrepMinutes(t.replace(/[^0-9]/g, ''))}
            placeholder="45"
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Porții"
            value={servings}
            onChangeText={(t) => setServings(t.replace(/[^0-9]/g, ''))}
            placeholder="8"
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Ingrediente</Text>
        {ingredients.map((ing, index) => (
          <View key={ing.id} style={styles.dynamicRow}>
            <TextInput
              value={ing.quantity}
              onChangeText={(t) =>
                setIngredients((prev) => prev.map((x) => (x.id === ing.id ? { ...x, quantity: t } : x)))
              }
              placeholder="200"
              placeholderTextColor={c.textFaint}
              keyboardType="decimal-pad"
              style={[styles.smallInput, { width: 62, backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
            <TextInput
              value={ing.unit}
              onChangeText={(t) =>
                setIngredients((prev) => prev.map((x) => (x.id === ing.id ? { ...x, unit: t } : x)))
              }
              placeholder="g"
              placeholderTextColor={c.textFaint}
              style={[styles.smallInput, { width: 56, backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
            <TextInput
              value={ing.name}
              onChangeText={(t) =>
                setIngredients((prev) => prev.map((x) => (x.id === ing.id ? { ...x, name: t } : x)))
              }
              placeholder="făină"
              placeholderTextColor={c.textFaint}
              style={[styles.smallInput, { flex: 1, backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            />
            <Pressable
              onPress={() =>
                setIngredients((prev) =>
                  prev.length === 1
                    ? [{ id: newId(), quantity: '', unit: '', name: '' }]
                    : prev.filter((x) => x.id !== ing.id),
                )
              }
              accessibilityLabel={`Elimină ingredientul ${index + 1}`}
              style={styles.removeButton}
            >
              <Ionicons name="remove-circle-outline" size={22} color={c.textFaint} />
            </Pressable>
          </View>
        ))}
        <Button
          label="+ Adaugă ingredient"
          variant="secondary"
          onPress={() =>
            setIngredients((prev) => [...prev, { id: newId(), quantity: '', unit: '', name: '' }])
          }
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Mod de preparare</Text>
        {steps.map((step, index) => (
          <View key={step.id} style={styles.dynamicRow}>
            <Text style={[styles.stepNumber, { color: c.textMuted, backgroundColor: c.surfaceAlt }]}>
              {index + 1}
            </Text>
            <TextInput
              value={step.text}
              onChangeText={(t) =>
                setSteps((prev) => prev.map((x) => (x.id === step.id ? { ...x, text: t } : x)))
              }
              placeholder="Amestecăm ingredientele uscate."
              placeholderTextColor={c.textFaint}
              multiline
              style={[
                styles.smallInput,
                { flex: 1, minHeight: 46, backgroundColor: c.surface, borderColor: c.border, color: c.text },
              ]}
            />
            <Pressable
              onPress={() =>
                setSteps((prev) =>
                  prev.length === 1 ? [{ id: newId(), text: '' }] : prev.filter((x) => x.id !== step.id),
                )
              }
              accessibilityLabel={`Elimină pasul ${index + 1}`}
              style={styles.removeButton}
            >
              <Ionicons name="remove-circle-outline" size={22} color={c.textFaint} />
            </Pressable>
          </View>
        ))}
        <Button
          label="+ Adaugă pas"
          variant="secondary"
          onPress={() => setSteps((prev) => [...prev, { id: newId(), text: '' }])}
        />
      </View>

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      <Button
        label={uploading ? 'Se încarcă imaginile…' : submitLabel}
        onPress={submit}
        loading={saving}
        disabled={uploading}
      />
      <View style={{ height: spacing.xxl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  sectionLabel: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.md },
  dynamicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  smallInput: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md - 2,
    fontSize: 15,
  },
  removeButton: { padding: spacing.xs },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: 'center',
    lineHeight: 26,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  thumb: { width: 96, height: 96, borderRadius: radius.md },
  thumbOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOverlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumb: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addThumbText: { fontSize: 12, fontWeight: '600' },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  error: { fontSize: 14, textAlign: 'center' },
});
