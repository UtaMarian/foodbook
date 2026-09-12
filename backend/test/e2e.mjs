import sharp from 'sharp';

const API = 'http://localhost:3000/v1';
let pass = 0, fail = 0;

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  OK   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

async function call(path, { method = 'GET', token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !raw) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, {
    method,
    headers,
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

const suffix = Date.now().toString(36);

console.log('\n1. Inregistrare si autentificare');
const ra = await call('/auth/register', {
  method: 'POST',
  body: { username: `maria_${suffix}`, displayName: 'Maria Test', email: `maria_${suffix}@test.ro`, password: 'parola-sigura-123' },
});
check('register A -> 201', ra.status === 201, JSON.stringify(ra.body));
const A = ra.body.tokens.accessToken;

const rb = await call('/auth/register', {
  method: 'POST',
  body: { username: `andrei_${suffix}`, displayName: 'Andrei Test', email: `andrei_${suffix}@test.ro`, password: 'parola-sigura-456' },
});
check('register B -> 201', rb.status === 201);
const B = rb.body.tokens.accessToken;

const dup = await call('/auth/register', {
  method: 'POST',
  body: { username: `maria_${suffix}`, displayName: 'x', email: `alt_${suffix}@test.ro`, password: 'parola-sigura-123' },
});
check('username duplicat -> 409', dup.status === 409, JSON.stringify(dup.body));

const weak = await call('/auth/register', {
  method: 'POST',
  body: { username: 'ab', displayName: '', email: 'nu-e-email', password: '123' },
});
check('validare Zod -> 400 cu erori pe campuri', weak.status === 400 && weak.body.errors?.length >= 3, JSON.stringify(weak.body));

const badLogin = await call('/auth/login', { method: 'POST', body: { email: `maria_${suffix}@test.ro`, password: 'gresit' } });
check('parola gresita -> 401', badLogin.status === 401);

const noToken = await call('/feed');
check('fara token -> 401 (deny by default)', noToken.status === 401);

console.log('\n2. Upload imagine');
const jpeg = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#c0392b' } }).jpeg({ quality: 95 }).toBuffer();
console.log(`  (sursa: ${Math.round(jpeg.length / 1024)} KB, 2400x1600)`);

const form = new FormData();
form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'poza.jpg');
const up = await call('/uploads/image', { method: 'POST', token: A, body: form, raw: true });
check('upload -> 201 cu cheie si dimensiuni', up.status === 201 && up.body.key && up.body.width === 1600, JSON.stringify(up.body));

const badForm = new FormData();
badForm.append('file', new Blob([Buffer.from('nu sunt o imagine')], { type: 'image/jpeg' }), 'fals.jpg');
const badUp = await call('/uploads/image', { method: 'POST', token: A, body: badForm, raw: true });
check('fisier text cu extensie .jpg -> 400 (magic bytes)', badUp.status === 400, JSON.stringify(badUp.body));

console.log('\n3. Creare reteta');
const create = await call('/recipes', {
  method: 'POST', token: A,
  body: {
    title: 'Tort de ciocolata',
    description: 'Un tort simplu si delicios, perfect pentru weekend.',
    prepMinutes: 45, servings: 8,
    imageKeys: [up.body.key],
    ingredients: [
      { name: 'faina', quantity: 200, unit: 'g' },
      { name: 'zahar', quantity: 150, unit: 'g' },
      { name: 'oua', quantity: 2, unit: 'buc' },
    ],
    instructions: [{ text: 'Amestecam ingredientele.' }, { text: 'Punem compozitia in tava.' }, { text: 'Coacem 30 de minute.' }],
  },
});
check('creare -> 201', create.status === 201, JSON.stringify(create.body));
const recipeId = create.body?.id;
check('imaginea are dimensiuni reale', create.body?.images?.[0]?.width === 1600);
check('URL-ul imaginii e construit de backend', typeof create.body?.images?.[0]?.url === 'string' && create.body.images[0].url.startsWith('http') && create.body.images[0].url.includes('_feed.jpg'));
check('ingredientele pastreaza ordinea', create.body?.ingredients?.[0]?.name === 'faina');
check('pasii sunt numerotati de la 1', create.body?.instructions?.[0]?.stepNumber === 1);

const empty = await call('/recipes', { method: 'POST', token: A, body: { imageKeys: [], ingredients: [], instructions: [] } });
check('postare goala -> 400 (regula anti-postare-goala)', empty.status === 400, JSON.stringify(empty.body));

const stolen = await call('/recipes', { method: 'POST', token: B, body: { title: 'Furt', imageKeys: [up.body.key] } });
check('B foloseste cheia lui A -> 400', stolen.status === 400, JSON.stringify(stolen.body));

const reused = await call('/recipes', { method: 'POST', token: A, body: { title: 'Refolosire', imageKeys: [up.body.key] } });
check('cheie deja consumata -> 400', reused.status === 400);

const textOnly = await call('/recipes', { method: 'POST', token: B, body: { description: 'Pizza facuta aseara' } });
check('postare doar cu text -> 201 (model flexibil)', textOnly.status === 201, JSON.stringify(textOnly.body));

console.log('\n4. Feed si detaliu');
const feed = await call('/feed?limit=10', { token: B });
check('feed -> 200', feed.status === 200);
check('feed contine ambele retete', feed.body.items.length >= 2);
check('cel mai recent e primul', feed.body.items[0].id === textOnly.body.id);
check('feed include autorul', typeof feed.body.items[0].author?.username === 'string');
check('feed are nextCursor', 'nextCursor' in feed.body);

const detail = await call(`/recipes/${recipeId}`, { token: B });
check('detaliu -> 200 cu ingrediente si pasi', detail.status === 200 && detail.body.ingredients.length === 3 && detail.body.instructions.length === 3);

console.log('\n5. Paginare cursor');
const p1 = await call('/feed?limit=1', { token: B });
check('pagina 1 are 1 element si cursor', p1.body.items.length === 1 && p1.body.nextCursor);
const p2 = await call(`/feed?limit=1&cursor=${encodeURIComponent(p1.body.nextCursor)}`, { token: B });
check('pagina 2 e diferita de pagina 1', p2.body.items[0]?.id !== p1.body.items[0]?.id);
const badCursor = await call('/feed?cursor=xxx-invalid', { token: B });
check('cursor invalid -> 400', badCursor.status === 400);

console.log('\n6. Permisiuni');
const foreignEdit = await call(`/recipes/${recipeId}`, { method: 'PATCH', token: B, body: { title: 'Deturnat' } });
check('B editeaza reteta lui A -> 403', foreignEdit.status === 403, JSON.stringify(foreignEdit.body));
const foreignDelete = await call(`/recipes/${recipeId}`, { method: 'DELETE', token: B });
check('B sterge reteta lui A -> 403', foreignDelete.status === 403);

const ownEdit = await call(`/recipes/${recipeId}`, { method: 'PATCH', token: A, body: { title: 'Tort de ciocolata cu visine', servings: 10 } });
check('A editeaza propria reteta -> 200', ownEdit.status === 200 && ownEdit.body.title.includes('visine'));

const stripAll = await call(`/recipes/${textOnly.body.id}`, { method: 'PATCH', token: B, body: { description: '' } });
check('golirea ultimului camp -> 400', stripAll.status === 400, JSON.stringify(stripAll.body));

console.log('\n7. Profil');
const me = await call('/me', { token: A });
check('/me -> 200 cu email', me.status === 200 && me.body.email.includes('@'));
check('recipesCount = 1', me.body.recipesCount === 1, `primit ${me.body.recipesCount}`);

const patchMe = await call('/me', { method: 'PATCH', token: A, body: { bio: 'Gatesc de placere.' } });
check('editare profil -> 200', patchMe.status === 200 && patchMe.body.bio === 'Gatesc de placere.');

const avatarForm = new FormData();
const avatarBuf = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#2980b9' } }).jpeg().toBuffer();
avatarForm.append('file', new Blob([avatarBuf], { type: 'image/jpeg' }), 'avatar.jpg');
const avatar = await call('/me/avatar', { method: 'POST', token: A, body: avatarForm, raw: true });
check('upload avatar -> 201 cu avatarUrl', avatar.status === 201 && avatar.body.avatarUrl?.includes('avatars/'), JSON.stringify(avatar.body));

const pub = await call(`/users/maria_${suffix}`, { token: B });
check('profil public -> 200 fara email', pub.status === 200 && pub.body.email === undefined);

const userRecipes = await call(`/users/maria_${suffix}/recipes`, { token: B });
check('retetele utilizatorului -> 200', userRecipes.status === 200 && userRecipes.body.items.length === 1);

console.log('\n8. Refresh token');
const rot = await call('/auth/refresh', { method: 'POST', body: { refreshToken: ra.body.tokens.refreshToken } });
check('refresh -> 200 cu token nou', rot.status === 200 && rot.body.accessToken !== A);
const replay = await call('/auth/refresh', { method: 'POST', body: { refreshToken: ra.body.tokens.refreshToken } });
check('reutilizarea tokenului vechi -> 401 (rotatie)', replay.status === 401);
const afterTheft = await call('/auth/refresh', { method: 'POST', body: { refreshToken: rot.body.refreshToken } });
check('toate sesiunile revocate dupa reutilizare -> 401', afterTheft.status === 401, JSON.stringify(afterTheft.body));

console.log('\n9. Stergere');
const del = await call(`/recipes/${recipeId}`, { method: 'DELETE', token: A });
check('stergere proprie -> 204', del.status === 204);
const gone = await call(`/recipes/${recipeId}`, { token: B });
check('reteta stearsa -> 404', gone.status === 404);
const feedAfter = await call('/feed', { token: B });
check('reteta stearsa nu mai apare in feed', !feedAfter.body.items.some((r) => r.id === recipeId));
const meAfter = await call('/me', { token: rot.body.accessToken ?? A });
check('recipesCount revine la 0', meAfter.body?.recipesCount === 0, `primit ${meAfter.body?.recipesCount}`);

// ============================================================
// ETAPA 2 - social: likes, comentarii, follow, salvari, categorii,
// notificari, cautare, feed cu scope. Conturi noi, ca sa nu depinda
// de starea (rateta stearsa etc.) lasata de Etapa 1 mai sus.
// ============================================================

console.log('\n10. Cont nou pentru Etapa 2');
const rc = await call('/auth/register', {
  method: 'POST',
  body: { username: `carmen_${suffix}`, displayName: 'Carmen Test', email: `carmen_${suffix}@test.ro`, password: 'parola-sigura-789' },
});
check('register C -> 201', rc.status === 201, JSON.stringify(rc.body));
const C = rc.body.tokens.accessToken;
const cUsername = `carmen_${suffix}`;

const rd = await call('/auth/register', {
  method: 'POST',
  body: { username: `dan_${suffix}`, displayName: 'Dan Test', email: `dan_${suffix}@test.ro`, password: 'parola-sigura-000' },
});
check('register D -> 201', rd.status === 201);
const D = rd.body.tokens.accessToken;
const dUsername = `dan_${suffix}`;

console.log('\n11. Categorii');
const cats = await call('/categories', { token: C });
check('categorii -> 200, 10 din lista fixa', cats.status === 200 && cats.body.length === 10, JSON.stringify(cats.body));
const pasteSlug = cats.body.find((c) => c.slug === 'paste')?.slug;
check('slug "paste" exista', !!pasteSlug);

const badCategory = await call('/recipes', { method: 'POST', token: C, body: { title: 'x', categorySlug: 'nu-exista' } });
check('categorie invalida -> 400', badCategory.status === 400, JSON.stringify(badCategory.body));

console.log('\n12. Reteta cu categorie (Carmen)');
const cRecipe = await call('/recipes', {
  method: 'POST', token: C,
  body: { title: 'Paste cu pui', description: 'Cina rapida', categorySlug: 'paste' },
});
check('creare cu categorie -> 201', cRecipe.status === 201 && cRecipe.body.category?.slug === 'paste', JSON.stringify(cRecipe.body));
const cRecipeId = cRecipe.body.id;
check('isLiked/isSaved false la creare', cRecipe.body.isLiked === false && cRecipe.body.isSaved === false);

const catRecipes = await call('/categories/paste/recipes', { token: D });
check('reteta apare in categoria ei', catRecipes.status === 200 && catRecipes.body.items.some((r) => r.id === cRecipeId));

console.log('\n13. Like');
const like1 = await call(`/recipes/${cRecipeId}/like`, { method: 'POST', token: D });
check('like -> 200, likesCount 1', like1.status === 200 && like1.body.likesCount === 1, JSON.stringify(like1.body));
const like2 = await call(`/recipes/${cRecipeId}/like`, { method: 'POST', token: D });
check('like duplicat -> idempotent, tot 1', like2.status === 200 && like2.body.likesCount === 1);
const detailLiked = await call(`/recipes/${cRecipeId}`, { token: D });
check('detaliu arata isLiked=true pentru D', detailLiked.body.isLiked === true);
const detailNotLiked = await call(`/recipes/${cRecipeId}`, { token: C });
check('detaliu arata isLiked=false pentru autor (nu a dat like)', detailNotLiked.body.isLiked === false);
const unlike = await call(`/recipes/${cRecipeId}/like`, { method: 'DELETE', token: D });
check('unlike -> 200, likesCount 0', unlike.status === 200 && unlike.body.likesCount === 0);
const unlikeAgain = await call(`/recipes/${cRecipeId}/like`, { method: 'DELETE', token: D });
check('unlike din nou -> idempotent, tot 0', unlikeAgain.status === 200 && unlikeAgain.body.likesCount === 0);

console.log('\n14. Comentarii');
const comment1 = await call(`/recipes/${cRecipeId}/comments`, { method: 'POST', token: D, body: { content: 'Arata excelent!' } });
check('comentariu -> 201', comment1.status === 201 && comment1.body.canDelete === true, JSON.stringify(comment1.body));
const commentEmpty = await call(`/recipes/${cRecipeId}/comments`, { method: 'POST', token: D, body: { content: '   ' } });
check('comentariu gol -> 400', commentEmpty.status === 400);
const reply = await call(`/recipes/${cRecipeId}/comments`, { method: 'POST', token: C, body: { content: 'Multumesc!', parentCommentId: comment1.body.id } });
check('raspuns la comentariu -> 201', reply.status === 201 && reply.body.parentCommentId === comment1.body.id);
const replyToReply = await call(`/recipes/${cRecipeId}/comments`, { method: 'POST', token: D, body: { content: 'nested', parentCommentId: reply.body.id } });
check('raspuns la raspuns -> 400 (un singur nivel)', replyToReply.status === 400, JSON.stringify(replyToReply.body));
const commentsList = await call(`/recipes/${cRecipeId}/comments`, { token: C });
check('lista comentarii -> 2, commentsCount actualizat', commentsList.body.items.length === 2);
const recipeAfterComments = await call(`/recipes/${cRecipeId}`, { token: C });
check('recipe.commentsCount = 2', recipeAfterComments.body.commentsCount === 2, `primit ${recipeAfterComments.body.commentsCount}`);
const foreignDeleteComment = await call(`/comments/${comment1.body.id}`, { method: 'DELETE', token: C });
check('C sterge comentariul lui D -> 403', foreignDeleteComment.status === 403);
const ownDeleteComment = await call(`/comments/${comment1.body.id}`, { method: 'DELETE', token: D });
check('D sterge propriul comentariu -> 204', ownDeleteComment.status === 204);
const recipeAfterDelete = await call(`/recipes/${cRecipeId}`, { token: C });
check('commentsCount scade la 1', recipeAfterDelete.body.commentsCount === 1);

console.log('\n15. Salvare');
const save1 = await call(`/recipes/${cRecipeId}/save`, { method: 'POST', token: D });
check('salvare -> 200, savesCount 1', save1.status === 200 && save1.body.savesCount === 1);
const savedList = await call('/me/saved', { token: D });
check('lista salvate -> contine reteta, isSaved true', savedList.body.items.length === 1 && savedList.body.items[0].isSaved === true);
const unsave = await call(`/recipes/${cRecipeId}/save`, { method: 'DELETE', token: D });
check('desalvare -> 200, savesCount 0', unsave.status === 200 && unsave.body.savesCount === 0);
const savedListAfter = await call('/me/saved', { token: D });
check('lista salvate goala dupa desalvare', savedListAfter.body.items.length === 0);

console.log('\n16. Follow');
const selfFollow = await call(`/users/${cUsername}/follow`, { method: 'POST', token: C });
check('urmarirea propriului cont -> 400', selfFollow.status === 400);
const follow1 = await call(`/users/${cUsername}/follow`, { method: 'POST', token: D });
check('D urmareste C -> 204', follow1.status === 204);
const follow2 = await call(`/users/${cUsername}/follow`, { method: 'POST', token: D });
check('follow duplicat -> idempotent, tot 204', follow2.status === 204);
const cProfile = await call(`/users/${cUsername}`, { token: D });
check('followersCount=1, isFollowedByMe=true', cProfile.body.followersCount === 1 && cProfile.body.isFollowedByMe === true);
const dProfile = await call(`/users/${dUsername}`, { token: C });
check('followingCount=1 pentru D', dProfile.body.followingCount === 1);
const followers = await call(`/users/${cUsername}/followers`, { token: C });
check('lista followers -> contine D', followers.body.items.some((u) => u.username === dUsername));
const following = await call(`/users/${dUsername}/following`, { token: D });
check('lista following a lui D -> contine C', following.body.items.some((u) => u.username === cUsername));
const unfollow = await call(`/users/${cUsername}/follow`, { method: 'DELETE', token: D });
check('unfollow -> 204', unfollow.status === 204);
const cProfileAfter = await call(`/users/${cUsername}`, { token: D });
check('followersCount revine la 0', cProfileAfter.body.followersCount === 0);

console.log('\n17. Feed cu scope');
await call(`/users/${cUsername}/follow`, { method: 'POST', token: D });
const feedFollowing = await call('/feed?scope=following', { token: D });
check('feed following -> contine reteta lui C', feedFollowing.body.items.some((r) => r.id === cRecipeId));
const feedFollowingEmpty = await call('/feed?scope=following', { token: C });
check('feed following gol pentru cel care nu urmareste pe nimeni', feedFollowingEmpty.body.items.length === 0);
const feedDiscover = await call('/feed?scope=discover', { token: D });
check('feed discover -> 200', feedDiscover.status === 200 && Array.isArray(feedDiscover.body.items));
const feedBadScope = await call('/feed?scope=nonsens', { token: D });
check('scope invalid -> 400', feedBadScope.status === 400);

console.log('\n18. Cautare');
const searchByTitle = await call('/search/recipes?q=paste', { token: D });
check('cautare "paste" -> gaseste reteta', searchByTitle.body.items.some((r) => r.id === cRecipeId), JSON.stringify(searchByTitle.body));

const diacriticsRecipe = await call('/recipes', {
  method: 'POST', token: C,
  body: { title: 'Ciorbă de burtă', description: 'Reteta bunicii' },
});
check('creare reteta cu diacritice -> 201', diacriticsRecipe.status === 201);
// Directia reala: utilizatorul tasteaza fara diacritice si gaseste continutul care le are.
const searchNoDiacritics = await call('/search/recipes?q=ciorba', { token: D });
check(
  'cautare fara diacritice ("ciorba") gaseste "Ciorbă"',
  searchNoDiacritics.body.items.some((r) => r.id === diacriticsRecipe.body.id),
  JSON.stringify(searchNoDiacritics.body),
);
const searchNoMatch = await call('/search/recipes?q=xyzneexistent', { token: D });
check('cautare fara rezultate -> lista goala', searchNoMatch.body.items.length === 0);
const searchUsers = await call(`/search/users?q=${encodeURIComponent('carmen')}`, { token: D });
check('cautare utilizatori -> gaseste Carmen', searchUsers.body.items.some((u) => u.username === cUsername));

console.log('\n19. Notificari');
await call(`/recipes/${cRecipeId}/like`, { method: 'POST', token: D });
await call(`/recipes/${cRecipeId}/comments`, { method: 'POST', token: D, body: { content: 'inca un comentariu' } });
const notifs = await call('/notifications', { token: C });
check('Carmen are notificari pentru like si comentariu', notifs.body.items.length >= 2, JSON.stringify(notifs.body));
check('notificarile au actor si tip corecte', notifs.body.items.every((n) => n.actor.username === dUsername && ['like', 'comment', 'follow'].includes(n.type)));
const unreadBefore = await call('/notifications/unread-count', { token: C });
check('unread-count > 0', unreadBefore.body.count >= 2, JSON.stringify(unreadBefore.body));
const markRead = await call('/notifications/read', { method: 'POST', token: C });
check('marcare citite -> 204', markRead.status === 204);
const unreadAfter = await call('/notifications/unread-count', { token: C });
check('unread-count 0 dupa marcare', unreadAfter.body.count === 0);
const selfLikeNoNotif = await call(`/recipes/${cRecipeId}/like`, { method: 'POST', token: C });
check('like pe propria reteta nu genereaza eroare', selfLikeNoNotif.status === 200);
const notifsAfterSelfLike = await call('/notifications/unread-count', { token: C });
check('like pe propria reteta nu genereaza notificare', notifsAfterSelfLike.body.count === 0);

console.log('\n20. Editare reteta (campul category se poate schimba)');
const editCategory = await call(`/recipes/${cRecipeId}`, { method: 'PATCH', token: C, body: { categorySlug: 'deserturi' } });
check('schimbare categorie -> 200', editCategory.status === 200 && editCategory.body.category?.slug === 'deserturi');
const clearCategory = await call(`/recipes/${cRecipeId}`, { method: 'PATCH', token: C, body: { categorySlug: null } });
check('eliminare categorie -> 200, category null', clearCategory.status === 200 && clearCategory.body.category === null);

console.log(`\n=== ${pass} trecute, ${fail} esuate ===`);
process.exit(fail ? 1 : 0);
