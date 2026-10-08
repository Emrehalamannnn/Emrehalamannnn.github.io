// Wordlands link pages (/r and /j). Everything happens in this browser: the score or invite sits
// after "#" in the address, which browsers never send to the server. No cookies, no analytics,
// no network requests.
//
// The rules are the app's own (ios/Wordlands/League/ResultLink.swift and Core/NameRule.swift):
// the same values, the same limits, and the same check: the first 4 hex characters of SHA-256 over
// the values joined with "|", then "|wordlands" (v|p|n|l|d|s|t|m|g for scores, v|g|gn|p|n for
// invites; a value left out counts as empty).
"use strict";

// OWNER: the App Store id of Wordlands (App Store Connect > App Information > Apple ID: 6820438663). Put it in
// once the app is live on the App Store (before that the app page doesn't open), and change the App Store button in
// /index.html the same way. Until then the App Store button goes to a search for Wordlands.
const APP_STORE_ID = "0000000000";
// OWNER: true once Wordlands for Android is public on Google Play (package app.wordlands). Then the page
// offers both stores (the visitor's own kind of phone first) and stops saying "iPhone-only". Also change
// the <noscript> line in r/index.html and j/index.html.
const PLAY_STORE_LIVE = false;
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.wordlands";

const VERSION = "1";
const EPOCH_UTC = Date.UTC(2026, 9, 1); // day 1 = 1 October 2026
const PLAYER_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const LEAGUE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// The puzzle languages, named as the app names them (PuzzleLanguage.title in SharedTypes.swift).
const LANGUAGES = {
  en: "English", es: "Español", pt: "Português (Brasil)", de: "Deutsch", fr: "Français", tr: "Türkçe",
  it: "Italiano", nl: "Nederlands", pl: "Polski", sv: "Svenska", ro: "Română", cs: "Čeština", da: "Dansk",
  nb: "Norsk (bokmål)", id: "Bahasa Indonesia", ms: "Bahasa Melayu", ru: "Русский", uk: "Українська", el: "Ελληνικά",
};
const MAX_LENGTH = 1024;
const FILLERS = new Set([0x3164, 0x115f, 0x1160, 0xffa0, 0x2800]);
const PERSON = { letters: 16, scalars: 64 };
const LEAGUE = { letters: 30, scalars: 120 };

/** This device's puzzle day: days since 1 October 2026 on the local calendar, day 1 first. */
function today(now = new Date()) {
  const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((local - EPOCH_UTC) / 86400000) + 1;
}

/** The decoded values after "#", or null when a value is badly encoded or a key appears twice. */
function values(fragment) {
  const result = new Map();
  for (const pair of fragment.split("&").filter((p) => p.length > 0)) {
    const at = pair.indexOf("=");
    if (at < 0) return null;
    const key = pair.slice(0, at);
    let value;
    try {
      value = decodeURIComponent(pair.slice(at + 1));
    } catch {
      return null;
    }
    if (result.has(key)) return null;
    result.set(key, value);
  }
  return result;
}

/** 1 to 4 plain digits within [low, high], without leading zeros. */
function number(raw, low, high) {
  if (typeof raw !== "string" || !/^[0-9]{1,4}$/.test(raw) || (raw.length > 1 && raw[0] === "0")) return null;
  const value = Number(raw);
  return value >= low && value <= high ? value : null;
}

/** "-" (not played) gives { value: null }; a number in range gives { value }; anything else null. */
function optionalNumber(raw, low, high) {
  if (raw === "-") return { value: null };
  const value = number(raw, low, high);
  return value === null ? null : { value };
}

function fromAlphabet(raw, alphabet, length) {
  return typeof raw === "string" && raw.length === length && [...raw].every((c) => alphabet.includes(c)) ? raw : null;
}

const BLACK_FLAG = 0x1f3f4; // starts an emoji tag sequence: the flags of England, Scotland and Wales
const CANCEL_TAG = 0xe007f; // ends it
const isTag = (code) => code >= 0xe0020 && code <= CANCEL_TAG;
const isTagLetter = (code) => code >= 0xe0020 && code < CANCEL_TAG;
const isMark = (c) => /\p{M}/u.test(c);
const isLetterOrEmoji = (c) => /\p{Alphabetic}/u.test(c) || (/\p{Emoji}/u.test(c) && c.codePointAt(0) > 0x7f);
const isVisible = (c) => !FILLERS.has(c.codePointAt(0)) && !/[\p{M}\p{Cc}\p{Cf}\p{Z}\s\u200c\u200d]/u.test(c);

/** `NameRule.flagTags`: the places of the tags that belong to a whole flag (the black flag, one or
 * more tag letters, then the cancel tag). */
function flagTags(points) {
  const places = new Set();
  points.forEach((c, index) => {
    if (c.codePointAt(0) !== BLACK_FLAG) return;
    let end = index + 1;
    while (end < points.length && isTagLetter(points[end].codePointAt(0))) end += 1;
    if (end > index + 1 && end < points.length && points[end].codePointAt(0) === CANCEL_TAG) {
      for (let place = index + 1; place <= end; place += 1) places.add(place);
    }
  });
  return places;
}

/** `NameRule.removingInvisible`: control and format characters and fillers go; a joiner or non-joiner
 * stays only between letters or emoji (looking past accents and skin tones), and tags only in a whole
 * flag. */
function removingInvisible(text) {
  const points = [...text];
  const wholeFlags = flagTags(points);
  const kept = [];
  points.forEach((c, index) => {
    const code = c.codePointAt(0);
    if (code === 0x200c || code === 0x200d) {
      const before = [...kept].reverse().find((k) => !isMark(k) && !/\p{Emoji_Modifier}/u.test(k));
      const after = points[index + 1];
      if (before && after && isLetterOrEmoji(before) && isLetterOrEmoji(after)) kept.push(c);
      return;
    }
    if (isTag(code)) {
      if (wholeFlags.has(index)) kept.push(c);
      return;
    }
    if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/u.test(c) || FILLERS.has(code)) return;
    kept.push(c);
  });
  return kept.join("");
}

/** The app's name rule: what `NameRule.clean` makes of a name, or null when nothing visible is left. */
function cleanName(raw, rule) {
  const text = removingInvisible(raw).normalize("NFC").trim();
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((s) => s.segment);
  let result = "";
  let count = 0;
  let size = 0;
  for (const grapheme of graphemes) {
    let marks = 0;
    const limited = [...grapheme].filter((c) => !isMark(c) || ++marks <= 3);
    if (count >= rule.letters || size + limited.length > rule.scalars) break;
    result += limited.join("");
    count += 1;
    size += limited.length;
  }
  // The cut may end right after a joiner whose next letter didn't fit: it goes too (as in the app).
  result = removingInvisible(result).normalize("NFC").trim();
  return [...result].some(isVisible) ? result : null;
}

/** A name as a link must carry it: already clean and within the rule. */
function sentName(raw, rule) {
  return typeof raw === "string" && cleanName(raw, rule) === raw ? raw : null;
}

async function check(parts) {
  const bytes = new TextEncoder().encode([...parts, "wordlands"].join("|"));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...hash.slice(0, 2)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A score link's data: { kind: "r", entry, league } or null (broken, edited, or not ours). */
async function readScore(map, day = today()) {
  const player = fromAlphabet(map.get("p"), PLAYER_ALPHABET, 8);
  const name = sentName(map.get("n"), PERSON);
  const lang = Object.hasOwn(LANGUAGES, map.get("l") ?? "") ? map.get("l") : null;
  const puzzleDay = number(map.get("d"), 1, Math.max(1, day + 1));
  const scores = (map.get("s") ?? "").split(",");
  const tries = optionalNumber(map.get("t"), 1, 6);
  if (!player || !name || !lang || puzzleDay === null || scores.length !== 3 || !tries) return null;
  const parsed = scores.map((s) => optionalNumber(s, 0, 100));
  if (parsed.some((p) => p === null)) return null;
  const [scramble, ladder, hunch] = parsed.map((p) => p.value);
  if ((tries.value !== null && hunch === null) || [scramble, ladder, hunch].every((v) => v === null)) return null;
  let minute = null;
  if (map.has("m") && map.get("m") !== "") {
    minute = number(map.get("m"), 0, 1439);
    if (minute === null) return null;
  }
  let league = null;
  if (map.has("g") && map.get("g") !== "") {
    league = fromAlphabet(map.get("g"), LEAGUE_ALPHABET, 6);
    if (!league) return null;
  }
  const s = [scramble, ladder, hunch].map((v) => (v === null ? "-" : String(v))).join(",");
  const parts = [VERSION, player, name, lang, String(puzzleDay), s, tries.value === null ? "-" : String(tries.value),
    minute === null ? "" : String(minute), league ?? ""];
  if ((await check(parts)) !== (map.get("c") ?? "").toLowerCase()) return null;
  return { kind: "r", entry: { player, name, lang, day: puzzleDay, scramble, ladder, hunch, tries: tries.value, minute }, league };
}

/** A join link's data: { kind: "j", invite } or null. */
async function readInvite(map) {
  const league = fromAlphabet(map.get("g"), LEAGUE_ALPHABET, 6);
  const leagueName = sentName(map.get("gn"), LEAGUE);
  const inviter = fromAlphabet(map.get("p"), PLAYER_ALPHABET, 8);
  const inviterName = sentName(map.get("n"), PERSON);
  if (!league || !leagueName || !inviter || !inviterName) return null;
  const parts = [VERSION, league, leagueName, inviter, inviterName];
  if ((await check(parts)) !== (map.get("c") ?? "").toLowerCase()) return null;
  return { kind: "j", invite: { league, leagueName, inviter, inviterName } };
}

/** Reads the data after "#" for a page of `kind` ("r" or "j"). */
async function read(kind, fragment, day = today()) {
  const text = fragment.replace(/^#/, "").replace(/[.,;:!?]+$/, "");
  if (text.length === 0 || text.length > MAX_LENGTH) return null;
  const map = values(text);
  if (!map || map.get("v") !== VERSION || !map.has("c")) return null;
  return kind === "r" ? readScore(map, day) : readInvite(map);
}

// MARK: The page

const WORDS = {
  en: { day: "Day", join: "Join {league}", invited: "{name} invited you", open: "Open in Wordlands", store: "Get Wordlands on the App Store",
    play: "Get Wordlands on Google Play",
    iphone: "Wordlands is iPhone-only for now.", paste: "Have the app? Copy the whole message and tap Leagues > Paste.",
    broken: "This link looks broken or edited", brokenHelp: "Ask for the score or invite again, and copy the whole message.",
    privacy: "This page reads the link on your device. Nothing is sent anywhere.", total: "Total" },
  es: { day: "Día", join: "Únete a {league}", invited: "{name} te ha invitado", open: "Abrir en Wordlands", store: "Consigue Wordlands en el App Store",
    play: "Consigue Wordlands en Google Play",
    iphone: "Por ahora Wordlands solo está para iPhone.", paste: "¿Tienes la app? Copia el mensaje entero y toca Ligas > Pegar.",
    broken: "Este enlace parece roto o editado", brokenHelp: "Pide la puntuación o la invitación otra vez y copia el mensaje entero.",
    privacy: "Esta página lee el enlace en tu dispositivo. No se envía nada a ningún sitio.", total: "Total" },
  pt: { day: "Dia", join: "Entre em {league}", invited: "{name} convidou você", open: "Abrir no Wordlands", store: "Baixe o Wordlands na App Store",
    play: "Baixe o Wordlands no Google Play",
    iphone: "Por enquanto o Wordlands é só para iPhone.", paste: "Tem o app? Copie a mensagem inteira e toque em Ligas > Colar.",
    broken: "Este link parece quebrado ou editado", brokenHelp: "Peça a pontuação ou o convite de novo e copie a mensagem inteira.",
    privacy: "Esta página lê o link no seu aparelho. Nada é enviado.", total: "Total" },
  de: { day: "Tag", join: "{league} beitreten", invited: "{name} hat dich eingeladen", open: "In Wordlands öffnen", store: "Wordlands im App Store laden",
    play: "Wordlands bei Google Play laden",
    iphone: "Wordlands gibt es vorerst nur für das iPhone.", paste: "Du hast die App? Kopiere die ganze Nachricht und tippe auf Ligen > Einsetzen.",
    broken: "Dieser Link sieht kaputt oder verändert aus", brokenHelp: "Lass dir das Ergebnis oder die Einladung noch einmal schicken und kopiere die ganze Nachricht.",
    privacy: "Diese Seite liest den Link auf deinem Gerät. Nichts wird verschickt.", total: "Gesamt" },
  fr: { day: "Jour", join: "Rejoindre {league}", invited: "{name} vous invite", open: "Ouvrir dans Wordlands", store: "Télécharger Wordlands sur l'App Store",
    play: "Télécharger Wordlands sur Google Play",
    iphone: "Pour l'instant, Wordlands n'existe que sur iPhone.", paste: "Vous avez l'app ? Copiez tout le message, puis touchez Ligues > Coller.",
    broken: "Ce lien semble cassé ou modifié", brokenHelp: "Demandez à nouveau le score ou l'invitation, et copiez tout le message.",
    privacy: "Cette page lit le lien sur votre appareil. Rien n'est envoyé.", total: "Total" },
  tr: { day: "Gün", join: "Katıl: {league}", invited: "{name} seni davet etti", open: "Wordlands'te aç", store: "Wordlands'i App Store'dan indir",
    play: "Wordlands'i Google Play'den indir",
    iphone: "Wordlands şimdilik yalnızca iPhone'da var.", paste: "Uygulama sende var mı? Mesajın tamamını kopyala, sonra Ligler > Yapıştır'a dokun.",
    broken: "Bu bağlantı bozuk ya da değiştirilmiş görünüyor", brokenHelp: "Skoru ya da daveti yeniden iste ve mesajın tamamını kopyala.",
    privacy: "Bu sayfa bağlantıyı senin cihazında okur. Hiçbir şey gönderilmez.", total: "Toplam" },
};

function words() {
  const code = (navigator.language || "en").slice(0, 2).toLowerCase();
  return { code: WORDS[code] ? code : "en", text: WORDS[WORDS[code] ? code : "en"] };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(className, href, text) {
  const node = element("a", className, text);
  node.href = href;
  return node;
}

async function render(kind) {
  const { code, text } = words();
  document.documentElement.lang = code;
  const main = document.getElementById("card");
  const fragment = location.hash.replace(/^#/, "");
  const result = await read(kind, fragment);
  main.replaceChildren();
  if (!result) {
    main.append(element("h1", "broken", text.broken), element("p", "muted", text.brokenHelp));
  } else if (result.kind === "r") {
    const e = result.entry;
    const total = (e.scramble ?? 0) + (e.ladder ?? 0) + (e.hunch ?? 0);
    const line = [e.name, LANGUAGES[e.lang], `${text.day} ${e.day}`, `${total}/300`].join(" · ");
    main.append(element("p", "eyebrow", "Wordlands"), element("h1", "", line));
  } else {
    const i = result.invite;
    main.append(element("p", "eyebrow", "Wordlands"), element("h1", "", text.join.replace("{league}", i.leagueName)),
      element("p", "muted", text.invited.replace("{name}", i.inviterName)));
  }
  if (result) {
    main.append(link("button primary", `wordlands://${kind}?${fragment}`, text.open));
  }
  const appStore = link("button", APP_STORE_ID === "0000000000"
    ? "https://apps.apple.com/search?term=Wordlands"
    : `https://apps.apple.com/app/id${APP_STORE_ID}`, text.store);
  if (PLAY_STORE_LIVE) {
    // Both stores, the visitor's own kind of phone first (read here only, never sent anywhere).
    const playStore = link("button", PLAY_STORE_URL, text.play);
    const android = /Android/i.test(navigator.userAgent || "");
    main.append(...(android ? [playStore, appStore] : [appStore, playStore]));
  } else {
    main.append(appStore, element("p", "note", text.iphone));
  }
  main.append(element("p", "note", text.paste), element("p", "fine", text.privacy));
}

if (typeof module !== "undefined") {
  module.exports = { read, cleanName, today, values, check, PERSON, LEAGUE, LANGUAGES };
} else {
  const kind = document.body.dataset.kind;
  render(kind);
  window.addEventListener("hashchange", () => render(kind));
}
