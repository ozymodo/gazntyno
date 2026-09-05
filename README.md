# gazntyno

An evolving space for games, words, and everything in between — one personal
site for games, blog posts, and media, staged inside a single persistent 3D
world instead of separate static pages.

## The world

The whole site lives inside one ambient, cursor-reactive particle scene
(Three.js) that never fully unmounts as you move around. Nav orbs, blog
posts, and media snapshots all drift in that same field; clicking one dives
the camera through space to the next page rather than swapping in a flat
route. Clicking anywhere else spawns short-lived "nodes" in the field, and
the homepage's wordmark bends away from the cursor like something suspended
in liquid. It's meant to feel alive and a little overgrown — the accent
palette leans forest: emerald growth, moss teal, amber light through canopy.

## What's here

- **Games** — playable worlds built from scratch. **Microbyte** casts you as
  a tiny organism in a microscopic world: survive, hunt, and multiply in a
  dynamic ecosystem, blending roguelite, simulation, and strategy, playable
  straight in the browser. **Freeroam** drops you into the ambient scene
  itself in first person (WASD + pointer-lock mouse-look) on devices with a
  precise pointer.
- **Blog** — posts from the site's one creator account, drifting in the
  scene as nodes you click open.
- **Media** — a gallery of images and video from the creator, same
  drifting-node interaction as the blog.
- **Account** — a profile (username, bio, avatar, a custom homepage
  wordmark) plus levels and XP earned by exploring, posting, viewing media,
  and playing Microbyte. Sign in with email/password or Google and your
  profile and progress sync to your account instead of staying local to one
  device.
- **Settings** — tune the scene itself: accent color, particle density,
  reduced motion, and the homepage wordmark's font/color/weight.

## Under the hood

Next.js (App Router, static export) with Tailwind, Framer Motion for page
transitions, and Three.js for the persistent scene. Firebase (Authentication
+ Firestore, optionally Storage) backs sign-in, per-account profile sync,
and the live Blog/Media feed; anyone can read that feed, but only the
site's one designated creator account can post to it. The site itself
deploys as a static export to GitHub Pages.
