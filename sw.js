// Service worker for Liams Pokémon Matteäventyr
// - index.html: network first, so updates pushed to GitHub reach the game right away
// - images and sounds: from cache first (works offline)
// - long music tracks: cached the first time they play, or in the background
//   after the game has been open a while
// Bump VERSION when an image or sound is replaced under the same file name.
const VERSION = 'v1';
const CORE_CACHE = 'core-' + VERSION;
const MEDIA_CACHE = 'media-v1';

const CORE_FILES = [
    "./",
    "index.html",
    "manifest.json",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-512.png",
    "icons/apple-touch-icon.png",
    "Articuno.webp",
    "Beedrill.webp",
    "Blastoise.webp",
    "Boss1_TR.webp",
    "Boss1_TR_lost.webp",
    "Boss2_Giovanni.webp",
    "Braixen.webp",
    "Bulbasaur.webp",
    "Butterfree.webp",
    "Caterpie.webp",
    "Celebi.webp",
    "Charizard.webp",
    "Charmander.webp",
    "Charmeleon.webp",
    "Dragonair.webp",
    "Ekans.webp",
    "Froakie.webp",
    "Frogadier.webp",
    "Gastly.webp",
    "Gengar.webp",
    "Greeninja.webp",
    "Hawlucha.webp",
    "Jirachi.webp",
    "Koffing.webp",
    "Krabby.webp",
    "Liam_combat_arena.webp",
    "Liam_dialog.webp",
    "Liam_leaving_Kalmar_1x1.webp",
    "Liam_long_walk_1x1.webp",
    "Liam_sunset_forest_1x1.webp",
    "Liam_trainer.webp",
    "Liam_trainer_bossfight.webp",
    "Liam_trainer_happy.webp",
    "Liam_trainer_trophy.webp",
    "Liams_mattespel_Intro.mp3",
    "Liams_mattespel_fanfare_boss1_TR.mp3",
    "Liams_mattespel_fanfare_boss2_Giovanni.mp3",
    "Liams_mattespel_pokemon_catch.mp3",
    "Liams_mattespel_pokemon_evolve.mp3",
    "Liams_mattespel_trophy.mp3",
    "Lucario.webp",
    "Lucario_mega.webp",
    "Meowth.webp",
    "Mew.webp",
    "Noctowl.webp",
    "Noibat.webp",
    "Noivern.webp",
    "Octillery.webp",
    "Onix.webp",
    "Pichu.webp",
    "Pidgey.webp",
    "Pikachu.webp",
    "Pokeball.webp",
    "Pokeball_open.webp",
    "Pokemon_arena_1.webp",
    "Professor_Ek.webp",
    "Psyduck.webp",
    "Raichu.webp",
    "Rattata.webp",
    "Riolu.webp",
    "Scorbunny.webp",
    "Snorlax.webp",
    "Squirtle.webp",
    "Startmeny.webp",
    "Staryu.webp",
    "Tentacool.webp",
    "Venosaur.webp",
    "Victini.webp",
    "Volcanion.webp",
    "Wartortle.webp",
    "Zubat.webp",
    "catch_fail.mp3",
    "catch_heartbeat.mp3",
    "catch_hit.mp3",
    "catch_ping.mp3",
    "catch_success.mp3",
    "catch_throw.mp3",
    "catch_thud.mp3",
    "catch_wobble.mp3",
    "combat_presenter.webp",
    "trainer_Ellen.webp"
];
const MUSIC_FILES = [
    "Liams_mattespel_Ingame_soft1.mp3",
    "Liams_mattespel_battle_Boss1_TR.mp3",
    "Liams_mattespel_battle_Boss2_Giovanni.mp3",
    "Liams_mattespel_battle_Ellen.mp3",
    "Liams_mattespel_ingame_soft2.mp3"
];

self.addEventListener('install', event => {
    // One missing file must not stop the rest from being cached
    event.waitUntil(caches.open(CORE_CACHE)
        .then(cache => Promise.allSettled(CORE_FILES.map(file => cache.add(file))))
        .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keep = [CORE_CACHE, MEDIA_CACHE];
        for (const key of await caches.keys()) {
            if (!keep.includes(key)) await caches.delete(key);
        }
        await self.clients.claim();
    })());
});

// The page asks for the long music tracks once it has been open a while
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'warm-media') {
        event.waitUntil((async () => {
            const cache = await caches.open(MEDIA_CACHE);
            for (const file of MUSIC_FILES) {
                const url = new URL(file, self.registration.scope).href;
                if (await cache.match(url)) continue;
                try {
                    const res = await fetch(url);
                    if (res.ok) await cache.put(url, res);
                } catch (e) { return; } // offline - try again next time
            }
        })());
    }
});

// Safari asks for audio in byte ranges; answer those from the full cached file
async function rangeResponse(request, response) {
    const buffer = await response.arrayBuffer();
    const size = buffer.byteLength;
    const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
    let start = 0, end = size - 1;
    if (match) {
        if (match[1] === '' && match[2] !== '') { start = Math.max(0, size - Number(match[2])); }
        else {
            start = Number(match[1] || 0);
            if (match[2] !== '') end = Math.min(Number(match[2]), size - 1);
        }
    }
    return new Response(buffer.slice(start, end + 1), {
        status: 206,
        statusText: 'Partial Content',
        headers: {
            'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes'
        }
    });
}

async function fromCacheOrNetwork(request, cacheName) {
    const url = request.url.split('#')[0];
    let response = await caches.match(url, { ignoreSearch: true });
    if (!response) {
        response = await fetch(url); // full file, never a partial one, so it can be cached
        if (response.ok && response.status === 200) {
            const cache = await caches.open(cacheName);
            await cache.put(url, response.clone());
        }
    }
    if (request.headers.has('range') && response.status === 200) return rangeResponse(request, response);
    return response;
}

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    // Google Fonts: keep a copy so the pixel font works offline
    if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
        event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(res => {
            const copy = res.clone();
            caches.open(MEDIA_CACHE).then(cache => cache.put(request, copy));
            return res;
        })));
        return;
    }
    if (url.origin !== self.location.origin) return;

    // The game itself: network first so updates arrive, cache when offline
    if (request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    const cache = await caches.open(CORE_CACHE);
                    await cache.put(new URL('index.html', self.registration.scope).href, response.clone());
                }
                return response;
            } catch (e) {
                return (await caches.match(new URL('index.html', self.registration.scope).href)) || Response.error();
            }
        })());
        return;
    }

    // Images, sounds, icons: cache first
    event.respondWith(fromCacheOrNetwork(request, MEDIA_CACHE).catch(() => caches.match(request).then(r => r || Response.error())));
});
