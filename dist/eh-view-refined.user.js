// ==UserScript==
// @name               Eh View Refined
// @name:zh-TW         Eh View Refined
// @name:zh-CN         Eh View Refined
// @name:ja            Eh View Refined
// @name:ko            Eh View Refined
// @namespace          https://github.com/Tsuyumi25
// @version            0.1.1
// @author             tsuyumi
// @description        Get complete gallery tags in Extended mode and simulate other native layouts.
// @description:zh-TW  以 Extended 模式取得完整圖庫標籤，並模擬成其他原生的排版。
// @description:zh-CN  以 Extended 模式获取完整图库标签，并模拟成其他原生的排版。
// @description:ja     Extended モードでギャラリーの全タグを取得し、他の標準レイアウトを再現。
// @description:ko     Extended 모드로 전체 갤러리 태그를 가져오고 다른 기본 레이아웃을 재현합니다.
// @license            MIT
// @icon               https://e-hentai.org/favicon.ico
// @homepageURL        https://github.com/Tsuyumi25/EhViewRefined
// @supportURL         https://github.com/Tsuyumi25/EhViewRefined/issues
// @downloadURL        https://raw.githubusercontent.com/Tsuyumi25/EhViewRefined/release/dist/eh-view-refined.user.js
// @updateURL          https://raw.githubusercontent.com/Tsuyumi25/EhViewRefined/release/dist/eh-view-refined.meta.js
// @match              https://e-hentai.org/*
// @match              https://exhentai.org/*
// @grant              GM_addValueChangeListener
// @grant              GM_getValue
// @grant              GM_registerMenuCommand
// @grant              GM_removeValueChangeListener
// @grant              GM_setValue
// @grant              GM_unregisterMenuCommand
// @run-at             document-start
// ==/UserScript==

(function() {
	"use strict";
	var PRESENCE_ATTRIBUTE = "data-evr-version";
	function announcePresence(doc, version) {
		if (doc.documentElement) {
			doc.documentElement.setAttribute(PRESENCE_ATTRIBUTE, version);
			return;
		}
		const observer = new MutationObserver(() => {
			if (!doc.documentElement) return;
			observer.disconnect();
			doc.documentElement.setAttribute(PRESENCE_ATTRIBUTE, version);
		});
		observer.observe(doc, { childList: true });
	}
	var PLAIN_TAG_MARK = "data-evr-tag-plain";
	var uncoloured = {
		"": true,
		none: true,
		transparent: true,
		currentcolor: true,
		inherit: true,
		initial: true,
		unset: true,
		revert: true,
		"revert-layer": true,
		auto: true
	};
	function alphaOf(value) {
		const body = /^[a-z]+\(([^()]*)\)$/.exec(value)?.[1];
		if (body === void 0) return null;
		const slash = body.lastIndexOf("/");
		const parts = body.split(",");
		const raw = slash >= 0 ? body.slice(slash + 1) : parts.length === 4 ? parts[3] : null;
		if (raw === null) return null;
		const text = raw.trim();
		const percent = text.endsWith("%");
		const alpha = Number.parseFloat(percent ? text.slice(0, -1) : text);
		return Number.isNaN(alpha) ? null : percent ? alpha / 100 : alpha;
	}
	function isColourValue(value) {
		const normalised = value.trim().toLowerCase();
		if (uncoloured[normalised]) return false;
		return alphaOf(normalised) !== 0;
	}
	function isHighlighted(paint) {
		return isColourValue(paint.color) || isColourValue(paint.backgroundColor) || isColourValue(paint.backgroundImage);
	}
	var sourceSelector = "table.itg.glte";
	var GALLERY_PATH = /\/g\/(\d+)\/[^/?#]+/;
	var GALLERY_KEY = /\/g\/(\d+)\/([^/?#]+)/;
	var CATEGORY_TONE = /^ct[0-9a-f]+$/;
	var TAG_DATA = "data-evr-tags";
	var UPLOADER_DATA = "data-evr-uploader";
	var UPLOADER_PATH = /\/uploader\/([^/?#]+)/;
	var RATING_DATA = "data-evr-rating";
	var MY_RATING_DATA = "data-evr-my-rating";
	var MY_RATING_MARKS = [
		"irr",
		"irg",
		"irb"
	];
	var sectionTags$1 = {
		TBODY: true,
		THEAD: true,
		TFOOT: true
	};
	var TAG_NAME = "data-evr-tag";
	var TAG_NAMESPACE = "data-evr-ns";
	var UPLOADER_TAG_CLASS = "evr-uploader-tag";
	var TAG_SELECTOR$1 = `:is(.gt, .gtl, .gtw):not(.${UPLOADER_TAG_CLASS})`;
	function outerRows(table) {
		const rows = [];
		for (const child of table.children) if (child.tagName === "TR") rows.push(child);
		else if (sectionTags$1[child.tagName]) {
			for (const row of child.children) if (row.tagName === "TR") rows.push(row);
		}
		return rows;
	}
	function galleryKey(row) {
		const link = row.querySelector("a[href*=\"/g/\"]");
		const match = GALLERY_KEY.exec(link?.getAttribute("href") ?? "");
		return match ? `${match[1]}/${match[2]}` : null;
	}
	function tagMetadata(tags) {
		return JSON.stringify(Array.from(tags, (tag) => ({
			name: tag.title,
			tier: tag.classList.contains("gtw") ? "gtw" : tag.classList.contains("gtl") ? "gtl" : "gt"
		})));
	}
	function namespaceOf(tag) {
		const colon = tag.title.indexOf(":");
		if (colon > 0) return tag.title.slice(0, colon).trim().toLowerCase();
		return tag.closest("tr")?.querySelector(":scope > td.tc")?.textContent?.trim().toLowerCase().replace(/:$/, "") || null;
	}
	function captureGalleryTags(row) {
		const cached = row.getAttribute(TAG_DATA);
		if (cached !== null) return cached;
		const tags = row.querySelectorAll(`.gl4e ${TAG_SELECTOR$1}`);
		for (const tag of tags) {
			if (tag.title) tag.setAttribute(TAG_NAME, tag.title);
			const namespace = namespaceOf(tag);
			if (namespace) tag.setAttribute(TAG_NAMESPACE, namespace);
			if (!isHighlighted(tag.style)) tag.setAttribute(PLAIN_TAG_MARK, "");
		}
		const data = tagMetadata(tags);
		row.setAttribute(TAG_DATA, data);
		return data;
	}
	function captureGalleryUploader(row) {
		const cached = row.getAttribute(UPLOADER_DATA);
		if (cached !== null) return cached;
		const encoded = UPLOADER_PATH.exec(row.querySelector(".gl3e a[href*=\"/uploader/\"]")?.getAttribute("href") ?? "")?.[1];
		if (!encoded) return null;
		let name;
		try {
			name = decodeURIComponent(encoded.replace(/\+/g, " "));
		} catch {
			return null;
		}
		row.setAttribute(UPLOADER_DATA, name);
		return name;
	}
	function starsOf(stars) {
		const [x, y] = Array.from((stars.getAttribute("style") ?? "").matchAll(/(-?\d+)px/g), (match) => Math.abs(Number(match[1])));
		if (x === void 0 || y === void 0) return null;
		const value = 5 - x / 16 - (y === 21 ? .5 : 0);
		return value >= 0 && value <= 5 ? value : null;
	}
	function captureGalleryRating(row) {
		const cachedRating = row.getAttribute(RATING_DATA);
		const cachedMine = row.getAttribute(MY_RATING_DATA);
		if (cachedRating !== null || cachedMine !== null) return {
			rating: cachedRating === null ? null : Number(cachedRating),
			myRating: cachedMine === null ? null : Number(cachedMine)
		};
		const stars = row.querySelector(".gl3e .ir");
		const value = stars ? starsOf(stars) : null;
		if (value === null) return {
			rating: null,
			myRating: null
		};
		const mine = MY_RATING_MARKS.some((mark) => stars.classList.contains(mark));
		row.setAttribute(mine ? MY_RATING_DATA : RATING_DATA, String(value));
		return mine ? {
			rating: null,
			myRating: value
		} : {
			rating: value,
			myRating: null
		};
	}
	function childByClass(parent, name) {
		if (!parent) return null;
		for (const child of parent.children) if (child.classList.contains(name)) return child;
		return null;
	}
	function galleryHref(scope) {
		if (!scope) return "";
		for (const link of scope.querySelectorAll("a[href]")) {
			const href = link.getAttribute("href") ?? "";
			if (GALLERY_PATH.test(href)) return href;
		}
		return "";
	}
	function pixels(el, property) {
		if (!el) return 0;
		for (const declaration of (el.getAttribute("style") ?? "").split(";")) {
			const colon = declaration.indexOf(":");
			if (colon < 0) continue;
			if (declaration.slice(0, colon).trim() !== property) continue;
			return Math.round(Number.parseFloat(declaration.slice(colon + 1)) || 0);
		}
		return 0;
	}
	function adaptExtendedGallery(row) {
		const coverCell = childByClass(row, "gl1e");
		const body = childByClass(row, "gl2e");
		if (!body) return null;
		const name = body.querySelector(".gl4e");
		const title = name?.querySelector(".glink");
		const href = galleryHref(body) || galleryHref(coverCell);
		const gid = GALLERY_PATH.exec(href)?.[1] ?? "";
		if (!gid || !name || !title) return null;
		const meta = body.querySelector(".gl3e");
		const slots = meta ? Array.from(meta.children) : [];
		const category = slots.find((slot) => [
			"cn",
			"cs",
			"cw"
		].some((mark) => slot.classList.contains(mark))) ?? null;
		const posted = slots.find((slot) => slot.id.startsWith("posted_")) ?? null;
		const rating = slots.find((slot) => slot.classList.contains("ir")) ?? null;
		const download = slots.find((slot) => slot.classList.contains("gldown")) ?? null;
		const named = [
			category,
			posted,
			rating,
			download
		];
		const downloadAt = download ? slots.indexOf(download) : slots.length;
		const rest = slots.filter((slot) => !named.includes(slot));
		const before = rest.filter((slot) => slots.indexOf(slot) < downloadAt);
		const uploader = before.find((slot) => slot.querySelector("a[href*=\"/uploader/\"]")) ?? before[0] ?? null;
		const pages = before.find((slot) => slot !== uploader) ?? null;
		let selection = childByClass(row, "glfe");
		if (!selection) for (const cell of row.children) {
			if (cell === coverCell || cell === body) continue;
			if (cell.querySelector("input")) selection = cell;
		}
		const frame = coverCell?.querySelector("div") ?? null;
		const cover = coverCell?.querySelector("img") ?? null;
		const tags = Array.from(name.querySelectorAll(TAG_SELECTOR$1));
		const tagData = captureGalleryTags(row);
		const uploaderName = captureGalleryUploader(row);
		const { rating: averageRating, myRating } = captureGalleryRating(row);
		const bindings = {
			cover,
			category,
			posted,
			rating,
			uploader,
			pages,
			download,
			favorited: rest.find((slot) => slots.indexOf(slot) > downloadAt) ?? null,
			note: row.querySelector(".glfnote"),
			selection,
			title,
			tags
		};
		return {
			snapshot: {
				gid,
				href,
				fresh: row.getAttribute("data-new"),
				categoryTone: category ? Array.from(category.classList).find((mark) => CATEGORY_TONE.test(mark)) ?? null : null,
				cover: cover ? {
					width: cover.naturalWidth || pixels(cover, "width") || Number(cover.getAttribute("width")),
					height: cover.naturalHeight || pixels(cover, "height") || Number(cover.getAttribute("height")),
					sourceHeight: pixels(cover, "height"),
					deferredSource: cover.getAttribute("data-src")
				} : null,
				frameHeight: pixels(frame, "height"),
				frameStyle: frame?.getAttribute("style") ?? null,
				tags: tags.map((tag) => ({
					text: tag.getAttribute("ehs-tag") ?? tag.textContent,
					styled: (tag.getAttribute("style") ?? "") !== "",
					namespace: tag.getAttribute(TAG_NAMESPACE)
				})),
				tagData,
				uploader: uploaderName,
				rating: averageRating,
				myRating,
				previousGid: GALLERY_PATH.exec(galleryHref(row.previousElementSibling))?.[1] ?? "0",
				nextGid: GALLERY_PATH.exec(galleryHref(row.nextElementSibling))?.[1] ?? "0"
			},
			bindings
		};
	}
	var _GM_addValueChangeListener = (() => typeof GM_addValueChangeListener != "undefined" ? GM_addValueChangeListener : void 0)();
	var _GM_getValue = (() => typeof GM_getValue != "undefined" ? GM_getValue : void 0)();
	var _GM_registerMenuCommand = (() => typeof GM_registerMenuCommand != "undefined" ? GM_registerMenuCommand : void 0)();
	var _GM_removeValueChangeListener = (() => typeof GM_removeValueChangeListener != "undefined" ? GM_removeValueChangeListener : void 0)();
	var _GM_setValue = (() => typeof GM_setValue != "undefined" ? GM_setValue : void 0)();
	var _GM_unregisterMenuCommand = (() => typeof GM_unregisterMenuCommand != "undefined" ? GM_unregisterMenuCommand : void 0)();
	var locales = [
		"zh-TW",
		"zh-CN",
		"en",
		"ja",
		"ko"
	];
	function isLocale(value) {
		return locales.includes(value);
	}
	function isLocaleChoice(value) {
		return value === "auto" || isLocale(value);
	}
	function resolveLocale(choice, languages) {
		return choice === "auto" ? detectLocale(languages) : choice;
	}
	function detectLocale(languages) {
		for (const language of languages) {
			const parts = language.toLowerCase().split("-");
			const primary = parts[0];
			if (primary === "zh") {
				if (parts.includes("hans")) return "zh-CN";
				if (parts.includes("hant")) return "zh-TW";
				if (parts.some((part) => [
					"tw",
					"hk",
					"mo"
				].includes(part))) return "zh-TW";
				return "zh-CN";
			}
			if (primary === "en") return "en";
			if (primary === "ja") return "ja";
			if (primary === "ko") return "ko";
		}
		return "en";
	}
	function createSetting(key, parse) {
		const listeners = new Set();
		let current = null;
		let listenerId;
		function stored() {
			return parse(_GM_getValue(key, null));
		}
		function update(value) {
			if (value === current) return;
			current = value;
			for (const listener of [...listeners]) listener(value);
		}
		function get() {
			return current ??= stored();
		}
		function set(value) {
			if (get() === value) return;
			_GM_setValue(key, String(value));
			update(value);
		}
		function subscribe(listener) {
			get();
			listeners.add(listener);
			if (listenerId === void 0) {
				listenerId = _GM_addValueChangeListener(key, (_key, _old, value) => {
					update(parse(value));
				});
				update(stored());
			}
			return () => {
				if (!listeners.delete(listener)) return;
				if (listeners.size === 0 && listenerId !== void 0) {
					_GM_removeValueChangeListener(listenerId);
					listenerId = void 0;
				}
			};
		}
		return {
			get,
			set,
			subscribe
		};
	}
	function createBooleanSetting(key, defaultValue) {
		return createSetting(key, (raw) => raw === "true" ? true : raw === "false" ? false : defaultValue);
	}
	var { get: getAllMyTags, set: setAllMyTags, subscribe: subscribeAllMyTags } = createBooleanSetting("ehe:all-my-tags", true);
	var { get: getAllOtherTags, set: setAllOtherTags, subscribe: subscribeAllOtherTags } = createBooleanSetting("ehe:all-other-tags", true);
	var { get: getGroupTags, set: setGroupTags, subscribe: subscribeGroupTags } = createBooleanSetting("ehe:group-tags", false);
	var { get: getUploaderTag, set: setUploaderTag, subscribe: subscribeUploaderTag } = createBooleanSetting("ehe:uploader-tag", true);
	var { get: getInfiniteScroll, set: setInfiniteScroll, subscribe: subscribeInfiniteScroll } = createBooleanSetting("ehe:infinite-scroll", true);
	var { get: getLocaleChoice, set: setLocaleChoice, subscribe: subscribeLocaleChoice } = createSetting("ehe:locale", (raw) => isLocaleChoice(raw) ? raw : "auto");
	var PARKED_CLASS = "evr-parked";
	function createItemStrip() {
		const nodes = [];
		let start = 0;
		let end = 0;
		return {
			get count() {
				return nodes.length;
			},
			get start() {
				return start;
			},
			get end() {
				return end;
			},
			nodeAt(index) {
				return index >= start && index < end ? nodes[index] : void 0;
			},
			push(node) {
				if (end === nodes.length) {
					end++;
					node.classList.remove(PARKED_CLASS);
				} else node.classList.add(PARKED_CLASS);
				nodes.push(node);
			},
			setRange(nextStart, nextEnd) {
				const lower = Math.max(0, Math.min(nextStart, nodes.length));
				const upper = Math.max(lower, Math.min(nextEnd, nodes.length));
				for (let index = start; index < end; index++) if (index < lower || index >= upper) nodes[index].classList.add(PARKED_CLASS);
				for (let index = lower; index < upper; index++) if (index < start || index >= end) nodes[index].classList.remove(PARKED_CLASS);
				start = lower;
				end = upper;
			}
		};
	}
	function makeMap(str) {
		const map = Object.create(null);
		for (const key of str.split(",")) map[key] = 1;
		return (val) => val in map;
	}
	var EMPTY_OBJ = {};
	var EMPTY_ARR = [];
	var NOOP = () => {};
	var NO = () => false;
	var isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
	var isModelListener = (key) => key.startsWith("onUpdate:");
	var extend = Object.assign;
	var remove = (arr, el) => {
		const i = arr.indexOf(el);
		if (i > -1) arr.splice(i, 1);
	};
	var hasOwnProperty$1 = Object.prototype.hasOwnProperty;
	var hasOwn = (val, key) => hasOwnProperty$1.call(val, key);
	var isArray = Array.isArray;
	var isMap = (val) => toTypeString(val) === "[object Map]";
	var isSet = (val) => toTypeString(val) === "[object Set]";
	var isDate = (val) => toTypeString(val) === "[object Date]";
	var isFunction = (val) => typeof val === "function";
	var isString = (val) => typeof val === "string";
	var isSymbol = (val) => typeof val === "symbol";
	var isObject = (val) => val !== null && typeof val === "object";
	var isPromise = (val) => {
		return (isObject(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
	};
	var objectToString = Object.prototype.toString;
	var toTypeString = (value) => objectToString.call(value);
	var toRawType = (value) => {
		return toTypeString(value).slice(8, -1);
	};
	var isPlainObject = (val) => toTypeString(val) === "[object Object]";
	var isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
	var isReservedProp = makeMap(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted");
	var cacheStringFunction = (fn) => {
		const cache = Object.create(null);
		return ((str) => {
			return cache[str] || (cache[str] = fn(str));
		});
	};
	var camelizeRE = /-\w/g;
	var camelize = cacheStringFunction((str) => {
		return str.replace(camelizeRE, (c) => c.slice(1).toUpperCase());
	});
	var hyphenateRE = /\B([A-Z])/g;
	var hyphenate = cacheStringFunction((str) => str.replace(hyphenateRE, "-$1").toLowerCase());
	var capitalize = cacheStringFunction((str) => {
		return str.charAt(0).toUpperCase() + str.slice(1);
	});
	var toHandlerKey = cacheStringFunction((str) => {
		return str ? `on${capitalize(str)}` : ``;
	});
	var hasChanged = (value, oldValue) => !Object.is(value, oldValue);
	var invokeArrayFns = (fns, ...arg) => {
		for (let i = 0; i < fns.length; i++) fns[i](...arg);
	};
	var def = (obj, key, value, writable = false) => {
		Object.defineProperty(obj, key, {
			configurable: true,
			enumerable: false,
			writable,
			value
		});
	};
	var looseToNumber = (val) => {
		const n = parseFloat(val);
		return isNaN(n) ? val : n;
	};
	var _globalThis;
	var getGlobalThis = () => {
		return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
	};
	function normalizeStyle(value) {
		if (isArray(value)) {
			const res = {};
			for (let i = 0; i < value.length; i++) {
				const item = value[i];
				const normalized = isString(item) ? parseStringStyle(item) : normalizeStyle(item);
				if (normalized) for (const key in normalized) res[key] = normalized[key];
			}
			return res;
		} else if (isString(value) || isObject(value)) return value;
	}
	var listDelimiterRE = /;(?![^(]*\))/g;
	var propertyDelimiterRE = /:([^]+)/;
	var styleCommentRE = /"(?:[^"\\]|\\[^])*"|'(?:[^'\\]|\\[^])*'|\\[^]|\/\*[^]*?\*\//g;
	function parseStringStyle(cssText) {
		const ret = {};
		cssText.replace(styleCommentRE, (match) => match.startsWith("/*") ? "" : match).split(listDelimiterRE).forEach((item) => {
			if (item) {
				const tmp = item.split(propertyDelimiterRE);
				tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
			}
		});
		return ret;
	}
	function normalizeClass(value) {
		let res = "";
		if (isString(value)) res = value;
		else if (isArray(value)) for (let i = 0; i < value.length; i++) {
			const normalized = normalizeClass(value[i]);
			if (normalized) res += normalized + " ";
		}
		else if (isObject(value)) {
			for (const name in value) if (value[name]) res += name + " ";
		}
		return res.trim();
	}
	var specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
	var isSpecialBooleanAttr = makeMap(specialBooleanAttrs);
	specialBooleanAttrs + "";
	function includeBooleanAttr(value) {
		return !!value || value === "";
	}
	function looseCompareArrays(a, b, seen) {
		if (a.length !== b.length) return false;
		let equal = true;
		for (let i = 0; equal && i < a.length; i++) equal = looseEqual(a[i], b[i], seen);
		return equal;
	}
	function looseCompareCollections(a, b, seen) {
		if (a.size !== b.size) return false;
		const candidates = Array.from(b);
		const matched = new Uint8Array(candidates.length);
		for (const item of a) {
			let index = -1;
			for (let i = 0; i < candidates.length; i++) if (!matched[i] && looseEqual(item, candidates[i], seen)) {
				index = i;
				break;
			}
			if (index < 0) return false;
			matched[index] = 1;
		}
		return true;
	}
	function looseCompareObjects(a, b, seen) {
		let aValidType = isMap(a);
		let bValidType = isMap(b);
		if (aValidType || bValidType) return aValidType && bValidType ? looseCompareCollections(a, b, seen) : false;
		aValidType = isSet(a);
		bValidType = isSet(b);
		if (aValidType || bValidType) return aValidType && bValidType ? looseCompareCollections(a, b, seen) : false;
		if (Object.keys(a).length !== Object.keys(b).length) return false;
		for (const key in a) {
			const aHasKey = a.hasOwnProperty(key);
			const bHasKey = b.hasOwnProperty(key);
			if (aHasKey && !bHasKey || !aHasKey && bHasKey || !looseEqual(a[key], b[key], seen)) return false;
		}
		return String(a) === String(b);
	}
	function looseCompareNested(a, b, seen, compare) {
		if (!seen) seen = [new Map(), new Map()];
		const [seenA, seenB] = seen;
		if (seenA.has(a) || seenB.has(b)) return seenA.get(a) === b && seenB.get(b) === a;
		seenA.set(a, b);
		seenB.set(b, a);
		const equal = compare(a, b, seen);
		seenA.delete(a);
		seenB.delete(b);
		return equal;
	}
	function looseEqual(a, b, seen) {
		if (a === b) return true;
		let aValidType = isDate(a);
		let bValidType = isDate(b);
		if (aValidType || bValidType) return aValidType && bValidType ? a.getTime() === b.getTime() : false;
		aValidType = isSymbol(a);
		bValidType = isSymbol(b);
		if (aValidType || bValidType) return a === b;
		aValidType = isArray(a);
		bValidType = isArray(b);
		if (aValidType || bValidType) return aValidType && bValidType ? looseCompareNested(a, b, seen, looseCompareArrays) : false;
		aValidType = isObject(a);
		bValidType = isObject(b);
		if (aValidType || bValidType) {
			if (!aValidType || !bValidType) return false;
			return looseCompareNested(a, b, seen, looseCompareObjects);
		}
		return String(a) === String(b);
	}
	var isRef$1 = (val) => {
		return !!(val && val["__v_isRef"] === true);
	};
	var toDisplayString = (val) => {
		return isString(val) ? val : val == null ? "" : isArray(val) || isObject(val) && (val.toString === objectToString || !isFunction(val.toString)) ? isRef$1(val) ? toDisplayString(val.value) : JSON.stringify(val, replacer, 2) : String(val);
	};
	var replacer = (_key, val) => {
		if (isRef$1(val)) return replacer(_key, val.value);
		else if (isMap(val)) return { [`Map(${val.size})`]: [...val.entries()].reduce((entries, [key, val2], i) => {
			entries[stringifySymbol(key, i) + " =>"] = val2;
			return entries;
		}, {}) };
		else if (isSet(val)) return { [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v)) };
		else if (isSymbol(val)) return stringifySymbol(val);
		else if (isObject(val) && !isArray(val) && !isPlainObject(val)) return String(val);
		return val;
	};
	var stringifySymbol = (v, i = "") => {
		var _a;
		return isSymbol(v) ? `Symbol(${(_a = v.description) != null ? _a : i})` : v;
	};
	var activeEffectScope;
	var EffectScope = class {
		constructor(detached = false) {
			this.detached = detached;
			this._active = true;
			this._on = 0;
			this.effects = [];
			this.cleanups = [];
			this._isPaused = false;
			this._warnOnRun = true;
			this.__v_skip = true;
			if (!detached && activeEffectScope) {
				if (activeEffectScope.active) {
					this.parent = activeEffectScope;
					this.index = (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(this) - 1;
				} else {
					this._active = false;
					this._warnOnRun = false;
				}
			}
		}
		get active() {
			return this._active;
		}
		pause() {
			if (this._active) {
				this._isPaused = true;
				let i, l;
				if (this.scopes) {
					const scopes = this.scopes.slice();
					for (i = 0, l = scopes.length; i < l; i++) scopes[i].pause();
				}
				for (i = 0, l = this.effects.length; i < l; i++) this.effects[i].pause();
			}
		}
		resume() {
			if (this._active) {
				if (this._isPaused) {
					this._isPaused = false;
					let i, l;
					if (this.scopes) {
						const scopes = this.scopes.slice();
						for (i = 0, l = scopes.length; i < l; i++) scopes[i].resume();
					}
					const effects = this.effects.slice();
					for (i = 0, l = effects.length; i < l; i++) effects[i].resume();
				}
			}
		}
		run(fn) {
			if (this._active) {
				const currentEffectScope = activeEffectScope;
				try {
					activeEffectScope = this;
					return fn();
				} finally {
					activeEffectScope = currentEffectScope;
				}
			}
		}
		on() {
			if (++this._on === 1) {
				this.prevScope = activeEffectScope;
				activeEffectScope = this;
			}
		}
		off() {
			if (this._on > 0 && --this._on === 0) {
				if (activeEffectScope === this) activeEffectScope = this.prevScope;
				else {
					let current = activeEffectScope;
					while (current) {
						if (current.prevScope === this) {
							current.prevScope = this.prevScope;
							break;
						}
						current = current.prevScope;
					}
				}
				this.prevScope = void 0;
			}
		}
		stop(fromParent) {
			if (this._active) {
				this._active = false;
				let i, l;
				for (i = 0, l = this.effects.length; i < l; i++) this.effects[i].stop();
				this.effects.length = 0;
				for (i = 0, l = this.cleanups.length; i < l; i++) this.cleanups[i]();
				this.cleanups.length = 0;
				if (this.scopes) {
					const scopes = this.scopes.slice();
					for (i = 0, l = scopes.length; i < l; i++) scopes[i].stop(true);
					this.scopes.length = 0;
				}
				if (!this.detached && this.parent && !fromParent) {
					const last = this.parent.scopes.pop();
					if (last && last !== this) {
						this.parent.scopes[this.index] = last;
						last.index = this.index;
					}
				}
				this.parent = void 0;
			}
		}
	};
	function getCurrentScope() {
		return activeEffectScope;
	}
	var activeSub;
	var pausedQueueEffects = new WeakSet();
	var ReactiveEffect = class {
		constructor(fn) {
			this.fn = fn;
			this.deps = void 0;
			this.depsTail = void 0;
			this.flags = 5;
			this.next = void 0;
			this.cleanup = void 0;
			this.scheduler = void 0;
			if (activeEffectScope) {
				if (activeEffectScope.active) activeEffectScope.effects.push(this);
				else this.flags &= -2;
			}
		}
		pause() {
			this.flags |= 64;
		}
		resume() {
			if (this.flags & 64) {
				this.flags &= -65;
				if (pausedQueueEffects.has(this)) {
					pausedQueueEffects.delete(this);
					this.trigger();
				}
			}
		}
		notify() {
			if (this.flags & 2 && !(this.flags & 32)) return;
			if (!(this.flags & 8)) batch(this);
		}
		run() {
			if (!(this.flags & 1)) return this.fn();
			this.flags |= 2;
			cleanupEffect(this);
			prepareDeps(this);
			const prevEffect = activeSub;
			const prevShouldTrack = shouldTrack;
			activeSub = this;
			shouldTrack = true;
			try {
				return this.fn();
			} finally {
				cleanupDeps(this);
				activeSub = prevEffect;
				shouldTrack = prevShouldTrack;
				this.flags &= -3;
			}
		}
		stop() {
			if (this.flags & 1) {
				for (let link = this.deps; link; link = link.nextDep) removeSub(link);
				this.deps = this.depsTail = void 0;
				cleanupEffect(this);
				this.onStop && this.onStop();
				this.flags &= -2;
			}
		}
		trigger() {
			if (this.flags & 64) pausedQueueEffects.add(this);
			else if (this.scheduler) this.scheduler();
			else this.runIfDirty();
		}
		runIfDirty() {
			if (isDirty(this)) this.run();
		}
		get dirty() {
			return isDirty(this);
		}
	};
	var batchDepth = 0;
	var batchedSub;
	var batchedComputed;
	function batch(sub, isComputed = false) {
		sub.flags |= 8;
		if (isComputed) {
			sub.next = batchedComputed;
			batchedComputed = sub;
			return;
		}
		sub.next = batchedSub;
		batchedSub = sub;
	}
	function startBatch() {
		batchDepth++;
	}
	function endBatch() {
		if (--batchDepth > 0) return;
		if (batchedComputed) {
			let e = batchedComputed;
			batchedComputed = void 0;
			while (e) {
				const next = e.next;
				e.next = void 0;
				e.flags &= -9;
				e = next;
			}
		}
		let error;
		while (batchedSub) {
			let e = batchedSub;
			batchedSub = void 0;
			while (e) {
				const next = e.next;
				e.next = void 0;
				e.flags &= -9;
				if (e.flags & 1) try {
					e.trigger();
				} catch (err) {
					if (!error) error = err;
				}
				e = next;
			}
		}
		if (error) throw error;
	}
	function prepareDeps(sub) {
		for (let link = sub.deps; link; link = link.nextDep) {
			link.version = -1;
			link.prevActiveLink = link.dep.activeLink;
			link.dep.activeLink = link;
		}
	}
	function cleanupDeps(sub) {
		let head;
		let tail = sub.depsTail;
		let link = tail;
		while (link) {
			const prev = link.prevDep;
			if (link.version === -1) {
				if (link === tail) tail = prev;
				removeSub(link);
				removeDep(link);
			} else head = link;
			link.dep.activeLink = link.prevActiveLink;
			link.prevActiveLink = void 0;
			link = prev;
		}
		sub.deps = head;
		sub.depsTail = tail;
	}
	function isDirty(sub) {
		for (let link = sub.deps; link; link = link.nextDep) if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) return true;
		if (sub._dirty) return true;
		return false;
	}
	function refreshComputed(computed) {
		if (computed.flags & 4 && !(computed.flags & 16)) return;
		computed.flags &= -17;
		if (computed.globalVersion === globalVersion) return;
		computed.globalVersion = globalVersion;
		if (!computed.isSSR && computed.flags & 128 && (!computed.deps && !computed._dirty || !isDirty(computed))) return;
		computed.flags |= 2;
		const dep = computed.dep;
		const prevSub = activeSub;
		const prevShouldTrack = shouldTrack;
		activeSub = computed;
		shouldTrack = true;
		try {
			prepareDeps(computed);
			const value = computed.fn(computed._value);
			if (dep.version === 0 || hasChanged(value, computed._value)) {
				computed.flags |= 128;
				computed._value = value;
				dep.version++;
			}
		} catch (err) {
			dep.version++;
			throw err;
		} finally {
			activeSub = prevSub;
			shouldTrack = prevShouldTrack;
			cleanupDeps(computed);
			computed.flags &= -3;
		}
	}
	function removeSub(link, soft = false) {
		const { dep, prevSub, nextSub } = link;
		if (prevSub) {
			prevSub.nextSub = nextSub;
			link.prevSub = void 0;
		}
		if (nextSub) {
			nextSub.prevSub = prevSub;
			link.nextSub = void 0;
		}
		if (dep.subs === link) {
			dep.subs = prevSub;
			if (!prevSub && dep.computed) {
				dep.computed.flags &= -5;
				for (let l = dep.computed.deps; l; l = l.nextDep) removeSub(l, true);
			}
		}
		if (!soft && !--dep.sc && dep.map) dep.map.delete(dep.key);
	}
	function removeDep(link) {
		const { prevDep, nextDep } = link;
		if (prevDep) {
			prevDep.nextDep = nextDep;
			link.prevDep = void 0;
		}
		if (nextDep) {
			nextDep.prevDep = prevDep;
			link.nextDep = void 0;
		}
	}
	var shouldTrack = true;
	var trackStack = [];
	function pauseTracking() {
		trackStack.push(shouldTrack);
		shouldTrack = false;
	}
	function resetTracking() {
		const last = trackStack.pop();
		shouldTrack = last === void 0 ? true : last;
	}
	function cleanupEffect(e) {
		const { cleanup } = e;
		e.cleanup = void 0;
		if (cleanup) {
			const prevSub = activeSub;
			activeSub = void 0;
			try {
				cleanup();
			} finally {
				activeSub = prevSub;
			}
		}
	}
	var globalVersion = 0;
	var Link = class {
		constructor(sub, dep) {
			this.sub = sub;
			this.dep = dep;
			this.version = dep.version;
			this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
		}
	};
	var Dep = class {
		constructor(computed) {
			this.computed = computed;
			this.version = 0;
			this.activeLink = void 0;
			this.subs = void 0;
			this.map = void 0;
			this.key = void 0;
			this.sc = 0;
			this.__v_skip = true;
		}
		track(debugInfo) {
			if (!activeSub || !shouldTrack || activeSub === this.computed) return;
			let link = this.activeLink;
			if (link === void 0 || link.sub !== activeSub) {
				link = this.activeLink = new Link(activeSub, this);
				if (!activeSub.deps) activeSub.deps = activeSub.depsTail = link;
				else {
					link.prevDep = activeSub.depsTail;
					activeSub.depsTail.nextDep = link;
					activeSub.depsTail = link;
				}
				addSub(link);
			} else if (link.version === -1) {
				link.version = this.version;
				if (link.nextDep) {
					const next = link.nextDep;
					next.prevDep = link.prevDep;
					if (link.prevDep) link.prevDep.nextDep = next;
					link.prevDep = activeSub.depsTail;
					link.nextDep = void 0;
					activeSub.depsTail.nextDep = link;
					activeSub.depsTail = link;
					if (activeSub.deps === link) activeSub.deps = next;
				}
			}
			return link;
		}
		trigger(debugInfo) {
			this.version++;
			globalVersion++;
			this.notify(debugInfo);
		}
		notify(debugInfo) {
			startBatch();
			try {
				for (let link = this.subs; link; link = link.prevSub) if (link.sub.notify()) link.sub.dep.notify();
			} finally {
				endBatch();
			}
		}
	};
	function addSub(link) {
		link.dep.sc++;
		if (link.sub.flags & 4) {
			const computed = link.dep.computed;
			if (computed && !link.dep.subs) {
				computed.flags |= 20;
				for (let l = computed.deps; l; l = l.nextDep) addSub(l);
			}
			const currentTail = link.dep.subs;
			if (currentTail !== link) {
				link.prevSub = currentTail;
				if (currentTail) currentTail.nextSub = link;
			}
			link.dep.subs = link;
		}
	}
	var targetMap = new WeakMap();
	var ITERATE_KEY = Symbol("");
	var MAP_KEY_ITERATE_KEY = Symbol("");
	var ARRAY_ITERATE_KEY = Symbol("");
	function track(target, type, key) {
		if (shouldTrack && activeSub) {
			let depsMap = targetMap.get(target);
			if (!depsMap) targetMap.set(target, depsMap = new Map());
			let dep = depsMap.get(key);
			if (!dep) {
				depsMap.set(key, dep = new Dep());
				dep.map = depsMap;
				dep.key = key;
			}
			dep.track();
		}
	}
	function trigger$1(target, type, key, newValue, oldValue, oldTarget) {
		const depsMap = targetMap.get(target);
		if (!depsMap) {
			globalVersion++;
			return;
		}
		const run = (dep) => {
			if (dep) dep.trigger();
		};
		startBatch();
		if (type === "clear") depsMap.forEach(run);
		else {
			const targetIsArray = isArray(target);
			const isArrayIndex = targetIsArray && isIntegerKey(key);
			if (targetIsArray && key === "length") {
				const newLength = Number(newValue);
				depsMap.forEach((dep, key2) => {
					if (key2 === "length" || key2 === ARRAY_ITERATE_KEY || !isSymbol(key2) && key2 >= newLength) run(dep);
				});
			} else {
				if (key !== void 0 || depsMap.has(void 0)) run(depsMap.get(key));
				if (isArrayIndex) run(depsMap.get(ARRAY_ITERATE_KEY));
				switch (type) {
					case "add":
						if (!targetIsArray) {
							run(depsMap.get(ITERATE_KEY));
							if (isMap(target)) run(depsMap.get(MAP_KEY_ITERATE_KEY));
						} else if (isArrayIndex) run(depsMap.get("length"));
						break;
					case "delete":
						if (!targetIsArray) {
							run(depsMap.get(ITERATE_KEY));
							if (isMap(target)) run(depsMap.get(MAP_KEY_ITERATE_KEY));
						}
						break;
					case "set": if (isMap(target)) run(depsMap.get(ITERATE_KEY));
				}
			}
		}
		endBatch();
	}
	function reactiveReadArray(array) {
		const raw = toRaw(array);
		if (raw === array) return raw;
		track(raw, "iterate", ARRAY_ITERATE_KEY);
		if (isShallow(array)) return raw;
		if (!isReadonly(array)) return raw.map(toReactive);
		return isReactive(array) ? raw.map((item) => toReadonly(toReactive(item))) : raw.map(toReadonly);
	}
	function shallowReadArray(arr) {
		track(arr = toRaw(arr), "iterate", ARRAY_ITERATE_KEY);
		return arr;
	}
	function toWrapped(target, item) {
		if (isReadonly(target)) return isReactive(target) ? toReadonly(toReactive(item)) : toReadonly(item);
		return toReactive(item);
	}
	var arrayInstrumentations = {
		__proto__: null,
		[Symbol.iterator]() {
			return iterator(this, Symbol.iterator, (item) => toWrapped(this, item));
		},
		concat(...args) {
			return reactiveReadArray(this).concat(...args.map((x) => isArray(x) ? reactiveReadArray(x) : x));
		},
		entries() {
			return iterator(this, "entries", (value) => {
				value[1] = toWrapped(this, value[1]);
				return value;
			});
		},
		every(fn, thisArg) {
			return apply(this, "every", fn, thisArg, void 0, arguments);
		},
		filter(fn, thisArg) {
			return apply(this, "filter", fn, thisArg, (v) => v.map((item) => toWrapped(this, item)), arguments);
		},
		find(fn, thisArg) {
			return apply(this, "find", fn, thisArg, (item) => toWrapped(this, item), arguments);
		},
		findIndex(fn, thisArg) {
			return apply(this, "findIndex", fn, thisArg, void 0, arguments);
		},
		findLast(fn, thisArg) {
			return apply(this, "findLast", fn, thisArg, (item) => toWrapped(this, item), arguments);
		},
		findLastIndex(fn, thisArg) {
			return apply(this, "findLastIndex", fn, thisArg, void 0, arguments);
		},
		forEach(fn, thisArg) {
			return apply(this, "forEach", fn, thisArg, void 0, arguments);
		},
		includes(...args) {
			return searchProxy(this, "includes", args);
		},
		indexOf(...args) {
			return searchProxy(this, "indexOf", args);
		},
		join(separator) {
			return reactiveReadArray(this).join(separator);
		},
		lastIndexOf(...args) {
			return searchProxy(this, "lastIndexOf", args);
		},
		map(fn, thisArg) {
			return apply(this, "map", fn, thisArg, void 0, arguments);
		},
		pop() {
			return noTracking(this, "pop");
		},
		push(...args) {
			return noTracking(this, "push", args);
		},
		reduce(fn, ...args) {
			return reduce(this, "reduce", fn, args);
		},
		reduceRight(fn, ...args) {
			return reduce(this, "reduceRight", fn, args);
		},
		shift() {
			return noTracking(this, "shift");
		},
		some(fn, thisArg) {
			return apply(this, "some", fn, thisArg, void 0, arguments);
		},
		splice(...args) {
			return noTracking(this, "splice", args);
		},
		toReversed() {
			return reactiveReadArray(this).toReversed();
		},
		toSorted(comparer) {
			return reactiveReadArray(this).toSorted(comparer);
		},
		toSpliced(...args) {
			return reactiveReadArray(this).toSpliced(...args);
		},
		unshift(...args) {
			return noTracking(this, "unshift", args);
		},
		values() {
			return iterator(this, "values", (item) => toWrapped(this, item));
		}
	};
	function iterator(self, method, wrapValue) {
		const arr = shallowReadArray(self);
		const iter = arr[method]();
		if (arr !== self && !isShallow(self)) {
			iter._next = iter.next;
			iter.next = () => {
				const result = iter._next();
				if (!result.done) result.value = wrapValue(result.value);
				return result;
			};
		}
		return iter;
	}
	var arrayProto = Array.prototype;
	function apply(self, method, fn, thisArg, wrappedRetFn, args) {
		const arr = shallowReadArray(self);
		const needsWrap = arr !== self && !isShallow(self);
		const methodFn = arr[method];
		if (methodFn !== arrayProto[method]) {
			const result2 = methodFn.apply(self, args);
			return needsWrap ? toReactive(result2) : result2;
		}
		let wrappedFn = fn;
		if (arr !== self) {
			if (needsWrap) wrappedFn = function(item, index) {
				return fn.call(this, toWrapped(self, item), index, self);
			};
			else if (fn.length > 2) wrappedFn = function(item, index) {
				return fn.call(this, item, index, self);
			};
		}
		const result = methodFn.call(arr, wrappedFn, thisArg);
		return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
	}
	function reduce(self, method, fn, args) {
		const arr = shallowReadArray(self);
		const needsWrap = arr !== self && !isShallow(self);
		let wrappedFn = fn;
		let wrapInitialAccumulator = false;
		if (arr !== self) {
			if (needsWrap) {
				wrapInitialAccumulator = args.length === 0;
				wrappedFn = function(acc, item, index) {
					if (wrapInitialAccumulator) {
						wrapInitialAccumulator = false;
						acc = toWrapped(self, acc);
					}
					return fn.call(this, acc, toWrapped(self, item), index, self);
				};
			} else if (fn.length > 3) wrappedFn = function(acc, item, index) {
				return fn.call(this, acc, item, index, self);
			};
		}
		const result = arr[method](wrappedFn, ...args);
		return wrapInitialAccumulator ? toWrapped(self, result) : result;
	}
	function searchProxy(self, method, args) {
		const arr = toRaw(self);
		track(arr, "iterate", ARRAY_ITERATE_KEY);
		const res = arr[method](...args);
		if ((res === -1 || res === false) && isProxy(args[0])) {
			args[0] = toRaw(args[0]);
			return arr[method](...args);
		}
		return res;
	}
	function noTracking(self, method, args = []) {
		pauseTracking();
		startBatch();
		const res = toRaw(self)[method].apply(self, args);
		endBatch();
		resetTracking();
		return res;
	}
	var isNonTrackableKeys = makeMap(`__proto__,__v_isRef,__isVue`);
	var builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol));
	function hasOwnProperty(key) {
		if (!isSymbol(key)) key = String(key);
		const obj = toRaw(this);
		track(obj, "has", key);
		return obj.hasOwnProperty(key);
	}
	var BaseReactiveHandler = class {
		constructor(_isReadonly = false, _isShallow = false) {
			this._isReadonly = _isReadonly;
			this._isShallow = _isShallow;
		}
		get(target, key, receiver) {
			if (key === "__v_skip") return target["__v_skip"];
			const isReadonly2 = this._isReadonly, isShallow2 = this._isShallow;
			if (key === "__v_isReactive") return !isReadonly2;
			else if (key === "__v_isReadonly") return isReadonly2;
			else if (key === "__v_isShallow") return isShallow2;
			else if (key === "__v_raw") {
				if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) return target;
				return;
			}
			const targetIsArray = isArray(target);
			if (!isReadonly2) {
				let fn;
				if (targetIsArray && (fn = arrayInstrumentations[key])) return fn;
				if (key === "hasOwnProperty") return hasOwnProperty;
			}
			const res = Reflect.get(target, key, isRef(target) ? target : receiver);
			if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) return res;
			if (!isReadonly2) track(target, "get", key);
			if (isShallow2) return res;
			if (isRef(res)) {
				const value = targetIsArray && isIntegerKey(key) ? res : res.value;
				return isReadonly2 && isObject(value) ? readonly(value) : value;
			}
			if (isObject(res)) return isReadonly2 ? readonly(res) : reactive(res);
			return res;
		}
	};
	var MutableReactiveHandler = class extends BaseReactiveHandler {
		constructor(isShallow2 = false) {
			super(false, isShallow2);
		}
		set(target, key, value, receiver) {
			let oldValue = target[key];
			const isArrayWithIntegerKey = isArray(target) && isIntegerKey(key);
			if (!this._isShallow) {
				const isOldValueReadonly = isReadonly(oldValue);
				if (!isShallow(value) && !isReadonly(value)) {
					oldValue = toRaw(oldValue);
					value = toRaw(value);
				}
				if (!isArrayWithIntegerKey && isRef(oldValue) && !isRef(value)) {
					if (isOldValueReadonly) return true;
					else {
						oldValue.value = value;
						return true;
					}
				}
			}
			const hadKey = isArrayWithIntegerKey ? Number(key) < target.length : hasOwn(target, key);
			const result = Reflect.set(target, key, value, isRef(target) ? target : receiver);
			if (target === toRaw(receiver) && result) {
				if (!hadKey) trigger$1(target, "add", key, value);
				else if (hasChanged(value, oldValue)) trigger$1(target, "set", key, value, oldValue);
			}
			return result;
		}
		deleteProperty(target, key) {
			const hadKey = hasOwn(target, key);
			const oldValue = target[key];
			const result = Reflect.deleteProperty(target, key);
			if (result && hadKey) trigger$1(target, "delete", key, void 0, oldValue);
			return result;
		}
		has(target, key) {
			const result = Reflect.has(target, key);
			if (!isSymbol(key) || !builtInSymbols.has(key)) track(target, "has", key);
			return result;
		}
		ownKeys(target) {
			track(target, "iterate", isArray(target) ? "length" : ITERATE_KEY);
			return Reflect.ownKeys(target);
		}
	};
	var ReadonlyReactiveHandler = class extends BaseReactiveHandler {
		constructor(isShallow2 = false) {
			super(true, isShallow2);
		}
		set(target, key) {
			return true;
		}
		deleteProperty(target, key) {
			return true;
		}
	};
	var mutableHandlers = new MutableReactiveHandler();
	var readonlyHandlers = new ReadonlyReactiveHandler();
	var shallowReactiveHandlers = new MutableReactiveHandler(true);
	var toShallow = (value) => value;
	var getProto = (v) => Reflect.getPrototypeOf(v);
	function createIterableMethod(method, isReadonly2, isShallow2) {
		return function(...args) {
			const target = this["__v_raw"];
			const rawTarget = toRaw(target);
			const targetIsMap = isMap(rawTarget);
			const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
			const isKeyOnly = method === "keys" && targetIsMap;
			const innerIterator = target[method](...args);
			const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
			!isReadonly2 && track(rawTarget, "iterate", isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);
			return extend(Object.create(innerIterator), { next() {
				const { value, done } = innerIterator.next();
				return done ? {
					value,
					done
				} : {
					value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
					done
				};
			} });
		};
	}
	function createReadonlyMethod(type) {
		return function(...args) {
			return type === "delete" ? false : type === "clear" ? void 0 : this;
		};
	}
	function createInstrumentations(readonly, shallow) {
		const instrumentations = {
			get(key) {
				const target = this["__v_raw"];
				const rawTarget = toRaw(target);
				const rawKey = toRaw(key);
				if (!readonly) {
					if (hasChanged(key, rawKey)) track(rawTarget, "get", key);
					track(rawTarget, "get", rawKey);
				}
				const { has } = getProto(rawTarget);
				const wrap = shallow ? toShallow : readonly ? toReadonly : toReactive;
				if (has.call(rawTarget, key)) return wrap(target.get(key));
				else if (has.call(rawTarget, rawKey)) return wrap(target.get(rawKey));
				else if (target !== rawTarget) target.get(key);
			},
			get size() {
				const target = this["__v_raw"];
				!readonly && track(toRaw(target), "iterate", ITERATE_KEY);
				return target.size;
			},
			has(key) {
				const target = this["__v_raw"];
				const rawTarget = toRaw(target);
				const rawKey = toRaw(key);
				if (!readonly) {
					if (hasChanged(key, rawKey)) track(rawTarget, "has", key);
					track(rawTarget, "has", rawKey);
				}
				return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
			},
			forEach(callback, thisArg) {
				const observed = this;
				const target = observed["__v_raw"];
				const rawTarget = toRaw(target);
				const wrap = shallow ? toShallow : readonly ? toReadonly : toReactive;
				!readonly && track(rawTarget, "iterate", ITERATE_KEY);
				return target.forEach((value, key) => {
					return callback.call(thisArg, wrap(value), wrap(key), observed);
				});
			}
		};
		extend(instrumentations, readonly ? {
			add: createReadonlyMethod("add"),
			set: createReadonlyMethod("set"),
			delete: createReadonlyMethod("delete"),
			clear: createReadonlyMethod("clear")
		} : {
			add(value) {
				const target = toRaw(this);
				const proto = getProto(target);
				const rawValue = toRaw(value);
				const valueToAdd = !shallow && !isShallow(value) && !isReadonly(value) ? rawValue : value;
				if (!(proto.has.call(target, valueToAdd) || hasChanged(value, valueToAdd) && proto.has.call(target, value) || hasChanged(rawValue, valueToAdd) && proto.has.call(target, rawValue))) {
					target.add(valueToAdd);
					trigger$1(target, "add", valueToAdd, valueToAdd);
				}
				return this;
			},
			set(key, value) {
				if (!shallow && !isShallow(value) && !isReadonly(value)) value = toRaw(value);
				const target = toRaw(this);
				const { has, get } = getProto(target);
				let hadKey = has.call(target, key);
				if (!hadKey) {
					key = toRaw(key);
					hadKey = has.call(target, key);
				}
				const oldValue = get.call(target, key);
				target.set(key, value);
				if (!hadKey) trigger$1(target, "add", key, value);
				else if (hasChanged(value, oldValue)) trigger$1(target, "set", key, value, oldValue);
				return this;
			},
			delete(key) {
				const target = toRaw(this);
				const { has, get } = getProto(target);
				let hadKey = has.call(target, key);
				if (!hadKey) {
					key = toRaw(key);
					hadKey = has.call(target, key);
				}
				const oldValue = get ? get.call(target, key) : void 0;
				const result = target.delete(key);
				if (hadKey) trigger$1(target, "delete", key, void 0, oldValue);
				return result;
			},
			clear() {
				const target = toRaw(this);
				const hadItems = target.size !== 0;
				const oldTarget = void 0;
				const result = target.clear();
				if (hadItems) trigger$1(target, "clear", void 0, void 0, oldTarget);
				return result;
			}
		});
		[
			"keys",
			"values",
			"entries",
			Symbol.iterator
		].forEach((method) => {
			instrumentations[method] = createIterableMethod(method, readonly, shallow);
		});
		return instrumentations;
	}
	function createInstrumentationGetter(isReadonly2, shallow) {
		const instrumentations = createInstrumentations(isReadonly2, shallow);
		return (target, key, receiver) => {
			if (key === "__v_isReactive") return !isReadonly2;
			else if (key === "__v_isReadonly") return isReadonly2;
			else if (key === "__v_raw") return target;
			return Reflect.get(hasOwn(instrumentations, key) && key in target ? instrumentations : target, key, receiver);
		};
	}
	var mutableCollectionHandlers = { get: createInstrumentationGetter(false, false) };
	var shallowCollectionHandlers = { get: createInstrumentationGetter(false, true) };
	var readonlyCollectionHandlers = { get: createInstrumentationGetter(true, false) };
	var reactiveMap = new WeakMap();
	var shallowReactiveMap = new WeakMap();
	var readonlyMap = new WeakMap();
	var shallowReadonlyMap = new WeakMap();
	function targetTypeMap(rawType) {
		switch (rawType) {
			case "Object":
			case "Array": return 1;
			case "Map":
			case "Set":
			case "WeakMap":
			case "WeakSet": return 2;
			default: return 0;
		}
	}
	function reactive(target) {
		if (isReadonly(target)) return target;
		return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers, reactiveMap);
	}
	function shallowReactive(target) {
		return createReactiveObject(target, false, shallowReactiveHandlers, shallowCollectionHandlers, shallowReactiveMap);
	}
	function readonly(target) {
		return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers, readonlyMap);
	}
	function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
		if (!isObject(target)) return target;
		if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) return target;
		if (target["__v_skip"] || !Object.isExtensible(target)) return target;
		const existingProxy = proxyMap.get(target);
		if (existingProxy) return existingProxy;
		const targetType = targetTypeMap(toRawType(target));
		if (targetType === 0) return target;
		const proxy = new Proxy(target, targetType === 2 ? collectionHandlers : baseHandlers);
		proxyMap.set(target, proxy);
		return proxy;
	}
	function isReactive(value) {
		if (isReadonly(value)) return isReactive(value["__v_raw"]);
		return !!(value && value["__v_isReactive"]);
	}
	function isReadonly(value) {
		return !!(value && value["__v_isReadonly"]);
	}
	function isShallow(value) {
		return !!(value && value["__v_isShallow"]);
	}
	function isProxy(value) {
		return value ? !!value["__v_raw"] : false;
	}
	function toRaw(observed) {
		const raw = observed && observed["__v_raw"];
		return raw ? toRaw(raw) : observed;
	}
	function markRaw(value) {
		if (!hasOwn(value, "__v_skip") && Object.isExtensible(value)) def(value, "__v_skip", true);
		return value;
	}
	var toReactive = (value) => isObject(value) ? reactive(value) : value;
	var toReadonly = (value) => isObject(value) ? readonly(value) : value;
	function isRef(r) {
		return r ? r["__v_isRef"] === true : false;
	}
	function ref(value) {
		return createRef(value, false);
	}
	function createRef(rawValue, shallow) {
		if (isRef(rawValue)) return rawValue;
		return new RefImpl(rawValue, shallow);
	}
	var RefImpl = class {
		constructor(value, isShallow2) {
			this.dep = new Dep();
			this["__v_isRef"] = true;
			this["__v_isShallow"] = false;
			this._rawValue = isShallow2 ? value : toRaw(value);
			this._value = isShallow2 ? value : toReactive(value);
			this["__v_isShallow"] = isShallow2;
		}
		get value() {
			this.dep.track();
			return this._value;
		}
		set value(newValue) {
			const oldValue = this._rawValue;
			const useDirectValue = this["__v_isShallow"] || isShallow(newValue) || isReadonly(newValue);
			newValue = useDirectValue ? newValue : toRaw(newValue);
			if (hasChanged(newValue, oldValue)) {
				this._rawValue = newValue;
				this._value = useDirectValue ? newValue : toReactive(newValue);
				this.dep.trigger();
			}
		}
	};
	function unref(ref2) {
		return isRef(ref2) ? ref2.value : ref2;
	}
	var shallowUnwrapHandlers = {
		get: (target, key, receiver) => key === "__v_raw" ? target : unref(Reflect.get(target, key, receiver)),
		set: (target, key, value, receiver) => {
			const oldValue = target[key];
			if (isRef(oldValue) && !isRef(value)) {
				oldValue.value = value;
				return true;
			} else return Reflect.set(target, key, value, receiver);
		}
	};
	function proxyRefs(objectWithRefs) {
		return isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
	}
	var ComputedRefImpl = class {
		constructor(fn, setter, isSSR) {
			this.fn = fn;
			this.setter = setter;
			this._value = void 0;
			this.dep = new Dep(this);
			this.__v_isRef = true;
			this.deps = void 0;
			this.depsTail = void 0;
			this.flags = 16;
			this.globalVersion = globalVersion - 1;
			this.next = void 0;
			this.effect = this;
			this["__v_isReadonly"] = !setter;
			this.isSSR = isSSR;
		}
		notify() {
			this.flags |= 16;
			if (!(this.flags & 8) && activeSub !== this) {
				batch(this, true);
				return true;
			}
		}
		get value() {
			const link = this.dep.track();
			refreshComputed(this);
			if (link) link.version = this.dep.version;
			return this._value;
		}
		set value(newValue) {
			if (this.setter) this.setter(newValue);
		}
	};
	function computed$1(getterOrOptions, debugOptions, isSSR = false) {
		let getter;
		let setter;
		if (isFunction(getterOrOptions)) getter = getterOrOptions;
		else {
			getter = getterOrOptions.get;
			setter = getterOrOptions.set;
		}
		return new ComputedRefImpl(getter, setter, isSSR);
	}
	var INITIAL_WATCHER_VALUE = {};
	var cleanupMap = new WeakMap();
	var activeWatcher = void 0;
	function onWatcherCleanup(cleanupFn, failSilently = false, owner = activeWatcher) {
		if (owner) {
			let cleanups = cleanupMap.get(owner);
			if (!cleanups) cleanupMap.set(owner, cleanups = []);
			cleanups.push(cleanupFn);
		}
	}
	function watch$1(source, cb, options = EMPTY_OBJ) {
		const { immediate, deep, once, scheduler, augmentJob, call } = options;
		const reactiveGetter = (source2) => {
			if (deep) return source2;
			if (isShallow(source2) || deep === false || deep === 0) return traverse(source2, 1);
			return traverse(source2);
		};
		let effect;
		let getter;
		let cleanup;
		let boundCleanup;
		let forceTrigger = false;
		let isMultiSource = false;
		if (isRef(source)) {
			getter = () => source.value;
			forceTrigger = isShallow(source);
		} else if (isReactive(source)) {
			getter = () => reactiveGetter(source);
			forceTrigger = true;
		} else if (isArray(source)) {
			isMultiSource = true;
			forceTrigger = source.some((s) => isReactive(s) || isShallow(s));
			getter = () => source.map((s) => {
				if (isRef(s)) return s.value;
				else if (isReactive(s)) return reactiveGetter(s);
				else if (isFunction(s)) return call ? call(s, 2) : s();
			});
		} else if (isFunction(source)) {
			if (cb) getter = call ? () => call(source, 2) : source;
			else getter = () => {
				if (cleanup) {
					pauseTracking();
					try {
						cleanup();
					} finally {
						resetTracking();
					}
				}
				const currentEffect = activeWatcher;
				activeWatcher = effect;
				try {
					return call ? call(source, 3, [boundCleanup]) : source(boundCleanup);
				} finally {
					activeWatcher = currentEffect;
				}
			};
		} else getter = NOOP;
		if (cb && deep) {
			const baseGetter = getter;
			const depth = deep === true ? Infinity : deep;
			getter = () => traverse(baseGetter(), depth);
		}
		const scope = getCurrentScope();
		const watchHandle = () => {
			effect.stop();
			if (scope && scope.active) remove(scope.effects, effect);
		};
		if (once && cb) {
			const _cb = cb;
			cb = (...args) => {
				const res = _cb(...args);
				watchHandle();
				return res;
			};
		}
		let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
		const job = (immediateFirstRun) => {
			if (!(effect.flags & 1) || !effect.dirty && !immediateFirstRun) return;
			if (cb) {
				const newValue = effect.run();
				if (immediateFirstRun || deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => hasChanged(v, oldValue[i])) : hasChanged(newValue, oldValue))) {
					if (cleanup) cleanup();
					const currentWatcher = activeWatcher;
					activeWatcher = effect;
					try {
						const args = [
							newValue,
							oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
							boundCleanup
						];
						oldValue = newValue;
						call ? call(cb, 3, args) : cb(...args);
					} finally {
						activeWatcher = currentWatcher;
					}
				}
			} else effect.run();
		};
		if (augmentJob) augmentJob(job);
		effect = new ReactiveEffect(getter);
		effect.scheduler = scheduler ? () => scheduler(job, false) : job;
		boundCleanup = (fn) => onWatcherCleanup(fn, false, effect);
		cleanup = effect.onStop = () => {
			const cleanups = cleanupMap.get(effect);
			if (cleanups) {
				if (call) call(cleanups, 4);
				else for (const cleanup2 of cleanups) cleanup2();
				cleanupMap.delete(effect);
			}
		};
		if (cb) {
			if (immediate) job(true);
			else oldValue = effect.run();
		} else if (scheduler) scheduler(job.bind(null, true), true);
		else effect.run();
		watchHandle.pause = effect.pause.bind(effect);
		watchHandle.resume = effect.resume.bind(effect);
		watchHandle.stop = watchHandle;
		return watchHandle;
	}
	function traverse(value, depth = Infinity, seen) {
		if (depth <= 0 || !isObject(value) || value["__v_skip"]) return value;
		seen = seen || new Map();
		if ((seen.get(value) || 0) >= depth) return value;
		seen.set(value, depth);
		depth--;
		if (isRef(value)) traverse(value.value, depth, seen);
		else if (isArray(value)) for (let i = 0; i < value.length; i++) traverse(value[i], depth, seen);
		else if (isSet(value) || isMap(value)) value.forEach((v) => {
			traverse(v, depth, seen);
		});
		else if (isPlainObject(value)) {
			for (const key in value) traverse(value[key], depth, seen);
			for (const key of Object.getOwnPropertySymbols(value)) if (Object.prototype.propertyIsEnumerable.call(value, key)) traverse(value[key], depth, seen);
		}
		return value;
	}
	function callWithErrorHandling(fn, instance, type, args) {
		try {
			return args ? fn(...args) : fn();
		} catch (err) {
			handleError(err, instance, type);
		}
	}
	function callWithAsyncErrorHandling(fn, instance, type, args) {
		if (isFunction(fn)) {
			const res = callWithErrorHandling(fn, instance, type, args);
			if (res && isPromise(res)) res.catch((err) => {
				handleError(err, instance, type);
			});
			return res;
		}
		if (isArray(fn)) {
			const values = [];
			for (let i = 0; i < fn.length; i++) values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
			return values;
		}
	}
	function handleError(err, instance, type, throwInDev = true) {
		const contextVNode = instance ? instance.vnode : null;
		const { errorHandler, throwUnhandledErrorInProduction } = instance && instance.appContext.config || EMPTY_OBJ;
		if (instance) {
			let cur = instance.parent;
			const exposedInstance = instance.proxy;
			const errorInfo = `https://vuejs.org/error-reference/#runtime-${type}`;
			while (cur) {
				const errorCapturedHooks = cur.ec;
				if (errorCapturedHooks) {
					for (let i = 0; i < errorCapturedHooks.length; i++) if (errorCapturedHooks[i](err, exposedInstance, errorInfo) === false) return;
				}
				cur = cur.parent;
			}
			if (errorHandler) {
				pauseTracking();
				callWithErrorHandling(errorHandler, null, 10, [
					err,
					exposedInstance,
					errorInfo
				]);
				resetTracking();
				return;
			}
		}
		logError(err, type, contextVNode, throwInDev, throwUnhandledErrorInProduction);
	}
	function logError(err, type, contextVNode, throwInDev = true, throwInProd = false) {
		if (throwInProd) throw err;
		else console.error(err);
	}
	var queue = [];
	var flushIndex = -1;
	var pendingPostFlushCbs = [];
	var activePostFlushCbs = null;
	var postFlushIndex = 0;
	var resolvedPromise = Promise.resolve();
	var currentFlushPromise = null;
	function nextTick(fn) {
		const p = currentFlushPromise || resolvedPromise;
		return fn ? p.then(this ? fn.bind(this) : fn) : p;
	}
	function findInsertionIndex(id) {
		let start = flushIndex + 1;
		let end = queue.length;
		while (start < end) {
			const middle = start + end >>> 1;
			const middleJob = queue[middle];
			const middleJobId = getId(middleJob);
			if (middleJobId < id || middleJobId === id && middleJob.flags & 2) start = middle + 1;
			else end = middle;
		}
		return start;
	}
	function queueJob(job) {
		if (!(job.flags & 1)) {
			const jobId = getId(job);
			const lastJob = queue[queue.length - 1];
			if (!lastJob || !(job.flags & 2) && jobId >= getId(lastJob)) queue.push(job);
			else queue.splice(findInsertionIndex(jobId), 0, job);
			job.flags |= 1;
			queueFlush();
		}
	}
	function queueFlush() {
		if (!currentFlushPromise) currentFlushPromise = resolvedPromise.then(flushJobs);
	}
	function queuePostFlushCb(cb) {
		if (!isArray(cb)) {
			if (activePostFlushCbs && cb.id === -1) activePostFlushCbs.splice(postFlushIndex + 1, 0, cb);
			else if (!(cb.flags & 1)) {
				pendingPostFlushCbs.push(cb);
				cb.flags |= 1;
			}
		} else for (let i = 0; i < cb.length; i++) pendingPostFlushCbs.push(cb[i]);
		queueFlush();
	}
	function flushPreFlushCbs(instance, seen, i = flushIndex + 1) {
		for (; i < queue.length; i++) {
			const cb = queue[i];
			if (cb && cb.flags & 2) {
				if (instance && cb.id !== instance.uid) continue;
				queue.splice(i, 1);
				i--;
				if (cb.flags & 4) cb.flags &= -2;
				cb();
				if (!(cb.flags & 4)) cb.flags &= -2;
			}
		}
	}
	function flushPostFlushCbs(seen) {
		if (pendingPostFlushCbs.length) {
			const deduped = [...new Set(pendingPostFlushCbs)].sort((a, b) => getId(a) - getId(b));
			pendingPostFlushCbs.length = 0;
			if (activePostFlushCbs) {
				for (let i = 0; i < deduped.length; i++) activePostFlushCbs.push(deduped[i]);
				return;
			}
			activePostFlushCbs = deduped;
			for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
				const cb = activePostFlushCbs[postFlushIndex];
				if (cb.flags & 4) cb.flags &= -2;
				if (!(cb.flags & 8)) cb();
				cb.flags &= -2;
			}
			activePostFlushCbs = null;
			postFlushIndex = 0;
		}
	}
	var getId = (job) => job.id == null ? job.flags & 2 ? -1 : Infinity : job.id;
	function flushJobs(seen) {
		try {
			for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
				const job = queue[flushIndex];
				if (job && !(job.flags & 8)) {
					if (job.flags & 4) job.flags &= -2;
					callWithErrorHandling(job, job.i, job.i ? 15 : 14);
					if (!(job.flags & 4)) job.flags &= -2;
				}
			}
		} finally {
			for (; flushIndex < queue.length; flushIndex++) {
				const job = queue[flushIndex];
				if (job) job.flags &= -2;
			}
			flushIndex = -1;
			queue.length = 0;
			flushPostFlushCbs(seen);
			currentFlushPromise = null;
			if (queue.length || pendingPostFlushCbs.length) flushJobs(seen);
		}
	}
	var currentRenderingInstance = null;
	var currentScopeId = null;
	function setCurrentRenderingInstance(instance) {
		const prev = currentRenderingInstance;
		currentRenderingInstance = instance;
		currentScopeId = instance && instance.type.__scopeId || null;
		return prev;
	}
	function withCtx(fn, ctx = currentRenderingInstance, isNonScopedSlot) {
		if (!ctx) return fn;
		if (fn._n) return fn;
		const renderFnWithContext = (...args) => {
			if (renderFnWithContext._d) setBlockTracking(-1);
			const prevInstance = setCurrentRenderingInstance(ctx);
			const prevStackSize = blockStack.length;
			let res;
			try {
				res = fn(...args);
			} finally {
				for (let i = blockStack.length; i > prevStackSize; i--) closeBlock();
				setCurrentRenderingInstance(prevInstance);
				if (renderFnWithContext._d) setBlockTracking(1);
			}
			return res;
		};
		renderFnWithContext._n = true;
		renderFnWithContext._c = true;
		renderFnWithContext._d = true;
		return renderFnWithContext;
	}
	function invokeDirectiveHook(vnode, prevVNode, instance, name) {
		const bindings = vnode.dirs;
		const oldBindings = prevVNode && prevVNode.dirs;
		for (let i = 0; i < bindings.length; i++) {
			const binding = bindings[i];
			if (oldBindings) binding.oldValue = oldBindings[i].value;
			let hook = binding.dir[name];
			if (hook) {
				pauseTracking();
				callWithAsyncErrorHandling(hook, instance, 8, [
					vnode.el,
					binding,
					vnode,
					prevVNode
				]);
				resetTracking();
			}
		}
	}
	function provide(key, value) {
		if (currentInstance) {
			let provides = currentInstance.provides;
			const parentProvides = currentInstance.parent && currentInstance.parent.provides;
			if (parentProvides === provides) provides = currentInstance.provides = Object.create(parentProvides);
			provides[key] = value;
		}
	}
	function inject(key, defaultValue, treatDefaultAsFactory = false) {
		const instance = getCurrentInstance();
		if (instance || currentApp) {
			let provides = currentApp ? currentApp._context.provides : instance ? instance.parent == null || instance.ce ? instance.vnode.appContext && instance.vnode.appContext.provides : instance.parent.provides : void 0;
			if (provides && key in provides) return provides[key];
			else if (arguments.length > 1) return treatDefaultAsFactory && isFunction(defaultValue) ? defaultValue.call(instance && instance.proxy) : defaultValue;
		}
	}
	var ssrContextKey = Symbol.for("v-scx");
	var useSSRContext = () => {
		{
			const ctx = inject(ssrContextKey);
			if (!ctx) {}
			return ctx;
		}
	};
	function watch(source, cb, options) {
		return doWatch(source, cb, options);
	}
	function doWatch(source, cb, options = EMPTY_OBJ) {
		const { immediate, deep, flush, once } = options;
		const baseWatchOptions = extend({}, options);
		const runsImmediately = cb && immediate || !cb && flush !== "post";
		let ssrCleanup;
		if (isInSSRComponentSetup) {
			if (flush === "sync") {
				const ctx = useSSRContext();
				ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = []);
			} else if (!runsImmediately) {
				const watchStopHandle = () => {};
				watchStopHandle.stop = NOOP;
				watchStopHandle.resume = NOOP;
				watchStopHandle.pause = NOOP;
				return watchStopHandle;
			}
		}
		const instance = currentInstance;
		baseWatchOptions.call = (fn, type, args) => callWithAsyncErrorHandling(fn, instance, type, args);
		let isPre = false;
		if (flush === "post") baseWatchOptions.scheduler = (job) => {
			queuePostRenderEffect(job, instance && instance.suspense);
		};
		else if (flush !== "sync") {
			isPre = true;
			baseWatchOptions.scheduler = (job, isFirstRun) => {
				if (isFirstRun) job();
				else queueJob(job);
			};
		}
		baseWatchOptions.augmentJob = (job) => {
			if (cb) job.flags |= 4;
			if (isPre) {
				job.flags |= 2;
				if (instance) {
					job.id = instance.uid;
					job.i = instance;
				}
			}
		};
		const watchHandle = watch$1(source, cb, baseWatchOptions);
		if (isInSSRComponentSetup) {
			if (ssrCleanup) ssrCleanup.push(watchHandle);
			else if (runsImmediately) watchHandle();
		}
		return watchHandle;
	}
	function instanceWatch(source, value, options) {
		const publicThis = this.proxy;
		const getter = isString(source) ? source.includes(".") ? createPathGetter(publicThis, source) : () => publicThis[source] : source.bind(publicThis, publicThis);
		let cb;
		if (isFunction(value)) cb = value;
		else {
			cb = value.handler;
			options = value;
		}
		const reset = setCurrentInstance(this);
		const res = doWatch(getter, cb.bind(publicThis), options);
		reset();
		return res;
	}
	function createPathGetter(ctx, path) {
		const segments = path.split(".");
		return () => {
			let cur = ctx;
			for (let i = 0; i < segments.length && cur; i++) cur = cur[segments[i]];
			return cur;
		};
	}
	var TeleportEndKey = Symbol("_vte");
	var isTeleport = (type) => type.__isTeleport;
	var leaveCbKey = Symbol("_leaveCb");
	function findNonCommentChild(children) {
		let child = children[0];
		if (children.length > 1) {
			for (const c of children) if (c.type !== Comment) {
				child = c;
				break;
			}
		}
		return child;
	}
	function getInnerChild$1(vnode) {
		if (!isKeepAlive(vnode)) {
			if (isTeleport(vnode.type) && vnode.children) return findNonCommentChild(vnode.children);
			return vnode;
		}
		if (vnode.component) return vnode.component.subTree;
		const { shapeFlag, children } = vnode;
		if (children) {
			if (shapeFlag & 16) return children[0];
			if (shapeFlag & 32 && isFunction(children.default)) return children.default();
		}
	}
	function setTransitionHooks(vnode, hooks) {
		if (vnode.shapeFlag & 6 && vnode.component) {
			vnode.transition = hooks;
			const subTree = vnode.component.subTree;
			setTransitionHooks(isTeleport(subTree.type) ? getInnerChild$1(subTree) || subTree : subTree, hooks);
		} else if (vnode.shapeFlag & 128) {
			vnode.ssContent.transition = hooks.clone(vnode.ssContent);
			vnode.ssFallback.transition = hooks.clone(vnode.ssFallback);
		} else vnode.transition = hooks;
	}
	function defineComponent(options, extraOptions) {
		return isFunction(options) ? (() => extend({ name: options.name }, extraOptions, { setup: options }))() : options;
	}
	function markAsyncBoundary(instance) {
		instance.ids = [
			instance.ids[0] + instance.ids[2]++ + "-",
			0,
			0
		];
	}
	function isTemplateRefKey(refs, key) {
		let desc;
		return !!((desc = Object.getOwnPropertyDescriptor(refs, key)) && !desc.configurable);
	}
	var pendingSetRefMap = new WeakMap();
	function setRef(rawRef, oldRawRef, parentSuspense, vnode, isUnmount = false) {
		if (isArray(rawRef)) {
			rawRef.forEach((r, i) => setRef(r, oldRawRef && (isArray(oldRawRef) ? oldRawRef[i] : oldRawRef), parentSuspense, vnode, isUnmount));
			return;
		}
		if (isAsyncWrapper(vnode) && !isUnmount) {
			if (vnode.shapeFlag & 512 && vnode.type.__asyncResolved && vnode.component.subTree.component) setRef(rawRef, oldRawRef, parentSuspense, vnode.component.subTree);
			return;
		}
		const refValue = vnode.shapeFlag & 4 ? getComponentPublicInstance(vnode.component) : vnode.el;
		const value = isUnmount ? null : refValue;
		const { i: owner, r: ref } = rawRef;
		const oldRef = oldRawRef && oldRawRef.r;
		const refs = owner.refs === EMPTY_OBJ ? owner.refs = {} : owner.refs;
		const setupState = owner.setupState;
		const rawSetupState = toRaw(setupState);
		const canSetSetupRef = setupState === EMPTY_OBJ ? NO : (key) => {
			if (isTemplateRefKey(refs, key)) return false;
			return hasOwn(rawSetupState, key);
		};
		const canSetRef = (ref2, key) => {
			if (key && isTemplateRefKey(refs, key)) return false;
			return true;
		};
		if (oldRef != null && oldRef !== ref) {
			invalidatePendingSetRef(oldRawRef);
			if (isString(oldRef)) {
				refs[oldRef] = null;
				if (canSetSetupRef(oldRef)) setupState[oldRef] = null;
			} else if (isRef(oldRef)) {
				const oldRawRefAtom = oldRawRef;
				if (canSetRef(oldRef, oldRawRefAtom.k)) oldRef.value = null;
				if (oldRawRefAtom.k) refs[oldRawRefAtom.k] = null;
			}
		}
		if (isFunction(ref)) callWithErrorHandling(ref, owner, 12, [value, refs]);
		else {
			const _isString = isString(ref);
			const _isRef = isRef(ref);
			if (_isString || _isRef) {
				const doSet = () => {
					if (rawRef.f) {
						const existing = _isString ? canSetSetupRef(ref) ? setupState[ref] : refs[ref] : canSetRef(ref) || !rawRef.k ? ref.value : refs[rawRef.k];
						if (isUnmount) isArray(existing) && remove(existing, refValue);
						else if (!isArray(existing)) {
							if (_isString) {
								refs[ref] = [refValue];
								if (canSetSetupRef(ref)) setupState[ref] = refs[ref];
							} else {
								const newVal = [refValue];
								if (canSetRef(ref, rawRef.k)) ref.value = newVal;
								if (rawRef.k) refs[rawRef.k] = newVal;
							}
						} else if (!existing.includes(refValue)) existing.push(refValue);
					} else if (_isString) {
						refs[ref] = value;
						if (canSetSetupRef(ref)) setupState[ref] = value;
					} else if (_isRef) {
						if (canSetRef(ref, rawRef.k)) ref.value = value;
						if (rawRef.k) refs[rawRef.k] = value;
					}
				};
				if (value) {
					const job = () => {
						doSet();
						pendingSetRefMap.delete(rawRef);
					};
					job.id = -1;
					pendingSetRefMap.set(rawRef, job);
					queuePostRenderEffect(job, parentSuspense);
				} else {
					invalidatePendingSetRef(rawRef);
					doSet();
				}
			}
		}
	}
	function invalidatePendingSetRef(rawRef) {
		const pendingSetRef = pendingSetRefMap.get(rawRef);
		if (pendingSetRef) {
			pendingSetRef.flags |= 8;
			pendingSetRefMap.delete(rawRef);
		}
	}
	getGlobalThis().requestIdleCallback;
	getGlobalThis().cancelIdleCallback;
	var isAsyncWrapper = (i) => !!i.type.__asyncLoader;
	var isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
	function onActivated(hook, target) {
		registerKeepAliveHook(hook, "a", target);
	}
	function onDeactivated(hook, target) {
		registerKeepAliveHook(hook, "da", target);
	}
	function registerKeepAliveHook(hook, type, target = currentInstance) {
		const wrappedHook = hook.__wdc || (hook.__wdc = () => {
			let current = target;
			while (current) {
				if (current.isDeactivated) return;
				current = current.parent;
			}
			return hook();
		});
		injectHook(type, wrappedHook, target);
		if (target) {
			let current = target.parent;
			while (current && current.parent) {
				if (isKeepAlive(current.parent.vnode)) injectToKeepAliveRoot(wrappedHook, type, target, current);
				current = current.parent;
			}
		}
	}
	function injectToKeepAliveRoot(hook, type, target, keepAliveRoot) {
		const injected = injectHook(type, hook, keepAliveRoot, true);
		onUnmounted(() => {
			remove(keepAliveRoot[type], injected);
		}, target);
	}
	function injectHook(type, hook, target = currentInstance, prepend = false) {
		if (target) {
			const hooks = target[type] || (target[type] = []);
			const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
				pauseTracking();
				const reset = setCurrentInstance(target);
				const res = callWithAsyncErrorHandling(hook, target, type, args);
				reset();
				resetTracking();
				return res;
			});
			if (prepend) hooks.unshift(wrappedHook);
			else hooks.push(wrappedHook);
			return wrappedHook;
		}
	}
	var createHook = (lifecycle) => (hook, target = currentInstance) => {
		if (!isInSSRComponentSetup || lifecycle === "sp") injectHook(lifecycle, (...args) => hook(...args), target);
	};
	var onBeforeMount = createHook("bm");
	var onMounted = createHook("m");
	var onBeforeUpdate = createHook("bu");
	var onUpdated = createHook("u");
	var onBeforeUnmount = createHook("bum");
	var onUnmounted = createHook("um");
	var onServerPrefetch = createHook("sp");
	var onRenderTriggered = createHook("rtg");
	var onRenderTracked = createHook("rtc");
	function onErrorCaptured(hook, target = currentInstance) {
		injectHook("ec", hook, target);
	}
	var NULL_DYNAMIC_COMPONENT = Symbol.for("v-ndc");
	function renderList(source, renderItem, cache, index) {
		let ret;
		const cached = cache && cache[index];
		const sourceIsArray = isArray(source);
		if (sourceIsArray || isString(source)) {
			const sourceIsReactiveArray = sourceIsArray && isReactive(source);
			let needsWrap = false;
			let isReadonlySource = false;
			if (sourceIsReactiveArray) {
				needsWrap = !isShallow(source);
				isReadonlySource = isReadonly(source);
				source = shallowReadArray(source);
			}
			ret = new Array(source.length);
			for (let i = 0, l = source.length; i < l; i++) ret[i] = renderItem(needsWrap ? isReadonlySource ? toReadonly(toReactive(source[i])) : toReactive(source[i]) : source[i], i, void 0, cached && cached[i]);
		} else if (typeof source === "number") {
			ret = new Array(source);
			for (let i = 0; i < source; i++) ret[i] = renderItem(i + 1, i, void 0, cached && cached[i]);
		} else if (isObject(source)) {
			if (source[Symbol.iterator]) ret = Array.from(source, (item, i) => renderItem(item, i, void 0, cached && cached[i]));
			else {
				const keys = Object.keys(source);
				ret = new Array(keys.length);
				for (let i = 0, l = keys.length; i < l; i++) {
					const key = keys[i];
					ret[i] = renderItem(source[key], key, i, cached && cached[i]);
				}
			}
		} else ret = [];
		if (cache) cache[index] = ret;
		return ret;
	}
	var getPublicInstance = (i) => {
		if (!i) return null;
		if (isStatefulComponent(i)) return getComponentPublicInstance(i);
		return getPublicInstance(i.parent);
	};
	var publicPropertiesMap = extend(Object.create(null), {
		$: (i) => i,
		$el: (i) => i.vnode.el,
		$data: (i) => i.data,
		$props: (i) => i.props,
		$attrs: (i) => i.attrs,
		$slots: (i) => i.slots,
		$refs: (i) => i.refs,
		$parent: (i) => getPublicInstance(i.parent),
		$root: (i) => getPublicInstance(i.root),
		$host: (i) => i.ce,
		$emit: (i) => i.emit,
		$options: (i) => resolveMergedOptions(i),
		$forceUpdate: (i) => i.f || (i.f = () => {
			queueJob(i.update);
		}),
		$nextTick: (i) => i.n || (i.n = nextTick.bind(i.proxy)),
		$watch: (i) => instanceWatch.bind(i)
	});
	var hasSetupBinding = (state, key) => state !== EMPTY_OBJ && !state.__isScriptSetup && hasOwn(state, key);
	var PublicInstanceProxyHandlers = {
		get({ _: instance }, key) {
			if (key === "__v_skip") return true;
			const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
			if (key[0] !== "$") {
				const n = accessCache[key];
				if (n !== void 0) switch (n) {
					case 1: return setupState[key];
					case 2: return data[key];
					case 4: return ctx[key];
					case 3: return props[key];
				}
				else if (hasSetupBinding(setupState, key)) {
					accessCache[key] = 1;
					return setupState[key];
				} else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
					accessCache[key] = 2;
					return data[key];
				} else if (hasOwn(props, key)) {
					accessCache[key] = 3;
					return props[key];
				} else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
					accessCache[key] = 4;
					return ctx[key];
				} else if (shouldCacheAccess) accessCache[key] = 0;
			}
			const publicGetter = publicPropertiesMap[key];
			let cssModule, globalProperties;
			if (publicGetter) {
				if (key === "$attrs") track(instance.attrs, "get", "");
				return publicGetter(instance);
			} else if ((cssModule = type.__cssModules) && (cssModule = cssModule[key])) return cssModule;
			else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
				accessCache[key] = 4;
				return ctx[key];
			} else if (globalProperties = appContext.config.globalProperties, hasOwn(globalProperties, key)) return globalProperties[key];
		},
		set({ _: instance }, key, value) {
			const { data, setupState, ctx } = instance;
			if (hasSetupBinding(setupState, key)) {
				setupState[key] = value;
				return true;
			} else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
				data[key] = value;
				return true;
			} else if (hasOwn(instance.props, key)) return false;
			if (key[0] === "$" && key.slice(1) in instance) return false;
			else ctx[key] = value;
			return true;
		},
		has({ _: { data, setupState, accessCache, ctx, appContext, props, type } }, key) {
			let cssModules;
			return !!(accessCache[key] || data !== EMPTY_OBJ && key[0] !== "$" && hasOwn(data, key) || hasSetupBinding(setupState, key) || hasOwn(props, key) || hasOwn(ctx, key) || hasOwn(publicPropertiesMap, key) || hasOwn(appContext.config.globalProperties, key) || (cssModules = type.__cssModules) && cssModules[key]);
		},
		defineProperty(target, key, descriptor) {
			if (descriptor.get != null) target._.accessCache[key] = 0;
			else if (hasOwn(descriptor, "value")) this.set(target, key, descriptor.value, null);
			return Reflect.defineProperty(target, key, descriptor);
		}
	};
	function normalizePropsOrEmits(props) {
		return isArray(props) ? props.reduce((normalized, p) => (normalized[p] = null, normalized), {}) : props;
	}
	var shouldCacheAccess = true;
	function applyOptions(instance) {
		const options = resolveMergedOptions(instance);
		const publicThis = instance.proxy;
		const ctx = instance.ctx;
		shouldCacheAccess = false;
		if (options.beforeCreate) callHook(options.beforeCreate, instance, "bc");
		const { data: dataOptions, computed: computedOptions, methods, watch: watchOptions, provide: provideOptions, inject: injectOptions, created, beforeMount, mounted, beforeUpdate, updated, activated, deactivated, beforeDestroy, beforeUnmount, destroyed, unmounted, render, renderTracked, renderTriggered, errorCaptured, serverPrefetch, expose, inheritAttrs, components, directives, filters } = options;
		const checkDuplicateProperties = null;
		if (injectOptions) resolveInjections(injectOptions, ctx, checkDuplicateProperties);
		if (methods) for (const key in methods) {
			const methodHandler = methods[key];
			if (isFunction(methodHandler)) ctx[key] = methodHandler.bind(publicThis);
		}
		if (dataOptions) {
			const data = dataOptions.call(publicThis, publicThis);
			if (!isObject(data)) {} else instance.data = reactive(data);
		}
		shouldCacheAccess = true;
		if (computedOptions) for (const key in computedOptions) {
			const opt = computedOptions[key];
			const c = computed({
				get: isFunction(opt) ? opt.bind(publicThis, publicThis) : isFunction(opt.get) ? opt.get.bind(publicThis, publicThis) : NOOP,
				set: !isFunction(opt) && isFunction(opt.set) ? opt.set.bind(publicThis) : NOOP
			});
			Object.defineProperty(ctx, key, {
				enumerable: true,
				configurable: true,
				get: () => c.value,
				set: (v) => c.value = v
			});
		}
		if (watchOptions) for (const key in watchOptions) createWatcher(watchOptions[key], ctx, publicThis, key);
		if (provideOptions) {
			const provides = isFunction(provideOptions) ? provideOptions.call(publicThis) : provideOptions;
			Reflect.ownKeys(provides).forEach((key) => {
				provide(key, provides[key]);
			});
		}
		if (created) callHook(created, instance, "c");
		function registerLifecycleHook(register, hook) {
			if (isArray(hook)) hook.forEach((_hook) => register(_hook.bind(publicThis)));
			else if (hook) register(hook.bind(publicThis));
		}
		registerLifecycleHook(onBeforeMount, beforeMount);
		registerLifecycleHook(onMounted, mounted);
		registerLifecycleHook(onBeforeUpdate, beforeUpdate);
		registerLifecycleHook(onUpdated, updated);
		registerLifecycleHook(onActivated, activated);
		registerLifecycleHook(onDeactivated, deactivated);
		registerLifecycleHook(onErrorCaptured, errorCaptured);
		registerLifecycleHook(onRenderTracked, renderTracked);
		registerLifecycleHook(onRenderTriggered, renderTriggered);
		registerLifecycleHook(onBeforeUnmount, beforeUnmount);
		registerLifecycleHook(onUnmounted, unmounted);
		registerLifecycleHook(onServerPrefetch, serverPrefetch);
		if (isArray(expose)) {
			if (expose.length) {
				const exposed = instance.exposed || (instance.exposed = {});
				expose.forEach((key) => {
					Object.defineProperty(exposed, key, {
						get: () => publicThis[key],
						set: (val) => publicThis[key] = val,
						enumerable: true
					});
				});
			} else if (!instance.exposed) instance.exposed = {};
		}
		if (render && instance.render === NOOP) instance.render = render;
		if (inheritAttrs != null) instance.inheritAttrs = inheritAttrs;
		if (components) instance.components = components;
		if (directives) instance.directives = directives;
		if (serverPrefetch) markAsyncBoundary(instance);
	}
	function resolveInjections(injectOptions, ctx, checkDuplicateProperties = NOOP) {
		if (isArray(injectOptions)) injectOptions = normalizeInject(injectOptions);
		for (const key in injectOptions) {
			const opt = injectOptions[key];
			let injected;
			if (isObject(opt)) {
				if ("default" in opt) injected = inject(opt.from || key, opt.default, true);
				else injected = inject(opt.from || key);
			} else injected = inject(opt);
			if (isRef(injected)) Object.defineProperty(ctx, key, {
				enumerable: true,
				configurable: true,
				get: () => injected.value,
				set: (v) => injected.value = v
			});
			else ctx[key] = injected;
		}
	}
	function callHook(hook, instance, type) {
		callWithAsyncErrorHandling(isArray(hook) ? hook.map((h) => h.bind(instance.proxy)) : hook.bind(instance.proxy), instance, type);
	}
	function createWatcher(raw, ctx, publicThis, key) {
		let getter = key.includes(".") ? createPathGetter(publicThis, key) : () => publicThis[key];
		if (isString(raw)) {
			const handler = ctx[raw];
			if (isFunction(handler)) watch(getter, handler);
		} else if (isFunction(raw)) watch(getter, raw.bind(publicThis));
		else if (isObject(raw)) {
			if (isArray(raw)) raw.forEach((r) => createWatcher(r, ctx, publicThis, key));
			else {
				const handler = isFunction(raw.handler) ? raw.handler.bind(publicThis) : ctx[raw.handler];
				if (isFunction(handler)) watch(getter, handler, raw);
			}
		}
	}
	function resolveMergedOptions(instance) {
		const base = instance.type;
		const { mixins, extends: extendsOptions } = base;
		const { mixins: globalMixins, optionsCache: cache, config: { optionMergeStrategies } } = instance.appContext;
		const cached = cache.get(base);
		let resolved;
		if (cached) resolved = cached;
		else if (!globalMixins.length && !mixins && !extendsOptions) resolved = base;
		else {
			resolved = {};
			if (globalMixins.length) globalMixins.forEach((m) => mergeOptions(resolved, m, optionMergeStrategies, true));
			mergeOptions(resolved, base, optionMergeStrategies);
		}
		if (isObject(base)) cache.set(base, resolved);
		return resolved;
	}
	function mergeOptions(to, from, strats, asMixin = false) {
		const { mixins, extends: extendsOptions } = from;
		if (extendsOptions) mergeOptions(to, extendsOptions, strats, true);
		if (mixins) mixins.forEach((m) => mergeOptions(to, m, strats, true));
		for (const key in from) if (asMixin && key === "expose") {} else {
			const strat = internalOptionMergeStrats[key] || strats && strats[key];
			to[key] = strat ? strat(to[key], from[key]) : from[key];
		}
		return to;
	}
	var internalOptionMergeStrats = {
		data: mergeDataFn,
		props: mergeEmitsOrPropsOptions,
		emits: mergeEmitsOrPropsOptions,
		methods: mergeObjectOptions,
		computed: mergeObjectOptions,
		beforeCreate: mergeAsArray,
		created: mergeAsArray,
		beforeMount: mergeAsArray,
		mounted: mergeAsArray,
		beforeUpdate: mergeAsArray,
		updated: mergeAsArray,
		beforeDestroy: mergeAsArray,
		beforeUnmount: mergeAsArray,
		destroyed: mergeAsArray,
		unmounted: mergeAsArray,
		activated: mergeAsArray,
		deactivated: mergeAsArray,
		errorCaptured: mergeAsArray,
		serverPrefetch: mergeAsArray,
		components: mergeObjectOptions,
		directives: mergeObjectOptions,
		watch: mergeWatchOptions,
		provide: mergeDataFn,
		inject: mergeInject
	};
	function mergeDataFn(to, from) {
		if (!from) return to;
		if (!to) return from;
		return function mergedDataFn() {
			return extend(isFunction(to) ? to.call(this, this) : to, isFunction(from) ? from.call(this, this) : from);
		};
	}
	function mergeInject(to, from) {
		return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
	}
	function normalizeInject(raw) {
		if (isArray(raw)) {
			const res = {};
			for (let i = 0; i < raw.length; i++) res[raw[i]] = raw[i];
			return res;
		}
		return raw;
	}
	function mergeAsArray(to, from) {
		return to ? [...new Set([].concat(to, from))] : from;
	}
	function mergeObjectOptions(to, from) {
		return to ? extend(Object.create(null), to, from) : from;
	}
	function mergeEmitsOrPropsOptions(to, from) {
		if (to) {
			if (isArray(to) && isArray(from)) return [...new Set([...to, ...from])];
			return extend(Object.create(null), normalizePropsOrEmits(to), normalizePropsOrEmits(from != null ? from : {}));
		} else return from;
	}
	function mergeWatchOptions(to, from) {
		if (!to) return from;
		if (!from) return to;
		const merged = extend(Object.create(null), to);
		for (const key in from) merged[key] = mergeAsArray(to[key], from[key]);
		return merged;
	}
	function createAppContext() {
		return {
			app: null,
			config: {
				isNativeTag: NO,
				performance: false,
				globalProperties: {},
				optionMergeStrategies: {},
				errorHandler: void 0,
				warnHandler: void 0,
				compilerOptions: {}
			},
			mixins: [],
			components: {},
			directives: {},
			provides: Object.create(null),
			optionsCache: new WeakMap(),
			propsCache: new WeakMap(),
			emitsCache: new WeakMap()
		};
	}
	var uid$1 = 0;
	function createAppAPI(render, hydrate) {
		return function createApp(rootComponent, rootProps = null) {
			if (!isFunction(rootComponent)) rootComponent = extend({}, rootComponent);
			if (rootProps != null && !isObject(rootProps)) rootProps = null;
			const context = createAppContext();
			const installedPlugins = new WeakSet();
			const pluginCleanupFns = [];
			let isMounted = false;
			const app = context.app = {
				_uid: uid$1++,
				_component: rootComponent,
				_props: rootProps,
				_container: null,
				_context: context,
				_instance: null,
				version,
				get config() {
					return context.config;
				},
				set config(v) {},
				use(plugin, ...options) {
					if (installedPlugins.has(plugin)) {} else if (plugin && isFunction(plugin.install)) {
						installedPlugins.add(plugin);
						plugin.install(app, ...options);
					} else if (isFunction(plugin)) {
						installedPlugins.add(plugin);
						plugin(app, ...options);
					}
					return app;
				},
				mixin(mixin) {
					if (!context.mixins.includes(mixin)) context.mixins.push(mixin);
					return app;
				},
				component(name, component) {
					if (!component) return context.components[name];
					context.components[name] = component;
					return app;
				},
				directive(name, directive) {
					if (!directive) return context.directives[name];
					context.directives[name] = directive;
					return app;
				},
				mount(rootContainer, isHydrate, namespace) {
					if (!isMounted) {
						const vnode = app._ceVNode || createVNode(rootComponent, rootProps);
						vnode.appContext = context;
						if (namespace === true) namespace = "svg";
						else if (namespace === false) namespace = void 0;
						if (isHydrate && hydrate) hydrate(vnode, rootContainer);
						else render(vnode, rootContainer, namespace);
						isMounted = true;
						app._container = rootContainer;
						rootContainer.__vue_app__ = app;
						return getComponentPublicInstance(vnode.component);
					}
				},
				onUnmount(cleanupFn) {
					pluginCleanupFns.push(cleanupFn);
				},
				unmount() {
					if (isMounted) {
						callWithAsyncErrorHandling(pluginCleanupFns, app._instance, 16);
						render(null, app._container);
						delete app._container.__vue_app__;
					}
				},
				provide(key, value) {
					context.provides[key] = value;
					return app;
				},
				runWithContext(fn) {
					const lastApp = currentApp;
					currentApp = app;
					try {
						return fn();
					} finally {
						currentApp = lastApp;
					}
				}
			};
			return app;
		};
	}
	var currentApp = null;
	var getModelModifiers = (props, modelName) => {
		return modelName === "modelValue" || modelName === "model-value" ? props.modelModifiers : props[`${modelName}Modifiers`] || props[`${camelize(modelName)}Modifiers`] || props[`${hyphenate(modelName)}Modifiers`];
	};
	function emit(instance, event, ...rawArgs) {
		if (instance.isUnmounted) return;
		const props = instance.vnode.props || EMPTY_OBJ;
		let args = rawArgs;
		const isModelListener = event.startsWith("update:");
		const modifiers = isModelListener && getModelModifiers(props, event.slice(7));
		if (modifiers) {
			if (modifiers.trim) args = rawArgs.map((a) => isString(a) ? a.trim() : a);
			if (modifiers.number) args = args.map(looseToNumber);
		}
		let handlerName;
		let handler = props[handlerName = toHandlerKey(event)] || props[handlerName = toHandlerKey(camelize(event))];
		if (!handler && isModelListener) handler = props[handlerName = toHandlerKey(hyphenate(event))];
		if (handler) callWithAsyncErrorHandling(handler, instance, 6, args);
		const onceHandler = props[handlerName + `Once`];
		if (onceHandler) {
			if (!instance.emitted) instance.emitted = {};
			else if (instance.emitted[handlerName]) return;
			instance.emitted[handlerName] = true;
			callWithAsyncErrorHandling(onceHandler, instance, 6, args);
		}
	}
	var mixinEmitsCache = new WeakMap();
	function normalizeEmitsOptions(comp, appContext, asMixin = false) {
		const cache = asMixin ? mixinEmitsCache : appContext.emitsCache;
		const cached = cache.get(comp);
		if (cached !== void 0) return cached;
		const raw = comp.emits;
		let normalized = {};
		let hasExtends = false;
		if (!isFunction(comp)) {
			const extendEmits = (raw2) => {
				const normalizedFromExtend = normalizeEmitsOptions(raw2, appContext, true);
				if (normalizedFromExtend) {
					hasExtends = true;
					extend(normalized, normalizedFromExtend);
				}
			};
			if (!asMixin && appContext.mixins.length) appContext.mixins.forEach(extendEmits);
			if (comp.extends) extendEmits(comp.extends);
			if (comp.mixins) comp.mixins.forEach(extendEmits);
		}
		if (!raw && !hasExtends) {
			if (isObject(comp)) cache.set(comp, null);
			return null;
		}
		if (isArray(raw)) raw.forEach((key) => normalized[key] = null);
		else extend(normalized, raw);
		if (isObject(comp)) cache.set(comp, normalized);
		return normalized;
	}
	function isEmitListener(options, key) {
		if (!options || !isOn(key)) return false;
		key = key.slice(2);
		key = key === "Once" ? key : key.replace(/Once$/, "");
		return hasOwn(options, key[0].toLowerCase() + key.slice(1)) || hasOwn(options, hyphenate(key)) || hasOwn(options, key);
	}
	function renderComponentRoot(instance) {
		const { type: Component, vnode, proxy, withProxy, propsOptions: [propsOptions], slots, attrs, emit, render, renderCache, props, data, setupState, ctx, inheritAttrs } = instance;
		const prev = setCurrentRenderingInstance(instance);
		let result;
		let fallthroughAttrs;
		try {
			if (vnode.shapeFlag & 4) {
				const proxyToUse = withProxy || proxy;
				const thisProxy = proxyToUse;
				result = normalizeVNode(render.call(thisProxy, proxyToUse, renderCache, props, setupState, data, ctx));
				fallthroughAttrs = attrs;
			} else {
				const render2 = Component;
				result = normalizeVNode(render2.length > 1 ? render2(props, {
					attrs,
					slots,
					emit
				}) : render2(props, null));
				fallthroughAttrs = Component.props ? attrs : getFunctionalFallthrough(attrs);
			}
		} catch (err) {
			blockStack.length = 0;
			handleError(err, instance, 1);
			result = createVNode(Comment);
		}
		let root = result;
		if (fallthroughAttrs && inheritAttrs !== false) {
			const keys = Object.keys(fallthroughAttrs);
			const { shapeFlag } = root;
			if (keys.length) {
				if (shapeFlag & 7) {
					if (propsOptions && keys.some(isModelListener)) fallthroughAttrs = filterModelListeners(fallthroughAttrs, propsOptions);
					root = cloneVNode(root, fallthroughAttrs, false, true);
				}
			}
		}
		if (vnode.dirs) {
			root = cloneVNode(root, null, false, true);
			root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs;
		}
		if (vnode.transition) setTransitionHooks(isTeleport(root.type) ? getInnerChild$1(root) || root : root, vnode.transition);
		result = root;
		setCurrentRenderingInstance(prev);
		return result;
	}
	var getFunctionalFallthrough = (attrs) => {
		let res;
		for (const key in attrs) if (key === "class" || key === "style" || isOn(key)) (res || (res = {}))[key] = attrs[key];
		return res;
	};
	var filterModelListeners = (attrs, props) => {
		const res = {};
		for (const key in attrs) if (!isModelListener(key) || !(key.slice(9) in props)) res[key] = attrs[key];
		return res;
	};
	function shouldUpdateComponent(prevVNode, nextVNode, optimized) {
		const { props: prevProps, children: prevChildren, component } = prevVNode;
		const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
		const emits = component.emitsOptions;
		if (nextVNode.dirs || nextVNode.transition) return true;
		if (optimized && patchFlag >= 0) {
			if (patchFlag & 1024) return true;
			if (patchFlag & 16) {
				if (!prevProps) return !!nextProps;
				return hasPropsChanged(prevProps, nextProps, emits);
			} else if (patchFlag & 8) {
				const dynamicProps = nextVNode.dynamicProps;
				for (let i = 0; i < dynamicProps.length; i++) {
					const key = dynamicProps[i];
					if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emits, key)) return true;
				}
			}
		} else {
			if (prevChildren || nextChildren) {
				if (!nextChildren || !nextChildren.$stable) return true;
			}
			if (prevProps === nextProps) return false;
			if (!prevProps) return !!nextProps;
			if (!nextProps) return true;
			return hasPropsChanged(prevProps, nextProps, emits);
		}
		return false;
	}
	function hasPropsChanged(prevProps, nextProps, emitsOptions) {
		const nextKeys = Object.keys(nextProps);
		if (nextKeys.length !== Object.keys(prevProps).length) return true;
		for (let i = 0; i < nextKeys.length; i++) {
			const key = nextKeys[i];
			if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emitsOptions, key)) return true;
		}
		return false;
	}
	function hasPropValueChanged(nextProps, prevProps, key) {
		const nextProp = nextProps[key];
		const prevProp = prevProps[key];
		if (key === "style" && isObject(nextProp) && isObject(prevProp)) return !looseEqual(nextProp, prevProp);
		return nextProp !== prevProp;
	}
	function updateHOCHostEl({ vnode, parent, suspense }, el) {
		while (parent) {
			const root = parent.subTree;
			if (root.suspense && root.suspense.activeBranch === vnode) {
				root.suspense.vnode.el = root.el = el;
				vnode = root;
			}
			if (root === vnode) {
				(vnode = parent.vnode).el = el;
				parent = parent.parent;
			} else break;
		}
		if (suspense && suspense.activeBranch === vnode) suspense.vnode.el = el;
	}
	var internalObjectProto = {};
	var createInternalObject = () => Object.create(internalObjectProto);
	var isInternalObject = (obj) => Object.getPrototypeOf(obj) === internalObjectProto;
	function initProps(instance, rawProps, isStateful, isSSR = false) {
		const props = {};
		const attrs = createInternalObject();
		instance.propsDefaults = Object.create(null);
		setFullProps(instance, rawProps, props, attrs);
		for (const key in instance.propsOptions[0]) if (!(key in props)) props[key] = void 0;
		if (isStateful) instance.props = isSSR ? props : shallowReactive(props);
		else if (!instance.type.props) instance.props = attrs;
		else instance.props = props;
		instance.attrs = attrs;
	}
	function updateProps(instance, rawProps, rawPrevProps, optimized) {
		const { props, attrs, vnode: { patchFlag } } = instance;
		const rawCurrentProps = toRaw(props);
		const [options] = instance.propsOptions;
		let hasAttrsChanged = false;
		if ((optimized || patchFlag > 0) && !(patchFlag & 16)) {
			if (patchFlag & 8) {
				const propsToUpdate = instance.vnode.dynamicProps;
				for (let i = 0; i < propsToUpdate.length; i++) {
					let key = propsToUpdate[i];
					if (isEmitListener(instance.emitsOptions, key)) continue;
					const value = rawProps[key];
					if (options) {
						if (hasOwn(attrs, key)) {
							if (value !== attrs[key]) {
								attrs[key] = value;
								hasAttrsChanged = true;
							}
						} else {
							const camelizedKey = camelize(key);
							props[camelizedKey] = resolvePropValue(options, rawCurrentProps, camelizedKey, value, instance, false);
						}
					} else if (value !== attrs[key]) {
						attrs[key] = value;
						hasAttrsChanged = true;
					}
				}
			}
		} else {
			if (setFullProps(instance, rawProps, props, attrs)) hasAttrsChanged = true;
			let kebabKey;
			for (const key in rawCurrentProps) if (!rawProps || !hasOwn(rawProps, key) && ((kebabKey = hyphenate(key)) === key || !hasOwn(rawProps, kebabKey))) {
				if (options) {
					if (rawPrevProps && (rawPrevProps[key] !== void 0 || rawPrevProps[kebabKey] !== void 0)) props[key] = resolvePropValue(options, rawCurrentProps, key, void 0, instance, true);
				} else delete props[key];
			}
			if (attrs !== rawCurrentProps) {
				for (const key in attrs) if (!rawProps || !hasOwn(rawProps, key) && true) {
					delete attrs[key];
					hasAttrsChanged = true;
				}
			}
		}
		if (hasAttrsChanged) trigger$1(instance.attrs, "set", "");
	}
	function setFullProps(instance, rawProps, props, attrs) {
		const [options, needCastKeys] = instance.propsOptions;
		let hasAttrsChanged = false;
		let rawCastValues;
		if (rawProps) for (let key in rawProps) {
			if (isReservedProp(key)) continue;
			const value = rawProps[key];
			let camelKey;
			if (options && hasOwn(options, camelKey = camelize(key))) {
				if (!needCastKeys || !needCastKeys.includes(camelKey)) props[camelKey] = value;
				else (rawCastValues || (rawCastValues = {}))[camelKey] = value;
			} else if (!isEmitListener(instance.emitsOptions, key)) {
				if (!(key in attrs) || value !== attrs[key]) {
					attrs[key] = value;
					hasAttrsChanged = true;
				}
			}
		}
		if (needCastKeys) {
			const rawCurrentProps = toRaw(props);
			const castValues = rawCastValues || EMPTY_OBJ;
			for (let i = 0; i < needCastKeys.length; i++) {
				const key = needCastKeys[i];
				props[key] = resolvePropValue(options, rawCurrentProps, key, castValues[key], instance, !hasOwn(castValues, key));
			}
		}
		return hasAttrsChanged;
	}
	function resolvePropValue(options, props, key, value, instance, isAbsent) {
		const opt = options[key];
		if (opt != null) {
			const hasDefault = hasOwn(opt, "default");
			if (hasDefault && value === void 0) {
				const defaultValue = opt.default;
				if (opt.type !== Function && !opt.skipFactory && isFunction(defaultValue)) {
					const { propsDefaults } = instance;
					if (key in propsDefaults) value = propsDefaults[key];
					else {
						const reset = setCurrentInstance(instance);
						value = propsDefaults[key] = defaultValue.call(null, props);
						reset();
					}
				} else value = defaultValue;
				if (instance.ce) instance.ce._setProp(key, value);
			}
			if (opt[0]) {
				if (isAbsent && !hasDefault) value = false;
				else if (opt[1] && (value === "" || value === hyphenate(key))) value = true;
			}
		}
		return value;
	}
	var mixinPropsCache = new WeakMap();
	function normalizePropsOptions(comp, appContext, asMixin = false) {
		const cache = asMixin ? mixinPropsCache : appContext.propsCache;
		const cached = cache.get(comp);
		if (cached) return cached;
		const raw = comp.props;
		const normalized = {};
		const needCastKeys = [];
		let hasExtends = false;
		if (!isFunction(comp)) {
			const extendProps = (raw2) => {
				hasExtends = true;
				const [props, keys] = normalizePropsOptions(raw2, appContext, true);
				extend(normalized, props);
				if (keys) needCastKeys.push(...keys);
			};
			if (!asMixin && appContext.mixins.length) appContext.mixins.forEach(extendProps);
			if (comp.extends) extendProps(comp.extends);
			if (comp.mixins) comp.mixins.forEach(extendProps);
		}
		if (!raw && !hasExtends) {
			if (isObject(comp)) cache.set(comp, EMPTY_ARR);
			return EMPTY_ARR;
		}
		if (isArray(raw)) for (let i = 0; i < raw.length; i++) {
			const normalizedKey = camelize(raw[i]);
			if (validatePropName(normalizedKey)) normalized[normalizedKey] = EMPTY_OBJ;
		}
		else if (raw) for (const key in raw) {
			const normalizedKey = camelize(key);
			if (validatePropName(normalizedKey)) {
				const opt = raw[key];
				const prop = normalized[normalizedKey] = isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt);
				const propType = prop.type;
				let shouldCast = false;
				let shouldCastTrue = true;
				if (isArray(propType)) for (let index = 0; index < propType.length; ++index) {
					const type = propType[index];
					const typeName = isFunction(type) && type.name;
					if (typeName === "Boolean") {
						shouldCast = true;
						break;
					} else if (typeName === "String") shouldCastTrue = false;
				}
				else shouldCast = isFunction(propType) && propType.name === "Boolean";
				prop[0] = shouldCast;
				prop[1] = shouldCastTrue;
				if (shouldCast || hasOwn(prop, "default")) needCastKeys.push(normalizedKey);
			}
		}
		const res = [normalized, needCastKeys];
		if (isObject(comp)) cache.set(comp, res);
		return res;
	}
	function validatePropName(key) {
		if (key[0] !== "$" && !isReservedProp(key)) return true;
		return false;
	}
	var isInternalKey = (key) => key === "_" || key === "_ctx" || key === "$stable";
	var normalizeSlotValue = (value) => isArray(value) ? value.map(normalizeVNode) : [normalizeVNode(value)];
	var normalizeSlot = (key, rawSlot, ctx) => {
		if (rawSlot._n) return rawSlot;
		const normalized = withCtx((...args) => {
			return normalizeSlotValue(rawSlot(...args));
		}, ctx);
		normalized._c = false;
		return normalized;
	};
	var normalizeObjectSlots = (rawSlots, slots, instance) => {
		const ctx = rawSlots._ctx;
		for (const key in rawSlots) {
			if (isInternalKey(key)) continue;
			const value = rawSlots[key];
			if (isFunction(value)) slots[key] = normalizeSlot(key, value, ctx);
			else if (value != null) {
				const normalized = normalizeSlotValue(value);
				slots[key] = () => normalized;
			}
		}
	};
	var normalizeVNodeSlots = (instance, children) => {
		const normalized = normalizeSlotValue(children);
		instance.slots.default = () => normalized;
	};
	var assignSlots = (slots, children, optimized) => {
		for (const key in children) if (optimized || !isInternalKey(key)) slots[key] = children[key];
	};
	var initSlots = (instance, children, optimized) => {
		const slots = instance.slots = createInternalObject();
		if (instance.vnode.shapeFlag & 32) {
			const type = children._;
			if (type) {
				assignSlots(slots, children, optimized);
				if (optimized) def(slots, "_", type, true);
			} else normalizeObjectSlots(children, slots);
		} else if (children) normalizeVNodeSlots(instance, children);
	};
	var updateSlots = (instance, children, optimized) => {
		const { vnode, slots } = instance;
		let needDeletionCheck = true;
		let deletionComparisonTarget = EMPTY_OBJ;
		if (vnode.shapeFlag & 32) {
			const type = children._;
			if (type) {
				if (optimized && type === 1) needDeletionCheck = false;
				else assignSlots(slots, children, optimized);
			} else {
				needDeletionCheck = !children.$stable;
				normalizeObjectSlots(children, slots);
			}
			deletionComparisonTarget = children;
		} else if (children) {
			normalizeVNodeSlots(instance, children);
			deletionComparisonTarget = { default: 1 };
		}
		if (needDeletionCheck) {
			for (const key in slots) if (!isInternalKey(key) && deletionComparisonTarget[key] == null) delete slots[key];
		}
	};
	var queuePostRenderEffect = queueEffectWithSuspense;
	function createRenderer(options) {
		return baseCreateRenderer(options);
	}
	function baseCreateRenderer(options, createHydrationFns) {
		const target = getGlobalThis();
		target.__VUE__ = true;
		const { insert: hostInsert, remove: hostRemove, patchProp: hostPatchProp, createElement: hostCreateElement, createText: hostCreateText, createComment: hostCreateComment, setText: hostSetText, setElementText: hostSetElementText, parentNode: hostParentNode, nextSibling: hostNextSibling, setScopeId: hostSetScopeId = NOOP, insertStaticContent: hostInsertStaticContent } = options;
		const patch = (n1, n2, container, anchor = null, parentComponent = null, parentSuspense = null, namespace = void 0, slotScopeIds = null, optimized = !!n2.dynamicChildren) => {
			if (n1 === n2) return;
			if (n1 && !isSameVNodeType(n1, n2)) {
				anchor = getNextHostNode(n1);
				unmount(n1, parentComponent, parentSuspense, true);
				n1 = null;
			}
			if (n2.patchFlag === -2) {
				optimized = false;
				n2.dynamicChildren = null;
			}
			if (n2.dynamicChildren && n1 && n1.dynamicChildren && n1.dynamicChildren.hasOnce) {
				if (n2.dynamicChildren === EMPTY_ARR) n2.dynamicChildren = [];
				n2.dynamicChildren.hasOnce = true;
			}
			const { type, ref, shapeFlag } = n2;
			switch (type) {
				case Text:
					processText(n1, n2, container, anchor);
					break;
				case Comment:
					processCommentNode(n1, n2, container, anchor);
					break;
				case Static:
					if (n1 == null) mountStaticNode(n2, container, anchor, namespace);
					break;
				case Fragment:
					processFragment(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					break;
				default: if (shapeFlag & 1) processElement(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else if (shapeFlag & 6) processComponent(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else if (shapeFlag & 64) type.process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, internals);
				else if (shapeFlag & 128) type.process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, internals);
			}
			if (ref != null && parentComponent) setRef(ref, n1 && n1.ref, parentSuspense, n2 || n1, !n2);
			else if (ref == null && n1 && n1.ref != null) setRef(n1.ref, null, parentSuspense, n1, true);
		};
		const processText = (n1, n2, container, anchor) => {
			if (n1 == null) hostInsert(n2.el = hostCreateText(n2.children), container, anchor);
			else {
				const el = n2.el = n1.el;
				if (n2.children !== n1.children) hostSetText(el, n2.children);
			}
		};
		const processCommentNode = (n1, n2, container, anchor) => {
			if (n1 == null) hostInsert(n2.el = hostCreateComment(n2.children || ""), container, anchor);
			else n2.el = n1.el;
		};
		const mountStaticNode = (n2, container, anchor, namespace) => {
			[n2.el, n2.anchor] = hostInsertStaticContent(n2.children, container, anchor, namespace, n2.el, n2.anchor);
		};
		const moveStaticNode = ({ el, anchor }, container, nextSibling) => {
			let next;
			while (el && el !== anchor) {
				next = hostNextSibling(el);
				hostInsert(el, container, nextSibling);
				el = next;
			}
			hostInsert(anchor, container, nextSibling);
		};
		const removeStaticNode = ({ el, anchor }) => {
			let next;
			while (el && el !== anchor) {
				next = hostNextSibling(el);
				hostRemove(el);
				el = next;
			}
			hostRemove(anchor);
		};
		const processElement = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			if (n2.type === "svg") namespace = "svg";
			else if (n2.type === "math") namespace = "mathml";
			if (n1 == null) mountElement(n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			else {
				const customElement = n1.el && n1.el._isVueCE ? n1.el : null;
				try {
					if (customElement) customElement._beginPatch();
					patchElement(n1, n2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				} finally {
					if (customElement) customElement._endPatch();
				}
			}
		};
		const mountElement = (vnode, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			let el;
			let vnodeHook;
			const { props, shapeFlag, transition, dirs } = vnode;
			el = vnode.el = hostCreateElement(vnode.type, namespace, props && props.is, props);
			if (shapeFlag & 8) hostSetElementText(el, vnode.children);
			else if (shapeFlag & 16) mountChildren(vnode.children, el, null, parentComponent, parentSuspense, resolveChildrenNamespace(vnode, namespace), slotScopeIds, optimized);
			if (dirs) invokeDirectiveHook(vnode, null, parentComponent, "created");
			setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent);
			if (props) {
				for (const key in props) if (key !== "value" && !isReservedProp(key)) hostPatchProp(el, key, null, props[key], namespace, parentComponent);
				if ("value" in props) hostPatchProp(el, "value", null, props.value, namespace);
				if (vnodeHook = props.onVnodeBeforeMount) invokeVNodeHook(vnodeHook, parentComponent, vnode);
			}
			if (dirs) invokeDirectiveHook(vnode, null, parentComponent, "beforeMount");
			const needCallTransitionHooks = needTransition(parentSuspense, transition);
			if (needCallTransitionHooks) transition.beforeEnter(el);
			hostInsert(el, container, anchor);
			if ((vnodeHook = props && props.onVnodeMounted) || needCallTransitionHooks || dirs) queuePostRenderEffect(() => {
				try {
					vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
					needCallTransitionHooks && transition.enter(el);
					dirs && invokeDirectiveHook(vnode, null, parentComponent, "mounted");
				} finally {}
			}, parentSuspense);
		};
		const setScopeId = (el, vnode, scopeId, slotScopeIds, parentComponent) => {
			if (scopeId) hostSetScopeId(el, scopeId);
			if (slotScopeIds) for (let i = 0; i < slotScopeIds.length; i++) hostSetScopeId(el, slotScopeIds[i]);
			if (parentComponent) {
				let subTree = parentComponent.subTree;
				if (vnode === subTree || isSuspense(subTree.type) && (subTree.ssContent === vnode || subTree.ssFallback === vnode)) {
					const parentVNode = parentComponent.vnode;
					setScopeId(el, parentVNode, parentVNode.scopeId, parentVNode.slotScopeIds, parentComponent.parent);
				}
			}
		};
		const mountChildren = (children, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, start = 0) => {
			for (let i = start; i < children.length; i++) {
				const child = children[i] = optimized ? cloneIfMounted(children[i]) : normalizeVNode(children[i]);
				patch(null, child, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			}
		};
		const patchElement = (n1, n2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			const el = n2.el = n1.el;
			let { patchFlag, dynamicChildren, dirs } = n2;
			patchFlag |= n1.patchFlag & 16;
			const oldProps = n1.props || EMPTY_OBJ;
			const newProps = n2.props || EMPTY_OBJ;
			let vnodeHook;
			parentComponent && toggleRecurse(parentComponent, false);
			if (vnodeHook = newProps.onVnodeBeforeUpdate) invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
			if (dirs) invokeDirectiveHook(n2, n1, parentComponent, "beforeUpdate");
			parentComponent && toggleRecurse(parentComponent, true);
			if (dynamicChildren && (!n1.dynamicChildren || n1.dynamicChildren.length !== dynamicChildren.length)) {
				patchFlag = 0;
				optimized = false;
				dynamicChildren = null;
			}
			if (oldProps.innerHTML && newProps.innerHTML == null || oldProps.textContent && newProps.textContent == null) hostSetElementText(el, "");
			if (dynamicChildren) patchBlockChildren(n1.dynamicChildren, dynamicChildren, el, parentComponent, parentSuspense, resolveChildrenNamespace(n2, namespace), slotScopeIds);
			else if (!optimized) patchChildren(n1, n2, el, null, parentComponent, parentSuspense, resolveChildrenNamespace(n2, namespace), slotScopeIds, false);
			if (patchFlag > 0) {
				if (patchFlag & 16) patchProps(el, oldProps, newProps, parentComponent, namespace);
				else {
					if (patchFlag & 2) {
						if (oldProps.class !== newProps.class) hostPatchProp(el, "class", null, newProps.class, namespace);
					}
					if (patchFlag & 4) hostPatchProp(el, "style", oldProps.style, newProps.style, namespace);
					if (patchFlag & 8) {
						const propsToUpdate = n2.dynamicProps;
						for (let i = 0; i < propsToUpdate.length; i++) {
							const key = propsToUpdate[i];
							const prev = oldProps[key];
							const next = newProps[key];
							if (next !== prev || key === "value") hostPatchProp(el, key, prev, next, namespace, parentComponent);
						}
					}
				}
				if (patchFlag & 1) {
					if (n1.children !== n2.children) hostSetElementText(el, n2.children);
				}
			} else if (!optimized && dynamicChildren == null) patchProps(el, oldProps, newProps, parentComponent, namespace);
			if ((vnodeHook = newProps.onVnodeUpdated) || dirs) queuePostRenderEffect(() => {
				vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
				dirs && invokeDirectiveHook(n2, n1, parentComponent, "updated");
			}, parentSuspense);
		};
		const patchBlockChildren = (oldChildren, newChildren, fallbackContainer, parentComponent, parentSuspense, namespace, slotScopeIds) => {
			for (let i = 0; i < newChildren.length; i++) {
				const oldVNode = oldChildren[i];
				const newVNode = newChildren[i];
				const container = oldVNode.el && (oldVNode.type === Fragment || !isSameVNodeType(oldVNode, newVNode) || oldVNode.shapeFlag & 198) ? hostParentNode(oldVNode.el) : fallbackContainer;
				patch(oldVNode, newVNode, container, null, parentComponent, parentSuspense, namespace, slotScopeIds, true);
			}
		};
		const patchProps = (el, oldProps, newProps, parentComponent, namespace) => {
			if (oldProps !== newProps) {
				if (oldProps !== EMPTY_OBJ) {
					for (const key in oldProps) if (!isReservedProp(key) && !(key in newProps)) hostPatchProp(el, key, oldProps[key], null, namespace, parentComponent);
				}
				for (const key in newProps) {
					if (isReservedProp(key)) continue;
					const next = newProps[key];
					const prev = oldProps[key];
					if (next !== prev && key !== "value") hostPatchProp(el, key, prev, next, namespace, parentComponent);
				}
				if ("value" in newProps) hostPatchProp(el, "value", oldProps.value, newProps.value, namespace);
			}
		};
		const processFragment = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			const fragmentStartAnchor = n2.el = n1 ? n1.el : hostCreateText("");
			const fragmentEndAnchor = n2.anchor = n1 ? n1.anchor : hostCreateText("");
			let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2;
			if (fragmentSlotScopeIds) slotScopeIds = slotScopeIds ? slotScopeIds.concat(fragmentSlotScopeIds) : fragmentSlotScopeIds;
			if (n1 == null) {
				hostInsert(fragmentStartAnchor, container, anchor);
				hostInsert(fragmentEndAnchor, container, anchor);
				mountChildren(n2.children || [], container, fragmentEndAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			} else if (patchFlag > 0 && patchFlag & 64 && dynamicChildren && n1.dynamicChildren && n1.dynamicChildren.length === dynamicChildren.length) {
				patchBlockChildren(n1.dynamicChildren, dynamicChildren, container, parentComponent, parentSuspense, namespace, slotScopeIds);
				if (n2.key != null || parentComponent && n2 === parentComponent.subTree) traverseStaticChildren(n1, n2, true);
			} else patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
		};
		const processComponent = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			n2.slotScopeIds = slotScopeIds;
			if (n1 == null) {
				if (n2.shapeFlag & 512) parentComponent.ctx.activate(n2, container, anchor, namespace, optimized);
				else mountComponent(n2, container, anchor, parentComponent, parentSuspense, namespace, optimized);
			} else updateComponent(n1, n2, optimized);
		};
		const mountComponent = (initialVNode, container, anchor, parentComponent, parentSuspense, namespace, optimized) => {
			const instance = initialVNode.component = createComponentInstance(initialVNode, parentComponent, parentSuspense);
			if (isKeepAlive(initialVNode)) instance.ctx.renderer = internals;
			setupComponent(instance, false, optimized);
			if (instance.asyncDep) {
				parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect, optimized);
				if (!initialVNode.el) {
					const placeholder = instance.subTree = createVNode(Comment);
					processCommentNode(null, placeholder, container, anchor);
					initialVNode.placeholder = placeholder.el;
				}
			} else setupRenderEffect(instance, initialVNode, container, anchor, parentSuspense, namespace, optimized);
		};
		const updateComponent = (n1, n2, optimized) => {
			const instance = n2.component = n1.component;
			if (shouldUpdateComponent(n1, n2, optimized)) {
				if (instance.asyncDep && !instance.asyncResolved) {
					n2.el = n1.el;
					updateComponentPreRender(instance, n2, optimized);
					return;
				} else {
					instance.next = n2;
					instance.update();
				}
			} else {
				n2.el = n1.el;
				instance.vnode = n2;
			}
		};
		const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, namespace, optimized) => {
			const componentUpdateFn = () => {
				if (!instance.isMounted) {
					let vnodeHook;
					const { el, props } = initialVNode;
					const { bm, m, parent, root, type } = instance;
					const isAsyncWrapperVNode = isAsyncWrapper(initialVNode);
					toggleRecurse(instance, false);
					if (bm) invokeArrayFns(bm);
					if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeBeforeMount)) invokeVNodeHook(vnodeHook, parent, initialVNode);
					toggleRecurse(instance, true);
					if (el && hydrateNode) {
						const hydrateSubTree = () => {
							instance.subTree = renderComponentRoot(instance);
							hydrateNode(el, instance.subTree, instance, parentSuspense, null);
						};
						if (isAsyncWrapperVNode && type.__asyncHydrate) type.__asyncHydrate(el, instance, hydrateSubTree);
						else hydrateSubTree();
					} else {
						if (root.ce && root.ce._hasShadowRoot()) root.ce._injectChildStyle(type, instance.parent ? instance.parent.type : void 0);
						const subTree = instance.subTree = renderComponentRoot(instance);
						patch(null, subTree, container, anchor, instance, parentSuspense, namespace);
						initialVNode.el = subTree.el;
					}
					if (m) queuePostRenderEffect(m, parentSuspense);
					if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeMounted)) {
						const scopedInitialVNode = initialVNode;
						queuePostRenderEffect(() => invokeVNodeHook(vnodeHook, parent, scopedInitialVNode), parentSuspense);
					}
					if (initialVNode.shapeFlag & 256 || parent && isAsyncWrapper(parent.vnode) && parent.vnode.shapeFlag & 256) instance.a && queuePostRenderEffect(instance.a, parentSuspense);
					instance.isMounted = true;
					initialVNode = container = anchor = null;
				} else {
					let { next, bu, u, parent, vnode } = instance;
					{
						const nonHydratedAsyncRoot = locateNonHydratedAsyncRoot(instance);
						if (nonHydratedAsyncRoot) {
							if (next) {
								next.el = vnode.el;
								updateComponentPreRender(instance, next, optimized);
							}
							nonHydratedAsyncRoot.asyncDep.then(() => {
								queuePostRenderEffect(() => {
									if (!instance.isUnmounted) update();
								}, parentSuspense);
							});
							return;
						}
					}
					let originNext = next;
					let vnodeHook;
					toggleRecurse(instance, false);
					if (next) {
						next.el = vnode.el;
						updateComponentPreRender(instance, next, optimized);
					} else next = vnode;
					if (bu) invokeArrayFns(bu);
					if (vnodeHook = next.props && next.props.onVnodeBeforeUpdate) invokeVNodeHook(vnodeHook, parent, next, vnode);
					toggleRecurse(instance, true);
					const nextTree = renderComponentRoot(instance);
					const prevTree = instance.subTree;
					instance.subTree = nextTree;
					patch(prevTree, nextTree, hostParentNode(prevTree.el), getNextHostNode(prevTree), instance, parentSuspense, namespace);
					next.el = nextTree.el;
					if (originNext === null) updateHOCHostEl(instance, nextTree.el);
					if (u) queuePostRenderEffect(u, parentSuspense);
					if (vnodeHook = next.props && next.props.onVnodeUpdated) queuePostRenderEffect(() => invokeVNodeHook(vnodeHook, parent, next, vnode), parentSuspense);
				}
			};
			instance.scope.on();
			const effect = instance.effect = new ReactiveEffect(componentUpdateFn);
			instance.scope.off();
			const update = instance.update = effect.run.bind(effect);
			const job = instance.job = effect.runIfDirty.bind(effect);
			job.i = instance;
			job.id = instance.uid;
			effect.scheduler = () => queueJob(job);
			toggleRecurse(instance, true);
			update();
		};
		const updateComponentPreRender = (instance, nextVNode, optimized) => {
			nextVNode.component = instance;
			const prevProps = instance.vnode.props;
			instance.vnode = nextVNode;
			instance.next = null;
			updateProps(instance, nextVNode.props, prevProps, optimized);
			updateSlots(instance, nextVNode.children, optimized);
			pauseTracking();
			flushPreFlushCbs(instance);
			resetTracking();
		};
		const patchChildren = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized = false) => {
			const c1 = n1 && n1.children;
			const prevShapeFlag = n1 ? n1.shapeFlag : 0;
			const c2 = n2.children;
			const { patchFlag, shapeFlag } = n2;
			if (patchFlag > 0) {
				if (patchFlag & 128) {
					patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					return;
				} else if (patchFlag & 256) {
					patchUnkeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					return;
				}
			}
			if (shapeFlag & 8) {
				if (prevShapeFlag & 16) unmountChildren(c1, parentComponent, parentSuspense);
				if (c2 !== c1) hostSetElementText(container, c2);
			} else if (prevShapeFlag & 16) {
				if (shapeFlag & 16) patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else unmountChildren(c1, parentComponent, parentSuspense, true);
			} else {
				if (prevShapeFlag & 8) hostSetElementText(container, "");
				if (shapeFlag & 16) mountChildren(c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			}
		};
		const patchUnkeyedChildren = (c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			c1 = c1 || EMPTY_ARR;
			c2 = c2 || EMPTY_ARR;
			const oldLength = c1.length;
			const newLength = c2.length;
			const commonLength = Math.min(oldLength, newLength);
			let i = 0;
			for (; i < commonLength; i++) {
				const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
				patch(c1[i], nextChild, container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			}
			if (oldLength > newLength) unmountChildren(c1, parentComponent, parentSuspense, true, false, commonLength);
			else mountChildren(c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, commonLength);
		};
		const patchKeyedChildren = (c1, c2, container, parentAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			let i = 0;
			const l2 = c2.length;
			let e1 = c1.length - 1;
			let e2 = l2 - 1;
			while (i <= e1 && i <= e2) {
				const n1 = c1[i];
				const n2 = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
				if (isSameVNodeType(n1, n2)) patch(n1, n2, container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else break;
				i++;
			}
			while (i <= e1 && i <= e2) {
				const n1 = c1[e1];
				const n2 = c2[e2] = optimized ? cloneIfMounted(c2[e2]) : normalizeVNode(c2[e2]);
				if (isSameVNodeType(n1, n2)) patch(n1, n2, container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else break;
				e1--;
				e2--;
			}
			if (i > e1) {
				if (i <= e2) {
					const nextPos = e2 + 1;
					const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
					while (i <= e2) {
						patch(null, c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]), container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
						i++;
					}
				}
			} else if (i > e2) while (i <= e1) {
				unmount(c1[i], parentComponent, parentSuspense, true);
				i++;
			}
			else {
				const s1 = i;
				const s2 = i;
				const keyToNewIndexMap = new Map();
				for (i = s2; i <= e2; i++) {
					const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
					if (nextChild.key != null) keyToNewIndexMap.set(nextChild.key, i);
				}
				let j;
				let patched = 0;
				const toBePatched = e2 - s2 + 1;
				let moved = false;
				let maxNewIndexSoFar = 0;
				const newIndexToOldIndexMap = new Array(toBePatched);
				for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
				for (i = s1; i <= e1; i++) {
					const prevChild = c1[i];
					if (patched >= toBePatched) {
						unmount(prevChild, parentComponent, parentSuspense, true);
						continue;
					}
					let newIndex;
					if (prevChild.key != null) newIndex = keyToNewIndexMap.get(prevChild.key);
					else for (j = s2; j <= e2; j++) if (newIndexToOldIndexMap[j - s2] === 0 && isSameVNodeType(prevChild, c2[j])) {
						newIndex = j;
						break;
					}
					if (newIndex === void 0) unmount(prevChild, parentComponent, parentSuspense, true);
					else {
						newIndexToOldIndexMap[newIndex - s2] = i + 1;
						if (newIndex >= maxNewIndexSoFar) maxNewIndexSoFar = newIndex;
						else moved = true;
						patch(prevChild, c2[newIndex], container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
						patched++;
					}
				}
				const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : EMPTY_ARR;
				j = increasingNewIndexSequence.length - 1;
				for (i = toBePatched - 1; i >= 0; i--) {
					const nextIndex = s2 + i;
					const nextChild = c2[nextIndex];
					const anchorVNode = c2[nextIndex + 1];
					const anchor = nextIndex + 1 < l2 ? anchorVNode.el || resolveAsyncComponentPlaceholder(anchorVNode) : parentAnchor;
					if (newIndexToOldIndexMap[i] === 0) patch(null, nextChild, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					else if (moved) {
						if (j < 0 || i !== increasingNewIndexSequence[j]) move(nextChild, container, anchor, 2);
						else j--;
					}
				}
			}
		};
		const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
			const { el, type, transition, children, shapeFlag } = vnode;
			if (shapeFlag & 6) {
				move(vnode.component.subTree, container, anchor, moveType);
				return;
			}
			if (shapeFlag & 128) {
				vnode.suspense.move(container, anchor, moveType);
				return;
			}
			if (shapeFlag & 64) {
				type.move(vnode, container, anchor, internals);
				return;
			}
			if (type === Fragment) {
				hostInsert(el, container, anchor);
				for (let i = 0; i < children.length; i++) move(children[i], container, anchor, moveType);
				hostInsert(vnode.anchor, container, anchor);
				return;
			}
			if (type === Static) {
				moveStaticNode(vnode, container, anchor);
				return;
			}
			if (moveType !== 2 && shapeFlag & 1 && transition) {
				if (moveType === 0) {
					if (transition.persisted && !el[leaveCbKey]) hostInsert(el, container, anchor);
					else {
						transition.beforeEnter(el);
						hostInsert(el, container, anchor);
						queuePostRenderEffect(() => transition.enter(el), parentSuspense);
					}
				} else {
					const { leave, delayLeave, afterLeave } = transition;
					const remove2 = () => {
						if (vnode.ctx.isUnmounted) hostRemove(el);
						else hostInsert(el, container, anchor);
					};
					const performLeave = () => {
						const wasLeaving = el._isLeaving || !!el[leaveCbKey];
						if (el._isLeaving) el[leaveCbKey](true);
						if (transition.persisted && !wasLeaving) remove2();
						else leave(el, () => {
							remove2();
							afterLeave && afterLeave();
						});
					};
					if (delayLeave) delayLeave(el, remove2, performLeave);
					else performLeave();
				}
			} else hostInsert(el, container, anchor);
		};
		const unmount = (vnode, parentComponent, parentSuspense, doRemove = false, optimized = false) => {
			const { type, props, ref, children, dynamicChildren, shapeFlag, patchFlag, dirs, cacheIndex, memo } = vnode;
			if (patchFlag === -2 || dynamicChildren && dynamicChildren.hasOnce) optimized = false;
			if (ref != null) {
				pauseTracking();
				setRef(ref, null, parentSuspense, vnode, true);
				resetTracking();
			}
			if (cacheIndex != null && (!vnode.ctx || vnode.ctx === parentComponent)) parentComponent.renderCache[cacheIndex] = void 0;
			if (shapeFlag & 256) {
				parentComponent.ctx.deactivate(vnode);
				return;
			}
			const shouldInvokeDirs = shapeFlag & 1 && dirs;
			const shouldInvokeVnodeHook = !isAsyncWrapper(vnode);
			let vnodeHook;
			if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeBeforeUnmount)) invokeVNodeHook(vnodeHook, parentComponent, vnode);
			if (shapeFlag & 6) unmountComponent(vnode.component, parentSuspense, doRemove);
			else {
				if (shapeFlag & 128) {
					vnode.suspense.unmount(parentSuspense, doRemove);
					return;
				}
				if (shouldInvokeDirs) invokeDirectiveHook(vnode, null, parentComponent, "beforeUnmount");
				if (shapeFlag & 64) vnode.type.remove(vnode, parentComponent, parentSuspense, internals, doRemove);
				else if (dynamicChildren && !dynamicChildren.hasOnce && (type !== Fragment || patchFlag > 0 && patchFlag & 64)) unmountChildren(dynamicChildren, parentComponent, parentSuspense, false, true);
				else if (type === Fragment && patchFlag & 384 || !optimized && shapeFlag & 16) unmountChildren(children, parentComponent, parentSuspense);
				if (doRemove) remove(vnode);
			}
			const shouldInvalidateMemo = memo != null && cacheIndex == null;
			if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeUnmounted) || shouldInvokeDirs || shouldInvalidateMemo) queuePostRenderEffect(() => {
				vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
				shouldInvokeDirs && invokeDirectiveHook(vnode, null, parentComponent, "unmounted");
				if (shouldInvalidateMemo) vnode.el = null;
			}, parentSuspense);
		};
		const remove = (vnode) => {
			const { type, el, anchor, transition } = vnode;
			if (type === Fragment) {
				removeFragment(el, anchor);
				return;
			}
			if (type === Static) {
				removeStaticNode(vnode);
				if (transition && !transition.persisted && transition.afterLeave) transition.afterLeave();
				return;
			}
			const performRemove = () => {
				hostRemove(el);
				if (transition && !transition.persisted && transition.afterLeave) transition.afterLeave();
			};
			if (vnode.shapeFlag & 1 && transition && !transition.persisted) {
				const { leave, delayLeave } = transition;
				const performLeave = () => leave(el, performRemove);
				if (delayLeave) delayLeave(vnode.el, performRemove, performLeave);
				else performLeave();
			} else performRemove();
		};
		const removeFragment = (cur, end) => {
			let next;
			while (cur !== end) {
				next = hostNextSibling(cur);
				hostRemove(cur);
				cur = next;
			}
			hostRemove(end);
		};
		const unmountComponent = (instance, parentSuspense, doRemove) => {
			const { bum, scope, job, subTree, um, m, a } = instance;
			invalidateMount(m);
			invalidateMount(a);
			if (bum) invokeArrayFns(bum);
			scope.stop();
			if (job) {
				job.flags |= 8;
				unmount(subTree, instance, parentSuspense, doRemove);
			} else if (instance.vnode.el && subTree) {
				subTree.transition = instance.vnode.transition;
				unmount(subTree, instance, parentSuspense, doRemove);
			}
			if (um) queuePostRenderEffect(um, parentSuspense);
			queuePostRenderEffect(() => {
				instance.isUnmounted = true;
			}, parentSuspense);
		};
		const unmountChildren = (children, parentComponent, parentSuspense, doRemove = false, optimized = false, start = 0) => {
			for (let i = start; i < children.length; i++) unmount(children[i], parentComponent, parentSuspense, doRemove, optimized);
		};
		const getNextHostNode = (vnode) => {
			if (vnode.shapeFlag & 6) return getNextHostNode(vnode.component.subTree);
			if (vnode.shapeFlag & 128) return vnode.suspense.next();
			const el = hostNextSibling(vnode.anchor || vnode.el);
			const teleportEnd = el && el[TeleportEndKey];
			return teleportEnd ? hostNextSibling(teleportEnd) : el;
		};
		let isFlushing = false;
		const render = (vnode, container, namespace) => {
			let instance;
			if (vnode == null) {
				if (container._vnode) {
					unmount(container._vnode, null, null, true);
					instance = container._vnode.component;
				}
			} else patch(container._vnode || null, vnode, container, null, null, null, namespace);
			container._vnode = vnode;
			if (!isFlushing) {
				isFlushing = true;
				flushPreFlushCbs(instance);
				flushPostFlushCbs();
				isFlushing = false;
			}
		};
		const internals = {
			p: patch,
			um: unmount,
			m: move,
			r: remove,
			mt: mountComponent,
			mc: mountChildren,
			pc: patchChildren,
			pbc: patchBlockChildren,
			n: getNextHostNode,
			o: options
		};
		let hydrate;
		let hydrateNode;
		if (createHydrationFns) [hydrate, hydrateNode] = createHydrationFns(internals);
		return {
			render,
			hydrate,
			createApp: createAppAPI(render, hydrate)
		};
	}
	function resolveChildrenNamespace({ type, props }, currentNamespace) {
		return currentNamespace === "svg" && type === "foreignObject" || currentNamespace === "mathml" && type === "annotation-xml" && props && props.encoding && props.encoding.includes("html") ? void 0 : currentNamespace;
	}
	function toggleRecurse({ effect, job }, allowed) {
		if (allowed) {
			effect.flags |= 32;
			job.flags |= 4;
		} else {
			effect.flags &= -33;
			job.flags &= -5;
		}
	}
	function needTransition(parentSuspense, transition) {
		return (!parentSuspense || parentSuspense && !parentSuspense.pendingBranch) && transition && !transition.persisted;
	}
	function traverseStaticChildren(n1, n2, shallow = false) {
		const ch1 = n1.children;
		const ch2 = n2.children;
		if (isArray(ch1) && isArray(ch2)) for (let i = 0; i < ch1.length; i++) {
			const c1 = ch1[i];
			let c2 = ch2[i];
			if (c2.shapeFlag & 1 && !c2.dynamicChildren) {
				if (c2.patchFlag <= 0 || c2.patchFlag === 32) {
					c2 = ch2[i] = cloneIfMounted(ch2[i]);
					c2.el = c1.el;
				}
				if (!shallow && c2.patchFlag !== -2) traverseStaticChildren(c1, c2);
			}
			if (c2.type === Text) {
				if (c2.patchFlag === -1) c2 = ch2[i] = cloneIfMounted(c2);
				c2.el = c1.el;
			}
			if (c2.type === Comment && !c2.el) c2.el = c1.el;
		}
	}
	function getSequence(arr) {
		const p = arr.slice();
		const result = [0];
		let i, j, u, v, c;
		const len = arr.length;
		for (i = 0; i < len; i++) {
			const arrI = arr[i];
			if (arrI !== 0) {
				j = result[result.length - 1];
				if (arr[j] < arrI) {
					p[i] = j;
					result.push(i);
					continue;
				}
				u = 0;
				v = result.length - 1;
				while (u < v) {
					c = u + v >> 1;
					if (arr[result[c]] < arrI) u = c + 1;
					else v = c;
				}
				if (arrI < arr[result[u]]) {
					if (u > 0) p[i] = result[u - 1];
					result[u] = i;
				}
			}
		}
		u = result.length;
		v = result[u - 1];
		while (u-- > 0) {
			result[u] = v;
			v = p[v];
		}
		return result;
	}
	function locateNonHydratedAsyncRoot(instance) {
		const subComponent = instance.subTree.component;
		if (subComponent) {
			if (subComponent.asyncDep && !subComponent.asyncResolved) return subComponent;
			else return locateNonHydratedAsyncRoot(subComponent);
		}
	}
	function invalidateMount(hooks) {
		if (hooks) for (let i = 0; i < hooks.length; i++) hooks[i].flags |= 8;
	}
	function resolveAsyncComponentPlaceholder(anchorVnode) {
		if (anchorVnode.placeholder) return anchorVnode.placeholder;
		const instance = anchorVnode.component;
		if (instance) return resolveAsyncComponentPlaceholder(instance.subTree);
		return null;
	}
	var isSuspense = (type) => type.__isSuspense;
	function queueEffectWithSuspense(fn, suspense) {
		if (suspense && suspense.pendingBranch) {
			if (isArray(fn)) suspense.effects.push(...fn);
			else suspense.effects.push(fn);
		} else queuePostFlushCb(fn);
	}
	var Fragment = Symbol.for("v-fgt");
	var Text = Symbol.for("v-txt");
	var Comment = Symbol.for("v-cmt");
	var Static = Symbol.for("v-stc");
	var blockStack = [];
	var currentBlock = null;
	function openBlock(disableTracking = false) {
		blockStack.push(currentBlock = disableTracking ? null : []);
	}
	function closeBlock() {
		blockStack.pop();
		currentBlock = blockStack[blockStack.length - 1] || null;
	}
	var isBlockTreeEnabled = 1;
	function setBlockTracking(value, inVOnce = false) {
		isBlockTreeEnabled += value;
		if (value < 0 && currentBlock && inVOnce) currentBlock.hasOnce = true;
	}
	function setupBlock(vnode) {
		vnode.dynamicChildren = isBlockTreeEnabled > 0 ? currentBlock || EMPTY_ARR : null;
		closeBlock();
		if (isBlockTreeEnabled > 0 && currentBlock) currentBlock.push(vnode);
		return vnode;
	}
	function createElementBlock(type, props, children, patchFlag, dynamicProps, shapeFlag) {
		return setupBlock(createBaseVNode(type, props, children, patchFlag, dynamicProps, shapeFlag, true));
	}
	function isVNode(value) {
		return value ? value.__v_isVNode === true : false;
	}
	function isSameVNodeType(n1, n2) {
		return n1.type === n2.type && n1.key === n2.key;
	}
	var normalizeKey = ({ key }) => key != null ? key : null;
	var normalizeRef = ({ ref, ref_key, ref_for }) => {
		if (typeof ref === "number") ref = "" + ref;
		return ref != null ? isString(ref) || isRef(ref) || isFunction(ref) ? {
			i: currentRenderingInstance,
			r: ref,
			k: ref_key,
			f: !!ref_for
		} : ref : null;
	};
	function createBaseVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, shapeFlag = type === Fragment ? 0 : 1, isBlockNode = false, needFullChildrenNormalization = false) {
		const vnode = {
			__v_isVNode: true,
			__v_skip: true,
			type,
			props,
			key: props && normalizeKey(props),
			ref: props && normalizeRef(props),
			scopeId: currentScopeId,
			slotScopeIds: null,
			children,
			component: null,
			suspense: null,
			ssContent: null,
			ssFallback: null,
			dirs: null,
			transition: null,
			el: null,
			anchor: null,
			target: null,
			targetStart: null,
			targetAnchor: null,
			staticCount: 0,
			shapeFlag,
			patchFlag,
			dynamicProps,
			dynamicChildren: null,
			appContext: null,
			ctx: currentRenderingInstance
		};
		if (needFullChildrenNormalization) {
			normalizeChildren(vnode, children);
			if (shapeFlag & 128) type.normalize(vnode);
		} else if (children) vnode.shapeFlag |= isString(children) ? 8 : 16;
		if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock && (vnode.patchFlag > 0 || shapeFlag & 6) && vnode.patchFlag !== 32) currentBlock.push(vnode);
		return vnode;
	}
	var createVNode = _createVNode;
	function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
		if (!type || type === NULL_DYNAMIC_COMPONENT) type = Comment;
		if (isVNode(type)) {
			const cloned = cloneVNode(type, props, true);
			if (children) normalizeChildren(cloned, children);
			if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
				if (cloned.shapeFlag & 6) currentBlock[currentBlock.indexOf(type)] = cloned;
				else currentBlock.push(cloned);
			}
			cloned.patchFlag = -2;
			return cloned;
		}
		if (isClassComponent(type)) type = type.__vccOpts;
		if (props) {
			props = guardReactiveProps(props);
			let { class: klass, style } = props;
			if (klass && !isString(klass)) props.class = normalizeClass(klass);
			if (isObject(style)) {
				if (isProxy(style) && !isArray(style)) style = extend({}, style);
				props.style = normalizeStyle(style);
			}
		}
		const shapeFlag = isString(type) ? 1 : isSuspense(type) ? 128 : isTeleport(type) ? 64 : isObject(type) ? 4 : isFunction(type) ? 2 : 0;
		return createBaseVNode(type, props, children, patchFlag, dynamicProps, shapeFlag, isBlockNode, true);
	}
	function guardReactiveProps(props) {
		if (!props) return null;
		return isProxy(props) || isInternalObject(props) ? extend({}, props) : props;
	}
	function cloneVNode(vnode, extraProps, mergeRef = false, cloneTransition = false) {
		const { props, ref, patchFlag, children, transition } = vnode;
		const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
		const cloned = {
			__v_isVNode: true,
			__v_skip: true,
			type: vnode.type,
			props: mergedProps,
			key: mergedProps && normalizeKey(mergedProps),
			ref: extraProps && extraProps.ref ? mergeRef && ref ? isArray(ref) ? ref.concat(normalizeRef(extraProps)) : [ref, normalizeRef(extraProps)] : normalizeRef(extraProps) : ref,
			scopeId: vnode.scopeId,
			slotScopeIds: vnode.slotScopeIds,
			children,
			target: vnode.target,
			targetStart: vnode.targetStart,
			targetAnchor: vnode.targetAnchor,
			staticCount: vnode.staticCount,
			shapeFlag: vnode.shapeFlag,
			patchFlag: extraProps && vnode.type !== Fragment ? patchFlag === -1 ? 16 : patchFlag | 16 : patchFlag,
			dynamicProps: vnode.dynamicProps,
			dynamicChildren: vnode.dynamicChildren,
			appContext: vnode.appContext,
			dirs: vnode.dirs,
			transition,
			component: vnode.component,
			suspense: vnode.suspense,
			ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
			ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
			placeholder: vnode.placeholder,
			el: vnode.el,
			anchor: vnode.anchor,
			ctx: vnode.ctx,
			ce: vnode.ce,
			cacheIndex: vnode.cacheIndex
		};
		if (transition && cloneTransition) setTransitionHooks(cloned, transition.clone(cloned));
		return cloned;
	}
	function createTextVNode(text = " ", flag = 0) {
		return createVNode(Text, null, text, flag);
	}
	function normalizeVNode(child) {
		if (child == null || typeof child === "boolean") return createVNode(Comment);
		else if (isArray(child)) return createVNode(Fragment, null, child.slice());
		else if (isVNode(child)) return cloneIfMounted(child);
		else return createVNode(Text, null, String(child));
	}
	function cloneIfMounted(child) {
		return child.el === null && child.patchFlag !== -1 || child.memo ? child : cloneVNode(child);
	}
	function normalizeChildren(vnode, children) {
		let type = 0;
		const { shapeFlag } = vnode;
		if (children == null) children = null;
		else if (isArray(children)) type = 16;
		else if (typeof children === "object") {
			if (shapeFlag & 65) {
				const slot = children.default;
				if (slot) {
					slot._c && (slot._d = false);
					normalizeChildren(vnode, slot());
					slot._c && (slot._d = true);
				}
				return;
			} else {
				type = 32;
				const slotFlag = children._;
				if (!slotFlag && !isInternalObject(children)) children._ctx = currentRenderingInstance;
				else if (slotFlag === 3 && currentRenderingInstance) {
					if (currentRenderingInstance.slots._ === 1) children._ = 1;
					else {
						children._ = 2;
						vnode.patchFlag |= 1024;
					}
				}
			}
		} else if (isFunction(children)) {
			if (shapeFlag & 65) {
				normalizeChildren(vnode, { default: children });
				return;
			}
			children = {
				default: children,
				_ctx: currentRenderingInstance
			};
			type = 32;
		} else {
			children = String(children);
			if (shapeFlag & 64) {
				type = 16;
				children = [createTextVNode(children)];
			} else type = 8;
		}
		vnode.children = children;
		vnode.shapeFlag |= type;
	}
	function mergeProps(...args) {
		const ret = {};
		for (let i = 0; i < args.length; i++) {
			const toMerge = args[i];
			for (const key in toMerge) if (key === "class") {
				if (ret.class !== toMerge.class) ret.class = normalizeClass([ret.class, toMerge.class]);
			} else if (key === "style") ret.style = normalizeStyle([ret.style, toMerge.style]);
			else if (isOn(key)) {
				const existing = ret[key];
				const incoming = toMerge[key];
				if (incoming && existing !== incoming && !(isArray(existing) && existing.includes(incoming))) ret[key] = existing ? [].concat(existing, incoming) : incoming;
				else if (incoming == null && existing == null && !isModelListener(key)) ret[key] = incoming;
			} else if (key !== "") ret[key] = toMerge[key];
		}
		return ret;
	}
	function invokeVNodeHook(hook, instance, vnode, prevVNode = null) {
		callWithAsyncErrorHandling(hook, instance, 7, [vnode, prevVNode]);
	}
	var emptyAppContext = createAppContext();
	var uid = 0;
	function createComponentInstance(vnode, parent, suspense) {
		const type = vnode.type;
		const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
		const instance = {
			uid: uid++,
			vnode,
			type,
			parent,
			appContext,
			root: null,
			next: null,
			subTree: null,
			effect: null,
			update: null,
			job: null,
			scope: new EffectScope(true),
			render: null,
			proxy: null,
			exposed: null,
			exposeProxy: null,
			withProxy: null,
			provides: parent ? parent.provides : Object.create(appContext.provides),
			ids: parent ? parent.ids : [
				"",
				0,
				0
			],
			accessCache: null,
			renderCache: [],
			components: null,
			directives: null,
			propsOptions: normalizePropsOptions(type, appContext),
			emitsOptions: normalizeEmitsOptions(type, appContext),
			emit: null,
			emitted: null,
			propsDefaults: EMPTY_OBJ,
			inheritAttrs: type.inheritAttrs,
			ctx: EMPTY_OBJ,
			data: EMPTY_OBJ,
			props: EMPTY_OBJ,
			attrs: EMPTY_OBJ,
			slots: EMPTY_OBJ,
			refs: EMPTY_OBJ,
			setupState: EMPTY_OBJ,
			setupContext: null,
			suspense,
			suspenseId: suspense ? suspense.pendingId : 0,
			asyncDep: null,
			asyncResolved: false,
			isMounted: false,
			isUnmounted: false,
			isDeactivated: false,
			bc: null,
			c: null,
			bm: null,
			m: null,
			bu: null,
			u: null,
			um: null,
			bum: null,
			da: null,
			a: null,
			rtg: null,
			rtc: null,
			ec: null,
			sp: null
		};
		instance.ctx = { _: instance };
		instance.root = parent ? parent.root : instance;
		instance.emit = emit.bind(null, instance);
		if (vnode.ce) vnode.ce(instance);
		return instance;
	}
	var currentInstance = null;
	var getCurrentInstance = () => currentInstance || currentRenderingInstance;
	var internalSetCurrentInstance;
	var setInSSRSetupState;
	{
		const g = getGlobalThis();
		const registerGlobalSetter = (key, setter) => {
			let setters;
			if (!(setters = g[key])) setters = g[key] = [];
			setters.push(setter);
			return (v) => {
				if (setters.length > 1) setters.forEach((set) => set(v));
				else setters[0](v);
			};
		};
		internalSetCurrentInstance = registerGlobalSetter(`__VUE_INSTANCE_SETTERS__`, (v) => currentInstance = v);
		setInSSRSetupState = registerGlobalSetter(`__VUE_SSR_SETTERS__`, (v) => isInSSRComponentSetup = v);
	}
	var setCurrentInstance = (instance) => {
		const prev = currentInstance;
		internalSetCurrentInstance(instance);
		instance.scope.on();
		return () => {
			instance.scope.off();
			internalSetCurrentInstance(prev);
		};
	};
	var unsetCurrentInstance = () => {
		currentInstance && currentInstance.scope.off();
		internalSetCurrentInstance(null);
	};
	function isStatefulComponent(instance) {
		return instance.vnode.shapeFlag & 4;
	}
	var isInSSRComponentSetup = false;
	function setupComponent(instance, isSSR = false, optimized = false) {
		isSSR && setInSSRSetupState(isSSR);
		const { props, children } = instance.vnode;
		const isStateful = isStatefulComponent(instance);
		initProps(instance, props, isStateful, isSSR);
		initSlots(instance, children, optimized || isSSR);
		const setupResult = isStateful ? setupStatefulComponent(instance, isSSR) : void 0;
		isSSR && setInSSRSetupState(false);
		return setupResult;
	}
	function setupStatefulComponent(instance, isSSR) {
		const Component = instance.type;
		instance.accessCache = Object.create(null);
		instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
		const { setup } = Component;
		if (setup) {
			pauseTracking();
			const setupContext = instance.setupContext = setup.length > 1 ? createSetupContext(instance) : null;
			const reset = setCurrentInstance(instance);
			const setupResult = callWithErrorHandling(setup, instance, 0, [instance.props, setupContext]);
			const isAsyncSetup = isPromise(setupResult);
			resetTracking();
			reset();
			if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) markAsyncBoundary(instance);
			if (isAsyncSetup) {
				setupResult.then(unsetCurrentInstance, unsetCurrentInstance);
				if (isSSR) return setupResult.then((resolvedResult) => {
					setInSSRSetupState(true);
					try {
						handleSetupResult(instance, resolvedResult, isSSR);
					} finally {
						setInSSRSetupState(false);
					}
				}).catch((e) => {
					handleError(e, instance, 0);
				});
				else instance.asyncDep = setupResult;
			} else handleSetupResult(instance, setupResult, isSSR);
		} else finishComponentSetup(instance, isSSR);
	}
	function handleSetupResult(instance, setupResult, isSSR) {
		if (isFunction(setupResult)) {
			if (instance.type.__ssrInlineRender) instance.ssrRender = setupResult;
			else instance.render = setupResult;
		} else if (isObject(setupResult)) instance.setupState = proxyRefs(setupResult);
		finishComponentSetup(instance, isSSR);
	}
	function finishComponentSetup(instance, isSSR, skipOptions) {
		const Component = instance.type;
		if (!instance.render) instance.render = Component.render || NOOP;
		{
			const reset = setCurrentInstance(instance);
			pauseTracking();
			try {
				applyOptions(instance);
			} finally {
				resetTracking();
				reset();
			}
		}
	}
	var attrsProxyHandlers = { get(target, key) {
		track(target, "get", "");
		return target[key];
	} };
	function createSetupContext(instance) {
		const expose = (exposed) => {
			instance.exposed = exposed || {};
		};
		return {
			attrs: new Proxy(instance.attrs, attrsProxyHandlers),
			slots: instance.slots,
			emit: instance.emit,
			expose
		};
	}
	function getComponentPublicInstance(instance) {
		if (instance.exposed) return instance.exposeProxy || (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
			get(target, key) {
				if (key in target) return target[key];
				else if (key in publicPropertiesMap) return publicPropertiesMap[key](instance);
			},
			has(target, key) {
				return key in target || key in publicPropertiesMap;
			}
		}));
		else return instance.proxy;
	}
	function isClassComponent(value) {
		return isFunction(value) && "__vccOpts" in value;
	}
	var computed = (getterOrOptions, debugOptions) => {
		return computed$1(getterOrOptions, debugOptions, isInSSRComponentSetup);
	};
	function h(type, propsOrChildren, children) {
		try {
			setBlockTracking(-1);
			const l = arguments.length;
			if (l === 2) {
				if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
					if (isVNode(propsOrChildren)) return createVNode(type, null, [propsOrChildren]);
					return createVNode(type, propsOrChildren);
				} else return createVNode(type, null, propsOrChildren);
			} else {
				if (l > 3) children = Array.prototype.slice.call(arguments, 2);
				else if (l === 3 && isVNode(children)) children = [children];
				return createVNode(type, propsOrChildren, children);
			}
		} finally {
			setBlockTracking(1);
		}
	}
	var version = "3.5.43";
	var policy = void 0;
	var tt = typeof window !== "undefined" && window.trustedTypes;
	if (tt) try {
		policy = tt.createPolicy("vue", { createHTML: (val) => val });
	} catch (e) {}
	var unsafeToTrustedHTML = policy ? (val) => policy.createHTML(val) : (val) => val;
	var svgNS = "http://www.w3.org/2000/svg";
	var mathmlNS = "http://www.w3.org/1998/Math/MathML";
	var doc = typeof document !== "undefined" ? document : null;
	var templateContainer = doc && doc.createElement("template");
	var nodeOps = {
		insert: (child, parent, anchor) => {
			parent.insertBefore(child, anchor || null);
		},
		remove: (child) => {
			const parent = child.parentNode;
			if (parent) parent.removeChild(child);
		},
		createElement: (tag, namespace, is, props) => {
			const el = namespace === "svg" ? doc.createElementNS(svgNS, tag) : namespace === "mathml" ? doc.createElementNS(mathmlNS, tag) : is ? doc.createElement(tag, { is }) : doc.createElement(tag);
			if (tag === "select" && props && props.multiple != null) el.setAttribute("multiple", props.multiple);
			return el;
		},
		createText: (text) => doc.createTextNode(text),
		createComment: (text) => doc.createComment(text),
		setText: (node, text) => {
			node.nodeValue = text;
		},
		setElementText: (el, text) => {
			el.textContent = text;
		},
		parentNode: (node) => node.parentNode,
		nextSibling: (node) => node.nextSibling,
		querySelector: (selector) => doc.querySelector(selector),
		setScopeId(el, id) {
			el.setAttribute(id, "");
		},
		insertStaticContent(content, parent, anchor, namespace, start, end) {
			const before = anchor ? anchor.previousSibling : parent.lastChild;
			if (start && (start === end || start.nextSibling)) while (true) {
				parent.insertBefore(start.cloneNode(true), anchor);
				if (start === end || !(start = start.nextSibling)) break;
			}
			else {
				templateContainer.innerHTML = unsafeToTrustedHTML(namespace === "svg" ? `<svg>${content}</svg>` : namespace === "mathml" ? `<math>${content}</math>` : content);
				const template = templateContainer.content;
				if (namespace === "svg" || namespace === "mathml") {
					const wrapper = template.firstChild;
					while (wrapper.firstChild) template.appendChild(wrapper.firstChild);
					template.removeChild(wrapper);
				}
				parent.insertBefore(template, anchor);
			}
			return [before ? before.nextSibling : parent.firstChild, anchor ? anchor.previousSibling : parent.lastChild];
		}
	};
	var vtcKey = Symbol("_vtc");
	function patchClass(el, value, isSVG) {
		const transitionClasses = el[vtcKey];
		if (transitionClasses) value = (value ? [value, ...transitionClasses] : [...transitionClasses]).join(" ");
		if (value == null) el.removeAttribute("class");
		else if (isSVG) el.setAttribute("class", value);
		else el.className = value;
	}
	var vShowOriginalDisplay = Symbol("_vod");
	var vShowHidden = Symbol("_vsh");
	var CSS_VAR_TEXT = Symbol("");
	var displayRE = /(?:^|;)\s*display\s*:/;
	function patchStyle(el, prev, next) {
		const style = el.style;
		const isCssString = isString(next);
		let hasControlledDisplay = false;
		if (next && !isCssString) {
			if (prev) {
				if (!isString(prev)) {
					for (const key in prev) if (next[key] == null) setStyle(style, key, "");
				} else for (const prevStyle of prev.split(";")) {
					const key = prevStyle.slice(0, prevStyle.indexOf(":")).trim();
					if (next[key] == null) setStyle(style, key, "");
				}
			}
			for (const key in next) {
				if (key === "display") hasControlledDisplay = true;
				const value = next[key];
				if (value != null) {
					if (!shouldPreserveTextareaResizeStyle(el, key, !isString(prev) && prev ? prev[key] : void 0, value)) setStyle(style, key, value);
				} else setStyle(style, key, "");
			}
		} else if (isCssString) {
			if (prev !== next) {
				const cssVarText = style[CSS_VAR_TEXT];
				if (cssVarText) next += ";" + cssVarText;
				style.cssText = next;
				hasControlledDisplay = displayRE.test(next);
			}
		} else if (prev) el.removeAttribute("style");
		if (vShowOriginalDisplay in el) {
			el[vShowOriginalDisplay] = hasControlledDisplay ? style.display : "";
			if (el[vShowHidden]) style.display = "none";
		}
	}
	var importantRE = /\s*!important$/;
	function setStyle(style, name, val) {
		if (isArray(val)) val.forEach((v) => setStyle(style, name, v));
		else {
			if (val == null) val = "";
			if (name.startsWith("--")) {
				if (importantRE.test(val)) style.setProperty(name, val.replace(importantRE, ""), "important");
				else style.setProperty(name, val);
			} else {
				const prefixed = autoPrefix(style, name);
				if (importantRE.test(val)) style.setProperty(hyphenate(prefixed), val.replace(importantRE, ""), "important");
				else style[prefixed] = val;
			}
		}
	}
	var prefixes = [
		"Webkit",
		"Moz",
		"ms"
	];
	var prefixCache = {};
	function autoPrefix(style, rawName) {
		const cached = prefixCache[rawName];
		if (cached) return cached;
		let name = camelize(rawName);
		if (name !== "filter" && name in style) return prefixCache[rawName] = name;
		name = capitalize(name);
		for (let i = 0; i < prefixes.length; i++) {
			const prefixed = prefixes[i] + name;
			if (prefixed in style) return prefixCache[rawName] = prefixed;
		}
		return rawName;
	}
	function shouldPreserveTextareaResizeStyle(el, key, prev, next) {
		return el.tagName === "TEXTAREA" && (key === "width" || key === "height") && isString(next) && prev === next;
	}
	var xlinkNS = "http://www.w3.org/1999/xlink";
	function patchAttr(el, key, value, isSVG, instance, isBoolean = isSpecialBooleanAttr(key)) {
		if (isSVG && key.startsWith("xlink:")) {
			if (value == null) el.removeAttributeNS(xlinkNS, key.slice(6, key.length));
			else el.setAttributeNS(xlinkNS, key, value);
		} else if (value == null || isBoolean && !includeBooleanAttr(value)) el.removeAttribute(key);
		else el.setAttribute(key, isBoolean ? "" : isSymbol(value) ? String(value) : value);
	}
	function patchDOMProp(el, key, value, parentComponent, attrName) {
		if (key === "innerHTML" || key === "textContent") {
			if (value != null) el[key] = key === "innerHTML" ? unsafeToTrustedHTML(value) : value;
			return;
		}
		const tag = el.tagName;
		if (key === "value" && tag !== "PROGRESS" && !tag.includes("-")) {
			const oldValue = tag === "OPTION" ? el.getAttribute("value") || "" : el.value;
			const newValue = value == null ? el.type === "checkbox" ? "on" : "" : String(value);
			if (oldValue !== newValue || !("_value" in el)) el.value = newValue;
			if (value == null) el.removeAttribute(key);
			el._value = value;
			return;
		}
		let needRemove = false;
		if (value === "" || value == null) {
			const type = typeof el[key];
			if (type === "boolean") value = includeBooleanAttr(value);
			else if (value == null && type === "string") {
				value = "";
				needRemove = true;
			} else if (type === "number") {
				value = 0;
				needRemove = true;
			}
		}
		try {
			el[key] = value;
		} catch (e) {}
		needRemove && el.removeAttribute(attrName || key);
	}
	function addEventListener(el, event, handler, options) {
		el.addEventListener(event, handler, options);
	}
	function removeEventListener(el, event, handler, options) {
		el.removeEventListener(event, handler, options);
	}
	var veiKey = Symbol("_vei");
	function patchEvent(el, rawName, prevValue, nextValue, instance = null) {
		const invokers = el[veiKey] || (el[veiKey] = {});
		const existingInvoker = invokers[rawName];
		if (nextValue && existingInvoker) existingInvoker.value = nextValue;
		else {
			const [name, options] = parseName(rawName);
			if (nextValue) addEventListener(el, name, invokers[rawName] = createInvoker(nextValue, instance), options);
			else if (existingInvoker) {
				removeEventListener(el, name, existingInvoker, options);
				invokers[rawName] = void 0;
			}
		}
	}
	var optionsModifierRE = /(Once|Passive|Capture)$/;
	var optionsModifierEventRE = /^on:?(?:Once|Passive|Capture)$/;
	function parseName(name) {
		let options;
		let m;
		while ((m = name.match(optionsModifierRE)) && !optionsModifierEventRE.test(name)) {
			if (!options) options = {};
			name = name.slice(0, name.length - m[1].length);
			options[m[1].toLowerCase()] = true;
		}
		return [name[2] === ":" ? name.slice(3) : hyphenate(name.slice(2)), options];
	}
	var cachedNow = 0;
	var p = Promise.resolve();
	var getNow = () => cachedNow || (p.then(() => cachedNow = 0), cachedNow = Date.now());
	function createInvoker(initialValue, instance) {
		const invoker = (e) => {
			if (!e._vts) e._vts = Date.now();
			else if (e._vts <= invoker.attached) return;
			const value = invoker.value;
			if (isArray(value)) {
				const originalStop = e.stopImmediatePropagation;
				e.stopImmediatePropagation = () => {
					originalStop.call(e);
					e._stopped = true;
				};
				const handlers = value.slice();
				const args = [e];
				for (let i = 0; i < handlers.length; i++) {
					if (e._stopped) break;
					const handler = handlers[i];
					if (handler) callWithAsyncErrorHandling(handler, instance, 5, args);
				}
			} else callWithAsyncErrorHandling(value, instance, 5, [e]);
		};
		invoker.value = initialValue;
		invoker.attached = getNow();
		return invoker;
	}
	var isNativeOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && key.charCodeAt(2) > 96 && key.charCodeAt(2) < 123;
	var patchProp = (el, key, prevValue, nextValue, namespace, parentComponent) => {
		const isSVG = namespace === "svg";
		if (key === "class") patchClass(el, nextValue, isSVG);
		else if (key === "style") patchStyle(el, prevValue, nextValue);
		else if (isOn(key)) {
			if (!isModelListener(key)) patchEvent(el, key, prevValue, nextValue, parentComponent);
		} else if (key[0] === "." ? (key = key.slice(1), true) : key[0] === "^" ? (key = key.slice(1), false) : shouldSetAsProp(el, key, nextValue, isSVG)) {
			patchDOMProp(el, key, nextValue);
			if (!el.tagName.includes("-") && (key === "value" || key === "checked" || key === "selected")) patchAttr(el, key, nextValue, isSVG, parentComponent, key !== "value");
		} else if (el._isVueCE && (shouldSetAsPropForVueCE(el, key) || el._def.__asyncLoader && (/[A-Z]/.test(key) || !isString(nextValue)))) patchDOMProp(el, camelize(key), nextValue, parentComponent, key);
		else {
			if (key === "true-value") el._trueValue = nextValue;
			else if (key === "false-value") el._falseValue = nextValue;
			patchAttr(el, key, nextValue, isSVG);
		}
	};
	function shouldSetAsProp(el, key, value, isSVG) {
		if (isSVG) {
			if (key === "innerHTML" || key === "textContent") return true;
			if (key in el && isNativeOn(key) && isFunction(value)) return true;
			return false;
		}
		if (key === "spellcheck" || key === "draggable" || key === "translate" || key === "autocorrect") return false;
		if (key === "sandbox" && el.tagName === "IFRAME") return false;
		if (key === "form") return false;
		if (key === "list" && el.tagName === "INPUT") return false;
		if (key === "type" && el.tagName === "TEXTAREA") return false;
		if (key === "width" || key === "height") {
			const tag = el.tagName;
			if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SOURCE") return false;
		}
		if (isNativeOn(key) && isString(value)) return false;
		return key in el;
	}
	function shouldSetAsPropForVueCE(el, key) {
		const props = el._def.props;
		if (!props) return false;
		const camelKey = camelize(key);
		return Array.isArray(props) ? props.some((prop) => camelize(prop) === camelKey) : Object.keys(props).some((prop) => camelize(prop) === camelKey);
	}
	var systemModifiers = [
		"ctrl",
		"shift",
		"alt",
		"meta"
	];
	var modifierGuards = {
		stop: (e) => e.stopPropagation(),
		prevent: (e) => e.preventDefault(),
		self: (e) => e.target !== e.currentTarget,
		ctrl: (e) => !e.ctrlKey,
		shift: (e) => !e.shiftKey,
		alt: (e) => !e.altKey,
		meta: (e) => !e.metaKey,
		left: (e) => "button" in e && e.button !== 0,
		middle: (e) => "button" in e && e.button !== 1,
		right: (e) => "button" in e && e.button !== 2,
		exact: (e, modifiers) => systemModifiers.some((m) => e[`${m}Key`] && !modifiers.includes(m))
	};
	var withModifiers = (fn, modifiers) => {
		if (!fn) return fn;
		const cache = fn._withMods || (fn._withMods = {});
		const cacheKey = modifiers.join(".");
		return cache[cacheKey] || (cache[cacheKey] = ((event, ...args) => {
			for (let i = 0; i < modifiers.length; i++) {
				const guard = modifierGuards[modifiers[i]];
				if (guard && guard(event, modifiers)) return;
			}
			return fn(event, ...args);
		}));
	};
	var rendererOptions = extend({ patchProp }, nodeOps);
	var renderer;
	function ensureRenderer() {
		return renderer || (renderer = createRenderer(rendererOptions));
	}
	var createApp = ((...args) => {
		const app = ensureRenderer().createApp(...args);
		const { mount } = app;
		app.mount = (containerOrSelector) => {
			const container = normalizeContainer(containerOrSelector);
			if (!container) return;
			const component = app._component;
			if (!isFunction(component) && !component.render && !component.template) component.template = container.innerHTML;
			if (container.nodeType === 1) container.textContent = "";
			const proxy = mount(container, false, resolveRootNamespace(container));
			if (container instanceof Element) {
				container.removeAttribute("v-cloak");
				container.setAttribute("data-v-app", "");
			}
			return proxy;
		};
		return app;
	});
	function resolveRootNamespace(container) {
		if (container instanceof SVGElement) return "svg";
		if (typeof MathMLElement === "function" && container instanceof MathMLElement) return "mathml";
	}
	function normalizeContainer(container) {
		if (isString(container)) return document.querySelector(container);
		return container;
	}
	var messages = {
		en: {
			"views.m": "EVR Minimal",
			"views.p": "EVR Minimal+",
			"views.l": "EVR Compact",
			"views.e": "EVR Extended",
			"views.t": "EVR Thumbnail",
			"select.group": "Eh View Refined layouts",
			"columns.published": "Published",
			"columns.title": "Title",
			"columns.uploader": "Uploader",
			"namespaces.language": "language:",
			"namespaces.parody": "parody:",
			"namespaces.character": "character:",
			"namespaces.group": "group:",
			"namespaces.artist": "artist:",
			"namespaces.cosplayer": "cosplayer:",
			"namespaces.male": "male:",
			"namespaces.female": "female:",
			"namespaces.mixed": "mixed:",
			"namespaces.other": "other:",
			"namespaces.reclass": "reclass:",
			"namespaces.location": "location:",
			"namespaces.temp": "temp:",
			"namespaces.uploader": "uploader:",
			"pagination.error": "Automatic loading stopped. Use the Next link to continue.",
			"settings.open": "Eh View Refined settings",
			"settings.title": "Eh View Refined",
			"settings.button": "Settings",
			"settings.browsingSection": "Browsing",
			"settings.infiniteScroll": "Infinite scrolling",
			"settings.close": "Close",
			"settings.language": "Language",
			"settings.languageAuto": "Browser language",
			"settings.tagsSection": "Tags",
			"settings.allMyTags": "Show every My Tags tag",
			"settings.allOtherTags": "Show every other tag",
			"settings.groupTags": "One row per namespace",
			"settings.uploaderTag": "Show the uploader among the tags"
		},
		"zh-TW": {
			"views.m": "EVR 最小模式",
			"views.p": "EVR 最小模式+",
			"views.l": "EVR 緊湊",
			"views.e": "EVR 擴展",
			"views.t": "EVR 縮略圖",
			"select.group": "Eh View Refined 排版",
			"columns.published": "發布時間",
			"columns.title": "標題",
			"columns.uploader": "上傳者",
			"namespaces.language": "語言:",
			"namespaces.parody": "原作:",
			"namespaces.character": "角色:",
			"namespaces.group": "團體:",
			"namespaces.artist": "繪師:",
			"namespaces.cosplayer": "Coser:",
			"namespaces.male": "男:",
			"namespaces.female": "女:",
			"namespaces.mixed": "混:",
			"namespaces.other": "其他:",
			"namespaces.reclass": "分類:",
			"namespaces.location": "地點:",
			"namespaces.temp": "臨時:",
			"namespaces.uploader": "上傳者:",
			"pagination.error": "自動載入已停止，請使用下一頁連結繼續。",
			"settings.open": "Eh View Refined 設定",
			"settings.title": "Eh View Refined",
			"settings.button": "設定",
			"settings.browsingSection": "瀏覽",
			"settings.infiniteScroll": "無限滾動",
			"settings.close": "關閉",
			"settings.language": "語言 / Language",
			"settings.languageAuto": "跟隨瀏覽器 / Browser",
			"settings.tagsSection": "標籤",
			"settings.allMyTags": "顯示完整的 My Tags 標籤",
			"settings.allOtherTags": "顯示完整的非 My Tags 標籤",
			"settings.groupTags": "每個 namespace 一列",
			"settings.uploaderTag": "把上傳者顯示在標籤裡"
		},
		"zh-CN": {
			"views.m": "EVR 最小模式",
			"views.p": "EVR 最小模式+",
			"views.l": "EVR 紧凑",
			"views.e": "EVR 扩展",
			"views.t": "EVR 缩略图",
			"select.group": "Eh View Refined 排版",
			"columns.published": "发布时间",
			"columns.title": "标题",
			"columns.uploader": "上传者",
			"namespaces.language": "语言:",
			"namespaces.parody": "原作:",
			"namespaces.character": "角色:",
			"namespaces.group": "团体:",
			"namespaces.artist": "画师:",
			"namespaces.cosplayer": "Coser:",
			"namespaces.male": "男:",
			"namespaces.female": "女:",
			"namespaces.mixed": "混:",
			"namespaces.other": "其他:",
			"namespaces.reclass": "分类:",
			"namespaces.location": "地点:",
			"namespaces.temp": "临时:",
			"namespaces.uploader": "上传者:",
			"pagination.error": "自动加载已停止，请使用下一页链接继续。",
			"settings.open": "Eh View Refined 设置",
			"settings.title": "Eh View Refined",
			"settings.button": "设置",
			"settings.browsingSection": "浏览",
			"settings.infiniteScroll": "无限滚动",
			"settings.close": "关闭",
			"settings.language": "语言 / Language",
			"settings.languageAuto": "跟随浏览器 / Browser",
			"settings.tagsSection": "标签",
			"settings.allMyTags": "显示完整的 My Tags 标签",
			"settings.allOtherTags": "显示完整的非 My Tags 标签",
			"settings.groupTags": "每个 namespace 一行",
			"settings.uploaderTag": "把上传者显示在标签里"
		},
		ja: {
			"views.m": "EVR Minimal",
			"views.p": "EVR Minimal+",
			"views.l": "EVR Compact",
			"views.e": "EVR Extended",
			"views.t": "EVR Thumbnail",
			"select.group": "Eh View Refined レイアウト",
			"columns.published": "公開日時",
			"columns.title": "タイトル",
			"columns.uploader": "投稿者",
			"namespaces.language": "言語:",
			"namespaces.parody": "原作:",
			"namespaces.character": "キャラ:",
			"namespaces.group": "サークル:",
			"namespaces.artist": "作家:",
			"namespaces.cosplayer": "レイヤー:",
			"namespaces.male": "男性:",
			"namespaces.female": "女性:",
			"namespaces.mixed": "混合:",
			"namespaces.other": "その他:",
			"namespaces.reclass": "再分類:",
			"namespaces.location": "場所:",
			"namespaces.temp": "一時:",
			"namespaces.uploader": "投稿者:",
			"pagination.error": "自動読み込みを停止しました。次のページへのリンクで続けてください。",
			"settings.open": "Eh View Refined の設定",
			"settings.title": "Eh View Refined",
			"settings.button": "設定",
			"settings.browsingSection": "閲覧",
			"settings.infiniteScroll": "無限スクロール",
			"settings.close": "閉じる",
			"settings.language": "言語 / Language",
			"settings.languageAuto": "ブラウザーの言語 / Browser",
			"settings.tagsSection": "タグ",
			"settings.allMyTags": "My Tags のタグをすべて表示",
			"settings.allOtherTags": "その他のタグをすべて表示",
			"settings.groupTags": "namespace ごとに 1 行",
			"settings.uploaderTag": "アップローダーをタグとして表示"
		},
		ko: {
			"views.m": "EVR Minimal",
			"views.p": "EVR Minimal+",
			"views.l": "EVR Compact",
			"views.e": "EVR Extended",
			"views.t": "EVR Thumbnail",
			"select.group": "Eh View Refined 레이아웃",
			"columns.published": "게시일",
			"columns.title": "제목",
			"columns.uploader": "업로더",
			"namespaces.language": "언어:",
			"namespaces.parody": "원작:",
			"namespaces.character": "캐릭터:",
			"namespaces.group": "서클:",
			"namespaces.artist": "작가:",
			"namespaces.cosplayer": "코스어:",
			"namespaces.male": "남성:",
			"namespaces.female": "여성:",
			"namespaces.mixed": "혼합:",
			"namespaces.other": "기타:",
			"namespaces.reclass": "재분류:",
			"namespaces.location": "장소:",
			"namespaces.temp": "임시:",
			"namespaces.uploader": "업로더:",
			"pagination.error": "자동 로딩이 중지되었습니다. 다음 페이지 링크를 이용해 주세요.",
			"settings.open": "Eh View Refined 설정",
			"settings.title": "Eh View Refined",
			"settings.button": "설정",
			"settings.browsingSection": "탐색",
			"settings.infiniteScroll": "무한 스크롤",
			"settings.close": "닫기",
			"settings.language": "언어 / Language",
			"settings.languageAuto": "브라우저 언어 / Browser",
			"settings.tagsSection": "태그",
			"settings.allMyTags": "My Tags 태그를 모두 표시",
			"settings.allOtherTags": "나머지 태그를 모두 표시",
			"settings.groupTags": "namespace마다 한 줄",
			"settings.uploaderTag": "업로더를 태그로 표시"
		}
	};
	var textAttribute = "data-evr-text";
	var labelAttribute = "data-evr-label";
	var current = ref(detectLocale(navigator.languages));
	var locale = readonly(current);
	function t(key) {
		return messages[current.value][key];
	}
	function localizeText(node, key) {
		node.setAttribute(textAttribute, key);
		node.textContent = t(key);
	}
	function localizeLabel(node, key) {
		node.setAttribute(labelAttribute, key);
		node.label = t(key);
	}
	function setLocale(next, root = document) {
		if (current.value === next) return;
		current.value = next;
		for (const node of root.querySelectorAll(`[${textAttribute}]`)) node.textContent = t(node.getAttribute(textAttribute));
		for (const node of root.querySelectorAll(`optgroup[${labelAttribute}]`)) node.label = t(node.getAttribute(labelAttribute));
	}
	var TAG_SELECTOR = ".gt, .gtl, .gtw";
	function carry(origin, clone) {
		clone.checked = origin.checked;
		clone.value = origin.value;
	}
	function copy(node) {
		const clone = node.cloneNode(true);
		const sources = node.querySelectorAll("input, select, textarea");
		const clones = clone.querySelectorAll("input, select, textarea");
		for (let index = 0; index < sources.length; index++) carry(sources[index], clones[index]);
		return clone;
	}
	function syncSelection(from, to) {
		if (from === to) return;
		const states = new Map();
		const key = (input) => input.id || `${input.name}:${input.value}`;
		for (const input of from.querySelectorAll("input[type=\"checkbox\"]")) states.set(key(input), input.checked);
		for (const input of to.querySelectorAll("input[type=\"checkbox\"]")) {
			const checked = states.get(key(input));
			if (checked !== void 0) input.checked = checked;
		}
	}
	function cloneTag(node, text) {
		const clone = node.cloneNode(false);
		clone.removeAttribute("ehs-tag");
		clone.textContent = text;
		return clone;
	}
	function insertItems(container, items) {
		const batch = container.ownerDocument.createDocumentFragment();
		batch.append(...items);
		if (container.ownerDocument.readyState !== "loading") {
			container.append(batch);
			return;
		}
		const tags = Array.from(batch.querySelectorAll(TAG_SELECTOR));
		const texts = tags.map((tag) => {
			const text = tag.firstChild;
			text?.remove();
			return text;
		});
		container.append(batch);
		texts.forEach((text, index) => {
			if (text) tags[index].append(text);
		});
	}
	function createListingHost(source) {
		const doc = source.ownerDocument;
		const wrapper = source.closest(".ido");
		const originalWidth = wrapper?.style.getPropertyValue("max-width") ?? "";
		const originalWidthPriority = wrapper?.style.getPropertyPriority("max-width") ?? "";
		const start = doc.createComment("evr");
		source.before(start);
		let mounted = source;
		function restoreWidth() {
			if (!wrapper || wrapper.style.maxWidth !== "1370px") return;
			if (originalWidth) wrapper.style.setProperty("max-width", originalWidth, originalWidthPriority);
			else wrapper.style.removeProperty("max-width");
		}
		function place(node) {
			if (node === mounted && node.parentNode) return;
			if (mounted !== node && mounted.parentNode) mounted.replaceWith(node);
			else if (start.parentNode) start.after(node);
			mounted = node;
		}
		return {
			get element() {
				return mounted;
			},
			mount(node, view) {
				if (view === "t" && wrapper) wrapper.style.setProperty("max-width", "1370px");
				else restoreWidth();
				place(node);
			},
			dispose() {
				restoreWidth();
				place(source);
				start.remove();
			}
		};
	}
	var TAG_LIMIT = 12;
	function selectTagIndexes(tags, selection, complete) {
		const styled = [];
		const plain = [];
		for (let index = 0; index < tags.length; index++) (tags[index].styled ? styled : plain).push(index);
		const shownStyled = complete.styled ? styled : selection === "none" ? [] : styled.slice(0, TAG_LIMIT);
		const room = Math.max(0, TAG_LIMIT - shownStyled.length);
		const shownPlain = complete.plain ? plain : selection === "styled-first" ? plain.slice(0, room) : [];
		if (selection === "styled-first") return [...shownStyled, ...shownPlain];
		return [...shownStyled, ...shownPlain].sort((a, b) => a - b);
	}
	var plainTagOptions = {
		group: false,
		uploader: false,
		allMyTags: false,
		allOtherTags: false
	};
	var UPLOADER_NAMESPACE = "uploader";
	var GROUPS_CLASS = "evr-tag-groups";
	var UPLOADER_ROW_CLASS = "evr-uploader-row";
	var STYLE_ID = "evr-tag-area-style";
	function uploaderTag(doc, name) {
		const tag = doc.createElement("div");
		const full = `${UPLOADER_NAMESPACE}:${name}`;
		tag.className = `gt ${UPLOADER_TAG_CLASS}`;
		tag.title = full;
		tag.setAttribute("data-evr-tag", full);
		tag.setAttribute("data-evr-ns", UPLOADER_NAMESPACE);
		tag.setAttribute("translate", "no");
		tag.textContent = name;
		return tag;
	}
	var NAMESPACE_LABELS = {
		language: "namespaces.language",
		parody: "namespaces.parody",
		character: "namespaces.character",
		group: "namespaces.group",
		artist: "namespaces.artist",
		cosplayer: "namespaces.cosplayer",
		male: "namespaces.male",
		female: "namespaces.female",
		mixed: "namespaces.mixed",
		other: "namespaces.other",
		reclass: "namespaces.reclass",
		location: "namespaces.location",
		temp: "namespaces.temp",
		[UPLOADER_NAMESPACE]: "namespaces.uploader"
	};
	function groupRow(doc, namespace, tags) {
		const row = doc.createElement("tr");
		const label = doc.createElement("td");
		label.className = "tc";
		if (namespace !== null && Object.hasOwn(NAMESPACE_LABELS, namespace)) localizeText(label, NAMESPACE_LABELS[namespace]);
		else label.textContent = namespace ? `${namespace}:` : "";
		const cell = doc.createElement("td");
		cell.append(...tags);
		row.append(label, cell);
		return row;
	}
	function groupTable(doc, groups) {
		const table = doc.createElement("table");
		table.className = GROUPS_CLASS;
		const body = doc.createElement("tbody");
		for (const [namespace, tags] of groups) body.append(groupRow(doc, namespace, tags));
		table.append(body);
		return table;
	}
	function tagAreaOf(gallery, selection, options, className) {
		const doc = gallery.bindings.title.ownerDocument;
		const { tags, uploader } = gallery.snapshot;
		const groups = new Map();
		for (const index of selectTagIndexes(tags, selection, {
			styled: options.allMyTags,
			plain: options.allOtherTags
		})) {
			const clone = cloneTag(gallery.bindings.tags[index], tags[index].text);
			if (className !== void 0) clone.className = className;
			const namespace = tags[index].namespace;
			const members = groups.get(namespace);
			if (members) members.push(clone);
			else groups.set(namespace, [clone]);
		}
		const shown = options.uploader && uploader !== null ? uploaderTag(doc, uploader) : null;
		if (!options.group) {
			const flat = [...groups.values()].flat();
			return shown ? [...flat, shown] : flat;
		}
		if (shown) groups.set(UPLOADER_NAMESPACE, [shown]);
		return groups.size ? [groupTable(doc, groups)] : [];
	}
	function syncUploaderRow(row, uploader, enabled) {
		const existing = row.querySelector(`tr.${UPLOADER_ROW_CLASS}`);
		if (!enabled || uploader === null) {
			existing?.remove();
			return;
		}
		if (existing) return;
		const name = row.querySelector(".gl4e");
		if (!name) return;
		const doc = row.ownerDocument;
		const line = groupRow(doc, UPLOADER_NAMESPACE, [uploaderTag(doc, uploader)]);
		line.className = UPLOADER_ROW_CLASS;
		const body = name.querySelector("table")?.tBodies[0];
		if (body) {
			body.append(line);
			return;
		}
		const table = doc.createElement("table");
		const created = doc.createElement("tbody");
		created.append(line);
		table.append(created);
		const holder = doc.createElement("div");
		holder.append(table);
		name.append(holder);
	}
	function installTagAreaStyles(doc) {
		if (doc.getElementById(STYLE_ID)) return;
		const style = doc.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
.${GROUPS_CLASS} { border-collapse: collapse; border-spacing: 0; margin: 0; }
.${GROUPS_CLASS} td { padding: 0; border: none; vertical-align: top; }
.${GROUPS_CLASS} td.tc { padding: 2px 4px 0 0; white-space: nowrap; text-align: right; }
.gltm:has(> .${GROUPS_CLASS}) { max-height: none; }`;
		(doc.head ?? doc.documentElement).append(style);
	}
	var sectionTags = {
		TBODY: true,
		THEAD: true,
		TFOOT: true
	};
	function createExtendedSource(source, onRows, uploaderTag = () => false) {
		const doc = source.ownerDocument;
		const entries = [];
		let strip = createItemStrip();
		const known = new Set();
		const visited = new WeakSet();
		const parser = doc.createElement("template");
		let parsed = false;
		let disposed = false;
		function sourceParsed() {
			if (!parsed && doc.readyState !== "loading") parsed = true;
			return parsed;
		}
		function collect() {
			const candidates = outerRows(source);
			const limit = sourceParsed() ? candidates.length : candidates.length - 1;
			for (let index = 0; index < limit; index++) {
				const row = candidates[index];
				if (visited.has(row)) continue;
				visited.add(row);
				const key = galleryKey(row);
				if (!key || known.has(key)) continue;
				capture(row);
				known.add(key);
				entries.push({
					gid: key.split("/")[0],
					row,
					html: null
				});
				strip.push(row);
			}
		}
		function capture(row) {
			captureGalleryTags(row);
			syncUploaderRow(row, captureGalleryUploader(row), uploaderTag());
			captureGalleryRating(row);
		}
		function parse(html) {
			parser.innerHTML = html;
			const row = parser.content.firstElementChild;
			row.remove();
			return row;
		}
		function section() {
			for (let index = source.children.length - 1; index >= 0; index--) {
				const child = source.children[index];
				if (sectionTags[child.tagName]) return child;
			}
			return source;
		}
		const observer = new MutationObserver(() => {
			if (disposed) return;
			watch();
			collect();
			onRows();
		});
		function watch() {
			observer.observe(source, { childList: true });
			for (const child of source.children) if (sectionTags[child.tagName]) observer.observe(child, { childList: true });
		}
		watch();
		collect();
		return {
			get count() {
				return entries.length;
			},
			get strip() {
				return strip;
			},
			gallery(index) {
				const entry = entries[index];
				if (!entry) return null;
				const gallery = adaptExtendedGallery(entry.row ?? parse(entry.html));
				if (!gallery) return null;
				gallery.snapshot.previousGid = entries[index - 1]?.gid ?? "0";
				gallery.snapshot.nextGid = entries[index + 1]?.gid ?? "0";
				return gallery;
			},
			release() {
				let released = false;
				for (const entry of entries) {
					if (!entry.row) continue;
					entry.html = entry.row.outerHTML;
					entry.row.remove();
					entry.row = null;
					released = true;
				}
				if (released) strip = createItemStrip();
			},
			restore() {
				const rebuilt = doc.createDocumentFragment();
				let anchor = null;
				for (const entry of entries) {
					if (entry.row) {
						anchor ??= entry.row;
						continue;
					}
					const row = parse(entry.html);
					syncUploaderRow(row, captureGalleryUploader(row), uploaderTag());
					visited.add(row);
					entry.row = row;
					entry.html = null;
					rebuilt.append(row);
				}
				if (!rebuilt.firstChild) return;
				anchor ??= outerRows(source).find((row) => !visited.has(row)) ?? null;
				if (anchor) anchor.before(rebuilt);
				else section().append(rebuilt);
				strip = createItemStrip();
				for (const entry of entries) strip.push(entry.row);
			},
			collect,
			syncUploaderTags() {
				for (const entry of entries) if (entry.row) syncUploaderRow(entry.row, captureGalleryUploader(entry.row), uploaderTag());
			},
			appendPage(page) {
				const table = page.querySelector(sourceSelector);
				if (!table) throw new Error("eh-view-refined: the response carries no Extended listing");
				const batch = doc.createDocumentFragment();
				const incoming = new Set();
				for (const row of outerRows(table)) {
					const key = galleryKey(row);
					if (!key || known.has(key) || incoming.has(key)) continue;
					incoming.add(key);
					capture(row);
					batch.append(row);
				}
				const added = incoming.size;
				section().append(batch);
				collect();
				return added;
			},
			dispose() {
				disposed = true;
				observer.disconnect();
			}
		};
	}
	function coverGeometry(width, height) {
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
		const scaledHeight = Math.round(height * 250 / width);
		const frameHeight = Math.min(340, scaledHeight);
		return {
			width: 250,
			height: scaledHeight,
			frameHeight,
			top: Math.trunc((frameHeight - scaledHeight) / 2)
		};
	}
	function element(doc, tag, className) {
		const node = doc.createElement(tag);
		if (className) node.className = className;
		return node;
	}
	function coverOf(gallery) {
		const { cover } = gallery.snapshot;
		const source = gallery.bindings.cover;
		if (!cover || !source) return {
			image: null,
			height: 0
		};
		const image = copy(source);
		if (cover.deferredSource) {
			image.setAttribute("src", cover.deferredSource);
			image.removeAttribute("data-src");
		}
		const geometry = coverGeometry(cover.width, cover.height);
		if (geometry) {
			image.style.width = `${geometry.width}px`;
			image.style.height = `${geometry.height}px`;
			image.style.top = `${geometry.top}px`;
		}
		return {
			image,
			height: geometry ? geometry.height : cover.sourceHeight
		};
	}
	function categoryOf(gallery, className) {
		const source = gallery.bindings.category;
		if (!source) return null;
		const clone = copy(source);
		const tone = gallery.snapshot.categoryTone;
		clone.className = tone ? `${className} ${tone}` : className;
		return clone;
	}
	function postedOf(gallery, id) {
		const source = gallery.bindings.posted;
		if (!source) return null;
		const clone = copy(source);
		clone.id = id;
		return clone;
	}
	function downloadOf(doc, gallery) {
		const source = gallery.bindings.download;
		return source ? copy(source) : element(doc, "div", "gldown");
	}
	function titleOf(doc, gallery, className) {
		const link = element(doc, "a");
		link.setAttribute("href", gallery.snapshot.href);
		const title = copy(gallery.bindings.title);
		title.className = className;
		link.append(title);
		return link;
	}
	var PANE_FOOTER = 46;
	function paneOf(doc, gallery, categoryClassName) {
		const pane = element(doc, "div", "glthumb");
		pane.id = `it${gallery.snapshot.gid}`;
		const picture = element(doc, "div");
		const cover = coverOf(gallery);
		if (cover.image) picture.append(cover.image);
		pane.append(picture);
		const footer = element(doc, "div");
		const left = element(doc, "div");
		const category = categoryOf(gallery, categoryClassName);
		if (category) left.append(category);
		const posted = postedOf(gallery, `postedpop_${gallery.snapshot.gid}`);
		if (posted) left.append(posted);
		const right = element(doc, "div");
		if (gallery.bindings.rating) right.append(copy(gallery.bindings.rating));
		right.append(gallery.bindings.pages ? copy(gallery.bindings.pages) : element(doc, "div"));
		footer.append(left, right);
		pane.append(footer);
		pane.style.height = `${(cover.height || gallery.snapshot.frameHeight) + PANE_FOOTER}px`;
		return pane;
	}
	function categoryCell({ doc, gallery, definition }) {
		const cell = element(doc, "td");
		const category = categoryOf(gallery, definition.categoryClassName);
		if (category) cell.append(category);
		return cell;
	}
	function publishedCell({ gallery, preview }) {
		const posted = postedOf(gallery, `posted_${gallery.snapshot.gid}`);
		if (posted) preview.append(posted);
		return preview;
	}
	function metadataCell({ doc, gallery, preview }) {
		const stack = element(doc, "div");
		const posted = postedOf(gallery, `posted_${gallery.snapshot.gid}`);
		if (posted) stack.append(posted);
		if (gallery.bindings.rating) stack.append(copy(gallery.bindings.rating));
		stack.append(downloadOf(doc, gallery));
		preview.append(stack);
		return preview;
	}
	function downloadCell({ doc, gallery }) {
		const cell = element(doc, "td");
		cell.append(downloadOf(doc, gallery));
		return cell;
	}
	function titleCell(context) {
		const { doc, gallery, definition } = context;
		const cell = element(doc, "td");
		const title = titleOf(doc, gallery, "glink");
		const tags = tagAreaOf(gallery, definition.tags, context.tagOptions, "gt");
		if (tags.length > 0) {
			const holder = element(doc, "div", definition.titleTagsClassName);
			holder.append(...tags);
			title.append(holder);
		}
		cell.append(title);
		if (gallery.bindings.note) cell.append(copy(gallery.bindings.note));
		context.hover = cell;
		return cell;
	}
	function ratingCell({ doc, gallery }) {
		const cell = element(doc, "td");
		if (gallery.bindings.rating) cell.append(copy(gallery.bindings.rating));
		return cell;
	}
	function uploaderCell({ doc, gallery }) {
		const cell = element(doc, "td");
		cell.append(gallery.bindings.uploader ? copy(gallery.bindings.uploader) : element(doc, "div"));
		return cell;
	}
	function uploaderWithPagesCell(context) {
		const cell = uploaderCell(context);
		const pages = context.gallery.bindings.pages;
		cell.append(pages ? copy(pages) : element(context.doc, "div"));
		return cell;
	}
	function favouriteCell(doc, gallery, className) {
		const { favorited, selection } = gallery.bindings;
		if (!favorited && !selection) return null;
		const cell = element(doc, "td", className);
		if (favorited) {
			const line = element(doc, "p");
			line.append(...copy(favorited).childNodes);
			cell.append(line);
		}
		if (selection) cell.append(...copy(selection).childNodes);
		return cell;
	}
	function tableItem(doc, gallery, definition, tagOptions) {
		const row = doc.createElement("tr");
		if (gallery.snapshot.fresh !== null) row.setAttribute("data-new", gallery.snapshot.fresh);
		const preview = element(doc, "td");
		const cut = element(doc, "div", "glcut");
		cut.id = `ic${gallery.snapshot.gid}`;
		const pane = paneOf(doc, gallery, definition.categoryClassName);
		preview.append(cut, pane);
		const context = {
			doc,
			gallery,
			definition,
			preview,
			hover: null,
			tagOptions
		};
		for (const column of definition.columns) {
			const cell = column.render(context);
			cell.className = column.className;
			row.append(cell);
		}
		context.hover?.addEventListener("mouseover", () => {
			const top = preview.getBoundingClientRect().top;
			const height = pane.getBoundingClientRect().height;
			const bottom = (doc.defaultView?.innerHeight ?? height) - top - height;
			pane.style.top = `${Math.max(-top, Math.min(0, bottom))}px`;
		});
		const favourite = favouriteCell(doc, gallery, definition.favouriteClassName);
		if (favourite) row.append(favourite);
		return {
			node: row,
			hover: context.hover
		};
	}
	function tableLayout(definition) {
		return {
			root: {
				tag: "table",
				className: definition.rootClassName
			},
			createContainer(root) {
				const doc = root.ownerDocument;
				const body = doc.createElement("tbody");
				const header = doc.createElement("tr");
				for (const column of definition.columns) {
					const cell = element(doc, "th", column.headerClassName);
					if (column.header) localizeText(cell, column.header);
					header.append(cell);
				}
				root.append(body);
				body.append(header);
				return body;
			},
			renderItem: (doc, gallery, tagOptions) => tableItem(doc, gallery, definition, tagOptions)
		};
	}
	var minimalStructure = {
		rootClassName: "itg gltm",
		categoryClassName: "cs",
		columns: [
			{
				className: "gl1m glcat",
				render: categoryCell
			},
			{
				className: "gl2m",
				header: "columns.published",
				render: publishedCell
			},
			{
				className: "gl6m",
				render: downloadCell
			},
			{
				className: "gl3m glname",
				header: "columns.title",
				render: titleCell
			},
			{
				className: "gl4m",
				render: ratingCell
			},
			{
				className: "gl5m glhide",
				header: "columns.uploader",
				headerClassName: "glhide",
				render: uploaderCell
			}
		],
		favouriteClassName: "glfav"
	};
	var minimalLayout = tableLayout({
		...minimalStructure,
		tags: "none"
	});
	var minimalPlusLayout = tableLayout({
		...minimalStructure,
		tags: "styled",
		titleTagsClassName: "gltm"
	});
	var compactLayout = tableLayout({
		rootClassName: "itg gltc",
		categoryClassName: "cn",
		columns: [
			{
				className: "gl1c glcat",
				render: categoryCell
			},
			{
				className: "gl2c",
				header: "columns.published",
				render: metadataCell
			},
			{
				className: "gl3c glname",
				header: "columns.title",
				render: titleCell
			},
			{
				className: "gl4c glhide",
				header: "columns.uploader",
				headerClassName: "glhide",
				render: uploaderWithPagesCell
			}
		],
		favouriteClassName: "glfav glfc",
		tags: "styled-first"
	});
	function installNativeThumbnailStyles(doc) {
		if (doc.getElementById("evr-native-thumbnail-style")) return;
		const style = doc.createElement("style");
		style.id = "evr-native-thumbnail-style";
		style.textContent = `
@supports (display: grid) {
  .gld { display: grid; grid-template-columns: repeat(5, 1fr); }
  .gl1t { min-width: 250px; max-width: 400px; }
  @media screen and (max-width: 1360px) { .gld { grid-template-columns: repeat(4, 1fr); } }
  @media screen and (max-width: 1090px) { .gld { grid-template-columns: repeat(3, 1fr); } }
  @media screen and (max-width: 820px) { .gld { grid-template-columns: repeat(2, 1fr); } }
}`;
		(doc.head ?? doc.documentElement).append(style);
	}
	function favouritePanel(doc, gallery) {
		const { favorited, selection } = gallery.bindings;
		if (!favorited && !selection) return null;
		const holder = element(doc, "div", "glft");
		const date = element(doc, "div");
		if (favorited) date.append(...copy(favorited).childNodes);
		const select = element(doc, "div");
		if (selection) select.append(...copy(selection).childNodes);
		holder.append(date, select);
		return holder;
	}
	function thumbnailItem(doc, gallery, tagOptions) {
		const { snapshot, bindings } = gallery;
		const card = element(doc, "div", "gl1t");
		if (snapshot.fresh !== null) card.setAttribute("data-new", snapshot.fresh);
		card.append(titleOf(doc, gallery, "gl4t glname glink"));
		const frame = element(doc, "div", "gl3t");
		if (snapshot.frameStyle) frame.setAttribute("style", snapshot.frameStyle);
		const link = element(doc, "a");
		link.setAttribute("href", snapshot.href);
		const cover = coverOf(gallery);
		if (cover.image) {
			link.append(cover.image);
			if (cover.height > 0) {
				frame.style.width = "250px";
				frame.style.height = `${Math.min(340, cover.height)}px`;
			}
		}
		frame.append(link);
		card.append(frame);
		const tags = tagAreaOf(gallery, "styled", tagOptions);
		if (tags.length > 0) {
			const row = element(doc, "div", "gl6t");
			row.append(...tags);
			card.append(row);
		}
		const footer = element(doc, "div", "gl5t");
		const left = element(doc, "div");
		const category = categoryOf(gallery, "cs");
		if (category) left.append(category);
		const posted = postedOf(gallery, `posted_${snapshot.gid}`);
		if (posted) left.append(posted);
		const right = element(doc, "div");
		if (bindings.rating) right.append(copy(bindings.rating));
		right.append(bindings.pages ? copy(bindings.pages) : element(doc, "div"));
		right.append(downloadOf(doc, gallery));
		footer.append(left, right);
		card.append(footer);
		const favourite = favouritePanel(doc, gallery);
		if (favourite) card.append(favourite);
		if (bindings.note) card.append(copy(bindings.note));
		return {
			node: card,
			hover: null
		};
	}
	var nativeLayouts = {
		m: minimalLayout,
		p: minimalPlusLayout,
		l: compactLayout,
		t: {
			root: {
				tag: "div",
				className: "itg gld"
			},
			initialize: installNativeThumbnailStyles,
			renderItem: thumbnailItem
		}
	};
	function createNativeListing(doc, view, tagOptions) {
		const layout = nativeLayouts[view];
		layout.initialize?.(doc);
		installTagAreaStyles(doc);
		const root = doc.createElement(layout.root.tag);
		root.className = layout.root.className;
		root.setAttribute("data-evr-view", view);
		const container = layout.createContainer?.(root) ?? root;
		const seen = new Set();
		const strip = createItemStrip();
		function render(gallery) {
			const { snapshot } = gallery;
			const item = layout.renderItem(doc, gallery, tagOptions);
			item.node.setAttribute("data-evr-tags", snapshot.tagData);
			if (snapshot.uploader !== null) item.node.setAttribute("data-evr-uploader", snapshot.uploader);
			if (snapshot.rating !== null) item.node.setAttribute("data-evr-rating", String(snapshot.rating));
			if (snapshot.myRating !== null) item.node.setAttribute("data-evr-my-rating", String(snapshot.myRating));
			if (item.hover) {
				item.hover.setAttribute("onmouseover", `show_image_pane(${snapshot.gid});preload_pane_image(${snapshot.previousGid},${snapshot.nextGid})`);
				item.hover.setAttribute("onmouseout", "hide_image_pane()");
			}
			return item.node;
		}
		return {
			element: root,
			strip,
			append(galleries) {
				const nodes = [];
				for (const gallery of galleries) {
					if (seen.has(gallery.snapshot.gid)) continue;
					seen.add(gallery.snapshot.gid);
					nodes.push(render(gallery));
				}
				if (!nodes.length) return 0;
				for (const node of nodes) strip.push(node);
				insertItems(container, nodes);
				return nodes.length;
			}
		};
	}
	function createListingPipeline(source, tagOptions = () => plainTagOptions) {
		const doc = source.ownerDocument;
		const host = createListingHost(source);
		let active = null;
		let disposed = false;
		const input = createExtendedSource(source, publish, () => tagOptions().uploader);
		const listeners = new Set();
		function notify() {
			for (const listener of listeners) listener();
		}
		function feed(listing) {
			const batch = [];
			while (listing.fed < input.count) {
				const gallery = input.gallery(listing.fed++);
				if (gallery) batch.push(gallery);
			}
			listing.native.append(batch);
			input.release();
		}
		function open(next) {
			return {
				view: next,
				native: createNativeListing(doc, next, tagOptions()),
				fed: 0
			};
		}
		function publish() {
			if (active) feed(active);
			notify();
		}
		function flush() {
			if (disposed) return;
			input.collect();
			publish();
		}
		doc.addEventListener("DOMContentLoaded", flush);
		return {
			get element() {
				return host.element;
			},
			get strip() {
				return active ? active.native.strip : input.strip;
			},
			flush,
			setView(next) {
				if (disposed) return;
				const previous = host.element;
				if (next === "e") {
					input.restore();
					active = null;
					host.mount(source, next);
					syncSelection(previous, source);
					notify();
					return;
				}
				if (active?.view !== next) active = open(next);
				host.mount(active.native.element, next);
				feed(active);
				syncSelection(previous, active.native.element);
				notify();
			},
			appendPage(page) {
				if (disposed) return 0;
				const added = input.appendPage(page);
				publish();
				return added;
			},
			watch(listener) {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			refreshTags() {
				if (disposed) return;
				input.syncUploaderTags();
				if (!active) return;
				const previous = active.native.element;
				active = open(active.view);
				host.mount(active.native.element, active.view);
				feed(active);
				syncSelection(previous, active.native.element);
				notify();
			},
			revealAll() {
				const strip = active ? active.native.strip : input.strip;
				strip.setRange(0, strip.count);
			},
			dispose() {
				if (disposed) return;
				disposed = true;
				listeners.clear();
				const shown = host.element;
				input.restore();
				input.dispose();
				doc.removeEventListener("DOMContentLoaded", flush);
				syncSelection(shown, source);
				host.dispose();
			}
		};
	}
	var listViews = [
		"m",
		"p",
		"l",
		"e",
		"t"
	];
	var simulatedPrefix = "evr-";
	var storageKey = "ehe:view";
	var inlineSetParameter = "inline_set";
	var nativeExtendedMode = "dm_e";
	function isListView(value) {
		return listViews.includes(value);
	}
	function parseModeValue(value) {
		if (value.startsWith("evr-")) {
			const view = value.slice(4);
			return isListView(view) ? {
				kind: "simulated",
				view
			} : null;
		}
		return isListView(value) ? {
			kind: "native",
			mode: value
		} : null;
	}
	function nativeExtendedUrl(href) {
		const url = new URL(href);
		url.searchParams.set(inlineSetParameter, nativeExtendedMode);
		return url.toString();
	}
	function planModeChange(value, context) {
		const choice = parseModeValue(value);
		if (!choice) return { kind: "ignore" };
		if (choice.kind === "native") return {
			kind: "native",
			mode: choice.mode
		};
		if (context.extended) return {
			kind: "apply",
			view: choice.view
		};
		return {
			kind: "navigate",
			view: choice.view,
			url: nativeExtendedUrl(context.href)
		};
	}
	function initialView(stored, extended) {
		if (!extended) return "e";
		return stored ?? "t";
	}
	function readStoredView(storage) {
		const stored = storage.getItem(storageKey);
		return stored && isListView(stored) ? stored : null;
	}
	function storeView(storage, view) {
		if (view === null) storage.removeItem(storageKey);
		else storage.setItem(storageKey, view);
	}
	var navSelector = ".searchnav";
	var groupAttribute = "data-evr-modes";
	function isModeSelect(node) {
		if (!(node instanceof HTMLSelectElement) || !node.closest(navSelector)) return false;
		const values = new Set(Array.from(node.options, (option) => option.value));
		return listViews.every((view) => values.has(view));
	}
	function findModeSelects(root) {
		return Array.from(root.querySelectorAll(`${navSelector} select`)).filter(isModeSelect);
	}
	function decorateModeSelect(select) {
		const existing = select.querySelectorAll(`optgroup[${groupAttribute}]`);
		if (existing.length === 1) return;
		for (const stale of existing) stale.remove();
		const group = document.createElement("optgroup");
		group.setAttribute(groupAttribute, "");
		group.setAttribute("translate", "no");
		localizeLabel(group, "select.group");
		for (const view of listViews) {
			const option = document.createElement("option");
			option.value = view;
			localizeText(option, `views.${view}`);
			group.append(option);
		}
		select.append(group);
	}
	function undecorateModeSelect(select) {
		for (const group of select.querySelectorAll(`optgroup[${groupAttribute}]`)) group.remove();
	}
	function readModeChoice(select) {
		for (const option of select.options) {
			if (!option.selected) continue;
			return option.closest(`optgroup[${groupAttribute}]`) ? `${simulatedPrefix}${option.value}` : option.value;
		}
		return select.value;
	}
	function syncModeSelect(select, view) {
		const selected = Array.from(select.options).find((option) => option.value === view && option.closest(`optgroup[${groupAttribute}]`));
		if (!selected) return;
		for (const option of select.options) option.toggleAttribute("selected", option === selected);
		selected.selected = true;
	}
	function observeModeSelects(root, onMutate) {
		const watched = new WeakSet();
		const scoped = new MutationObserver(() => {
			onMutate();
			scoped.takeRecords();
		});
		function watch(nav) {
			if (watched.has(nav)) return;
			watched.add(nav);
			scoped.observe(nav, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: [
					"class",
					"style",
					"hidden"
				]
			});
		}
		function scan() {
			for (const nav of root.querySelectorAll(navSelector)) watch(nav);
		}
		const bootstrap = new MutationObserver((records) => {
			let found = false;
			for (const record of records) for (const node of record.addedNodes) {
				if (!(node instanceof Element)) continue;
				if (node.matches(navSelector)) {
					watch(node);
					found = true;
				} else if (node.firstElementChild) for (const nav of node.querySelectorAll(navSelector)) {
					watch(nav);
					found = true;
				}
			}
			if (found) onMutate();
		});
		function settle() {
			bootstrap.disconnect();
			document.removeEventListener("DOMContentLoaded", settle);
			scan();
			onMutate();
		}
		scan();
		if (document.readyState === "loading") {
			bootstrap.observe(document, {
				childList: true,
				subtree: true
			});
			document.addEventListener("DOMContentLoaded", settle);
		}
		return () => {
			bootstrap.disconnect();
			scoped.disconnect();
			document.removeEventListener("DOMContentLoaded", settle);
		};
	}
	function startViewSwitcher(options) {
		const root = options.root ?? document;
		const extended = options.table !== null;
		if (!extended && findModeSelects(root).length === 0) return null;
		const storage = options.storage ?? window.sessionStorage;
		const href = options.href ?? (() => location.href);
		const navigate = options.navigate ?? ((url) => location.assign(url));
		const presentation = options.table ? createListingPipeline(options.table, options.tagOptions) : null;
		let view = initialView(readStoredView(storage), extended);
		function refresh() {
			for (const select of findModeSelects(root)) {
				decorateModeSelect(select);
				if (extended) syncModeSelect(select, view);
			}
		}
		function apply(next) {
			view = next;
			presentation?.setView(next);
			refresh();
		}
		function onChange(event) {
			if (!isModeSelect(event.target)) return;
			const transition = planModeChange(readModeChoice(event.target), {
				extended,
				href: href()
			});
			if (transition.kind === "ignore") return;
			if (transition.kind === "native") {
				storeView(storage, transition.mode === "e" ? "e" : null);
				return;
			}
			event.stopPropagation();
			event.stopImmediatePropagation();
			storeView(storage, transition.view);
			if (transition.kind === "apply") apply(transition.view);
			else navigate(transition.url);
		}
		apply(view);
		document.addEventListener("change", onChange, true);
		const stopObserving = observeModeSelects(root, refresh);
		return {
			presentation,
			dispose() {
				stopObserving();
				document.removeEventListener("change", onChange, true);
				for (const select of findModeSelects(root)) undecorateModeSelect(select);
				presentation?.dispose();
			}
		};
	}
	function startEarlyListing(onReady) {
		let switcher = null;
		let started = false;
		let disposed = false;
		function start(table) {
			if (started || disposed) return;
			started = true;
			observer.disconnect();
			switcher = startViewSwitcher({
				table,
				tagOptions: () => ({
					group: getGroupTags(),
					uploader: getUploaderTag(),
					allMyTags: getAllMyTags(),
					allOtherTags: getAllOtherTags()
				})
			});
		}
		const observer = new MutationObserver((records) => {
			for (const record of records) for (const node of record.addedNodes) {
				if (!(node instanceof Element)) continue;
				const table = node.matches("table.itg.glte") ? node : node.firstElementChild && node.querySelector("table.itg.glte");
				if (table) {
					start(table);
					return;
				}
			}
		});
		function ready() {
			document.removeEventListener("DOMContentLoaded", ready);
			if (disposed) return;
			start(null);
			if (!switcher) return;
			switcher.presentation?.flush();
			onReady?.(switcher);
		}
		observer.observe(document, {
			childList: true,
			subtree: true
		});
		const parsed = document.querySelector(sourceSelector);
		if (parsed) start(parsed);
		if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
		else ready();
		return { dispose() {
			if (disposed) return;
			disposed = true;
			observer.disconnect();
			document.removeEventListener("DOMContentLoaded", ready);
			switcher?.dispose();
		} };
	}
	function startPagination(presentation) {
		const doc = presentation.element.ownerDocument;
		const win = doc.defaultView;
		const bottom = doc.querySelectorAll(".searchnav")[1];
		if (!bottom) return () => {};
		function nextUrl(page, base) {
			const href = page.querySelector("#dnext")?.getAttribute("href");
			return href ? new URL(href, base).href : null;
		}
		let next = nextUrl(doc, doc.URL);
		let loading = false;
		let disposed = false;
		const visited = new Set([doc.URL]);
		const abort = new AbortController();
		const errorNotice = doc.createElement("p");
		errorNotice.setAttribute("translate", "no");
		function updateNextLinks(page) {
			for (const id of ["unext", "dnext"]) {
				const current = doc.getElementById(id);
				const replacement = page.getElementById(id);
				if (current && replacement) current.replaceWith(doc.importNode(replacement, true));
				else current?.remove();
			}
		}
		async function fetchPage(url) {
			for (const target of [url, nativeExtendedUrl(url)]) {
				const response = await win.fetch(target, { signal: abort.signal });
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const page = new win.DOMParser().parseFromString(await response.text(), "text/html");
				if (page.querySelector("table.itg.glte")) return {
					page,
					base: response.url || url
				};
			}
			throw new Error("eh-view-refined: the response carries no Extended listing");
		}
		async function load() {
			if (loading || disposed || !next) return;
			loading = true;
			try {
				do {
					const url = next;
					if (visited.has(url)) {
						next = null;
						break;
					}
					const { page, base } = await fetchPage(url);
					if (disposed) return;
					presentation.appendPage(page);
					visited.add(url);
					next = nextUrl(page, base);
					updateNextLinks(page);
				} while (next && !disposed && bottom.getBoundingClientRect().top <= win.innerHeight + 400);
				if (!next) observer.disconnect();
			} catch (error) {
				if (!disposed) {
					observer.disconnect();
					localizeText(errorNotice, "pagination.error");
					bottom.after(errorNotice);
					console.error("[Eh View Refined] Pagination stopped:", error);
				}
			} finally {
				loading = false;
			}
		}
		const observer = new win.IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) load();
		}, { rootMargin: "400px" });
		if (next) observer.observe(bottom);
		return () => {
			disposed = true;
			abort.abort();
			observer.disconnect();
			errorNotice.remove();
		};
	}
	var POSITION_PARAMETERS = [
		"prev",
		"next",
		"jump",
		"seek",
		"range",
		"inline_set"
	];
	var GID_CURSOR = /^\d+$/;
	var SETTLE_MS = 250;
	function pagesByGid(root) {
		const cursorHref = root.querySelector("#unext[href], #dnext[href], #uprev[href], #dprev[href]")?.getAttribute("href");
		if (!cursorHref) return false;
		const url = new URL(cursorHref, "https://e-hentai.org/");
		const cursor = url.searchParams.get("next") ?? url.searchParams.get("prev");
		return cursor !== null && GID_CURSOR.test(cursor);
	}
	function positionUrl(href, gid) {
		const url = new URL(href);
		for (const name of POSITION_PARAMETERS) url.searchParams.delete(name);
		url.searchParams.set("next", String(Number(gid) + 1));
		return url.toString();
	}
	function startLiveUrl(presentation, origin) {
		const doc = presentation.element.ownerDocument;
		const win = doc.defaultView;
		if (!pagesByGid(doc)) return () => {};
		let written = win.location.href;
		let timer = 0;
		function topGallery() {
			const strip = presentation.strip;
			for (let index = strip.start; index < strip.end; index++) {
				const node = strip.nodeAt(index);
				if (node && node.getBoundingClientRect().bottom > 0) return {
					index,
					node
				};
			}
			return null;
		}
		function write() {
			timer = 0;
			const top = topGallery();
			if (!top) return;
			const key = top.index === 0 ? null : galleryKey(top.node);
			const next = key ? positionUrl(origin.href, key.split("/")[0]) : origin.href;
			if (next === written) return;
			win.history.scrollRestoration = next === origin.href ? origin.scrollRestoration : "manual";
			win.history.replaceState(win.history.state, "", next);
			written = next;
		}
		function schedule() {
			if (timer) win.clearTimeout(timer);
			timer = win.setTimeout(write, SETTLE_MS);
		}
		win.addEventListener("scroll", schedule, { passive: true });
		return () => {
			if (timer) win.clearTimeout(timer);
			win.removeEventListener("scroll", schedule);
		};
	}
	var PAGE_SIZE = 25;
	function createWindowMemory() {
		return {
			step: 0,
			heights: [],
			fallback: 0
		};
	}
	function chunkSize(columns) {
		const lines = Math.max(1, Math.floor(columns));
		return lines * Math.ceil(PAGE_SIZE / lines);
	}
	function estimate(memory, chunk) {
		return memory.heights[chunk] ?? memory.fallback;
	}
	function itemsIn(chunk, step, count) {
		return Math.max(0, Math.min(step, count - chunk * step));
	}
	function spacers(memory, count, range) {
		const step = memory.step;
		if (!step) return {
			above: 0,
			below: 0
		};
		let above = 0;
		for (let chunk = 0; chunk < range.start / step; chunk++) above += estimate(memory, chunk);
		let below = 0;
		if (range.end < count) for (let chunk = range.end / step; chunk * step < count; chunk++) below += memory.heights[chunk] ?? memory.fallback * itemsIn(chunk, step, count) / step;
		return {
			above,
			below
		};
	}
	function regroup(geometry, memory, step) {
		const { count, start, end } = geometry;
		const before = spacers(memory, count, geometry);
		const perAbove = start ? before.above / start : memory.fallback / step;
		const perBelow = end < count ? before.below / (count - end) : memory.fallback / step;
		const nextStart = start - start % step;
		const nextEnd = end >= count ? count : Math.min(count, Math.ceil(end / step) * step);
		const heights = [];
		for (let chunk = 0; chunk * step < count; chunk++) {
			const items = itemsIn(chunk, step, count);
			heights.push((chunk * step < nextStart ? perAbove : perBelow) * items);
		}
		memory.step = step;
		memory.heights = heights;
		return {
			start: nextStart,
			end: nextEnd,
			target: null
		};
	}
	function planWindow(geometry, memory) {
		const { count, start, end, viewport, reach } = geometry;
		if (count === 0) return null;
		const step = chunkSize(geometry.columns);
		if (start >= end) {
			memory.step = step;
			return {
				start: 0,
				end: Math.min(count, step),
				target: null
			};
		}
		if (memory.step === 0) memory.step = step;
		else if (memory.step !== step) return regroup(geometry, memory, step);
		const top = geometry.top(start);
		const bottom = geometry.bottom(end - 1);
		memory.fallback = (bottom - top) / Math.ceil((end - start) / step);
		const far = reach * 2;
		const first = start / step;
		const after = Math.ceil(end / step);
		const lostAbove = start > 0 && top > viewport + reach;
		const lostBelow = end < count && bottom < -reach;
		if (lostAbove || lostBelow) {
			for (let chunk = first; chunk < after; chunk++) {
				const next = (chunk + 1) * step;
				memory.heights[chunk] = (next < end ? geometry.top(next) : bottom) - geometry.top(chunk * step);
			}
			let chunk;
			let edge;
			if (lostAbove) {
				chunk = first;
				edge = top;
				while (chunk > 0 && edge > 0) edge -= estimate(memory, --chunk);
			} else {
				chunk = after;
				edge = bottom;
				while ((chunk + 1) * step < count && edge + estimate(memory, chunk) < 0) edge += estimate(memory, chunk++);
			}
			return {
				start: chunk * step,
				end: Math.min(count, (chunk + 1) * step),
				target: {
					index: chunk * step,
					top: edge
				}
			};
		}
		if (start > 0 && top > -reach) return {
			start: start - step,
			end,
			target: null
		};
		if (end < count && bottom < viewport + reach) return {
			start,
			end: Math.min(count, end + step),
			target: null
		};
		if (start + step < end && geometry.bottom(start + step - 1) < -far) {
			memory.heights[first] = geometry.top(start + step) - top;
			return {
				start: start + step,
				end,
				target: null
			};
		}
		const cut = end % step ? end - end % step : end - step;
		if (cut > start && geometry.top(cut) > viewport + far) {
			memory.heights[cut / step] = bottom - geometry.top(cut);
			return {
				start,
				end: cut,
				target: null
			};
		}
		return null;
	}
	function rendered(node) {
		return !!node && node.getClientRects().length > 0;
	}
	function startListingWindow(presentation) {
		const win = presentation.element.ownerDocument.defaultView;
		const doc = win.document;
		const memories = new WeakMap();
		const spacerAbove = createSpacer();
		const spacerBelow = createSpacer();
		const parkedStyle = doc.createElement("style");
		parkedStyle.textContent = `.${PARKED_CLASS} { display: none !important; }`;
		(doc.head ?? doc.documentElement).append(parkedStyle);
		function createSpacer() {
			const spacer = doc.createElement("div");
			spacer.className = "evr-window-spacer";
			spacer.setAttribute("aria-hidden", "true");
			spacer.style.overflowAnchor = "none";
			return spacer;
		}
		function memoryOf(strip) {
			let memory = memories.get(strip);
			if (!memory) memories.set(strip, memory = createWindowMemory());
			return memory;
		}
		function fitSpacers(strip, memory) {
			const listing = presentation.element;
			if (listing.previousSibling !== spacerAbove) listing.before(spacerAbove);
			if (listing.nextSibling !== spacerBelow) listing.after(spacerBelow);
			const room = spacers(memory, strip.count, strip);
			const above = `${Math.round(room.above)}px`;
			const below = `${Math.round(room.below)}px`;
			if (spacerAbove.style.height !== above) spacerAbove.style.height = above;
			if (spacerBelow.style.height !== below) spacerBelow.style.height = below;
		}
		let frame = 0;
		let stopped = false;
		function schedule() {
			if (!stopped && !frame) frame = win.requestAnimationFrame(update);
		}
		function top(strip, index) {
			for (let next = index; next < strip.end; next++) {
				const node = strip.nodeAt(next);
				if (rendered(node)) return node.getBoundingClientRect().top;
			}
			return presentation.element.getBoundingClientRect().bottom;
		}
		function bottom(strip, index) {
			for (let previous = index; previous >= strip.start; previous--) {
				const node = strip.nodeAt(previous);
				if (rendered(node)) return node.getBoundingClientRect().bottom;
			}
			return presentation.element.getBoundingClientRect().top;
		}
		function columnsOf(strip) {
			let first = null;
			let columns = 0;
			for (let index = strip.start; index < strip.end && columns < 64; index++) {
				const node = strip.nodeAt(index);
				if (!rendered(node)) continue;
				const edge = node.getBoundingClientRect().top;
				if (first === null) first = edge;
				else if (Math.abs(edge - first) > 1) break;
				columns++;
			}
			return Math.max(1, columns);
		}
		function visible(strip) {
			for (let index = strip.start; index < strip.end; index++) {
				const node = strip.nodeAt(index);
				if (rendered(node) && node.getBoundingClientRect().bottom > 0) return node;
			}
			return null;
		}
		function update() {
			frame = 0;
			if (stopped || !presentation.element.isConnected) return;
			const strip = presentation.strip;
			const memory = memoryOf(strip);
			const viewport = win.innerHeight;
			const next = planWindow({
				count: strip.count,
				start: strip.start,
				end: strip.end,
				columns: columnsOf(strip),
				viewport,
				reach: Math.max(viewport * 1.5, 1200),
				top: (index) => top(strip, index),
				bottom: (index) => bottom(strip, index)
			}, memory);
			if (!next) {
				fitSpacers(strip, memory);
				return;
			}
			const anchor = next.target ? null : visible(strip);
			const before = anchor?.getBoundingClientRect().top ?? 0;
			strip.setRange(next.start, next.end);
			fitSpacers(strip, memory);
			const drift = next.target ? top(strip, next.target.index) - next.target.top : anchor ? anchor.getBoundingClientRect().top - before : 0;
			if (Math.abs(drift) >= 1) win.scrollBy(0, drift);
			schedule();
		}
		const unwatch = presentation.watch(schedule);
		win.addEventListener("scroll", schedule, { passive: true });
		win.addEventListener("resize", schedule);
		schedule();
		return () => {
			stopped = true;
			if (frame) win.cancelAnimationFrame(frame);
			frame = 0;
			unwatch();
			win.removeEventListener("scroll", schedule);
			win.removeEventListener("resize", schedule);
			presentation.revealAll();
			spacerAbove.remove();
			spacerBelow.remove();
			parkedStyle.remove();
		};
	}
	var defaultAttributes = {
		xmlns: "http://www.w3.org/2000/svg",
		width: 24,
		height: 24,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		"stroke-width": 2,
		"stroke-linecap": "round",
		"stroke-linejoin": "round"
	};
	var mergeClasses = (...classes) => classes.filter((className, index, array) => {
		return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
	}).join(" ").trim();
	function isDefined(value) {
		return value !== null && value !== void 0;
	}
	function buildLucideIconNode(icon, params = {}) {
		const attributeNames = params.attributeNames ?? {};
		const getAttributeName = (attributeName) => attributeNames[attributeName] ?? attributeName;
		const viewBoxWidth = icon.size ?? icon.width ?? defaultAttributes["width"];
		const viewBoxHeight = icon.size ?? icon.height ?? defaultAttributes["height"];
		const aliasClassNames = icon.aliases?.filter((alias) => typeof alias === "string" && alias.trim() !== "").map((alias) => `lucide-${alias}`) ?? [];
		const iconClassNames = [...icon.name ? [`lucide-${icon.name}`] : [], ...aliasClassNames];
		const classNamesFromClassName = params.className?.split(" ").filter(Boolean) ?? [];
		const className = params.includeDefaultClasses === false ? mergeClasses(...classNamesFromClassName) : mergeClasses("lucide", ...iconClassNames, ...classNamesFromClassName);
		const calculatedStrokeWidth = params.absoluteStrokeWidth ? Number(params.strokeWidth ?? defaultAttributes["stroke-width"]) * Number(icon.size ?? icon.width ?? defaultAttributes["width"]) / Number(params.size ?? params.width ?? defaultAttributes["width"]) : params.strokeWidth ?? defaultAttributes["stroke-width"];
		return [
			"svg",
			{
				...Object.entries(defaultAttributes).reduce((attrs, [attrName, value]) => {
					attrs[getAttributeName(attrName)] = value;
					return attrs;
				}, {}),
				..."color" in params && params.color && { [getAttributeName("stroke")]: params.color },
				..."size" in params && isDefined(params.size) && {
					[getAttributeName("width")]: params.size,
					[getAttributeName("height")]: params.size
				},
				..."width" in params && isDefined(params.width) && { [getAttributeName("width")]: params.width },
				..."height" in params && isDefined(params.height) && { [getAttributeName("height")]: params.height },
				[getAttributeName("stroke-width")]: calculatedStrokeWidth,
				...className && { [getAttributeName("class")]: className },
				[getAttributeName("viewBox")]: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
				...params.hasA11yProp === false ? { [getAttributeName("aria-hidden")]: "true" } : {},
				..."attributes" in params && params.attributes
			},
			icon.node.map((child) => {
				const [name, attrs, children] = child;
				const nextAttrs = params.nonScalingStroke ? {
					[getAttributeName("vector-effect")]: "non-scaling-stroke",
					...attrs
				} : attrs;
				return children ? [
					name,
					nextAttrs,
					children
				] : [name, nextAttrs];
			})
		];
	}
	var hasA11yProp = (props) => {
		for (const prop in props) if (prop.startsWith("aria-") || prop === "role" || prop === "title") return true;
		return false;
	};
	var isEmptyString = (value) => value === "";
	var toKebabCase = (string) => string?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
	var LUCIDE_CONTEXT = Symbol("lucide-icons");
	function useLucideProps() {
		return inject(LUCIDE_CONTEXT, {});
	}
	var Icon = ({ name, iconNode, "icon-node": iconNodeKebabCase, icon = {
		name: name && toKebabCase(name),
		node: iconNode ?? iconNodeKebabCase ?? [],
		size: 24,
		aliases: []
	}, absoluteStrokeWidth, "absolute-stroke-width": absoluteStrokeWidthKebabCase, nonScalingStroke, "non-scaling-stroke": nonScalingStrokeKebabCase, strokeWidth, "stroke-width": strokeWidthKebabCase, size, width = size, height = size, color, ...props }, { slots }) => {
		const { size: contextSize, color: contextColor, strokeWidth: contextStrokeWidth = 2, absoluteStrokeWidth: contextAbsoluteStrokeWidth = false, nonScalingStroke: contextNonScalingStroke = false, class: contextClass = "" } = useLucideProps();
		const isAbsoluteStrokeWidth = isEmptyString(absoluteStrokeWidth) || isEmptyString(absoluteStrokeWidthKebabCase) || absoluteStrokeWidth === true || absoluteStrokeWidthKebabCase === true || contextAbsoluteStrokeWidth === true;
		const isNonScalingStroke = isEmptyString(nonScalingStroke) || isEmptyString(nonScalingStrokeKebabCase) || nonScalingStroke === true || nonScalingStrokeKebabCase === true || contextNonScalingStroke === true;
		delete props.class;
		const defaultSlot = slots.default?.();
		const [, svgAttributes, builtIconNode = []] = buildLucideIconNode(icon, {
			color: color ?? contextColor,
			width: width ?? size ?? contextSize,
			height: height ?? size ?? contextSize,
			strokeWidth: strokeWidth ?? strokeWidthKebabCase ?? contextStrokeWidth,
			absoluteStrokeWidth: isAbsoluteStrokeWidth,
			nonScalingStroke: isNonScalingStroke,
			className: contextClass,
			hasA11yProp: defaultSlot != null && defaultSlot.length > 0 || hasA11yProp(props),
			attributes: props
		});
		return h("svg", svgAttributes, [...builtIconNode.map(([tag, attrs]) => h(tag, attrs)), ...defaultSlot ?? []]);
	};
	function createLucideIcon(iconDataOrName, iconNode = []) {
		const icon = typeof iconDataOrName === "string" ? {
			name: iconDataOrName,
			node: iconNode
		} : iconDataOrName;
		return (props, { slots }) => h(Icon, {
			...props,
			icon
		}, slots.default ? { default: slots.default } : void 0);
	}
	var Languages = createLucideIcon({
		name: "languages",
		size: 24,
		node: [
			["path", {
				d: "m5 8 6 6",
				key: "1wu5hv"
			}],
			["path", {
				d: "m4 14 6-6 2-3",
				key: "1k1g8d"
			}],
			["path", {
				d: "M2 5h12",
				key: "or177f"
			}],
			["path", {
				d: "M7 2h1",
				key: "1t2jsx"
			}],
			["path", {
				d: "m22 22-5-10-5 10",
				key: "don7ne"
			}],
			["path", {
				d: "M14 18h6",
				key: "1m8k6r"
			}]
		]
	});
	var Settings = createLucideIcon({
		name: "settings",
		size: 24,
		node: [["path", {
			d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",
			key: "1i5ecw"
		}], ["circle", {
			cx: "12",
			cy: "12",
			r: "3",
			key: "1v7zrd"
		}]]
	});
	var Tags = createLucideIcon({
		name: "tags",
		size: 24,
		node: [
			["path", {
				d: "M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z",
				key: "16rjxf"
			}],
			["path", {
				d: "M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193",
				key: "178nd4"
			}],
			["circle", {
				cx: "10.5",
				cy: "6.5",
				r: ".5",
				fill: "currentColor",
				key: "12ikhr"
			}]
		]
	});
	var X = createLucideIcon({
		name: "x",
		size: 24,
		node: [["path", {
			d: "M18 6 6 18",
			key: "1bl5f8"
		}], ["path", {
			d: "m6 6 12 12",
			key: "d8bk6v"
		}]]
	});
	var _hoisted_1$1 = ["title", "aria-label"];
	var SettingsButton_default = defineComponent({
		__name: "SettingsButton",
		emits: ["open"],
		setup(__props) {
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("button", {
					type: "button",
					class: "evr-settings-button",
					title: unref(t)("settings.open"),
					"aria-label": unref(t)("settings.open"),
					onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("open"))
				}, [createVNode(unref(Settings), {
					size: 15,
					"aria-hidden": "true"
				}), createBaseVNode("span", null, toDisplayString(unref(t)("settings.button")), 1)], 8, _hoisted_1$1);
			};
		}
	});
	var _hoisted_1 = ["aria-label"];
	var _hoisted_2 = { class: "evr-settings__header" };
	var _hoisted_3 = { class: "evr-settings__title" };
	var _hoisted_4 = ["aria-label", "title"];
	var _hoisted_5 = { class: "evr-settings__panel" };
	var _hoisted_6 = { class: "evr-settings__panel-inner" };
	var _hoisted_7 = { class: "evr-settings__section" };
	var _hoisted_8 = { class: "evr-settings__subtitle" };
	var _hoisted_9 = ["value", "aria-label"];
	var _hoisted_10 = { value: "auto" };
	var _hoisted_11 = ["value", "lang"];
	var _hoisted_12 = { class: "evr-settings__section" };
	var _hoisted_13 = { class: "evr-settings__subtitle" };
	var _hoisted_14 = { class: "evr-switch" };
	var _hoisted_15 = ["checked", "onChange"];
	var _hoisted_16 = { class: "evr-settings__label" };
	var _hoisted_17 = { class: "evr-settings__section" };
	var _hoisted_18 = { class: "evr-settings__subtitle" };
	var _hoisted_19 = { class: "evr-switch" };
	var _hoisted_20 = ["checked", "onChange"];
	var _hoisted_21 = { class: "evr-settings__label" };
	var scrollLockAttribute = "data-evr-scroll-locked";
	var focusableSelector = "button, input, select, textarea, a[href], [tabindex]:not([tabindex=\"-1\"])";
	var SettingsPopup_default = defineComponent({
		__name: "SettingsPopup",
		emits: ["close"],
		setup(__props, { emit: __emit }) {
			const emit = __emit;
			function toggle(label, get, set, subscribe) {
				return {
					label,
					value: ref(get()),
					set,
					subscribe
				};
			}
			const browsing = [toggle("settings.infiniteScroll", getInfiniteScroll, setInfiniteScroll, subscribeInfiniteScroll)];
			const tags = [
				toggle("settings.groupTags", getGroupTags, setGroupTags, subscribeGroupTags),
				toggle("settings.uploaderTag", getUploaderTag, setUploaderTag, subscribeUploaderTag),
				toggle("settings.allMyTags", getAllMyTags, setAllMyTags, subscribeAllMyTags),
				toggle("settings.allOtherTags", getAllOtherTags, setAllOtherTags, subscribeAllOtherTags)
			];
			const localeOptions = [
				{
					value: "zh-TW",
					label: "繁體中文"
				},
				{
					value: "zh-CN",
					label: "简体中文"
				},
				{
					value: "en",
					label: "English"
				},
				{
					value: "ja",
					label: "日本語"
				},
				{
					value: "ko",
					label: "한국어"
				}
			];
			const localeChoice = ref(getLocaleChoice());
			const dialog = ref(null);
			let unsubscribers = [];
			function keepFocusInside(event) {
				const root = dialog.value;
				if (!root) return;
				const focusable = Array.from(root.querySelectorAll(focusableSelector)).filter((node) => !node.matches(":disabled"));
				if (focusable.length === 0) return;
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				const active = document.activeElement;
				const inside = active !== root && active instanceof Node && root.contains(active);
				if (!(event.shiftKey ? !inside || active === first : !inside || active === last)) return;
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
			}
			function onKeydown(event) {
				if (event.defaultPrevented) return;
				if (event.key === "Tab") {
					keepFocusInside(event);
					return;
				}
				if (event.key !== "Escape") return;
				event.preventDefault();
				event.stopPropagation();
				emit("close");
			}
			function onToggle(entry, event) {
				const input = event.target;
				try {
					entry.set(input.checked);
				} catch (error) {
					input.checked = entry.value.value;
					throw error;
				}
			}
			onMounted(() => {
				unsubscribers = [...browsing, ...tags].map((entry) => entry.subscribe((value) => {
					entry.value.value = value;
				}));
				unsubscribers.push(subscribeLocaleChoice((value) => {
					localeChoice.value = value;
				}));
				document.addEventListener("keydown", onKeydown, true);
				document.documentElement.setAttribute(scrollLockAttribute, "");
				dialog.value?.focus();
			});
			onBeforeUnmount(() => {
				for (const unsubscribe of unsubscribers) unsubscribe();
				document.removeEventListener("keydown", onKeydown, true);
				document.documentElement.removeAttribute(scrollLockAttribute);
			});
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("div", {
					class: "evr-popup-overlay",
					onMousedown: _cache[2] || (_cache[2] = withModifiers(($event) => emit("close"), ["self"]))
				}, [createBaseVNode("div", {
					ref_key: "dialog",
					ref: dialog,
					class: "evr-popup",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": unref(t)("settings.open"),
					tabindex: "-1"
				}, [createBaseVNode("div", _hoisted_2, [createBaseVNode("h3", _hoisted_3, toDisplayString(unref(t)("settings.title")), 1), createBaseVNode("button", {
					type: "button",
					class: "evr-settings__close-btn",
					"aria-label": unref(t)("settings.close"),
					title: unref(t)("settings.close"),
					onClick: _cache[0] || (_cache[0] = ($event) => emit("close"))
				}, [createVNode(unref(X), {
					size: 18,
					"aria-hidden": "true"
				})], 8, _hoisted_4)]), createBaseVNode("div", _hoisted_5, [createBaseVNode("div", _hoisted_6, [
					createBaseVNode("section", _hoisted_7, [createBaseVNode("h4", _hoisted_8, [createVNode(unref(Languages), {
						size: 14,
						"aria-hidden": "true"
					}), createTextVNode(toDisplayString(unref(t)("settings.language")), 1)]), createBaseVNode("select", {
						class: "evr-settings__select",
						value: localeChoice.value,
						"aria-label": unref(t)("settings.language"),
						onChange: _cache[1] || (_cache[1] = ($event) => unref(setLocaleChoice)($event.target.value))
					}, [createBaseVNode("option", _hoisted_10, toDisplayString(unref(t)("settings.languageAuto")), 1), (openBlock(), createElementBlock(Fragment, null, renderList(localeOptions, (option) => {
						return createBaseVNode("option", {
							key: option.value,
							value: option.value,
							lang: option.value
						}, toDisplayString(option.label), 9, _hoisted_11);
					}), 64))], 40, _hoisted_9)]),
					createBaseVNode("section", _hoisted_12, [createBaseVNode("h4", _hoisted_13, toDisplayString(unref(t)("settings.browsingSection")), 1), (openBlock(), createElementBlock(Fragment, null, renderList(browsing, (entry) => {
						return createBaseVNode("label", {
							key: entry.label,
							class: "evr-settings__row"
						}, [createBaseVNode("span", _hoisted_14, [createBaseVNode("input", {
							class: "evr-switch__input",
							type: "checkbox",
							checked: entry.value.value,
							onChange: ($event) => onToggle(entry, $event)
						}, null, 40, _hoisted_15), _cache[3] || (_cache[3] = createBaseVNode("span", { class: "evr-switch__track" }, [createBaseVNode("span", { class: "evr-switch__knob" })], -1))]), createBaseVNode("span", _hoisted_16, toDisplayString(unref(t)(entry.label)), 1)]);
					}), 64))]),
					createBaseVNode("section", _hoisted_17, [createBaseVNode("h4", _hoisted_18, [createVNode(unref(Tags), {
						size: 14,
						"aria-hidden": "true"
					}), createTextVNode(toDisplayString(unref(t)("settings.tagsSection")), 1)]), (openBlock(), createElementBlock(Fragment, null, renderList(tags, (entry) => {
						return createBaseVNode("label", {
							key: entry.label,
							class: "evr-settings__row"
						}, [createBaseVNode("span", _hoisted_19, [createBaseVNode("input", {
							class: "evr-switch__input",
							type: "checkbox",
							checked: entry.value.value,
							onChange: ($event) => onToggle(entry, $event)
						}, null, 40, _hoisted_20), _cache[4] || (_cache[4] = createBaseVNode("span", { class: "evr-switch__track" }, [createBaseVNode("span", { class: "evr-switch__knob" })], -1))]), createBaseVNode("span", _hoisted_21, toDisplayString(unref(t)(entry.label)), 1)]);
					}), 64))])
				])])], 8, _hoisted_1)], 32);
			};
		}
	});
	var settings_default = ".evr-scope{--evr-fs-lg:13px;--evr-radius-sm:3px;--evr-border-width:2px;--evr-ctrl-h:25px;--evr-ctrl-gap:4px;--evr-ctrl-padding:6px;--evr-ctrl-margin:0 1px 1px;--evr-popup-width:24rem;--evr-popup-padding:1.25rem;--evr-z-overlay:99999;--evr-transition-base:background .15s, border-color .15s, color .15s;--evr-bg:#edebdf;--evr-bg-hover:#0000000f;--evr-bg-active:#ddd8c8;--evr-bg-btn:#edeada;--evr-bg-btn-hover:#e2dfcf;--evr-text:#5c0d12;--evr-text-hint:#8a8271;--evr-text-on-color:#fff;--evr-border:#b5a4a4;--evr-overlay:#0006;--evr-shadow:0 4px 16px #00000040;--evr-green:#4a7c59;color:var(--evr-text);font-size:var(--evr-fs-lg);text-align:left}.evr-scope--dark{--evr-bg:#4f535b;--evr-bg-hover:#ffffff0f;--evr-bg-active:#5e636c;--evr-bg-btn:#34353b;--evr-bg-btn-hover:#3e3f45;--evr-text:#ddd;--evr-text-hint:#b0b0b0;--evr-border:#8d8d8d;--evr-overlay:#0009;--evr-shadow:0 4px 16px #00000080;--evr-green:#5a9a6a}.evr-scope,.evr-scope *,.evr-scope :before,.evr-scope :after{box-sizing:border-box}.evr-scope :where(button){font-family:inherit;font-weight:inherit;line-height:1.4}.searchnav select:has(+.evr-settings-host){vertical-align:middle}.evr-settings-host{vertical-align:middle;margin-inline-start:var(--evr-ctrl-gap);display:inline-flex}.evr-settings-button{justify-content:center;align-items:center;gap:var(--evr-ctrl-gap);height:var(--evr-ctrl-h);margin:var(--evr-ctrl-margin);padding:0 var(--evr-ctrl-padding);font:inherit;white-space:nowrap;border:var(--evr-border-width) solid var(--evr-border);border-radius:var(--evr-radius-sm);background:var(--evr-bg-btn);color:var(--evr-text);cursor:pointer;transition:var(--evr-transition-base);display:inline-flex}.evr-settings-button:hover{background:var(--evr-bg-hover)}html[data-evr-scroll-locked] body{overflow:hidden!important}.evr-popup-overlay{z-index:var(--evr-z-overlay);background:var(--evr-overlay);justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.evr-popup{width:min(var(--evr-popup-width), 90vw);background:var(--evr-bg);border:var(--evr-border-width) solid var(--evr-border);max-height:86vh;box-shadow:var(--evr-shadow);border-radius:.5rem;flex-direction:column;display:flex;overflow:hidden}.evr-popup:focus{outline:none}.evr-settings__header{justify-content:space-between;align-items:center;gap:var(--evr-ctrl-gap);padding:var(--evr-ctrl-gap) var(--evr-ctrl-gap) var(--evr-ctrl-gap) var(--evr-popup-padding);flex-shrink:0;display:flex}.evr-settings__title{font-size:var(--evr-fs-lg);margin:0;font-weight:700}.evr-settings__close-btn{width:var(--evr-ctrl-h);height:var(--evr-ctrl-h);border-radius:var(--evr-radius-sm);color:var(--evr-text);cursor:pointer;transition:var(--evr-transition-base);background:0 0;border:none;justify-content:center;align-items:center;margin:0;padding:0;display:inline-flex}.evr-settings__close-btn:hover{background:var(--evr-bg-btn-hover)}.evr-settings__panel{overscroll-behavior:contain;flex:1;min-width:0;overflow-y:auto}.evr-settings__panel-inner{padding:0 var(--evr-popup-padding) var(--evr-popup-padding);flex-direction:column;display:flex}.evr-settings__section{flex-direction:column;gap:6px;padding:14px 0;display:flex}.evr-settings__section:first-child{padding-top:0}.evr-settings__section:last-child{padding-bottom:0}.evr-settings__section+.evr-settings__section{border-top:var(--evr-border-width) solid var(--evr-border)}.evr-settings__subtitle{align-items:center;gap:6px;margin:0;font-size:14px;font-weight:700;display:flex}.evr-settings__subtitle>svg{color:var(--evr-text-hint);flex-shrink:0}.evr-scope select.evr-settings__select{min-height:0;height:var(--evr-ctrl-h);padding:0 var(--evr-ctrl-padding);border:var(--evr-border-width) solid var(--evr-border);border-radius:var(--evr-radius-sm);background:var(--evr-bg-btn);color:var(--evr-text);font:inherit;cursor:pointer;align-self:flex-start;margin:0}.evr-scope select.evr-settings__select:focus-visible{outline:2px solid var(--evr-text);outline-offset:2px}.evr-settings__row{min-height:var(--evr-ctrl-h);cursor:pointer;align-items:center;gap:8px;display:flex}.evr-settings__label{-webkit-user-select:none;user-select:none}.evr-switch{flex-shrink:0;width:34px;height:18px;display:inline-flex;position:relative}.evr-scope input.evr-switch__input{opacity:0;cursor:pointer;width:100%;height:100%;margin:0;position:absolute;inset:0}.evr-switch__track{border:var(--evr-border-width) solid var(--evr-border);background:var(--evr-bg-btn);transition:var(--evr-transition-base);pointer-events:none;border-radius:999px;flex:1}.evr-switch__knob{background:var(--evr-text-hint);border-radius:50%;width:10px;height:10px;transition:left .15s,background .15s;position:absolute;top:50%;left:3px;transform:translateY(-50%)}.evr-switch__input:checked~.evr-switch__track{background:var(--evr-green);border-color:var(--evr-green)}.evr-switch__input:checked~.evr-switch__track .evr-switch__knob{background:var(--evr-text-on-color);left:calc(100% - 13px)}.evr-switch__input:focus-visible~.evr-switch__track{outline:2px solid var(--evr-text);outline-offset:2px}";
	var openSettingsEvent = "evr:open-settings";
	var styleId = "evr-settings-style";
	var hostAttribute = "data-evr-settings";
	function installStyles(doc) {
		if (doc.getElementById(styleId)) return;
		const style = doc.createElement("style");
		style.id = styleId;
		style.textContent = settings_default;
		(doc.head ?? doc.documentElement).append(style);
	}
	function scopeClass() {
		return location.hostname === "exhentai.org" ? "evr-scope evr-scope--dark" : "evr-scope";
	}
	function isVisible(select) {
		return typeof select.checkVisibility === "function" ? select.checkVisibility() : select.offsetParent !== null;
	}
	var overlay = null;
	var overlayApp = null;
	var trigger = null;
	function closeSettings() {
		if (!overlay) return;
		overlayApp?.unmount();
		overlay.remove();
		overlayApp = null;
		overlay = null;
		const returnTo = trigger;
		trigger = null;
		if (returnTo?.isConnected) returnTo.focus();
	}
	function openSettings(source) {
		if (overlay) return;
		installStyles(document);
		trigger = source instanceof HTMLElement ? source : null;
		overlay = document.createElement("div");
		overlay.className = scopeClass();
		overlay.setAttribute("translate", "no");
		(document.body ?? document.documentElement).append(overlay);
		overlayApp = createApp(SettingsPopup_default, { onClose: closeSettings });
		overlayApp.mount(overlay);
	}
	function startSettingsHook() {
		const onOpen = () => openSettings(document.activeElement);
		document.addEventListener(openSettingsEvent, onOpen);
		return () => {
			document.removeEventListener(openSettingsEvent, onOpen);
			closeSettings();
			document.getElementById(styleId)?.remove();
		};
	}
	function startSettingsLaunchers() {
		const launchers = new Map();
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const select = entry.target;
				const launcher = launchers.get(select);
				if (launcher) syncSize(select, launcher.host);
			}
		});
		function syncSize(select, host) {
			const height = select.getBoundingClientRect().height;
			const value = `${height}px`;
			if (height > 0 && host.style.getPropertyValue("--evr-ctrl-h") !== value) host.style.setProperty("--evr-ctrl-h", value);
			const style = getComputedStyle(select);
			if (host.style.verticalAlign !== style.verticalAlign) host.style.verticalAlign = style.verticalAlign;
			if (host.style.font !== style.font) host.style.font = style.font;
		}
		function release(select) {
			const launcher = launchers.get(select);
			if (!launcher) return;
			launchers.delete(select);
			resizeObserver.unobserve(select);
			launcher.app.unmount();
			launcher.host.remove();
		}
		function sync() {
			const visible = findModeSelects(document).filter(isVisible);
			const wanted = new Set(visible);
			for (const select of [...launchers.keys()]) if (!wanted.has(select) || !select.isConnected) release(select);
			for (const select of visible) {
				const launcher = launchers.get(select);
				if (launcher) {
					if (select.nextElementSibling !== launcher.host) select.after(launcher.host);
					syncSize(select, launcher.host);
					continue;
				}
				installStyles(document);
				const host = document.createElement("span");
				host.className = `${scopeClass()} evr-settings-host`;
				host.setAttribute(hostAttribute, "");
				host.setAttribute("translate", "no");
				const app = createApp(SettingsButton_default, { onOpen: () => openSettings(host.querySelector("button")) });
				select.after(host);
				app.mount(host);
				launchers.set(select, {
					host,
					app
				});
				syncSize(select, host);
				resizeObserver.observe(select, { box: "border-box" });
			}
			const live = new Set([...launchers.values()].map((launcher) => launcher.host));
			for (const stale of document.querySelectorAll(`[${hostAttribute}]`)) if (!live.has(stale)) stale.remove();
		}
		const stopObserving = observeModeSelects(document, sync);
		sync();
		return () => {
			stopObserving();
			resizeObserver.disconnect();
			for (const select of [...launchers.keys()]) release(select);
		};
	}
	function startSettingsMenu() {
		let id;
		const stopWatching = watch(locale, () => {
			if (id !== void 0) _GM_unregisterMenuCommand(id);
			id = _GM_registerMenuCommand(t("settings.button"), () => document.dispatchEvent(new Event(openSettingsEvent)));
		}, { immediate: true });
		return () => {
			stopWatching();
			if (id !== void 0) _GM_unregisterMenuCommand(id);
			id = void 0;
		};
	}
	announcePresence(document, "0.1.1");
	setLocale(resolveLocale(getLocaleChoice(), navigator.languages));
	var stopObservingLocale = subscribeLocaleChoice((next) => setLocale(resolveLocale(next, navigator.languages)));
	var stopSettingsHook = startSettingsHook();
	var stopSettingsMenu = startSettingsMenu();
	var origin = {
		href: location.href,
		scrollRestoration: history.scrollRestoration
	};
	var stopPagination;
	var stopWindow;
	var stopLiveUrl;
	var stopSettingsLaunchers;
	var stopObservingPagination;
	var stopObservingTags = [];
	var startup = startEarlyListing((switcher) => {
		const presentation = switcher.presentation;
		if (presentation) {
			const syncPagination = (enabled) => {
				stopPagination?.();
				stopWindow?.();
				stopLiveUrl?.();
				stopPagination = enabled ? startPagination(presentation) : void 0;
				stopWindow = enabled ? startListingWindow(presentation) : void 0;
				stopLiveUrl = enabled ? startLiveUrl(presentation, origin) : void 0;
			};
			syncPagination(getInfiniteScroll());
			stopObservingPagination = subscribeInfiniteScroll(syncPagination);
			stopObservingTags = [
				subscribeGroupTags,
				subscribeUploaderTag,
				subscribeAllMyTags,
				subscribeAllOtherTags
			].map((subscribe) => subscribe(() => presentation.refreshTags()));
		}
		stopSettingsLaunchers = startSettingsLaunchers();
	});
	window.addEventListener("pagehide", (event) => {
		if (event.persisted) return;
		stopObservingLocale();
		stopObservingPagination?.();
		for (const stop of stopObservingTags) stop();
		stopPagination?.();
		stopWindow?.();
		stopLiveUrl?.();
		stopSettingsLaunchers?.();
		stopSettingsHook();
		stopSettingsMenu();
		startup.dispose();
	});
})();
