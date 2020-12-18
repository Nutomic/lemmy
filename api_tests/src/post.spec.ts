jest.setTimeout(120000);
import {
  alpha,
  beta,
  gamma,
  delta,
  epsilon,
  setupLogins,
  createPost,
  updatePost,
  stickyPost,
  lockPost,
  searchPost,
  likePost,
  followBeta,
  searchForBetaCommunity,
  createComment,
  deletePost,
  removePost,
  getPost,
  unfollowRemotes,
  searchForUser,
  banUserFromSite,
  searchPostLocal,
  banUserFromCommunity,
} from './shared';
import {
  Post,
  Community,
} from 'lemmy-js-client';

let betaCommunity: Community;

beforeAll(async () => {
  await setupLogins();
  let search = await searchForBetaCommunity(alpha);
  betaCommunity = search.communities[0];
  await unfollows();
});

afterAll(async () => {
  await unfollows();
});

async function unfollows() {
  await unfollowRemotes(alpha);
  await unfollowRemotes(gamma);
  await unfollowRemotes(delta);
  await unfollowRemotes(epsilon);
}

function assertPostFederation(
  postOne: Post,
  postTwo: Post) {
  expect(postOne.ap_id).toBe(postTwo.ap_id);
  expect(postOne.name).toBe(postTwo.name);
  expect(postOne.body).toBe(postTwo.body);
  expect(postOne.url).toBe(postTwo.url);
  expect(postOne.nsfw).toBe(postTwo.nsfw);
  expect(postOne.embed_title).toBe(postTwo.embed_title);
  expect(postOne.embed_description).toBe(postTwo.embed_description);
  expect(postOne.embed_html).toBe(postTwo.embed_html);
  expect(postOne.published).toBe(postTwo.published);
  expect(postOne.community_actor_id).toBe(postTwo.community_actor_id);
  expect(postOne.locked).toBe(postTwo.locked);
  expect(postOne.removed).toBe(postTwo.removed);
  expect(postOne.deleted).toBe(postTwo.deleted);
}

test('Create a post', async () => {
  let postRes = await createPost(alpha, betaCommunity.id);
  expect(postRes.post).toBeDefined();
  expect(postRes.post.community_local).toBe(false);
  expect(postRes.post.creator_local).toBe(true);
  expect(postRes.post.score).toBe(1);

  // Make sure that post is liked on beta
  let searchBeta = await searchPost(beta, postRes.post);
  let betaPost = searchBeta.posts[0];

  expect(betaPost).toBeDefined();
  expect(betaPost.community_local).toBe(true);
  expect(betaPost.creator_local).toBe(false);
  expect(betaPost.score).toBe(1);
  assertPostFederation(betaPost, postRes.post);

  // Delta only follows beta, so it should not see an alpha ap_id
  let searchDelta = await searchPost(delta, postRes.post);
  expect(searchDelta.posts[0]).toBeUndefined();

  // Epsilon has alpha blocked, it should not see the alpha post
  let searchEpsilon = await searchPost(epsilon, postRes.post);
  expect(searchEpsilon.posts[0]).toBeUndefined();
});

test('Create a post in a non-existent community', async () => {
  let postRes = await createPost(alpha, -2);
  expect(postRes).toStrictEqual({ error: 'couldnt_create_post' });
});

test('Unlike a post', async () => {
  let postRes = await createPost(alpha, betaCommunity.id);
  let unlike = await likePost(alpha, 0, postRes.post);
  expect(unlike.post.score).toBe(0);

  // Try to unlike it again, make sure it stays at 0
  let unlike2 = await likePost(alpha, 0, postRes.post);
  expect(unlike2.post.score).toBe(0);

  // Make sure that post is unliked on beta
  let searchBeta = await searchPost(beta, postRes.post);
  let betaPost = searchBeta.posts[0];
  expect(betaPost).toBeDefined();
  expect(betaPost.community_local).toBe(true);
  expect(betaPost.creator_local).toBe(false);
  expect(betaPost.score).toBe(0);
  assertPostFederation(betaPost, postRes.post);
});

test('Update a post', async () => {
  let postRes = await createPost(alpha, betaCommunity.id);

  let updatedName = 'A jest test federated post, updated';
  let updatedPost = await updatePost(alpha, postRes.post);
  expect(updatedPost.post.name).toBe(updatedName);
  expect(updatedPost.post.community_local).toBe(false);
  expect(updatedPost.post.creator_local).toBe(true);

  // Make sure that post is updated on beta
  let searchBeta = await searchPost(beta, postRes.post);
  let betaPost = searchBeta.posts[0];
  expect(betaPost.community_local).toBe(true);
  expect(betaPost.creator_local).toBe(false);
  expect(betaPost.name).toBe(updatedName);
  assertPostFederation(betaPost, updatedPost.post);

  // Make sure lemmy beta cannot update the post
  let updatedPostBeta = await updatePost(beta, betaPost);
  expect(updatedPostBeta).toStrictEqual({ error: 'no_post_edit_allowed' });
});

test('Sticky a post', async () => {
  let postRes = await createPost(alpha, betaCommunity.id);

  let stickiedPostRes = await stickyPost(alpha, true, postRes.post);
  expect(stickiedPostRes.post.stickied).toBe(true);
  // Make sure that post is stickied on beta
  let searchBeta = await searchPost(beta, postRes.post);
  let betaPost = searchBeta.posts[0];
  expect(betaPost.community_local).toBe(true);
  expect(betaPost.creator_local).toBe(false);
  expect(betaPost.stickied).toBe(true);

  // Unsticky a post
  let unstickiedPost = await stickyPost(alpha, false, postRes.post);
  expect(unstickiedPost.post.stickied).toBe(false);

  // Make sure that post is unstickied on beta
  let searchBeta2 = await searchPost(beta, postRes.post);
  let betaPost2 = searchBeta2.posts[0];
  expect(betaPost2.community_local).toBe(true);
  expect(betaPost2.creator_local).toBe(false);
  expect(betaPost2.stickied).toBe(false);

  // Make sure that gamma cannot sticky the post on beta
  let searchGamma = await searchPost(gamma, postRes.post);
  let gammaPost = searchGamma.posts[0];
  let gammaTrySticky = await stickyPost(gamma, true, gammaPost);
  let searchBeta3 = await searchPost(beta, postRes.post);
  let betaPost3 = searchBeta3.posts[0];
  expect(gammaTrySticky.post.stickied).toBe(true);
  expect(betaPost3.stickied).toBe(false);
});

test('Lock a post', async () => {
  let postRes = await createPost(alpha, betaCommunity.id);

  // Lock the post
  let lockedPostRes = await lockPost(alpha, true, postRes.post);
  expect(lockedPostRes.post.locked).toBe(true);

  // Make sure that post is locked on beta
  let searchBeta = await searchPostLocal(beta, postRes.post);
  let betaPost1 = searchBeta.posts[0];
  expect(betaPost1.locked).toBe(true);

  // Try to make a new comment there, on alpha
  let comment = await createComment(alpha, postRes.post.id);
  expect(comment['error']).toBe('locked');

  // Unlock a post
  let unlockedPost = await lockPost(alpha, false, postRes.post);
  expect(unlockedPost.post.locked).toBe(false);

  // Make sure that post is unlocked on beta
  let searchBeta2 = await searchPost(beta, postRes.post);
  let betaPost2 = searchBeta2.posts[0];
  expect(betaPost2.community_local).toBe(true);
  expect(betaPost2.creator_local).toBe(false);
  expect(betaPost2.locked).toBe(false);

  // Try to create a new comment, on beta
  let commentBeta = await createComment(beta, betaPost2.id);
  expect(commentBeta).toBeDefined();
});

test('Delete a post', async () => {
  let postRes = await createPost(alpha, betaCommunity.id);
  expect(postRes.post).toBeDefined();

  let deletedPost = await deletePost(alpha, true, postRes.post);
  expect(deletedPost.post.deleted).toBe(true);

  // Make sure lemmy beta sees post is deleted
  let searchBeta = await searchPost(beta, postRes.post);
  let betaPost = searchBeta.posts[0];
  // This will be undefined because of the tombstone
  expect(betaPost).toBeUndefined();

  // Undelete
  let undeletedPost = await deletePost(alpha, false, postRes.post);
  expect(undeletedPost.post.deleted).toBe(false);

  // Make sure lemmy beta sees post is undeleted
  let searchBeta2 = await searchPost(beta, postRes.post);
  let betaPost2 = searchBeta2.posts[0];
  expect(betaPost2.deleted).toBe(false);
  assertPostFederation(betaPost2, undeletedPost.post);

  // Make sure lemmy beta cannot delete the post
  let deletedPostBeta = await deletePost(beta, true, betaPost2);
  expect(deletedPostBeta).toStrictEqual({ error: 'no_post_edit_allowed' });
});

test('Remove a post from admin and community on different instance', async () => {
  let postRes = await createPost(alpha, betaCommunity.id);

  let removedPost = await removePost(alpha, true, postRes.post);
  expect(removedPost.post.removed).toBe(true);

  // Make sure lemmy beta sees post is NOT removed
  let searchBeta = await searchPost(beta, postRes.post);
  let betaPost = searchBeta.posts[0];
  expect(betaPost.removed).toBe(false);

  // Undelete
  let undeletedPost = await removePost(alpha, false, postRes.post);
  expect(undeletedPost.post.removed).toBe(false);

  // Make sure lemmy beta sees post is undeleted
  let searchBeta2 = await searchPost(beta, postRes.post);
  let betaPost2 = searchBeta2.posts[0];
  expect(betaPost2.removed).toBe(false);
  assertPostFederation(betaPost2, undeletedPost.post);
});

test('Remove a post from admin and community on same instance', async () => {
  await followBeta(alpha);
  let postRes = await createPost(alpha, betaCommunity.id);
  expect(postRes.post).toBeDefined();

  // Get the id for beta
  let searchBeta = await searchPostLocal(beta, postRes.post);
  let betaPost = searchBeta.posts[0];
  expect(betaPost).toBeDefined();

  // The beta admin removes it (the community lives on beta)
  let removePostRes = await removePost(beta, true, betaPost);
  expect(removePostRes.post.removed).toBe(true);

  // Make sure lemmy alpha sees post is removed
  let alphaPost = await getPost(alpha, postRes.post.id);
  expect(alphaPost.post.removed).toBe(true);
  assertPostFederation(alphaPost.post, removePostRes.post);

  // Undelete
  let undeletedPost = await removePost(beta, false, betaPost);
  expect(undeletedPost.post.removed).toBe(false);

  // Make sure lemmy alpha sees post is undeleted
  let alphaPost2 = await getPost(alpha, postRes.post.id);
  expect(alphaPost2.post.removed).toBe(false);
  assertPostFederation(alphaPost2.post, undeletedPost.post);
  await unfollowRemotes(alpha);
});

test('Search for a post', async () => {
  await unfollowRemotes(alpha);
  let postRes = await createPost(alpha, betaCommunity.id);
  expect(postRes.post).toBeDefined();

  let searchBeta = await searchPost(beta, postRes.post);

  expect(searchBeta.posts[0].name).toBeDefined();
});

test('A and G subscribe to B (center) A posts, it gets announced to G', async () => {
  await followBeta(alpha);
  await followBeta(gamma);
  let postRes = await createPost(alpha, betaCommunity.id);
  expect(postRes.post).toBeDefined();

  let search2 = await searchPostLocal(gamma, postRes.post);
  expect(search2.posts[0].name).toBeDefined();
  await unfollowRemotes(alpha);
  await unfollowRemotes(gamma);
});

test('Enforce site ban for federated user', async () => {

  let alphaShortname = `@lemmy_alpha@lemmy-alpha:8541`;
  let userSearch = await searchForUser(beta, alphaShortname);
  let alphaUser = userSearch.users[0];
  expect(alphaUser).toBeDefined();

  // ban alpha from beta site
  let banAlpha = await banUserFromSite(beta, alphaUser.id, true);
  expect(banAlpha.banned).toBe(true);

  // Alpha makes post on beta
  let postRes = await createPost(alpha, betaCommunity.id);
  expect(postRes.post).toBeDefined();
  expect(postRes.post.community_local).toBe(false);
  expect(postRes.post.creator_local).toBe(true);
  expect(postRes.post.score).toBe(1);

  // Make sure that post doesn't make it to beta
  let searchBeta = await searchPostLocal(beta, postRes.post);
  let betaPost = searchBeta.posts[0];
  expect(betaPost).toBeUndefined();

  // Unban alpha
  let unBanAlpha = await banUserFromSite(beta, alphaUser.id, false);
  expect(unBanAlpha.banned).toBe(false);
});

test('Enforce community ban for federated user', async () => {
  let alphaShortname = `@lemmy_alpha@lemmy-alpha:8541`;
  let userSearch = await searchForUser(beta, alphaShortname);
  let alphaUser = userSearch.users[0];
  expect(alphaUser).toBeDefined();

  // ban alpha from beta site
  await banUserFromCommunity(beta, alphaUser.id, 2, false);
  let banAlpha = await banUserFromCommunity(beta, alphaUser.id, 2, true);
  expect(banAlpha.banned).toBe(true);

  // Alpha makes post on beta
  let postRes = await createPost(alpha, betaCommunity.id);
  expect(postRes.post).toBeDefined();
  expect(postRes.post.community_local).toBe(false);
  expect(postRes.post.creator_local).toBe(true);
  expect(postRes.post.score).toBe(1);

  // Make sure that post doesn't make it to beta community
  let searchBeta = await searchPostLocal(beta, postRes.post);
  let betaPost = searchBeta.posts[0];
  expect(betaPost).toBeUndefined();

  // Unban alpha
  let unBanAlpha = await banUserFromCommunity(beta, alphaUser.id, 2, false);
  expect(unBanAlpha.banned).toBe(false);
});
