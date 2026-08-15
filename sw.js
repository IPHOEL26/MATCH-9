"use strict";

const CACHE_NAME = "match9-shell-v7.0.1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=7.0.1",
  "./config.js?v=7.0.1",
  "./script.js?v=7.0.1",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];
const OPTIONAL_ASSETS = [
  "./assets/context/bangun-ruang.webp",
  "./assets/context/peluang.webp",
  "./assets/context/spldv-pasar.webp",
  "./assets/context/transformasi.webp"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () {
        return caches.open(CACHE_NAME).then(function (cache) {
          return Promise.all(OPTIONAL_ASSETS.map(function (url) {
            return cache.add(url).catch(function () { return null; });
          }));
        });
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put("./index.html", copy); });
          return response;
        })
        .catch(function () { return caches.match("./index.html"); })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      const refreshed = fetch(event.request).then(function (response) {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function () { return cached || Response.error(); });
      return cached || refreshed;
    })
  );
});
