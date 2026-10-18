#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs, promisify } from "node:util";
import { execFile } from "node:child_process";
//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/identity.js
var require_identity = /* @__PURE__ */ __commonJSMin(((exports) => {
	const ALIAS = Symbol.for("yaml.alias");
	const DOC = Symbol.for("yaml.document");
	const MAP = Symbol.for("yaml.map");
	const PAIR = Symbol.for("yaml.pair");
	const SCALAR = Symbol.for("yaml.scalar");
	const SEQ = Symbol.for("yaml.seq");
	const NODE_TYPE = Symbol.for("yaml.node.type");
	const isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
	const isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
	const isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
	const isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
	const isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
	const isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
	function isCollection(node) {
		if (node && typeof node === "object") switch (node[NODE_TYPE]) {
			case MAP:
			case SEQ: return true;
		}
		return false;
	}
	function isNode(node) {
		if (node && typeof node === "object") switch (node[NODE_TYPE]) {
			case ALIAS:
			case MAP:
			case SCALAR:
			case SEQ: return true;
		}
		return false;
	}
	const hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
	exports.ALIAS = ALIAS;
	exports.DOC = DOC;
	exports.MAP = MAP;
	exports.NODE_TYPE = NODE_TYPE;
	exports.PAIR = PAIR;
	exports.SCALAR = SCALAR;
	exports.SEQ = SEQ;
	exports.hasAnchor = hasAnchor;
	exports.isAlias = isAlias;
	exports.isCollection = isCollection;
	exports.isDocument = isDocument;
	exports.isMap = isMap;
	exports.isNode = isNode;
	exports.isPair = isPair;
	exports.isScalar = isScalar;
	exports.isSeq = isSeq;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/visit.js
var require_visit = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	const BREAK = Symbol("break visit");
	const SKIP = Symbol("skip children");
	const REMOVE = Symbol("remove node");
	/**
	* Apply a visitor to an AST node or document.
	*
	* Walks through the tree (depth-first) starting from `node`, calling a
	* `visitor` function with three arguments:
	*   - `key`: For sequence values and map `Pair`, the node's index in the
	*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
	*     `null` for the root node.
	*   - `node`: The current node.
	*   - `path`: The ancestry of the current node.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this node, continue with next
	*     sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current node, then continue with the next one
	*   - `Node`: Replace the current node, then continue by visiting it
	*   - `number`: While iterating the items of a sequence or map, set the index
	*     of the next step. This is useful especially if the index of the current
	*     node has changed.
	*
	* If `visitor` is a single function, it will be called with all values
	* encountered in the tree, including e.g. `null` values. Alternatively,
	* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
	* `Alias` and `Scalar` node. To define the same visitor function for more than
	* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
	* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
	* specific defined one will be used for each node.
	*/
	function visit(node, visitor) {
		const visitor_ = initVisitor(visitor);
		if (identity.isDocument(node)) {
			if (visit_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE) node.contents = null;
		} else visit_(null, node, visitor_, Object.freeze([]));
	}
	/** Terminate visit traversal completely */
	visit.BREAK = BREAK;
	/** Do not visit the children of the current node */
	visit.SKIP = SKIP;
	/** Remove the current node */
	visit.REMOVE = REMOVE;
	function visit_(key, node, visitor, path) {
		const ctrl = callVisitor(key, node, visitor, path);
		if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
			replaceNode(key, path, ctrl);
			return visit_(key, ctrl, visitor, path);
		}
		if (typeof ctrl !== "symbol") {
			if (identity.isCollection(node)) {
				path = Object.freeze(path.concat(node));
				for (let i = 0; i < node.items.length; ++i) {
					const ci = visit_(i, node.items[i], visitor, path);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK) return BREAK;
					else if (ci === REMOVE) {
						node.items.splice(i, 1);
						i -= 1;
					}
				}
			} else if (identity.isPair(node)) {
				path = Object.freeze(path.concat(node));
				const ck = visit_("key", node.key, visitor, path);
				if (ck === BREAK) return BREAK;
				else if (ck === REMOVE) node.key = null;
				const cv = visit_("value", node.value, visitor, path);
				if (cv === BREAK) return BREAK;
				else if (cv === REMOVE) node.value = null;
			}
		}
		return ctrl;
	}
	/**
	* Apply an async visitor to an AST node or document.
	*
	* Walks through the tree (depth-first) starting from `node`, calling a
	* `visitor` function with three arguments:
	*   - `key`: For sequence values and map `Pair`, the node's index in the
	*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
	*     `null` for the root node.
	*   - `node`: The current node.
	*   - `path`: The ancestry of the current node.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `Promise`: Must resolve to one of the following values
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this node, continue with next
	*     sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current node, then continue with the next one
	*   - `Node`: Replace the current node, then continue by visiting it
	*   - `number`: While iterating the items of a sequence or map, set the index
	*     of the next step. This is useful especially if the index of the current
	*     node has changed.
	*
	* If `visitor` is a single function, it will be called with all values
	* encountered in the tree, including e.g. `null` values. Alternatively,
	* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
	* `Alias` and `Scalar` node. To define the same visitor function for more than
	* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
	* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
	* specific defined one will be used for each node.
	*/
	async function visitAsync(node, visitor) {
		const visitor_ = initVisitor(visitor);
		if (identity.isDocument(node)) {
			if (await visitAsync_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE) node.contents = null;
		} else await visitAsync_(null, node, visitor_, Object.freeze([]));
	}
	/** Terminate visit traversal completely */
	visitAsync.BREAK = BREAK;
	/** Do not visit the children of the current node */
	visitAsync.SKIP = SKIP;
	/** Remove the current node */
	visitAsync.REMOVE = REMOVE;
	async function visitAsync_(key, node, visitor, path) {
		const ctrl = await callVisitor(key, node, visitor, path);
		if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
			replaceNode(key, path, ctrl);
			return visitAsync_(key, ctrl, visitor, path);
		}
		if (typeof ctrl !== "symbol") {
			if (identity.isCollection(node)) {
				path = Object.freeze(path.concat(node));
				for (let i = 0; i < node.items.length; ++i) {
					const ci = await visitAsync_(i, node.items[i], visitor, path);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK) return BREAK;
					else if (ci === REMOVE) {
						node.items.splice(i, 1);
						i -= 1;
					}
				}
			} else if (identity.isPair(node)) {
				path = Object.freeze(path.concat(node));
				const ck = await visitAsync_("key", node.key, visitor, path);
				if (ck === BREAK) return BREAK;
				else if (ck === REMOVE) node.key = null;
				const cv = await visitAsync_("value", node.value, visitor, path);
				if (cv === BREAK) return BREAK;
				else if (cv === REMOVE) node.value = null;
			}
		}
		return ctrl;
	}
	function initVisitor(visitor) {
		if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) return Object.assign({
			Alias: visitor.Node,
			Map: visitor.Node,
			Scalar: visitor.Node,
			Seq: visitor.Node
		}, visitor.Value && {
			Map: visitor.Value,
			Scalar: visitor.Value,
			Seq: visitor.Value
		}, visitor.Collection && {
			Map: visitor.Collection,
			Seq: visitor.Collection
		}, visitor);
		return visitor;
	}
	function callVisitor(key, node, visitor, path) {
		if (typeof visitor === "function") return visitor(key, node, path);
		if (identity.isMap(node)) return visitor.Map?.(key, node, path);
		if (identity.isSeq(node)) return visitor.Seq?.(key, node, path);
		if (identity.isPair(node)) return visitor.Pair?.(key, node, path);
		if (identity.isScalar(node)) return visitor.Scalar?.(key, node, path);
		if (identity.isAlias(node)) return visitor.Alias?.(key, node, path);
	}
	function replaceNode(key, path, node) {
		const parent = path[path.length - 1];
		if (identity.isCollection(parent)) parent.items[key] = node;
		else if (identity.isPair(parent)) {
			if (key === "key") parent.key = node;
			else parent.value = node;
		} else if (identity.isDocument(parent)) parent.contents = node;
		else {
			const pt = identity.isAlias(parent) ? "alias" : "scalar";
			throw new Error(`Cannot replace node with ${pt} parent`);
		}
	}
	exports.visit = visit;
	exports.visitAsync = visitAsync;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/directives.js
var require_directives = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var visit = require_visit();
	const escapeChars = {
		"!": "%21",
		",": "%2C",
		"[": "%5B",
		"]": "%5D",
		"{": "%7B",
		"}": "%7D"
	};
	const escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
	var Directives = class Directives {
		constructor(yaml, tags) {
			/**
			* The directives-end/doc-start marker `---`. If `null`, a marker may still be
			* included in the document's stringified representation.
			*/
			this.docStart = null;
			/** The doc-end marker `...`.  */
			this.docEnd = false;
			this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
			this.tags = Object.assign({}, Directives.defaultTags, tags);
		}
		clone() {
			const copy = new Directives(this.yaml, this.tags);
			copy.docStart = this.docStart;
			return copy;
		}
		/**
		* During parsing, get a Directives instance for the current document and
		* update the stream state according to the current version's spec.
		*/
		atDocument() {
			const res = new Directives(this.yaml, this.tags);
			switch (this.yaml.version) {
				case "1.1":
					this.atNextDocument = true;
					break;
				case "1.2":
					this.atNextDocument = false;
					this.yaml = {
						explicit: Directives.defaultYaml.explicit,
						version: "1.2"
					};
					this.tags = Object.assign({}, Directives.defaultTags);
			}
			return res;
		}
		/**
		* @param onError - May be called even if the action was successful
		* @returns `true` on success
		*/
		add(line, onError) {
			if (this.atNextDocument) {
				this.yaml = {
					explicit: Directives.defaultYaml.explicit,
					version: "1.1"
				};
				this.tags = Object.assign({}, Directives.defaultTags);
				this.atNextDocument = false;
			}
			const parts = line.trim().split(/[ \t]+/);
			const name = parts.shift();
			switch (name) {
				case "%TAG": {
					if (parts.length !== 2) {
						onError(0, "%TAG directive should contain exactly two parts");
						if (parts.length < 2) return false;
					}
					const [handle, prefix] = parts;
					this.tags[handle] = prefix;
					return true;
				}
				case "%YAML": {
					this.yaml.explicit = true;
					if (parts.length !== 1) {
						onError(0, "%YAML directive should contain exactly one part");
						return false;
					}
					const [version] = parts;
					if (version === "1.1" || version === "1.2") {
						this.yaml.version = version;
						return true;
					} else {
						const isValid = /^\d+\.\d+$/.test(version);
						onError(6, `Unsupported YAML version ${version}`, isValid);
						return false;
					}
				}
				default:
					onError(0, `Unknown directive ${name}`, true);
					return false;
			}
		}
		/**
		* Resolves a tag, matching handles to those defined in %TAG directives.
		*
		* @returns Resolved tag, which may also be the non-specific tag `'!'` or a
		*   `'!local'` tag, or `null` if unresolvable.
		*/
		tagName(source, onError) {
			if (source === "!") return "!";
			if (source[0] !== "!") {
				onError(`Not a valid tag: ${source}`);
				return null;
			}
			if (source[1] === "<") {
				const verbatim = source.slice(2, -1);
				if (verbatim === "!" || verbatim === "!!") {
					onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
					return null;
				}
				if (source[source.length - 1] !== ">") onError("Verbatim tags must end with a >");
				return verbatim;
			}
			const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
			if (!suffix) onError(`The ${source} tag has no suffix`);
			const prefix = this.tags[handle];
			if (prefix) try {
				return prefix + decodeURIComponent(suffix);
			} catch (error) {
				onError(String(error));
				return null;
			}
			if (handle === "!") return source;
			onError(`Could not resolve tag: ${source}`);
			return null;
		}
		/**
		* Given a fully resolved tag, returns its printable string form,
		* taking into account current tag prefixes and defaults.
		*/
		tagString(tag) {
			for (const [handle, prefix] of Object.entries(this.tags)) if (tag.startsWith(prefix)) return handle + escapeTagName(tag.substring(prefix.length));
			return tag[0] === "!" ? tag : `!<${tag}>`;
		}
		toString(doc) {
			const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
			const tagEntries = Object.entries(this.tags);
			let tagNames;
			if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
				const tags = {};
				visit.visit(doc.contents, (_key, node) => {
					if (identity.isNode(node) && node.tag) tags[node.tag] = true;
				});
				tagNames = Object.keys(tags);
			} else tagNames = [];
			for (const [handle, prefix] of tagEntries) {
				if (handle === "!!" && prefix === "tag:yaml.org,2002:") continue;
				if (!doc || tagNames.some((tn) => tn.startsWith(prefix))) lines.push(`%TAG ${handle} ${prefix}`);
			}
			return lines.join("\n");
		}
	};
	Directives.defaultYaml = {
		explicit: false,
		version: "1.2"
	};
	Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
	exports.Directives = Directives;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/anchors.js
var require_anchors = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var visit = require_visit();
	/**
	* Verify that the input string is a valid anchor.
	*
	* Will throw on errors.
	*/
	function anchorIsValid(anchor) {
		if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
			const msg = `Anchor must not contain whitespace or control characters: ${JSON.stringify(anchor)}`;
			throw new Error(msg);
		}
		return true;
	}
	function anchorNames(root) {
		const anchors = /* @__PURE__ */ new Set();
		visit.visit(root, { Value(_key, node) {
			if (node.anchor) anchors.add(node.anchor);
		} });
		return anchors;
	}
	/** Find a new anchor name with the given `prefix` and a one-indexed suffix. */
	function findNewAnchor(prefix, exclude) {
		for (let i = 1;; ++i) {
			const name = `${prefix}${i}`;
			if (!exclude.has(name)) return name;
		}
	}
	function createNodeAnchors(doc, prefix) {
		const aliasObjects = [];
		const sourceObjects = /* @__PURE__ */ new Map();
		let prevAnchors = null;
		return {
			onAnchor: (source) => {
				aliasObjects.push(source);
				prevAnchors ?? (prevAnchors = anchorNames(doc));
				const anchor = findNewAnchor(prefix, prevAnchors);
				prevAnchors.add(anchor);
				return anchor;
			},
			/**
			* With circular references, the source node is only resolved after all
			* of its child nodes are. This is why anchors are set only after all of
			* the nodes have been created.
			*/
			setAnchors: () => {
				for (const source of aliasObjects) {
					const ref = sourceObjects.get(source);
					if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) ref.node.anchor = ref.anchor;
					else {
						const error = /* @__PURE__ */ new Error("Failed to resolve repeated object (this should not happen)");
						error.source = source;
						throw error;
					}
				}
			},
			sourceObjects
		};
	}
	exports.anchorIsValid = anchorIsValid;
	exports.anchorNames = anchorNames;
	exports.createNodeAnchors = createNodeAnchors;
	exports.findNewAnchor = findNewAnchor;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Applies the JSON.parse reviver algorithm as defined in the ECMA-262 spec,
	* in section 24.5.1.1 "Runtime Semantics: InternalizeJSONProperty" of the
	* 2021 edition: https://tc39.es/ecma262/#sec-json.parse
	*
	* Includes extensions for handling Map and Set objects.
	*/
	function applyReviver(reviver, obj, key, val) {
		if (val && typeof val === "object") {
			if (Array.isArray(val)) for (let i = 0, len = val.length; i < len; ++i) {
				const v0 = val[i];
				const v1 = applyReviver(reviver, val, String(i), v0);
				if (v1 === void 0) delete val[i];
				else if (v1 !== v0) val[i] = v1;
			}
			else if (val instanceof Map) for (const k of Array.from(val.keys())) {
				const v0 = val.get(k);
				const v1 = applyReviver(reviver, val, k, v0);
				if (v1 === void 0) val.delete(k);
				else if (v1 !== v0) val.set(k, v1);
			}
			else if (val instanceof Set) for (const v0 of Array.from(val)) {
				const v1 = applyReviver(reviver, val, v0, v0);
				if (v1 === void 0) val.delete(v0);
				else if (v1 !== v0) {
					val.delete(v0);
					val.add(v1);
				}
			}
			else for (const [k, v0] of Object.entries(val)) {
				const v1 = applyReviver(reviver, val, k, v0);
				if (v1 === void 0) delete val[k];
				else if (v1 !== v0) val[k] = v1;
			}
		}
		return reviver.call(obj, key, val);
	}
	exports.applyReviver = applyReviver;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	/**
	* Recursively convert any node or its contents to native JavaScript
	*
	* @param value - The input value
	* @param arg - If `value` defines a `toJSON()` method, use this
	*   as its first argument
	* @param ctx - Conversion context, originally set in Document#toJS(). If
	*   `{ keep: true }` is not set, output should be suitable for JSON
	*   stringification.
	*/
	function toJS(value, arg, ctx) {
		if (Array.isArray(value)) return value.map((v, i) => toJS(v, String(i), ctx));
		if (value && typeof value.toJSON === "function") {
			if (!ctx || !identity.hasAnchor(value)) return value.toJSON(arg, ctx);
			const data = {
				aliasCount: 0,
				count: 1,
				res: void 0
			};
			ctx.anchors.set(value, data);
			ctx.onCreate = (res) => {
				data.res = res;
				delete ctx.onCreate;
			};
			const res = value.toJSON(arg, ctx);
			if (ctx.onCreate) ctx.onCreate(res);
			return res;
		}
		if (typeof value === "bigint" && !ctx?.keep) return Number(value);
		return value;
	}
	exports.toJS = toJS;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Node.js
var require_Node = /* @__PURE__ */ __commonJSMin(((exports) => {
	var applyReviver = require_applyReviver();
	var identity = require_identity();
	var toJS = require_toJS();
	var NodeBase = class {
		constructor(type) {
			Object.defineProperty(this, identity.NODE_TYPE, { value: type });
		}
		/** Create a copy of this node.  */
		clone() {
			const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/** A plain JavaScript representation of this node. */
		toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
			if (!identity.isDocument(doc)) throw new TypeError("A document argument is required");
			const ctx = {
				anchors: /* @__PURE__ */ new Map(),
				doc,
				keep: true,
				mapAsMap: mapAsMap === true,
				mapKeyWarned: false,
				maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
			};
			const res = toJS.toJS(this, "", ctx);
			if (typeof onAnchor === "function") for (const { count, res } of ctx.anchors.values()) onAnchor(res, count);
			return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
		}
	};
	exports.NodeBase = NodeBase;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = /* @__PURE__ */ __commonJSMin(((exports) => {
	var anchors = require_anchors();
	var visit = require_visit();
	var identity = require_identity();
	var Node = require_Node();
	var toJS = require_toJS();
	var Alias = class extends Node.NodeBase {
		constructor(source) {
			super(identity.ALIAS);
			this.source = source;
			Object.defineProperty(this, "tag", { set() {
				throw new Error("Alias nodes cannot have tags");
			} });
		}
		/**
		* Resolve the value of this alias within `doc`, finding the last
		* instance of the `source` anchor before this node.
		*/
		resolve(doc, ctx) {
			if (ctx?.maxAliasCount === 0) throw new ReferenceError("Alias resolution is disabled");
			let nodes;
			if (ctx?.aliasResolveCache) nodes = ctx.aliasResolveCache;
			else {
				nodes = [];
				visit.visit(doc, { Node: (_key, node) => {
					if (identity.isAlias(node) || identity.hasAnchor(node)) nodes.push(node);
				} });
				if (ctx) ctx.aliasResolveCache = nodes;
			}
			let found = void 0;
			for (const node of nodes) {
				if (node === this) break;
				if (node.anchor === this.source) found = node;
			}
			if (found && ctx) {
				const { anchors, doc, maxAliasCount } = ctx;
				let data = anchors.get(found);
				if (!data) {
					toJS.toJS(found, null, ctx);
					data = anchors.get(found);
				}
				/* istanbul ignore if */
				if (data?.res === void 0) throw new ReferenceError("This should not happen: Alias anchor was not resolved?");
				if (maxAliasCount >= 0) {
					data.count += 1;
					if (data.aliasCount === 0) data.aliasCount = getAliasCount(doc, found, anchors);
					if (data.count * data.aliasCount > maxAliasCount) throw new ReferenceError("Excessive alias count indicates a resource exhaustion attack");
				}
			}
			return found;
		}
		toJSON(_arg, ctx) {
			if (!ctx) return { source: this.source };
			const source = this.resolve(ctx.doc, ctx);
			if (!source) {
				const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
				throw new ReferenceError(msg);
			}
			return ctx.anchors.get(source).res;
		}
		toString(ctx, _onComment, _onChompKeep) {
			const src = `*${this.source}`;
			if (ctx) {
				anchors.anchorIsValid(this.source);
				if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
					const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
					throw new Error(msg);
				}
				if (ctx.implicitKey) return `${src} `;
			}
			return src;
		}
	};
	function getAliasCount(doc, node, anchors) {
		if (identity.isAlias(node)) {
			const source = node.resolve(doc);
			const anchor = anchors && source && anchors.get(source);
			return anchor ? anchor.count * anchor.aliasCount : 0;
		} else if (identity.isCollection(node)) {
			let count = 0;
			for (const item of node.items) {
				const c = getAliasCount(doc, item, anchors);
				if (c > count) count = c;
			}
			return count;
		} else if (identity.isPair(node)) {
			const kc = getAliasCount(doc, node.key, anchors);
			const vc = getAliasCount(doc, node.value, anchors);
			return Math.max(kc, vc);
		}
		return 1;
	}
	exports.Alias = Alias;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Node = require_Node();
	var toJS = require_toJS();
	const isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
	var Scalar = class extends Node.NodeBase {
		constructor(value) {
			super(identity.SCALAR);
			this.value = value;
		}
		toJSON(arg, ctx) {
			return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
		}
		toString() {
			return String(this.value);
		}
	};
	Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
	Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
	Scalar.PLAIN = "PLAIN";
	Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
	Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
	exports.Scalar = Scalar;
	exports.isScalarValue = isScalarValue;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/createNode.js
var require_createNode = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Alias = require_Alias();
	var identity = require_identity();
	var Scalar = require_Scalar();
	const defaultTagPrefix = "tag:yaml.org,2002:";
	function findTagObject(value, tagName, tags) {
		if (tagName) {
			const match = tags.filter((t) => t.tag === tagName);
			const tagObj = match.find((t) => !t.format) ?? match[0];
			if (!tagObj) throw new Error(`Tag ${tagName} not found`);
			return tagObj;
		}
		return tags.find((t) => t.identify?.(value) && !t.format);
	}
	function createNode(value, tagName, ctx) {
		if (identity.isDocument(value)) value = value.contents;
		if (identity.isNode(value)) return value;
		if (identity.isPair(value)) {
			const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
			map.items.push(value);
			return map;
		}
		if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) value = value.valueOf();
		const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
		let ref = void 0;
		if (aliasDuplicateObjects && value && typeof value === "object") {
			ref = sourceObjects.get(value);
			if (ref) {
				ref.anchor ?? (ref.anchor = onAnchor(value));
				return new Alias.Alias(ref.anchor);
			} else {
				ref = {
					anchor: null,
					node: null
				};
				sourceObjects.set(value, ref);
			}
		}
		if (tagName?.startsWith("!!")) tagName = defaultTagPrefix + tagName.slice(2);
		let tagObj = findTagObject(value, tagName, schema.tags);
		if (!tagObj) {
			if (value && typeof value.toJSON === "function") value = value.toJSON();
			if (!value || typeof value !== "object") {
				const node = new Scalar.Scalar(value);
				if (ref) ref.node = node;
				return node;
			}
			tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
		}
		if (onTagObj) {
			onTagObj(tagObj);
			delete ctx.onTagObj;
		}
		const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
		if (tagName) node.tag = tagName;
		else if (!tagObj.default) node.tag = tagObj.tag;
		if (ref) ref.node = node;
		return node;
	}
	exports.createNode = createNode;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var createNode = require_createNode();
	var identity = require_identity();
	var Node = require_Node();
	function collectionFromPath(schema, path, value) {
		let v = value;
		for (let i = path.length - 1; i >= 0; --i) {
			const k = path[i];
			if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
				const a = [];
				a[k] = v;
				v = a;
			} else v = /* @__PURE__ */ new Map([[k, v]]);
		}
		return createNode.createNode(v, void 0, {
			aliasDuplicateObjects: false,
			keepUndefined: false,
			onAnchor: () => {
				throw new Error("This should not happen, please report a bug.");
			},
			schema,
			sourceObjects: /* @__PURE__ */ new Map()
		});
	}
	const isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
	var Collection = class extends Node.NodeBase {
		constructor(type, schema) {
			super(type);
			Object.defineProperty(this, "schema", {
				value: schema,
				configurable: true,
				enumerable: false,
				writable: true
			});
		}
		/**
		* Create a copy of this collection.
		*
		* @param schema - If defined, overwrites the original's schema
		*/
		clone(schema) {
			const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
			if (schema) copy.schema = schema;
			copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/**
		* Adds a value to the collection. For `!!map` and `!!omap` the value must
		* be a Pair instance or a `{ key, value }` object, which may not have a key
		* that already exists in the map.
		*/
		addIn(path, value) {
			if (isEmptyPath(path)) this.add(value);
			else {
				const [key, ...rest] = path;
				const node = this.get(key, true);
				if (identity.isCollection(node)) node.addIn(rest, value);
				else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
				else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
			}
		}
		/**
		* Removes a value from the collection.
		* @returns `true` if the item was found and removed.
		*/
		deleteIn(path) {
			const [key, ...rest] = path;
			if (rest.length === 0) return this.delete(key);
			const node = this.get(key, true);
			if (identity.isCollection(node)) return node.deleteIn(rest);
			else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
		}
		/**
		* Returns item at `key`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		getIn(path, keepScalar) {
			const [key, ...rest] = path;
			const node = this.get(key, true);
			if (rest.length === 0) return !keepScalar && identity.isScalar(node) ? node.value : node;
			else return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
		}
		hasAllNullValues(allowScalar) {
			return this.items.every((node) => {
				if (!identity.isPair(node)) return false;
				const n = node.value;
				return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
			});
		}
		/**
		* Checks if the collection includes a value with the key `key`.
		*/
		hasIn(path) {
			const [key, ...rest] = path;
			if (rest.length === 0) return this.has(key);
			const node = this.get(key, true);
			return identity.isCollection(node) ? node.hasIn(rest) : false;
		}
		/**
		* Sets a value in this collection. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		setIn(path, value) {
			const [key, ...rest] = path;
			if (rest.length === 0) this.set(key, value);
			else {
				const node = this.get(key, true);
				if (identity.isCollection(node)) node.setIn(rest, value);
				else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
				else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
			}
		}
	};
	exports.Collection = Collection;
	exports.collectionFromPath = collectionFromPath;
	exports.isEmptyPath = isEmptyPath;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Stringifies a comment.
	*
	* Empty comment lines are left empty,
	* lines consisting of a single space are replaced by `#`,
	* and all other lines are prefixed with a `#`.
	*/
	const stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
	function indentComment(comment, indent) {
		if (/^\n+$/.test(comment)) return comment.substring(1);
		return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
	}
	const lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
	exports.indentComment = indentComment;
	exports.lineComment = lineComment;
	exports.stringifyComment = stringifyComment;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = /* @__PURE__ */ __commonJSMin(((exports) => {
	const FOLD_FLOW = "flow";
	const FOLD_BLOCK = "block";
	const FOLD_QUOTED = "quoted";
	/**
	* Tries to keep input at up to `lineWidth` characters, splitting only on spaces
	* not followed by newlines or spaces unless `mode` is `'quoted'`. Lines are
	* terminated with `\n` and started with `indent`.
	*/
	function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
		if (!lineWidth || lineWidth < 0) return text;
		if (lineWidth < minContentWidth) minContentWidth = 0;
		const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
		if (text.length <= endStep) return text;
		const folds = [];
		const escapedFolds = {};
		let end = lineWidth - indent.length;
		if (typeof indentAtStart === "number") {
			if (indentAtStart > lineWidth - Math.max(2, minContentWidth)) folds.push(0);
			else end = lineWidth - indentAtStart;
		}
		let split = void 0;
		let prev = void 0;
		let overflow = false;
		let i = -1;
		let escStart = -1;
		let escEnd = -1;
		if (mode === FOLD_BLOCK) {
			i = consumeMoreIndentedLines(text, i, indent.length);
			if (i !== -1) end = i + endStep;
		}
		for (let ch; ch = text[i += 1];) {
			if (mode === FOLD_QUOTED && ch === "\\") {
				escStart = i;
				switch (text[i + 1]) {
					case "x":
						i += 3;
						break;
					case "u":
						i += 5;
						break;
					case "U":
						i += 9;
						break;
					default: i += 1;
				}
				escEnd = i;
			}
			if (ch === "\n") {
				if (mode === FOLD_BLOCK) i = consumeMoreIndentedLines(text, i, indent.length);
				end = i + indent.length + endStep;
				split = void 0;
			} else {
				if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
					const next = text[i + 1];
					if (next && next !== " " && next !== "\n" && next !== "	") split = i;
				}
				if (i >= end) {
					if (split) {
						folds.push(split);
						end = split + endStep;
						split = void 0;
					} else if (mode === FOLD_QUOTED) {
						while (prev === " " || prev === "	") {
							prev = ch;
							ch = text[i += 1];
							overflow = true;
						}
						const j = i > escEnd + 1 ? i - 2 : escStart - 1;
						if (escapedFolds[j]) return text;
						folds.push(j);
						escapedFolds[j] = true;
						end = j + endStep;
						split = void 0;
					} else overflow = true;
				}
			}
			prev = ch;
		}
		if (overflow && onOverflow) onOverflow();
		if (folds.length === 0) return text;
		if (onFold) onFold();
		let res = text.slice(0, folds[0]);
		for (let i = 0; i < folds.length; ++i) {
			const fold = folds[i];
			const end = folds[i + 1] || text.length;
			if (fold === 0) res = `\n${indent}${text.slice(0, end)}`;
			else {
				if (mode === FOLD_QUOTED && escapedFolds[fold]) res += `${text[fold]}\\`;
				res += `\n${indent}${text.slice(fold + 1, end)}`;
			}
		}
		return res;
	}
	/**
	* Presumes `i + 1` is at the start of a line
	* @returns index of last newline in more-indented block
	*/
	function consumeMoreIndentedLines(text, i, indent) {
		let end = i;
		let start = i + 1;
		let ch = text[start];
		while (ch === " " || ch === "	") if (i < start + indent) ch = text[++i];
		else {
			do
				ch = text[++i];
			while (ch && ch !== "\n");
			end = i;
			start = i + 1;
			ch = text[start];
		}
		return end;
	}
	exports.FOLD_BLOCK = FOLD_BLOCK;
	exports.FOLD_FLOW = FOLD_FLOW;
	exports.FOLD_QUOTED = FOLD_QUOTED;
	exports.foldFlowLines = foldFlowLines;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var foldFlowLines = require_foldFlowLines();
	const getFoldOptions = (ctx, isBlock) => ({
		indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
		lineWidth: ctx.options.lineWidth,
		minContentWidth: ctx.options.minContentWidth
	});
	const containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
	function lineLengthOverLimit(str, lineWidth, indentLength) {
		if (!lineWidth || lineWidth < 0) return false;
		const limit = lineWidth - indentLength;
		const strLen = str.length;
		if (strLen <= limit) return false;
		for (let i = 0, start = 0; i < strLen; ++i) if (str[i] === "\n") {
			if (i - start > limit) return true;
			start = i + 1;
			if (strLen - start <= limit) return false;
		}
		return true;
	}
	function doubleQuotedString(value, ctx) {
		const json = JSON.stringify(value);
		if (ctx.options.doubleQuotedAsJSON) return json;
		const { implicitKey } = ctx;
		const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
		const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
		let str = "";
		let start = 0;
		for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
			if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
				str += json.slice(start, i) + "\\ ";
				i += 1;
				start = i;
				ch = "\\";
			}
			if (ch === "\\") switch (json[i + 1]) {
				case "u":
					{
						str += json.slice(start, i);
						const code = json.substr(i + 2, 4);
						switch (code) {
							case "0000":
								str += "\\0";
								break;
							case "0007":
								str += "\\a";
								break;
							case "000b":
								str += "\\v";
								break;
							case "001b":
								str += "\\e";
								break;
							case "0085":
								str += "\\N";
								break;
							case "00a0":
								str += "\\_";
								break;
							case "2028":
								str += "\\L";
								break;
							case "2029":
								str += "\\P";
								break;
							default: if (code.substr(0, 2) === "00") str += "\\x" + code.substr(2);
							else str += json.substr(i, 6);
						}
						i += 5;
						start = i + 1;
					}
					break;
				case "n":
					if (implicitKey || json[i + 2] === "\"" || json.length < minMultiLineLength) i += 1;
					else {
						str += json.slice(start, i) + "\n\n";
						while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== "\"") {
							str += "\n";
							i += 2;
						}
						str += indent;
						if (json[i + 2] === " ") str += "\\";
						i += 1;
						start = i + 1;
					}
					break;
				default: i += 1;
			}
		}
		str = start ? str + json.slice(start) : json;
		return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
	}
	function singleQuotedString(value, ctx) {
		if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value)) return doubleQuotedString(value, ctx);
		const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
		const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&\n${indent}`) + "'";
		return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
	}
	function quotedString(value, ctx) {
		const { singleQuote } = ctx.options;
		let qs;
		if (singleQuote === false) qs = doubleQuotedString;
		else {
			const hasDouble = value.includes("\"");
			const hasSingle = value.includes("'");
			if (hasDouble && !hasSingle) qs = singleQuotedString;
			else if (hasSingle && !hasDouble) qs = doubleQuotedString;
			else qs = singleQuote ? singleQuotedString : doubleQuotedString;
		}
		return qs(value, ctx);
	}
	let blockEndNewlines;
	try {
		blockEndNewlines = /* @__PURE__ */ new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
	} catch {
		blockEndNewlines = /\n+(?!\n|$)/g;
	}
	function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
		const { blockQuote, commentString, lineWidth } = ctx.options;
		if (!blockQuote || /\n[\t ]+$/.test(value)) return quotedString(value, ctx);
		const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
		const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
		if (!value) return literal ? "|\n" : ">\n";
		let chomp;
		let endStart;
		for (endStart = value.length; endStart > 0; --endStart) {
			const ch = value[endStart - 1];
			if (ch !== "\n" && ch !== "	" && ch !== " ") break;
		}
		let end = value.substring(endStart);
		const endNlPos = end.indexOf("\n");
		if (endNlPos === -1) chomp = "-";
		else if (value === end || endNlPos !== end.length - 1) {
			chomp = "+";
			if (onChompKeep) onChompKeep();
		} else chomp = "";
		if (end) {
			value = value.slice(0, -end.length);
			if (end[end.length - 1] === "\n") end = end.slice(0, -1);
			end = end.replace(blockEndNewlines, `$&${indent}`);
		}
		let startWithSpace = false;
		let startEnd;
		let startNlPos = -1;
		for (startEnd = 0; startEnd < value.length; ++startEnd) {
			const ch = value[startEnd];
			if (ch === " ") startWithSpace = true;
			else if (ch === "\n") startNlPos = startEnd;
			else break;
		}
		let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
		if (start) {
			value = value.substring(start.length);
			start = start.replace(/\n+/g, `$&${indent}`);
		}
		let header = (startWithSpace ? indent ? "2" : "1" : "") + chomp;
		if (comment) {
			header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
			if (onComment) onComment();
		}
		if (!literal) {
			const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
			let literalFallback = false;
			const foldOptions = getFoldOptions(ctx, true);
			if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) foldOptions.onOverflow = () => {
				literalFallback = true;
			};
			const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
			if (!literalFallback) return `>${header}\n${indent}${body}`;
		}
		value = value.replace(/\n+/g, `$&${indent}`);
		return `|${header}\n${indent}${start}${value}${end}`;
	}
	function plainString(item, ctx, onComment, onChompKeep) {
		const { type, value } = item;
		const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
		if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) return quotedString(value, ctx);
		if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
		if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) return blockString(item, ctx, onComment, onChompKeep);
		if (containsDocumentMarker(value)) {
			if (indent === "") {
				ctx.forceBlockIndent = true;
				return blockString(item, ctx, onComment, onChompKeep);
			} else if (implicitKey && indent === indentStep) return quotedString(value, ctx);
		}
		const str = value.replace(/\n+/g, `$&\n${indent}`);
		if (actualString) {
			const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
			const { compat, tags } = ctx.doc.schema;
			if (tags.some(test) || compat?.some(test)) return quotedString(value, ctx);
		}
		return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
	}
	function stringifyString(item, ctx, onComment, onChompKeep) {
		const { implicitKey, inFlow } = ctx;
		const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
		let { type } = item;
		if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
			if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value)) type = Scalar.Scalar.QUOTE_DOUBLE;
		}
		const _stringify = (_type) => {
			switch (_type) {
				case Scalar.Scalar.BLOCK_FOLDED:
				case Scalar.Scalar.BLOCK_LITERAL: return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
				case Scalar.Scalar.QUOTE_DOUBLE: return doubleQuotedString(ss.value, ctx);
				case Scalar.Scalar.QUOTE_SINGLE: return singleQuotedString(ss.value, ctx);
				case Scalar.Scalar.PLAIN: return plainString(ss, ctx, onComment, onChompKeep);
				default: return null;
			}
		};
		let res = _stringify(type);
		if (res === null) {
			const { defaultKeyType, defaultStringType } = ctx.options;
			const t = implicitKey && defaultKeyType || defaultStringType;
			res = _stringify(t);
			if (res === null) throw new Error(`Unsupported default string type ${t}`);
		}
		return res;
	}
	exports.stringifyString = stringifyString;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = /* @__PURE__ */ __commonJSMin(((exports) => {
	var anchors = require_anchors();
	var identity = require_identity();
	var stringifyComment = require_stringifyComment();
	var stringifyString = require_stringifyString();
	function createStringifyContext(doc, options) {
		const opt = Object.assign({
			blockQuote: true,
			commentString: stringifyComment.stringifyComment,
			defaultKeyType: null,
			defaultStringType: "PLAIN",
			directives: null,
			doubleQuotedAsJSON: false,
			doubleQuotedMinMultiLineLength: 40,
			falseStr: "false",
			flowCollectionPadding: true,
			indentSeq: true,
			lineWidth: 80,
			minContentWidth: 20,
			nullStr: "null",
			simpleKeys: false,
			singleQuote: null,
			trailingComma: false,
			trueStr: "true",
			verifyAliasOrder: true
		}, doc.schema.toStringOptions, options);
		let inFlow;
		switch (opt.collectionStyle) {
			case "block":
				inFlow = false;
				break;
			case "flow":
				inFlow = true;
				break;
			default: inFlow = null;
		}
		return {
			anchors: /* @__PURE__ */ new Set(),
			doc,
			flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
			indent: "",
			indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
			inFlow,
			options: opt
		};
	}
	function getTagObject(tags, item) {
		if (item.tag) {
			const match = tags.filter((t) => t.tag === item.tag);
			if (match.length > 0) return match.find((t) => t.format === item.format) ?? match[0];
		}
		let tagObj = void 0;
		let obj;
		if (identity.isScalar(item)) {
			obj = item.value;
			let match = tags.filter((t) => t.identify?.(obj));
			if (match.length > 1) {
				const testMatch = match.filter((t) => t.test);
				if (testMatch.length > 0) match = testMatch;
			}
			tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
		} else {
			obj = item;
			tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
		}
		if (!tagObj) {
			const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
			throw new Error(`Tag not resolved for ${name} value`);
		}
		return tagObj;
	}
	function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
		if (!doc.directives) return "";
		const props = [];
		const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
		if (anchor && anchors.anchorIsValid(anchor)) {
			anchors$1.add(anchor);
			props.push(`&${anchor}`);
		}
		const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
		if (tag) props.push(doc.directives.tagString(tag));
		return props.join(" ");
	}
	function stringify(item, ctx, onComment, onChompKeep) {
		if (identity.isPair(item)) return item.toString(ctx, onComment, onChompKeep);
		if (identity.isAlias(item)) {
			if (ctx.doc.directives) return item.toString(ctx);
			if (ctx.resolvedAliases?.has(item)) throw new TypeError(`Cannot stringify circular structure without alias nodes`);
			else {
				if (ctx.resolvedAliases) ctx.resolvedAliases.add(item);
				else ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
				item = item.resolve(ctx.doc);
			}
		}
		let tagObj = void 0;
		const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
		tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
		const props = stringifyProps(node, tagObj, ctx);
		if (props.length > 0) ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
		const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
		if (!props) return str;
		return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}\n${ctx.indent}${str}`;
	}
	exports.createStringifyContext = createStringifyContext;
	exports.stringify = stringify;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	var stringify = require_stringify();
	var stringifyComment = require_stringifyComment();
	function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
		const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
		let keyComment = identity.isNode(key) && key.comment || null;
		if (simpleKeys) {
			if (keyComment) throw new Error("With simple keys, key nodes cannot have comments");
			if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") throw new Error("With simple keys, collection cannot be used as a key value");
		}
		let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
		ctx = Object.assign({}, ctx, {
			allNullValues: false,
			implicitKey: !explicitKey && (simpleKeys || !allNullValues),
			indent: indent + indentStep
		});
		let keyCommentDone = false;
		let chompKeep = false;
		let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
		if (!explicitKey && !ctx.inFlow && str.length > 1024) {
			if (simpleKeys) throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
			explicitKey = true;
		}
		if (ctx.inFlow) {
			if (allNullValues || value == null) {
				if (keyCommentDone && onComment) onComment();
				return str === "" ? "?" : explicitKey ? `? ${str}` : str;
			}
		} else if (allNullValues && !simpleKeys || value == null && explicitKey) {
			str = `? ${str}`;
			if (keyComment && !keyCommentDone) str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
			else if (chompKeep && onChompKeep) onChompKeep();
			return str;
		}
		if (keyCommentDone) keyComment = null;
		if (explicitKey) {
			if (keyComment) str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
			str = `? ${str}\n${indent}:`;
		} else {
			str = `${str}:`;
			if (keyComment) str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
		}
		let vsb, vcb, valueComment;
		if (identity.isNode(value)) {
			vsb = !!value.spaceBefore;
			vcb = value.commentBefore;
			valueComment = value.comment;
		} else {
			vsb = false;
			vcb = null;
			valueComment = null;
			if (value && typeof value === "object") value = doc.createNode(value);
		}
		ctx.implicitKey = false;
		if (!explicitKey && !keyComment && identity.isScalar(value)) ctx.indentAtStart = str.length + 1;
		chompKeep = false;
		if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) ctx.indent = ctx.indent.substring(2);
		let valueCommentDone = false;
		const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
		let ws = " ";
		if (keyComment || vsb || vcb) {
			ws = vsb ? "\n" : "";
			if (vcb) {
				const cs = commentString(vcb);
				ws += `\n${stringifyComment.indentComment(cs, ctx.indent)}`;
			}
			if (valueStr === "" && !ctx.inFlow) {
				if (ws === "\n" && valueComment) ws = "\n\n";
			} else ws += `\n${ctx.indent}`;
		} else if (!explicitKey && identity.isCollection(value)) {
			const vs0 = valueStr[0];
			const nl0 = valueStr.indexOf("\n");
			const hasNewline = nl0 !== -1;
			const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
			if (hasNewline || !flow) {
				let hasPropsLine = false;
				if (hasNewline && (vs0 === "&" || vs0 === "!")) {
					let sp0 = valueStr.indexOf(" ");
					if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") sp0 = valueStr.indexOf(" ", sp0 + 1);
					if (sp0 === -1 || nl0 < sp0) hasPropsLine = true;
				}
				if (!hasPropsLine) ws = `\n${ctx.indent}`;
			}
		} else if (valueStr === "" || valueStr[0] === "\n") ws = "";
		str += ws + valueStr;
		if (ctx.inFlow) {
			if (valueCommentDone && onComment) onComment();
		} else if (valueComment && !valueCommentDone) str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
		else if (chompKeep && onChompKeep) onChompKeep();
		return str;
	}
	exports.stringifyPair = stringifyPair;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/log.js
var require_log = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_process = __require("process");
	function debug(logLevel, ...messages) {
		if (logLevel === "debug") console.log(...messages);
	}
	function warn(logLevel, warning) {
		if (logLevel === "debug" || logLevel === "warn") {
			if (typeof node_process.emitWarning === "function") node_process.emitWarning(warning);
			else console.warn(warning);
		}
	}
	exports.debug = debug;
	exports.warn = warn;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	const MERGE_KEY = "<<";
	const merge = {
		identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
		default: "key",
		tag: "tag:yaml.org,2002:merge",
		test: /^<<$/,
		resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), { addToJSMap: addMergeToJSMap }),
		stringify: () => MERGE_KEY
	};
	const isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
	function addMergeToJSMap(ctx, map, value) {
		const source = resolveAliasValue(ctx, value);
		if (identity.isSeq(source)) for (const it of source.items) mergeValue(ctx, map, it);
		else if (Array.isArray(source)) for (const it of source) mergeValue(ctx, map, it);
		else mergeValue(ctx, map, source);
	}
	function mergeValue(ctx, map, value) {
		const source = resolveAliasValue(ctx, value);
		if (!identity.isMap(source)) throw new Error("Merge sources must be maps or map aliases");
		const srcMap = source.toJSON(null, ctx, Map);
		for (const [key, value] of srcMap) if (map instanceof Map) {
			if (!map.has(key)) map.set(key, value);
		} else if (map instanceof Set) map.add(key);
		else if (!Object.prototype.hasOwnProperty.call(map, key)) Object.defineProperty(map, key, {
			value,
			writable: true,
			enumerable: true,
			configurable: true
		});
		return map;
	}
	function resolveAliasValue(ctx, value) {
		return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
	}
	exports.addMergeToJSMap = addMergeToJSMap;
	exports.isMergeKey = isMergeKey;
	exports.merge = merge;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = /* @__PURE__ */ __commonJSMin(((exports) => {
	var log = require_log();
	var merge = require_merge();
	var stringify = require_stringify();
	var identity = require_identity();
	var toJS = require_toJS();
	function addPairToJSMap(ctx, map, { key, value }) {
		if (identity.isNode(key) && key.addToJSMap) key.addToJSMap(ctx, map, value);
		else if (merge.isMergeKey(ctx, key)) merge.addMergeToJSMap(ctx, map, value);
		else {
			const jsKey = toJS.toJS(key, "", ctx);
			if (map instanceof Map) map.set(jsKey, toJS.toJS(value, jsKey, ctx));
			else if (map instanceof Set) map.add(jsKey);
			else {
				const stringKey = stringifyKey(key, jsKey, ctx);
				const jsValue = toJS.toJS(value, stringKey, ctx);
				if (stringKey in map) Object.defineProperty(map, stringKey, {
					value: jsValue,
					writable: true,
					enumerable: true,
					configurable: true
				});
				else map[stringKey] = jsValue;
			}
		}
		return map;
	}
	function stringifyKey(key, jsKey, ctx) {
		if (jsKey === null) return "";
		if (typeof jsKey !== "object") return String(jsKey);
		if (identity.isNode(key) && ctx?.doc) {
			const strCtx = stringify.createStringifyContext(ctx.doc, {});
			strCtx.anchors = /* @__PURE__ */ new Set();
			for (const node of ctx.anchors.keys()) strCtx.anchors.add(node.anchor);
			strCtx.inFlow = true;
			strCtx.inStringifyKey = true;
			const strKey = key.toString(strCtx);
			if (!ctx.mapKeyWarned) {
				let jsonStr = JSON.stringify(strKey);
				if (jsonStr.length > 40) jsonStr = jsonStr.substring(0, 36) + "...\"";
				log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
				ctx.mapKeyWarned = true;
			}
			return strKey;
		}
		return JSON.stringify(jsKey);
	}
	exports.addPairToJSMap = addPairToJSMap;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = /* @__PURE__ */ __commonJSMin(((exports) => {
	var createNode = require_createNode();
	var stringifyPair = require_stringifyPair();
	var addPairToJSMap = require_addPairToJSMap();
	var identity = require_identity();
	function createPair(key, value, ctx) {
		return new Pair(createNode.createNode(key, void 0, ctx), createNode.createNode(value, void 0, ctx));
	}
	var Pair = class Pair {
		constructor(key, value = null) {
			Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
			this.key = key;
			this.value = value;
		}
		clone(schema) {
			let { key, value } = this;
			if (identity.isNode(key)) key = key.clone(schema);
			if (identity.isNode(value)) value = value.clone(schema);
			return new Pair(key, value);
		}
		toJSON(_, ctx) {
			const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
			return addPairToJSMap.addPairToJSMap(ctx, pair, this);
		}
		toString(ctx, onComment, onChompKeep) {
			return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
		}
	};
	exports.Pair = Pair;
	exports.createPair = createPair;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var stringify = require_stringify();
	var stringifyComment = require_stringifyComment();
	function stringifyCollection(collection, ctx, options) {
		return (ctx.inFlow ?? collection.flow ? stringifyFlowCollection : stringifyBlockCollection)(collection, ctx, options);
	}
	function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
		const { indent, options: { commentString } } = ctx;
		const itemCtx = Object.assign({}, ctx, {
			indent: itemIndent,
			type: null
		});
		let chompKeep = false;
		const lines = [];
		for (let i = 0; i < items.length; ++i) {
			const item = items[i];
			let comment = null;
			if (identity.isNode(item)) {
				if (!chompKeep && item.spaceBefore) lines.push("");
				addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
				if (item.comment) comment = item.comment;
			} else if (identity.isPair(item)) {
				const ik = identity.isNode(item.key) ? item.key : null;
				if (ik) {
					if (!chompKeep && ik.spaceBefore) lines.push("");
					addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
				}
			}
			chompKeep = false;
			let str = stringify.stringify(item, itemCtx, () => comment = null, () => chompKeep = true);
			if (comment) str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
			if (chompKeep && comment) chompKeep = false;
			lines.push(blockItemPrefix + str);
		}
		let str;
		if (lines.length === 0) str = flowChars.start + flowChars.end;
		else {
			str = lines[0];
			for (let i = 1; i < lines.length; ++i) {
				const line = lines[i];
				str += line ? `\n${indent}${line}` : "\n";
			}
		}
		if (comment) {
			str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
			if (onComment) onComment();
		} else if (chompKeep && onChompKeep) onChompKeep();
		return str;
	}
	function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
		const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
		itemIndent += indentStep;
		const itemCtx = Object.assign({}, ctx, {
			indent: itemIndent,
			inFlow: true,
			type: null
		});
		let reqNewline = false;
		let linesAtValue = 0;
		const lines = [];
		for (let i = 0; i < items.length; ++i) {
			const item = items[i];
			let comment = null;
			if (identity.isNode(item)) {
				if (item.spaceBefore) lines.push("");
				addCommentBefore(ctx, lines, item.commentBefore, false);
				if (item.comment) comment = item.comment;
			} else if (identity.isPair(item)) {
				const ik = identity.isNode(item.key) ? item.key : null;
				if (ik) {
					if (ik.spaceBefore) lines.push("");
					addCommentBefore(ctx, lines, ik.commentBefore, false);
					if (ik.comment) reqNewline = true;
				}
				const iv = identity.isNode(item.value) ? item.value : null;
				if (iv) {
					if (iv.comment) comment = iv.comment;
					if (iv.commentBefore) reqNewline = true;
				} else if (item.value == null && ik?.comment) comment = ik.comment;
			}
			if (comment) reqNewline = true;
			let str = stringify.stringify(item, itemCtx, () => comment = null);
			reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
			if (i < items.length - 1) str += ",";
			else if (ctx.options.trailingComma) {
				if (ctx.options.lineWidth > 0) reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
				if (reqNewline) str += ",";
			}
			if (comment) str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
			lines.push(str);
			linesAtValue = lines.length;
		}
		const { start, end } = flowChars;
		if (lines.length === 0) return start + end;
		else {
			if (!reqNewline) {
				const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
				reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
			}
			if (reqNewline) {
				let str = start;
				for (const line of lines) str += line ? `\n${indentStep}${indent}${line}` : "\n";
				return `${str}\n${indent}${end}`;
			} else return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
		}
	}
	function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
		if (comment && chompKeep) comment = comment.replace(/^\n+/, "");
		if (comment) {
			const ic = stringifyComment.indentComment(commentString(comment), indent);
			lines.push(ic.trimStart());
		}
	}
	exports.stringifyCollection = stringifyCollection;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyCollection = require_stringifyCollection();
	var addPairToJSMap = require_addPairToJSMap();
	var Collection = require_Collection();
	var identity = require_identity();
	var Pair = require_Pair();
	var Scalar = require_Scalar();
	function findPair(items, key) {
		const k = identity.isScalar(key) ? key.value : key;
		for (const it of items) if (identity.isPair(it)) {
			if (it.key === key || it.key === k) return it;
			if (identity.isScalar(it.key) && it.key.value === k) return it;
		}
	}
	var YAMLMap = class extends Collection.Collection {
		static get tagName() {
			return "tag:yaml.org,2002:map";
		}
		constructor(schema) {
			super(identity.MAP, schema);
			this.items = [];
		}
		/**
		* A generic collection parsing method that can be extended
		* to other node classes that inherit from YAMLMap
		*/
		static from(schema, obj, ctx) {
			const { keepUndefined, replacer } = ctx;
			const map = new this(schema);
			const add = (key, value) => {
				if (typeof replacer === "function") value = replacer.call(obj, key, value);
				else if (Array.isArray(replacer) && !replacer.includes(key)) return;
				if (value !== void 0 || keepUndefined) map.items.push(Pair.createPair(key, value, ctx));
			};
			if (obj instanceof Map) for (const [key, value] of obj) add(key, value);
			else if (obj && typeof obj === "object") for (const key of Object.keys(obj)) add(key, obj[key]);
			if (typeof schema.sortMapEntries === "function") map.items.sort(schema.sortMapEntries);
			return map;
		}
		/**
		* Adds a value to the collection.
		*
		* @param overwrite - If not set `true`, using a key that is already in the
		*   collection will throw. Otherwise, overwrites the previous value.
		*/
		add(pair, overwrite) {
			let _pair;
			if (identity.isPair(pair)) _pair = pair;
			else if (!pair || typeof pair !== "object" || !("key" in pair)) _pair = new Pair.Pair(pair, pair?.value);
			else _pair = new Pair.Pair(pair.key, pair.value);
			const prev = findPair(this.items, _pair.key);
			const sortEntries = this.schema?.sortMapEntries;
			if (prev) {
				if (!overwrite) throw new Error(`Key ${_pair.key} already set`);
				if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value)) prev.value.value = _pair.value;
				else prev.value = _pair.value;
			} else if (sortEntries) {
				const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
				if (i === -1) this.items.push(_pair);
				else this.items.splice(i, 0, _pair);
			} else this.items.push(_pair);
		}
		delete(key) {
			const it = findPair(this.items, key);
			if (!it) return false;
			return this.items.splice(this.items.indexOf(it), 1).length > 0;
		}
		get(key, keepScalar) {
			const node = findPair(this.items, key)?.value;
			return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
		}
		has(key) {
			return !!findPair(this.items, key);
		}
		set(key, value) {
			this.add(new Pair.Pair(key, value), true);
		}
		/**
		* @param ctx - Conversion context, originally set in Document#toJS()
		* @param {Class} Type - If set, forces the returned collection type
		* @returns Instance of Type, Map, or Object
		*/
		toJSON(_, ctx, Type) {
			const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
			if (ctx?.onCreate) ctx.onCreate(map);
			for (const item of this.items) addPairToJSMap.addPairToJSMap(ctx, map, item);
			return map;
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			for (const item of this.items) if (!identity.isPair(item)) throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
			if (!ctx.allNullValues && this.hasAllNullValues(false)) ctx = Object.assign({}, ctx, { allNullValues: true });
			return stringifyCollection.stringifyCollection(this, ctx, {
				blockItemPrefix: "",
				flowChars: {
					start: "{",
					end: "}"
				},
				itemIndent: ctx.indent || "",
				onChompKeep,
				onComment
			});
		}
	};
	exports.YAMLMap = YAMLMap;
	exports.findPair = findPair;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/map.js
var require_map = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var YAMLMap = require_YAMLMap();
	exports.map = {
		collection: "map",
		default: true,
		nodeClass: YAMLMap.YAMLMap,
		tag: "tag:yaml.org,2002:map",
		resolve(map, onError) {
			if (!identity.isMap(map)) onError("Expected a mapping for this tag");
			return map;
		},
		createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
	};
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = /* @__PURE__ */ __commonJSMin(((exports) => {
	var createNode = require_createNode();
	var stringifyCollection = require_stringifyCollection();
	var Collection = require_Collection();
	var identity = require_identity();
	var Scalar = require_Scalar();
	var toJS = require_toJS();
	var YAMLSeq = class extends Collection.Collection {
		static get tagName() {
			return "tag:yaml.org,2002:seq";
		}
		constructor(schema) {
			super(identity.SEQ, schema);
			this.items = [];
		}
		add(value) {
			this.items.push(value);
		}
		/**
		* Removes a value from the collection.
		*
		* `key` must contain a representation of an integer for this to succeed.
		* It may be wrapped in a `Scalar`.
		*
		* @returns `true` if the item was found and removed.
		*/
		delete(key) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") return false;
			return this.items.splice(idx, 1).length > 0;
		}
		get(key, keepScalar) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") return void 0;
			const it = this.items[idx];
			return !keepScalar && identity.isScalar(it) ? it.value : it;
		}
		/**
		* Checks if the collection includes a value with the key `key`.
		*
		* `key` must contain a representation of an integer for this to succeed.
		* It may be wrapped in a `Scalar`.
		*/
		has(key) {
			const idx = asItemIndex(key);
			return typeof idx === "number" && idx < this.items.length;
		}
		/**
		* Sets a value in this collection. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*
		* If `key` does not contain a representation of an integer, this will throw.
		* It may be wrapped in a `Scalar`.
		*/
		set(key, value) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") throw new Error(`Expected a valid index, not ${key}.`);
			const prev = this.items[idx];
			if (identity.isScalar(prev) && Scalar.isScalarValue(value)) prev.value = value;
			else this.items[idx] = value;
		}
		toJSON(_, ctx) {
			const seq = [];
			if (ctx?.onCreate) ctx.onCreate(seq);
			let i = 0;
			for (const item of this.items) seq.push(toJS.toJS(item, String(i++), ctx));
			return seq;
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			return stringifyCollection.stringifyCollection(this, ctx, {
				blockItemPrefix: "- ",
				flowChars: {
					start: "[",
					end: "]"
				},
				itemIndent: (ctx.indent || "") + "  ",
				onChompKeep,
				onComment
			});
		}
		static from(schema, obj, ctx) {
			const { replacer } = ctx;
			const seq = new this(schema);
			if (obj && Symbol.iterator in Object(obj)) {
				let i = 0;
				for (let it of obj) {
					if (typeof replacer === "function") {
						const key = obj instanceof Set ? it : String(i++);
						it = replacer.call(obj, key, it);
					}
					seq.items.push(createNode.createNode(it, void 0, ctx));
				}
			}
			return seq;
		}
	};
	function asItemIndex(key) {
		let idx = identity.isScalar(key) ? key.value : key;
		if (idx && typeof idx === "string") idx = Number(idx);
		return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
	}
	exports.YAMLSeq = YAMLSeq;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/seq.js
var require_seq = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var YAMLSeq = require_YAMLSeq();
	exports.seq = {
		collection: "seq",
		default: true,
		nodeClass: YAMLSeq.YAMLSeq,
		tag: "tag:yaml.org,2002:seq",
		resolve(seq, onError) {
			if (!identity.isSeq(seq)) onError("Expected a sequence for this tag");
			return seq;
		},
		createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
	};
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/string.js
var require_string = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyString = require_stringifyString();
	exports.string = {
		identify: (value) => typeof value === "string",
		default: true,
		tag: "tag:yaml.org,2002:str",
		resolve: (str) => str,
		stringify(item, ctx, onComment, onChompKeep) {
			ctx = Object.assign({ actualString: true }, ctx);
			return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
		}
	};
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/null.js
var require_null = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	const nullTag = {
		identify: (value) => value == null,
		createNode: () => new Scalar.Scalar(null),
		default: true,
		tag: "tag:yaml.org,2002:null",
		test: /^(?:~|[Nn]ull|NULL)?$/,
		resolve: () => new Scalar.Scalar(null),
		stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
	};
	exports.nullTag = nullTag;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/bool.js
var require_bool$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	const boolTag = {
		identify: (value) => typeof value === "boolean",
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
		resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
		stringify({ source, value }, ctx) {
			if (source && boolTag.test.test(source)) {
				if (value === (source[0] === "t" || source[0] === "T")) return source;
			}
			return value ? ctx.options.trueStr : ctx.options.falseStr;
		}
	};
	exports.boolTag = boolTag;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = /* @__PURE__ */ __commonJSMin(((exports) => {
	function stringifyNumber({ format, minFractionDigits, tag, value }) {
		if (typeof value === "bigint") return String(value);
		const num = typeof value === "number" ? value : Number(value);
		if (!isFinite(num)) return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
		let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
		if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
			let i = n.indexOf(".");
			if (i < 0) {
				i = n.length;
				n += ".";
			}
			let d = minFractionDigits - (n.length - i - 1);
			while (d-- > 0) n += "0";
		}
		return n;
	}
	exports.stringifyNumber = stringifyNumber;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/float.js
var require_float$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var stringifyNumber = require_stringifyNumber();
	const floatNaN = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
		resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
		stringify: stringifyNumber.stringifyNumber
	};
	const floatExp = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "EXP",
		test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
		resolve: (str) => parseFloat(str),
		stringify(node) {
			const num = Number(node.value);
			return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
		}
	};
	exports.float = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
		resolve(str) {
			const node = new Scalar.Scalar(parseFloat(str));
			const dot = str.indexOf(".");
			if (dot !== -1 && str[str.length - 1] === "0") node.minFractionDigits = str.length - dot - 1;
			return node;
		},
		stringify: stringifyNumber.stringifyNumber
	};
	exports.floatExp = floatExp;
	exports.floatNaN = floatNaN;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/int.js
var require_int$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyNumber = require_stringifyNumber();
	const intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
	const intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
	function intStringify(node, radix, prefix) {
		const { value } = node;
		if (intIdentify(value) && value >= 0) return prefix + value.toString(radix);
		return stringifyNumber.stringifyNumber(node);
	}
	const intOct = {
		identify: (value) => intIdentify(value) && value >= 0,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "OCT",
		test: /^0o[0-7]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
		stringify: (node) => intStringify(node, 8, "0o")
	};
	const int = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		test: /^[-+]?[0-9]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
		stringify: stringifyNumber.stringifyNumber
	};
	const intHex = {
		identify: (value) => intIdentify(value) && value >= 0,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "HEX",
		test: /^0x[0-9a-fA-F]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
		stringify: (node) => intStringify(node, 16, "0x")
	};
	exports.int = int;
	exports.intHex = intHex;
	exports.intOct = intOct;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/schema.js
var require_schema$2 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var map = require_map();
	var _null = require_null();
	var seq = require_seq();
	var string = require_string();
	var bool = require_bool$1();
	var float = require_float$1();
	var int = require_int$1();
	exports.schema = [
		map.map,
		seq.seq,
		string.string,
		_null.nullTag,
		bool.boolTag,
		int.intOct,
		int.int,
		int.intHex,
		float.floatNaN,
		float.floatExp,
		float.float
	];
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/json/schema.js
var require_schema$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var map = require_map();
	var seq = require_seq();
	function intIdentify(value) {
		return typeof value === "bigint" || Number.isInteger(value);
	}
	const stringifyJSON = ({ value }) => JSON.stringify(value);
	const jsonScalars = [
		{
			identify: (value) => typeof value === "string",
			default: true,
			tag: "tag:yaml.org,2002:str",
			resolve: (str) => str,
			stringify: stringifyJSON
		},
		{
			identify: (value) => value == null,
			createNode: () => new Scalar.Scalar(null),
			default: true,
			tag: "tag:yaml.org,2002:null",
			test: /^null$/,
			resolve: () => null,
			stringify: stringifyJSON
		},
		{
			identify: (value) => typeof value === "boolean",
			default: true,
			tag: "tag:yaml.org,2002:bool",
			test: /^true$|^false$/,
			resolve: (str) => str === "true",
			stringify: stringifyJSON
		},
		{
			identify: intIdentify,
			default: true,
			tag: "tag:yaml.org,2002:int",
			test: /^-?(?:0|[1-9][0-9]*)$/,
			resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
			stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
		},
		{
			identify: (value) => typeof value === "number",
			default: true,
			tag: "tag:yaml.org,2002:float",
			test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
			resolve: (str) => parseFloat(str),
			stringify: stringifyJSON
		}
	];
	exports.schema = [map.map, seq.seq].concat(jsonScalars, {
		default: true,
		tag: "",
		test: /^/,
		resolve(str, onError) {
			onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
			return str;
		}
	});
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_buffer = __require("buffer");
	var Scalar = require_Scalar();
	var stringifyString = require_stringifyString();
	exports.binary = {
		identify: (value) => value instanceof Uint8Array,
		default: false,
		tag: "tag:yaml.org,2002:binary",
		/**
		* Returns a Buffer in node and an Uint8Array in browsers
		*
		* To use the resulting buffer as an image, you'll want to do something like:
		*
		*   const blob = new Blob([buffer], { type: 'image/jpeg' })
		*   document.querySelector('#photo').src = URL.createObjectURL(blob)
		*/
		resolve(src, onError) {
			if (typeof node_buffer.Buffer === "function") return node_buffer.Buffer.from(src, "base64");
			else if (typeof atob === "function") {
				const str = atob(src.replace(/[\n\r]/g, ""));
				const buffer = new Uint8Array(str.length);
				for (let i = 0; i < str.length; ++i) buffer[i] = str.charCodeAt(i);
				return buffer;
			} else {
				onError("This environment does not support reading binary tags; either Buffer or atob is required");
				return src;
			}
		},
		stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
			if (!value) return "";
			const buf = value;
			let str;
			if (typeof node_buffer.Buffer === "function") str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
			else if (typeof btoa === "function") {
				let s = "";
				for (let i = 0; i < buf.length; ++i) s += String.fromCharCode(buf[i]);
				str = btoa(s);
			} else throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
			type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
			if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
				const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
				const n = Math.ceil(str.length / lineWidth);
				const lines = new Array(n);
				for (let i = 0, o = 0; i < n; ++i, o += lineWidth) lines[i] = str.substr(o, lineWidth);
				str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
			}
			return stringifyString.stringifyString({
				comment,
				type,
				value: str
			}, ctx, onComment, onChompKeep);
		}
	};
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Pair = require_Pair();
	var Scalar = require_Scalar();
	var YAMLSeq = require_YAMLSeq();
	function resolvePairs(seq, onError) {
		if (identity.isSeq(seq)) for (let i = 0; i < seq.items.length; ++i) {
			let item = seq.items[i];
			if (identity.isPair(item)) continue;
			else if (identity.isMap(item)) {
				if (item.items.length > 1) onError("Each pair must have its own sequence indicator");
				const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
				if (item.commentBefore) pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}\n${pair.key.commentBefore}` : item.commentBefore;
				if (item.comment) {
					const cn = pair.value ?? pair.key;
					cn.comment = cn.comment ? `${item.comment}\n${cn.comment}` : item.comment;
				}
				item = pair;
			}
			seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
		}
		else onError("Expected a sequence for this tag");
		return seq;
	}
	function createPairs(schema, iterable, ctx) {
		const { replacer } = ctx;
		const pairs = new YAMLSeq.YAMLSeq(schema);
		pairs.tag = "tag:yaml.org,2002:pairs";
		let i = 0;
		if (iterable && Symbol.iterator in Object(iterable)) for (let it of iterable) {
			if (typeof replacer === "function") it = replacer.call(iterable, String(i++), it);
			let key, value;
			if (Array.isArray(it)) {
				if (it.length === 2) {
					key = it[0];
					value = it[1];
				} else throw new TypeError(`Expected [key, value] tuple: ${it}`);
			} else if (it && it instanceof Object) {
				const keys = Object.keys(it);
				if (keys.length === 1) {
					key = keys[0];
					value = it[key];
				} else throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
			} else key = it;
			pairs.items.push(Pair.createPair(key, value, ctx));
		}
		return pairs;
	}
	const pairs = {
		collection: "seq",
		default: false,
		tag: "tag:yaml.org,2002:pairs",
		resolve: resolvePairs,
		createNode: createPairs
	};
	exports.createPairs = createPairs;
	exports.pairs = pairs;
	exports.resolvePairs = resolvePairs;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var toJS = require_toJS();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	var pairs = require_pairs();
	var YAMLOMap = class YAMLOMap extends YAMLSeq.YAMLSeq {
		constructor() {
			super();
			this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
			this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
			this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
			this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
			this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
			this.tag = YAMLOMap.tag;
		}
		/**
		* If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
		* but TypeScript won't allow widening the signature of a child method.
		*/
		toJSON(_, ctx) {
			if (!ctx) return super.toJSON(_);
			const map = /* @__PURE__ */ new Map();
			if (ctx?.onCreate) ctx.onCreate(map);
			for (const pair of this.items) {
				let key, value;
				if (identity.isPair(pair)) {
					key = toJS.toJS(pair.key, "", ctx);
					value = toJS.toJS(pair.value, key, ctx);
				} else key = toJS.toJS(pair, "", ctx);
				if (map.has(key)) throw new Error("Ordered maps must not include duplicate keys");
				map.set(key, value);
			}
			return map;
		}
		static from(schema, iterable, ctx) {
			const pairs$1 = pairs.createPairs(schema, iterable, ctx);
			const omap = new this();
			omap.items = pairs$1.items;
			return omap;
		}
	};
	YAMLOMap.tag = "tag:yaml.org,2002:omap";
	const omap = {
		collection: "seq",
		identify: (value) => value instanceof Map,
		nodeClass: YAMLOMap,
		default: false,
		tag: "tag:yaml.org,2002:omap",
		resolve(seq, onError) {
			const pairs$1 = pairs.resolvePairs(seq, onError);
			const seenKeys = [];
			for (const { key } of pairs$1.items) if (identity.isScalar(key)) {
				if (seenKeys.includes(key.value)) onError(`Ordered maps must not include duplicate keys: ${key.value}`);
				else seenKeys.push(key.value);
			}
			return Object.assign(new YAMLOMap(), pairs$1);
		},
		createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
	};
	exports.YAMLOMap = YAMLOMap;
	exports.omap = omap;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	function boolStringify({ value, source }, ctx) {
		if (source && (value ? trueTag : falseTag).test.test(source)) return source;
		return value ? ctx.options.trueStr : ctx.options.falseStr;
	}
	const trueTag = {
		identify: (value) => value === true,
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
		resolve: () => new Scalar.Scalar(true),
		stringify: boolStringify
	};
	const falseTag = {
		identify: (value) => value === false,
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
		resolve: () => new Scalar.Scalar(false),
		stringify: boolStringify
	};
	exports.falseTag = falseTag;
	exports.trueTag = trueTag;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var stringifyNumber = require_stringifyNumber();
	const floatNaN = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
		resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
		stringify: stringifyNumber.stringifyNumber
	};
	const floatExp = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "EXP",
		test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
		resolve: (str) => parseFloat(str.replace(/_/g, "")),
		stringify(node) {
			const num = Number(node.value);
			return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
		}
	};
	exports.float = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
		resolve(str) {
			const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
			const dot = str.indexOf(".");
			if (dot !== -1) {
				const f = str.substring(dot + 1).replace(/_/g, "");
				if (f[f.length - 1] === "0") node.minFractionDigits = f.length;
			}
			return node;
		},
		stringify: stringifyNumber.stringifyNumber
	};
	exports.floatExp = floatExp;
	exports.floatNaN = floatNaN;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyNumber = require_stringifyNumber();
	const intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
	function intResolve(str, offset, radix, { intAsBigInt }) {
		const sign = str[0];
		if (sign === "-" || sign === "+") offset += 1;
		str = str.substring(offset).replace(/_/g, "");
		if (intAsBigInt) {
			switch (radix) {
				case 2:
					str = `0b${str}`;
					break;
				case 8:
					str = `0o${str}`;
					break;
				case 16: str = `0x${str}`;
			}
			const n = BigInt(str);
			return sign === "-" ? BigInt(-1) * n : n;
		}
		const n = parseInt(str, radix);
		return sign === "-" ? -1 * n : n;
	}
	function intStringify(node, radix, prefix) {
		const { value } = node;
		if (intIdentify(value)) {
			const str = value.toString(radix);
			return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
		}
		return stringifyNumber.stringifyNumber(node);
	}
	const intBin = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "BIN",
		test: /^[-+]?0b[0-1_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
		stringify: (node) => intStringify(node, 2, "0b")
	};
	const intOct = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "OCT",
		test: /^[-+]?0[0-7_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
		stringify: (node) => intStringify(node, 8, "0")
	};
	const int = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		test: /^[-+]?[0-9][0-9_]*$/,
		resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
		stringify: stringifyNumber.stringifyNumber
	};
	const intHex = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "HEX",
		test: /^[-+]?0x[0-9a-fA-F_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
		stringify: (node) => intStringify(node, 16, "0x")
	};
	exports.int = int;
	exports.intBin = intBin;
	exports.intHex = intHex;
	exports.intOct = intOct;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Pair = require_Pair();
	var YAMLMap = require_YAMLMap();
	var YAMLSet = class YAMLSet extends YAMLMap.YAMLMap {
		constructor(schema) {
			super(schema);
			this.tag = YAMLSet.tag;
		}
		add(key) {
			let pair;
			if (identity.isPair(key)) pair = key;
			else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null) pair = new Pair.Pair(key.key, null);
			else pair = new Pair.Pair(key, null);
			if (!YAMLMap.findPair(this.items, pair.key)) this.items.push(pair);
		}
		/**
		* If `keepPair` is `true`, returns the Pair matching `key`.
		* Otherwise, returns the value of that Pair's key.
		*/
		get(key, keepPair) {
			const pair = YAMLMap.findPair(this.items, key);
			return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
		}
		set(key, value) {
			if (typeof value !== "boolean") throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
			const prev = YAMLMap.findPair(this.items, key);
			if (prev && !value) this.items.splice(this.items.indexOf(prev), 1);
			else if (!prev && value) this.items.push(new Pair.Pair(key));
		}
		toJSON(_, ctx) {
			return super.toJSON(_, ctx, Set);
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			if (this.hasAllNullValues(true)) return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
			else throw new Error("Set items must all have null values");
		}
		static from(schema, iterable, ctx) {
			const { replacer } = ctx;
			const set = new this(schema);
			if (iterable && Symbol.iterator in Object(iterable)) for (let value of iterable) {
				if (typeof replacer === "function") value = replacer.call(iterable, value, value);
				set.items.push(Pair.createPair(value, null, ctx));
			}
			return set;
		}
	};
	YAMLSet.tag = "tag:yaml.org,2002:set";
	const set = {
		collection: "map",
		identify: (value) => value instanceof Set,
		nodeClass: YAMLSet,
		default: false,
		tag: "tag:yaml.org,2002:set",
		createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
		resolve(map, onError) {
			if (identity.isMap(map)) {
				if (map.hasAllNullValues(true)) return Object.assign(new YAMLSet(), map);
				else onError("Set items must all have null values");
			} else onError("Expected a mapping for this tag");
			return map;
		}
	};
	exports.YAMLSet = YAMLSet;
	exports.set = set;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = /* @__PURE__ */ __commonJSMin(((exports) => {
	var stringifyNumber = require_stringifyNumber();
	/** Internal types handle bigint as number, because TS can't figure it out. */
	function parseSexagesimal(str, asBigInt) {
		const sign = str[0];
		const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
		const num = (n) => asBigInt ? BigInt(n) : Number(n);
		const res = parts.replace(/_/g, "").split(":").reduce((res, p) => res * num(60) + num(p), num(0));
		return sign === "-" ? num(-1) * res : res;
	}
	/**
	* hhhh:mm:ss.sss
	*
	* Internal types handle bigint as number, because TS can't figure it out.
	*/
	function stringifySexagesimal(node) {
		let { value } = node;
		let num = (n) => n;
		if (typeof value === "bigint") num = (n) => BigInt(n);
		else if (isNaN(value) || !isFinite(value)) return stringifyNumber.stringifyNumber(node);
		let sign = "";
		if (value < 0) {
			sign = "-";
			value *= num(-1);
		}
		const _60 = num(60);
		const parts = [value % _60];
		if (value < 60) parts.unshift(0);
		else {
			value = (value - parts[0]) / _60;
			parts.unshift(value % _60);
			if (value >= 60) {
				value = (value - parts[0]) / _60;
				parts.unshift(value);
			}
		}
		return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
	}
	const intTime = {
		identify: (value) => typeof value === "bigint" || Number.isInteger(value),
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "TIME",
		test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
		resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
		stringify: stringifySexagesimal
	};
	const floatTime = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "TIME",
		test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
		resolve: (str) => parseSexagesimal(str, false),
		stringify: stringifySexagesimal
	};
	const timestamp = {
		identify: (value) => value instanceof Date,
		default: true,
		tag: "tag:yaml.org,2002:timestamp",
		test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
		resolve(str) {
			const match = str.match(timestamp.test);
			if (!match) throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
			const [, year, month, day, hour, minute, second] = match.map(Number);
			const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
			let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
			const tz = match[8];
			if (tz && tz !== "Z") {
				let d = parseSexagesimal(tz, false);
				if (Math.abs(d) < 30) d *= 60;
				date -= 6e4 * d;
			}
			return new Date(date);
		},
		stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
	};
	exports.floatTime = floatTime;
	exports.intTime = intTime;
	exports.timestamp = timestamp;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema = /* @__PURE__ */ __commonJSMin(((exports) => {
	var map = require_map();
	var _null = require_null();
	var seq = require_seq();
	var string = require_string();
	var binary = require_binary();
	var bool = require_bool();
	var float = require_float();
	var int = require_int();
	var merge = require_merge();
	var omap = require_omap();
	var pairs = require_pairs();
	var set = require_set();
	var timestamp = require_timestamp();
	exports.schema = [
		map.map,
		seq.seq,
		string.string,
		_null.nullTag,
		bool.trueTag,
		bool.falseTag,
		int.intBin,
		int.intOct,
		int.int,
		int.intHex,
		float.floatNaN,
		float.floatExp,
		float.float,
		binary.binary,
		merge.merge,
		omap.omap,
		pairs.pairs,
		set.set,
		timestamp.intTime,
		timestamp.floatTime,
		timestamp.timestamp
	];
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/tags.js
var require_tags = /* @__PURE__ */ __commonJSMin(((exports) => {
	var map = require_map();
	var _null = require_null();
	var seq = require_seq();
	var string = require_string();
	var bool = require_bool$1();
	var float = require_float$1();
	var int = require_int$1();
	var schema = require_schema$2();
	var schema$1 = require_schema$1();
	var binary = require_binary();
	var merge = require_merge();
	var omap = require_omap();
	var pairs = require_pairs();
	var schema$2 = require_schema();
	var set = require_set();
	var timestamp = require_timestamp();
	const schemas = /* @__PURE__ */ new Map([
		["core", schema.schema],
		["failsafe", [
			map.map,
			seq.seq,
			string.string
		]],
		["json", schema$1.schema],
		["yaml11", schema$2.schema],
		["yaml-1.1", schema$2.schema]
	]);
	const tagsByName = {
		binary: binary.binary,
		bool: bool.boolTag,
		float: float.float,
		floatExp: float.floatExp,
		floatNaN: float.floatNaN,
		floatTime: timestamp.floatTime,
		int: int.int,
		intHex: int.intHex,
		intOct: int.intOct,
		intTime: timestamp.intTime,
		map: map.map,
		merge: merge.merge,
		null: _null.nullTag,
		omap: omap.omap,
		pairs: pairs.pairs,
		seq: seq.seq,
		set: set.set,
		timestamp: timestamp.timestamp
	};
	const coreKnownTags = {
		"tag:yaml.org,2002:binary": binary.binary,
		"tag:yaml.org,2002:merge": merge.merge,
		"tag:yaml.org,2002:omap": omap.omap,
		"tag:yaml.org,2002:pairs": pairs.pairs,
		"tag:yaml.org,2002:set": set.set,
		"tag:yaml.org,2002:timestamp": timestamp.timestamp
	};
	function getTags(customTags, schemaName, addMergeTag) {
		const schemaTags = schemas.get(schemaName);
		if (schemaTags && !customTags) return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
		let tags = schemaTags;
		if (!tags) {
			if (Array.isArray(customTags)) tags = [];
			else {
				const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
				throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
			}
		}
		if (Array.isArray(customTags)) for (const tag of customTags) tags = tags.concat(tag);
		else if (typeof customTags === "function") tags = customTags(tags.slice());
		if (addMergeTag) tags = tags.concat(merge.merge);
		return tags.reduce((tags, tag) => {
			const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
			if (!tagObj) {
				const tagName = JSON.stringify(tag);
				const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
				throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
			}
			if (!tags.includes(tagObj)) tags.push(tagObj);
			return tags;
		}, []);
	}
	exports.coreKnownTags = coreKnownTags;
	exports.getTags = getTags;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/Schema.js
var require_Schema = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var map = require_map();
	var seq = require_seq();
	var string = require_string();
	var tags = require_tags();
	const sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
	exports.Schema = class Schema {
		constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
			this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
			this.name = typeof schema === "string" && schema || "core";
			this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
			this.tags = tags.getTags(customTags, this.name, merge);
			this.toStringOptions = toStringDefaults ?? null;
			Object.defineProperty(this, identity.MAP, { value: map.map });
			Object.defineProperty(this, identity.SCALAR, { value: string.string });
			Object.defineProperty(this, identity.SEQ, { value: seq.seq });
			this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
		}
		clone() {
			const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
			copy.tags = this.tags.slice();
			return copy;
		}
	};
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var stringify = require_stringify();
	var stringifyComment = require_stringifyComment();
	function stringifyDocument(doc, options) {
		const lines = [];
		let hasDirectives = options.directives === true;
		if (options.directives !== false && doc.directives) {
			const dir = doc.directives.toString(doc);
			if (dir) {
				lines.push(dir);
				hasDirectives = true;
			} else if (doc.directives.docStart) hasDirectives = true;
		}
		if (hasDirectives) lines.push("---");
		const ctx = stringify.createStringifyContext(doc, options);
		const { commentString } = ctx.options;
		if (doc.commentBefore) {
			if (lines.length !== 1) lines.unshift("");
			const cs = commentString(doc.commentBefore);
			lines.unshift(stringifyComment.indentComment(cs, ""));
		}
		let chompKeep = false;
		let contentComment = null;
		if (doc.contents) {
			if (identity.isNode(doc.contents)) {
				if (doc.contents.spaceBefore && hasDirectives) lines.push("");
				if (doc.contents.commentBefore) {
					const cs = commentString(doc.contents.commentBefore);
					lines.push(stringifyComment.indentComment(cs, ""));
				}
				ctx.forceBlockIndent = !!doc.comment;
				contentComment = doc.contents.comment;
			}
			const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
			let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
			if (contentComment) body += stringifyComment.lineComment(body, "", commentString(contentComment));
			if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") lines[lines.length - 1] = `--- ${body}`;
			else lines.push(body);
		} else lines.push(stringify.stringify(doc.contents, ctx));
		if (doc.directives?.docEnd) {
			if (doc.comment) {
				const cs = commentString(doc.comment);
				if (cs.includes("\n")) {
					lines.push("...");
					lines.push(stringifyComment.indentComment(cs, ""));
				} else lines.push(`... ${cs}`);
			} else lines.push("...");
		} else {
			let dc = doc.comment;
			if (dc && chompKeep) dc = dc.replace(/^\n+/, "");
			if (dc) {
				if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "") lines.push("");
				lines.push(stringifyComment.indentComment(commentString(dc), ""));
			}
		}
		return lines.join("\n") + "\n";
	}
	exports.stringifyDocument = stringifyDocument;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/Document.js
var require_Document = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Alias = require_Alias();
	var Collection = require_Collection();
	var identity = require_identity();
	var Pair = require_Pair();
	var toJS = require_toJS();
	var Schema = require_Schema();
	var stringifyDocument = require_stringifyDocument();
	var anchors = require_anchors();
	var applyReviver = require_applyReviver();
	var createNode = require_createNode();
	var directives = require_directives();
	var Document = class Document {
		constructor(value, replacer, options) {
			/** A comment before this Document */
			this.commentBefore = null;
			/** A comment immediately after this Document */
			this.comment = null;
			/** Errors encountered during parsing. */
			this.errors = [];
			/** Warnings encountered during parsing. */
			this.warnings = [];
			Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
			let _replacer = null;
			if (typeof replacer === "function" || Array.isArray(replacer)) _replacer = replacer;
			else if (options === void 0 && replacer) {
				options = replacer;
				replacer = void 0;
			}
			const opt = Object.assign({
				intAsBigInt: false,
				keepSourceTokens: false,
				logLevel: "warn",
				prettyErrors: true,
				strict: true,
				stringKeys: false,
				uniqueKeys: true,
				version: "1.2"
			}, options);
			this.options = opt;
			let { version } = opt;
			if (options?._directives) {
				this.directives = options._directives.atDocument();
				if (this.directives.yaml.explicit) version = this.directives.yaml.version;
			} else this.directives = new directives.Directives({ version });
			this.setSchema(version, options);
			this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
		}
		/**
		* Create a deep copy of this Document and its contents.
		*
		* Custom Node values that inherit from `Object` still refer to their original instances.
		*/
		clone() {
			const copy = Object.create(Document.prototype, { [identity.NODE_TYPE]: { value: identity.DOC } });
			copy.commentBefore = this.commentBefore;
			copy.comment = this.comment;
			copy.errors = this.errors.slice();
			copy.warnings = this.warnings.slice();
			copy.options = Object.assign({}, this.options);
			if (this.directives) copy.directives = this.directives.clone();
			copy.schema = this.schema.clone();
			copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/** Adds a value to the document. */
		add(value) {
			if (assertCollection(this.contents)) this.contents.add(value);
		}
		/** Adds a value to the document. */
		addIn(path, value) {
			if (assertCollection(this.contents)) this.contents.addIn(path, value);
		}
		/**
		* Create a new `Alias` node, ensuring that the target `node` has the required anchor.
		*
		* If `node` already has an anchor, `name` is ignored.
		* Otherwise, the `node.anchor` value will be set to `name`,
		* or if an anchor with that name is already present in the document,
		* `name` will be used as a prefix for a new unique anchor.
		* If `name` is undefined, the generated anchor will use 'a' as a prefix.
		*/
		createAlias(node, name) {
			if (!node.anchor) {
				const prev = anchors.anchorNames(this);
				node.anchor = !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
			}
			return new Alias.Alias(node.anchor);
		}
		createNode(value, replacer, options) {
			let _replacer = void 0;
			if (typeof replacer === "function") {
				value = replacer.call({ "": value }, "", value);
				_replacer = replacer;
			} else if (Array.isArray(replacer)) {
				const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
				const asStr = replacer.filter(keyToStr).map(String);
				if (asStr.length > 0) replacer = replacer.concat(asStr);
				_replacer = replacer;
			} else if (options === void 0 && replacer) {
				options = replacer;
				replacer = void 0;
			}
			const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
			const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(this, anchorPrefix || "a");
			const ctx = {
				aliasDuplicateObjects: aliasDuplicateObjects ?? true,
				keepUndefined: keepUndefined ?? false,
				onAnchor,
				onTagObj,
				replacer: _replacer,
				schema: this.schema,
				sourceObjects
			};
			const node = createNode.createNode(value, tag, ctx);
			if (flow && identity.isCollection(node)) node.flow = true;
			setAnchors();
			return node;
		}
		/**
		* Convert a key and a value into a `Pair` using the current schema,
		* recursively wrapping all values as `Scalar` or `Collection` nodes.
		*/
		createPair(key, value, options = {}) {
			const k = this.createNode(key, null, options);
			const v = this.createNode(value, null, options);
			return new Pair.Pair(k, v);
		}
		/**
		* Removes a value from the document.
		* @returns `true` if the item was found and removed.
		*/
		delete(key) {
			return assertCollection(this.contents) ? this.contents.delete(key) : false;
		}
		/**
		* Removes a value from the document.
		* @returns `true` if the item was found and removed.
		*/
		deleteIn(path) {
			if (Collection.isEmptyPath(path)) {
				if (this.contents == null) return false;
				this.contents = null;
				return true;
			}
			return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
		}
		/**
		* Returns item at `key`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		get(key, keepScalar) {
			return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
		}
		/**
		* Returns item at `path`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		getIn(path, keepScalar) {
			if (Collection.isEmptyPath(path)) return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
			return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
		}
		/**
		* Checks if the document includes a value with the key `key`.
		*/
		has(key) {
			return identity.isCollection(this.contents) ? this.contents.has(key) : false;
		}
		/**
		* Checks if the document includes a value at `path`.
		*/
		hasIn(path) {
			if (Collection.isEmptyPath(path)) return this.contents !== void 0;
			return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
		}
		/**
		* Sets a value in this document. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		set(key, value) {
			if (this.contents == null) this.contents = Collection.collectionFromPath(this.schema, [key], value);
			else if (assertCollection(this.contents)) this.contents.set(key, value);
		}
		/**
		* Sets a value in this document. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		setIn(path, value) {
			if (Collection.isEmptyPath(path)) this.contents = value;
			else if (this.contents == null) this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
			else if (assertCollection(this.contents)) this.contents.setIn(path, value);
		}
		/**
		* Change the YAML version and schema used by the document.
		* A `null` version disables support for directives, explicit tags, anchors, and aliases.
		* It also requires the `schema` option to be given as a `Schema` instance value.
		*
		* Overrides all previously set schema options.
		*/
		setSchema(version, options = {}) {
			if (typeof version === "number") version = String(version);
			let opt;
			switch (version) {
				case "1.1":
					if (this.directives) this.directives.yaml.version = "1.1";
					else this.directives = new directives.Directives({ version: "1.1" });
					opt = {
						resolveKnownTags: false,
						schema: "yaml-1.1"
					};
					break;
				case "1.2":
				case "next":
					if (this.directives) this.directives.yaml.version = version;
					else this.directives = new directives.Directives({ version });
					opt = {
						resolveKnownTags: true,
						schema: "core"
					};
					break;
				case null:
					if (this.directives) delete this.directives;
					opt = null;
					break;
				default: {
					const sv = JSON.stringify(version);
					throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
				}
			}
			if (options.schema instanceof Object) this.schema = options.schema;
			else if (opt) this.schema = new Schema.Schema(Object.assign(opt, options));
			else throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
		}
		toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
			const ctx = {
				anchors: /* @__PURE__ */ new Map(),
				doc: this,
				keep: !json,
				mapAsMap: mapAsMap === true,
				mapKeyWarned: false,
				maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
			};
			const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
			if (typeof onAnchor === "function") for (const { count, res } of ctx.anchors.values()) onAnchor(res, count);
			return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
		}
		/**
		* A JSON representation of the document `contents`.
		*
		* @param jsonArg Used by `JSON.stringify` to indicate the array index or
		*   property name.
		*/
		toJSON(jsonArg, onAnchor) {
			return this.toJS({
				json: true,
				jsonArg,
				mapAsMap: false,
				onAnchor
			});
		}
		/** A YAML representation of the document. */
		toString(options = {}) {
			if (this.errors.length > 0) throw new Error("Document with errors cannot be stringified");
			if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
				const s = JSON.stringify(options.indent);
				throw new Error(`"indent" option must be a positive integer, not ${s}`);
			}
			return stringifyDocument.stringifyDocument(this, options);
		}
	};
	function assertCollection(contents) {
		if (identity.isCollection(contents)) return true;
		throw new Error("Expected a YAML collection as document contents");
	}
	exports.Document = Document;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/errors.js
var require_errors = /* @__PURE__ */ __commonJSMin(((exports) => {
	var YAMLError = class extends Error {
		constructor(name, pos, code, message) {
			super();
			this.name = name;
			this.code = code;
			this.message = message;
			this.pos = pos;
		}
	};
	var YAMLParseError = class extends YAMLError {
		constructor(pos, code, message) {
			super("YAMLParseError", pos, code, message);
		}
	};
	var YAMLWarning = class extends YAMLError {
		constructor(pos, code, message) {
			super("YAMLWarning", pos, code, message);
		}
	};
	const prettifyError = (src, lc) => (error) => {
		if (error.pos[0] === -1) return;
		error.linePos = error.pos.map((pos) => lc.linePos(pos));
		const { line, col } = error.linePos[0];
		error.message += ` at line ${line}, column ${col}`;
		let ci = col - 1;
		let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
		if (ci >= 60 && lineStr.length > 80) {
			const trimStart = Math.min(ci - 39, lineStr.length - 79);
			lineStr = "…" + lineStr.substring(trimStart);
			ci -= trimStart - 1;
		}
		if (lineStr.length > 80) lineStr = lineStr.substring(0, 79) + "…";
		if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
			let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
			if (prev.length > 80) prev = prev.substring(0, 79) + "…\n";
			lineStr = prev + lineStr;
		}
		if (/[^ ]/.test(lineStr)) {
			let count = 1;
			const end = error.linePos[1];
			if (end?.line === line && end.col > col) count = Math.max(1, Math.min(end.col - col, 80 - ci));
			const pointer = " ".repeat(ci) + "^".repeat(count);
			error.message += `:\n\n${lineStr}\n${pointer}\n`;
		}
	};
	exports.YAMLError = YAMLError;
	exports.YAMLParseError = YAMLParseError;
	exports.YAMLWarning = YAMLWarning;
	exports.prettifyError = prettifyError;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = /* @__PURE__ */ __commonJSMin(((exports) => {
	function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
		let spaceBefore = false;
		let atNewline = startOnNewline;
		let hasSpace = startOnNewline;
		let comment = "";
		let commentSep = "";
		let hasNewline = false;
		let reqSpace = false;
		let tab = null;
		let anchor = null;
		let tag = null;
		let newlineAfterProp = null;
		let comma = null;
		let found = null;
		let start = null;
		for (const token of tokens) {
			if (reqSpace) {
				if (token.type !== "space" && token.type !== "newline" && token.type !== "comma") onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
				reqSpace = false;
			}
			if (tab) {
				if (atNewline && token.type !== "comment" && token.type !== "newline") onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
				tab = null;
			}
			switch (token.type) {
				case "space":
					if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) tab = token;
					hasSpace = true;
					break;
				case "comment": {
					if (!hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
					const cb = token.source.substring(1) || " ";
					if (!comment) comment = cb;
					else comment += commentSep + cb;
					commentSep = "";
					atNewline = false;
					break;
				}
				case "newline":
					if (atNewline) {
						if (comment) comment += token.source;
						else if (!found || indicator !== "seq-item-ind") spaceBefore = true;
					} else commentSep += token.source;
					atNewline = true;
					hasNewline = true;
					if (anchor || tag) newlineAfterProp = token;
					hasSpace = true;
					break;
				case "anchor":
					if (anchor) onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
					if (token.source.endsWith(":")) onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
					anchor = token;
					start ?? (start = token.offset);
					atNewline = false;
					hasSpace = false;
					reqSpace = true;
					break;
				case "tag":
					if (tag) onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
					tag = token;
					start ?? (start = token.offset);
					atNewline = false;
					hasSpace = false;
					reqSpace = true;
					break;
				case indicator:
					if (anchor || tag) onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
					if (found) onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
					found = token;
					atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
					hasSpace = false;
					break;
				case "comma": if (flow) {
					if (comma) onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
					comma = token;
					atNewline = false;
					hasSpace = false;
					break;
				}
				default:
					onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
					atNewline = false;
					hasSpace = false;
			}
		}
		const last = tokens[tokens.length - 1];
		const end = last ? last.offset + last.source.length : offset;
		if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
		if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq")) onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
		return {
			comma,
			found,
			spaceBefore,
			comment,
			hasNewline,
			anchor,
			tag,
			newlineAfterProp,
			end,
			start: start ?? end
		};
	}
	exports.resolveProps = resolveProps;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = /* @__PURE__ */ __commonJSMin(((exports) => {
	function containsNewline(key) {
		if (!key) return null;
		switch (key.type) {
			case "alias":
			case "scalar":
			case "double-quoted-scalar":
			case "single-quoted-scalar":
				if (key.source.includes("\n")) return true;
				if (key.end) {
					for (const st of key.end) if (st.type === "newline") return true;
				}
				return false;
			case "flow-collection":
				for (const it of key.items) {
					for (const st of it.start) if (st.type === "newline") return true;
					if (it.sep) {
						for (const st of it.sep) if (st.type === "newline") return true;
					}
					if (containsNewline(it.key) || containsNewline(it.value)) return true;
				}
				return false;
			default: return true;
		}
	}
	exports.containsNewline = containsNewline;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = /* @__PURE__ */ __commonJSMin(((exports) => {
	var utilContainsNewline = require_util_contains_newline();
	function flowIndentCheck(indent, fc, onError) {
		if (fc?.type === "flow-collection") {
			const end = fc.end[0];
			if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) onError(end, "BAD_INDENT", "Flow end indicator should be more indented than parent", true);
		}
	}
	exports.flowIndentCheck = flowIndentCheck;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	function mapIncludes(ctx, items, search) {
		const { uniqueKeys } = ctx.options;
		if (uniqueKeys === false) return false;
		const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
		return items.some((pair) => isEqual(pair.key, search));
	}
	exports.mapIncludes = mapIncludes;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Pair = require_Pair();
	var YAMLMap = require_YAMLMap();
	var resolveProps = require_resolve_props();
	var utilContainsNewline = require_util_contains_newline();
	var utilFlowIndentCheck = require_util_flow_indent_check();
	var utilMapIncludes = require_util_map_includes();
	const startColMsg = "All mapping items must start at the same column";
	function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
		const map = new ((tag?.nodeClass) ?? YAMLMap.YAMLMap)(ctx.schema);
		if (ctx.atRoot) ctx.atRoot = false;
		let offset = bm.offset;
		let commentEnd = null;
		for (const collItem of bm.items) {
			const { start, key, sep, value } = collItem;
			const keyProps = resolveProps.resolveProps(start, {
				indicator: "explicit-key-ind",
				next: key ?? sep?.[0],
				offset,
				onError,
				parentIndent: bm.indent,
				startOnNewline: true
			});
			const implicitKey = !keyProps.found;
			if (implicitKey) {
				if (key) {
					if (key.type === "block-seq") onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
					else if ("indent" in key && key.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
				}
				if (!keyProps.anchor && !keyProps.tag && !sep) {
					commentEnd = keyProps.end;
					if (keyProps.comment) {
						if (map.comment) map.comment += "\n" + keyProps.comment;
						else map.comment = keyProps.comment;
					}
					continue;
				}
				if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
			} else if (keyProps.found?.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
			ctx.atKey = true;
			const keyStart = keyProps.end;
			const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
			if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
			ctx.atKey = false;
			if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
			const valueProps = resolveProps.resolveProps(sep ?? [], {
				indicator: "map-value-ind",
				next: value,
				offset: keyNode.range[2],
				onError,
				parentIndent: bm.indent,
				startOnNewline: !key || key.type === "block-scalar"
			});
			offset = valueProps.end;
			if (valueProps.found) {
				if (implicitKey) {
					if (value?.type === "block-map" && !valueProps.hasNewline) onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
					if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024) onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
				}
				const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
				if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
				offset = valueNode.range[2];
				const pair = new Pair.Pair(keyNode, valueNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				map.items.push(pair);
			} else {
				if (implicitKey) onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
				if (valueProps.comment) {
					if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
					else keyNode.comment = valueProps.comment;
				}
				const pair = new Pair.Pair(keyNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				map.items.push(pair);
			}
		}
		if (commentEnd && commentEnd < offset) onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
		map.range = [
			bm.offset,
			offset,
			commentEnd ?? offset
		];
		return map;
	}
	exports.resolveBlockMap = resolveBlockMap;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = /* @__PURE__ */ __commonJSMin(((exports) => {
	var YAMLSeq = require_YAMLSeq();
	var resolveProps = require_resolve_props();
	var utilFlowIndentCheck = require_util_flow_indent_check();
	function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
		const seq = new ((tag?.nodeClass) ?? YAMLSeq.YAMLSeq)(ctx.schema);
		if (ctx.atRoot) ctx.atRoot = false;
		if (ctx.atKey) ctx.atKey = false;
		let offset = bs.offset;
		let commentEnd = null;
		for (const { start, value } of bs.items) {
			const props = resolveProps.resolveProps(start, {
				indicator: "seq-item-ind",
				next: value,
				offset,
				onError,
				parentIndent: bs.indent,
				startOnNewline: true
			});
			if (!props.found) {
				if (props.anchor || props.tag || value) {
					if (value?.type === "block-seq") onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
					else onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
				} else {
					commentEnd = props.end;
					if (props.comment) seq.comment = props.comment;
					continue;
				}
			}
			const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
			if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
			offset = node.range[2];
			seq.items.push(node);
		}
		seq.range = [
			bs.offset,
			offset,
			commentEnd ?? offset
		];
		return seq;
	}
	exports.resolveBlockSeq = resolveBlockSeq;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = /* @__PURE__ */ __commonJSMin(((exports) => {
	function resolveEnd(end, offset, reqSpace, onError) {
		let comment = "";
		if (end) {
			let hasSpace = false;
			let sep = "";
			for (const token of end) {
				const { source, type } = token;
				switch (type) {
					case "space":
						hasSpace = true;
						break;
					case "comment": {
						if (reqSpace && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
						const cb = source.substring(1) || " ";
						if (!comment) comment = cb;
						else comment += sep + cb;
						sep = "";
						break;
					}
					case "newline":
						if (comment) sep += source;
						hasSpace = true;
						break;
					default: onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
				}
				offset += source.length;
			}
		}
		return {
			comment,
			offset
		};
	}
	exports.resolveEnd = resolveEnd;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Pair = require_Pair();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	var resolveEnd = require_resolve_end();
	var resolveProps = require_resolve_props();
	var utilContainsNewline = require_util_contains_newline();
	var utilMapIncludes = require_util_map_includes();
	const blockMsg = "Block collections are not allowed within flow collections";
	const isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
	function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
		const isMap = fc.start.source === "{";
		const fcName = isMap ? "flow map" : "flow sequence";
		const coll = new ((tag?.nodeClass) ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq))(ctx.schema);
		coll.flow = true;
		const atRoot = ctx.atRoot;
		if (atRoot) ctx.atRoot = false;
		if (ctx.atKey) ctx.atKey = false;
		let offset = fc.offset + fc.start.source.length;
		for (let i = 0; i < fc.items.length; ++i) {
			const collItem = fc.items[i];
			const { start, key, sep, value } = collItem;
			const props = resolveProps.resolveProps(start, {
				flow: fcName,
				indicator: "explicit-key-ind",
				next: key ?? sep?.[0],
				offset,
				onError,
				parentIndent: fc.indent,
				startOnNewline: false
			});
			if (!props.found) {
				if (!props.anchor && !props.tag && !sep && !value) {
					if (i === 0 && props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
					else if (i < fc.items.length - 1) onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
					if (props.comment) {
						if (coll.comment) coll.comment += "\n" + props.comment;
						else coll.comment = props.comment;
					}
					offset = props.end;
					continue;
				}
				if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key)) onError(key, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
			}
			if (i === 0) {
				if (props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
			} else {
				if (!props.comma) onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
				if (props.comment) {
					let prevItemComment = "";
					loop: for (const st of start) switch (st.type) {
						case "comma":
						case "space": break;
						case "comment":
							prevItemComment = st.source.substring(1);
							break loop;
						default: break loop;
					}
					if (prevItemComment) {
						let prev = coll.items[coll.items.length - 1];
						if (identity.isPair(prev)) prev = prev.value ?? prev.key;
						if (prev.comment) prev.comment += "\n" + prevItemComment;
						else prev.comment = prevItemComment;
						props.comment = props.comment.substring(prevItemComment.length + 1);
					}
				}
			}
			if (!isMap && !sep && !props.found) {
				const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
				coll.items.push(valueNode);
				offset = valueNode.range[2];
				if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
			} else {
				ctx.atKey = true;
				const keyStart = props.end;
				const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
				if (isBlock(key)) onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
				ctx.atKey = false;
				const valueProps = resolveProps.resolveProps(sep ?? [], {
					flow: fcName,
					indicator: "map-value-ind",
					next: value,
					offset: keyNode.range[2],
					onError,
					parentIndent: fc.indent,
					startOnNewline: false
				});
				if (valueProps.found) {
					if (!isMap && !props.found && ctx.options.strict) {
						if (sep) for (const st of sep) {
							if (st === valueProps.found) break;
							if (st.type === "newline") {
								onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
								break;
							}
						}
						if (props.start < valueProps.found.offset - 1024) onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
					}
				} else if (value) {
					if ("source" in value && value.source?.[0] === ":") onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
					else onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
				}
				const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
				if (valueNode) {
					if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
				} else if (valueProps.comment) {
					if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
					else keyNode.comment = valueProps.comment;
				}
				const pair = new Pair.Pair(keyNode, valueNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				if (isMap) {
					const map = coll;
					if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
					map.items.push(pair);
				} else {
					const map = new YAMLMap.YAMLMap(ctx.schema);
					map.flow = true;
					map.items.push(pair);
					const endRange = (valueNode ?? keyNode).range;
					map.range = [
						keyNode.range[0],
						endRange[1],
						endRange[2]
					];
					coll.items.push(map);
				}
				offset = valueNode ? valueNode.range[2] : valueProps.end;
			}
		}
		const expectedEnd = isMap ? "}" : "]";
		const [ce, ...ee] = fc.end;
		let cePos = offset;
		if (ce?.source === expectedEnd) cePos = ce.offset + ce.source.length;
		else {
			const name = fcName[0].toUpperCase() + fcName.substring(1);
			const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
			onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
			if (ce && ce.source.length !== 1) ee.unshift(ce);
		}
		if (ee.length > 0) {
			const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
			if (end.comment) {
				if (coll.comment) coll.comment += "\n" + end.comment;
				else coll.comment = end.comment;
			}
			coll.range = [
				fc.offset,
				cePos,
				end.offset
			];
		} else coll.range = [
			fc.offset,
			cePos,
			cePos
		];
		return coll;
	}
	exports.resolveFlowCollection = resolveFlowCollection;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	var resolveBlockMap = require_resolve_block_map();
	var resolveBlockSeq = require_resolve_block_seq();
	var resolveFlowCollection = require_resolve_flow_collection();
	function resolveCollection(CN, ctx, token, onError, tagName, tag) {
		const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
		const Coll = coll.constructor;
		if (tagName === "!" || tagName === Coll.tagName) {
			coll.tag = Coll.tagName;
			return coll;
		}
		if (tagName) coll.tag = tagName;
		return coll;
	}
	function composeCollection(CN, ctx, token, props, onError) {
		const tagToken = props.tag;
		const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
		if (token.type === "block-seq") {
			const { anchor, newlineAfterProp: nl } = props;
			const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
			if (lastProp && (!nl || nl.offset < lastProp.offset)) onError(lastProp, "MISSING_CHAR", "Missing newline after block sequence props");
		}
		const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
		if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") return resolveCollection(CN, ctx, token, onError, tagName);
		let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
		if (!tag) {
			const kt = ctx.schema.knownTags[tagName];
			if (kt?.collection === expType) {
				ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
				tag = kt;
			} else {
				if (kt) onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
				else onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
				return resolveCollection(CN, ctx, token, onError, tagName);
			}
		}
		const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
		const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
		const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
		node.range = coll.range;
		node.tag = tagName;
		if (tag?.format) node.format = tag.format;
		return node;
	}
	exports.composeCollection = composeCollection;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	function resolveBlockScalar(ctx, scalar, onError) {
		const start = scalar.offset;
		const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
		if (!header) return {
			value: "",
			type: null,
			comment: "",
			range: [
				start,
				start,
				start
			]
		};
		const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
		const lines = scalar.source ? splitLines(scalar.source) : [];
		let chompStart = lines.length;
		for (let i = lines.length - 1; i >= 0; --i) {
			const content = lines[i][1];
			if (content === "" || content === "\r") chompStart = i;
			else break;
		}
		if (chompStart === 0) {
			const value = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
			let end = start + header.length;
			if (scalar.source) end += scalar.source.length;
			return {
				value,
				type,
				comment: header.comment,
				range: [
					start,
					end,
					end
				]
			};
		}
		let trimIndent = scalar.indent + header.indent;
		let offset = scalar.offset + header.length;
		let contentStart = 0;
		for (let i = 0; i < chompStart; ++i) {
			const [indent, content] = lines[i];
			if (content === "" || content === "\r") {
				if (header.indent === 0 && indent.length > trimIndent) trimIndent = indent.length;
			} else {
				if (indent.length < trimIndent) onError(offset + indent.length, "MISSING_CHAR", "Block scalars with more-indented leading empty lines must use an explicit indentation indicator");
				if (header.indent === 0) trimIndent = indent.length;
				contentStart = i;
				if (trimIndent === 0 && !ctx.atRoot) onError(offset, "BAD_INDENT", "Block scalar values in collections must be indented");
				break;
			}
			offset += indent.length + content.length + 1;
		}
		for (let i = lines.length - 1; i >= chompStart; --i) if (lines[i][0].length > trimIndent) chompStart = i + 1;
		let value = "";
		let sep = "";
		let prevMoreIndented = false;
		for (let i = 0; i < contentStart; ++i) value += lines[i][0].slice(trimIndent) + "\n";
		for (let i = contentStart; i < chompStart; ++i) {
			let [indent, content] = lines[i];
			offset += indent.length + content.length + 1;
			const crlf = content[content.length - 1] === "\r";
			if (crlf) content = content.slice(0, -1);
			/* istanbul ignore if already caught in lexer */
			if (content && indent.length < trimIndent) {
				const message = `Block scalar lines must not be less indented than their ${header.indent ? "explicit indentation indicator" : "first line"}`;
				onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
				indent = "";
			}
			if (type === Scalar.Scalar.BLOCK_LITERAL) {
				value += sep + indent.slice(trimIndent) + content;
				sep = "\n";
			} else if (indent.length > trimIndent || content[0] === "	") {
				if (sep === " ") sep = "\n";
				else if (!prevMoreIndented && sep === "\n") sep = "\n\n";
				value += sep + indent.slice(trimIndent) + content;
				sep = "\n";
				prevMoreIndented = true;
			} else if (content === "") {
				if (sep === "\n") value += "\n";
				else sep = "\n";
			} else {
				value += sep + content;
				sep = " ";
				prevMoreIndented = false;
			}
		}
		switch (header.chomp) {
			case "-": break;
			case "+":
				for (let i = chompStart; i < lines.length; ++i) value += "\n" + lines[i][0].slice(trimIndent);
				if (value[value.length - 1] !== "\n") value += "\n";
				break;
			default: value += "\n";
		}
		const end = start + header.length + scalar.source.length;
		return {
			value,
			type,
			comment: header.comment,
			range: [
				start,
				end,
				end
			]
		};
	}
	function parseBlockScalarHeader({ offset, props }, strict, onError) {
		/* istanbul ignore if should not happen */
		if (props[0].type !== "block-scalar-header") {
			onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
			return null;
		}
		const { source } = props[0];
		const mode = source[0];
		let indent = 0;
		let chomp = "";
		let error = -1;
		for (let i = 1; i < source.length; ++i) {
			const ch = source[i];
			if (!chomp && (ch === "-" || ch === "+")) chomp = ch;
			else {
				const n = Number(ch);
				if (!indent && n) indent = n;
				else if (error === -1) error = offset + i;
			}
		}
		if (error !== -1) onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
		let hasSpace = false;
		let comment = "";
		let length = source.length;
		for (let i = 1; i < props.length; ++i) {
			const token = props[i];
			switch (token.type) {
				case "space": hasSpace = true;
				case "newline":
					length += token.source.length;
					break;
				case "comment":
					if (strict && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
					length += token.source.length;
					comment = token.source.substring(1);
					break;
				case "error":
					onError(token, "UNEXPECTED_TOKEN", token.message);
					length += token.source.length;
					break;
				/* istanbul ignore next should not happen */
				default: {
					onError(token, "UNEXPECTED_TOKEN", `Unexpected token in block scalar header: ${token.type}`);
					const ts = token.source;
					if (ts && typeof ts === "string") length += ts.length;
				}
			}
		}
		return {
			mode,
			indent,
			chomp,
			comment,
			length
		};
	}
	/** @returns Array of lines split up as `[indent, content]` */
	function splitLines(source) {
		const split = source.split(/\n( *)/);
		const first = split[0];
		const m = first.match(/^( *)/);
		const lines = [m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first]];
		for (let i = 1; i < split.length; i += 2) lines.push([split[i], split[i + 1]]);
		return lines;
	}
	exports.resolveBlockScalar = resolveBlockScalar;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Scalar = require_Scalar();
	var resolveEnd = require_resolve_end();
	function resolveFlowScalar(scalar, strict, onError) {
		const { offset, type, source, end } = scalar;
		let _type;
		let value;
		const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
		switch (type) {
			case "scalar":
				_type = Scalar.Scalar.PLAIN;
				value = plainValue(source, _onError);
				break;
			case "single-quoted-scalar":
				_type = Scalar.Scalar.QUOTE_SINGLE;
				value = singleQuotedValue(source, _onError);
				break;
			case "double-quoted-scalar":
				_type = Scalar.Scalar.QUOTE_DOUBLE;
				value = doubleQuotedValue(source, _onError);
				break;
			/* istanbul ignore next should not happen */
			default:
				onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
				return {
					value: "",
					type: null,
					comment: "",
					range: [
						offset,
						offset + source.length,
						offset + source.length
					]
				};
		}
		const valueEnd = offset + source.length;
		const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
		return {
			value,
			type: _type,
			comment: re.comment,
			range: [
				offset,
				valueEnd,
				re.offset
			]
		};
	}
	function plainValue(source, onError) {
		let badChar = "";
		switch (source[0]) {
			/* istanbul ignore next should not happen */
			case "	":
				badChar = "a tab character";
				break;
			case ",":
				badChar = "flow indicator character ,";
				break;
			case "%":
				badChar = "directive indicator character %";
				break;
			case "|":
			case ">":
				badChar = `block scalar indicator ${source[0]}`;
				break;
			case "@":
			case "`": badChar = `reserved character ${source[0]}`;
		}
		if (badChar) onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
		return unfoldLines(source);
	}
	function singleQuotedValue(source, onError) {
		if (source[source.length - 1] !== "'" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
		return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
	}
	function unfoldLines(source) {
		const line = /(.*?)\r?\n/sy;
		let match = line.exec(source);
		if (!match) return source;
		/**
		* The negative lookbehinds in these RegExps are to
		* prevent causing a polynomial search time in certain cases.
		*
		* The try-catch is for Safari < 16.4 and other old browsers:
		* https://caniuse.com/js-regexp-lookbehind
		*/
		let trimEnd, trimBoth;
		try {
			trimEnd = /* @__PURE__ */ new RegExp("(?<![ 	])[ 	]+$");
			trimBoth = /* @__PURE__ */ new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
		} catch {
			trimEnd = /[ \t]+$/;
			trimBoth = /^[ \t]+|[ \t]+$/g;
		}
		let res = match[1].replace(trimEnd, "");
		let sep = " ";
		let pos = line.lastIndex;
		while (match = line.exec(source)) {
			const lm = match[1].replace(trimBoth, "");
			if (lm === "") {
				if (sep === "\n") res += sep;
				else sep = "\n";
			} else {
				res += sep + lm;
				sep = " ";
			}
			pos = line.lastIndex;
		}
		const last = /[ \t]*(.*)/sy;
		last.lastIndex = pos;
		match = last.exec(source);
		return res + sep + (match?.[1] ?? "");
	}
	function doubleQuotedValue(source, onError) {
		let res = "";
		for (let i = 1; i < source.length - 1; ++i) {
			const ch = source[i];
			if (ch === "\r" && source[i + 1] === "\n") continue;
			if (ch === "\n") {
				const { fold, offset } = foldNewline(source, i);
				res += fold;
				i = offset;
			} else if (ch === "\\") {
				let next = source[++i];
				const cc = escapeCodes[next];
				if (cc) res += cc;
				else if (next === "\n") {
					next = source[i + 1];
					while (next === " " || next === "	") next = source[++i + 1];
				} else if (next === "\r" && source[i + 1] === "\n") {
					next = source[++i + 1];
					while (next === " " || next === "	") next = source[++i + 1];
				} else if (next === "x" || next === "u" || next === "U") {
					const length = next === "x" ? 2 : next === "u" ? 4 : 8;
					res += parseCharCode(source, i + 1, length, onError);
					i += length;
				} else {
					const raw = source.substr(i - 1, 2);
					onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
					res += raw;
				}
			} else if (ch === " " || ch === "	") {
				const wsStart = i;
				let next = source[i + 1];
				while (next === " " || next === "	") next = source[++i + 1];
				if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n")) res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
			} else res += ch;
		}
		if (source[source.length - 1] !== "\"" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing \"quote");
		return res;
	}
	/**
	* Fold a single newline into a space, multiple newlines to N - 1 newlines.
	* Presumes `source[offset] === '\n'`
	*/
	function foldNewline(source, offset) {
		let fold = "";
		let ch = source[offset + 1];
		while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
			if (ch === "\r" && source[offset + 2] !== "\n") break;
			if (ch === "\n") fold += "\n";
			offset += 1;
			ch = source[offset + 1];
		}
		if (!fold) fold = " ";
		return {
			fold,
			offset
		};
	}
	const escapeCodes = {
		"0": "\0",
		a: "\x07",
		b: "\b",
		e: "\x1B",
		f: "\f",
		n: "\n",
		r: "\r",
		t: "	",
		v: "\v",
		N: "",
		_: "\xA0",
		L: "\u2028",
		P: "\u2029",
		" ": " ",
		"\"": "\"",
		"/": "/",
		"\\": "\\",
		"	": "	"
	};
	function parseCharCode(source, offset, length, onError) {
		const cc = source.substr(offset, length);
		const code = cc.length === length && /^[0-9a-fA-F]+$/.test(cc) ? parseInt(cc, 16) : NaN;
		try {
			return String.fromCodePoint(code);
		} catch {
			const raw = source.substr(offset - 2, length + 2);
			onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
			return raw;
		}
	}
	exports.resolveFlowScalar = resolveFlowScalar;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var identity = require_identity();
	var Scalar = require_Scalar();
	var resolveBlockScalar = require_resolve_block_scalar();
	var resolveFlowScalar = require_resolve_flow_scalar();
	function composeScalar(ctx, token, tagToken, onError) {
		const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
		const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
		let tag;
		if (ctx.options.stringKeys && ctx.atKey) tag = ctx.schema[identity.SCALAR];
		else if (tagName) tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
		else if (token.type === "scalar") tag = findScalarTagByTest(ctx, value, token, onError);
		else tag = ctx.schema[identity.SCALAR];
		let scalar;
		try {
			const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
			scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
			scalar = new Scalar.Scalar(value);
		}
		scalar.range = range;
		scalar.source = value;
		if (type) scalar.type = type;
		if (tagName) scalar.tag = tagName;
		if (tag.format) scalar.format = tag.format;
		if (comment) scalar.comment = comment;
		return scalar;
	}
	function findScalarTagByName(schema, value, tagName, tagToken, onError) {
		if (tagName === "!") return schema[identity.SCALAR];
		const matchWithTest = [];
		for (const tag of schema.tags) if (!tag.collection && tag.tag === tagName) {
			if (tag.default && tag.test) matchWithTest.push(tag);
			else return tag;
		}
		for (const tag of matchWithTest) if (tag.test?.test(value)) return tag;
		const kt = schema.knownTags[tagName];
		if (kt && !kt.collection) {
			schema.tags.push(Object.assign({}, kt, {
				default: false,
				test: void 0
			}));
			return kt;
		}
		onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
		return schema[identity.SCALAR];
	}
	function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
		const tag = schema.tags.find((tag) => (tag.default === true || atKey && tag.default === "key") && tag.test?.test(value)) || schema[identity.SCALAR];
		if (schema.compat) {
			const compat = schema.compat.find((tag) => tag.default && tag.test?.test(value)) ?? schema[identity.SCALAR];
			if (tag.tag !== compat.tag) onError(token, "TAG_RESOLVE_FAILED", `Value may be parsed as either ${directives.tagString(tag.tag)} or ${directives.tagString(compat.tag)}`, true);
		}
		return tag;
	}
	exports.composeScalar = composeScalar;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = /* @__PURE__ */ __commonJSMin(((exports) => {
	function emptyScalarPosition(offset, before, pos) {
		if (before) {
			pos ?? (pos = before.length);
			for (let i = pos - 1; i >= 0; --i) {
				let st = before[i];
				switch (st.type) {
					case "space":
					case "comment":
					case "newline":
						offset -= st.source.length;
						continue;
				}
				st = before[++i];
				while (st?.type === "space") {
					offset += st.source.length;
					st = before[++i];
				}
				break;
			}
		}
		return offset;
	}
	exports.emptyScalarPosition = emptyScalarPosition;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Alias = require_Alias();
	var identity = require_identity();
	var composeCollection = require_compose_collection();
	var composeScalar = require_compose_scalar();
	var resolveEnd = require_resolve_end();
	var utilEmptyScalarPosition = require_util_empty_scalar_position();
	const CN = {
		composeNode,
		composeEmptyNode
	};
	function composeNode(ctx, token, props, onError) {
		const atKey = ctx.atKey;
		const { spaceBefore, comment, anchor, tag } = props;
		let node;
		let isSrcToken = true;
		switch (token.type) {
			case "alias":
				node = composeAlias(ctx, token, onError);
				if (anchor || tag) onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
				break;
			case "scalar":
			case "single-quoted-scalar":
			case "double-quoted-scalar":
			case "block-scalar":
				node = composeScalar.composeScalar(ctx, token, tag, onError);
				if (anchor) node.anchor = anchor.source.substring(1);
				break;
			case "block-map":
			case "block-seq":
			case "flow-collection":
				try {
					node = composeCollection.composeCollection(CN, ctx, token, props, onError);
					if (anchor) node.anchor = anchor.source.substring(1);
				} catch (error) {
					onError(token, "RESOURCE_EXHAUSTION", error instanceof Error ? error.message : String(error));
				}
				break;
			default:
				onError(token, "UNEXPECTED_TOKEN", token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`);
				isSrcToken = false;
		}
		node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
		if (anchor && node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
		if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) onError(tag ?? token, "NON_STRING_KEY", "With stringKeys, all keys must be strings");
		if (spaceBefore) node.spaceBefore = true;
		if (comment) {
			if (token.type === "scalar" && token.source === "") node.comment = comment;
			else node.commentBefore = comment;
		}
		if (ctx.options.keepSourceTokens && isSrcToken) node.srcToken = token;
		return node;
	}
	function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
		const token = {
			type: "scalar",
			offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
			indent: -1,
			source: ""
		};
		const node = composeScalar.composeScalar(ctx, token, tag, onError);
		if (anchor) {
			node.anchor = anchor.source.substring(1);
			if (node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
		}
		if (spaceBefore) node.spaceBefore = true;
		if (comment) {
			node.comment = comment;
			node.range[2] = end;
		}
		return node;
	}
	function composeAlias({ options }, { offset, source, end }, onError) {
		const alias = new Alias.Alias(source.substring(1));
		if (alias.source === "") onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
		if (alias.source.endsWith(":")) onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
		const valueEnd = offset + source.length;
		const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
		alias.range = [
			offset,
			valueEnd,
			re.offset
		];
		if (re.comment) alias.comment = re.comment;
		return alias;
	}
	exports.composeEmptyNode = composeEmptyNode;
	exports.composeNode = composeNode;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = /* @__PURE__ */ __commonJSMin(((exports) => {
	var Document = require_Document();
	var composeNode = require_compose_node();
	var resolveEnd = require_resolve_end();
	var resolveProps = require_resolve_props();
	function composeDoc(options, directives, { offset, start, value, end }, onError) {
		const opts = Object.assign({ _directives: directives }, options);
		const doc = new Document.Document(void 0, opts);
		const ctx = {
			atKey: false,
			atRoot: true,
			directives: doc.directives,
			options: doc.options,
			schema: doc.schema
		};
		const props = resolveProps.resolveProps(start, {
			indicator: "doc-start",
			next: value ?? end?.[0],
			offset,
			onError,
			parentIndent: 0,
			startOnNewline: true
		});
		if (props.found) {
			doc.directives.docStart = true;
			if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline) onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
		}
		doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
		const contentEnd = doc.contents.range[2];
		const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
		if (re.comment) doc.comment = re.comment;
		doc.range = [
			offset,
			contentEnd,
			re.offset
		];
		return doc;
	}
	exports.composeDoc = composeDoc;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/composer.js
var require_composer = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_process = __require("process");
	var directives = require_directives();
	var Document = require_Document();
	var errors = require_errors();
	var identity = require_identity();
	var composeDoc = require_compose_doc();
	var resolveEnd = require_resolve_end();
	function getErrorPos(src) {
		if (typeof src === "number") return [src, src + 1];
		if (Array.isArray(src)) return src.length === 2 ? src : [src[0], src[1]];
		const { offset, source } = src;
		return [offset, offset + (typeof source === "string" ? source.length : 1)];
	}
	function parsePrelude(prelude) {
		let comment = "";
		let atComment = false;
		let afterEmptyLine = false;
		for (let i = 0; i < prelude.length; ++i) {
			const source = prelude[i];
			switch (source[0]) {
				case "#":
					comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
					atComment = true;
					afterEmptyLine = false;
					break;
				case "%":
					if (prelude[i + 1]?.[0] !== "#") i += 1;
					atComment = false;
					break;
				default:
					if (!atComment) afterEmptyLine = true;
					atComment = false;
			}
		}
		return {
			comment,
			afterEmptyLine
		};
	}
	/**
	* Compose a stream of CST nodes into a stream of YAML Documents.
	*
	* ```ts
	* import { Composer, Parser } from 'yaml'
	*
	* const src: string = ...
	* const tokens = new Parser().parse(src)
	* const docs = new Composer().compose(tokens)
	* ```
	*/
	var Composer = class {
		constructor(options = {}) {
			this.doc = null;
			this.atDirectives = false;
			this.prelude = [];
			this.errors = [];
			this.warnings = [];
			this.onError = (source, code, message, warning) => {
				const pos = getErrorPos(source);
				if (warning) this.warnings.push(new errors.YAMLWarning(pos, code, message));
				else this.errors.push(new errors.YAMLParseError(pos, code, message));
			};
			this.directives = new directives.Directives({ version: options.version || "1.2" });
			this.options = options;
		}
		decorate(doc, afterDoc) {
			const { comment, afterEmptyLine } = parsePrelude(this.prelude);
			if (comment) {
				const dc = doc.contents;
				if (afterDoc) doc.comment = doc.comment ? `${doc.comment}\n${comment}` : comment;
				else if (afterEmptyLine || doc.directives.docStart || !dc) doc.commentBefore = comment;
				else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
					let it = dc.items[0];
					if (identity.isPair(it)) it = it.key;
					const cb = it.commentBefore;
					it.commentBefore = cb ? `${comment}\n${cb}` : comment;
				} else {
					const cb = dc.commentBefore;
					dc.commentBefore = cb ? `${comment}\n${cb}` : comment;
				}
			}
			if (afterDoc) {
				for (let i = 0; i < this.errors.length; ++i) doc.errors.push(this.errors[i]);
				for (let i = 0; i < this.warnings.length; ++i) doc.warnings.push(this.warnings[i]);
			} else {
				doc.errors = this.errors;
				doc.warnings = this.warnings;
			}
			this.prelude = [];
			this.errors = [];
			this.warnings = [];
		}
		/**
		* Current stream status information.
		*
		* Mostly useful at the end of input for an empty stream.
		*/
		streamInfo() {
			return {
				comment: parsePrelude(this.prelude).comment,
				directives: this.directives,
				errors: this.errors,
				warnings: this.warnings
			};
		}
		/**
		* Compose tokens into documents.
		*
		* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
		* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
		*/
		*compose(tokens, forceDoc = false, endOffset = -1) {
			for (const token of tokens) yield* this.next(token);
			yield* this.end(forceDoc, endOffset);
		}
		/** Advance the composer by one CST token. */
		*next(token) {
			if (node_process.env.LOG_STREAM) console.dir(token, { depth: null });
			switch (token.type) {
				case "directive":
					this.directives.add(token.source, (offset, message, warning) => {
						const pos = getErrorPos(token);
						pos[0] += offset;
						this.onError(pos, "BAD_DIRECTIVE", message, warning);
					});
					this.prelude.push(token.source);
					this.atDirectives = true;
					break;
				case "document": {
					const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
					if (this.atDirectives && !doc.directives.docStart) this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
					this.decorate(doc, false);
					if (this.doc) yield this.doc;
					this.doc = doc;
					this.atDirectives = false;
					break;
				}
				case "byte-order-mark":
				case "space": break;
				case "comment":
				case "newline":
					this.prelude.push(token.source);
					break;
				case "error": {
					const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
					const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
					if (this.atDirectives || !this.doc) this.errors.push(error);
					else this.doc.errors.push(error);
					break;
				}
				case "doc-end": {
					if (!this.doc) {
						this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", "Unexpected doc-end without preceding document"));
						break;
					}
					this.doc.directives.docEnd = true;
					const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
					this.decorate(this.doc, true);
					if (end.comment) {
						const dc = this.doc.comment;
						this.doc.comment = dc ? `${dc}\n${end.comment}` : end.comment;
					}
					this.doc.range[2] = end.offset;
					break;
				}
				default: this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
			}
		}
		/**
		* Call at end of input to yield any remaining document.
		*
		* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
		* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
		*/
		*end(forceDoc = false, endOffset = -1) {
			if (this.doc) {
				this.decorate(this.doc, true);
				yield this.doc;
				this.doc = null;
			} else if (forceDoc) {
				const opts = Object.assign({ _directives: this.directives }, this.options);
				const doc = new Document.Document(void 0, opts);
				if (this.atDirectives) this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
				doc.range = [
					0,
					endOffset,
					endOffset
				];
				this.decorate(doc, false);
				yield doc;
			}
		}
	};
	exports.Composer = Composer;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = /* @__PURE__ */ __commonJSMin(((exports) => {
	var resolveBlockScalar = require_resolve_block_scalar();
	var resolveFlowScalar = require_resolve_flow_scalar();
	var errors = require_errors();
	var stringifyString = require_stringifyString();
	function resolveAsScalar(token, strict = true, onError) {
		if (token) {
			const _onError = (pos, code, message) => {
				const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
				if (onError) onError(offset, code, message);
				else throw new errors.YAMLParseError([offset, offset + 1], code, message);
			};
			switch (token.type) {
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
				case "block-scalar": return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
			}
		}
		return null;
	}
	/**
	* Create a new scalar token with `value`
	*
	* Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
	* as this function does not support any schema operations and won't check for such conflicts.
	*
	* @param value The string representation of the value, which will have its content properly indented.
	* @param context.end Comments and whitespace after the end of the value, or after the block scalar header. If undefined, a newline will be added.
	* @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
	* @param context.indent The indent level of the token.
	* @param context.inFlow Is this scalar within a flow collection? This may affect the resolved type of the token's value.
	* @param context.offset The offset position of the token.
	* @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
	*/
	function createScalarToken(value, context) {
		const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
		const source = stringifyString.stringifyString({
			type,
			value
		}, {
			implicitKey,
			indent: indent > 0 ? " ".repeat(indent) : "",
			inFlow,
			options: {
				blockQuote: true,
				lineWidth: -1
			}
		});
		const end = context.end ?? [{
			type: "newline",
			offset: -1,
			indent,
			source: "\n"
		}];
		switch (source[0]) {
			case "|":
			case ">": {
				const he = source.indexOf("\n");
				const head = source.substring(0, he);
				const body = source.substring(he + 1) + "\n";
				const props = [{
					type: "block-scalar-header",
					offset,
					indent,
					source: head
				}];
				if (!addEndtoBlockProps(props, end)) props.push({
					type: "newline",
					offset: -1,
					indent,
					source: "\n"
				});
				return {
					type: "block-scalar",
					offset,
					indent,
					props,
					source: body
				};
			}
			case "\"": return {
				type: "double-quoted-scalar",
				offset,
				indent,
				source,
				end
			};
			case "'": return {
				type: "single-quoted-scalar",
				offset,
				indent,
				source,
				end
			};
			default: return {
				type: "scalar",
				offset,
				indent,
				source,
				end
			};
		}
	}
	/**
	* Set the value of `token` to the given string `value`, overwriting any previous contents and type that it may have.
	*
	* Best efforts are made to retain any comments previously associated with the `token`,
	* though all contents within a collection's `items` will be overwritten.
	*
	* Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
	* as this function does not support any schema operations and won't check for such conflicts.
	*
	* @param token Any token. If it does not include an `indent` value, the value will be stringified as if it were an implicit key.
	* @param value The string representation of the value, which will have its content properly indented.
	* @param context.afterKey In most cases, values after a key should have an additional level of indentation.
	* @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
	* @param context.inFlow Being within a flow collection may affect the resolved type of the token's value.
	* @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
	*/
	function setScalarValue(token, value, context = {}) {
		let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
		let indent = "indent" in token ? token.indent : null;
		if (afterKey && typeof indent === "number") indent += 2;
		if (!type) switch (token.type) {
			case "single-quoted-scalar":
				type = "QUOTE_SINGLE";
				break;
			case "double-quoted-scalar":
				type = "QUOTE_DOUBLE";
				break;
			case "block-scalar": {
				const header = token.props[0];
				if (header.type !== "block-scalar-header") throw new Error("Invalid block scalar header");
				type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
				break;
			}
			default: type = "PLAIN";
		}
		const source = stringifyString.stringifyString({
			type,
			value
		}, {
			implicitKey: implicitKey || indent === null,
			indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
			inFlow,
			options: {
				blockQuote: true,
				lineWidth: -1
			}
		});
		switch (source[0]) {
			case "|":
			case ">":
				setBlockScalarValue(token, source);
				break;
			case "\"":
				setFlowScalarValue(token, source, "double-quoted-scalar");
				break;
			case "'":
				setFlowScalarValue(token, source, "single-quoted-scalar");
				break;
			default: setFlowScalarValue(token, source, "scalar");
		}
	}
	function setBlockScalarValue(token, source) {
		const he = source.indexOf("\n");
		const head = source.substring(0, he);
		const body = source.substring(he + 1) + "\n";
		if (token.type === "block-scalar") {
			const header = token.props[0];
			if (header.type !== "block-scalar-header") throw new Error("Invalid block scalar header");
			header.source = head;
			token.source = body;
		} else {
			const { offset } = token;
			const indent = "indent" in token ? token.indent : -1;
			const props = [{
				type: "block-scalar-header",
				offset,
				indent,
				source: head
			}];
			if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0)) props.push({
				type: "newline",
				offset: -1,
				indent,
				source: "\n"
			});
			for (const key of Object.keys(token)) if (key !== "type" && key !== "offset") delete token[key];
			Object.assign(token, {
				type: "block-scalar",
				indent,
				props,
				source: body
			});
		}
	}
	/** @returns `true` if last token is a newline */
	function addEndtoBlockProps(props, end) {
		if (end) for (const st of end) switch (st.type) {
			case "space":
			case "comment":
				props.push(st);
				break;
			case "newline":
				props.push(st);
				return true;
		}
		return false;
	}
	function setFlowScalarValue(token, source, type) {
		switch (token.type) {
			case "scalar":
			case "double-quoted-scalar":
			case "single-quoted-scalar":
				token.type = type;
				token.source = source;
				break;
			case "block-scalar": {
				const end = token.props.slice(1);
				let oa = source.length;
				if (token.props[0].type === "block-scalar-header") oa -= token.props[0].source.length;
				for (const tok of end) tok.offset += oa;
				delete token.props;
				Object.assign(token, {
					type,
					source,
					end
				});
				break;
			}
			case "block-map":
			case "block-seq": {
				const nl = {
					type: "newline",
					offset: token.offset + source.length,
					indent: token.indent,
					source: "\n"
				};
				delete token.items;
				Object.assign(token, {
					type,
					source,
					end: [nl]
				});
				break;
			}
			default: {
				const indent = "indent" in token ? token.indent : -1;
				const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
				for (const key of Object.keys(token)) if (key !== "type" && key !== "offset") delete token[key];
				Object.assign(token, {
					type,
					indent,
					source,
					end
				});
			}
		}
	}
	exports.createScalarToken = createScalarToken;
	exports.resolveAsScalar = resolveAsScalar;
	exports.setScalarValue = setScalarValue;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Stringify a CST document, token, or collection item
	*
	* Fair warning: This applies no validation whatsoever, and
	* simply concatenates the sources in their logical order.
	*/
	const stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
	function stringifyToken(token) {
		switch (token.type) {
			case "block-scalar": {
				let res = "";
				for (const tok of token.props) res += stringifyToken(tok);
				return res + token.source;
			}
			case "block-map":
			case "block-seq": {
				let res = "";
				for (const item of token.items) res += stringifyItem(item);
				return res;
			}
			case "flow-collection": {
				let res = token.start.source;
				for (const item of token.items) res += stringifyItem(item);
				for (const st of token.end) res += st.source;
				return res;
			}
			case "document": {
				let res = stringifyItem(token);
				if (token.end) for (const st of token.end) res += st.source;
				return res;
			}
			default: {
				let res = token.source;
				if ("end" in token && token.end) for (const st of token.end) res += st.source;
				return res;
			}
		}
	}
	function stringifyItem({ start, key, sep, value }) {
		let res = "";
		for (const st of start) res += st.source;
		if (key) res += stringifyToken(key);
		if (sep) for (const st of sep) res += st.source;
		if (value) res += stringifyToken(value);
		return res;
	}
	exports.stringify = stringify;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = /* @__PURE__ */ __commonJSMin(((exports) => {
	const BREAK = Symbol("break visit");
	const SKIP = Symbol("skip children");
	const REMOVE = Symbol("remove item");
	/**
	* Apply a visitor to a CST document or item.
	*
	* Walks through the tree (depth-first) starting from the root, calling a
	* `visitor` function with two arguments when entering each item:
	*   - `item`: The current item, which included the following members:
	*     - `start: SourceToken[]` – Source tokens before the key or value,
	*       possibly including its anchor or tag.
	*     - `key?: Token | null` – Set for pair values. May then be `null`, if
	*       the key before the `:` separator is empty.
	*     - `sep?: SourceToken[]` – Source tokens between the key and the value,
	*       which should include the `:` map value indicator if `value` is set.
	*     - `value?: Token` – The value of a sequence item, or of a map pair.
	*   - `path`: The steps from the root to the current node, as an array of
	*     `['key' | 'value', number]` tuples.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this token, continue with
	*      next sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current item, then continue with the next one
	*   - `number`: Set the index of the next step. This is useful especially if
	*     the index of the current token has changed.
	*   - `function`: Define the next visitor for this item. After the original
	*     visitor is called on item entry, next visitors are called after handling
	*     a non-empty `key` and when exiting the item.
	*/
	function visit(cst, visitor) {
		if ("type" in cst && cst.type === "document") cst = {
			start: cst.start,
			value: cst.value
		};
		_visit(Object.freeze([]), cst, visitor);
	}
	/** Terminate visit traversal completely */
	visit.BREAK = BREAK;
	/** Do not visit the children of the current item */
	visit.SKIP = SKIP;
	/** Remove the current item */
	visit.REMOVE = REMOVE;
	/** Find the item at `path` from `cst` as the root */
	visit.itemAtPath = (cst, path) => {
		let item = cst;
		for (const [field, index] of path) {
			const tok = item?.[field];
			if (tok && "items" in tok) item = tok.items[index];
			else return void 0;
		}
		return item;
	};
	/**
	* Get the immediate parent collection of the item at `path` from `cst` as the root.
	*
	* Throws an error if the collection is not found, which should never happen if the item itself exists.
	*/
	visit.parentCollection = (cst, path) => {
		const parent = visit.itemAtPath(cst, path.slice(0, -1));
		const field = path[path.length - 1][0];
		const coll = parent?.[field];
		if (coll && "items" in coll) return coll;
		throw new Error("Parent collection not found");
	};
	function _visit(path, item, visitor) {
		let ctrl = visitor(item, path);
		if (typeof ctrl === "symbol") return ctrl;
		for (const field of ["key", "value"]) {
			const token = item[field];
			if (token && "items" in token) {
				for (let i = 0; i < token.items.length; ++i) {
					const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK) return BREAK;
					else if (ci === REMOVE) {
						token.items.splice(i, 1);
						i -= 1;
					}
				}
				if (typeof ctrl === "function" && field === "key") ctrl = ctrl(item, path);
			}
		}
		return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
	}
	exports.visit = visit;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst.js
var require_cst = /* @__PURE__ */ __commonJSMin(((exports) => {
	var cstScalar = require_cst_scalar();
	var cstStringify = require_cst_stringify();
	var cstVisit = require_cst_visit();
	/** The byte order mark */
	const BOM = "﻿";
	/** Start of doc-mode */
	const DOCUMENT = "";
	/** Unexpected end of flow-mode */
	const FLOW_END = "";
	/** Next token is a scalar value */
	const SCALAR = "";
	/** @returns `true` if `token` is a flow or block collection */
	const isCollection = (token) => !!token && "items" in token;
	/** @returns `true` if `token` is a flow or block scalar; not an alias */
	const isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
	/* istanbul ignore next */
	/** Get a printable representation of a lexer token */
	function prettyToken(token) {
		switch (token) {
			case BOM: return "<BOM>";
			case DOCUMENT: return "<DOC>";
			case FLOW_END: return "<FLOW_END>";
			case SCALAR: return "<SCALAR>";
			default: return JSON.stringify(token);
		}
	}
	/** Identify the type of a lexer token. May return `null` for unknown tokens. */
	function tokenType(source) {
		switch (source) {
			case BOM: return "byte-order-mark";
			case DOCUMENT: return "doc-mode";
			case FLOW_END: return "flow-error-end";
			case SCALAR: return "scalar";
			case "---": return "doc-start";
			case "...": return "doc-end";
			case "":
			case "\n":
			case "\r\n": return "newline";
			case "-": return "seq-item-ind";
			case "?": return "explicit-key-ind";
			case ":": return "map-value-ind";
			case "{": return "flow-map-start";
			case "}": return "flow-map-end";
			case "[": return "flow-seq-start";
			case "]": return "flow-seq-end";
			case ",": return "comma";
		}
		switch (source[0]) {
			case " ":
			case "	": return "space";
			case "#": return "comment";
			case "%": return "directive-line";
			case "*": return "alias";
			case "&": return "anchor";
			case "!": return "tag";
			case "'": return "single-quoted-scalar";
			case "\"": return "double-quoted-scalar";
			case "|":
			case ">": return "block-scalar-header";
		}
		return null;
	}
	exports.createScalarToken = cstScalar.createScalarToken;
	exports.resolveAsScalar = cstScalar.resolveAsScalar;
	exports.setScalarValue = cstScalar.setScalarValue;
	exports.stringify = cstStringify.stringify;
	exports.visit = cstVisit.visit;
	exports.BOM = BOM;
	exports.DOCUMENT = DOCUMENT;
	exports.FLOW_END = FLOW_END;
	exports.SCALAR = SCALAR;
	exports.isCollection = isCollection;
	exports.isScalar = isScalar;
	exports.prettyToken = prettyToken;
	exports.tokenType = tokenType;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/lexer.js
var require_lexer = /* @__PURE__ */ __commonJSMin(((exports) => {
	var cst = require_cst();
	function isEmpty(ch) {
		switch (ch) {
			case void 0:
			case " ":
			case "\n":
			case "\r":
			case "	": return true;
			default: return false;
		}
	}
	const hexDigits = /* @__PURE__ */ new Set("0123456789ABCDEFabcdef");
	const tagChars = /* @__PURE__ */ new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
	const flowIndicatorChars = /* @__PURE__ */ new Set(",[]{}");
	const invalidAnchorChars = /* @__PURE__ */ new Set(" ,[]{}\n\r	");
	const isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
	/**
	* Splits an input string into lexical tokens, i.e. smaller strings that are
	* easily identifiable by `tokens.tokenType()`.
	*
	* Lexing starts always in a "stream" context. Incomplete input may be buffered
	* until a complete token can be emitted.
	*
	* In addition to slices of the original input, the following control characters
	* may also be emitted:
	*
	* - `\x02` (Start of Text): A document starts with the next token
	* - `\x18` (Cancel): Unexpected end of flow-mode (indicates an error)
	* - `\x1f` (Unit Separator): Next token is a scalar value
	* - `\u{FEFF}` (Byte order mark): Emitted separately outside documents
	*/
	var Lexer = class {
		constructor() {
			/**
			* Flag indicating whether the end of the current buffer marks the end of
			* all input
			*/
			this.atEnd = false;
			/**
			* Explicit indent set in block scalar header, as an offset from the current
			* minimum indent, so e.g. set to 1 from a header `|2+`. Set to -1 if not
			* explicitly set.
			*/
			this.blockScalarIndent = -1;
			/**
			* Block scalars that include a + (keep) chomping indicator in their header
			* include trailing empty lines, which are otherwise excluded from the
			* scalar's contents.
			*/
			this.blockScalarKeep = false;
			/** Current input */
			this.buffer = "";
			/**
			* Flag noting whether the map value indicator : can immediately follow this
			* node within a flow context.
			*/
			this.flowKey = false;
			/** Count of surrounding flow collection levels. */
			this.flowLevel = 0;
			/**
			* Minimum level of indentation required for next lines to be parsed as a
			* part of the current scalar value.
			*/
			this.indentNext = 0;
			/** Indentation level of the current line. */
			this.indentValue = 0;
			/** Position of the next \n character. */
			this.lineEndPos = null;
			/** Stores the state of the lexer if reaching the end of incpomplete input */
			this.next = null;
			/** A pointer to `buffer`; the current position of the lexer. */
			this.pos = 0;
		}
		/**
		* Generate YAML tokens from the `source` string. If `incomplete`,
		* a part of the last line may be left as a buffer for the next call.
		*
		* @returns A generator of lexical tokens
		*/
		*lex(source, incomplete = false) {
			if (source) {
				if (typeof source !== "string") throw TypeError("source is not a string");
				this.buffer = this.buffer ? this.buffer + source : source;
				this.lineEndPos = null;
			}
			this.atEnd = !incomplete;
			let next = this.next ?? "stream";
			while (next && (incomplete || this.hasChars(1))) next = yield* this.parseNext(next);
		}
		atLineEnd() {
			let i = this.pos;
			let ch = this.buffer[i];
			while (ch === " " || ch === "	") ch = this.buffer[++i];
			if (!ch || ch === "#" || ch === "\n") return true;
			if (ch === "\r") return this.buffer[i + 1] === "\n";
			return false;
		}
		charAt(n) {
			return this.buffer[this.pos + n];
		}
		continueScalar(offset) {
			let ch = this.buffer[offset];
			if (this.indentNext > 0) {
				let indent = 0;
				while (ch === " ") ch = this.buffer[++indent + offset];
				if (ch === "\r") {
					const next = this.buffer[indent + offset + 1];
					if (next === "\n" || !next && !this.atEnd) return offset + indent + 1;
				}
				return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
			}
			if (ch === "-" || ch === ".") {
				const dt = this.buffer.substr(offset, 3);
				if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3])) return -1;
			}
			return offset;
		}
		getLine() {
			let end = this.lineEndPos;
			if (typeof end !== "number" || end !== -1 && end < this.pos) {
				end = this.buffer.indexOf("\n", this.pos);
				this.lineEndPos = end;
			}
			if (end === -1) return this.atEnd ? this.buffer.substring(this.pos) : null;
			if (this.buffer[end - 1] === "\r") end -= 1;
			return this.buffer.substring(this.pos, end);
		}
		hasChars(n) {
			return this.pos + n <= this.buffer.length;
		}
		setNext(state) {
			this.buffer = this.buffer.substring(this.pos);
			this.pos = 0;
			this.lineEndPos = null;
			this.next = state;
			return null;
		}
		peek(n) {
			return this.buffer.substr(this.pos, n);
		}
		*parseNext(next) {
			switch (next) {
				case "stream": return yield* this.parseStream();
				case "line-start": return yield* this.parseLineStart();
				case "block-start": return yield* this.parseBlockStart();
				case "doc": return yield* this.parseDocument();
				case "flow": return yield* this.parseFlowCollection();
				case "quoted-scalar": return yield* this.parseQuotedScalar();
				case "block-scalar": return yield* this.parseBlockScalar();
				case "plain-scalar": return yield* this.parsePlainScalar();
			}
		}
		*parseStream() {
			let line = this.getLine();
			if (line === null) return this.setNext("stream");
			if (line[0] === cst.BOM) {
				yield* this.pushCount(1);
				line = line.substring(1);
			}
			if (line[0] === "%") {
				let dirEnd = line.length;
				let cs = line.indexOf("#");
				while (cs !== -1) {
					const ch = line[cs - 1];
					if (ch === " " || ch === "	") {
						dirEnd = cs - 1;
						break;
					} else cs = line.indexOf("#", cs + 1);
				}
				while (true) {
					const ch = line[dirEnd - 1];
					if (ch === " " || ch === "	") dirEnd -= 1;
					else break;
				}
				const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
				yield* this.pushCount(line.length - n);
				this.pushNewline();
				return "stream";
			}
			if (this.atLineEnd()) {
				const sp = yield* this.pushSpaces(true);
				yield* this.pushCount(line.length - sp);
				yield* this.pushNewline();
				return "stream";
			}
			yield cst.DOCUMENT;
			return yield* this.parseLineStart();
		}
		*parseLineStart() {
			const ch = this.charAt(0);
			if (!ch && !this.atEnd) return this.setNext("line-start");
			if (ch === "-" || ch === ".") {
				if (!this.atEnd && !this.hasChars(4)) return this.setNext("line-start");
				const s = this.peek(3);
				if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
					yield* this.pushCount(3);
					this.indentValue = 0;
					this.indentNext = 0;
					return s === "---" ? "doc" : "stream";
				}
			}
			this.indentValue = yield* this.pushSpaces(false);
			if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1))) this.indentNext = this.indentValue;
			return yield* this.parseBlockStart();
		}
		*parseBlockStart() {
			const [ch0, ch1] = this.peek(2);
			if (!ch1 && !this.atEnd) return this.setNext("block-start");
			if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
				const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
				this.indentNext = this.indentValue + 1;
				this.indentValue += n;
				return "block-start";
			}
			return "doc";
		}
		*parseDocument() {
			yield* this.pushSpaces(true);
			const line = this.getLine();
			if (line === null) return this.setNext("doc");
			let n = yield* this.pushIndicators();
			switch (line[n]) {
				case "#": yield* this.pushCount(line.length - n);
				case void 0:
					yield* this.pushNewline();
					return yield* this.parseLineStart();
				case "{":
				case "[":
					yield* this.pushCount(1);
					this.flowKey = false;
					this.flowLevel = 1;
					return "flow";
				case "}":
				case "]":
					yield* this.pushCount(1);
					return "doc";
				case "*":
					yield* this.pushUntil(isNotAnchorChar);
					return "doc";
				case "\"":
				case "'": return yield* this.parseQuotedScalar();
				case "|":
				case ">":
					n += yield* this.parseBlockScalarHeader();
					n += yield* this.pushSpaces(true);
					yield* this.pushCount(line.length - n);
					yield* this.pushNewline();
					return yield* this.parseBlockScalar();
				default: return yield* this.parsePlainScalar();
			}
		}
		*parseFlowCollection() {
			let nl, sp;
			let indent = -1;
			do {
				nl = yield* this.pushNewline();
				if (nl > 0) {
					sp = yield* this.pushSpaces(false);
					this.indentValue = indent = sp;
				} else sp = 0;
				sp += yield* this.pushSpaces(true);
			} while (nl + sp > 0);
			const line = this.getLine();
			if (line === null) return this.setNext("flow");
			if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
				if (!(indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}"))) {
					this.flowLevel = 0;
					yield cst.FLOW_END;
					return yield* this.parseLineStart();
				}
			}
			let n = 0;
			while (line[n] === ",") {
				n += yield* this.pushCount(1);
				n += yield* this.pushSpaces(true);
				this.flowKey = false;
			}
			n += yield* this.pushIndicators();
			switch (line[n]) {
				case void 0: return "flow";
				case "#":
					yield* this.pushCount(line.length - n);
					return "flow";
				case "{":
				case "[":
					yield* this.pushCount(1);
					this.flowKey = false;
					this.flowLevel += 1;
					return "flow";
				case "}":
				case "]":
					yield* this.pushCount(1);
					this.flowKey = true;
					this.flowLevel -= 1;
					return this.flowLevel ? "flow" : "doc";
				case "*":
					yield* this.pushUntil(isNotAnchorChar);
					return "flow";
				case "\"":
				case "'":
					this.flowKey = true;
					return yield* this.parseQuotedScalar();
				case ":": {
					const next = this.charAt(1);
					if (this.flowKey || isEmpty(next) || next === ",") {
						this.flowKey = false;
						yield* this.pushCount(1);
						yield* this.pushSpaces(true);
						return "flow";
					}
				}
				default:
					this.flowKey = false;
					return yield* this.parsePlainScalar();
			}
		}
		*parseQuotedScalar() {
			const quote = this.charAt(0);
			let end = this.buffer.indexOf(quote, this.pos + 1);
			if (quote === "'") while (end !== -1 && this.buffer[end + 1] === "'") end = this.buffer.indexOf("'", end + 2);
			else while (end !== -1) {
				let n = 0;
				while (this.buffer[end - 1 - n] === "\\") n += 1;
				if (n % 2 === 0) break;
				end = this.buffer.indexOf("\"", end + 1);
			}
			const qb = this.buffer.substring(0, end);
			let nl = qb.indexOf("\n", this.pos);
			if (nl !== -1) {
				while (nl !== -1) {
					const cs = this.continueScalar(nl + 1);
					if (cs === -1) break;
					nl = qb.indexOf("\n", cs);
				}
				if (nl !== -1) end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
			}
			if (end === -1) {
				if (!this.atEnd) return this.setNext("quoted-scalar");
				end = this.buffer.length;
			}
			yield* this.pushToIndex(end + 1, false);
			return this.flowLevel ? "flow" : "doc";
		}
		*parseBlockScalarHeader() {
			this.blockScalarIndent = -1;
			this.blockScalarKeep = false;
			let i = this.pos;
			while (true) {
				const ch = this.buffer[++i];
				if (ch === "+") this.blockScalarKeep = true;
				else if (ch > "0" && ch <= "9") this.blockScalarIndent = Number(ch) - 1;
				else if (ch !== "-") break;
			}
			return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
		}
		*parseBlockScalar() {
			let nl = this.pos - 1;
			let indent = 0;
			let ch;
			loop: for (let i = this.pos; ch = this.buffer[i]; ++i) switch (ch) {
				case " ":
					indent += 1;
					break;
				case "\n":
					nl = i;
					indent = 0;
					break;
				case "\r": {
					const next = this.buffer[i + 1];
					if (!next && !this.atEnd) return this.setNext("block-scalar");
					if (next === "\n") break;
				}
				default: break loop;
			}
			if (!ch && !this.atEnd) return this.setNext("block-scalar");
			if (indent >= this.indentNext) {
				if (this.blockScalarIndent === -1) this.indentNext = indent;
				else this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
				do {
					const cs = this.continueScalar(nl + 1);
					if (cs === -1) break;
					nl = this.buffer.indexOf("\n", cs);
				} while (nl !== -1);
				if (nl === -1) {
					if (!this.atEnd) return this.setNext("block-scalar");
					nl = this.buffer.length;
				}
			}
			let i = nl + 1;
			ch = this.buffer[i];
			while (ch === " ") ch = this.buffer[++i];
			if (ch === "	") {
				while (ch === "	" || ch === " " || ch === "\r" || ch === "\n") ch = this.buffer[++i];
				nl = i - 1;
			} else if (!this.blockScalarKeep) do {
				let i = nl - 1;
				let ch = this.buffer[i];
				if (ch === "\r") ch = this.buffer[--i];
				const lastChar = i;
				while (ch === " ") ch = this.buffer[--i];
				if (ch === "\n" && i >= this.pos && i + 1 + indent > lastChar) nl = i;
				else break;
			} while (true);
			yield cst.SCALAR;
			yield* this.pushToIndex(nl + 1, true);
			return yield* this.parseLineStart();
		}
		*parsePlainScalar() {
			const inFlow = this.flowLevel > 0;
			let end = this.pos - 1;
			let i = this.pos - 1;
			let ch;
			while (ch = this.buffer[++i]) if (ch === ":") {
				const next = this.buffer[i + 1];
				if (isEmpty(next) || inFlow && flowIndicatorChars.has(next)) break;
				end = i;
			} else if (isEmpty(ch)) {
				let next = this.buffer[i + 1];
				if (ch === "\r") {
					if (next === "\n") {
						i += 1;
						ch = "\n";
						next = this.buffer[i + 1];
					} else end = i;
				}
				if (next === "#" || inFlow && flowIndicatorChars.has(next)) break;
				if (ch === "\n") {
					const cs = this.continueScalar(i + 1);
					if (cs === -1) break;
					i = Math.max(i, cs - 2);
				}
			} else {
				if (inFlow && flowIndicatorChars.has(ch)) break;
				end = i;
			}
			if (!ch && !this.atEnd) return this.setNext("plain-scalar");
			yield cst.SCALAR;
			yield* this.pushToIndex(end + 1, true);
			return inFlow ? "flow" : "doc";
		}
		*pushCount(n) {
			if (n > 0) {
				yield this.buffer.substr(this.pos, n);
				this.pos += n;
				return n;
			}
			return 0;
		}
		*pushToIndex(i, allowEmpty) {
			const s = this.buffer.slice(this.pos, i);
			if (s) {
				yield s;
				this.pos += s.length;
				return s.length;
			} else if (allowEmpty) yield "";
			return 0;
		}
		*pushIndicators() {
			let n = 0;
			loop: while (true) {
				switch (this.charAt(0)) {
					case "!":
						n += yield* this.pushTag();
						n += yield* this.pushSpaces(true);
						continue loop;
					case "&":
						n += yield* this.pushUntil(isNotAnchorChar);
						n += yield* this.pushSpaces(true);
						continue loop;
					case "-":
					case "?":
					case ":": {
						const inFlow = this.flowLevel > 0;
						const ch1 = this.charAt(1);
						if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
							if (!inFlow) this.indentNext = this.indentValue + 1;
							else if (this.flowKey) this.flowKey = false;
							n += yield* this.pushCount(1);
							n += yield* this.pushSpaces(true);
							continue loop;
						}
					}
				}
				break loop;
			}
			return n;
		}
		*pushTag() {
			if (this.charAt(1) === "<") {
				let i = this.pos + 2;
				let ch = this.buffer[i];
				while (!isEmpty(ch) && ch !== ">") ch = this.buffer[++i];
				return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
			} else {
				let i = this.pos + 1;
				let ch = this.buffer[i];
				while (ch) if (tagChars.has(ch)) ch = this.buffer[++i];
				else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) ch = this.buffer[i += 3];
				else break;
				return yield* this.pushToIndex(i, false);
			}
		}
		*pushNewline() {
			const ch = this.buffer[this.pos];
			if (ch === "\n") return yield* this.pushCount(1);
			else if (ch === "\r" && this.charAt(1) === "\n") return yield* this.pushCount(2);
			else return 0;
		}
		*pushSpaces(allowTabs) {
			let i = this.pos - 1;
			let ch;
			do
				ch = this.buffer[++i];
			while (ch === " " || allowTabs && ch === "	");
			const n = i - this.pos;
			if (n > 0) {
				yield this.buffer.substr(this.pos, n);
				this.pos = i;
			}
			return n;
		}
		*pushUntil(test) {
			let i = this.pos;
			let ch = this.buffer[i];
			while (!test(ch)) ch = this.buffer[++i];
			return yield* this.pushToIndex(i, false);
		}
	};
	exports.Lexer = Lexer;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Tracks newlines during parsing in order to provide an efficient API for
	* determining the one-indexed `{ line, col }` position for any offset
	* within the input.
	*/
	var LineCounter = class {
		constructor() {
			this.lineStarts = [];
			/**
			* Should be called in ascending order. Otherwise, call
			* `lineCounter.lineStarts.sort()` before calling `linePos()`.
			*/
			this.addNewLine = (offset) => this.lineStarts.push(offset);
			/**
			* Performs a binary search and returns the 1-indexed { line, col }
			* position of `offset`. If `line === 0`, `addNewLine` has never been
			* called or `offset` is before the first known newline.
			*/
			this.linePos = (offset) => {
				let low = 0;
				let high = this.lineStarts.length;
				while (low < high) {
					const mid = low + high >> 1;
					if (this.lineStarts[mid] < offset) low = mid + 1;
					else high = mid;
				}
				if (this.lineStarts[low] === offset) return {
					line: low + 1,
					col: 1
				};
				if (low === 0) return {
					line: 0,
					col: offset
				};
				const start = this.lineStarts[low - 1];
				return {
					line: low,
					col: offset - start + 1
				};
			};
		}
	};
	exports.LineCounter = LineCounter;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/parser.js
var require_parser = /* @__PURE__ */ __commonJSMin(((exports) => {
	var node_process = __require("process");
	var cst = require_cst();
	var lexer = require_lexer();
	function includesToken(list, type) {
		for (let i = 0; i < list.length; ++i) if (list[i].type === type) return true;
		return false;
	}
	function findNonEmptyIndex(list) {
		for (let i = 0; i < list.length; ++i) switch (list[i].type) {
			case "space":
			case "comment":
			case "newline": break;
			default: return i;
		}
		return -1;
	}
	function isFlowToken(token) {
		switch (token?.type) {
			case "alias":
			case "scalar":
			case "single-quoted-scalar":
			case "double-quoted-scalar":
			case "flow-collection": return true;
			default: return false;
		}
	}
	function getPrevProps(parent) {
		switch (parent.type) {
			case "document": return parent.start;
			case "block-map": {
				const it = parent.items[parent.items.length - 1];
				return it.sep ?? it.start;
			}
			case "block-seq": return parent.items[parent.items.length - 1].start;
			/* istanbul ignore next should not happen */
			default: return [];
		}
	}
	/** Note: May modify input array */
	function getFirstKeyStartProps(prev) {
		if (prev.length === 0) return [];
		let i = prev.length;
		loop: while (--i >= 0) switch (prev[i].type) {
			case "doc-start":
			case "explicit-key-ind":
			case "map-value-ind":
			case "seq-item-ind":
			case "newline": break loop;
		}
		while (prev[++i]?.type === "space");
		return prev.splice(i, prev.length);
	}
	function arrayPushArray(target, source) {
		if (source.length < 1e5) Array.prototype.push.apply(target, source);
		else for (let i = 0; i < source.length; ++i) target.push(source[i]);
	}
	function fixFlowSeqItems(fc) {
		if (fc.start.type === "flow-seq-start") {
			for (const it of fc.items) if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
				if (it.key) it.value = it.key;
				delete it.key;
				if (isFlowToken(it.value)) {
					if (it.value.end) arrayPushArray(it.value.end, it.sep);
					else it.value.end = it.sep;
				} else arrayPushArray(it.start, it.sep);
				delete it.sep;
			}
		}
	}
	/**
	* A YAML concrete syntax tree (CST) parser
	*
	* ```ts
	* const src: string = ...
	* for (const token of new Parser().parse(src)) {
	*   // token: Token
	* }
	* ```
	*
	* To use the parser with a user-provided lexer:
	*
	* ```ts
	* function* parse(source: string, lexer: Lexer) {
	*   const parser = new Parser()
	*   for (const lexeme of lexer.lex(source))
	*     yield* parser.next(lexeme)
	*   yield* parser.end()
	* }
	*
	* const src: string = ...
	* const lexer = new Lexer()
	* for (const token of parse(src, lexer)) {
	*   // token: Token
	* }
	* ```
	*/
	var Parser = class {
		/**
		* @param onNewLine - If defined, called separately with the start position of
		*   each new line (in `parse()`, including the start of input).
		*/
		constructor(onNewLine) {
			/** If true, space and sequence indicators count as indentation */
			this.atNewLine = true;
			/** If true, next token is a scalar value */
			this.atScalar = false;
			/** Current indentation level */
			this.indent = 0;
			/** Current offset since the start of parsing */
			this.offset = 0;
			/** On the same line with a block map key */
			this.onKeyLine = false;
			/** Top indicates the node that's currently being built */
			this.stack = [];
			/** The source of the current token, set in parse() */
			this.source = "";
			/** The type of the current token, set in parse() */
			this.type = "";
			this.lexer = new lexer.Lexer();
			this.onNewLine = onNewLine;
		}
		/**
		* Parse `source` as a YAML stream.
		* If `incomplete`, a part of the last line may be left as a buffer for the next call.
		*
		* Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
		*
		* @returns A generator of tokens representing each directive, document, and other structure.
		*/
		*parse(source, incomplete = false) {
			if (this.onNewLine && this.offset === 0) this.onNewLine(0);
			for (const lexeme of this.lexer.lex(source, incomplete)) yield* this.next(lexeme);
			if (!incomplete) yield* this.end();
		}
		/**
		* Advance the parser by the `source` of one lexical token.
		*/
		*next(source) {
			this.source = source;
			if (node_process.env.LOG_TOKENS) console.log("|", cst.prettyToken(source));
			if (this.atScalar) {
				this.atScalar = false;
				yield* this.step();
				this.offset += source.length;
				return;
			}
			const type = cst.tokenType(source);
			if (!type) {
				const message = `Not a YAML token: ${source}`;
				yield* this.pop({
					type: "error",
					offset: this.offset,
					message,
					source
				});
				this.offset += source.length;
			} else if (type === "scalar") {
				this.atNewLine = false;
				this.atScalar = true;
				this.type = "scalar";
			} else {
				this.type = type;
				yield* this.step();
				switch (type) {
					case "newline":
						this.atNewLine = true;
						this.indent = 0;
						if (this.onNewLine) this.onNewLine(this.offset + source.length);
						break;
					case "space":
						if (this.atNewLine && source[0] === " ") this.indent += source.length;
						break;
					case "explicit-key-ind":
					case "map-value-ind":
					case "seq-item-ind":
						if (this.atNewLine) this.indent += source.length;
						break;
					case "doc-mode":
					case "flow-error-end": return;
					default: this.atNewLine = false;
				}
				this.offset += source.length;
			}
		}
		/** Call at end of input to push out any remaining constructions */
		*end() {
			while (this.stack.length > 0) yield* this.pop();
		}
		get sourceToken() {
			return {
				type: this.type,
				offset: this.offset,
				indent: this.indent,
				source: this.source
			};
		}
		*step() {
			const top = this.peek(1);
			if (this.type === "doc-end" && top?.type !== "doc-end") {
				while (this.stack.length > 0) yield* this.pop();
				this.stack.push({
					type: "doc-end",
					offset: this.offset,
					source: this.source
				});
				return;
			}
			if (!top) return yield* this.stream();
			switch (top.type) {
				case "document": return yield* this.document(top);
				case "alias":
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return yield* this.scalar(top);
				case "block-scalar": return yield* this.blockScalar(top);
				case "block-map": return yield* this.blockMap(top);
				case "block-seq": return yield* this.blockSequence(top);
				case "flow-collection": return yield* this.flowCollection(top);
				case "doc-end": return yield* this.documentEnd(top);
			}
			/* istanbul ignore next should not happen */
			yield* this.pop();
		}
		peek(n) {
			return this.stack[this.stack.length - n];
		}
		*pop(error) {
			const token = error ?? this.stack.pop();
			/* istanbul ignore if should not happen */
			if (!token) yield {
				type: "error",
				offset: this.offset,
				source: "",
				message: "Tried to pop an empty stack"
			};
			else if (this.stack.length === 0) yield token;
			else {
				const top = this.peek(1);
				if (token.type === "block-scalar") token.indent = "indent" in top ? top.indent : 0;
				else if (token.type === "flow-collection" && top.type === "document") token.indent = 0;
				if (token.type === "flow-collection") fixFlowSeqItems(token);
				switch (top.type) {
					case "document":
						top.value = token;
						break;
					case "block-scalar":
						top.props.push(token);
						break;
					case "block-map": {
						const it = top.items[top.items.length - 1];
						if (it.value) {
							top.items.push({
								start: [],
								key: token,
								sep: []
							});
							this.onKeyLine = true;
							return;
						} else if (it.sep) it.value = token;
						else {
							Object.assign(it, {
								key: token,
								sep: []
							});
							this.onKeyLine = !it.explicitKey;
							return;
						}
						break;
					}
					case "block-seq": {
						const it = top.items[top.items.length - 1];
						if (it.value) top.items.push({
							start: [],
							value: token
						});
						else it.value = token;
						break;
					}
					case "flow-collection": {
						const it = top.items[top.items.length - 1];
						if (!it || it.value) top.items.push({
							start: [],
							key: token,
							sep: []
						});
						else if (it.sep) it.value = token;
						else Object.assign(it, {
							key: token,
							sep: []
						});
						return;
					}
					/* istanbul ignore next should not happen */
					default:
						yield* this.pop();
						yield* this.pop(token);
				}
				if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
					const last = token.items[token.items.length - 1];
					if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
						if (top.type === "document") top.end = last.start;
						else top.items.push({ start: last.start });
						token.items.splice(-1, 1);
					}
				}
			}
		}
		*stream() {
			switch (this.type) {
				case "directive-line":
					yield {
						type: "directive",
						offset: this.offset,
						source: this.source
					};
					return;
				case "byte-order-mark":
				case "space":
				case "comment":
				case "newline":
					yield this.sourceToken;
					return;
				case "doc-mode":
				case "doc-start": {
					const doc = {
						type: "document",
						offset: this.offset,
						start: []
					};
					if (this.type === "doc-start") doc.start.push(this.sourceToken);
					this.stack.push(doc);
					return;
				}
			}
			yield {
				type: "error",
				offset: this.offset,
				message: `Unexpected ${this.type} token in YAML stream`,
				source: this.source
			};
		}
		*document(doc) {
			if (doc.value) return yield* this.lineEnd(doc);
			switch (this.type) {
				case "doc-start":
					if (findNonEmptyIndex(doc.start) !== -1) {
						yield* this.pop();
						yield* this.step();
					} else doc.start.push(this.sourceToken);
					return;
				case "anchor":
				case "tag":
				case "space":
				case "comment":
				case "newline":
					doc.start.push(this.sourceToken);
					return;
			}
			const bv = this.startBlockValue(doc);
			if (bv) this.stack.push(bv);
			else yield {
				type: "error",
				offset: this.offset,
				message: `Unexpected ${this.type} token in YAML document`,
				source: this.source
			};
		}
		*scalar(scalar) {
			if (this.type === "map-value-ind") {
				const start = getFirstKeyStartProps(getPrevProps(this.peek(2)));
				let sep;
				if (scalar.end) {
					sep = scalar.end;
					sep.push(this.sourceToken);
					delete scalar.end;
				} else sep = [this.sourceToken];
				const map = {
					type: "block-map",
					offset: scalar.offset,
					indent: scalar.indent,
					items: [{
						start,
						key: scalar,
						sep
					}]
				};
				this.onKeyLine = true;
				this.stack[this.stack.length - 1] = map;
			} else yield* this.lineEnd(scalar);
		}
		*blockScalar(scalar) {
			switch (this.type) {
				case "space":
				case "comment":
				case "newline":
					scalar.props.push(this.sourceToken);
					return;
				case "scalar":
					scalar.source = this.source;
					this.atNewLine = true;
					this.indent = 0;
					if (this.onNewLine) {
						let nl = this.source.indexOf("\n") + 1;
						while (nl !== 0) {
							this.onNewLine(this.offset + nl);
							nl = this.source.indexOf("\n", nl) + 1;
						}
					}
					yield* this.pop();
					break;
				/* istanbul ignore next should not happen */
				default:
					yield* this.pop();
					yield* this.step();
			}
		}
		*blockMap(map) {
			const it = map.items[map.items.length - 1];
			switch (this.type) {
				case "newline":
					this.onKeyLine = false;
					if (it.value) {
						const end = "end" in it.value ? it.value.end : void 0;
						if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
						else map.items.push({ start: [this.sourceToken] });
					} else if (it.sep) it.sep.push(this.sourceToken);
					else it.start.push(this.sourceToken);
					return;
				case "space":
				case "comment":
					if (it.value) map.items.push({ start: [this.sourceToken] });
					else if (it.sep) it.sep.push(this.sourceToken);
					else {
						if (this.atIndentedComment(it.start, map.indent)) {
							const end = map.items[map.items.length - 2]?.value?.end;
							if (Array.isArray(end)) {
								arrayPushArray(end, it.start);
								end.push(this.sourceToken);
								map.items.pop();
								return;
							}
						}
						it.start.push(this.sourceToken);
					}
					return;
			}
			if (this.indent >= map.indent) {
				const atMapIndent = !this.onKeyLine && this.indent === map.indent;
				const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
				let start = [];
				if (atNextItem && it.sep && !it.value) {
					const nl = [];
					for (let i = 0; i < it.sep.length; ++i) {
						const st = it.sep[i];
						switch (st.type) {
							case "newline":
								nl.push(i);
								break;
							case "space": break;
							case "comment":
								if (st.indent > map.indent) nl.length = 0;
								break;
							default: nl.length = 0;
						}
					}
					if (nl.length >= 2) start = it.sep.splice(nl[1]);
				}
				switch (this.type) {
					case "anchor":
					case "tag":
						if (atNextItem || it.value) {
							start.push(this.sourceToken);
							map.items.push({ start });
							this.onKeyLine = true;
						} else if (it.sep) it.sep.push(this.sourceToken);
						else it.start.push(this.sourceToken);
						return;
					case "explicit-key-ind":
						if (!it.sep && !it.explicitKey) {
							it.start.push(this.sourceToken);
							it.explicitKey = true;
						} else if (atNextItem || it.value) {
							start.push(this.sourceToken);
							map.items.push({
								start,
								explicitKey: true
							});
						} else this.stack.push({
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start: [this.sourceToken],
								explicitKey: true
							}]
						});
						this.onKeyLine = true;
						return;
					case "map-value-ind":
						if (it.explicitKey) {
							if (!it.sep) {
								if (includesToken(it.start, "newline")) Object.assign(it, {
									key: null,
									sep: [this.sourceToken]
								});
								else {
									const start = getFirstKeyStartProps(it.start);
									this.stack.push({
										type: "block-map",
										offset: this.offset,
										indent: this.indent,
										items: [{
											start,
											key: null,
											sep: [this.sourceToken]
										}]
									});
								}
							} else if (it.value) map.items.push({
								start: [],
								key: null,
								sep: [this.sourceToken]
							});
							else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
								type: "block-map",
								offset: this.offset,
								indent: this.indent,
								items: [{
									start,
									key: null,
									sep: [this.sourceToken]
								}]
							});
							else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
								const start = getFirstKeyStartProps(it.start);
								const key = it.key;
								const sep = it.sep;
								sep.push(this.sourceToken);
								delete it.key;
								delete it.sep;
								this.stack.push({
									type: "block-map",
									offset: this.offset,
									indent: this.indent,
									items: [{
										start,
										key,
										sep
									}]
								});
							} else if (start.length > 0) it.sep = it.sep.concat(start, this.sourceToken);
							else it.sep.push(this.sourceToken);
						} else if (!it.sep) Object.assign(it, {
							key: null,
							sep: [this.sourceToken]
						});
						else if (it.value || atNextItem) map.items.push({
							start,
							key: null,
							sep: [this.sourceToken]
						});
						else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start: [],
								key: null,
								sep: [this.sourceToken]
							}]
						});
						else it.sep.push(this.sourceToken);
						this.onKeyLine = true;
						return;
					case "alias":
					case "scalar":
					case "single-quoted-scalar":
					case "double-quoted-scalar": {
						const fs = this.flowScalar(this.type);
						if (atNextItem || it.value) {
							map.items.push({
								start,
								key: fs,
								sep: []
							});
							this.onKeyLine = true;
						} else if (it.sep) this.stack.push(fs);
						else {
							Object.assign(it, {
								key: fs,
								sep: []
							});
							this.onKeyLine = true;
						}
						return;
					}
					default: {
						const bv = this.startBlockValue(map);
						if (bv) {
							if (bv.type === "block-seq") {
								if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
									yield* this.pop({
										type: "error",
										offset: this.offset,
										message: "Unexpected block-seq-ind on same line with key",
										source: this.source
									});
									return;
								}
							} else if (atMapIndent) map.items.push({ start });
							this.stack.push(bv);
							return;
						}
					}
				}
			}
			yield* this.pop();
			yield* this.step();
		}
		*blockSequence(seq) {
			const it = seq.items[seq.items.length - 1];
			switch (this.type) {
				case "newline":
					if (it.value) {
						const end = "end" in it.value ? it.value.end : void 0;
						if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
						else seq.items.push({ start: [this.sourceToken] });
					} else it.start.push(this.sourceToken);
					return;
				case "space":
				case "comment":
					if (it.value) seq.items.push({ start: [this.sourceToken] });
					else {
						if (this.atIndentedComment(it.start, seq.indent)) {
							const end = seq.items[seq.items.length - 2]?.value?.end;
							if (Array.isArray(end)) {
								arrayPushArray(end, it.start);
								end.push(this.sourceToken);
								seq.items.pop();
								return;
							}
						}
						it.start.push(this.sourceToken);
					}
					return;
				case "anchor":
				case "tag":
					if (it.value || this.indent <= seq.indent) break;
					it.start.push(this.sourceToken);
					return;
				case "seq-item-ind":
					if (this.indent !== seq.indent) break;
					if (it.value || includesToken(it.start, "seq-item-ind")) seq.items.push({ start: [this.sourceToken] });
					else it.start.push(this.sourceToken);
					return;
			}
			if (this.indent > seq.indent) {
				const bv = this.startBlockValue(seq);
				if (bv) {
					this.stack.push(bv);
					return;
				}
			}
			yield* this.pop();
			yield* this.step();
		}
		*flowCollection(fc) {
			const it = fc.items[fc.items.length - 1];
			if (this.type === "flow-error-end") {
				let top;
				do {
					yield* this.pop();
					top = this.peek(1);
				} while (top?.type === "flow-collection");
			} else if (fc.end.length === 0) {
				switch (this.type) {
					case "comma":
					case "explicit-key-ind":
						if (!it || it.sep) fc.items.push({ start: [this.sourceToken] });
						else it.start.push(this.sourceToken);
						return;
					case "map-value-ind":
						if (!it || it.value) fc.items.push({
							start: [],
							key: null,
							sep: [this.sourceToken]
						});
						else if (it.sep) it.sep.push(this.sourceToken);
						else Object.assign(it, {
							key: null,
							sep: [this.sourceToken]
						});
						return;
					case "space":
					case "comment":
					case "newline":
					case "anchor":
					case "tag":
						if (!it || it.value) fc.items.push({ start: [this.sourceToken] });
						else if (it.sep) it.sep.push(this.sourceToken);
						else it.start.push(this.sourceToken);
						return;
					case "alias":
					case "scalar":
					case "single-quoted-scalar":
					case "double-quoted-scalar": {
						const fs = this.flowScalar(this.type);
						if (!it || it.value) fc.items.push({
							start: [],
							key: fs,
							sep: []
						});
						else if (it.sep) this.stack.push(fs);
						else Object.assign(it, {
							key: fs,
							sep: []
						});
						return;
					}
					case "flow-map-end":
					case "flow-seq-end":
						fc.end.push(this.sourceToken);
						return;
				}
				const bv = this.startBlockValue(fc);
				/* istanbul ignore else should not happen */
				if (bv) this.stack.push(bv);
				else {
					yield* this.pop();
					yield* this.step();
				}
			} else {
				const parent = this.peek(2);
				if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
					yield* this.pop();
					yield* this.step();
				} else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
					const start = getFirstKeyStartProps(getPrevProps(parent));
					fixFlowSeqItems(fc);
					const sep = fc.end.splice(1, fc.end.length);
					sep.push(this.sourceToken);
					const map = {
						type: "block-map",
						offset: fc.offset,
						indent: fc.indent,
						items: [{
							start,
							key: fc,
							sep
						}]
					};
					this.onKeyLine = true;
					this.stack[this.stack.length - 1] = map;
				} else yield* this.lineEnd(fc);
			}
		}
		flowScalar(type) {
			if (this.onNewLine) {
				let nl = this.source.indexOf("\n") + 1;
				while (nl !== 0) {
					this.onNewLine(this.offset + nl);
					nl = this.source.indexOf("\n", nl) + 1;
				}
			}
			return {
				type,
				offset: this.offset,
				indent: this.indent,
				source: this.source
			};
		}
		startBlockValue(parent) {
			switch (this.type) {
				case "alias":
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return this.flowScalar(this.type);
				case "block-scalar-header": return {
					type: "block-scalar",
					offset: this.offset,
					indent: this.indent,
					props: [this.sourceToken],
					source: ""
				};
				case "flow-map-start":
				case "flow-seq-start": return {
					type: "flow-collection",
					offset: this.offset,
					indent: this.indent,
					start: this.sourceToken,
					items: [],
					end: []
				};
				case "seq-item-ind": return {
					type: "block-seq",
					offset: this.offset,
					indent: this.indent,
					items: [{ start: [this.sourceToken] }]
				};
				case "explicit-key-ind": {
					this.onKeyLine = true;
					const start = getFirstKeyStartProps(getPrevProps(parent));
					start.push(this.sourceToken);
					return {
						type: "block-map",
						offset: this.offset,
						indent: this.indent,
						items: [{
							start,
							explicitKey: true
						}]
					};
				}
				case "map-value-ind": {
					this.onKeyLine = true;
					const start = getFirstKeyStartProps(getPrevProps(parent));
					return {
						type: "block-map",
						offset: this.offset,
						indent: this.indent,
						items: [{
							start,
							key: null,
							sep: [this.sourceToken]
						}]
					};
				}
			}
			return null;
		}
		atIndentedComment(start, indent) {
			if (this.type !== "comment") return false;
			if (this.indent <= indent) return false;
			return start.every((st) => st.type === "newline" || st.type === "space");
		}
		*documentEnd(docEnd) {
			if (this.type !== "doc-mode") {
				if (docEnd.end) docEnd.end.push(this.sourceToken);
				else docEnd.end = [this.sourceToken];
				if (this.type === "newline") yield* this.pop();
			}
		}
		*lineEnd(token) {
			switch (this.type) {
				case "comma":
				case "doc-start":
				case "doc-end":
				case "flow-seq-end":
				case "flow-map-end":
				case "map-value-ind":
					yield* this.pop();
					yield* this.step();
					break;
				case "newline": this.onKeyLine = false;
				default:
					if (token.end) token.end.push(this.sourceToken);
					else token.end = [this.sourceToken];
					if (this.type === "newline") yield* this.pop();
			}
		}
	};
	exports.Parser = Parser;
}));
//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/public-api.js
var require_public_api = /* @__PURE__ */ __commonJSMin(((exports) => {
	var composer = require_composer();
	var Document = require_Document();
	var errors = require_errors();
	var log = require_log();
	var identity = require_identity();
	var lineCounter = require_line_counter();
	var parser = require_parser();
	function parseOptions(options) {
		const prettyErrors = options.prettyErrors !== false;
		return {
			lineCounter: options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null,
			prettyErrors
		};
	}
	/**
	* Parse the input as a stream of YAML documents.
	*
	* Documents should be separated from each other by `...` or `---` marker lines.
	*
	* @returns If an empty `docs` array is returned, it will be of type
	*   EmptyStream and contain additional stream information. In
	*   TypeScript, you should use `'empty' in docs` as a type guard for it.
	*/
	function parseAllDocuments(source, options = {}) {
		const { lineCounter, prettyErrors } = parseOptions(options);
		const parser$1 = new parser.Parser(lineCounter?.addNewLine);
		const composer$1 = new composer.Composer(options);
		const docs = Array.from(composer$1.compose(parser$1.parse(source)));
		if (prettyErrors && lineCounter) for (const doc of docs) {
			doc.errors.forEach(errors.prettifyError(source, lineCounter));
			doc.warnings.forEach(errors.prettifyError(source, lineCounter));
		}
		if (docs.length > 0) return docs;
		return Object.assign([], { empty: true }, composer$1.streamInfo());
	}
	/** Parse an input string into a single YAML.Document */
	function parseDocument(source, options = {}) {
		const { lineCounter, prettyErrors } = parseOptions(options);
		const parser$1 = new parser.Parser(lineCounter?.addNewLine);
		const composer$1 = new composer.Composer(options);
		let doc = null;
		for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) if (!doc) doc = _doc;
		else if (doc.options.logLevel !== "silent") {
			doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
			break;
		}
		if (prettyErrors && lineCounter) {
			doc.errors.forEach(errors.prettifyError(source, lineCounter));
			doc.warnings.forEach(errors.prettifyError(source, lineCounter));
		}
		return doc;
	}
	function parse(src, reviver, options) {
		let _reviver = void 0;
		if (typeof reviver === "function") _reviver = reviver;
		else if (options === void 0 && reviver && typeof reviver === "object") options = reviver;
		const doc = parseDocument(src, options);
		if (!doc) return null;
		doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
		if (doc.errors.length > 0) {
			if (doc.options.logLevel !== "silent") throw doc.errors[0];
			else doc.errors = [];
		}
		return doc.toJS(Object.assign({ reviver: _reviver }, options));
	}
	function stringify(value, replacer, options) {
		let _replacer = null;
		if (typeof replacer === "function" || Array.isArray(replacer)) _replacer = replacer;
		else if (options === void 0 && replacer) options = replacer;
		if (typeof options === "string") options = options.length;
		if (typeof options === "number") {
			const indent = Math.round(options);
			options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
		}
		if (value === void 0) {
			const { keepUndefined } = options ?? replacer ?? {};
			if (!keepUndefined) return void 0;
		}
		if (identity.isDocument(value) && !_replacer) return value.toString(options);
		return new Document.Document(value, _replacer, options).toString(options);
	}
	exports.parse = parse;
	exports.parseAllDocuments = parseAllDocuments;
	exports.parseDocument = parseDocument;
	exports.stringify = stringify;
}));
//#endregion
//#region packages/core/src/semver.ts
var import_dist = (/* @__PURE__ */ __commonJSMin(((exports) => {
	var composer = require_composer();
	var Document = require_Document();
	var Schema = require_Schema();
	var errors = require_errors();
	var Alias = require_Alias();
	var identity = require_identity();
	var Pair = require_Pair();
	var Scalar = require_Scalar();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	require_cst();
	var lexer = require_lexer();
	var lineCounter = require_line_counter();
	var parser = require_parser();
	var publicApi = require_public_api();
	var visit = require_visit();
	exports.Composer = composer.Composer;
	exports.Document = Document.Document;
	exports.Schema = Schema.Schema;
	exports.YAMLError = errors.YAMLError;
	exports.YAMLParseError = errors.YAMLParseError;
	exports.YAMLWarning = errors.YAMLWarning;
	exports.Alias = Alias.Alias;
	exports.isAlias = identity.isAlias;
	exports.isCollection = identity.isCollection;
	exports.isDocument = identity.isDocument;
	exports.isMap = identity.isMap;
	exports.isNode = identity.isNode;
	exports.isPair = identity.isPair;
	exports.isScalar = identity.isScalar;
	exports.isSeq = identity.isSeq;
	exports.Pair = Pair.Pair;
	exports.Scalar = Scalar.Scalar;
	exports.YAMLMap = YAMLMap.YAMLMap;
	exports.YAMLSeq = YAMLSeq.YAMLSeq;
	exports.Lexer = lexer.Lexer;
	exports.LineCounter = lineCounter.LineCounter;
	exports.Parser = parser.Parser;
	exports.parse = publicApi.parse;
	exports.parseAllDocuments = publicApi.parseAllDocuments;
	exports.parseDocument = publicApi.parseDocument;
	exports.stringify = publicApi.stringify;
	exports.visit = visit.visit;
	exports.visitAsync = visit.visitAsync;
})))();
const VERSION_RE = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
function parseVersion(tag) {
	const m = VERSION_RE.exec(tag);
	if (!m) return null;
	return {
		major: Number(m[1]),
		minor: Number(m[2]),
		patch: Number(m[3]),
		prerelease: m[4] ? m[4].split(".") : []
	};
}
/** Semver precedence: a prerelease sorts before its release, numeric identifiers compare as numbers. */
function compareVersions(a, b) {
	const core = a.major - b.major || a.minor - b.minor || a.patch - b.patch;
	if (core !== 0) return core;
	if (a.prerelease.length === 0 || b.prerelease.length === 0) return b.prerelease.length - a.prerelease.length;
	const n = Math.min(a.prerelease.length, b.prerelease.length);
	for (let i = 0; i < n; i++) {
		const x = a.prerelease[i] ?? "";
		const y = b.prerelease[i] ?? "";
		const xNum = /^\d+$/.test(x);
		const yNum = /^\d+$/.test(y);
		if (xNum && yNum) {
			const d = Number(x) - Number(y);
			if (d !== 0) return d;
		} else if (xNum !== yNum) return xNum ? -1 : 1;
		else if (x !== y) return x < y ? -1 : 1;
	}
	return a.prerelease.length - b.prerelease.length;
}
//#endregion
//#region packages/core/src/config.ts
var ConfigError = class extends Error {
	constructor(message) {
		super(`config: ${message}`);
		this.name = "ConfigError";
	}
};
const DEFAULT_CONFIG = {
	groups: [{
		name: "downloads",
		label: "Downloads",
		assets: "*"
	}],
	ignore: [],
	counters: [],
	epochs: [],
	platforms: [],
	charts: {
		titles: true,
		stars: {},
		"downloads-per-day": {},
		"downloads-per-release": {}
	}
};
/** Names the dataset uses for its own buckets, so a group can't take them. */
const RESERVED_GROUPS = /* @__PURE__ */ new Set(["other", "ignored"]);
const NAME_RE = /^[A-Za-z0-9_-]+$/;
const DOCKER_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function expectObject(value, path) {
	if (!isObject(value)) throw new ConfigError(`${path} must be a mapping`);
	return value;
}
function expectList(value, path) {
	if (!Array.isArray(value)) throw new ConfigError(`${path} must be a list`);
	return value;
}
function expectString(value, path) {
	if (typeof value !== "string" || value.trim() === "") throw new ConfigError(`${path} must be a non-empty string`);
	return value;
}
function optionalString(obj, key, path) {
	return obj[key] === void 0 ? void 0 : expectString(obj[key], `${path}.${key}`);
}
function checkKeys(obj, allowed, path) {
	for (const key of Object.keys(obj)) if (!allowed.includes(key)) throw new ConfigError(`${path}.${key} is not a known key`);
}
function checkName(name, path) {
	if (!NAME_RE.test(name)) throw new ConfigError(`${path} may only use letters, digits, '-' and '_'`);
}
/** YAML reads `1.11` as a number, so a version has to be quoted to be read as one. */
function expectVersion(value, path) {
	if (typeof value !== "string" || !parseVersion(value)) throw new ConfigError(`${path} must be a quoted semver version, e.g. "v1.11.0"`);
	return value;
}
function unique(names, what) {
	const seen = /* @__PURE__ */ new Set();
	for (const name of names) {
		if (seen.has(name)) throw new ConfigError(`${what} '${name}' is listed twice`);
		seen.add(name);
	}
}
function parseGroups(value) {
	const groups = expectList(value, "groups").map((item, i) => {
		const path = `groups[${i}]`;
		const obj = expectObject(item, path);
		checkKeys(obj, [
			"name",
			"label",
			"assets"
		], path);
		const name = expectString(obj.name, `${path}.name`);
		checkName(name, `${path}.name`);
		if (RESERVED_GROUPS.has(name)) throw new ConfigError(`${path}.name '${name}' is reserved`);
		return {
			name,
			label: optionalString(obj, "label", path) ?? name,
			assets: expectString(obj.assets, `${path}.assets`)
		};
	});
	unique(groups.map((g) => g.name), "group");
	return groups;
}
function parseIgnore(value) {
	return expectList(value, "ignore").map((item, i) => expectString(item, `ignore[${i}]`));
}
function parseCounters(value) {
	const counters = expectList(value, "counters").map((item, i) => {
		const path = `counters[${i}]`;
		const obj = expectObject(item, path);
		checkKeys(obj, [
			"name",
			"label",
			"assets",
			"from"
		], path);
		const name = expectString(obj.name, `${path}.name`);
		checkName(name, `${path}.name`);
		const from = obj.from === void 0 ? void 0 : expectVersion(obj.from, `${path}.from`);
		return {
			name,
			label: optionalString(obj, "label", path) ?? name,
			assets: expectString(obj.assets, `${path}.assets`),
			...from !== void 0 ? { from } : {}
		};
	});
	unique(counters.map((c) => c.name), "counter");
	return counters;
}
function parseEpochs(value) {
	const epochs = expectList(value, "epochs").map((item, i) => {
		const path = `epochs[${i}]`;
		const obj = expectObject(item, path);
		checkKeys(obj, ["version", "label"], path);
		const version = expectVersion(obj.version, `${path}.version`);
		return {
			version,
			label: optionalString(obj, "label", path) ?? version
		};
	});
	unique(epochs.map((e) => e.version), "epoch");
	return epochs.sort((a, b) => compareVersions(parseVersion(a.version), parseVersion(b.version)));
}
function optionalBoolean(obj, key, path) {
	const value = obj[key];
	if (value === void 0) return void 0;
	if (typeof value !== "boolean") throw new ConfigError(`${path}.${key} must be true or false`);
	return value;
}
function parseCharts(value) {
	const obj = expectObject(value, "charts");
	checkKeys(obj, [
		"titles",
		"stars",
		"downloads-per-day",
		"downloads-per-release"
	], "charts");
	const section = (name, keys) => {
		const sub = obj[name] === void 0 ? {} : expectObject(obj[name], `charts.${name}`);
		checkKeys(sub, keys, `charts.${name}`);
		return sub;
	};
	const stars = section("stars", ["title"]);
	const perDay = section("downloads-per-day", ["title"]);
	const perRelease = section("downloads-per-release", ["title"]);
	return {
		titles: optionalBoolean(obj, "titles", "charts") ?? true,
		stars: chartOptions(optionalBoolean(stars, "title", "charts.stars")),
		"downloads-per-day": chartOptions(optionalBoolean(perDay, "title", "charts.downloads-per-day")),
		"downloads-per-release": chartOptions(optionalBoolean(perRelease, "title", "charts.downloads-per-release"))
	};
}
/** `{ title }` when the chart sets one, else nothing, so an unset title stays out of the config. */
function chartOptions(title) {
	return title === void 0 ? {} : { title };
}
function parsePlatforms(value) {
	return expectList(value, "platforms").map((item, i) => {
		const path = `platforms[${i}]`;
		const obj = expectObject(item, path);
		checkKeys(obj, ["match", "label"], path);
		return {
			match: expectString(obj.match, `${path}.match`),
			label: expectString(obj.label, `${path}.label`)
		};
	});
}
/** Parses and validates the YAML text; an empty document gives the defaults. */
function parseConfig(text) {
	let doc;
	try {
		doc = (0, import_dist.parse)(text);
	} catch (error) {
		throw new ConfigError(`not valid YAML: ${error.message}`);
	}
	if (doc === null || doc === void 0) return structuredClone(DEFAULT_CONFIG);
	const root = expectObject(doc, "the file");
	checkKeys(root, [
		"groups",
		"ignore",
		"counters",
		"epochs",
		"platforms",
		"charts",
		"docker"
	], "top level");
	const config = {
		groups: root.groups === void 0 ? structuredClone(DEFAULT_CONFIG.groups) : parseGroups(root.groups),
		ignore: root.ignore === void 0 ? [] : parseIgnore(root.ignore),
		counters: root.counters === void 0 ? [] : parseCounters(root.counters),
		epochs: root.epochs === void 0 ? [] : parseEpochs(root.epochs),
		platforms: root.platforms === void 0 ? [] : parsePlatforms(root.platforms),
		charts: root.charts === void 0 ? structuredClone(DEFAULT_CONFIG.charts) : parseCharts(root.charts)
	};
	if (root.docker !== void 0) {
		const docker = expectString(root.docker, "docker");
		if (!DOCKER_RE.test(docker)) throw new ConfigError(`docker must be 'namespace/name', got '${docker}'`);
		config.docker = docker;
	}
	return config;
}
async function loadConfigFile(path, options) {
	let text;
	try {
		text = await readFile(path, "utf8");
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		if (options.explicit) throw new Error(`config file not found: ${path}`);
		return {
			config: parseConfig(""),
			file: null
		};
	}
	return {
		config: parseConfig(text),
		file: path
	};
}
//#endregion
//#region packages/core/src/glob.ts
const cache = /* @__PURE__ */ new Map();
function globToRegExp(pattern) {
	let re = cache.get(pattern);
	if (!re) {
		const source = pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
		re = new RegExp(`^${source}$`);
		cache.set(pattern, re);
	}
	return re;
}
function matchGlob(name, pattern) {
	return globToRegExp(pattern).test(name);
}
//#endregion
//#region packages/core/src/assets.ts
const IGNORED = "ignored";
const OTHER = "other";
/** Ignored files are checked first, then the first matching group; anything else is `other`. */
function classifyAsset(name, config) {
	if (config.ignore.some((pattern) => matchGlob(name, pattern))) return IGNORED;
	const group = config.groups.find((g) => matchGlob(name, g.assets));
	return group ? group.name : OTHER;
}
/** Without a matching platform rule, the asset name minus the tag, the repo name and archive suffixes. */
function platformLabel(name, tag, repo, rules) {
	const rule = rules.find((r) => matchGlob(name, r.match));
	if (rule) return rule.label;
	let base = name;
	while (/\.(tar\.gz|zip|md5)$/.test(base)) base = base.replace(/\.(tar\.gz|zip|md5)$/, "");
	const repoName = repo.split("/")[1] ?? repo;
	for (const part of [
		tag,
		tag.replace(/^v/, ""),
		repoName
	]) base = base.split(part).join("-");
	return base.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "") || name;
}
//#endregion
//#region packages/core/src/summary.ts
/** Every group name the dataset uses, in config order, plus `other` when some asset matched none. */
function groupNames(config, snapshots) {
	const names = config.groups.map((g) => g.name);
	return snapshots.some((s) => s.releases.some((r) => r.assets.some((a) => classifyAsset(a.name, config) === "other"))) ? [...names, OTHER] : names;
}
/** A counter from `from` on counts only releases at or after that version (and never a non-version tag). */
function isCounted(tag, from) {
	if (from === void 0) return true;
	const version = parseVersion(tag);
	const floor = parseVersion(from);
	return version !== null && floor !== null && compareVersions(version, floor) >= 0;
}
function summariseRelease(release, config, repo, names) {
	const groups = Object.fromEntries(names.map((name) => [name, 0]));
	const files = [];
	for (const asset of release.assets) {
		const group = classifyAsset(asset.name, config);
		files.push({
			name: asset.name,
			label: platformLabel(asset.name, release.tag, repo, config.platforms),
			group,
			downloads: asset.downloads
		});
		if (group !== "ignored") groups[group] = (groups[group] ?? 0) + asset.downloads;
	}
	const counters = {};
	for (const counter of config.counters) {
		const downloads = release.assets.filter((a) => matchGlob(a.name, counter.assets)).reduce((sum, a) => sum + a.downloads, 0);
		counters[counter.name] = {
			downloads,
			counted: isCounted(release.tag, counter.from)
		};
	}
	return {
		groups,
		counters,
		files
	};
}
function summariseDay(snapshot, config, repo, names) {
	const groups = Object.fromEntries(names.map((name) => [name, 0]));
	const counters = Object.fromEntries(config.counters.map((c) => [c.name, 0]));
	for (const release of snapshot.releases) {
		const summary = summariseRelease(release, config, repo, names);
		for (const name of names) groups[name] = (groups[name] ?? 0) + (summary.groups[name] ?? 0);
		for (const [name, counter] of Object.entries(summary.counters)) if (counter.counted) counters[name] = (counters[name] ?? 0) + counter.downloads;
	}
	return {
		date: snapshot.date,
		groups,
		total: Object.values(groups).reduce((sum, n) => sum + n, 0),
		docker: snapshot.docker?.pulls ?? null,
		stars: snapshot.repo.stars,
		forks: snapshot.repo.forks,
		counters
	};
}
//#endregion
//#region packages/core/src/estimate.ts
const DAY_MS$2 = 864e5;
/** Midnight UTC of the day containing `ms`. */
function utcMidnight(ms) {
	return Math.floor(ms / DAY_MS$2) * DAY_MS$2;
}
function utcDate(ms) {
	return new Date(ms).toISOString().slice(0, 10);
}
function median(values) {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
/** One value per UTC day from the first release's day to `now`'s day, inclusive. */
function estimateDaily(releases, names, now) {
	const first = releases[0];
	const d0 = utcMidnight(first ? Date.parse(first.publishedAt) : now);
	const nd = Math.max(1, Math.floor((now - d0) / DAY_MS$2) + 1);
	const groups = Object.fromEntries(names.map((name) => [name, new Array(nd).fill(0)]));
	for (const release of releases) {
		if (release.days <= 0) continue;
		const pub = Date.parse(release.publishedAt);
		const end = Date.parse(release.end);
		for (let i = Math.max(0, Math.floor((pub - d0) / DAY_MS$2)); i < nd; i++) {
			const dayStart = d0 + i * DAY_MS$2;
			if (dayStart >= end) break;
			const overlap = (Math.min(end, dayStart + DAY_MS$2) - Math.max(pub, dayStart)) / DAY_MS$2;
			if (overlap <= 0) continue;
			for (const name of names) groups[name][i] += (release.groups[name] ?? 0) * overlap / release.days;
		}
	}
	return {
		d0,
		daily: {
			start: utcDate(d0),
			groups
		}
	};
}
//#endregion
//#region packages/core/src/periods.ts
const zeros$1 = (names) => Object.fromEntries(names.map((name) => [name, 0]));
function buildPeriods(input) {
	const { releases, epochs, counters, names, d0, daily } = input;
	const nd = Object.values(daily.groups)[0]?.length ?? 0;
	const periods = [];
	for (let epoch = -1; epoch < epochs.length; epoch++) {
		const info = epoch < 0 ? null : epochs[epoch];
		const rs = releases.filter((r) => r.epoch === epoch);
		const first = rs[0];
		const last = rs[rs.length - 1];
		const base = {
			epoch,
			version: info?.version ?? null,
			label: info?.label ?? null
		};
		if (!first || !last) {
			periods.push({
				...base,
				start: null,
				end: null,
				days: 0,
				releases: 0,
				firstTag: null,
				lastTag: null,
				groups: zeros$1(names),
				downloads: 0,
				avgPerDay: zeros$1(names),
				avgPerDayTotal: 0,
				medianPerDay: Object.fromEntries(names.map((name) => [name, null])),
				medianPerDayTotal: null,
				fullDays: 0,
				counters: Object.fromEntries(counters.map((c) => [c.name, {
					downloads: 0,
					counted: false
				}]))
			});
			continue;
		}
		const startMs = Date.parse(first.publishedAt);
		const endMs = Date.parse(last.end);
		const days = (endMs - startMs) / DAY_MS$2;
		const groups = zeros$1(names);
		for (const r of rs) for (const name of names) groups[name] += r.groups[name] ?? 0;
		const downloads = names.reduce((sum, name) => sum + groups[name], 0);
		const i0 = Math.max(0, Math.ceil((startMs - d0) / DAY_MS$2));
		const i1 = Math.min(nd, Math.floor((endMs - d0) / DAY_MS$2));
		const full = [];
		for (let i = i0; i < i1; i++) full.push(i);
		periods.push({
			...base,
			start: first.publishedAt,
			end: last.end,
			days,
			releases: rs.length,
			firstTag: first.tag,
			lastTag: last.tag,
			groups,
			downloads,
			avgPerDay: Object.fromEntries(names.map((name) => [name, days > 0 ? groups[name] / days : 0])),
			avgPerDayTotal: days > 0 ? downloads / days : 0,
			medianPerDay: Object.fromEntries(names.map((name) => [name, median(full.map((i) => daily.groups[name][i]))])),
			medianPerDayTotal: median(full.map((i) => names.reduce((sum, name) => sum + daily.groups[name][i], 0))),
			fullDays: full.length,
			counters: Object.fromEntries(counters.map((c) => {
				let sum = 0;
				let counted = false;
				for (const r of rs) {
					const counter = r.counters[c.name];
					if (counter?.counted) {
						sum += counter.downloads;
						counted = true;
					}
				}
				return [c.name, {
					downloads: sum,
					counted
				}];
			}))
		});
	}
	return periods;
}
//#endregion
//#region packages/core/src/dataset.ts
const zeros = (names) => Object.fromEntries(names.map((name) => [name, 0]));
/** Index of the latest epoch at or before each release. A tag that isn't a version inherits the previous release's. */
function assignEpochs(releases, epochs) {
	let current = -1;
	for (const release of releases) {
		const version = parseVersion(release.tag);
		if (version) {
			current = -1;
			epochs.forEach((epoch, i) => {
				const floor = parseVersion(epoch.version);
				if (floor && compareVersions(version, floor) >= 0) current = i;
			});
		}
		release.epoch = current;
	}
}
function buildReleases(latest, config, repo, names, nowMs) {
	const ordered = [...latest.releases].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
	const rows = ordered.map((release, i) => {
		const pub = Date.parse(release.publishedAt);
		const next = ordered[i + 1];
		const end = Math.max(pub, next ? Date.parse(next.publishedAt) : nowMs);
		const summary = summariseRelease(release, config, repo, names);
		return {
			tag: release.tag,
			publishedAt: release.publishedAt,
			end: new Date(end).toISOString(),
			days: (end - pub) / DAY_MS$2,
			epoch: -1,
			prerelease: release.prerelease,
			groups: summary.groups,
			counters: summary.counters,
			files: summary.files
		};
	});
	assignEpochs(rows, config.epochs);
	return rows;
}
function buildTotals(releases, snapshots, config, names) {
	const groups = zeros(names);
	for (const r of releases) for (const name of names) groups[name] += r.groups[name] ?? 0;
	const latest = snapshots[snapshots.length - 1];
	const counters = {};
	for (const counter of config.counters) {
		let downloads = 0;
		let all = 0;
		for (const r of releases) {
			const c = r.counters[counter.name];
			if (!c) continue;
			all += c.downloads;
			if (c.counted) downloads += c.downloads;
		}
		counters[counter.name] = {
			downloads,
			all
		};
	}
	return {
		groups,
		downloads: names.reduce((sum, name) => sum + groups[name], 0),
		stars: latest.repo.stars,
		forks: latest.repo.forks,
		docker: [...snapshots].reverse().find((s) => s.docker)?.docker?.pulls ?? null,
		counters
	};
}
function buildMeasured(snapshots, config, repo, names) {
	const days = snapshots.map((s) => summariseDay(s, config, repo, names));
	const out = [];
	for (let i = 1; i < days.length; i++) {
		const prev = days[i - 1];
		const cur = days[i];
		out.push({
			date: cur.date,
			days: Math.round((Date.parse(cur.date) - Date.parse(prev.date)) / DAY_MS$2),
			groups: Object.fromEntries(names.map((name) => [name, (cur.groups[name] ?? 0) - (prev.groups[name] ?? 0)])),
			stars: cur.stars - prev.stars,
			docker: cur.docker === null || prev.docker === null ? null : cur.docker - prev.docker,
			counters: Object.fromEntries(Object.keys(cur.counters).map((name) => [name, (cur.counters[name] ?? 0) - (prev.counters[name] ?? 0)]))
		});
	}
	return out;
}
/** Cumulative stars at the end of each UTC day, from the first star to `now`'s day. */
function buildStars(stargazers, nowMs) {
	if (stargazers.length === 0) return [];
	const perDay = /* @__PURE__ */ new Map();
	for (const at of stargazers) {
		const day = utcDate(Date.parse(at));
		perDay.set(day, (perDay.get(day) ?? 0) + 1);
	}
	const first = [...perDay.keys()].sort()[0];
	const last = utcMidnight(nowMs);
	const points = [];
	let stars = 0;
	for (let t = Date.parse(first); t <= last; t += DAY_MS$2) {
		const day = utcDate(t);
		stars += perDay.get(day) ?? 0;
		points.push({
			date: day,
			stars
		});
	}
	return points;
}
function buildDataset(input) {
	const { repo, config } = input;
	const snapshots = [...input.snapshots].sort((a, b) => a.date.localeCompare(b.date));
	const latest = snapshots[snapshots.length - 1];
	if (!latest) throw new Error("buildDataset needs at least one snapshot");
	const names = groupNames(config, snapshots);
	const nowMs = input.now.getTime();
	const releases = buildReleases(latest, config, repo, names, nowMs);
	const { d0, daily } = estimateDaily(releases, names, nowMs);
	const periods = buildPeriods({
		releases,
		epochs: config.epochs,
		counters: config.counters,
		names,
		d0,
		daily
	});
	return {
		repo,
		generatedAt: input.now.toISOString(),
		snapshotAt: latest.takenAt,
		groups: names.map((name, color) => ({
			name,
			label: config.groups.find((g) => g.name === name)?.label ?? (name === "other" ? "Other" : name),
			color
		})),
		epochs: config.epochs.map((e) => ({
			version: e.version,
			label: e.label
		})),
		counters: config.counters.map((c) => ({ ...c })),
		totals: buildTotals(releases, snapshots, config, names),
		releases,
		periods,
		estimatedDaily: daily,
		measuredDaily: buildMeasured(snapshots, config, repo, names),
		stars: buildStars(input.stargazers ?? [], nowMs),
		charts: config.charts,
		...input.traffic ? { traffic: input.traffic } : {}
	};
}
//#endregion
//#region packages/core/src/csv.ts
function cell(value) {
	return value === null || value === void 0 ? "" : String(value);
}
function buildDailyCsv(days, names) {
	const lines = [[
		"date",
		...names.map((n) => `${n}_downloads`),
		"total_downloads",
		"docker_pulls",
		"stars",
		"forks",
		...names.map((n) => `${n}_delta`),
		"total_delta",
		"docker_delta",
		"stars_delta"
	].join(",")];
	days.forEach((day, i) => {
		const prev = days[i - 1];
		const deltas = prev ? [
			...names.map((n) => (day.groups[n] ?? 0) - (prev.groups[n] ?? 0)),
			day.total - prev.total,
			day.docker === null || prev.docker === null ? null : day.docker - prev.docker,
			day.stars - prev.stars
		] : [
			...names.map(() => null),
			null,
			null,
			null
		];
		lines.push([
			day.date,
			...names.map((n) => cell(day.groups[n])),
			cell(day.total),
			cell(day.docker),
			cell(day.stars),
			cell(day.forks),
			...deltas.map(cell)
		].join(","));
	});
	return `${lines.join("\n")}\n`;
}
//#endregion
//#region packages/core/src/store.ts
const SNAPSHOT_RE = /^(\d{4}-\d{2}-\d{2})\.json$/;
/** Where a repo's files live under the data branch root. */
function repoDir(root, repo) {
	const [owner, name] = repo.split("/");
	if (!owner || !name) throw new Error(`repo must be owner/name, got '${repo}'`);
	return join(root, owner, name);
}
async function readJson(path) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
}
async function writeJson(path, value) {
	await mkdir(join(path, ".."), { recursive: true });
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
async function listJson(dir) {
	try {
		return (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
	} catch (error) {
		if (error.code === "ENOENT") return [];
		throw error;
	}
}
/** Writes `snapshots/<date>.json`, replacing a snapshot already taken that day. */
async function writeSnapshot(dir, snapshot) {
	await writeJson(join(dir, "snapshots", `${snapshot.date}.json`), snapshot);
}
/** Every snapshot, oldest first. */
async function readSnapshots(dir) {
	const snapshots = [];
	for (const file of await listJson(join(dir, "snapshots"))) {
		if (!SNAPSHOT_RE.test(file)) continue;
		const snapshot = await readJson(join(dir, "snapshots", file));
		if (snapshot?.schema !== 1) throw new Error(`snapshots/${file}: unsupported schema`);
		snapshots.push(snapshot);
	}
	return snapshots.sort((a, b) => a.date.localeCompare(b.date));
}
async function readStargazers(dir) {
	return await readJson(join(dir, "stargazers.json")) ?? [];
}
async function writeStargazers(dir, starredAt) {
	await writeJson(join(dir, "stargazers.json"), starredAt);
}
async function readTrafficSeries(dir, kind) {
	return await readJson(join(dir, "traffic", `${kind}.json`)) ?? [];
}
async function writeTrafficSeries(dir, kind, days) {
	await writeJson(join(dir, "traffic", `${kind}.json`), days);
}
/** Writes the referrers and paths GitHub reported on `date`. */
async function writeTrafficAggregates(dir, date, aggregates) {
	await writeJson(join(dir, "traffic", "referrers", `${date}.json`), aggregates.referrers);
	await writeJson(join(dir, "traffic", "paths", `${date}.json`), aggregates.paths);
}
/** The traffic a repo has on the branch, or undefined when none was ever collected. */
async function readTraffic(dir) {
	const views = await readJson(join(dir, "traffic", "views.json"));
	if (!views) return void 0;
	const clones = await readTrafficSeries(dir, "clones");
	const latest = (await listJson(join(dir, "traffic", "referrers"))).at(-1);
	const asOf = latest ? latest.replace(/\.json$/, "") : null;
	return {
		views,
		clones,
		referrers: latest ? await readJson(join(dir, "traffic", "referrers", latest)) ?? [] : [],
		paths: latest ? await readJson(join(dir, "traffic", "paths", latest)) ?? [] : [],
		asOf
	};
}
/** The `owner/name` of every repo folder that holds snapshots, sorted. */
async function listRepos(root) {
	const repos = [];
	for (const owner of await listDirs(root)) for (const name of await listDirs(join(root, owner))) if ((await listJson(join(root, owner, name, "snapshots"))).length > 0) repos.push(`${owner}/${name}`);
	return repos;
}
/** Every repo's dataset.json on the branch, for the standalone dashboard. */
async function readDatasets(root) {
	const datasets = [];
	for (const owner of await listDirs(root)) for (const name of await listDirs(join(root, owner))) {
		const dataset = await readJson(join(root, owner, name, "dataset.json"));
		if (dataset) datasets.push(dataset);
	}
	return datasets;
}
async function listDirs(dir) {
	try {
		return (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort();
	} catch (error) {
		if (error.code === "ENOENT") return [];
		throw error;
	}
}
/** Writes the derived files of a repo: dataset.json and daily.csv. */
async function writeDerived(dir, dataset, csv) {
	await writeJson(join(dir, "dataset.json"), dataset);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, "daily.csv"), csv);
}
/** Writes rendered output files under `root`, creating their folders. */
async function writeOutputFiles(root, files) {
	for (const file of files) {
		const path = join(root, file.path);
		await mkdir(join(path, ".."), { recursive: true });
		await writeFile(path, file.encoding === "base64" ? Buffer.from(file.content, "base64") : file.content);
	}
}
//#endregion
//#region packages/core/src/derive.ts
/** Builds the Dataset and daily.csv from the snapshots, stargazers and traffic in `dir` (`<owner>/<repo>/`). */
async function deriveRepo(dir, repo, config, now) {
	const snapshots = await readSnapshots(dir);
	if (snapshots.length === 0) throw new Error(`${repo}: no snapshots in ${dir}`);
	const dataset = buildDataset({
		repo,
		config,
		snapshots,
		stargazers: await readStargazers(dir),
		traffic: await readTraffic(dir),
		now
	});
	const names = groupNames(config, snapshots);
	return {
		dataset,
		csv: buildDailyCsv(snapshots.map((s) => summariseDay(s, config, repo, names)), names)
	};
}
//#endregion
//#region packages/core/src/traffic.ts
/** Days by date; a day fetched again replaces the stored one (its count can still grow). */
function mergeTrafficDays(existing, incoming) {
	const byDate = /* @__PURE__ */ new Map();
	for (const day of existing) byDate.set(day.date, day);
	for (const day of incoming) byDate.set(day.date, day);
	return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
//#endregion
//#region packages/core/src/theme.ts
const INK = {
	light: {
		surface: "#fcfcfb",
		page: "#f6f7f8",
		primary: "#0b0b0b",
		secondary: "#52514e",
		muted: "#6f6e69",
		grid: "#e8eaeb",
		axis: "#dcdedf",
		border: "#dcdedf",
		good: "#1f7a4d",
		warn: "#9a6700"
	},
	dark: {
		surface: "#1a1a19",
		page: "#121314",
		primary: "#f0efec",
		secondary: "#c3c2b7",
		muted: "#a09f98",
		grid: "#2a2b2e",
		axis: "#33343a",
		border: "#33343a",
		good: "#5fc08a",
		warn: "#d9a441"
	}
};
const SERIES = {
	light: [
		"#2a6ddc",
		"#e5642e",
		"#0d9683",
		"#b07c00",
		"#c4497e",
		"#1f861f",
		"#6b58e0",
		"#dc3f3f"
	],
	dark: [
		"#4189ea",
		"#dd5f2f",
		"#1c9f74",
		"#c4860f",
		"#d45287",
		"#2b962b",
		"#9085e9",
		"#e66767"
	]
};
/** A series' colour by its slot; past the last slot there is no hue left, so it takes the last one. */
function seriesColor$1(theme, slot) {
	return SERIES[theme][Math.min(Math.max(0, slot), 7)] ?? INK[theme].muted;
}
/** Font sizes in px, a 1.25 scale from 11 up. */
const TYPE = {
	xs: 11,
	sm: 12,
	md: 13,
	base: 14,
	lg: 16,
	xl: 19,
	xxl: 24,
	hero: 30
};
const FONT = {
	sans: "\"IBM Plex Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif",
	mono: "\"IBM Plex Mono\", ui-monospace, Menlo, Consolas, monospace"
};
/** Mark sizes every chart draws with. */
const MARK = {
	/** A bar never fills its slot past this width. */
	barMax: 24,
	/** The rounded data end of a bar. */
	barRadius: 4,
	/** Surface gap between stacked segments. */
	gap: 2,
	line: 2,
	/** End and hover dots, with a 2px ring in the surface colour. */
	dot: 4,
	/** An area fades from this opacity at its line to nothing at the baseline. */
	areaTop: .22,
	areaBottom: .02,
	/** Stacked bands take a flat wash each instead of a fade. */
	areaStack: .18,
	/** Card corner radius. */
	radius: 12
};
const DAY_MS$1 = 864e5;
/**
* Up to `count` points evenly spaced in time, from the first star's date to the last point's date, each with the
* cumulative count on its day (the last point on or before it, since unchanged days may be missing). Points must be in ascending date order.
*/
function sampleStars(points, count = 30) {
	const first = points[0];
	const last = points.at(-1);
	if (!first || !last) return [];
	const start = Date.parse(first.date);
	const span = Math.round((Date.parse(last.date) - start) / DAY_MS$1);
	const n = Math.max(1, Math.min(count, span + 1));
	const offsets = Array.from({ length: n }, (_, i) => n > 1 ? Math.round(i * span / (n - 1)) : 0);
	let k = 0;
	return offsets.filter((offset, i) => i === 0 || offset !== offsets[i - 1]).map((offset) => {
		const date = new Date(start + offset * DAY_MS$1).toISOString().slice(0, 10);
		while (k + 1 < points.length && points[k + 1].date <= date) k++;
		return {
			date,
			stars: points[k].stars
		};
	});
}
/**
* The monotone cubic through `points` (Fritsch-Carlson, as d3's curveMonotoneX): between two points the
* curve never leaves their range, so a cumulative count never dips or overshoots. The x values must ascend.
*/
function monotoneCurve(points) {
	const n = points.length;
	if (n < 2) return [];
	const slope = points.slice(0, -1).map(([x0, y0], i) => {
		const [x1, y1] = points[i + 1];
		return x1 > x0 ? (y1 - y0) / (x1 - x0) : 0;
	});
	const tangent = new Array(n);
	tangent[0] = slope[0];
	tangent[n - 1] = slope[n - 2];
	for (let i = 1; i < n - 1; i++) {
		const a = slope[i - 1];
		const b = slope[i];
		tangent[i] = a * b <= 0 ? 0 : (a + b) / 2;
	}
	for (let i = 0; i < n - 1; i++) {
		const s = slope[i];
		if (s === 0) {
			tangent[i] = 0;
			tangent[i + 1] = 0;
			continue;
		}
		const a = tangent[i] / s;
		const b = tangent[i + 1] / s;
		const r = a * a + b * b;
		if (r > 9) {
			tangent[i] = 3 / Math.sqrt(r) * a * s;
			tangent[i + 1] = 3 / Math.sqrt(r) * b * s;
		}
	}
	return slope.map((_, i) => {
		const [x0, y0] = points[i];
		const [x1, y1] = points[i + 1];
		const h = (x1 - x0) / 3;
		return {
			from: [x0, y0],
			c1: [x0 + h, y0 + tangent[i] * h],
			c2: [x1 - h, y1 - tangent[i + 1] * h],
			to: [x1, y1]
		};
	});
}
/** The monotone curve as SVG path data (`M` then `C` per segment), coordinates to one decimal. */
function monotonePath(points) {
	const [first] = points;
	if (!first) return "";
	const f = (n) => n.toFixed(1);
	const curves = monotoneCurve(points).map((s) => `C${f(s.c1[0])} ${f(s.c1[1])} ${f(s.c2[0])} ${f(s.c2[1])} ${f(s.to[0])} ${f(s.to[1])}`);
	return `M${f(first[0])} ${f(first[1])}${curves.join("")}`;
}
//#endregion
//#region node_modules/.pnpm/up-fetch@2.6.1/node_modules/up-fetch/dist/index.js
var ResponseError = class extends Error {
	constructor(props) {
		super(props.message);
		this.kind = "response";
		this.data = props.data;
		this.status = props.status;
	}
};
var isResponseError = (error) => error instanceof ResponseError;
var ResponseValidationError = class extends Error {
	constructor(result, data) {
		super(JSON.stringify(result.issues));
		this.kind = "validation";
		this.issues = result.issues;
		this.data = data;
	}
};
var mergeHeaders = (headerInits) => {
	const res = {};
	headerInits.forEach((init) => {
		new Headers(init).forEach((value, key) => {
			value === "null" || value === "undefined" ? delete res[key] : res[key] = value;
		});
	});
	return res;
};
var withTimeout = (signal, timeout) => "any" in AbortSignal ? AbortSignal.any([signal, timeout && AbortSignal.timeout(timeout)].filter(Boolean)) : signal;
var omit = (obj, keys = []) => {
	const copy = { ...obj };
	for (const key in copy) keys.includes(key) && delete copy[key];
	return copy;
};
var isJsonifiable = (value) => isPlainObject(value) || Array.isArray(value) || typeof value?.toJSON === "function";
var isPlainObject = (value) => value && typeof value === "object" && value.constructor?.name === "Object";
var resolveUrl = (base = "", input, defaultOptsParams, fetcherOptsParams, serializeParams) => {
	input = input.href ?? input;
	const qs = serializeParams({
		...omit(defaultOptsParams, [...new URL(input, "http://a").searchParams.keys()]),
		...fetcherOptsParams
	});
	let url = /^https?:\/\//.test(input) ? input : !base || !input ? base + input : base.replace(/\/$/, "") + "/" + input.replace(/^\//, "");
	if (qs) url += (url.includes("?") ? "&" : "?") + qs.replace(/^\?/, "");
	return url;
};
var abortableDelay = (delay, signal) => new Promise((resolve, reject) => {
	signal?.addEventListener("abort", handleAbort, { once: true });
	const token = setTimeout(() => {
		signal?.removeEventListener("abort", handleAbort);
		resolve();
	}, delay);
	function handleAbort() {
		clearTimeout(token);
		reject(signal.reason);
	}
});
async function validate(schema, data) {
	const result = await schema["~standard"].validate(data);
	if (result.issues) throw new ResponseValidationError(result, data);
	return result.value;
}
var fallbackOptions = {
	parseResponse: (res) => res.clone().json().catch(() => res.text()).then((data) => data || null),
	parseRejected: async (response, request) => new ResponseError({
		message: `[${response.status}] ${response.statusText}`,
		status: response.status,
		data: await fallbackOptions.parseResponse(response, request)
	}),
	serializeParams: (params) => new URLSearchParams(JSON.parse(JSON.stringify(params))).toString(),
	serializeBody: (body) => isJsonifiable(body) ? JSON.stringify(body) : body,
	reject: (response) => !response.ok,
	retry: {
		when: (ctx) => ctx.response?.ok === false,
		attempts: 0,
		delay: 0
	}
};
var isWebkit = typeof window !== "undefined" && /AppleWebKit/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
async function toStreamable(reqOrRes, onChunk) {
	const isResponse = "ok" in reqOrRes;
	if (isWebkit && !isResponse || !onChunk || !reqOrRes.clone().body) return reqOrRes;
	const contentLength = reqOrRes.headers.get("content-length");
	let totalBytes = contentLength ? +contentLength : void 0;
	if (!isResponse && !contentLength) totalBytes = (await reqOrRes.clone().arrayBuffer()).byteLength;
	let transferredBytes = 0;
	await onChunk({
		totalBytes,
		transferredBytes,
		chunk: /* @__PURE__ */ new Uint8Array()
	}, reqOrRes);
	const stream = new ReadableStream({ async start(controller) {
		const reader = reqOrRes.body.getReader();
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			transferredBytes += value.byteLength;
			await onChunk({
				totalBytes,
				transferredBytes,
				chunk: value
			}, reqOrRes);
			controller.enqueue(value);
		}
		controller.close();
	} });
	return isResponse ? new Response(stream, reqOrRes) : new Request(reqOrRes, {
		body: stream,
		duplex: "half"
	});
}
var emptyOptions = {};
var up = (fetchFn, getDefaultOptions = () => emptyOptions) => async (input, fetcherOpts = emptyOptions, ctx) => {
	const defaultOpts = await getDefaultOptions(input, fetcherOpts, ctx);
	const options = {
		...fallbackOptions,
		...defaultOpts,
		...fetcherOpts,
		...emptyOptions,
		retry: {
			...fallbackOptions.retry,
			...defaultOpts.retry,
			...fetcherOpts.retry
		}
	};
	options.body = fetcherOpts.body === null || fetcherOpts.body === void 0 ? fetcherOpts.body : options.serializeBody(fetcherOpts.body);
	options.headers = mergeHeaders([
		isJsonifiable(fetcherOpts.body) && typeof options.body === "string" ? { "content-type": "application/json" } : {},
		defaultOpts.headers,
		fetcherOpts.headers
	]);
	let attempt = 0;
	let request;
	let response;
	let error;
	do {
		options.signal = withTimeout(fetcherOpts.signal, options.timeout);
		request = await toStreamable(new Request(input.url ? input : resolveUrl(options.baseUrl, input, defaultOpts.params, fetcherOpts.params, options.serializeParams), options), fetcherOpts.onRequestStreaming);
		try {
			await defaultOpts.onRequest?.(request);
			await fetcherOpts.onRequest?.(request);
			response = await toStreamable(await fetchFn(request, {
				...omit(options, ["body"]),
				headers: request.headers
			}, ctx), fetcherOpts.onResponseStreaming);
			error = void 0;
		} catch (e) {
			error = e;
		}
		try {
			if (!await options.retry.when({
				request,
				response,
				error
			}) || ++attempt > (typeof options.retry.attempts === "function" ? await options.retry.attempts({ request }) : options.retry.attempts)) break;
			const retryCtx = {
				attempt,
				request,
				response,
				error
			};
			await abortableDelay(typeof options.retry.delay === "function" ? await options.retry.delay(retryCtx) : options.retry.delay, options.signal);
			await defaultOpts.onRetry?.(retryCtx);
			await fetcherOpts.onRetry?.(retryCtx);
		} catch (e) {
			error = e;
			break;
		}
	} while (true);
	try {
		if (error) throw error;
		await defaultOpts.onResponse?.(response, request);
		await fetcherOpts.onResponse?.(response, request);
		if (await options.reject(response)) throw await options.parseRejected(response, request);
		const parsed = await options.parseResponse(response, request);
		const data = options.schema ? await validate(options.schema, parsed) : parsed;
		await defaultOpts.onSuccess?.(data, request);
		await fetcherOpts.onSuccess?.(data, request);
		return data;
	} catch (error2) {
		await defaultOpts.onError?.(error2, request);
		await fetcherOpts.onError?.(error2, request);
		throw error2;
	}
};
//#endregion
//#region packages/core/src/collectors/client.ts
const USER_AGENT = "github-stats-action";
function createClient(options) {
	return up(options.fetch, () => ({
		baseUrl: options.baseUrl,
		headers: {
			"User-Agent": USER_AGENT,
			...options.headers
		}
	}));
}
/** The GitHub REST client; `token` is optional, since public counts need no auth. */
function githubClient(fetchFn, token) {
	return createClient({
		fetch: fetchFn,
		baseUrl: "https://api.github.com",
		headers: {
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			...token ? { Authorization: `Bearer ${token}` } : {}
		}
	});
}
//#endregion
//#region packages/core/src/collectors/github.ts
const PER_PAGE = 100;
async function fetchRepoCounts(api, repo) {
	const info = await api(`/repos/${repo}`);
	return {
		stars: info.stargazers_count,
		forks: info.forks_count,
		watchers: info.subscribers_count,
		openIssues: info.open_issues_count
	};
}
/** Every published release, paging until a short page. Drafts are skipped. */
async function fetchReleases(api, repo) {
	const releases = [];
	for (let page = 1;; page++) {
		const batch = await api(`/repos/${repo}/releases`, { params: {
			per_page: PER_PAGE,
			page
		} });
		for (const r of batch) {
			if (r.draft || !r.published_at) continue;
			releases.push({
				tag: r.tag_name,
				publishedAt: r.published_at,
				prerelease: r.prerelease,
				assets: r.assets.map((a) => ({
					name: a.name,
					downloads: a.download_count
				}))
			});
		}
		if (batch.length < PER_PAGE) break;
	}
	return releases;
}
/** Starred-at timestamps from position `from` on, plus the one before it. Stops at GitHub's 422 limit. */
async function listStarredFrom(api, repo, from) {
	const start = Math.max(from - 1, 0);
	const startPage = Math.floor(start / PER_PAGE) + 1;
	const skip = start - (startPage - 1) * PER_PAGE;
	const starredAt = [];
	let previous;
	for (let page = startPage;; page++) {
		let batch;
		try {
			batch = await api(`/repos/${repo}/stargazers`, {
				params: {
					per_page: PER_PAGE,
					page
				},
				headers: { Accept: "application/vnd.github.star+json" }
			});
		} catch (error) {
			if (isResponseError(error) && error.status === 422) return {
				starredAt,
				previous,
				limited: true
			};
			throw error;
		}
		let stamps = batch.map((s) => s.starred_at);
		if (page === startPage) {
			stamps = stamps.slice(skip);
			if (from > 0) previous = stamps.shift();
		}
		starredAt.push(...stamps);
		if (batch.length < PER_PAGE) return {
			starredAt,
			previous,
			limited: false
		};
	}
}
async function fetchStargazers(api, repo, known, total, log) {
	const incremental = await listStarredFrom(api, repo, known.length);
	if (incremental.limited) log.warning(`stargazers: GitHub stops listing past ${known.length + incremental.starredAt.length} stars; keeping those`);
	let stargazers = [...known, ...incremental.starredAt];
	const aligned = known.length === 0 || incremental.previous === known[known.length - 1];
	if (incremental.limited || aligned && stargazers.length === total) {
		log.info(`stargazers: ${incremental.starredAt.length} new, ${stargazers.length} stored`);
		return stargazers;
	}
	log.info("stargazers: the stored list no longer matches GitHub, refetching all of it");
	const full = await listStarredFrom(api, repo, 0);
	if (full.limited) log.warning(`stargazers: GitHub stops listing past ${full.starredAt.length} stars; keeping the stored list`);
	else stargazers = full.starredAt;
	log.info(`stargazers: ${stargazers.length} stored`);
	return stargazers;
}
const TRAFFIC_403 = "traffic: GitHub refused the request (403). Collecting traffic needs a token with push access to the repo (a PAT); GITHUB_TOKEN gets 403 there.";
const day = (timestamp) => timestamp.slice(0, 10);
/** Reduces GitHub's traffic payloads to the stored shapes (days keyed by date). */
function toTrafficResponse(raw) {
	return {
		views: raw.views.views.map((v) => ({
			date: day(v.timestamp),
			count: v.count,
			uniques: v.uniques
		})),
		clones: raw.clones.clones.map((c) => ({
			date: day(c.timestamp),
			count: c.count,
			uniques: c.uniques
		})),
		referrers: raw.referrers.map((r) => ({
			referrer: r.referrer,
			count: r.count,
			uniques: r.uniques
		})),
		paths: raw.paths.map((p) => ({
			path: p.path,
			title: p.title,
			count: p.count,
			uniques: p.uniques
		}))
	};
}
/** Views, clones and the two popular-* aggregates. A 403 fails with a message about the token. */
async function fetchTraffic(api, repo) {
	const get = (path) => api(`/repos/${repo}/traffic/${path}`).catch((error) => {
		if (isResponseError(error) && error.status === 403) throw new Error(TRAFFIC_403);
		throw error;
	});
	const [views, clones, referrers, paths] = await Promise.all([
		get("views"),
		get("clones"),
		get("popular/referrers"),
		get("popular/paths")
	]);
	return toTrafficResponse({
		views,
		clones,
		referrers,
		paths
	});
}
//#endregion
//#region packages/core/src/collectors/docker.ts
/** Pulls of `namespace/name`, or undefined (after a warning) when Docker Hub doesn't answer. */
async function fetchDockerPulls(api, image, log) {
	try {
		return (await api(`/v2/repositories/${image}/`)).pull_count;
	} catch (error) {
		log.warning(`docker hub: ${image} pulls not collected (${error.message})`);
		return;
	}
}
//#endregion
//#region packages/action/src/branch.ts
const execFileAsync = promisify(execFile);
/** The stored files of a repo: snapshots, stargazers and traffic. */
const DATA_PATH = /^[^/]+\/[^/]+\/(snapshots\/[^/]+\.json|stargazers\.json|traffic\/.+\.json)$/;
/** Copies the data files of `ref` (in the git repo at `cwd`) under `dest`, keeping their paths. */
async function exportBranchData(ref, cwd, dest) {
	const paths = (await execFileAsync("git", [
		"ls-tree",
		"-r",
		"--name-only",
		"--end-of-options",
		ref
	], {
		cwd,
		maxBuffer: 67108864
	}).catch((error) => {
		throw new Error(`git: cannot read ref '${ref}': ${error.message.split("\n")[0]}`);
	})).stdout.split("\n").filter((p) => DATA_PATH.test(p));
	for (const path of paths) {
		const { stdout } = await execFileAsync("git", [
			"show",
			"--end-of-options",
			`${ref}:${path}`
		], {
			cwd,
			maxBuffer: 67108864
		});
		const target = join(dest, path);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, stdout);
	}
	return paths.length;
}
//#endregion
//#region packages/badges/src/format.ts
const SUFFIXES = [
	"",
	"k",
	"M",
	"B"
];
/** Verdana advance widths in 1/1000 em for printable ASCII (space to ~). */
const EM_WIDTHS = {
	" ": 352,
	"!": 455,
	"\"": 548,
	"#": 838,
	$: 636,
	"%": 950,
	"&": 684,
	"'": 230,
	"(": 456,
	")": 456,
	"*": 518,
	"+": 838,
	",": 364,
	"-": 363,
	".": 364,
	"/": 454,
	"0": 636,
	"1": 636,
	"2": 636,
	"3": 636,
	"4": 636,
	"5": 636,
	"6": 636,
	"7": 636,
	"8": 636,
	"9": 636,
	":": 455,
	";": 455,
	"<": 838,
	"=": 838,
	">": 838,
	"?": 575,
	"@": 1e3,
	A: 684,
	B: 686,
	C: 698,
	D: 770,
	E: 632,
	F: 575,
	G: 775,
	H: 752,
	I: 297,
	J: 556,
	K: 655,
	L: 556,
	M: 863,
	N: 748,
	O: 787,
	P: 603,
	Q: 787,
	R: 695,
	S: 635,
	T: 611,
	U: 732,
	V: 684,
	W: 989,
	X: 685,
	Y: 611,
	Z: 685,
	"[": 455,
	"\\": 454,
	"]": 455,
	"^": 838,
	_: 500,
	"`": 606,
	a: 602,
	b: 623,
	c: 552,
	d: 623,
	e: 596,
	f: 352,
	g: 623,
	h: 634,
	i: 274,
	j: 274,
	k: 579,
	l: 274,
	m: 974,
	n: 634,
	o: 608,
	p: 623,
	q: 623,
	r: 411,
	s: 521,
	t: 392,
	u: 634,
	v: 592,
	w: 818,
	x: 591,
	y: 592,
	z: 525,
	"{": 455,
	"|": 455,
	"}": 455,
	"~": 838
};
/** Width of characters outside the table (non-ASCII letters, mostly). */
const DEFAULT_EM = 600;
/** Compact count: `999`, `1.2k`, `12.2k`, `123k`, `1.2M`, one decimal below 100 of a unit. */
function formatCompact(value) {
	if (!Number.isFinite(value) || value < 0) throw new RangeError(`not a count: ${value}`);
	let scaled = Math.round(value);
	let unit = 0;
	while (scaled >= 1e3 && unit < SUFFIXES.length - 1) {
		scaled /= 1e3;
		unit++;
	}
	const text = scaled < 100 ? String(Math.round(scaled * 10) / 10) : String(Math.round(scaled));
	if (Number(text) >= 1e3 && unit < SUFFIXES.length - 1) return `1${SUFFIXES[unit + 1]}`;
	return `${text}${SUFFIXES[unit]}`;
}
/** Estimated rendered width of `text` at `FONT_SIZE`, in px. */
function textWidth$1(text) {
	let em = 0;
	for (const char of text) em += EM_WIDTHS[char] ?? DEFAULT_EM;
	return em * 11 / 1e3;
}
/** Lowercase, dash-separated, for file names: `In-app updates` becomes `in-app-updates`. */
function slug(text) {
	return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
/** Escapes text for XML element content and double-quoted attributes. */
function escapeXml(text) {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&apos;");
}
//#endregion
//#region packages/badges/src/svg.ts
/** The shields.io colour names that can appear in a badge's `color`, as hex. */
const NAMED_COLORS = {
	brightgreen: "4c1",
	green: "97ca00",
	yellowgreen: "a4a61d",
	yellow: "dfb317",
	orange: "fe7d37",
	red: "e05d44",
	blue: "007ec6",
	grey: "555",
	gray: "555",
	lightgrey: "9f9f9f",
	success: "4c1",
	important: "fe7d37",
	critical: "e05d44",
	informational: "007ec6",
	inactive: "9f9f9f"
};
const HEIGHT$1 = 20;
const LABEL_FILL = "#555";
/** A shields.io colour name or a hex code without '#', as a `#` colour. */
function svgColor(color) {
	const hex = NAMED_COLORS[color] ?? color;
	if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) throw new Error(`not a badge colour: ${color}`);
	return `#${hex}`;
}
function flatSvg(badge) {
	const aria = escapeXml(`${badge.label}: ${badge.message}`);
	const labelText = Math.round(textWidth$1(badge.label) * 10) / 10;
	const messageText = Math.round(textWidth$1(badge.message) * 10) / 10;
	const labelBox = Math.round(labelText + 10);
	const messageBox = Math.round(messageText + 10);
	const width = labelBox + messageBox;
	const parts = [{
		x: labelBox / 2,
		value: escapeXml(badge.label),
		length: labelText
	}, {
		x: labelBox + messageBox / 2,
		value: escapeXml(badge.message),
		length: messageText
	}];
	const shadow = parts.map((p) => `<text aria-hidden="true" x="${p.x}" y="15" fill="#010101" fill-opacity=".3" textLength="${p.length}">${p.value}</text>`);
	const foreground = parts.map((p) => `<text x="${p.x}" y="14" textLength="${p.length}">${p.value}</text>`);
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT$1}" role="img" aria-label="${aria}">`,
		`<title>${aria}</title>`,
		"<linearGradient id=\"s\" x2=\"0\" y2=\"100%\"><stop offset=\"0\" stop-color=\"#bbb\" stop-opacity=\".1\"/><stop offset=\"1\" stop-opacity=\".1\"/></linearGradient>",
		`<clipPath id="r"><rect width="${width}" height="${HEIGHT$1}" rx="3" fill="#fff"/></clipPath>`,
		`<g clip-path="url(#r)"><rect width="${labelBox}" height="${HEIGHT$1}" fill="${LABEL_FILL}"/><rect x="${labelBox}" width="${messageBox}" height="${HEIGHT$1}" fill="${svgColor(badge.color)}"/><rect width="${width}" height="${HEIGHT$1}" fill="url(#s)"/></g>`,
		`<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">`,
		...shadow,
		...foreground,
		"</g>",
		"</svg>",
		""
	].join("\n");
}
//#endregion
//#region packages/badges/src/badges.ts
/** Default colour per kind of badge; configurable later. */
const COLORS = {
	total: "blue",
	group: "brightgreen",
	release: "orange",
	stars: "yellow",
	docker: "2496ed",
	counter: "8957e5"
};
/** Every badge for the dataset, in display order. Latest release is skipped when no stable one exists. */
function buildBadges(dataset) {
	const { totals } = dataset;
	const badges = [{
		name: "downloads",
		label: "downloads",
		message: formatCompact(totals.downloads),
		color: COLORS.total
	}, ...(dataset.groups.length < 2 ? [] : dataset.groups).map((group) => ({
		name: `downloads-${slug(group.name)}`,
		label: `downloads (${group.label})`,
		message: formatCompact(totals.groups[group.name] ?? 0),
		color: COLORS.group
	}))];
	const latest = dataset.releases.filter((release) => !release.prerelease).at(-1);
	if (latest) {
		const downloads = Object.values(latest.groups).reduce((sum, count) => sum + count, 0);
		badges.push({
			name: "release-latest",
			label: `${latest.tag} downloads`,
			message: formatCompact(downloads),
			color: COLORS.release
		});
	}
	badges.push({
		name: "stars",
		label: "stars",
		message: formatCompact(totals.stars),
		color: COLORS.stars
	});
	if (totals.docker !== null) badges.push({
		name: "docker-pulls",
		label: "docker pulls",
		message: formatCompact(totals.docker),
		color: COLORS.docker
	});
	for (const counter of dataset.counters) badges.push({
		name: `counter-${slug(counter.name)}`,
		label: counter.label,
		message: formatCompact(totals.counters[counter.name]?.downloads ?? 0),
		color: COLORS.counter
	});
	return badges;
}
/** The shields.io endpoint JSON (https://shields.io/badges/endpoint-badge). */
function endpointJson(badge) {
	return `${JSON.stringify({
		schemaVersion: 1,
		label: badge.label,
		message: badge.message,
		color: badge.color
	})}\n`;
}
/** Badges for one repo; paths are relative to `<owner>/<repo>/`. */
function renderBadges(dataset) {
	return buildBadges(dataset).flatMap((badge) => [{
		path: `badges/${badge.name}.json`,
		content: endpointJson(badge)
	}, {
		path: `badges/${badge.name}.svg`,
		content: flatSvg(badge)
	}]);
}
//#endregion
//#region packages/dashboard/src/embedded.ts
const PAGES_FILES = {
	"assets/index-BQba7rNW.js": "var e={\"&\":`&amp;`,\"<\":`&lt;`,\">\":`&gt;`,'\"':`&quot;`,\"'\":`&#39;`},t=e=>(Math.round(e)||0).toLocaleString(`en-US`),n=e=>e==null?`—`:e.toLocaleString(`en-US`,{minimumFractionDigits:1,maximumFractionDigits:1}),r=e=>e==null?`—`:(e>0?`+`:``)+t(e),i=(e,n)=>`${t(e)} ${n}${e===1?``:`s`}`,a=(e,t)=>`${t>0?Math.round(e/t*100):0}%`,o=t=>t.replace(/[&<>\"']/g,t=>e[t]??t),s=e=>e.slice(0,10),c=`ignored`;function l(e){return e.groups.filter(e=>e.name!==c)}function u(e,t){return e.epoch>=0?t[e.epoch]?.label??e.version??``:t.length?`Before ${t[0].version}`:`All releases`}function d(e,t){return e.epoch>=0?e.version??``:t.length?`<${t[0].version}`:`all`}function f(e,t){let n=new Map;for(let r of e.releases)for(let e of r.files)e.group===t&&n.set(e.label,(n.get(e.label)??0)+e.downloads);return[...n.entries()].sort((e,t)=>t[1]-e[1])}function p(e){let t=[];for(let n of l(e)){let r=f(e,n.name).map(([e,t])=>({key:`${n.name}\\u0001${e}`,group:n,label:e,downloads:t}));t.push(...r)}return t}function m(e){let t=new Map;for(let n of e.files)t.set(`${n.group}\\u0001${n.label}`,n.downloads);return t}var h=864e5,g=[`Jan`,`Feb`,`Mar`,`Apr`,`May`,`Jun`,`Jul`,`Aug`,`Sep`,`Oct`,`Nov`,`Dec`];function _(e){return v(e).long(0)}function v(e){let t=Date.parse(`${e}T00:00:00Z`),n=e=>new Date(t+e*h),r=e=>`${g[n(e).getUTCMonth()]} ${n(e).getUTCDate()}`;return{indexOf:e=>Math.round((e-t)/h),date:n,iso:e=>n(e).toISOString().slice(0,10),short:r,long:e=>`${r(e)}, ${n(e).getUTCFullYear()}`,monthYear:e=>`${g[n(e).getUTCMonth()]} ${n(e).getUTCFullYear()}`,year:e=>n(e).getUTCFullYear(),month:e=>n(e).getUTCFullYear()*12+n(e).getUTCMonth()}}function y(e,t,n,r){let i=n-t,a=[];if(i<=45){let o=Math.ceil(i/r);for(let r=t+o;r<=n;r+=o)a.push([r,e.short(r)])}else if(i<=400){let i=[];for(let r=e.month(t)+1;r<=e.month(n);r++){let a=e.indexOf(Date.UTC(Math.floor(r/12),r%12,1));a>t&&a<=n&&i.push([r,a])}let o=[1,2,3,6,12].find(e=>i.filter(([t])=>t%e===0).length<=r)??12;i.filter(([e])=>e%o===0).forEach(([e,t],n)=>a.push([t,n===0||e%12==0?`${g[e%12]} ${Math.floor(e/12)}`:g[e%12]]))}else{let i=[];for(let r=e.year(t)+1;r<=e.year(n);r++){let a=e.indexOf(Date.UTC(r,0,1));a>t&&a<=n&&i.push([r,a])}let o=[1,2,5].find(e=>i.filter(([t])=>t%e===0).length<=r)??5;i.filter(([e])=>e%o===0).forEach(([e,t])=>a.push([t,String(e)]))}return a}function b(e,t,n,r){let i=Math.min(n-1,Math.max(r,Math.round(t-e))),a=Math.max(0,Math.min(Math.round(e),n-1-i));return{a,b:a+i}}function x(e,t,n,r,i){let a=Math.round(n);return b(e-t*a,e-t*a+a,r,i)}function S(e,t){return e?Math.max(0,t-e):0}function C(e){let t=Math.max(1,e),n=10**Math.floor(Math.log10(t));for(let e of[1,1.5,2,2.5,3,4,5,6,8,10])if(e*n>=t)return e*n;return 10*n}function w(e){return C(Math.ceil(Math.max(4,e)/4))*4}function T(e,t=4){let n=e/t;return Array.from({length:t+1},(e,t)=>n*t)}function E(e){return`var(--c${Math.min(Math.max(0,e.color),7)})`}var D=`http://www.w3.org/2000/svg`;function O(e,t={},n){let r=document.createElementNS(D,e);for(let e of Object.keys(t))r.setAttribute(e,String(t[e]));return n?.appendChild(r),r}function k(e,t,n){e.setAttribute(`viewBox`,`0 0 ${t} ${n}`),e.setAttribute(`width`,String(t)),e.setAttribute(`height`,String(n)),e.replaceChildren()}function A(e,t=300){return Math.max(t,(e.parentElement?.clientWidth??t)-4)}function j(e,t,n,r,i){let a=Math.min(i,r,n/2);return`M${e},${t+r}V${t+a}Q${e},${t} ${e+a},${t}H${e+n-a}Q${e+n},${t} ${e+n},${t+a}V${t+r}Z`}function ee(e,t,n,r=.22){let i=e.querySelector(`defs`)??O(`defs`,{},e),a=O(`linearGradient`,{id:t,x1:0,y1:0,x2:0,y2:1},i);return O(`stop`,{\"stop-color\":n,\"stop-opacity\":r},a),O(`stop`,{offset:1,\"stop-color\":n,\"stop-opacity\":.02},a),`url(#${t})`}function M(e,t,n,r,i,a){for(let o of t)O(`line`,{x1:r,x2:i,y1:n(o),y2:n(o),class:o===0?`base`:`axis`},e),O(`text`,{x:r-8,y:n(o)+4,\"text-anchor\":`end`},e).textContent=a(o)}function N(e,t,n,r,i){return O(`rect`,{x:t,y:n,width:Math.max(0,r),height:Math.max(0,i),fill:`transparent`},e)}var P=`tipzone`;function F(){return document.getElementById(`tip`)}function I(e,t){let n=F();n.innerHTML=e,n.style.display=`block`;let r=n.offsetWidth,i=n.offsetHeight,a=t.clientX+14,o=t.clientY+14;a+r>innerWidth-8&&(a=t.clientX-r-14),o+i>innerHeight-8&&(o=t.clientY-i-14),n.style.left=`${Math.max(8,a)}px`,n.style.top=`${Math.max(8,o)}px`}function L(){F().style.display=`none`}function R(e,t){e.classList.add(P),e.addEventListener(`pointermove`,e=>t(e)),e.addEventListener(`pointerdown`,e=>t(e)),e.addEventListener(`pointerleave`,e=>{e.pointerType!==`touch`&&L()})}function z(){document.addEventListener(`pointerdown`,e=>{let t=e.target;e.pointerType===`touch`&&!t.closest?.(`.${P}`)&&L()})}function B(e){let t=document.createElement(`section`);return t.innerHTML=e,t}function V(e){if(e.length<2)return``;let t=e.map(e=>e.dashed?`<i class=\"line\" style=\"background:${e.color}\"></i>`:`<i class=\"sw\" style=\"background:${e.color}\"></i>`);return`<div class=\"legend\">${e.map((e,n)=>`<span>${t[n]}${o(e.label)}</span>`).join(``)}</div>`}var H=6,te=10,ne=[[`All`,0],[`1y`,365],[`90d`,90],[`30d`,30]],re={l:`ew-resize`,r:`ew-resize`,pan:`grab`,new:`crosshair`};function ie(e){let r=l(e),i=r.map(t=>e.estimatedDaily.groups[t.name]??[]),a=Math.max(0,...i.map(e=>e.length));if(a===0)return{el:B(`<div><h2>Downloads per day over time</h2><p class=\"note\">Nothing to estimate yet.</p></div>`)};let s=v(e.estimatedDaily.start),c=`<thead><tr><th>Day</th>${r.map(e=>`<th>${o(e.label)}</th>`).join(``)}</tr></thead><tbody>`+Array.from({length:a},(e,t)=>`<tr><td>${o(s.long(t))}</td>${i.map(e=>`<td>${n(e[t]??0)}</td>`).join(``)}</tr>`).join(``)+`</tbody>`,u=B(`<div><h2>Downloads per day over time<span class=\"est\">estimated</span></h2><p class=\"note\">Uniform-spread estimate: a release's downloads are assumed to arrive at a constant rate while it was the latest release, so the lines step at each release and cannot show spikes inside a window. Hover for a day. Drag the strip below to choose the range; wheel or pinch over the chart to zoom, double-click to reset.</p></div><div class=\"presets\"><span class=\"group\" data-presets></span></div>`+V(r.map(e=>({label:e.label,color:E(e)})))+`<div class=\"scroll\"><svg data-chart role=\"img\" aria-label=\"Estimated downloads per day over time, by group\"></svg></div><div class=\"scroll\"><svg data-strip role=\"img\" aria-label=\"Overview of the whole series with the range shown above\"></svg></div><details><summary>Table view</summary><div class=\"scroll\"><table>${c}</table></div></details>`),d=u.querySelector(`[data-chart]`),f=u.querySelector(`[data-strip]`),p=u.querySelector(`[data-presets]`),m={a:0,b:a-1},h={W:0,left:0,right:0},g={W:0,left:0,right:0},_=e=>{m=b(e.a,e.b,a,H),F(),U(),P()},D=ne.map(([e,t])=>{let n=document.createElement(`button`);return n.type=`button`,n.textContent=e,n.addEventListener(`click`,()=>_({a:S(t,a),b:a-1})),p.appendChild(n),n}),j=document.createElement(`span`);j.className=`note`,p.parentElement.appendChild(j);let P=()=>{let e=!1;ne.forEach(([,t],n)=>{let r=!e&&m.a===S(t,a)&&m.b===a-1;e||=r,D[n].setAttribute(`aria-pressed`,String(r))}),j.textContent=`${s.long(m.a)} to ${s.long(m.b)}`};P();let F=()=>{let e=A(d),a=Math.max(0,...r.map(e=>e.label.length*6.5)),c={l:44,r:Math.min(Math.round(a)+20,Math.round(e*.3)),t:16,b:28},{a:l,b:u}=m,f=Math.max(1,u-l),p=e-c.l-c.r;k(d,e,280),h={W:e,left:c.l,right:c.r};let g=w(Math.max(1,...i.flatMap(e=>e.slice(l,u+1)))),_=e=>c.l+p*(e-l)/f,v=e=>c.t+(280-c.t-c.b)*(1-e/g);M(d,T(g),v,c.l,e-c.r,t),f>400&&(O(`text`,{x:c.l,y:272},d).textContent=String(s.year(l)));for(let[e,t]of y(s,l,u,Math.max(2,Math.floor(p/72))))f>400&&_(e)<c.l+30||(O(`text`,{x:_(e),y:272,\"text-anchor\":`middle`},d).textContent=t,O(`line`,{x1:_(e),x2:_(e),y1:v(0),y2:v(0)+4,class:`axis`},d));[...r.entries()].reverse().forEach(([e,t])=>{let n=i[e]??[],r=E(t),a=n.slice(l,u+1).map((e,t)=>`${_(l+t).toFixed(1)},${v(e).toFixed(1)}`).join(`L`);O(`path`,{d:`M${_(l)},${v(0)}L${a}L${_(u)},${v(0)}Z`,fill:ee(d,`estimated-fade-${e}`,r)},d),O(`path`,{d:`M${a}`,fill:`none`,stroke:r,\"stroke-width\":2,\"stroke-linejoin\":`round`,\"stroke-linecap\":`round`},d),O(`circle`,{cx:_(u),cy:v(n[u]??0),r:4,fill:r,stroke:`var(--surface)`,\"stroke-width\":2},d)});let b=r.map((e,t)=>({g:e,y:v(i[t]?.[u]??0)})).sort((e,t)=>e.y-t.y);b.forEach((e,t)=>{let n=b[t-1];n&&e.y-n.y<13&&(e.y=n.y+13)});for(let t of b){let n=_(u),r=n+10+t.g.label.length*6.5>e-2;O(`text`,{x:r?n-10:n+10,y:Math.min(280-c.b-4,t.y+4),class:`ink`,\"text-anchor\":r?`end`:`start`},d).textContent=t.g.label}let x=O(`line`,{y1:c.t,y2:v(0),class:`base`,visibility:`hidden`},d),S=r.map(e=>O(`circle`,{r:4,fill:E(e),stroke:`var(--surface)`,\"stroke-width\":2,visibility:`hidden`},d)),C=N(d,c.l,c.t,p,280-c.t-c.b);R(C,e=>{let t=e.clientX-d.getBoundingClientRect().left,a=Math.max(l,Math.min(u,Math.round(l+(t-c.l)/p*f)));x.setAttribute(`x1`,String(_(a))),x.setAttribute(`x2`,String(_(a))),x.setAttribute(`visibility`,`visible`),i.forEach((e,t)=>{S[t]?.setAttribute(`cx`,String(_(a))),S[t]?.setAttribute(`cy`,String(v(e[a]??0))),S[t]?.setAttribute(`visibility`,`visible`)});let m=r.map((e,t)=>`${o(e.label)}: ${n(i[t]?.[a]??0)}/day (est.)`);I(`<b>${o(s.long(a))}</b><br>${m.join(`<br>`)}`,e)}),C.addEventListener(`pointerleave`,()=>{x.setAttribute(`visibility`,`hidden`),S.forEach(e=>e.setAttribute(`visibility`,`hidden`))})},L=()=>g.W-g.left-g.right,z=e=>g.left+L()*e/Math.max(1,a-1),ie=e=>(e-g.left)*Math.max(1,a-1)/L(),U=()=>{let e=A(f),t={l:44,r:44,t:4,b:4};k(f,e,56),g={W:e,left:t.l,right:t.r};let n=C(Math.max(1,...i.flat())),o=e=>t.t+(56-t.t-t.b)*(1-e/n);r.forEach((e,t)=>{let n=(i[t]??[]).map((e,t)=>`${z(t).toFixed(1)},${o(e).toFixed(1)}`).join(`L`);O(`path`,{d:`M${z(0)},${o(0)}L${n}L${z(a-1)},${o(0)}Z`,fill:E(e),\"fill-opacity\":.16},f),O(`path`,{d:`M${n}`,fill:`none`,stroke:E(e),\"stroke-opacity\":.7,\"stroke-width\":1,\"stroke-linejoin\":`round`},f)}),O(`line`,{x1:t.l,x2:e-t.r,y1:o(0)+.5,y2:o(0)+.5,class:`base`},f);let s=z(m.a),c=z(m.b);O(`rect`,{x:t.l,y:0,width:s-t.l,height:56,fill:`var(--surface)`,\"fill-opacity\":.72},f),O(`rect`,{x:c,y:0,width:e-t.r-c,height:56,fill:`var(--surface)`,\"fill-opacity\":.72},f),O(`rect`,{x:s+.5,y:.5,width:Math.max(0,c-s-1),height:55,fill:`none`,stroke:`var(--ink2)`,\"stroke-opacity\":.6,\"stroke-width\":1,rx:3},f);for(let e of[s,c])O(`rect`,{x:e-3.5,y:18,width:7,height:20,rx:3.5,fill:`var(--ink2)`,stroke:`var(--surface)`,\"stroke-width\":1.5},f)},W=e=>{let t=z(m.a),n=z(m.b),r=Math.min(te,(n-t)/3),i=Math.abs(e-t),a=Math.abs(e-n);return Math.min(i,a)<=r?i<=a?`l`:`r`:e>t&&e<n?`pan`:`new`},G=(e,t)=>t.clientX-e.getBoundingClientRect().left,K=null;f.addEventListener(`pointerdown`,e=>{let t=G(f,e);K={mode:W(t),px0:t,a0:m.a,b0:m.b,anchor:Math.max(0,Math.min(a-1,Math.round(ie(t))))},f.setPointerCapture(e.pointerId)}),f.addEventListener(`pointermove`,e=>{let t=G(f,e);if(!K){f.style.cursor=re[W(t)];return}let n=Math.round(ie(t)),r=Math.round((t-K.px0)*(a-1)/L()),{a0:i,b0:o,anchor:s}=K;K.mode===`pan`?_({a:i+r,b:o+r}):K.mode===`l`?_({a:Math.min(Math.max(0,n),o-H),b:o}):K.mode===`r`?_({a:i,b:Math.max(Math.min(a-1,n),i+H)}):_(n>=s?{a:s,b:Math.max(n,s+H)}:{a:Math.min(n,s-H),b:s})});let q=()=>{K=null};f.addEventListener(`pointerup`,q),f.addEventListener(`pointercancel`,q);let J=()=>_({a:0,b:a-1});f.addEventListener(`dblclick`,J),d.addEventListener(`dblclick`,J);let Y=e=>Math.max(m.a,Math.min(m.b,m.a+(e-h.left)/(h.W-h.left-h.right)*(m.b-m.a)));d.addEventListener(`wheel`,e=>{e.preventDefault();let t=m.b-m.a,n=Y(G(d,e)),r=(n-m.a)/t,i=Math.round(t*Math.exp(e.deltaY*(e.deltaMode?.04:.002)));i===t&&e.deltaY&&(i=t+Math.sign(e.deltaY)),_(x(n,r,i,a,H))},{passive:!1});let X=new Map,Z=null,ae=()=>{let[e,t]=[...X.values()];return{px:(e.x+t.x)/2-d.getBoundingClientRect().left,d:Math.hypot(e.x-t.x,e.y-t.y)}};d.addEventListener(`pointerdown`,e=>{if(e.pointerType===`touch`&&(X.set(e.pointerId,{x:e.clientX,y:e.clientY}),X.size===2)){let e=ae();if(e.d>0){let t=m.b-m.a,n=Y(e.px);Z={d:e.d,len:t,centre:n,t:(n-m.a)/t}}}}),d.addEventListener(`pointermove`,e=>{if(X.has(e.pointerId)&&(X.set(e.pointerId,{x:e.clientX,y:e.clientY}),Z&&X.size===2)){let e=ae();e.d>0&&_(x(Z.centre,Z.t,Z.len*Z.d/e.d,a,H))}});let oe=e=>{X.delete(e.pointerId),X.size<2&&(Z=null)};return d.addEventListener(`pointerup`,oe),d.addEventListener(`pointercancel`,oe),{el:u,redraw:()=>{F(),U()}}}function U(e){let n=e.measuredDaily.at(-1),i=[],a=l(e);i.push({label:`All-time downloads`,value:e.totals.downloads,change:n?a.reduce((e,t)=>e+(n.groups[t.name]??0),0):null});for(let t of a)i.push({label:t.label,value:e.totals.groups[t.name]??0,change:n?n.groups[t.name]??0:null,swatch:E(t)});e.totals.docker!==null&&i.push({label:`Docker pulls`,value:e.totals.docker,change:n?n.docker:null});for(let t of e.counters)i.push({label:t.label,value:e.totals.counters[t.name]?.downloads??0,change:n?n.counters[t.name]??0:null,note:t.from?`Counted from ${t.from}`:void 0});i.push({label:`GitHub stars`,value:e.totals.stars,change:n?n.stars:null});let s=B(`<div class=\"kpis\">${i.map(e=>{let i=!n||e.change===null?`<div class=\"d\">no change data</div>`:`<div class=\"d\"><b class=\"${e.change>0?`pos`:``}\">${r(e.change)}</b> on <span class=\"nw\">${o(n.date)}</span>${n.days>1?` (over ${n.days} days)`:``}</div>`,a=e.swatch?`<i class=\"sw\" style=\"background:${e.swatch}\"></i>`:``,s=e.note?`<div class=\"note\">${o(e.note)}</div>`:``;return`<div class=\"kpi\"><div class=\"l\">${a}${o(e.label)}</div><div class=\"v\">${t(e.value)}</div>${i}${s}</div>`}).join(``)}</div>`);return s.className=`kpis-wrap`,{el:s}}function W(e){let t=e[0];if(!t)return null;let n=v(t.date),r=new Map;for(let t of e)r.set(n.indexOf(Date.parse(`${t.date}T00:00:00Z`)),t);return{axis:n,last:Math.max(...r.keys()),byDay:r}}function G(e,t,n=56){let r=t<8,i=[],a=-1/0;for(let o=0;o<=e.last;o++){if(r&&e.axis.date(o).getUTCDate()!==1)continue;let s=o*t;s-a<n||(a=s,i.push(o))}return i}function K(e,t,n){if(n>=8)return e.axis.short(t);let r=e.axis.date(t),i=e.axis.short(t).split(` `)[0];return r.getUTCMonth()===0?`${i} ${r.getUTCFullYear()}`:i}function q(e,t,n=2){let r=e.map(e=>Math.max(0,e)),i=-1;r.forEach((e,t)=>{e>0&&(i=t)});let a=[],o=0;return r.forEach((e,r)=>{if(e<=0)return;let s=t(o),c=t(o+e),l=r===i,u=l?c:Math.min(c+n,s-1);a.push({index:r,y:u,height:s-u,top:l}),o+=e}),a}var J=240,Y={l:44,r:44,t:26,b:28},X=3;function Z(e){let t=l(e),n=e.measuredDaily,i=W(n),a=n.some(e=>e.docker!==null),s=V([...t.map(e=>({label:e.label,color:E(e)})),...a?[{label:`Docker pulls (right axis)`,color:`var(--muted)`,dashed:!0}]:[]]),c=n[0],u=c?`Measured from the daily snapshots that started on ${_(v(c.date).iso(-c.days))}; it gains a bar every day.`:`Needs two daily snapshots; the first bar appears after the next one.`,d=`<table>${`<thead><tr><th>Day</th>${t.map(e=>`<th>${o(e.label)}</th>`).join(``)}<th>Total</th>`+(a?`<th>Docker</th>`:``)+`<th>Stars</th>`+e.counters.map(e=>`<th>${o(e.label)}</th>`).join(``)+`</tr></thead>`}<tbody>${n.map(n=>{let i=t.reduce((e,t)=>e+(n.groups[t.name]??0),0);return`<tr><td>${o(_(n.date))}${n.days>1?`<small>over ${n.days} days</small>`:``}</td>`+t.map(e=>`<td>${r(n.groups[e.name]??0)}</td>`).join(``)+`<td>${r(i)}</td>`+(a?`<td>${r(n.docker)}</td>`:``)+`<td>${r(n.stars)}</td>`+e.counters.map(e=>`<td>${r(n.counters[e.name]??0)}</td>`).join(``)+`</tr>`}).join(``)}</tbody></table>`,f=B(`<div><h2>Measured downloads per day<span class=\"est meas\">measured</span></h2><p class=\"note\">${o(u)}</p></div>`+(n.length?s:``)+`<div class=\"scroll\" data-chart${n.length?``:` hidden`}><svg role=\"img\" aria-label=\"Measured downloads per day by group, with Docker pulls on a right axis\"></svg></div><div class=\"scroll\" data-table${n.length&&n.length<X?``:` hidden`}>${d}</div>`),p=f.querySelector(`svg`);return{el:f,redraw:()=>{i&&ae(p,e,i,a)}}}function ae(e,n,r,i){let a=l(n),s=A(e);k(e,s,J);let c=r.last+1,u=(s-Y.l-Y.r)/c,d=Math.max(1,Math.min(24,u-2)),f=e=>Y.l+u*(e+.5),p=e=>Math.max(0,e??0),m=[...r.byDay.entries()],h=w(Math.max(0,...m.map(([,e])=>a.reduce((t,n)=>t+p(e.groups[n.name]),0)))),g=w(Math.max(0,...m.map(([,e])=>p(e.docker)))),_=e=>Y.t+(J-Y.t-Y.b)*(1-e/h),v=e=>Y.t+(J-Y.t-Y.b)*(1-e/g);if(M(e,T(h),_,Y.l,s-Y.r,t),O(`text`,{x:2,y:Y.t-10,class:`ink`},e).textContent=`downloads`,i){for(let n of T(g))O(`text`,{x:s-Y.r+8,y:v(n)+4},e).textContent=t(n);O(`text`,{x:s-2,y:Y.t-10,\"text-anchor\":`end`},e).textContent=`Docker`}for(let[t,n]of m){let r=f(t)-d/2;for(let t of q(a.map(e=>p(n.groups[e.name])),_)){let n=a[t.index];n&&(t.top?O(`path`,{d:j(r,t.y,d,t.height,4),fill:E(n)},e):O(`rect`,{x:r,y:t.y,width:d,height:t.height,fill:E(n)},e))}}if(i){let t=``,n=!1;for(let e=0;e<=r.last;e++){let i=r.byDay.get(e);!i||i.docker===null?n=!1:(t+=`${n?`L`:`M`}${f(e).toFixed(1)},${v(p(i.docker)).toFixed(1)}`,n=!0)}if(O(`path`,{d:t,fill:`none`,stroke:`var(--muted)`,\"stroke-width\":2,\"stroke-linejoin\":`round`,\"stroke-linecap\":`round`},e),u>=8)for(let[t,n]of m)n.docker!==null&&O(`circle`,{cx:f(t),cy:v(p(n.docker)),r:4,fill:`var(--muted)`,stroke:`var(--surface)`,\"stroke-width\":2},e)}for(let t of G(r,u))O(`text`,{x:f(t),y:232,\"text-anchor\":`middle`},e).textContent=K(r,t,u);for(let t=0;t<=r.last;t++){let i=r.byDay.get(t);R(N(e,Y.l+u*t,Y.t,u,J-Y.t-Y.b),e=>I(i?oe(i,n):`<b>${o(r.axis.long(t))}</b><br>No snapshot that day`,e))}}function oe(e,t){let n=l(t),i=n.reduce((t,n)=>t+(e.groups[n.name]??0),0),a=[...e.days>1?[`Change over ${e.days} days`]:[],...n.map(t=>`${o(t.label)}: ${r(e.groups[t.name]??0)}`),`Total: ${r(i)}`,`Docker: ${r(e.docker)}`,`Stars: ${r(e.stars)}`,...t.counters.map(t=>`${o(t.label)}: ${r(e.counters[t.name]??0)}`)];return`<b>${o(_(e.date))}</b><br>${a.join(`<br>`)}`}function se(e){let r=l(e),i=e.counters,a=e=>`<td>${e}</td>`,s=`<thead><tr><th>Period</th><th>Releases</th>${r.map(e=>`<th>${o(e.label)}</th>`).join(``)}<th>Total</th>`+i.map(e=>`<th>${o(e.label)}</th>`).join(``)+r.map(e=>`<th>Avg/day ${o(e.label)}</th>`).join(``)+`<th>Avg/day all</th>`+r.map(e=>`<th>Median/day ${o(e.label)}</th>`).join(``)+`<th>Median/day all</th></tr></thead>`,c=e.periods.map(s=>{let c=s.releases===0,l=s.firstTag===null?``:`<small>${o(s.firstTag)}${s.lastTag&&s.lastTag!==s.firstTag?` to ${o(s.lastTag)}`:``}</small>`;return`<tr><td>${o(u(s,e.epochs))}${l}</td><td>${s.releases}</td>`+r.map(e=>a(t(s.groups[e.name]??0))).join(``)+a(`<b>${t(s.downloads)}</b>`)+i.map(e=>{let n=s.counters[e.name];return a(n?.counted?t(n.downloads):`—`)}).join(``)+r.map(e=>a(c?`—`:n(s.avgPerDay[e.name]??0))).join(``)+a(c?`—`:n(s.avgPerDayTotal))+r.map(e=>a(n(s.medianPerDay[e.name]??null))).join(``)+a(n(s.medianPerDayTotal))+`</tr>`}),d=2*r.length+2,f=`<tr><td><b>All time</b></td><td>${e.releases.length}</td>`+r.map(n=>a(`<b>${t(e.totals.groups[n.name]??0)}</b>`)).join(``)+a(`<b>${t(e.totals.downloads)}</b>`)+i.map(n=>a(t(e.totals.counters[n.name]?.downloads??0))).join(``)+`<td colspan=\"${d}\"></td></tr>`,p=e.periods.at(-1),m=p&&p.releases>0&&p.fullDays===0?`<p class=\"note\">Medians show a dash for ${o(u(p,e.epochs))}: it has no whole calendar day yet, and its average per day extrapolates a short window.</p>`:``,h=V(r.map(e=>({label:e.label,color:E(e)}))),g=B(`<div><h2>Periods<span class=\"est\">estimated</span></h2><p class=\"note\">GitHub only exposes cumulative counts per file, so per-day figures are estimates: each release's downloads are spread evenly over the days it was the latest release (until the next release, or now). Totals are exact. Medians are over whole calendar days (UTC) inside the period.</p></div><div class=\"scroll\"><table class=\"periods\">${s}<tbody>${c.join(``)}${f}</tbody></table></div>${m}${h}<div class=\"scroll\"><svg role=\"img\" aria-label=\"Average estimated downloads per day by period\"></svg></div>`),_=g.querySelector(`svg`),v=g.querySelector(`.scroll`);return v.addEventListener(`scroll`,()=>ce(v)),{el:g,redraw:()=>{ce(v),le(_,e)}}}function ce(e){e.classList.toggle(`more`,e.scrollWidth-e.clientWidth-e.scrollLeft>1)}function le(e,r){let a=l(r),s=r.periods,c=A(e),f={l:44,r:16,t:26,b:58};k(e,c,230);let p=w(Math.max(0,...s.flatMap(e=>a.map(t=>e.avgPerDay[t.name]??0)))),m=e=>f.t+(230-f.t-f.b)*(1-e/p),h=(c-f.l-f.r)/Math.max(1,s.length);M(e,T(p),m,f.l,c-f.r,t),O(`text`,{x:f.l,y:10,class:`ink`},e).textContent=`Average estimated downloads per day`,s.forEach((s,c)=>{let l=f.l+h*(c+.5),p=Math.min(36,(h-8)/Math.max(1,a.length));a.forEach((i,c)=>{let d=s.avgPerDay[i.name]??0,f=l-a.length*p/2+c*p+1,h=m(0)-m(d);if(h<=0)return;let g=O(`path`,{d:j(f,m(d),p-2,h,4),fill:E(i)},e);O(`text`,{x:f+(p-2)/2,y:m(d)-6,\"text-anchor\":`middle`,class:`ink`},e).textContent=n(d),R(g,e=>I(`<b>${o(u(s,r.epochs))}</b><br>${o(i.label)}: ${n(d)}/day avg (est.)<br>${t(s.groups[i.name]??0)} downloads over ${s.days.toFixed(1)} ${s.days===1?`day`:`days`}`,e))}),O(`text`,{x:l,y:230-f.b+16,\"text-anchor\":`middle`,class:`ink`},e).textContent=d(s,r.epochs);let g=i(s.releases,`release`);g.length*6.5<=h?O(`text`,{x:l,y:230-f.b+30,\"text-anchor\":`middle`},e).textContent=g:(O(`text`,{x:l,y:230-f.b+30,\"text-anchor\":`middle`},e).textContent=t(s.releases),O(`text`,{x:l,y:230-f.b+44,\"text-anchor\":`middle`},e).textContent=s.releases===1?`release`:`releases`)})}function ue(e){return{el:B(`<div><h2>Platforms</h2><p class=\"note\">All-time downloads by file, summed over every release. Ignored files are excluded.</p></div><div class=\"cols\">${l(e).map(n=>{let r=f(e,n.name),i=Math.max(1,...r.map(([,e])=>e)),s=r.reduce((e,[,t])=>e+t,0),c=r.map(([e,r])=>`<div class=\"brow\"><span>${o(e)}</span><span class=\"t\"><i style=\"width:${r/i*100}%;background:${E(n)}\"></i></span><span>${t(r)} <small style=\"color:var(--muted)\">${a(r,s)}</small></span></div>`);return`<div><h2 style=\"font-size:14px;margin-bottom:8px\"><i class=\"sw\" style=\"background:${E(n)}\"></i>${o(n.label)}</h2><div class=\"bars\">${c.join(``)||`<p class=\"note\">No downloads yet.</p>`}</div></div>`}).join(``)}</div>`)}}var de=6,Q={l:44,r:12,t:56,b:58},fe=2,pe=14,$=300;function me(e){let r=l(e);if(e.releases.length===0)return{el:B(`<div><h2>Downloads per release</h2><p class=\"note\">No releases yet.</p></div>`)};let i=`<thead><tr><th>Release</th><th>Published</th><th>Live days</th>${r.map(e=>`<th>${o(e.label)}</th>`).join(``)}<th>Total</th>`+e.counters.map(e=>`<th>${o(e.label)}</th>`).join(``)+r.map(e=>`<th>${o(e.label)}/day</th>`).join(``)+`</tr></thead>`,a=e.releases.slice().reverse().map(i=>{let a=e.counters.map(e=>{let n=i.counters[e.name];return`<td>${n?.counted?t(n.downloads):`—`}</td>`}).join(``),c=r.map(e=>`<td>${i.days<1?`—`:n((i.groups[e.name]??0)/i.days)}</td>`).join(``),l=Object.values(i.groups).reduce((e,t)=>e+t,0);return`<tr><td>${o(i.tag)}</td><td>${s(i.publishedAt)}</td><td>${n(i.days)}</td>`+r.map(e=>`<td>${t(i.groups[e.name]??0)}</td>`).join(``)+`<td><b>${t(l)}</b></td>${a}${c}</tr>`}),c=B(`<div><h2>Downloads per release</h2><p class=\"note\">Total downloads of each release's files, oldest to newest. Markers show where an epoch starts. Recent releases have had less time to collect downloads. The per-day columns show a dash for releases that were the latest for under a day, since their downloads mostly came after they were replaced.</p></div>${V(r.map(e=>({label:e.label,color:E(e)})))}<div class=\"scroll\"><svg role=\"img\" aria-label=\"Stacked downloads per release by group\"></svg></div><details><summary>Table view</summary><div class=\"scroll\"><table>${i}<tbody>${a.join(``)}</tbody></table></div>`+ge(e)+`</details>`),u=c.querySelector(`svg`);return{el:c,redraw:()=>he(u,e)}}function he(e,n){let r=l(n),i=n.releases,a=A(e,Q.l+Q.r+de*i.length);k(e,a,$);let o=C(Math.max(0,...i.map(e=>_e(e,r)))),s=e=>Q.t+($-Q.t-Q.b)*(1-e/o),c=(a-Q.l-Q.r)/i.length,u=Math.min(32,Math.max(2,c-2)),d=c>=64,f=d?1:Math.max(1,Math.ceil(14/c));M(e,T(o),s,Q.l,a-Q.r,t),i.forEach((t,i)=>{let a=Q.l+c*i+(c-u)/2,o=q(r.map(e=>t.groups[e.name]??0),s);for(let t of o){let n=r[t.index];n&&(t.top?O(`path`,{d:j(a,t.y,u,t.height,4),fill:E(n)},e):O(`rect`,{x:a,y:t.y,width:u,height:t.height,fill:E(n)},e))}if(i%f===0){let n=d?O(`text`,{x:Q.l+c*(i+.5),y:$-Q.b+18,\"text-anchor\":`middle`},e):O(`text`,{transform:`translate(${Q.l+c*(i+.5)+3},${$-Q.b+10}) rotate(-60)`,\"text-anchor\":`end`},e);n.textContent=t.tag}R(N(e,Q.l+c*i,Q.t,c,$-Q.t-Q.b),e=>I(ve(t,n),e))});let p=-1,m=[];i.forEach((t,r)=>{if(t.epoch<0||t.epoch===p)return;p=t.epoch;let i=Q.l+c*r,o=n.epochs[t.epoch]?.version??``,l=o.length*6.5,u=Array.from({length:fe},(e,t)=>t).flatMap(e=>[{x:i+7,anchor:`start`,from:i+7,to:i+7+l},{x:i-7,anchor:`end`,from:i-7-l,to:i-7}].filter(t=>t.from>=2&&t.to<=a-2&&!m.some(n=>n.tier===e&&t.from<n.to+8&&n.from<t.to+8)).map(t=>({...t,tier:e})))[0],d=Q.t-12-(u?.tier??0)*pe;r>0&&(O(`line`,{x1:i,x2:i,y1:d,y2:s(0),class:`sep`},e),O(`circle`,{cx:i,cy:d,r:2.5,class:`cap`},e)),u&&(m.push({from:u.from,to:u.to,tier:u.tier}),O(`text`,{x:u.x,y:d+4,class:`ink`,\"text-anchor\":u.anchor},e).textContent=o)})}function ge(e){let t=e.counters.filter(e=>e.from).map(e=>`${o(e.label)} counts from ${o(e.from??``)}; earlier releases show a dash.`);return t.length?`<p class=\"note\">${t.join(` `)}</p>`:``}function _e(e,t){return t.reduce((t,n)=>t+(e.groups[n.name]??0),0)}function ve(e,n){let r=l(n),i=r.map(n=>`${o(n.label)}: ${t(e.groups[n.name]??0)}`),a=n.counters.filter(t=>e.counters[t.name]?.counted).map(n=>`${o(n.label)}: ${t(e.counters[n.name].downloads)}`);return`<b>${o(e.tag)}</b> ${s(e.publishedAt)}<br>${[...i,`Total: ${t(_e(e,r))}`,...a,`Live ${e.days.toFixed(1)} ${e.days===1?`day`:`days`}`].join(`<br>`)}`}function ye(e){let t=l(e),n=e.measuredDaily.some(e=>e.docker!==null),i=`<thead><tr><th>Date</th><th>Days</th>${t.map(e=>`<th>${o(e.label)} +</th>`).join(``)}<th>Total +</th>`+(n?`<th>Docker +</th>`:``)+`<th>Stars +</th>`+e.counters.map(e=>`<th>${o(e.label)} +</th>`).join(``)+`</tr></thead>`,a=e.measuredDaily.slice().reverse().map(i=>{let a=t.reduce((e,t)=>e+(i.groups[t.name]??0),0),s=e=>`<td class=\"${e!==null&&e>0?`pos`:``}\">${r(e)}</td>`;return`<tr><td>${o(i.date)}</td><td>${i.days}</td>`+t.map(e=>s(i.groups[e.name]??0)).join(``)+s(a)+(n?s(i.docker):``)+s(i.stars)+e.counters.map(e=>s(i.counters[e.name]??0)).join(``)+`</tr>`});return{el:B(`<div><h2>Daily snapshots<span class=\"est meas\">measured</span></h2><p class=\"note\">The change since the previous snapshot, dated by the later one. A day count above 1 means snapshots were missed in between. This table grows by a row every day.</p></div>`+(a.length?`<div class=\"scroll\"><table>${i}<tbody>${a.join(``)}</tbody></table></div>`:`<p class=\"note\">No change to show yet.</p>`))}}var be=864e5;function xe(e,t=30){let n=e[0],r=e.at(-1);if(!n||!r)return[];let i=Date.parse(n.date),a=Math.round((Date.parse(r.date)-i)/be),o=Math.max(1,Math.min(t,a+1)),s=Array.from({length:o},(e,t)=>o>1?Math.round(t*a/(o-1)):0),c=0;return s.filter((e,t)=>t===0||e!==s[t-1]).map(t=>{let n=new Date(i+t*be).toISOString().slice(0,10);for(;c+1<e.length&&e[c+1].date<=n;)c++;return{date:n,stars:e[c].stars}})}function Se(e){let t=e.length;if(t<2)return[];let n=e.slice(0,-1).map(([t,n],r)=>{let[i,a]=e[r+1];return i>t?(a-n)/(i-t):0}),r=Array(t);r[0]=n[0],r[t-1]=n[t-2];for(let e=1;e<t-1;e++){let t=n[e-1],i=n[e];r[e]=t*i<=0?0:(t+i)/2}for(let e=0;e<t-1;e++){let t=n[e];if(t===0){r[e]=0,r[e+1]=0;continue}let i=r[e]/t,a=r[e+1]/t,o=i*i+a*a;o>9&&(r[e]=3/Math.sqrt(o)*i*t,r[e+1]=3/Math.sqrt(o)*a*t)}return n.map((t,n)=>{let[i,a]=e[n],[o,s]=e[n+1],c=(o-i)/3;return{from:[i,a],c1:[i+c,a+r[n]*c],c2:[o-c,s-r[n+1]*c],to:[o,s]}})}function Ce(e){let[t]=e;if(!t)return``;let n=e=>e.toFixed(1),r=Se(e).map(e=>`C${n(e.c1[0])} ${n(e.c1[1])} ${n(e.c2[0])} ${n(e.c2[1])} ${n(e.to[0])} ${n(e.to[1])}`);return`M${n(t[0])} ${n(t[1])}${r.join(``)}`}var we=240,Te=60;function Ee(e,n){let r=A(e),i=we,a={l:44,r:16,t:16,b:28};k(e,r,i);let{axis:s,samples:c,xs:l,color:u}=n,d=c.length;if(d===0)return;let f=l[0],p=Math.max(f+1,l[d-1]),m=r-a.l-a.r,h=e=>a.l+m*(e-f)/(p-f),g=w(Math.max(0,...c.map(e=>e.stars))),_=e=>a.t+(i-a.t-a.b)*(1-e/g),v=_(0);M(e,T(g),_,a.l,r-a.r,t),O(`text`,{x:h(f),y:232,\"text-anchor\":`start`},e).textContent=s.monthYear(f);for(let[t,n]of y(s,f,p,Math.max(2,Math.floor(m/72))))h(t)-h(f)<Te||(O(`text`,{x:h(t),y:232,\"text-anchor\":`middle`},e).textContent=n);let b=Ce(c.map((e,t)=>[h(l[t]),_(e.stars)])),x=h(l[d-1]);O(`path`,{d:`${b}L${x.toFixed(1)},${v.toFixed(1)}L${h(f).toFixed(1)},${v.toFixed(1)}Z`,fill:ee(e,`${n.id}-fade`,u)},e),O(`path`,{d:b,fill:`none`,stroke:u,\"stroke-width\":2,\"stroke-linejoin\":`round`,\"stroke-linecap\":`round`},e),c.slice(0,-1).forEach((t,n)=>{O(`circle`,{cx:h(l[n]),cy:_(t.stars),r:3,fill:u,stroke:`var(--surface)`,\"stroke-width\":2},e)});let S=_(c[d-1].stars);O(`circle`,{cx:x,cy:S,r:4,fill:u,stroke:`var(--surface)`,\"stroke-width\":2},e),O(`text`,{x:x-8,y:Math.max(a.t+10,S-10),\"text-anchor\":`end`,class:`strong`},e).textContent=t(c[d-1].stars);let C=O(`line`,{y1:a.t,y2:v,class:`base`,visibility:`hidden`},e),E=O(`circle`,{r:4,fill:u,stroke:`var(--surface)`,\"stroke-width\":2,visibility:`hidden`},e),D=O(`rect`,{x:a.l,y:a.t,width:m,height:i-a.t-a.b,fill:`transparent`},e);R(D,n=>{let r=n.clientX-e.getBoundingClientRect().left,i=f+(r-a.l)/m*(p-f),u=0;l.forEach((e,t)=>{Math.abs(e-i)<Math.abs(l[u]-i)&&(u=t)});let d=c[u];C.setAttribute(`x1`,String(h(l[u]))),C.setAttribute(`x2`,String(h(l[u]))),C.setAttribute(`visibility`,`visible`),E.setAttribute(`cx`,String(h(l[u]))),E.setAttribute(`cy`,String(_(d.stars))),E.setAttribute(`visibility`,`visible`),I(`<b>${o(s.long(l[u]))}</b><br>${t(d.stars)} ${d.stars===1?`star`:`stars`}`,n)}),D.addEventListener(`pointerleave`,e=>{e.pointerType!==`touch`&&(C.setAttribute(`visibility`,`hidden`),E.setAttribute(`visibility`,`hidden`))})}var De=240,Oe=60;function ke(e,n){let r=A(e),i=De,a={l:44,r:16,t:16,b:28};k(e,r,i);let s=n.xs[0]??0,c=Math.max(s+1,n.xs[n.xs.length-1]??s+1),l=r-a.l-a.r,u=e=>a.l+l*(e-s)/(c-s),d=w(Math.max(0,...n.series.flatMap(e=>e.values.map(e=>e??0)))),f=e=>a.t+(i-a.t-a.b)*(1-e/d);M(e,T(d),f,a.l,r-a.r,t),n.startLabel&&(O(`text`,{x:u(s),y:232,\"text-anchor\":`start`},e).textContent=n.axis.monthYear(s));for(let[t,r]of y(n.axis,s,c,Math.max(2,Math.floor(l/72))))n.startLabel&&u(t)-u(s)<Oe||(O(`text`,{x:u(t),y:232,\"text-anchor\":`middle`},e).textContent=r);let p=n.series.length===1;n.series.forEach((r,i)=>{let o=``,s=!1;if(n.xs.forEach((e,t)=>{let n=r.values[t];n==null?s=!1:(o+=`${s?`L`:`M`}${u(e).toFixed(1)},${f(n).toFixed(1)}`,s=!0)}),!o)return;p&&O(`path`,{d:o.split(`M`).filter(Boolean).map(e=>{let t=e.split(`L`),[n]=t[0].split(`,`),[r]=t[t.length-1].split(`,`);return`M${n},${f(0).toFixed(1)}L${e}L${r},${f(0).toFixed(1)}Z`}).join(``),fill:ee(e,`${n.id}-fade-${i}`,r.color)},e),O(`path`,{d:o,fill:`none`,stroke:r.color,\"stroke-width\":2,\"stroke-linejoin\":`round`,\"stroke-linecap\":`round`},e);let l=r.values.length-1,d=r.values[l];if(p&&d!=null){let i=u(n.xs[l]??c),o=f(d);O(`circle`,{cx:i,cy:o,r:4,fill:r.color,stroke:`var(--surface)`,\"stroke-width\":2},e),O(`text`,{x:i-8,y:Math.max(a.t+10,o-10),\"text-anchor\":`end`,class:`strong`},e).textContent=t(d)}});let m=O(`line`,{y1:a.t,y2:f(0),class:`base`,visibility:`hidden`},e),h=n.series.map(t=>O(`circle`,{r:4,fill:t.color,stroke:`var(--surface)`,\"stroke-width\":2,visibility:`hidden`},e)),g=O(`rect`,{x:a.l,y:a.t,width:l,height:i-a.t-a.b,fill:`transparent`},e);R(g,r=>{let i=r.clientX-e.getBoundingClientRect().left,d=s+(i-a.l)/l*(c-s),p=0;n.xs.forEach((e,t)=>{Math.abs(e-d)<Math.abs((n.xs[p]??0)-d)&&(p=t)});let g=n.xs[p]??s;m.setAttribute(`x1`,String(u(g))),m.setAttribute(`x2`,String(u(g))),m.setAttribute(`visibility`,`visible`),n.series.forEach((e,t)=>{let n=e.values[p],r=h[t];r&&(r.setAttribute(`cx`,String(u(g))),r.setAttribute(`cy`,String(f(n??0))),r.setAttribute(`visibility`,n==null?`hidden`:`visible`))});let _=n.series.map(e=>{let r=e.values[p],i=r===1?n.unit.one:n.unit.other;return`${o(e.label)}: ${r==null?`—`:t(r)} ${o(i)}`});I(`<b>${o(n.axis.long(g))}</b><br>${_.join(`<br>`)}`,r)}),g.addEventListener(`pointerleave`,e=>{e.pointerType!==`touch`&&(m.setAttribute(`visibility`,`hidden`),h.forEach(e=>e.setAttribute(`visibility`,`hidden`)))})}var Ae=`stars-view`,je=[[`daily`,`Daily`],[`sampled`,`Sampled`]];function Me(){try{return localStorage.getItem(Ae)===`sampled`?`sampled`:`daily`}catch{return`daily`}}function Ne(e){try{localStorage.setItem(Ae,e)}catch{}}function Pe(e){let n=e.stars;if(n.length===0)return{el:B(`<div><h2>Stars over time</h2><p class=\"note\">No stargazers collected yet.</p></div>`)};let r={daily:`Cumulative stars at the end of each UTC day, from the stargazers' timestamps. Hover or tap for a day.`,sampled:`Cumulative stars at about 30 points along the history, from the stargazers' timestamps. Hover or tap a point for its date.`},i=v(n[0].date),a=n.map(e=>i.indexOf(Date.parse(`${e.date}T00:00:00Z`))),s=n.map(e=>e.stars),c=E({color:0}),l=xe(n),u=l.map(e=>i.indexOf(Date.parse(`${e.date}T00:00:00Z`))),d=new Map;for(let e of n)d.set(e.date.slice(0,7),e);let f=B(`<div><h2>Stars over time</h2><p class=\"note\" data-note></p></div><div class=\"presets\"><span class=\"group\" role=\"group\" aria-label=\"Chart view\" data-views></span></div><div class=\"scroll\"><svg role=\"img\" aria-label=\"Cumulative stars over time\"></svg></div><details><summary>Table view</summary><div class=\"scroll\"><table>${`<thead><tr><th>Month</th><th>Stars at month end</th></tr></thead><tbody>`+[...d.values()].map(e=>`<tr><td>${o(e.date.slice(0,7))}</td><td>${t(e.stars)}</td></tr>`).join(``)+`</tbody>`}</table></div></details>`),p=f.querySelector(`svg`),m=f.querySelector(`[data-views]`),h=f.querySelector(`[data-note]`),g=Me(),_=()=>{h.textContent=r[g],g===`sampled`?Ee(p,{id:`stars`,axis:i,samples:l,xs:u,color:c}):ke(p,{id:`stars`,xs:a,axis:i,series:[{label:`Stars`,color:c,values:s}],unit:{one:`star`,other:`stars`},startLabel:!0})},y=je.map(([e,t])=>{let n=document.createElement(`button`);return n.type=`button`,n.textContent=t,n.addEventListener(`click`,()=>{g=e,Ne(e),b(),_()}),m.appendChild(n),n}),b=()=>{je.forEach(([e],t)=>y[t].setAttribute(`aria-pressed`,String(g===e)))};return b(),{el:f,redraw:_}}var Fe=`var(--c0)`,Ie=`var(--c1)`;function Le(e){let n=e.traffic;if(!n)return null;let r=[...n.views,...n.clones],i=r.map(e=>e.date).sort()[0],a=e=>new Map(e.map(e=>[e.date,e])),c=a(n.views),l=a(n.clones),u=[...new Set(r.map(e=>e.date))].sort(),d=v(i??`1970-01-01`),f=u.map(e=>d.indexOf(Date.parse(`${e}T00:00:00Z`))),p=`<thead><tr><th>Day</th><th>Views</th><th>Unique visitors</th><th>Clones</th><th>Unique cloners</th></tr></thead><tbody>`+u.map(e=>{let n=c.get(e),r=l.get(e);return`<tr><td>${o(e)}</td><td>${t(n?.count??0)}</td><td>${t(n?.uniques??0)}</td><td>${t(r?.count??0)}</td><td>${t(r?.uniques??0)}</td></tr>`}).join(``)+`</tbody>`,m=`<thead><tr><th>Referrer</th><th>Views</th><th>Unique visitors</th></tr></thead><tbody>`+n.referrers.map(e=>`<tr><td>${o(e.referrer)}</td><td>${t(e.count)}</td><td>${t(e.uniques)}</td></tr>`).join(``)+`</tbody>`,h=`<thead><tr><th>Path</th><th>Views</th><th>Unique visitors</th></tr></thead><tbody>`+n.paths.map(e=>`<tr><td>${o(e.title||e.path)}<small>${o(e.path)}</small></td><td>${t(e.count)}</td><td>${t(e.uniques)}</td></tr>`).join(``)+`</tbody>`,g=n.asOf?`Referrers and paths are GitHub's 14-day totals as of ${s(n.asOf)}.`:`Referrers and paths have not been collected yet.`,_=B(`<div><h2>Traffic</h2><p class=\"note\">Views and clones per day from GitHub's traffic API. Hover for a day.</p></div>`+V([{label:`Views`,color:Fe},{label:`Clones`,color:Ie}])+(f.length?`<div class=\"scroll\"><svg role=\"img\" aria-label=\"Views and clones per day\"></svg></div>`:`<p class=\"note\">No traffic days yet.</p>`)+`<details><summary>Table view</summary><div class=\"scroll\"><table>${p}</table></div></details><div><h2>Referrers</h2><p class=\"note\">${o(g)}</p></div><div class=\"scroll\"><table>${m}</table></div><div><h2>Popular paths</h2></div><div class=\"scroll\"><table>${h}</table></div>`),y=_.querySelector(`svg`);return{el:_,redraw:()=>{y&&f.length!==0&&ke(y,{id:`traffic`,xs:f,axis:d,unit:{one:`per day`,other:`per day`},series:[{label:`Views`,color:Fe,values:u.map(e=>c.get(e)?.count??null)},{label:`Clones`,color:Ie,values:u.map(e=>l.get(e)?.count??null)}]})}}}function Re(e){if(e.releases.length===0)return{el:B(`<div><h2>Downloads by version and file</h2><p class=\"note\">No releases yet.</p></div>`)};let n=e.releases.slice().reverse(),r=l(e),i=p(e),a=r.filter(e=>i.some(t=>t.group.name===e.name)),c=n.map((e,t)=>`<option value=\"${t}\">${o(e.tag)} · ${s(e.publishedAt)}</option>`).join(``),u=`<tr><th rowspan=\"2\" scope=\"col\">Release</th>`+a.map(e=>`<th colspan=\"${i.filter(t=>t.group.name===e.name).length}\" scope=\"colgroup\"><i class=\"sw\" style=\"background:${E(e)}\"></i>${o(e.label)}</th>`).join(``)+`<th rowspan=\"2\" scope=\"col\">Total</th></tr>`,d=`<tr>${i.map(e=>`<th scope=\"col\">${o(e.label)}</th>`).join(``)}</tr>`,f=n.map(e=>{let n=m(e),a=r.reduce((t,n)=>t+(e.groups[n.name]??0),0);return`<tr><th scope=\"row\">${o(e.tag)}</th>${i.map(e=>`<td>${n.has(e.key)?t(n.get(e.key)??0):``}</td>`).join(``)}<td><b>${t(a)}</b></td></tr>`}).join(``),h=r.reduce((t,n)=>t+(e.totals.groups[n.name]??0),0),g=B(`<div><h2>Downloads by version and file</h2><p class=\"note\">Exact download count of every file in one release, from the GitHub Releases API. Bars share one scale; each group's files are listed apart, and ignored files sit in a collapsed group. Hover or tap a row for its full file name.</p></div><div class=\"vpick\"><button type=\"button\" data-old aria-label=\"Older release\" title=\"Older release\">&lsaquo;</button><select aria-label=\"Release\">${c}</select><button type=\"button\" data-new aria-label=\"Newer release\" title=\"Newer release\">&rsaquo;</button><span class=\"num\" data-meta></span></div><div class=\"vgroups\" data-bars></div><details><summary>All versions</summary><div class=\"scroll pivot\"><table><thead>${u}${d}</thead><tbody>${f}</tbody><tfoot>${`<tr><th scope=\"row\"><b>All</b></th>${i.map(e=>`<td><b>${t(e.downloads)}</b></td>`).join(``)}<td><b>${t(h)}</b></td></tr>`}</tfoot></table></div><p class=\"note\">Blank means the release had no such file. Row totals count the counted groups' files; ignored files are left out.</p>${ge(e)}</details>`),_=g.querySelector(`select`),v=g.querySelector(`[data-old]`),y=g.querySelector(`[data-new]`),b=g.querySelector(`[data-meta]`),x=g.querySelector(`[data-bars]`),S=0,C=e=>{L();let i=document.activeElement;S=e;let a=n[e],o=Math.max(1,...a.files.map(e=>e.downloads));_.value=String(e),v.disabled=e>=n.length-1,y.disabled=e<=0,(i===v||i===y)&&i.disabled&&([v,y].find(e=>!e.disabled)??_).focus(),b.textContent=`Published ${s(a.publishedAt)} · ${r.map(e=>`${e.label} ${t(a.groups[e.name]??0)}`).join(` · `)}`;let c=r.map(e=>ze(a,e,o));a.files.some(e=>e.group===`ignored`)&&c.push(Be(a,o)),x.replaceChildren(...c)};return _.addEventListener(`change`,()=>C(Number(_.value))),v.addEventListener(`click`,()=>C(S+1)),y.addEventListener(`click`,()=>C(S-1)),{el:g,redraw:()=>C(S)}}function ze(e,n,r){let a=e.files.filter(e=>e.group===n.name).sort((e,t)=>t.downloads-e.downloads),s=document.createElement(`div`);if(s.innerHTML=`<h3><i class=\"sw\" style=\"background:${E(n)}\"></i>${o(n.label)} · ${i(a.length,`file`)}, ${t(e.groups[n.name]??0)} downloads</h3>`,a.length===0)return s.insertAdjacentHTML(`beforeend`,`<p class=\"note\">None in this release.</p>`),s;let c=document.createElement(`div`);c.className=`bars`;for(let e of a)c.appendChild(Ve(e,n.label,E(n),r));return s.appendChild(c),s}function Be(e,n){let r=e.files.filter(e=>e.group===c).sort((e,t)=>t.downloads-e.downloads),a=r.reduce((e,t)=>e+t.downloads,0),o=document.createElement(`details`);o.innerHTML=`<summary>Ignored · ${i(r.length,`file`)}, ${t(a)} downloads</summary>`;let s=document.createElement(`div`);s.className=`bars`;for(let e of r)s.appendChild(Ve(e,`ignored`,`var(--muted)`,n));return o.appendChild(s),o}function Ve(e,n,r,i){let a=document.createElement(`div`);return a.className=`brow v`,a.innerHTML=`<span>${o(e.label)}</span><span class=\"t\"><i style=\"width:${e.downloads/i*100}%;background:${r}\"></i></span><span>${t(e.downloads)}</span>`,R(a,r=>I(`<b style=\"word-break:break-all\">${o(e.name)}</b><br>${o(n)}: ${t(e.downloads)} downloads`,r)),a}var He=[];function Ue(e,t,n){let r=[U(t),se(t),me(t),Re(t),ie(t),Z(t),ue(t),Pe(t),Le(t),ye(t)].filter(e=>e!==null);e.replaceChildren(Ge(t,n),...r.map(e=>e.el),Ke(t)),He=r;for(let e of r)e.redraw?.()}function We(){for(let e of He)e.redraw?.()}function Ge(e,t){let n=l(e).map(e=>e.label).join(` and `),r=document.createElement(`header`);if(r.innerHTML=`<h1>Download stats</h1><p class=\"sub\">GitHub release downloads for ${o(e.repo)}${n?`, split into ${o(n)}`:``}.</p>`,t){let e=document.createElement(`label`);e.className=`repo`,e.textContent=`Repository `;let n=document.createElement(`select`);t.repos.forEach((e,r)=>{let i=new Option(e,String(r),!1,r===t.selected);n.appendChild(i)}),n.addEventListener(`change`,()=>t.onSelect(Number(n.value))),e.appendChild(n),r.appendChild(e)}return r}function Ke(e){let t=e.counters.map(e=>`${o(e.label)} counts downloads of the files matching <code>${o(e.assets)}</code>${e.from?`, from ${o(e.from)}`:``}.`),n=document.createElement(`footer`);return n.innerHTML=`<p>Data built ${o(s(e.generatedAt))}, from the snapshot taken ${o(e.snapshotAt)}. Sources: the GitHub Releases API (per-file download counts, all releases), GitHub's repository counts, and Docker Hub pulls, as stored in the daily snapshots.</p><p>Method: groups are split by file name, and ignored files are left out of the totals. Per-day numbers are estimates from cumulative counts spread evenly over each release's live window, so they smooth over launch-day spikes. Counts include repeat downloads and automated fetches, and GitHub never reports downloads of deleted assets.</p>`+(t.length?`<p>${t.join(` `)}</p>`:``),n}function qe(){let e=document.getElementById(`gsa-config`)?.textContent??`{}`;try{return JSON.parse(e)}catch{return{}}}async function Je(e){let t=e.split(`/`).map(encodeURIComponent).join(`/`),n=await fetch(`data/${t}/dataset.json`);if(!n.ok)throw Error(`${e}: HTTP ${n.status}`);return await n.json()}async function Ye(){z();let e=document.getElementById(`app`),t=qe(),n,r=0;try{let e=t.datasets?null:await Promise.allSettled((t.repos??[]).map(Je));n=t.datasets??(e??[]).flatMap(e=>e.status===`fulfilled`?[e.value]:[]),r=e?.filter(e=>e.status===`rejected`).length??0}catch(t){e.textContent=`Could not load the stats: ${t instanceof Error?t.message:String(t)}`;return}if(n.length===0){e.textContent=r?`Could not load any repository stats.`:`No stats yet.`;return}let i=0,a=()=>{let t=n.length>1?{repos:n.map(e=>e.repo),selected:i,onSelect:e=>{i=e,a()}}:void 0;if(Ue(e,n[i],t),r){let t=document.createElement(`p`);t.className=`note`,t.textContent=`${r} repositor${r===1?`y`:`ies`} could not be loaded and ${r===1?`is`:`are`} left out.`,e.querySelector(`header`)?.after(t)}};a();let o;addEventListener(`resize`,()=>{clearTimeout(o),o=setTimeout(We,120)})}Ye();",
	"assets/style-Cf_QRJR7.css": ":root{--bg:#f6f7f8;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#6f6e69;--grid:#e8eaeb;--line:#dcdedf;--border:#dcdedf;--good:#1f7a4d;--warn:#9a6700;--c0:#2a6ddc;--c1:#e5642e;--c2:#0d9683;--c3:#b07c00;--c4:#c4497e;--c5:#1f861f;--c6:#6b58e0;--c7:#dc3f3f;--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light;--sans:\"IBM Plex Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif;--mono:\"IBM Plex Mono\", ui-monospace, Menlo, Consolas, monospace}@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#121314;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--muted:#a09f98;--grid:#2a2b2e;--line:#33343a;--border:#33343a;--good:#5fc08a;--warn:#d9a441;--c0:#4189ea;--c1:#dd5f2f;--c2:#1c9f74;--c3:#c4860f;--c4:#d45287;--c5:#2b962b;--c6:#9085e9;--c7:#e66767;--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark}}:root[data-theme=dark]{--bg:#121314;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--muted:#a09f98;--grid:#2a2b2e;--line:#33343a;--border:#33343a;--good:#5fc08a;--warn:#d9a441;--c0:#4189ea;--c1:#dd5f2f;--c2:#1c9f74;--c3:#c4860f;--c4:#d45287;--c5:#2b962b;--c6:#9085e9;--c7:#e66767;--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark}@font-face{font-family:IBM Plex Sans;font-style:normal;font-weight:400;font-display:swap;src:url(./ibm-plex-sans-latin-400-normal-CDDApCn2.woff2)format(\"woff2\");unicode-range:U+??,U+131,U+152-153,U+2BB-2BC,U+2C6,U+2DA,U+2DC,U+304,U+308,U+329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}@font-face{font-family:IBM Plex Sans;font-style:normal;font-weight:600;font-display:swap;src:url(./ibm-plex-sans-latin-600-normal-CuJfVYMP.woff2)format(\"woff2\");unicode-range:U+??,U+131,U+152-153,U+2BB-2BC,U+2C6,U+2DA,U+2DC,U+304,U+308,U+329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}@font-face{font-family:IBM Plex Sans;font-style:normal;font-weight:500;font-display:swap;src:url(./ibm-plex-sans-latin-500-normal-6ng42L7E.woff2)format(\"woff2\");unicode-range:U+??,U+131,U+152-153,U+2BB-2BC,U+2C6,U+2DA,U+2DC,U+304,U+308,U+329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}@font-face{font-family:IBM Plex Mono;font-style:normal;font-weight:400;font-display:swap;src:url(./ibm-plex-mono-latin-400-normal-DMJ8VG8y.woff2)format(\"woff2\");unicode-range:U+??,U+131,U+152-153,U+2BB-2BC,U+2C6,U+2DA,U+2DC,U+304,U+308,U+329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}*{box-sizing:border-box}body{background:var(--bg);color:var(--ink);font:14px/1.5 var(--sans);padding-block:28px 48px;padding-left:max(16px, env(safe-area-inset-left,0px));padding-right:max(16px, env(safe-area-inset-right,0px));margin:0}main{flex-direction:column;gap:20px;min-width:0;max-width:1080px;margin:0 auto;display:flex}h1{letter-spacing:-.01em;text-wrap:balance;margin:0;font-size:26px;font-weight:600}h2{text-wrap:balance;margin:0 0 4px;font-size:16px;font-weight:600}h3{color:var(--ink2);margin:0 0 8px;font-size:13px;font-weight:600}p{margin:0}code{font-family:var(--mono);font-size:12px}.sub{color:var(--ink2);max-width:68ch}.note{color:var(--muted);max-width:78ch;font-size:12.5px;line-height:1.5}.num{font-variant-numeric:tabular-nums}.nw{white-space:nowrap}header{flex-direction:column;gap:6px;padding-bottom:4px;display:flex}.repo{color:var(--ink2);align-items:center;gap:8px;font-size:13px;display:flex}.repo select{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;max-width:100%;height:32px;padding:0 10px}section.kpis-wrap{box-shadow:none;background:0 0;border:0;padding:0}.kpis{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;display:grid}.kpi{background:var(--surface);border:1px solid var(--border);border-radius:8px;flex-direction:column;gap:2px;min-width:0;padding:14px 14px 12px;display:flex}.kpi .l{overflow-wrap:anywhere;text-transform:uppercase;letter-spacing:.07em;min-width:0;color:var(--muted);align-items:center;gap:6px;font-size:11.5px;font-weight:400;display:flex}.kpi .v{font-variant-numeric:tabular-nums;margin-top:2px;font-size:28px;font-weight:600;line-height:1.2}.kpi .d{color:var(--ink2);font-variant-numeric:tabular-nums;margin-top:4px;font-size:12.5px}.kpi .d b{color:var(--ink2);font-weight:600}.kpi .d b.pos{color:var(--good)}.sw{vertical-align:0;border-radius:50%;flex:none;width:8px;height:8px;margin-right:6px;display:inline-block}section{background:var(--surface);border:1px solid var(--border);border-radius:12px;flex-direction:column;gap:14px;min-width:0;padding:20px;display:flex;box-shadow:0 1px 2px #00000008}.legend{color:var(--ink2);flex-wrap:wrap;gap:16px;font-size:12.5px;display:flex}.legend span{align-items:center;display:inline-flex}.legend .line{border-radius:1px;width:14px;height:2px;margin-right:6px;display:inline-block}.scroll{max-width:100%;overflow-x:auto}.scroll.more{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),#0000);mask-image:linear-gradient(90deg,#000 calc(100% - 28px),#0000)}.scroll[hidden]{display:none}table{border-collapse:collapse;font-variant-numeric:tabular-nums;width:100%;font-size:13px;line-height:normal}th,td{text-align:right;border-bottom:1px solid var(--grid);white-space:nowrap;padding:8px 10px}th:first-child,td:first-child{text-align:left}th{color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-size:11.5px;font-weight:500}tbody tr:last-child td{border-bottom:0}tbody tr:hover td{background:color-mix(in srgb, var(--ink) 3%, transparent)}td small{color:var(--muted);font-size:11.5px;display:block}.periods th{white-space:normal;line-height:1.3}td.pos{color:var(--good)}.est{letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--warn);color:var(--warn);vertical-align:2px;border-radius:4px;margin-left:8px;padding:0 6px;font-size:11px;display:inline-block}.meas{border-color:var(--good);color:var(--good)}[hidden]{display:none!important}svg{display:block}svg text{fill:var(--muted);font:11px var(--sans)}svg .ink{fill:var(--ink2)}svg .strong{fill:var(--ink);font-size:12px;font-weight:600}svg .axis{stroke:var(--grid);stroke-width:1px}svg .base,svg .sep{stroke:var(--line);stroke-width:1px}svg .cap{fill:var(--muted)}[data-strip]{touch-action:none;-webkit-user-select:none;user-select:none;cursor:crosshair}[data-chart]{touch-action:pan-y}.cols{grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;display:grid}.bars{flex-direction:column;gap:8px;display:flex}.brow{grid-template-columns:minmax(110px,170px) 1fr 86px;align-items:center;gap:12px;font-size:13px;display:grid}.brow.v{grid-template-columns:minmax(110px,190px) 1fr 64px}.brow.v>span:first-child{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.brow>span:first-child{overflow-wrap:anywhere;min-width:0}.brow .t{background:var(--grid);border-radius:4px;height:8px;overflow:hidden}.brow .t i{border-radius:4px;min-width:2px;height:100%;display:block}.brow>span:last-child{text-align:right;font-variant-numeric:tabular-nums;color:var(--ink2)}#tip{z-index:20;pointer-events:none;background:var(--surface);color:var(--ink);border:1px solid var(--border);font-variant-numeric:tabular-nums;border-radius:8px;max-width:260px;padding:8px 10px;font-size:12px;line-height:1.5;display:none;position:fixed;box-shadow:0 4px 16px #00000024}#tip b{font-weight:600}details summary{cursor:pointer;color:var(--ink2);font-size:13px}summary:focus-visible{outline:2px solid var(--c0);outline-offset:2px}details>.scroll,details>p,details>.bars{margin-top:10px}.vgroups{flex-direction:column;gap:18px;display:flex}.vgroups details summary{margin-bottom:8px;font-size:13px}.vpick{flex-wrap:wrap;align-items:center;gap:8px;font-size:13px;display:flex}.vpick button,.vpick select{font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);cursor:pointer;border-radius:8px;height:32px}.vpick button{width:32px;color:var(--ink2);font-size:18px;line-height:1}.vpick select{max-width:100%;padding:0 10px}.vpick button:disabled{opacity:.4;cursor:default}.vpick button:focus-visible,.vpick select:focus-visible{outline:2px solid var(--c0);outline-offset:2px}[data-meta]{color:var(--ink2)}.pivot thead tr:first-child th:first-child,.pivot tbody th:first-child,.pivot tfoot th:first-child{background:var(--surface);z-index:1;position:sticky;left:0}.pivot tbody th,.pivot tfoot th{color:var(--ink);text-transform:none;letter-spacing:0;font-size:13px;font-weight:400}.pivot th[colspan]{text-align:left}.presets{flex-wrap:wrap;align-items:center;gap:10px;display:flex}.presets .group{background:var(--bg);border-radius:8px;gap:2px;padding:2px;display:inline-flex}.presets button{font:inherit;color:var(--ink2);cursor:pointer;background:0 0;border:1px solid #0000;border-radius:6px;padding:3px 10px;font-size:12.5px;font-weight:400}.presets button:hover{color:var(--ink)}.presets button[aria-pressed=true]{color:var(--ink);background:var(--surface);border-color:var(--border);box-shadow:0 1px 2px #0000000f}.presets button:focus-visible{outline:2px solid var(--c0);outline-offset:2px}.presets .note{margin:0 0 0 auto}footer code{overflow-wrap:anywhere}footer{color:var(--muted);flex-direction:column;gap:6px;max-width:90ch;padding-top:4px;font-size:12.5px;display:flex}@media (max-width:600px){body{padding-block:20px 40px}main{gap:14px}section{border-radius:10px;padding:16px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.kpi{border-radius:10px;padding:14px 14px 12px}.brow.v{grid-template-columns:minmax(96px,42%) 1fr 44px}}\n/*$vite$:1*/",
	"index.html": "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <meta name=\"color-scheme\" content=\"light dark\" />\n    <link rel=\"icon\" href=\"data:,\" />\n    <title>Download stats</title>\n    <script type=\"module\" crossorigin src=\"./assets/index-BQba7rNW.js\"><\/script>\n    <link rel=\"stylesheet\" crossorigin href=\"./assets/style-Cf_QRJR7.css\">\n  </head>\n  <body>\n    <main id=\"app\"></main>\n    <div id=\"tip\" role=\"tooltip\"></div>\n    <!-- render.ts replaces the placeholder with the datasets (standalone) or the repo list (pages) -->\n    <script id=\"gsa-config\" type=\"application/json\">__GSA_CONFIG__<\/script>\n  </body>\n</html>\n"
};
const PAGES_BLOBS = {
	"assets/ibm-plex-mono-latin-400-normal-DMJ8VG8y.woff2": "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",
	"assets/ibm-plex-sans-latin-400-normal-CDDApCn2.woff2": "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",
	"assets/ibm-plex-sans-latin-500-normal-6ng42L7E.woff2": "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",
	"assets/ibm-plex-sans-latin-600-normal-CuJfVYMP.woff2": "d09GMgABAAAAAF68ABIAAAAA3ugAAF5UAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGjQbgbpaHIRiBmA/U1RBVFoAhHwIKgmfAxEMCoG4eIGaUAuEHgABNgIkA4g4BCAFhG4HiG0MgSgbY8wnonn3FRi3DQC63sa8uKONDrRuB1TRM7dtZiDYOIBte9Ge/f//aUljjLUN23EooKr19bCKiKoyW1ux9XXdBnJm8+jYkcje3WZzawcm6tbNPnPA5ugXbq7YDvEM6VW1kMZbeZOebfscF916vN6Dv8vC8ms19iitGWWnqJ/JDT8y3bB6LlmtzvqoiFBRMpUXXGnX3csOTEvDbDZb78ETB6WYJaZJ88Rs+CcLdyTXShGmL+VISrLVhIsejoPM1sPFlR0cK+pSO9oV+KBLy1PvOrSXvKV/IbtfZBUYux6iaqxTL0Gwls7ufZIysCQG4StZyApVDY7IIZ0Pz9/8c+9DWKPbwkA314jmPgj3bXreFrV6v2em94JYAfHnFMoQglBoi3U40D0AcyuFAYMhNWCVLFkkY8WyoFfUAImJA0aF0HqHWVh4hwmKJ5xXRl3KKedxaeWjF/3yRB3iv91L54hnMt5B47WaBDwowUwAK/3f73BqNVYUN9myJFuOLTtxTTZtI8fZluyVfC2ABPDP4l+A/x6gB/RKI+wOwEPofz637CX/54coooUdqp6BFYe2mYooKwarp0vdjqO9XGnMkRyOq6uteH7SM8XB4GHRLzkA/4/7sbN935chD1ENkdIIDVKHTGwiktr1P3Pp+7JszsyWWKkrFa8EmjgEywH0OsQlUoFcPPZyDJx7Pu/gnApzYcWNKTAPOdlC/Y9TbNavbH7ufsL9jn7VGHqqjRrpYmABHglver9hVlgXZMYQ21nyxri6zESh3sWrWgCr88iWv1qmdff09MSd2XB7YRVTvfdz4jJgFmCvGkD8gOkA0wHmg89k/kECTAeYDNj/nzYzR9EUadp0KaqUd+0q1wV7wfrAx4MNBD+zK2MHycICDR5JoBGjc4Y/+uNfAP8BgDK2r4PaivNfZ/VTATzKSy5pVDi7expCh2PE5lS5FfCmF7dqLT96ZzojWYU32rgUJF6wreu5jtOQgtjav9JvkGH/dZpk68uxHPYPkAuAIzDMd/z2WzN2K2+dygdEhIu7XwQSWAMMnv/2+1+9M3sN6/072OCS8NDmotN4PzRK5M99fjDRRDKJnswaq6slFuknMquTo1hLlEgk9AQP3/taafpOgSDfpwfps30ku8gmIyiImpTxmYJUQY7/P2awd/7+Hbo1WHTL+C+wS4JGrSqs7Zl1TW8ql00VWYxRVdPaSM5lZChTuYJYUawgyBWEqZ3/mquu/ycpJjQjMMp6s0qv6ZURleO+u32r/Pr1U1AUMMRoQjKCjCSk6UeH7jdJgN0k9Ag9ZlZB3gvNSEZUTysmJ9GjHfdwOO2eRA/Xw8L787XvHQmSLV0Ml8EYY4zJ1s9WzYkmsrtGvmOF8ITHBGNcIcRhDuN2m9sn/Xn179W+1xcRCRJCkCEMIiK8Zc1qCCBi2xFWY4Oe8Ur7XR/HFg3Ei2hUMqyPP38rV/SmrOkZJoGIkkfS/op+JwWoByDxiFDESCNRo2xBbHMG8clvTFDCgUFAHRVWYqd9768i+ezF9ipCr+rnVuB+X/J4HXZYoHxjEOwiy2Sh6N7ctp/b60i+Jhr/hvt7WgcpJOTPpSrqFbZDoPsV+VCoXvpPeuGL6/fpZUQEgrCWBuQfkjkdR1ICicjsakvrWl1/XbVUn7+KinOVky1DqqQJ648dLWLooCUUTXgC/PbFO3qP3XXdRadddNR+O2121FrLLTTb1Kwz3visNtLgQPV1UXckA2cWiaSTNLv1iCuDTI22sUZ81iRGSOcOJbjiTxyRaGnSM+eaKpSLbI8rNOsGG0GEE0sVGp0z1++KRBSZDa9l1jf9wIYTkdjiPn2/PrkvMYrZmpgEHDHHXwmWU8b+ugrW8fgvq0JiLCOWBKyFMjbBRH6mmy7AHHMEWmSRIEssEWyzLUJss02YI44Id8wxEQzBuPvsiKUEzFCIsD3tk+/gl9/4JmnhMKeuaqKV+v11+btfe9nj7vZ9833V9S72YWfv9alz89HGG1u3bkebGm243jpqKlB1ZRVWUFaWdMdmReL445OZUcKHLLm4om51wLXqbgT//Ijv21zPi+Qy26csf5MxUaNe7wiee5hqkxULVqWv20E2LiKdQhN0AuSPOKJkDT6kc4c4SpDhp3JbSCGFXHSN9b1UgGZdaU0lnFjy0Ogc6zdLMWG2di14GEO+p21t7GetRAVGa09rGfY4iViIxFnxv/TJACEAdRgQMGRKxII3I75CuRllAn+TzBZmriUSLLdZhm2OKXLCGU0IqEYAgfhBRIip2lovCYKCWqiJWIhG9hMSms5Qji9mladeTwaobCqUz+eU55Z2Pm/tbZRAkhQwUzqGigonSzFelZyZmmeZ66QLC5RhoiH1DIRNX8zIZExWlmxUjuPkOl6e4+TvzVPTYPIsps6yVYAyFqEZhG6FwCOAR7CYKrBjFTpOkWMVC1crDMxMYrgjsrZC57EYjPLU4v6ra//atpr+YsuWbbEXfn6duTk5W8Yy8G72YbvqzV9W7BJctdtAlLDaMZoK/6wY+TRYZcoJ1KkjotVI7JyHDBlJm39JDxU1zXAzddeiGuJGwu5RNN6aJNN+SAH5xjdWiZMR4AfwW0ujrLnMQTnstDNDsBEuvvBoKwZ8TY0a43sTlOk5pC3WgxS3SpRBnldgkslohmcJWI4xNVWaNEiqKzCSZkQ1nRhMgosZGw3V9nBOAlcdp51pkvpMvb95Jwn67RPVVb+zhUGew/peK698VMdhp50pPy79VD7W9GkjMBvWbjtyttzE63f5gMbcsYM47LQz5UeFn3brK2biAJ49+FFh28TExCRN8qbW8HFBq9C3VkazcbCm7Lbt3HNh3mrwW2Qj5POwixsRd84DvFpPZ7I8cjzz+NsZPwp+ErZSXYGRtHRX/viGoKrTrbidvFDE3KiF/Kj2k/pgz9Z/NrPLPlHrBZ3JYnM3seMHTsTJdKoBKBMzLs8znIdZLoMtGK33M28DzlymEemiKjlM5MqTX9RzhGa/UBKYZrp55ttjr31feCibreLQufIF7TXzmHXGbuFUcfu8lX8C1HMj6N+IN5lIV7QYfVn/btnuxlETNwFp9v/SFAunS8B6M/V2YlftETZskCqOBXPkEeueaTVo1ElnXZxz3gUXXXLZFdc8aMmu3xHXbvECafML6YEqqIaaGi1Ow8h5bAzwDfShhclshPHCR1aFuY5nHD1yLPAf+C/8r4cSYezs+gVN3xGGaE/b2sY0M2b3R6S7eNhhA3TSTk/yPHAD8yoU7V1DpVt2cl5RbupCcc0UwQxKGQI8vD2g04a0ymyQ09x2qJX30ElQgZfIq1xIlOGjVPcZVrPNDNshKFcyl+O6UhbwTsSCFtI3KU/liyEFxtCOOG2XH7Z90TSDr5FZFcwSp3hJdhWAFToqQescVeP0SgCO3SyZML1yqLPgPmWKvB5uZStuma8ontlG6kk2m2H7iZ42ryoHT/rgKnhnTW6KMKgGX93YtMOF0H8lFdfqXtBP+iLuEjhvGDCE+Y8MaN0M6CHVu6YwCmnQrrQAaJETT0Y1loPggAAA764kp/TRWJdk+E12aAWwPiAn0ka4uX6AUTOAIIsvP+hk3lkGNmgel7Rb50+PrSrw587wwtyFzH4dNQfFEZN1DltWl2c3iepK0oS3Vn2NYEZm8AoCIFqmYcIjzGAW1LAaQaW90nMhsprDbKiQYmUMB0rbUIfXo9KQNbXPqnnRZYMuCqrDYAdW8YNHZVeT47ALgCdFKDPMnKnYQBI27SOtALXG5bR/tmwZRX+d+JcykIQip+FhVJ1e8VskQYc8sbKqbZ6YtuoWeCC60/HzWNn6FUBLzT0u0E3TkRFUSspkjjpMjFa34Z4hUvRXP5LdpvYTjlEUjYWEciSFdpRccDW3tFwpyvYYCgm5vlFW2eDjK2IODystDZSps5esoeIvSo+T1CSY1moi2gceZ6KnHlTTTwcSR6MIktuh4z3HUw2p7aBbVzlGeYx2el2FOKlty5EteUAFWAt5USw36ktWZO4L7aX6fn6GYN2YG/XAVdrBhNgmFRJZqpqIvHCfbadJI9dE4JGaJuSpzmoQMMnj9qDdMJpA8UQGFkRkIfgLh1/WWCwzZoKCtc08sGZdmapnklq0jYkj1gE1V7l8YcnzpES5HFQWTmDhwnC9fbVNoVlVHP5It9ld4MWH8yyTjdpSOO55ADLYtavWnJEKZV43JVw7YK/2tSyWabmyJqy4ZcgK92UyUJbsQ5COWiJi1i6J+IjJ+SXYCONP0rTWYJgWj5aizMK5y3M7Ksl65Z/3lIZBA0Jh5Oph/rZRGQm5oIGM7nnYU7/DEqv07fUv0FNZWbUzPdmHLrokEZquRka94yB45019kxWCJfVE/xdZQtY4tmxZsufIijMXtmRkHCi4c+TFiwsfAVwFCeImRCh3SVJ4SlPMR5UqsWrUiNNJF/FGWiLJMltU22af9g44pocTzgzxt6C/bUptUNCMc+baYZTjICDhtIkFGAEaWxjgAQAeUNqFpfgoXVB2Q7VhkvbYAYOS39clS+tG4srSspKTIU6fkvFFBmRiQPOhYcmSknR1vOzIQTJ0BhQqZrmYgCmbA74rkE8Pvvw+ZYBZDmSAPkE43rEiAnHo2g8zAMaB1oEBiHYGAANKJzMJQApI7bLYAgwBjYHSBQeMSHM/bJIsV3Fl6Xwh3QHM0vgjw3FiQHGFRtQak+7quSm9QO7WgFnITkTZqmRgUkmMLQbSkFzlLP+OpSLJ75kq4vfyg/wE3mmejfMvZ7/6lXHEHCz7OrswJjtk/hCzFlmDLBFznh9ktDDwqUT6dbqH9pKGpf5I3UR1kU+Tu8gichTpIMmU8i+xNjcXSjhOUBCYOAv2C4wB/SM6gJpCKVDc8AokEZmgA6UR8TeBnxHnhaxEEecQUzL+QfgsPAdOg34F3QN9K+E0f3PE/N6rOJ6NdxpKulExWYuLMOQx5LjQnVSbsns/ni1pkZ/AD7rp19dCe9lMdVXPBD+ngkgRNHkf/7lEG4Epf8PoH8H+hKn4X+MW4iix6GWL0YOgTBW/+5ir2D8tvI88Ef3m+l39SBUsgUHKR7aGgIrPb1eu25JmK9aM2NGV4265bYJ3plZPzZLOo9Vfge+wV1lduUDBCS7eNL9SEAmLElP//6U26WrjxJxbk30zuYQPmpL7yNPzNr6v25kCyyASQsJIBIkiMSSOJLAklsLSWAbLYgiGYhiGYwRGYhRGL3N5Pi+kYiqlcqqkaqqlxqa5aW3am7W0njbSZmK+HlI/ZmEdrEa4yzAyjk3hYVdqYbIiWx02TTsgZzN+ygxXlqw++t5UY4QQQgghhBCqpCnNqEZJWUVVrdSbjq6evoGh0aOYs93vZhDigDt7FsKDhZA92HTJLKUMIkGGGeY6ww1osmJ8byqWG8BNm2BLRkpaRhYChcERSNQ03eZSvhQAKCopq6iqlTrU0dXTNzA0ehQDfnJQrvZIt/R/tBm2rmxe2hNINeNocosAaxyuRr3IXYu8o05ppGa00I4O0UVP38DQqKy16zZs3orZG4AAgIgcXPCKICssSkR90lAYy6pltyZWlq3JlipnoTH143bmj3GTBQEIWVhEVEy8JJCklLSMLAQKgyOQHWWEbEYpsBSVlFVU1T5ePZmEEEIIzdtaw0/KcIiWbAZlUEOziuqtKQezW4eVIQ4CPoFzzf1cKIegoFCERUTFxN+1CYpdtsqHBtKUlnb/JZVwcXHPcolEnVGeVqDn0nP1x2QyKTDuH/x7Z2z6UBRFURRFURRF3alYXAtjjDF+m6yu9Uf1IR8kNZ1RdKUWMTF9WMBZkQP0LGB2nufbzTdBllCERUTFxJt4SDcgZZJJJj8aMum2dZyuUH9ibSdYmW+r285xFbS2HNk5FbK9bX46rvx7e9EuRv85yW1tuVwul8vlbtoGRzNa2qXTdvX0DQyNylq9bsPmMfNFh/VXd/9Fx18wrgVKgLG2uCJM8372DrPdT3h3X7BxKAgoRklZRVWtNBiaWtplLa7bsNn0rV0zsBxKcsDFW/LJTMyYFtMKZRShZFBFdYWm/3TamU5Mkisl0F7P5G49LqhtCTsc4bTxARbWwvne4G8DgoLzkIVFRMXES6JMSknLyE5PNdNi9h04nD5ukBKFwRFI1DQtKMd1Xi4eX7py7cZjTz7e05qlNE3TNN327fa7mctK+vxVi5klaSlBJiYzLctmPbW3jmOY8GDeygQRAAAAYJYyLWPfgcPpUxFntPNycVpUUlZRVSuNtqmlfd4VWADFON1zC28+sniaaVrMLJRWhHI+qFbqndD0K+3tKBN6N5/t9xsbU7kEYKlt637BxpZtO5vje2eLcdqx5lPwtEhoxXwCrG27Rh7UFhYRFRPfTrxPZqmKNDKyH3uqNiSOx0DmgRoGRyBRTUeJxXUsybKVkgMgXwr7l65cu/HYk+mnmwZbU0u7dDZdPX0DQ6M1Q+ooEgExcNLcwjuFx0M1IrU6NNFYMyWwIYRyVzDhTzdu/r17IO+tb+Yv8BkSdbKkIh2ZLmsgTdMT7SRQYHAEsqOMkpAwNDQ0NDQ0TJjnNVraMyCEEMKEPz/bY9IYABzjGF5XsTDbGUKMc41Fib5ColkZrbQ24BBwFkwAAHx3AAAAAAA5OWfOnDlz5swZYhjmnTCd9CWA9XrjygwWh1W+LsMqPFFWPUvwCAdktEYUmK6t0jcEYhiGYZi3aeS0rxwOh8PhvG2Hir95GKiQj+EiDVn2NxWJiIetipA8yi18q8DZ4ZidIMvfRSLlj6vRBo/VW0VFxd99kZKOsL/1d9iFx/OhCADwzoGPJi+YkHEqnG2rGItOBFEgwEx+hd7WjWoB8M5Sj5CTkxvnBAT4fD6fz387/vBZ53NPsCj4iAmJifGrjiSrDAe8Uy0nf1rn0qRP597684CwPZYZmzU3TQs748g/ZtjUr02Sxz6MHm2/gFFFq8Za27fcVfXJ3iyQxs9kLGwX3NN+8HjY+kOuHjNLr9XDjY2NZ1FRVbvmONc/+lxLTEw8LSYHgALMGlWnZkfAWZge4OSr1nwgkmfn/e/OPJX3wpfzdwOwhzjQF4PdHIoj5VhwvJwA4KRTTpcz3ZzdPsczD10oi3F97s7wDIDXV+KNvX0cn5M5HA6Hs3RMuXwGAIHC4IgghSqLACxZtlJyfPKlMCkqKauoNnh9JubiG2zfAuA77H8YJtFdwP8G18kvuP9F/PW/AeB34L+sFU7KKiDJimiEv/1LSPTNw0/yAa7Pv32oySFvqzrBrNVKkkEGdTiNt0zYKFxAypnC12/7WfZm92F/Och2yJFyrPJ4ORE/6ZTT5Qzb2XJO2MIXvsJ0NfWs7HnbFyUvk6+vxRu8nQ4AECRCwiKiYuJP+Dccl2iH8jZvM6mlpKyiqvZx6oC+GWQgAxnIQAZqrFm3QTGXw1XB8vnuXKAhlBcpicu4TMimkWq/bI/dlNK2w3BbU6IrMpg2lVjy7HD4j49rA0+Dryhrjy0UW8zaqq1pqLnxr3aVWgf1CnuaUgq0ynTA0bH+1uCOVtPDP1KXwNH5bs6fChAhShSJkfH0hGCKkn4rWB2wDdhV0gI0ZhqYlV0MByjzZyzIoiXLVnzohq292xWi20CAtIIR0uKdi2oKD6g1Wl2JgVzk91pC5TZVMIIYweicTJtzqxPWZ3oTYC1h58ndZfao8nmP0yYBoVAoFAqFNjY2M9z3oHvYN4FtdtzX8Iw0OeSbWl557Y233n2M94A27acIc3Nzc3Nz86VAyY509fQNDI32M6REBIQPlNglw+RxaFPMKnE0Oou8jo1yOSMu8GHhaSdOdr5acBzHcTzxx9M+mM2vGKWc4OJtS5gFk8oWaoqu1N/M0Dfm5gZ/fDv3q35itYwfuQ9Y2/KP3WuRjJS0jOwwL+PE0MCAI5CoslguWbZSck3+sXPt3K/R1dM3MDRaMf8QeROAL2PYBTFV7inr3JR8qqsxbd7ExtBhhufAN37yS6ZqDBzj9m5QHWq/NicpmZltN9jvzr3LpaHTpVHrbr/s6oU5f7prbqb5xQIG9rafXzBXPRu0PV3dzPAk1TEvYsCWkK1/KHGUEY55OFvU+c+u4RTebXrp/qrlzEtr22mXkh8Hs1CERUTFxIfk6/mtOD2G3CKvUhBSVFJWUVWbrv/hDVNTS7t0/vDJZ1989c338vPlug2b9zE7kjUBtx1//OTKEgYPjYE4VBX1YGmfOXLCkK9ykfs//T43Rj6lUBaVlFVU1Upj1tTSDkb9JP0jIiIiIrcJXWoytxwZurcepBcoTX80gRBCCCGEEELulEoe+yBrkzk1az6+Eld251TRNUEPnAhx79YNGkyHGDDsgMTkVMknXGc6REQkseSfdoQzRkyWprC0VlfIUWutXkBB6bzRfU/dcUWqt6PP2cWOT/8XHWEA7rGsCrVy/QWR+IC3feGu6N+mLVJ3t6LxQJfBYBB5xY8sp51I2QucohKTi2rFplVsr9ip3Z073cy+K/vjwLTKzAmwPTQcrjyi7ig+yWk5TZLkRK1ffTW8DsjgAxeI3kNilpSUtIwsBAqDI5Coa7veQgkURVEUFQqRSCQSiUR9BBJ34PJQBYyC1c94Kxrdr5Db8Veebv5f+/98q+jWG78MZHdPexIHml1lK63qYRXyPMUVZISkSVq1SVrh0eMlYe7lXr7Mb3O/6qaouhy8T3AyQAUcghu8IsgVPlASyssUmpgEqlAXzaCd6NV0p92WpfVs69jG4HjrdIwTk+ttGHFTPNrtg/xxd8Fe7Iv9/OSBXq2olMPxI3GUk8eI42SxL5yjub3srLBsnys9n7xQLp5/Vcidhs9Vuk+8ibcl2A8Ji4iKiZfEICklLSN746nZrAZHETHPtSQQCAQCgUAikZxJumg+q2XRkuW0MqP6ViwWi8VicYq3UDQSnUMDafSzwCbwdixid3wi2TP6zri/0aRj+kp6pKevFKgv9QY+3Gqo9aSepzYbK91go/u53pMfvqTJYzY+5Z8VgCb+C8kJD0Qvxa+Njo37mEa6rlOq8nfdEky7J/QOrb+RvmTUzHWYmOM3tQRewp93gWsCAABIUIEENwUMUNrojM3T1rGUBhm0ll6MQ7Py5DyrKUEjXiVpRfBwXK805qrWrh+4SnQCDgaZQ7lwRuT7KKwVo1xdhQ0AjGIMLrph6PyzUUKzGa022u19WqyT6VbUYj4f7GgoRsoY5Xg5wXbSKafLmY5ml/NAPTSuf+mWm+I15Y29nYO8UqlUKpVKgiAIYgYECoMjkKiPpAHvd+HChQsXLo5/VNjw3q8+M2KR2XgOnotRzy4iOBO+FXk7fif5j5E+83jPpDB9I32rCDBNnzlG6h8q7h7V9MAPA0ZitvY1Jb8SNW0dE2I+NamoNVPHUzrV6fCqtwy5csJasu7c3zO+Yh6w97i5kb8jJIkUAu9zR+SqTfKbYvAkG+Dqd/a6w0WGrQtPCPRxMHJmBqvDrm/d6XMrXsYfCZIQKyKLyZK+kdIKvrIiUL+00r0fRhu5zW3NfB2WHtu1kVfz3L96qzujSmhoJsxacRoumdcK0CKMGCuBZZsv8K4lShHFm1dSSlpJLnPWcm2vOWRgmfJa/Xf0bX7j2qYL4RimkEssm8/d1ynZuFzkZ1FwKRYq3apcoFJNqH48hZDKqpdEnr7nHoYcPOX3nLj5YRYjZQI66ZTTcWbsZjWEuremacf7uVtHWERUTLxLIPwyTFWkJSNbpvLPBclQGByBRE3TzeJ4yXK3EgGIJPJejSvXbjyuv4IeJ3Zk2mIzqoJ7jJ0Tgf/c4Pvcv+vcWN66G7/jTHzy2uosBVhrie7LaKk58/a0RpFvSqpYTYLWLxcseaROrIjC9dsiOzJFSZb0wfa5rdwbQaCrvampfb02h2vUGOAOc5lx3Bqi8dSrJ8dOVmrV0sPV1NSOGXWbok0XKfkLmw20SrXzqK/MLRyMw5dPEFnFjKF3p1+XBiT+rna2hp65zC8tWLRk2YoP28MeLdJ32x5Ui8VuRa0VnuZUdE1M4GqaTp14Bm3I/BVGpwoiL7jy4QEHBt/QVrX/Zs4Yb5gd1iH7Jecl75R/JCAJCSHkaAJku0SZ2izUmKfvyDNkI3cJOAIgaFy8g+vaFQ5CUBN1EAgCJ5GKTt7vbt3V2+qbMWCEDx6Rb19bjqPKleMp8WWFE8k7o6lxZtKYTqW579AVcAWmAqmQr1CsUA7NABZr7Mmj9BXog0I2paMSx7J9/LMTWifLqTi7F+c176wSyYxye+GOu+6574EXXnrltTfeeveY6crh1WAt/zNAHIgLeIFC3Hz5/FJMJPMmhxxyWZe0L2PWQx19QwbyYIol9VUpyRCZdLskT3KWB3lS5UltjF3gzoHuAAeDdOwUoCpVuUNNO8U7hfJJliPWW9mjYwp/ktl6U+7N7CP2e/pAJ4M5hxwpxySNmxgm5UyV6ZiZx1ntvlP9XNBrSQ/i4XQeCdYhYRFRMfGSeEhKScvIQqAwOAKJ+sRpxPyGRmyipf1AXIfXdDxDZHVVJawS2baXQYw9jNQ8rwK3bnQTVa8rMJ0o6zcZTl4DSo03Ape/oIqU/zVY49YOC1A4v6hWrd6e0lqrrddEvTh9OAU3m2Eq7HAe6Ba8LZ/xNygArzgp817WZI4E9UZ0MrcvYXwyQ99l2Mi0g2X7g+22k8paQTFD9MB4JekYCSIA93EpLLR95U8fgFuE36px/f+UTL9FtwlQfmNLlmpQngugI1lKZlhszgzlsRTIj0M0PnNDommkZKxogh2LvCqrrFZ1V/uWq0aVnpt5NFLN0tmhhbot56/uwYJh/Z11sUmlI1JF+z4MwJUuSvau4Qcno2wj7LyzqO0oEiaqQF/rREQPiQrl4qqFA/S5jsuha0YNars2DkxMslyTW+M4LwB96YwQ81rw3NbO8iHsYIJ8JAtNt+AgBPgmdDFp1/J8IrKy109q5eeT0s4Anqu2hLRh+apNOcMJRSZjyvTFzTm3ukxb5VmXUv7Kk+8HEEIIZz5/mm1GiwOdDgUhY6DA4AgkapoGFplvLFi0ZNmKD7uHVtE06GqMPNC0kWUDu0tap/GZG4KV6FY8l/TYk6TbqPyttI1aC32cHlKFgiMMr05Z6XvCjFBU1XOvSWHtoz6ADsAy5AcLHBluZKYnkoCAEBAeSdQbUbC38IKryn9d12+/SvP0lE09XuNyjB+IIEoJ/QWHVl2uCiTW+jNL5Oo9l+4AgSbyi32wxycCoUiKJDjhaqX5N/F1nVp3Gkk+vzMrO16bXqMv6CtESAV/9vy+uD/sa/1Znd7je9Ou3QVbvIkbvgH8p+fxs/AcfHY8w0/vE3xsj+LB54tJvH+/z91T96676w7cFbfnzrt96fXn9drzf/vd6+DVe7Vcefvf146LbjTvhVRz6d/s7W+Lq9svN+kA4C7+dhHzNB4+qLh34Up4/h2yFteG9daqWDlLtfiLuYgriupnfgpGN8jR9bCvutzZMY5tAwJSDAmHBIloBgpviYn5CGd2VPK/92/ZKqXVqOdp1KhYs3Ylug2oNGlSvWnTGsyb12jRkiYrVrRYs6bVLbe1ydvT4dCRQSdODTvz1LTn3lv10Q/3/MV45r//PWcyFKbCQYHoqsktl71oFM2iVbQLKX7CkBkzKyVQ0AWR/oMXsRK+J+P+YFZrwk/lj0DQR1vRxP9KSR02pTKGWb11UBr+etfuTuoTBE3TNE2vNaLLtGaebpY7BcUtSrgPPnpgUewuHv3WTSxWLMWylTVERx8G63nRTPzIy+kh4T9wrb9e3F5NbIb6v9iPkdjW6VhPeMcSo6xiJODf/x6KNxtLHQuIaaYz6bct84WbZC9PX/Q3nrOWcJChwfBN8a1853s/+skvfr2IIps+1m8ucOnKtRuPPekMsVb+bTETAGDNkzYa7AcwBwBzZQgrZal885emLNhHKMIiomLiZS1bt2FzPwQu3CsW790uw0KPGvGgvL+K0H80aTEf1UjLyEKgMDgCieoW1KKZPXr0OONeSv1s6qti2wVaLWWVVkgn4nWGvH+RrGvMwKR4V/LIaNd41+QIQwSM4z0DEn8tER7tsS2CLpkATu3qcbpjp3X9loLVFk9p6Lg04YXHrELzvL2dtTmSPDFZrBAby6PdoyJ7i1yUPPR8Tu2DdxmM6ZLgus1faE/oZnF4EahLILV5ehS0vCYcHWvIsoD7O9Fgy43WtEFG1DupRs1FWv3R10QC7dGFIX+rmO5CZN3VNYSMji5R3OGjoS+TxLg56xien/R//CaDFuPPQWEoOmlpCrJAsRLYg2HfR/vjQFGZ/qGGf3obXIqmJFinY1zq+5NGvXl4KTZN7rZP+MoE7BI4BreAFyXIcL0qanZxsoXfUUS3w5WEd+/j0jvuhW5OMa2zMCdHdeBkR0AWKDse0+t32EbyzppVd8zDViG2cBovx3jGy6aQ2/NRGI/XeTotOSI/1IV0pKunb2BotPrJlpDm71nkHx0s/bO6I+5zVIhLJRboZrOIEEl1v1ua9G83rztKROzNpUmm20sRIERghPWC145T6HhFjlN8Ir/V9DQi4VJH/9SxwPMLOAVVXK+Ss1AjlnUfaIVIEoAkB4WwH4elKCFRPFjKE6STcTW9Ko0vyRRbJz7fhbkaliAEhEJLFD51B6Yy/qbH7f5QR7jeW9Wxw25sdnK/QGiNnye37sfaJiLPazfWEHxZn2bwvq9aSKF8bFzbhhQEBgQOJAgQWJB4AqLYmr/CdImC0ktk8fAWIcri9oWmm5MQwhCWcDU/24DEdz/98ht/9XH9NcphhEE4IcxAgFoI9mlRpK2OQmEbN3Y44LjVCQMvXEkk3l1MSI74D3qODbiOzWZ+Ldpe/qQQmzrXr4VhwagpZ/OzX6hvu8+nvh78wmxewfFIlEHbL8qDnF3424o3XSu/OUw8HHWxkPdQSEpizJm978Nzfa1veAjHHF7bbHLOdXFW25qP5cBgt2dcPVfXaV8wz//lrlVHjE35FOAg789qcP3rd0w8URLOayk14BiOMqDFQNgE+gAwe39AOEg6/7uW/vsLldWBP4HcALIO3Q06oQJjumafv5R+6KFfi4+JDIfOHy8SG/lvlL4m4qFcWeExKBrBIFGQ/oWBtGsxYAoekBdP7cjXCZvN/5zmiceR8BMhXpkmvfX3fymn7Dk3l2dhvl9LGZYRMbJPhP3AfsF+K1U5KetyVu7KQ/kt9l61rvq3ulcXavl/0z/Qib9ICco162NhOGXN+ye9cglTMMKXfy2TMv+x9OW+r9kbN9kP377l8H/YqDk8wRL8+wD/Hr0gdzzycBPA88P/82lGikix09vTI3+Vv/Lv/G/RLyMmiCywGewFl42HmANATPu48PH9Ex+XYsD5x6xGqWxdDdcoQZYKlbroQSVJmjoZMvXTV3/lElWpV62bVK+ReTtu/FeMUI0mtbonAiWGGGawEZq10GvTXpFBiYLOCx31csFFr5zVaoCPzuug2GOPPFFmg7XW2WS9jTbbYpftdthpn9322Gub/Q474KCjDuntiNNOOOmUM45baqxRRhtvjHEmmGiayaaYarYZZpplkrkWmme+xRboY5FVllthpdWWWeOYJb756ovvcuRSy5NPkzp8iiHJ3ST5lCSdSaD89aRfM56/z86vAJOOx5Ht+1u3DA0O9Pf1rurp7ursaG9rbWluagw21NcFVtau8NdUV1Uurygv85WWFBcVej3uTAW5+Fez6WQ8fPni+bOng36v22l//F52cnwtjWGQcGN1UqsmEWHCjdNaNYWTwP3xzWDIEfTQ28HIt5rGWjFsocFl6/gLxVKzn7cLMZIbb4RDf6PBmAfD3FNLZ0AdnJm8Leou38ZfuN8LlqglOp06PdV1Gum+CuhRKCgoyAQUNZ+NsGQqqk2k29R28ssohpwwGo4t+xVtnughap2ERl8WFUqpA5ZQWcDc7rl4xSWBeXIPMbOWLjEKJnGYY1ziOn/51ELu+jMiOJLnL7227tAMm/eqkWczNQmEvUmkbF5tE6LLQ1KrRoa2GNNPpajTnyq53xaQiJ+q/ldGLAl1iRfSKAGEUzsYFrRwiJqkLx2MpEeaYLY6gamR/IOiaLkkbMs8N8HFvAUpToWSkLm4U2OA3OV5DaFyCXqOQsIbMALmbGdFJGVxj0/29dHj48dnOy3sVKRP8auwfUOAT9gPqYViwDhH4ZLMLq3HbAko6AoasoRG3cxgSOWijT6Z1Vk14wea3P8WoYVOnXFRr+8uo1ZtRTboOKeR9YHJCKBIEMOvwBLEUc4ae7KOYKwYU5r3SMu6meR5ZVji4cO62YqFQmOgyTBvZ3Q7Z0wPPgxO841kmY+zu3weWLK34HbIdzC4NKLn+xYzElqDiI9uytra2SL0Aj4gHI3MkpG4TB8mDyMxJ9oJ4lUdYVzHLv8oeeRwgBsCHQ14yS1u0fVrzXhOBP3Sb8xaCojs1Hgtkcd1EznarJXrtFalVsSga6p5B8OoX7iXNz4ANJM0b6fuvQ+LRTHp07SGrf4+btzeFGKtxc0dTRGh6G4J5SU4MmUHF7SEHoJLAip8WHlOHjvJvUazPJtjfzUfK8G3KIztEaOji2CHm7VqakCStT8yqUjf6e9+uVi/z1kKzAPPP/BPZuZt3g0Ua0IatLgvi16d1KW93FoWyVEr5HxWMvKWlpIvFopjxhAb1KUowZKcZ2vh7ptCWGB9BLqzgJZY1NvHmgAub1FkKeK6D4tlg1Vx1WMVMA1SUeC7fKKUsAM6wt4CJisGJt1pd9iD/f7k58YKuHqxXlsbEtjlSg6PdccPrUmgqrdg0pYYmCIFMSIkQMm0BqEdoHWRWWTI1V+6gteq3JO/0Mo9HZ2ny8Ct+irfiq1DvqWElCSFyJ2qD1Q8cErzON+h0UC0K5MItoKjeheskzYdFyuIGVWaYIQN13g1MERQp2mxlShuSBiJ1yIlQ+P0SGUap4TJ4GDLKz2Yi9s68gaTWZJwtZgFx5YyalOczcI4xAN6D5hyj7FGbl9SVnqYT2HNxcnDD744aN5wDWd4am4Cyh7FaulCYGtbgZ8du50hlkeonHvPS2dEwDmzF+4AbVnDGCWwKjT4Wu/RGeYLcJdDh1zd7jymOkNVonQOzgj4wDPXHUOvqFW6a4tHHH22FB05sIwt7TEQOQZhHbYRXgJcrtbsTyHRniQ9oAs+xpiyefna71ZggDiRLT0pmMz4Sp1QX+F+RM8PFMsPjlD29E/7JQMoXXMJntmTY3udBy66bV5C0OiEzQm2zZI/9ki1z4E5sOhdMhgHo7efaKHRuxz+p6Hd1HRZtocmAtmcBaHiNHPL+2NAvf2RgbTIudM2J23YtyQcTUBxNz2FEwGSjWBXfk/iXxnIi2/PgN87MnJ36OhAFJOdn+UZm+aw/CMd/9IDt8z9OPGE8DlNq/50WEqo+n2zJ/mCgpZnrgXTM85ypD/rj/VuEHUPX68l9SKlBA5w6BmzkY8YDoHckwQ8GR50H9CR6GCoo5V3NzrBPvjFuyNU9C2F3VwtNB/WAnHyonf6I3WVin8LgbwD1xIDaVi012kLRbnS+6Iza+KtMMKYNcrTqMho8u+8xlfoAkcaAjKPbJtkMiVkHsBAt1irVSoja5kYhEi9fRThTW8DlU2JjFMFzY0MPi8a+OSQIaKBCyK9vMGlsTdmJD7dxO+ZfUGgKIMl75JSU51wXVPvZJdylcMGbLbmoekns54toBNgeYQY1XdXBd64WlVzryU071GIPJ+rDDbOr+wTVRa6gwRhMnQhdkn3qd/nFmz53f/mZjSX3WbvFwFrPfsansnTA4PsyacoMK8sZp5WTfx3hEj+/zEIKXArexTmx0ZrouLdsuFArv4dY8WHD0XO7y7odQGepGzNhKdfpETEmmo4v+ZpRC8ezIXRrqU1GA2MJxjnnjNK7yf3HSGDfYwYT+DSR5LvCGimbG63TRWZWrJzjJuoENlVHKF2sAmm+IxbNVzyR8Tb4KgUeMdTc56nIYgnne3kfWNw5Y1pJ1KcSO5cHeR/V6N0ypsEijHNX1o8dKHOX9nIezCE+NRbG9f1tmguZj32oppm/kw/d9M1AkV2No1KyMCpbH4F0ZeoO5SWzVfjsVVU9gpuk1u9Lg8cGSQtzKLxMz1Q3aPxBlg19lSJMTqhY2xnC2ekMhPIK6gNFFdQIxzbngMgKBFxyRuIBgDZDqI3NH0CtD5YguIg5HJouQF0b5BzO4N5Muikq0wMSjQSAQodBMevTBEVkDqpLpXnyN/5c0hCaX327UAWS1ReUihXmW5QHZpd7kZZX6N15/WcZCi7g2xqOHvOTIYQpkG/GczsRhYB6QJZctlUXfHvDLvY4uVnPvZ7JrVM1k5Js6fpi7GmlF3K7ixm9HcnX0WxG/ZvXCsTL+4Q6/Znvi4QGIMJP85FEF/Ztab3LhpstoRPMuFs07TELbj/c42f1anFbdi2kiQczC48rf0Sa9YC8Nr4vUQt0zeDetvUXkw1w5Mc28HjwpcSn5pd7pIc0y37bOV9koS0Cl/etAK7gaYUzu8l2f91UDuxC5rj4CXba034QNJKNGZ8D+c8YCQi5zWmpi3e9hKwgz78woKqZMVDPafBVJIRZ44EyCKZLzN3xUGMhHKV/RDh6gHJq4O9wCQlhNA61QQz9V4usGLsbUZLXLo7TYUlY9PnBeRq/hoJJhgigXhyAEW+kcFN45qBXMrKNRTJ7Wwwe1VShdluPfX+D1U4Bc1N9SASVsU3SnV02YyI0a6zOYsLye0iIGx617fFBwvsEALZZm+JLtfzmKuoPx/fcBX059s8zK4tyi2RcUvnSN9ua2g1kv2Irs7AVtGB7/mehXTLXN14ZaHfHK1zW27rvE3LnUOfm+edEroIMfixSBrPEismGzauMV1D3KomkIyxZ1DBAP8mtGOSOCc6D6tJJRWTENOweEnkCD158ztvkl6n+ppHNGxTxO6CPySQYL6meVqy19GLRvLbzSoWqOKEPcc3IsSk1arDw9w5IhIXrsb9xj2nxaLjXUd9+gVtFKGo71iZ1EkS7540YZaJlHZEcVHxKvv2m+xLRqFWjAmPITd1ZlcDa6G1RAVxkajK5WGWo1S/vauXAIurBfmwCnm+6VY0V2XrTBQjjGaaQKWEzO5lG0rv9x77wSqQRGJf7u1nqjd3N3o/bf3lrHurBH4U1qcY2CA5ANkwUBTScWfB08qy7KYV5ThP52Re5AkzWHnKDz0EgqTrVshqoSvihIrKo5ffun1dEmIfqqCJBTpNu3L/qjCob5EgqM7A58RcwYI8dbYQEIRgNTOPeBrOG0NQ9kwPCB8b1hKi0SL4e+YD0bRsjbz5TnQeBUsIGhnl7pE2YPcA/WxJkZH6NFW0OUx2q6/5VnD/dcggAGeLY2WFvGsCP3jEiwlJvsB8ayR39XzaGhQsJug6EzkFvzIvUdsyqsMbgxDCCcB756vpXZYKhbR1kpFlFLLLMpk6TBN7INNuQ3Qk0rYX7mIvoND2MXQtaPrcTUUkCkqGAoc8XzwhFHLir6NQy57tG52eFnzVynZ7NbARquEfg+VrY+m6U97s8ucVd/26/Haxd/VKoQgSHzVHaDK/lkuS9sgm0CsdIaM3pONkLFaVwl8H4MfzPF29nauXwFR+XdPe2Vk4+RLw0YPPk3SqAeYAay6EvWUDsyhZqah0ruMJjhgrvl6TDnfq26Pj2fpGLaEqVCKYv2a3smBYv3dDYfEq0c5FTp2HvonlMxAvJtkRzL4cslpWh7NHseTMNUZYuksSHoIHx+bH8097IvgSxSex4XJy1+RYlqasWHaG5yq7Y1vWlp3R5BxbvCKkDTiSfKGu80WBhWo+GqZLon+StkF7Qxg1N3vP3No0wTJYxfJ+xG50n9zEjKqibbp8JEbcTLyn3+d3bVPwRUZ9s+Rd6haV8LMQMlKUn8ASoITkV7CfU8AlsrEFKuXdNnRsfYkwNqVftCSJRRNEr/3z3Dxoz8c3l5lhsElK2CjAOlGIZblSlScH3Prp8nDv0dNOrYiNGPwsrBA/WVEGHVbGfeoOge92Oyvh5dmT+XYZcqi1ga/uW23NsxfTfn8m0C1iq/rtfnY7X+9kSmY91mzz6p4pjD9qUmRghqsX6x0cqu6qd89wBdYXaNvYnMVRxlWZFiAwfQqYsI2B7SapUIrjgQgc7SEY+IYq1gM7aOuONZ+QzMwdsfNFGVmFfSB/9dhg2hks4Aijw3CUSLZhhy0MuYzNovKBfxETyEAMrW2ESIqi6zqj/zJuC7erF2vqKwcNW8FSIbqCIAoRbdV4j5GzkZSTR7/jDyRtG3sGSHofeOwu6dDenHyV28Ws/PGWhazeOvJhq62bgbG0icvAxRnkRqwC4dlvvzSPy/QPlQyXeQ6XyKUgzFFxgGVgGbgGFIp2o74bA1pjtMyJKK0ts/QuXGgN2KLsUR0YLIHx1e1Y6Bmlo5t23gkaX/YYW9n39a9i4pTmT11teXwLIVT+afEeggj2Z+HXbMh3GFfleoDW3baVc5//ADir1lAI27ib3oZUCdw4aMRCDajhlIR+7+ROvb/Jf160l6wzzjnUAcvaBpeByEqOqoWjcDodXIdVBr7KFxsU/aoqy3X/LB0gp/pc1obp1AKdhEbYufM8zvN+LyV7wOB+xNhT6NRN6u4IzsBExn50PuqN3hYJPQCKFe3cbvFIfU/P8w7adq1/mA7To9xtOkiqF123prchIDSkWeB1u7HO2uzV0Rl9rihvJ5dmoLy7HrTe1kVIXb60q644t70vMzyr3PHzH03o+0Y4i8qByAU3xlpWiZbdNJLcdsa6/nkxXIktHKRXs6FQb32Lq61v21cv5mfxBuNzK4ZGnIWT50uLkJMYhA4ds+nglfLByD5kDZAQKNtrkLbufnJzoFPyXjJvrfGaz2oozh2/5LIU0htB62Pd7+HR0w+IO1J84Nu5OL2294npDsPgA8rDGQSgvwncz5tzo2gGYwYLkFOSdMwPWVSvaU48mQ/ImL1HzB02UFP7BujiBBM9NpbOWbXJrNrQtTUTiuZdU2xkBuYrjnRaqbdl6JgAxLBIT6dWEPzLOrQYBBMthNpAHks0cihCBL1oOu/W60xDIGPiXPOmOa4Mu0RrUQ8i5NGJh4adumq1ldcotwpq38yfHUwx4zJZI8zK3eos28dG22F/GQ++qzfksC9ZZ4bWt754uu7wx1hx0rc73iNx/xpls6q7tse6yqD+yF5FVlRMBnRaERDwNzqVN0MO74q1dTH03SRmhtWzLuE4+Twum8cP0v1+tIjd21ZVxcmcwDrLybQB2LxAY6zhSrJ8ANFy7q2FEedbduhiHWlzc5MOFjaHmlYrDqrRcdt5IysaIsEWdlMOYxNBho+L7I0tG1Zb1syNAzbNnTf/b37BDO4c+GETcwBg8QigJmn89G8R7vwb7tZ3iceex3HxetT1PgLoNfETB0/syM3RCvlaH0HnJNG/4jEqaGb1Z0VCe1VtsfN3/qm2LG4cJh6zNwX11SRUNpof9r1VwFe6Mlht+fmsFleGkm/jfxaW1xP1zIsJnUaMw6YBGI5MJXKlyVRk0/0eNuB7G5+ndmawWqq1NvzTS82zCp4D8qu9XJkqzSWSqbhowDRsHDEdmgIBBTs2dnV2bAjaK7QrKpk9cKpAoBIVCQVqAYM5V8KEaqo14Po3jd1z//8lU5Ag6wqVuC0nK72tRmXJqtRzmww09zJRhjaDdbtTY/m7lm/6BI8eJwLnI1OCP6aUHbKWW81ao1HnrqgJ1pTXHMJh6UKBqZlUVlCN/IOUGjcO+pOBpezMBzxgWfkCtr2YroPfIsWTcomZpStjBskmFp9tL6Lpk/tDH+bFJybg3yrOszbnwto5UwufxqLjpQr53u2VzD/J8ZQ/mIwISjwZyCv+qwQBCI8UaENGrkJLHh3/qqjRl/UV/V6nme73cML+0ohkjrzqElOPLK2FCX99E+lEjeSS+YhEJI9M5iETEfyK3KieqCRjib/HqFTqDbqKte/FPVMQ0/2enOowjTc4sP7UtcsZ2waeaEx7MbFapVwprejp0sZc74nqyQ97rEoXC228xJCFbJnckl1fLdEQHXb+IN4Tt9Kg508jOekGa1I3Cgoy+enlyxG3YKPJfMIW2FaggrdHUiLZzeMc6y6K42DjlbmePO7aZEx1ykkiv30FI7qbPPcsRU9B7vPCH1azZJSKbKXQx86jYL+CzOVcv9X8sSaFwVyLhFwnCpusKWQly+IvcPIMCcFWk2n5mw/nfhj8qVaXC8qyKLl8azENZfSoNBoF1lpOQZkQzoa1NeU1GT5Ub37YZbVE2fWZwm1M2J0izp4oVNa2Y5Fdhp+5MxGmNN3PbeDDayPb+fOUKQBrSjoflM+zd6T/p8Kbbx6NXK16QHo7NOVt5QMCeBJ4bEmq5mho9dGRkyGT4RtWnALUnkIxf3OBW25UXMwYoFsrCiGGWXy3C4zrC0fdOFoRIw8v3+WLU0ARa0bSJv8UTg4+mTkYvkV0Alsbhq1NO4HLmlXnlZZkCjLefh0O4Tz4nCFiOh0C/g+098/CODgoHobjwN5DnzoAjY+DYCDxcVBWMcgzaDfuaWwy7h/M8Xg77ERHQPJSLZKY8nyuWmdeqUlizEBXy4nW7jxw1uz/3UNW445g0LhjyOpuDbZx9CSyTVIrJVv1JE4bGP3Z7GeNhgl8ED9l4Mz3z37SKJtIDCaiYv2A3kKNPWtVpnlvY6N135psr3cgi2iuljPMYjnPQqNlyQMyWraVxqeq4UEyY2QlsIP8F5lA7p/txxAw/bOCelm156GnWlbtfehF1M8U/54h8JRyNSU15TFZrdA1ryhkLG/V9+C/L0s8K7648cLe6gsr7T16c9trfPgW1JOts/1acEzW7IbKS6bRUOPo8ksbZjt7a0MFVesiRsOFK0MbegnPb5Tr14VuLu2cXT+xQflA7pFM01hTk0XY5vYMP8GwXZBnYJBzJH4pObu143GMDEq21C+h5DxswfP9s2KlW8ApVio54j8r5RnZpxNwLhfGhHM4cB5Y6y/RKlQymhm0Ml+6tarYr7GK9E3LnYZopeb4Ooy4Fb1MVUsUbv6XptIrKhVJo4iNq6I7atefIhNSGsjZlXGqIDe9gC6U3UqFhmwVKCO1UR4eI1uUIXMHuDZ7I3+9M2evkSwS7SAjOFPhCpAO5ObRHWKV1NeYhqJprmj7tZcb45MsM73HhHDDRS73NMIgPLZqVwW/PygvLbVFef0V4JEtd2eGqrNlj0Klj3TxPnDWln0z/Rob7VYo55bdtsFo7P2lSr+ls3WNz2wuCNDeC0l9j5Bwp+KbrB0b/wjd/Me6b7Pvle/YCwrdDcJ0DSS8PLxpjBSyi7Tuf+MIdkMQ1FT1ZUHwf03VXyLoIGdDrnCsvl64ryHH6arPEe5TyJ0i11mbKoNkp3eJIVmy1C6cJe5KZ3+rycDiH2s+XARuPZWpOfL5NftuDK525f22hY+6eXbmMuZJuuCt2Tr6S5nVx9aZKgQCj0zMdDvsf2xowXy8VytdlRJBD7CYevpQtjlwLwct0VWnShwitc1RHT6opJG0XJnCU8+1aryEfzKLja0agVh8mx3BVnPkWu23nUPSQNL5A5+7K9z9U1csX1kJITP14tgnES8sVVRpEV9UotNJ/A3yLIWb8ExZZGz+I10iVaYDhT+k0R2va2JgQzgmyBFQSduzLam9hpX5+eemMsVNNab6GH3d9a7PUsUeHr9EpZP7AzLL8hTJBVIs6aI4JUV8cXhQLkhSeKtf2171BJ7dr0PSQZl1fIlbrDHnfAXkKuwyR2tZIGBNh+zNxwV+lTA14kLhAD+zIv0iM4l5MV10cy14M03K76HH0dfy+Wsf592jJZ0yp/ah8G4NMbq6a93nGO/G5xer9PKaOopq638HNrxJnyL40RBsqSmZZ67g8vPTuClaBT/3LjOLzWSbXamytFwiR8dhkFRKfnNr340Yc9LuGmX9iqcjm3pLsZvREbGf7xfuWZmTHJ4kjcWEQndwvttzxI8OhYJSLxn3URy32ycrCmfa2kv0X4bq1qwRTkWxaLXHQq3LlEv4c6Kwsz1shoFJ9Wp1VK+ByaB59oZpSiGoVgiJ7rDh8i0d/epcfT0rM4der03V0uoyM+tTdRGfJhMU4CawFAuhzlH11Lm0/EV0NxpI/gvgBwAf/TXyXwTGnfnF/wtwUxSlFZOAbaXQnNgEjDNq0/ZboTRh4L5ryYvFW5cQ6QcpZvZIvag+ZvQyVYsGC9NrLuT9d+7g9EFoMjo3ZtMLqg4FFqSvOB+Z8fnGO4vKi9n4Di0NncgXVZ8uiPns4M3N0ES0Hhi+OsXx/r6VBq392wdDwrmr24dClJf4sV/4DyeGL5EJIl5IVUgvQCeh8+m0fN6vIPm9GyIK/lImXr2E7jCJmBSd/K5C/3tfU8YVuiQSTraD+zC7dbc9JEsgjqExqIzgthr6WYHBxeSxyulCo+607aoBwlmpTGrqwLbqLqOToVYPEzilYk6Og31bklG4l1ZV6XhuWgljwj4Mb820r6JtyTRl07fauh2tkX4M8xgQnVa8HMY+hIio3GLruQ0w2zBrAggeOd973mO9bo3j/3EvFi0YKadwU+dT/bTlND8dbbmUco/lDnb662ngaRvG3bGgaHpFrJPuSNUqbsXcxR36+nQE4XrGMXessJVbauJ/aa+JOn4taaQYMFMcTQnemwmSu0WWVEq+UmkRE6ITkiF5/DRz4qlvcULct6cSkw6s9jwQvT7NGgesPA9J54muT8pgx3s14u/1A1+t91cgtg8y8F4kn28uosi5pah+hW34KYmpwSdK+x/pE7uVjKtoBl+fF5NE1TAEAmMhiQB8hZS2oU9pdAcBLO173MVRJesqJpVvKF9Gomisnye9aqPqwHW/1qs7EGi//CgWVq+pEbzedCjdmy4sFosBYWnpK4pUi77F8kXICMi3M79g38pAwRjqvufMscDKgn02pXJ7q1bbbFaZJzTNttvbXiF2U3ML3MvrC4uW17lVmWJmPu3dDCyxnWixJeAC3+bRJJly1hOqyCUQeCQSizBb9OzfQVMRKUo6mj6hqZtGUxPJrxAg+NSNaVWl3/CRdCiYPSLVLMcrJ7DLFkDRoIVlWMGJnZaHJtGPIsPRBwp0lrg+LL3eis6oDHMBbBvtGwHhrvShTVoB4jg1dgZzvIHGv8JNcwgs0iTCHQJu+0VpjJEs1trVqkPuPDFOmByd/DUMvQue/rUx0+XLz7ehTIf7WkBLWkGVUleQiJ3CrhP2NI+XyWJmCfiAQPKeM/iCFxk3F1HlRiLdlQhEixmJsLQm7S4NSvKCMT88DUQcix9T4HyH2SF1a5zS0k0hpZudsvo1Ie+wcb59inigCzO9BzOdi55ekdWBeNef1Y6WSIO9bF2JfHcFYg/jxYg9qHf3mOnmcvY2SPh2SDH72oraqLGFlAbMMTUGgipM1VM/Yaf0LiksgLcw5XySTx74aHL55MeBj5epYxL/m1s+B/QdD5ycrJw8ETjxsDlZOFc5hzhnWbd1rtYb1m05gF4/nhoI/u/G8huPlLQcOASeQ6Nr5OE1tMHXJcIS/XPL53RzlXPRvwLWLzl//uaDOhhholGlgL7bnetd/6Yadex7ahUmAVdJpVbiEjBVwBtjNqVWgBOM9bbxnQAmWqtPNiz/AZhWS1HH7/UW6rVFRX/Hqshkq/3dIwcFXXvV8RRyeuOFhToEeuF4HFIhZ0QkFo1wuJe/dhJbna/aHVe2ura2fI0rttpXddWmsHm472oOW78ZWnDxi7KVj8Z/YhR5TGaSgsEqBLkGc4xjDQ3GfYPZLkU+flZdpDIpmVyxQ//9y+zfwCTwb9kvv8jUirl6bleRlvuDN4WFW+gsISvpkWBoZZW65SZaLvGs4JkcK6XOIvXBezTBO2mwibLrVQcjYiIFbM0JYB6mNNO3qkfcs2r2IvtWWoLWc952GIX5mmQqY+dReGLoav1za1wRn2bmCPm5tdyCnHoRPFMnsjMl6gYClLPpD12sPtbDoRv5aSJvXTqOMjwxMjAykT1hsWM3HZdv3oQO3YAenZQ3fcjDcn8viCqq59D5Q0u9xOkZnvtZi2xsHKaXjPxqEtqz1XH+swoOxxwn9vzE+tOtsfxTy9PxMtGBifCRr8wYkT0vX50mNJQR1U4s/Ssus5xuVn9WLLRRNg9dCb+arEmiZlbo2U0GmmeZSK12Q5Lc/88jiNKn0YW8xd1fCkLvJWKFq3Ac/xdTOxeTwW/FRB++WbJM5YnxjQY6OzaQ9y5eMrJ+1DSkDFp9su5aqdEWUEgaHWZuwCuTCw18S9ak1PtOrmDeypSauWUXvjl4nVxOkM1QxdQZGYF402UOYHd02JUKh0dsq9LrY5xMLU+VrUy+xZzTGLI6YUpqCGupszOT83igFZrv0uSghC/RytKjQhIiQqq6jc7vvElFPIlGLooMbUDl+RZ871FCXe7sAfC3sTh9o55pSE46Gy50MjNMfrW43RlevMIkcVLbw0WuVKW5UiFsdBDraVFolazbnWrL336+dvWhrMqiXLk75YrJ2G7E4BxYxI+mx+m+x3S5w6aLClXslEp3KhJ6KPxrU5hOWuYXGI01fHGZLk9AmDAkIaGRT8bkao7xytEetl/9c5lycmo+Z3LAOYNvNE4QgoQpY+OnmsS38Pv0xQ6nbw9zW17+Uvo51n4IltPx4dSaRcgFtUQGciWbq73HSch5AovPgn8TDXqLYPCt24LtbAOJZJKs261ltx/r8HVofSCGLTFE6HDw5W5pSk+2M4RCNzgUZrpSwXDpPp6FQcmXBeDrfCGb7xetZ0QjfuObmZQ8UYVY21BK4frU/2TvXm98gPWuzjSPNTWb92KiF/vb9KVGUyuLmmQg1MDmL7cMoLIKypx+51RUOd8/2999RukWcooVCk4J2CnPyK9PwDlcGBPGpoVrr13pmeuRC4cYiLs3Ec6vgRSff5+LbtkYBmlJmVHZzT63y9ay2y0+l7uQzYhrIRvJLTjscKP0v8bDYLUhXldyP1yTs8tZO0DPg8jXG5H2+gL619CQ5Dkw8ly2FXnFkCZX6eVctkI9oWOgGqhE9OkYQPxWGGTLrw1+JZantggYhOv3AILvUrjZYq1MTZOquNO1GOS3SaGJeDSRl2jI0x8zb/ux+hFHzclVjYQXDmNYM5YzEbWA97kknl6elm43m8VqGlLBvWRDo36EASALiOQ7FcbImBuYUyqjzaHm0fIUamKnkZOftU+5qZTEUcoE6Q6jVoWahQNhC3DEUxgQvkA+ZSjupTaqrauRlrhTKp1NysLvogBmDBi6Lk2l1qXRMYYZAGUXnmWT6n5CbAYDEzcjYNOJQPA0dDdyPDEKPI6EnwFHJZ4h6OlcWr5CldQlz51NtsvgizMNWoPNsbW0dUMjv04QyAV4JPQpeSYsxPk0yGVYbzchM38mowdjV+emK3czKSwJgCbxktB+QETan2yNCss+DVZHWK4yoKNhu8ONYI26e6emLz14oNOq1B3Y0Jzp6mlADtuvVmu10dOg+w/WbrXazwbgaofmYDtUal3xJjfECnGmJsTv+vcZMJsElV0qpPE/drVgS4OX5oWd95BfQZNgi2TyIiwJ+upIuS9iauzO/K9zwkIsnIWgNVt5Db9/LCEh2Ln9VXP9PPoV7mVMOpf02kImW16TKHPXCebIavgEDA2bgKMnhpCqxSxDLKOn2A9bGyfae9mJIMSyZaZ7ss9zIj4HiebYHR/u3zmejZNYLo/Lxk+VglB/sO4K3j/jHeAuRyJ+6BxTYRiFlPOkeGgyNJ5EXgoTLwUC+7o6JnS4wtm3S/RegEy5A02C/Xz8jdnkS4maI7jLOOt5fHw59zUyO8JL874pJ0uoTW9CntC77vz3aSKJL1vVsmje0iI2rHq0+rYahmjY2CcpLgr9KBEkUerMotfNDfO613T6vBd7vSKR74x+l6SCH4VgoEfecQSKgRylhn9d6B3gViI88TI0owgG7Md1TOjwjhdgi+1+hlUSuRtskbyk3tTDPdImU1mPIx6a50g3W+myO9Anu09IzjIV2OxGvTfXxtcRJ9aZUfUxZNLVFBB7TBHSTTuLOZ4cAzmKwZyDxCR/SC11QCkN9JQWFCY1TRUnPWTtrSdx9M2q0iwDs1wBcjrneESuyUVt1BR0LqCnkMKl1bTfdJreSagiV1R79fr03/h6/7X/jufwwatv/42v57Wafo8ar2ahIvs2+9K8nmaiTv1ty/SEd+i/8fX+a55jHbz64b/x9bzGPnj1hh7HDv+6BIHQ3xP/1/tE/VlTbasvXBb+qweDQOgv/1F0+HczCIT+8h/P9M9YvDr8GxUEQn/9//whoMO/fkEg9Jf/00JIdePegDzfD5bTpuZEbhUAzHJ38lK5qBTKO9flnv9/Vl4oeuUVfM13D5KHL8CSwsmtDwdcmU++wG6xANPnbwtrtlz2Pt43md+sK5yRo43OfQm50k9YTJkbXZyXFHNNLliF7yEyL3shCPwzxYGAOD6zPOPrGL6jYv468SvFlbCoeYhTlFWPucEIBlxmiMphpwqiOZSfG9qUUq2zADHm7c4bPGjJWiKUaCUaRqcXmAKTYQi7uswQ40W7qAwS0NcS8tq6BpQz+daAJe5Dcc2ZmaUWHUoMKmca1sCuEIi9DNqL6xzI3HGOQ0IiTrg1wfPX2cSuyhlecAizYRmDyhkOqUliJ7ytMRRTZxYOg+KHpud8fAzjsbOPT80ETeuN4xivjX14Pq7WmJFyGhHEPzV/3vBskBHcAld9z3fd9thORW0MQVsINIrnAr0IrRiN7N31mqAvIZTdAdG9WoW52PemS59P5/2FUNpJNtydoKqXQ6gDOtKiUs15iS2usYmEtHq8nVs5Xw2+mFaUuQclORNfgBRhxY3es3DeFIBKabP7ld1EfqFPJ6U2nfe0gRRLTyoD+rTXMl4EMVhSbbWVEpdRxJy4xek3uPvhh/UaD96XN0+e/P67qlpclYGPpgErt95hTS60eYH8N7w/Dq+v53MV/rT//nslFLTsoHn+VUGLC8dwzazovYAzHQSslHqVlEyUuNpztW2WenAhS1oi95nBCkJw22IIMN187w12QAuoJZraeZMkCfRuXdsTJnY10lZWfpK05fGiJ6Jjz7DhdkXCZxzu5szs2suqIYuTwuolztu5BV7JQc+8Jg94PCt63xnrINduAl/H6NAXR1I5mpweWT3dGUsLSOkl4yRj6A5aTsVhK5EnghE0FcujPRhyKeWQ1SGuHODBcrWDZUTzriu0fI2Jop6oKBZ2NqVTN/MEgeZ1g7AZq8xIDnII0TkbWepjzNSKJN8wa7I2OU7ibTCZ+yqIUlrwSLuFWToNvb6pmXNQfYmsbD2hB8NJJEtZGjDlcIsPPZx3PappGnQHRdPPZiOQ8sgljM27Ch8O4BmfYee8nk9H6Avx1M7PptPJNks2DXL1RPCGFBNFbdMMJxGqdsZjAmqhTkW6bjKwtjbIncfns3w4RIk0Z/MbHRfNbLjBQP02qyentdBahYlLH76FgIQCrczmVjewzgF5aeL5QmFUhnOOJtrV0KRxT2AuDIwIApViPIq9i+5QRxetaO3hx97PkZbNqqHNpfIm3h4/xqryGXONoekO6HyEpmYoSRcCDZiguzglOV8D7gHe8w49wkHeAgKgQQ0qiTRUHh8HHvVpx1pAEj2xZsHuZNRn1mk2nMtFrUWFUp35XGkaGMgcS95DANfhSGSH5pfWsNbEFWkA8kZAjQCdUmfwZSJ1pLVC14ntUmRD57pF6bDOEZ2HiOnOwIsxY0hbQpB9SsVM76NstlAI3A22c/RYqhtynfRbxuflyMD32s34l0Ybbfz4/07X+rsfYWQaLbdWI43atnVJSj1kmfWwmqvdGIu7ynCMSoVAjizNWmSNHf98GzbXRZGgOTpmpByrFdJUbWJDCqw1NibmuM2cLWAzHDOF1k4NI8qsSmulBHkFzY96VTCyL5ddc2zQpmEajlphHrEQ1OGjJt/OJgWAiVdNAseJGujrDfysyIyXzFbWtiPTCwyZcQRips8ujN0qZz+eTA5yTH/aPjcvtrt5MFprIRl9RKH0Ks8ObEoIwmq61WodXtRT9dNPo2NdP3d/OoZKoc+vXOFnpoKTp573omf6ihD0tQJJf8PpOvBozzsLQJ7oDh5rEJmkiu/1VgCE9WZrW7DEKyY0tr9kWEx2dJRCkUoVREt/DOkmiKoyPE5FAsffdn5LrHUOlKrIS4CnR7JzGrRIASpeqdfW0gyNXffcmaF260RQiwhq6ppqCbreCCtwaEmFvV2jY87cXqSJUUdYAR5V9u8Jno7OUw4zOsY3gm9IOpF2b3inmYitKfp8czPbbNDp2Jtgxng64NyoqJWY1oJXtcFLIUEirP2R/b7/mRx+mx33+KKrM9IuFjXh+qE2QppQTCjolDZ2gQQe1sxhnKnS8+2O9usbfVPr+ZzZh3VqAqhg8qZQvupMN5t2TbHpun3bpvvplJGRqIADrmQCRbJ44BlB9ediPHJ7b0Ibz3mHRilGXODExXNhW0xfUnTS/a4aXqFFyTt+5IP3fHn5NDyO7cslCuHVuEbEKIhOmY3lxX1AABWGZjyTRqrlZqkByiRRQzzcW8bytajiut+ZhUKzPLemReF2QfbXAXPAECpDIlyBW9iXBpeKZkyW8cr3VKCkMih4GOtDB1wBKB80z7Ko+LdBWcVwkzOaoo9j8zCmpLjyDE2cJKHXQs1LdhdCIA4B06dV1oGkJaAyi4VUPEjuTh18BaZ8fkWM1Xf3sklVrSAppfByPhYtsFJXUCMAegHsVEXJc0kVrRLSwt5FnSDOWUQaSCEjAxhWLbrUE9Azkfu26iIvIJumsd+xMI7ZgAoNrEi2JbNpgova2XMXwvHoS5uERPCB6I/zSs7Gl5cz6flyigsKaG2Pk5PYbN3cS8cu+8U7DWo9rkkptJZUxY6qUHHnBmSsywbLypov2fKeXj2f3+qr9t7eSn7+2ZgX4bc+vmijfq5RHoteLuZz+/zqvtDauT7t74Py3cBTYlDMIy5co7OB/e2o5p/mzjcbpSQ10JECfpjsiShPa20yxDbS/ehSIEQK0eIhKtqidVXIlL3mMhOJbHOi+wq1ElUzuSjyHsFrowrf+pW72jtJu2CJPYzn3uDQqaWtOe9k9xCT4pDgHkamAyN4SbOnh5t1Ze0uILi5+Zt8eXOI5v6ddQFFKSkHcLyPB+WCDCrQztkVMEV2686bNl/yrktc9UqlW+anPUbl0oJFjCNVz3gZq18tccBCIPfsuTs4H64jxspWYDd8SMRaukfSpklq4MyCn6pIVZ8qBxcXYUgNbBekfDKkTgnrCdoaZHVDt0Qb5GP0M4In7YOuXPoVqM+XaFBDADji/MSfhMtLsclucDgNO9ZBms19uWj10ud8MCgfnAHetbSDSsBxLkpvgbt/pvgwBs/4DE/jkZiTA/SFQ8lsgegq3TNRay5yyWjmDfVIj+YtoqZRCsw9fPmyGF+wEf+EiRmE63oV7vX59PR8a+NGk4gjYyakZF8wlujjMSFi7tV5d2aEoAgQvUyirQoBKAilQFefA9CehUhR0gjpDm+phTRwuYpPyy5/OePy+RJdLht7PoO8HZQM05ofdgZmssork5JSGhMTcI5Pri/grcwykwjt+7ns49xYsFUJMYE8f5FXcR1Vzr3VA8FpuEDjfs8PSjBBTDbALVT5nTVqpeb+OXmZShPgSCe3IXZaKf+L75qHRsW4nYthVymzaakca8BdZQTuagDgV92YubpcX6qVA+7qQeBXGWxoUKZ0obHn5eDesMZAVhWArwNQv/tBNZ8rfwBZ3Qh8XYPpP2CXBN32DgLFCGgJx3Hoz/dYnHstN0IirwFvAfcBlyCAPp1Pp16frTiHp+NS/BhwDb4HdQrHGUWT3vYmGQBtEjK+iTn6S4drA0aQmxD8TPoZAABgJTDARmClAV7cuAaQwaNXh1PrOuzIgdGI2XYNPpUqr4tnK9IZ2UP9cAgAzOgHL42FLvqq3B8VWA/FoxWTUi+PUf6jDOBR71aGLlYY8Nn5YMCfYAR5bPeXdvtq70cH9OpEMPwF8IGH/TFKSYsphFvGJQcZrA1GlVtYLcofHbVIl3pcylFCgGWL7pfZDVM1bMDPAMCd/nje5R69YRoS8sF4ZWCu7rONJlH+8PYE8o4Tcl8OEAYc1Z8YHzFqxHzWHeZGgFH/aU16fTZGiEdHCgD8DN6A+7n2oAGM22Y4TrKX3WkQCmd06I3D+wpd2yhNjZiI4AaswHjGT7g4S2c8vCRGEgwx4MEtCBXRXZY1TZ4bHQkKK8CpOgIkFdPsz6KuDAQUQ3+P6qpY9Jb+96IYPfB4/eQcwKvnVwui1OTHKwdUo4CA7xiAjtnECwBhG/g0lWhAbpKWRdECPulRdSnc5sJMbilkXRyHUqltoQpYXMf5e7hoJNyjpbwWyUvXVVsaMzI/u/8Xjmliuzu50ZAUQayLZd6+EFF8o+gYy26lbq/gTlYUEEriap++3JHDQopj1/FxiIR6cNR/eahfJbYNPm7V7GxPym4XkzHdPtNaZm0hzmLKFnC/F8iGVJgAUXz+bLx7TfjoE5sNImshH9GQl8UpdCmjXEoy5BKK2vQLABn5RhOihKJsGBJeVRkyRYHPSHoJKo7i5UERUP1JDznlBdNkCsq+81tG6hKSGhYlJNO4lylMmZDvknwsNC2G/xlWLrJ7KAZYYG5yaQO7TPHOYe65JSwAeOYbnk2dr9ax1TPXeDYpntXM6qfr41WVgxLPD+9KknTk1XrBNfEcB2U7Wc9gyJvKonCPYorKslZeaWIGDJPycwMuwDf1f0u6BCQsnhvHaAseYo0R/rxJv8dQwQwq0XEGUAqeIRaCExcmGGgPZfUhKA0qLeMuYvhzKi1QSf6N5VMlyDkexlHOLk7iKGOWUg4pZ9PAMpWc27vELmVjFDEu0vXqUcSFzqWXtkBXM8Z9vbFo1HUevLVrOAalATUcPtZoo7NPtc23XTtXvyhtkfIz3sB9jq+Vgwf8ExXviRGIBijEycWiTPiZDTHl3YdBQCPHMUhFBFga27xHeAe/RxmFxR4j2s2z7OE9jp39ezx30/eMBKtjMk5/hSkT4SeIGwlvOeu7tudPzDUCNbaKII3F31gwMViig3ZqtZehq1o6LerlTLrOcalTPAxaXTXfS4MWTbOuaDRoF4lbg45WhoZsUnlaNuhJp8nYdUnc7qqjSH78+lKvsxZJomur8tUlqONbasEmfnKlysqknvCT/D4FRVGvd96O+dLbkwriK5C/gFcjKtN+E5URqq/aJt3o1OqsKr90k0gqpPZeOltkSCtojyDNQhJE51P4tvNKoKMjTaY5YWdUsMHfXQPfJV8UoJxWYrrN0QAwLSFIkSpNugyqhCIz4U/sLnKVzF/2FChU9P1DYakob255JTkFJTfuPHjy4s2HLz+U/9UNFCRYiFBhwkWIFCVaDHMWLFmxZsOWHXsORGRMbLZFIlNrODLmRIyz3Q5bbXPUMfsdsMpqS7AWc2VAIla8KjXMxNkbAISq6Q030hijjTXPfEMSRngY4iWoZeS9KT7YScqZiyNGWGqfoYnAMALTHdSijU6r9tpZqINXOuqsi05u6Kq7HroFiJ566aOv3hbpZ5NR3ulvoEEGeGO3U06os0699SbSJhIvNTjptDPOfmck2biETX/tJtlgo7euuqbZda/NSBQ++uRDVRFjHdfDCaGIFBtJpFS1hiqT5/VnscZ9JXFNelQoC1RqjdbUzIW5haWVtUsbWmert3PVp74bt+7sHdzn7C5hlqwG2Zy1/Pq+3NVYW8XlWq7Aplu8fidh8qo2m8u6Nb7mkmB4S2GihJLKVkppl5ZqKKa4QiWUVLZSSju1Akd2er5lVeV/B0LWrtzv307l+fees3esDS2nbepMVuCBSiitmAKXZjufOvYu8TUGy9+k/xUyG8rrN1b8z516RQWr/GXl/ypLnoZOZFQ+tqEbOs6KbS59q0f+G3LI3Yiun25zEzYZ3qcUlAfcDPqRNr+F/eO/BX41FKa0O05Up9Xpxki8jDWK9At3Vcmml5OL6XnlbHpaOZlmciFnciLHlaPpYeVgul/Zm+5WdqbpJKkdyYHsyY4ko1my+59AgA2iv6i6Qek2RwN4xRvQtx1ZmXXqYQ6HFUUtv/GR6Pfo979+4UydEPe34n+1cMRIZCwZZtzcml1Pru6hIxO+1K8B"
};
const STANDALONE_HTML = "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <meta name=\"color-scheme\" content=\"light dark\" />\n    <link rel=\"icon\" href=\"data:,\" />\n    <title>Download stats</title>\n    <script type=\"module\">var e={\"&\":`&amp;`,\"<\":`&lt;`,\">\":`&gt;`,'\"':`&quot;`,\"'\":`&#39;`},t=e=>(Math.round(e)||0).toLocaleString(`en-US`),n=e=>e==null?`—`:e.toLocaleString(`en-US`,{minimumFractionDigits:1,maximumFractionDigits:1}),r=e=>e==null?`—`:(e>0?`+`:``)+t(e),i=(e,n)=>`${t(e)} ${n}${e===1?``:`s`}`,a=(e,t)=>`${t>0?Math.round(e/t*100):0}%`,o=t=>t.replace(/[&<>\"']/g,t=>e[t]??t),s=e=>e.slice(0,10),c=`ignored`;function l(e){return e.groups.filter(e=>e.name!==c)}function u(e,t){return e.epoch>=0?t[e.epoch]?.label??e.version??``:t.length?`Before ${t[0].version}`:`All releases`}function d(e,t){return e.epoch>=0?e.version??``:t.length?`<${t[0].version}`:`all`}function f(e,t){let n=new Map;for(let r of e.releases)for(let e of r.files)e.group===t&&n.set(e.label,(n.get(e.label)??0)+e.downloads);return[...n.entries()].sort((e,t)=>t[1]-e[1])}function p(e){let t=[];for(let n of l(e)){let r=f(e,n.name).map(([e,t])=>({key:`${n.name}\\u0001${e}`,group:n,label:e,downloads:t}));t.push(...r)}return t}function m(e){let t=new Map;for(let n of e.files)t.set(`${n.group}\\u0001${n.label}`,n.downloads);return t}var h=864e5,g=[`Jan`,`Feb`,`Mar`,`Apr`,`May`,`Jun`,`Jul`,`Aug`,`Sep`,`Oct`,`Nov`,`Dec`];function _(e){return v(e).long(0)}function v(e){let t=Date.parse(`${e}T00:00:00Z`),n=e=>new Date(t+e*h),r=e=>`${g[n(e).getUTCMonth()]} ${n(e).getUTCDate()}`;return{indexOf:e=>Math.round((e-t)/h),date:n,iso:e=>n(e).toISOString().slice(0,10),short:r,long:e=>`${r(e)}, ${n(e).getUTCFullYear()}`,monthYear:e=>`${g[n(e).getUTCMonth()]} ${n(e).getUTCFullYear()}`,year:e=>n(e).getUTCFullYear(),month:e=>n(e).getUTCFullYear()*12+n(e).getUTCMonth()}}function y(e,t,n,r){let i=n-t,a=[];if(i<=45){let o=Math.ceil(i/r);for(let r=t+o;r<=n;r+=o)a.push([r,e.short(r)])}else if(i<=400){let i=[];for(let r=e.month(t)+1;r<=e.month(n);r++){let a=e.indexOf(Date.UTC(Math.floor(r/12),r%12,1));a>t&&a<=n&&i.push([r,a])}let o=[1,2,3,6,12].find(e=>i.filter(([t])=>t%e===0).length<=r)??12;i.filter(([e])=>e%o===0).forEach(([e,t],n)=>a.push([t,n===0||e%12==0?`${g[e%12]} ${Math.floor(e/12)}`:g[e%12]]))}else{let i=[];for(let r=e.year(t)+1;r<=e.year(n);r++){let a=e.indexOf(Date.UTC(r,0,1));a>t&&a<=n&&i.push([r,a])}let o=[1,2,5].find(e=>i.filter(([t])=>t%e===0).length<=r)??5;i.filter(([e])=>e%o===0).forEach(([e,t])=>a.push([t,String(e)]))}return a}function b(e,t,n,r){let i=Math.min(n-1,Math.max(r,Math.round(t-e))),a=Math.max(0,Math.min(Math.round(e),n-1-i));return{a,b:a+i}}function x(e,t,n,r,i){let a=Math.round(n);return b(e-t*a,e-t*a+a,r,i)}function S(e,t){return e?Math.max(0,t-e):0}function C(e){let t=Math.max(1,e),n=10**Math.floor(Math.log10(t));for(let e of[1,1.5,2,2.5,3,4,5,6,8,10])if(e*n>=t)return e*n;return 10*n}function w(e){return C(Math.ceil(Math.max(4,e)/4))*4}function T(e,t=4){let n=e/t;return Array.from({length:t+1},(e,t)=>n*t)}function E(e){return`var(--c${Math.min(Math.max(0,e.color),7)})`}var D=`http://www.w3.org/2000/svg`;function O(e,t={},n){let r=document.createElementNS(D,e);for(let e of Object.keys(t))r.setAttribute(e,String(t[e]));return n?.appendChild(r),r}function k(e,t,n){e.setAttribute(`viewBox`,`0 0 ${t} ${n}`),e.setAttribute(`width`,String(t)),e.setAttribute(`height`,String(n)),e.replaceChildren()}function A(e,t=300){return Math.max(t,(e.parentElement?.clientWidth??t)-4)}function j(e,t,n,r,i){let a=Math.min(i,r,n/2);return`M${e},${t+r}V${t+a}Q${e},${t} ${e+a},${t}H${e+n-a}Q${e+n},${t} ${e+n},${t+a}V${t+r}Z`}function ee(e,t,n,r=.22){let i=e.querySelector(`defs`)??O(`defs`,{},e),a=O(`linearGradient`,{id:t,x1:0,y1:0,x2:0,y2:1},i);return O(`stop`,{\"stop-color\":n,\"stop-opacity\":r},a),O(`stop`,{offset:1,\"stop-color\":n,\"stop-opacity\":.02},a),`url(#${t})`}function M(e,t,n,r,i,a){for(let o of t)O(`line`,{x1:r,x2:i,y1:n(o),y2:n(o),class:o===0?`base`:`axis`},e),O(`text`,{x:r-8,y:n(o)+4,\"text-anchor\":`end`},e).textContent=a(o)}function N(e,t,n,r,i){return O(`rect`,{x:t,y:n,width:Math.max(0,r),height:Math.max(0,i),fill:`transparent`},e)}var P=`tipzone`;function F(){return document.getElementById(`tip`)}function I(e,t){let n=F();n.innerHTML=e,n.style.display=`block`;let r=n.offsetWidth,i=n.offsetHeight,a=t.clientX+14,o=t.clientY+14;a+r>innerWidth-8&&(a=t.clientX-r-14),o+i>innerHeight-8&&(o=t.clientY-i-14),n.style.left=`${Math.max(8,a)}px`,n.style.top=`${Math.max(8,o)}px`}function L(){F().style.display=`none`}function R(e,t){e.classList.add(P),e.addEventListener(`pointermove`,e=>t(e)),e.addEventListener(`pointerdown`,e=>t(e)),e.addEventListener(`pointerleave`,e=>{e.pointerType!==`touch`&&L()})}function z(){document.addEventListener(`pointerdown`,e=>{let t=e.target;e.pointerType===`touch`&&!t.closest?.(`.${P}`)&&L()})}function B(e){let t=document.createElement(`section`);return t.innerHTML=e,t}function V(e){if(e.length<2)return``;let t=e.map(e=>e.dashed?`<i class=\"line\" style=\"background:${e.color}\"></i>`:`<i class=\"sw\" style=\"background:${e.color}\"></i>`);return`<div class=\"legend\">${e.map((e,n)=>`<span>${t[n]}${o(e.label)}</span>`).join(``)}</div>`}var H=6,te=10,ne=[[`All`,0],[`1y`,365],[`90d`,90],[`30d`,30]],re={l:`ew-resize`,r:`ew-resize`,pan:`grab`,new:`crosshair`};function ie(e){let r=l(e),i=r.map(t=>e.estimatedDaily.groups[t.name]??[]),a=Math.max(0,...i.map(e=>e.length));if(a===0)return{el:B(`<div><h2>Downloads per day over time</h2><p class=\"note\">Nothing to estimate yet.</p></div>`)};let s=v(e.estimatedDaily.start),c=`<thead><tr><th>Day</th>${r.map(e=>`<th>${o(e.label)}</th>`).join(``)}</tr></thead><tbody>`+Array.from({length:a},(e,t)=>`<tr><td>${o(s.long(t))}</td>${i.map(e=>`<td>${n(e[t]??0)}</td>`).join(``)}</tr>`).join(``)+`</tbody>`,u=B(`<div><h2>Downloads per day over time<span class=\"est\">estimated</span></h2><p class=\"note\">Uniform-spread estimate: a release's downloads are assumed to arrive at a constant rate while it was the latest release, so the lines step at each release and cannot show spikes inside a window. Hover for a day. Drag the strip below to choose the range; wheel or pinch over the chart to zoom, double-click to reset.</p></div><div class=\"presets\"><span class=\"group\" data-presets></span></div>`+V(r.map(e=>({label:e.label,color:E(e)})))+`<div class=\"scroll\"><svg data-chart role=\"img\" aria-label=\"Estimated downloads per day over time, by group\"></svg></div><div class=\"scroll\"><svg data-strip role=\"img\" aria-label=\"Overview of the whole series with the range shown above\"></svg></div><details><summary>Table view</summary><div class=\"scroll\"><table>${c}</table></div></details>`),d=u.querySelector(`[data-chart]`),f=u.querySelector(`[data-strip]`),p=u.querySelector(`[data-presets]`),m={a:0,b:a-1},h={W:0,left:0,right:0},g={W:0,left:0,right:0},_=e=>{m=b(e.a,e.b,a,H),F(),U(),P()},D=ne.map(([e,t])=>{let n=document.createElement(`button`);return n.type=`button`,n.textContent=e,n.addEventListener(`click`,()=>_({a:S(t,a),b:a-1})),p.appendChild(n),n}),j=document.createElement(`span`);j.className=`note`,p.parentElement.appendChild(j);let P=()=>{let e=!1;ne.forEach(([,t],n)=>{let r=!e&&m.a===S(t,a)&&m.b===a-1;e||=r,D[n].setAttribute(`aria-pressed`,String(r))}),j.textContent=`${s.long(m.a)} to ${s.long(m.b)}`};P();let F=()=>{let e=A(d),a=Math.max(0,...r.map(e=>e.label.length*6.5)),c={l:44,r:Math.min(Math.round(a)+20,Math.round(e*.3)),t:16,b:28},{a:l,b:u}=m,f=Math.max(1,u-l),p=e-c.l-c.r;k(d,e,280),h={W:e,left:c.l,right:c.r};let g=w(Math.max(1,...i.flatMap(e=>e.slice(l,u+1)))),_=e=>c.l+p*(e-l)/f,v=e=>c.t+(280-c.t-c.b)*(1-e/g);M(d,T(g),v,c.l,e-c.r,t),f>400&&(O(`text`,{x:c.l,y:272},d).textContent=String(s.year(l)));for(let[e,t]of y(s,l,u,Math.max(2,Math.floor(p/72))))f>400&&_(e)<c.l+30||(O(`text`,{x:_(e),y:272,\"text-anchor\":`middle`},d).textContent=t,O(`line`,{x1:_(e),x2:_(e),y1:v(0),y2:v(0)+4,class:`axis`},d));[...r.entries()].reverse().forEach(([e,t])=>{let n=i[e]??[],r=E(t),a=n.slice(l,u+1).map((e,t)=>`${_(l+t).toFixed(1)},${v(e).toFixed(1)}`).join(`L`);O(`path`,{d:`M${_(l)},${v(0)}L${a}L${_(u)},${v(0)}Z`,fill:ee(d,`estimated-fade-${e}`,r)},d),O(`path`,{d:`M${a}`,fill:`none`,stroke:r,\"stroke-width\":2,\"stroke-linejoin\":`round`,\"stroke-linecap\":`round`},d),O(`circle`,{cx:_(u),cy:v(n[u]??0),r:4,fill:r,stroke:`var(--surface)`,\"stroke-width\":2},d)});let b=r.map((e,t)=>({g:e,y:v(i[t]?.[u]??0)})).sort((e,t)=>e.y-t.y);b.forEach((e,t)=>{let n=b[t-1];n&&e.y-n.y<13&&(e.y=n.y+13)});for(let t of b){let n=_(u),r=n+10+t.g.label.length*6.5>e-2;O(`text`,{x:r?n-10:n+10,y:Math.min(280-c.b-4,t.y+4),class:`ink`,\"text-anchor\":r?`end`:`start`},d).textContent=t.g.label}let x=O(`line`,{y1:c.t,y2:v(0),class:`base`,visibility:`hidden`},d),S=r.map(e=>O(`circle`,{r:4,fill:E(e),stroke:`var(--surface)`,\"stroke-width\":2,visibility:`hidden`},d)),C=N(d,c.l,c.t,p,280-c.t-c.b);R(C,e=>{let t=e.clientX-d.getBoundingClientRect().left,a=Math.max(l,Math.min(u,Math.round(l+(t-c.l)/p*f)));x.setAttribute(`x1`,String(_(a))),x.setAttribute(`x2`,String(_(a))),x.setAttribute(`visibility`,`visible`),i.forEach((e,t)=>{S[t]?.setAttribute(`cx`,String(_(a))),S[t]?.setAttribute(`cy`,String(v(e[a]??0))),S[t]?.setAttribute(`visibility`,`visible`)});let m=r.map((e,t)=>`${o(e.label)}: ${n(i[t]?.[a]??0)}/day (est.)`);I(`<b>${o(s.long(a))}</b><br>${m.join(`<br>`)}`,e)}),C.addEventListener(`pointerleave`,()=>{x.setAttribute(`visibility`,`hidden`),S.forEach(e=>e.setAttribute(`visibility`,`hidden`))})},L=()=>g.W-g.left-g.right,z=e=>g.left+L()*e/Math.max(1,a-1),ie=e=>(e-g.left)*Math.max(1,a-1)/L(),U=()=>{let e=A(f),t={l:44,r:44,t:4,b:4};k(f,e,56),g={W:e,left:t.l,right:t.r};let n=C(Math.max(1,...i.flat())),o=e=>t.t+(56-t.t-t.b)*(1-e/n);r.forEach((e,t)=>{let n=(i[t]??[]).map((e,t)=>`${z(t).toFixed(1)},${o(e).toFixed(1)}`).join(`L`);O(`path`,{d:`M${z(0)},${o(0)}L${n}L${z(a-1)},${o(0)}Z`,fill:E(e),\"fill-opacity\":.16},f),O(`path`,{d:`M${n}`,fill:`none`,stroke:E(e),\"stroke-opacity\":.7,\"stroke-width\":1,\"stroke-linejoin\":`round`},f)}),O(`line`,{x1:t.l,x2:e-t.r,y1:o(0)+.5,y2:o(0)+.5,class:`base`},f);let s=z(m.a),c=z(m.b);O(`rect`,{x:t.l,y:0,width:s-t.l,height:56,fill:`var(--surface)`,\"fill-opacity\":.72},f),O(`rect`,{x:c,y:0,width:e-t.r-c,height:56,fill:`var(--surface)`,\"fill-opacity\":.72},f),O(`rect`,{x:s+.5,y:.5,width:Math.max(0,c-s-1),height:55,fill:`none`,stroke:`var(--ink2)`,\"stroke-opacity\":.6,\"stroke-width\":1,rx:3},f);for(let e of[s,c])O(`rect`,{x:e-3.5,y:18,width:7,height:20,rx:3.5,fill:`var(--ink2)`,stroke:`var(--surface)`,\"stroke-width\":1.5},f)},W=e=>{let t=z(m.a),n=z(m.b),r=Math.min(te,(n-t)/3),i=Math.abs(e-t),a=Math.abs(e-n);return Math.min(i,a)<=r?i<=a?`l`:`r`:e>t&&e<n?`pan`:`new`},G=(e,t)=>t.clientX-e.getBoundingClientRect().left,K=null;f.addEventListener(`pointerdown`,e=>{let t=G(f,e);K={mode:W(t),px0:t,a0:m.a,b0:m.b,anchor:Math.max(0,Math.min(a-1,Math.round(ie(t))))},f.setPointerCapture(e.pointerId)}),f.addEventListener(`pointermove`,e=>{let t=G(f,e);if(!K){f.style.cursor=re[W(t)];return}let n=Math.round(ie(t)),r=Math.round((t-K.px0)*(a-1)/L()),{a0:i,b0:o,anchor:s}=K;K.mode===`pan`?_({a:i+r,b:o+r}):K.mode===`l`?_({a:Math.min(Math.max(0,n),o-H),b:o}):K.mode===`r`?_({a:i,b:Math.max(Math.min(a-1,n),i+H)}):_(n>=s?{a:s,b:Math.max(n,s+H)}:{a:Math.min(n,s-H),b:s})});let q=()=>{K=null};f.addEventListener(`pointerup`,q),f.addEventListener(`pointercancel`,q);let J=()=>_({a:0,b:a-1});f.addEventListener(`dblclick`,J),d.addEventListener(`dblclick`,J);let Y=e=>Math.max(m.a,Math.min(m.b,m.a+(e-h.left)/(h.W-h.left-h.right)*(m.b-m.a)));d.addEventListener(`wheel`,e=>{e.preventDefault();let t=m.b-m.a,n=Y(G(d,e)),r=(n-m.a)/t,i=Math.round(t*Math.exp(e.deltaY*(e.deltaMode?.04:.002)));i===t&&e.deltaY&&(i=t+Math.sign(e.deltaY)),_(x(n,r,i,a,H))},{passive:!1});let X=new Map,Z=null,ae=()=>{let[e,t]=[...X.values()];return{px:(e.x+t.x)/2-d.getBoundingClientRect().left,d:Math.hypot(e.x-t.x,e.y-t.y)}};d.addEventListener(`pointerdown`,e=>{if(e.pointerType===`touch`&&(X.set(e.pointerId,{x:e.clientX,y:e.clientY}),X.size===2)){let e=ae();if(e.d>0){let t=m.b-m.a,n=Y(e.px);Z={d:e.d,len:t,centre:n,t:(n-m.a)/t}}}}),d.addEventListener(`pointermove`,e=>{if(X.has(e.pointerId)&&(X.set(e.pointerId,{x:e.clientX,y:e.clientY}),Z&&X.size===2)){let e=ae();e.d>0&&_(x(Z.centre,Z.t,Z.len*Z.d/e.d,a,H))}});let oe=e=>{X.delete(e.pointerId),X.size<2&&(Z=null)};return d.addEventListener(`pointerup`,oe),d.addEventListener(`pointercancel`,oe),{el:u,redraw:()=>{F(),U()}}}function U(e){let n=e.measuredDaily.at(-1),i=[],a=l(e);i.push({label:`All-time downloads`,value:e.totals.downloads,change:n?a.reduce((e,t)=>e+(n.groups[t.name]??0),0):null});for(let t of a)i.push({label:t.label,value:e.totals.groups[t.name]??0,change:n?n.groups[t.name]??0:null,swatch:E(t)});e.totals.docker!==null&&i.push({label:`Docker pulls`,value:e.totals.docker,change:n?n.docker:null});for(let t of e.counters)i.push({label:t.label,value:e.totals.counters[t.name]?.downloads??0,change:n?n.counters[t.name]??0:null,note:t.from?`Counted from ${t.from}`:void 0});i.push({label:`GitHub stars`,value:e.totals.stars,change:n?n.stars:null});let s=B(`<div class=\"kpis\">${i.map(e=>{let i=!n||e.change===null?`<div class=\"d\">no change data</div>`:`<div class=\"d\"><b class=\"${e.change>0?`pos`:``}\">${r(e.change)}</b> on <span class=\"nw\">${o(n.date)}</span>${n.days>1?` (over ${n.days} days)`:``}</div>`,a=e.swatch?`<i class=\"sw\" style=\"background:${e.swatch}\"></i>`:``,s=e.note?`<div class=\"note\">${o(e.note)}</div>`:``;return`<div class=\"kpi\"><div class=\"l\">${a}${o(e.label)}</div><div class=\"v\">${t(e.value)}</div>${i}${s}</div>`}).join(``)}</div>`);return s.className=`kpis-wrap`,{el:s}}function W(e){let t=e[0];if(!t)return null;let n=v(t.date),r=new Map;for(let t of e)r.set(n.indexOf(Date.parse(`${t.date}T00:00:00Z`)),t);return{axis:n,last:Math.max(...r.keys()),byDay:r}}function G(e,t,n=56){let r=t<8,i=[],a=-1/0;for(let o=0;o<=e.last;o++){if(r&&e.axis.date(o).getUTCDate()!==1)continue;let s=o*t;s-a<n||(a=s,i.push(o))}return i}function K(e,t,n){if(n>=8)return e.axis.short(t);let r=e.axis.date(t),i=e.axis.short(t).split(` `)[0];return r.getUTCMonth()===0?`${i} ${r.getUTCFullYear()}`:i}function q(e,t,n=2){let r=e.map(e=>Math.max(0,e)),i=-1;r.forEach((e,t)=>{e>0&&(i=t)});let a=[],o=0;return r.forEach((e,r)=>{if(e<=0)return;let s=t(o),c=t(o+e),l=r===i,u=l?c:Math.min(c+n,s-1);a.push({index:r,y:u,height:s-u,top:l}),o+=e}),a}var J=240,Y={l:44,r:44,t:26,b:28},X=3;function Z(e){let t=l(e),n=e.measuredDaily,i=W(n),a=n.some(e=>e.docker!==null),s=V([...t.map(e=>({label:e.label,color:E(e)})),...a?[{label:`Docker pulls (right axis)`,color:`var(--muted)`,dashed:!0}]:[]]),c=n[0],u=c?`Measured from the daily snapshots that started on ${_(v(c.date).iso(-c.days))}; it gains a bar every day.`:`Needs two daily snapshots; the first bar appears after the next one.`,d=`<table>${`<thead><tr><th>Day</th>${t.map(e=>`<th>${o(e.label)}</th>`).join(``)}<th>Total</th>`+(a?`<th>Docker</th>`:``)+`<th>Stars</th>`+e.counters.map(e=>`<th>${o(e.label)}</th>`).join(``)+`</tr></thead>`}<tbody>${n.map(n=>{let i=t.reduce((e,t)=>e+(n.groups[t.name]??0),0);return`<tr><td>${o(_(n.date))}${n.days>1?`<small>over ${n.days} days</small>`:``}</td>`+t.map(e=>`<td>${r(n.groups[e.name]??0)}</td>`).join(``)+`<td>${r(i)}</td>`+(a?`<td>${r(n.docker)}</td>`:``)+`<td>${r(n.stars)}</td>`+e.counters.map(e=>`<td>${r(n.counters[e.name]??0)}</td>`).join(``)+`</tr>`}).join(``)}</tbody></table>`,f=B(`<div><h2>Measured downloads per day<span class=\"est meas\">measured</span></h2><p class=\"note\">${o(u)}</p></div>`+(n.length?s:``)+`<div class=\"scroll\" data-chart${n.length?``:` hidden`}><svg role=\"img\" aria-label=\"Measured downloads per day by group, with Docker pulls on a right axis\"></svg></div><div class=\"scroll\" data-table${n.length&&n.length<X?``:` hidden`}>${d}</div>`),p=f.querySelector(`svg`);return{el:f,redraw:()=>{i&&ae(p,e,i,a)}}}function ae(e,n,r,i){let a=l(n),s=A(e);k(e,s,J);let c=r.last+1,u=(s-Y.l-Y.r)/c,d=Math.max(1,Math.min(24,u-2)),f=e=>Y.l+u*(e+.5),p=e=>Math.max(0,e??0),m=[...r.byDay.entries()],h=w(Math.max(0,...m.map(([,e])=>a.reduce((t,n)=>t+p(e.groups[n.name]),0)))),g=w(Math.max(0,...m.map(([,e])=>p(e.docker)))),_=e=>Y.t+(J-Y.t-Y.b)*(1-e/h),v=e=>Y.t+(J-Y.t-Y.b)*(1-e/g);if(M(e,T(h),_,Y.l,s-Y.r,t),O(`text`,{x:2,y:Y.t-10,class:`ink`},e).textContent=`downloads`,i){for(let n of T(g))O(`text`,{x:s-Y.r+8,y:v(n)+4},e).textContent=t(n);O(`text`,{x:s-2,y:Y.t-10,\"text-anchor\":`end`},e).textContent=`Docker`}for(let[t,n]of m){let r=f(t)-d/2;for(let t of q(a.map(e=>p(n.groups[e.name])),_)){let n=a[t.index];n&&(t.top?O(`path`,{d:j(r,t.y,d,t.height,4),fill:E(n)},e):O(`rect`,{x:r,y:t.y,width:d,height:t.height,fill:E(n)},e))}}if(i){let t=``,n=!1;for(let e=0;e<=r.last;e++){let i=r.byDay.get(e);!i||i.docker===null?n=!1:(t+=`${n?`L`:`M`}${f(e).toFixed(1)},${v(p(i.docker)).toFixed(1)}`,n=!0)}if(O(`path`,{d:t,fill:`none`,stroke:`var(--muted)`,\"stroke-width\":2,\"stroke-linejoin\":`round`,\"stroke-linecap\":`round`},e),u>=8)for(let[t,n]of m)n.docker!==null&&O(`circle`,{cx:f(t),cy:v(p(n.docker)),r:4,fill:`var(--muted)`,stroke:`var(--surface)`,\"stroke-width\":2},e)}for(let t of G(r,u))O(`text`,{x:f(t),y:232,\"text-anchor\":`middle`},e).textContent=K(r,t,u);for(let t=0;t<=r.last;t++){let i=r.byDay.get(t);R(N(e,Y.l+u*t,Y.t,u,J-Y.t-Y.b),e=>I(i?oe(i,n):`<b>${o(r.axis.long(t))}</b><br>No snapshot that day`,e))}}function oe(e,t){let n=l(t),i=n.reduce((t,n)=>t+(e.groups[n.name]??0),0),a=[...e.days>1?[`Change over ${e.days} days`]:[],...n.map(t=>`${o(t.label)}: ${r(e.groups[t.name]??0)}`),`Total: ${r(i)}`,`Docker: ${r(e.docker)}`,`Stars: ${r(e.stars)}`,...t.counters.map(t=>`${o(t.label)}: ${r(e.counters[t.name]??0)}`)];return`<b>${o(_(e.date))}</b><br>${a.join(`<br>`)}`}function se(e){let r=l(e),i=e.counters,a=e=>`<td>${e}</td>`,s=`<thead><tr><th>Period</th><th>Releases</th>${r.map(e=>`<th>${o(e.label)}</th>`).join(``)}<th>Total</th>`+i.map(e=>`<th>${o(e.label)}</th>`).join(``)+r.map(e=>`<th>Avg/day ${o(e.label)}</th>`).join(``)+`<th>Avg/day all</th>`+r.map(e=>`<th>Median/day ${o(e.label)}</th>`).join(``)+`<th>Median/day all</th></tr></thead>`,c=e.periods.map(s=>{let c=s.releases===0,l=s.firstTag===null?``:`<small>${o(s.firstTag)}${s.lastTag&&s.lastTag!==s.firstTag?` to ${o(s.lastTag)}`:``}</small>`;return`<tr><td>${o(u(s,e.epochs))}${l}</td><td>${s.releases}</td>`+r.map(e=>a(t(s.groups[e.name]??0))).join(``)+a(`<b>${t(s.downloads)}</b>`)+i.map(e=>{let n=s.counters[e.name];return a(n?.counted?t(n.downloads):`—`)}).join(``)+r.map(e=>a(c?`—`:n(s.avgPerDay[e.name]??0))).join(``)+a(c?`—`:n(s.avgPerDayTotal))+r.map(e=>a(n(s.medianPerDay[e.name]??null))).join(``)+a(n(s.medianPerDayTotal))+`</tr>`}),d=2*r.length+2,f=`<tr><td><b>All time</b></td><td>${e.releases.length}</td>`+r.map(n=>a(`<b>${t(e.totals.groups[n.name]??0)}</b>`)).join(``)+a(`<b>${t(e.totals.downloads)}</b>`)+i.map(n=>a(t(e.totals.counters[n.name]?.downloads??0))).join(``)+`<td colspan=\"${d}\"></td></tr>`,p=e.periods.at(-1),m=p&&p.releases>0&&p.fullDays===0?`<p class=\"note\">Medians show a dash for ${o(u(p,e.epochs))}: it has no whole calendar day yet, and its average per day extrapolates a short window.</p>`:``,h=V(r.map(e=>({label:e.label,color:E(e)}))),g=B(`<div><h2>Periods<span class=\"est\">estimated</span></h2><p class=\"note\">GitHub only exposes cumulative counts per file, so per-day figures are estimates: each release's downloads are spread evenly over the days it was the latest release (until the next release, or now). Totals are exact. Medians are over whole calendar days (UTC) inside the period.</p></div><div class=\"scroll\"><table class=\"periods\">${s}<tbody>${c.join(``)}${f}</tbody></table></div>${m}${h}<div class=\"scroll\"><svg role=\"img\" aria-label=\"Average estimated downloads per day by period\"></svg></div>`),_=g.querySelector(`svg`),v=g.querySelector(`.scroll`);return v.addEventListener(`scroll`,()=>ce(v)),{el:g,redraw:()=>{ce(v),le(_,e)}}}function ce(e){e.classList.toggle(`more`,e.scrollWidth-e.clientWidth-e.scrollLeft>1)}function le(e,r){let a=l(r),s=r.periods,c=A(e),f={l:44,r:16,t:26,b:58};k(e,c,230);let p=w(Math.max(0,...s.flatMap(e=>a.map(t=>e.avgPerDay[t.name]??0)))),m=e=>f.t+(230-f.t-f.b)*(1-e/p),h=(c-f.l-f.r)/Math.max(1,s.length);M(e,T(p),m,f.l,c-f.r,t),O(`text`,{x:f.l,y:10,class:`ink`},e).textContent=`Average estimated downloads per day`,s.forEach((s,c)=>{let l=f.l+h*(c+.5),p=Math.min(36,(h-8)/Math.max(1,a.length));a.forEach((i,c)=>{let d=s.avgPerDay[i.name]??0,f=l-a.length*p/2+c*p+1,h=m(0)-m(d);if(h<=0)return;let g=O(`path`,{d:j(f,m(d),p-2,h,4),fill:E(i)},e);O(`text`,{x:f+(p-2)/2,y:m(d)-6,\"text-anchor\":`middle`,class:`ink`},e).textContent=n(d),R(g,e=>I(`<b>${o(u(s,r.epochs))}</b><br>${o(i.label)}: ${n(d)}/day avg (est.)<br>${t(s.groups[i.name]??0)} downloads over ${s.days.toFixed(1)} ${s.days===1?`day`:`days`}`,e))}),O(`text`,{x:l,y:230-f.b+16,\"text-anchor\":`middle`,class:`ink`},e).textContent=d(s,r.epochs);let g=i(s.releases,`release`);g.length*6.5<=h?O(`text`,{x:l,y:230-f.b+30,\"text-anchor\":`middle`},e).textContent=g:(O(`text`,{x:l,y:230-f.b+30,\"text-anchor\":`middle`},e).textContent=t(s.releases),O(`text`,{x:l,y:230-f.b+44,\"text-anchor\":`middle`},e).textContent=s.releases===1?`release`:`releases`)})}function ue(e){return{el:B(`<div><h2>Platforms</h2><p class=\"note\">All-time downloads by file, summed over every release. Ignored files are excluded.</p></div><div class=\"cols\">${l(e).map(n=>{let r=f(e,n.name),i=Math.max(1,...r.map(([,e])=>e)),s=r.reduce((e,[,t])=>e+t,0),c=r.map(([e,r])=>`<div class=\"brow\"><span>${o(e)}</span><span class=\"t\"><i style=\"width:${r/i*100}%;background:${E(n)}\"></i></span><span>${t(r)} <small style=\"color:var(--muted)\">${a(r,s)}</small></span></div>`);return`<div><h2 style=\"font-size:14px;margin-bottom:8px\"><i class=\"sw\" style=\"background:${E(n)}\"></i>${o(n.label)}</h2><div class=\"bars\">${c.join(``)||`<p class=\"note\">No downloads yet.</p>`}</div></div>`}).join(``)}</div>`)}}var de=6,Q={l:44,r:12,t:56,b:58},fe=2,pe=14,$=300;function me(e){let r=l(e);if(e.releases.length===0)return{el:B(`<div><h2>Downloads per release</h2><p class=\"note\">No releases yet.</p></div>`)};let i=`<thead><tr><th>Release</th><th>Published</th><th>Live days</th>${r.map(e=>`<th>${o(e.label)}</th>`).join(``)}<th>Total</th>`+e.counters.map(e=>`<th>${o(e.label)}</th>`).join(``)+r.map(e=>`<th>${o(e.label)}/day</th>`).join(``)+`</tr></thead>`,a=e.releases.slice().reverse().map(i=>{let a=e.counters.map(e=>{let n=i.counters[e.name];return`<td>${n?.counted?t(n.downloads):`—`}</td>`}).join(``),c=r.map(e=>`<td>${i.days<1?`—`:n((i.groups[e.name]??0)/i.days)}</td>`).join(``),l=Object.values(i.groups).reduce((e,t)=>e+t,0);return`<tr><td>${o(i.tag)}</td><td>${s(i.publishedAt)}</td><td>${n(i.days)}</td>`+r.map(e=>`<td>${t(i.groups[e.name]??0)}</td>`).join(``)+`<td><b>${t(l)}</b></td>${a}${c}</tr>`}),c=B(`<div><h2>Downloads per release</h2><p class=\"note\">Total downloads of each release's files, oldest to newest. Markers show where an epoch starts. Recent releases have had less time to collect downloads. The per-day columns show a dash for releases that were the latest for under a day, since their downloads mostly came after they were replaced.</p></div>${V(r.map(e=>({label:e.label,color:E(e)})))}<div class=\"scroll\"><svg role=\"img\" aria-label=\"Stacked downloads per release by group\"></svg></div><details><summary>Table view</summary><div class=\"scroll\"><table>${i}<tbody>${a.join(``)}</tbody></table></div>`+ge(e)+`</details>`),u=c.querySelector(`svg`);return{el:c,redraw:()=>he(u,e)}}function he(e,n){let r=l(n),i=n.releases,a=A(e,Q.l+Q.r+de*i.length);k(e,a,$);let o=C(Math.max(0,...i.map(e=>_e(e,r)))),s=e=>Q.t+($-Q.t-Q.b)*(1-e/o),c=(a-Q.l-Q.r)/i.length,u=Math.min(32,Math.max(2,c-2)),d=c>=64,f=d?1:Math.max(1,Math.ceil(14/c));M(e,T(o),s,Q.l,a-Q.r,t),i.forEach((t,i)=>{let a=Q.l+c*i+(c-u)/2,o=q(r.map(e=>t.groups[e.name]??0),s);for(let t of o){let n=r[t.index];n&&(t.top?O(`path`,{d:j(a,t.y,u,t.height,4),fill:E(n)},e):O(`rect`,{x:a,y:t.y,width:u,height:t.height,fill:E(n)},e))}if(i%f===0){let n=d?O(`text`,{x:Q.l+c*(i+.5),y:$-Q.b+18,\"text-anchor\":`middle`},e):O(`text`,{transform:`translate(${Q.l+c*(i+.5)+3},${$-Q.b+10}) rotate(-60)`,\"text-anchor\":`end`},e);n.textContent=t.tag}R(N(e,Q.l+c*i,Q.t,c,$-Q.t-Q.b),e=>I(ve(t,n),e))});let p=-1,m=[];i.forEach((t,r)=>{if(t.epoch<0||t.epoch===p)return;p=t.epoch;let i=Q.l+c*r,o=n.epochs[t.epoch]?.version??``,l=o.length*6.5,u=Array.from({length:fe},(e,t)=>t).flatMap(e=>[{x:i+7,anchor:`start`,from:i+7,to:i+7+l},{x:i-7,anchor:`end`,from:i-7-l,to:i-7}].filter(t=>t.from>=2&&t.to<=a-2&&!m.some(n=>n.tier===e&&t.from<n.to+8&&n.from<t.to+8)).map(t=>({...t,tier:e})))[0],d=Q.t-12-(u?.tier??0)*pe;r>0&&(O(`line`,{x1:i,x2:i,y1:d,y2:s(0),class:`sep`},e),O(`circle`,{cx:i,cy:d,r:2.5,class:`cap`},e)),u&&(m.push({from:u.from,to:u.to,tier:u.tier}),O(`text`,{x:u.x,y:d+4,class:`ink`,\"text-anchor\":u.anchor},e).textContent=o)})}function ge(e){let t=e.counters.filter(e=>e.from).map(e=>`${o(e.label)} counts from ${o(e.from??``)}; earlier releases show a dash.`);return t.length?`<p class=\"note\">${t.join(` `)}</p>`:``}function _e(e,t){return t.reduce((t,n)=>t+(e.groups[n.name]??0),0)}function ve(e,n){let r=l(n),i=r.map(n=>`${o(n.label)}: ${t(e.groups[n.name]??0)}`),a=n.counters.filter(t=>e.counters[t.name]?.counted).map(n=>`${o(n.label)}: ${t(e.counters[n.name].downloads)}`);return`<b>${o(e.tag)}</b> ${s(e.publishedAt)}<br>${[...i,`Total: ${t(_e(e,r))}`,...a,`Live ${e.days.toFixed(1)} ${e.days===1?`day`:`days`}`].join(`<br>`)}`}function ye(e){let t=l(e),n=e.measuredDaily.some(e=>e.docker!==null),i=`<thead><tr><th>Date</th><th>Days</th>${t.map(e=>`<th>${o(e.label)} +</th>`).join(``)}<th>Total +</th>`+(n?`<th>Docker +</th>`:``)+`<th>Stars +</th>`+e.counters.map(e=>`<th>${o(e.label)} +</th>`).join(``)+`</tr></thead>`,a=e.measuredDaily.slice().reverse().map(i=>{let a=t.reduce((e,t)=>e+(i.groups[t.name]??0),0),s=e=>`<td class=\"${e!==null&&e>0?`pos`:``}\">${r(e)}</td>`;return`<tr><td>${o(i.date)}</td><td>${i.days}</td>`+t.map(e=>s(i.groups[e.name]??0)).join(``)+s(a)+(n?s(i.docker):``)+s(i.stars)+e.counters.map(e=>s(i.counters[e.name]??0)).join(``)+`</tr>`});return{el:B(`<div><h2>Daily snapshots<span class=\"est meas\">measured</span></h2><p class=\"note\">The change since the previous snapshot, dated by the later one. A day count above 1 means snapshots were missed in between. This table grows by a row every day.</p></div>`+(a.length?`<div class=\"scroll\"><table>${i}<tbody>${a.join(``)}</tbody></table></div>`:`<p class=\"note\">No change to show yet.</p>`))}}var be=864e5;function xe(e,t=30){let n=e[0],r=e.at(-1);if(!n||!r)return[];let i=Date.parse(n.date),a=Math.round((Date.parse(r.date)-i)/be),o=Math.max(1,Math.min(t,a+1)),s=Array.from({length:o},(e,t)=>o>1?Math.round(t*a/(o-1)):0),c=0;return s.filter((e,t)=>t===0||e!==s[t-1]).map(t=>{let n=new Date(i+t*be).toISOString().slice(0,10);for(;c+1<e.length&&e[c+1].date<=n;)c++;return{date:n,stars:e[c].stars}})}function Se(e){let t=e.length;if(t<2)return[];let n=e.slice(0,-1).map(([t,n],r)=>{let[i,a]=e[r+1];return i>t?(a-n)/(i-t):0}),r=Array(t);r[0]=n[0],r[t-1]=n[t-2];for(let e=1;e<t-1;e++){let t=n[e-1],i=n[e];r[e]=t*i<=0?0:(t+i)/2}for(let e=0;e<t-1;e++){let t=n[e];if(t===0){r[e]=0,r[e+1]=0;continue}let i=r[e]/t,a=r[e+1]/t,o=i*i+a*a;o>9&&(r[e]=3/Math.sqrt(o)*i*t,r[e+1]=3/Math.sqrt(o)*a*t)}return n.map((t,n)=>{let[i,a]=e[n],[o,s]=e[n+1],c=(o-i)/3;return{from:[i,a],c1:[i+c,a+r[n]*c],c2:[o-c,s-r[n+1]*c],to:[o,s]}})}function Ce(e){let[t]=e;if(!t)return``;let n=e=>e.toFixed(1),r=Se(e).map(e=>`C${n(e.c1[0])} ${n(e.c1[1])} ${n(e.c2[0])} ${n(e.c2[1])} ${n(e.to[0])} ${n(e.to[1])}`);return`M${n(t[0])} ${n(t[1])}${r.join(``)}`}var we=240,Te=60;function Ee(e,n){let r=A(e),i=we,a={l:44,r:16,t:16,b:28};k(e,r,i);let{axis:s,samples:c,xs:l,color:u}=n,d=c.length;if(d===0)return;let f=l[0],p=Math.max(f+1,l[d-1]),m=r-a.l-a.r,h=e=>a.l+m*(e-f)/(p-f),g=w(Math.max(0,...c.map(e=>e.stars))),_=e=>a.t+(i-a.t-a.b)*(1-e/g),v=_(0);M(e,T(g),_,a.l,r-a.r,t),O(`text`,{x:h(f),y:232,\"text-anchor\":`start`},e).textContent=s.monthYear(f);for(let[t,n]of y(s,f,p,Math.max(2,Math.floor(m/72))))h(t)-h(f)<Te||(O(`text`,{x:h(t),y:232,\"text-anchor\":`middle`},e).textContent=n);let b=Ce(c.map((e,t)=>[h(l[t]),_(e.stars)])),x=h(l[d-1]);O(`path`,{d:`${b}L${x.toFixed(1)},${v.toFixed(1)}L${h(f).toFixed(1)},${v.toFixed(1)}Z`,fill:ee(e,`${n.id}-fade`,u)},e),O(`path`,{d:b,fill:`none`,stroke:u,\"stroke-width\":2,\"stroke-linejoin\":`round`,\"stroke-linecap\":`round`},e),c.slice(0,-1).forEach((t,n)=>{O(`circle`,{cx:h(l[n]),cy:_(t.stars),r:3,fill:u,stroke:`var(--surface)`,\"stroke-width\":2},e)});let S=_(c[d-1].stars);O(`circle`,{cx:x,cy:S,r:4,fill:u,stroke:`var(--surface)`,\"stroke-width\":2},e),O(`text`,{x:x-8,y:Math.max(a.t+10,S-10),\"text-anchor\":`end`,class:`strong`},e).textContent=t(c[d-1].stars);let C=O(`line`,{y1:a.t,y2:v,class:`base`,visibility:`hidden`},e),E=O(`circle`,{r:4,fill:u,stroke:`var(--surface)`,\"stroke-width\":2,visibility:`hidden`},e),D=O(`rect`,{x:a.l,y:a.t,width:m,height:i-a.t-a.b,fill:`transparent`},e);R(D,n=>{let r=n.clientX-e.getBoundingClientRect().left,i=f+(r-a.l)/m*(p-f),u=0;l.forEach((e,t)=>{Math.abs(e-i)<Math.abs(l[u]-i)&&(u=t)});let d=c[u];C.setAttribute(`x1`,String(h(l[u]))),C.setAttribute(`x2`,String(h(l[u]))),C.setAttribute(`visibility`,`visible`),E.setAttribute(`cx`,String(h(l[u]))),E.setAttribute(`cy`,String(_(d.stars))),E.setAttribute(`visibility`,`visible`),I(`<b>${o(s.long(l[u]))}</b><br>${t(d.stars)} ${d.stars===1?`star`:`stars`}`,n)}),D.addEventListener(`pointerleave`,e=>{e.pointerType!==`touch`&&(C.setAttribute(`visibility`,`hidden`),E.setAttribute(`visibility`,`hidden`))})}var De=240,Oe=60;function ke(e,n){let r=A(e),i=De,a={l:44,r:16,t:16,b:28};k(e,r,i);let s=n.xs[0]??0,c=Math.max(s+1,n.xs[n.xs.length-1]??s+1),l=r-a.l-a.r,u=e=>a.l+l*(e-s)/(c-s),d=w(Math.max(0,...n.series.flatMap(e=>e.values.map(e=>e??0)))),f=e=>a.t+(i-a.t-a.b)*(1-e/d);M(e,T(d),f,a.l,r-a.r,t),n.startLabel&&(O(`text`,{x:u(s),y:232,\"text-anchor\":`start`},e).textContent=n.axis.monthYear(s));for(let[t,r]of y(n.axis,s,c,Math.max(2,Math.floor(l/72))))n.startLabel&&u(t)-u(s)<Oe||(O(`text`,{x:u(t),y:232,\"text-anchor\":`middle`},e).textContent=r);let p=n.series.length===1;n.series.forEach((r,i)=>{let o=``,s=!1;if(n.xs.forEach((e,t)=>{let n=r.values[t];n==null?s=!1:(o+=`${s?`L`:`M`}${u(e).toFixed(1)},${f(n).toFixed(1)}`,s=!0)}),!o)return;p&&O(`path`,{d:o.split(`M`).filter(Boolean).map(e=>{let t=e.split(`L`),[n]=t[0].split(`,`),[r]=t[t.length-1].split(`,`);return`M${n},${f(0).toFixed(1)}L${e}L${r},${f(0).toFixed(1)}Z`}).join(``),fill:ee(e,`${n.id}-fade-${i}`,r.color)},e),O(`path`,{d:o,fill:`none`,stroke:r.color,\"stroke-width\":2,\"stroke-linejoin\":`round`,\"stroke-linecap\":`round`},e);let l=r.values.length-1,d=r.values[l];if(p&&d!=null){let i=u(n.xs[l]??c),o=f(d);O(`circle`,{cx:i,cy:o,r:4,fill:r.color,stroke:`var(--surface)`,\"stroke-width\":2},e),O(`text`,{x:i-8,y:Math.max(a.t+10,o-10),\"text-anchor\":`end`,class:`strong`},e).textContent=t(d)}});let m=O(`line`,{y1:a.t,y2:f(0),class:`base`,visibility:`hidden`},e),h=n.series.map(t=>O(`circle`,{r:4,fill:t.color,stroke:`var(--surface)`,\"stroke-width\":2,visibility:`hidden`},e)),g=O(`rect`,{x:a.l,y:a.t,width:l,height:i-a.t-a.b,fill:`transparent`},e);R(g,r=>{let i=r.clientX-e.getBoundingClientRect().left,d=s+(i-a.l)/l*(c-s),p=0;n.xs.forEach((e,t)=>{Math.abs(e-d)<Math.abs((n.xs[p]??0)-d)&&(p=t)});let g=n.xs[p]??s;m.setAttribute(`x1`,String(u(g))),m.setAttribute(`x2`,String(u(g))),m.setAttribute(`visibility`,`visible`),n.series.forEach((e,t)=>{let n=e.values[p],r=h[t];r&&(r.setAttribute(`cx`,String(u(g))),r.setAttribute(`cy`,String(f(n??0))),r.setAttribute(`visibility`,n==null?`hidden`:`visible`))});let _=n.series.map(e=>{let r=e.values[p],i=r===1?n.unit.one:n.unit.other;return`${o(e.label)}: ${r==null?`—`:t(r)} ${o(i)}`});I(`<b>${o(n.axis.long(g))}</b><br>${_.join(`<br>`)}`,r)}),g.addEventListener(`pointerleave`,e=>{e.pointerType!==`touch`&&(m.setAttribute(`visibility`,`hidden`),h.forEach(e=>e.setAttribute(`visibility`,`hidden`)))})}var Ae=`stars-view`,je=[[`daily`,`Daily`],[`sampled`,`Sampled`]];function Me(){try{return localStorage.getItem(Ae)===`sampled`?`sampled`:`daily`}catch{return`daily`}}function Ne(e){try{localStorage.setItem(Ae,e)}catch{}}function Pe(e){let n=e.stars;if(n.length===0)return{el:B(`<div><h2>Stars over time</h2><p class=\"note\">No stargazers collected yet.</p></div>`)};let r={daily:`Cumulative stars at the end of each UTC day, from the stargazers' timestamps. Hover or tap for a day.`,sampled:`Cumulative stars at about 30 points along the history, from the stargazers' timestamps. Hover or tap a point for its date.`},i=v(n[0].date),a=n.map(e=>i.indexOf(Date.parse(`${e.date}T00:00:00Z`))),s=n.map(e=>e.stars),c=E({color:0}),l=xe(n),u=l.map(e=>i.indexOf(Date.parse(`${e.date}T00:00:00Z`))),d=new Map;for(let e of n)d.set(e.date.slice(0,7),e);let f=B(`<div><h2>Stars over time</h2><p class=\"note\" data-note></p></div><div class=\"presets\"><span class=\"group\" role=\"group\" aria-label=\"Chart view\" data-views></span></div><div class=\"scroll\"><svg role=\"img\" aria-label=\"Cumulative stars over time\"></svg></div><details><summary>Table view</summary><div class=\"scroll\"><table>${`<thead><tr><th>Month</th><th>Stars at month end</th></tr></thead><tbody>`+[...d.values()].map(e=>`<tr><td>${o(e.date.slice(0,7))}</td><td>${t(e.stars)}</td></tr>`).join(``)+`</tbody>`}</table></div></details>`),p=f.querySelector(`svg`),m=f.querySelector(`[data-views]`),h=f.querySelector(`[data-note]`),g=Me(),_=()=>{h.textContent=r[g],g===`sampled`?Ee(p,{id:`stars`,axis:i,samples:l,xs:u,color:c}):ke(p,{id:`stars`,xs:a,axis:i,series:[{label:`Stars`,color:c,values:s}],unit:{one:`star`,other:`stars`},startLabel:!0})},y=je.map(([e,t])=>{let n=document.createElement(`button`);return n.type=`button`,n.textContent=t,n.addEventListener(`click`,()=>{g=e,Ne(e),b(),_()}),m.appendChild(n),n}),b=()=>{je.forEach(([e],t)=>y[t].setAttribute(`aria-pressed`,String(g===e)))};return b(),{el:f,redraw:_}}var Fe=`var(--c0)`,Ie=`var(--c1)`;function Le(e){let n=e.traffic;if(!n)return null;let r=[...n.views,...n.clones],i=r.map(e=>e.date).sort()[0],a=e=>new Map(e.map(e=>[e.date,e])),c=a(n.views),l=a(n.clones),u=[...new Set(r.map(e=>e.date))].sort(),d=v(i??`1970-01-01`),f=u.map(e=>d.indexOf(Date.parse(`${e}T00:00:00Z`))),p=`<thead><tr><th>Day</th><th>Views</th><th>Unique visitors</th><th>Clones</th><th>Unique cloners</th></tr></thead><tbody>`+u.map(e=>{let n=c.get(e),r=l.get(e);return`<tr><td>${o(e)}</td><td>${t(n?.count??0)}</td><td>${t(n?.uniques??0)}</td><td>${t(r?.count??0)}</td><td>${t(r?.uniques??0)}</td></tr>`}).join(``)+`</tbody>`,m=`<thead><tr><th>Referrer</th><th>Views</th><th>Unique visitors</th></tr></thead><tbody>`+n.referrers.map(e=>`<tr><td>${o(e.referrer)}</td><td>${t(e.count)}</td><td>${t(e.uniques)}</td></tr>`).join(``)+`</tbody>`,h=`<thead><tr><th>Path</th><th>Views</th><th>Unique visitors</th></tr></thead><tbody>`+n.paths.map(e=>`<tr><td>${o(e.title||e.path)}<small>${o(e.path)}</small></td><td>${t(e.count)}</td><td>${t(e.uniques)}</td></tr>`).join(``)+`</tbody>`,g=n.asOf?`Referrers and paths are GitHub's 14-day totals as of ${s(n.asOf)}.`:`Referrers and paths have not been collected yet.`,_=B(`<div><h2>Traffic</h2><p class=\"note\">Views and clones per day from GitHub's traffic API. Hover for a day.</p></div>`+V([{label:`Views`,color:Fe},{label:`Clones`,color:Ie}])+(f.length?`<div class=\"scroll\"><svg role=\"img\" aria-label=\"Views and clones per day\"></svg></div>`:`<p class=\"note\">No traffic days yet.</p>`)+`<details><summary>Table view</summary><div class=\"scroll\"><table>${p}</table></div></details><div><h2>Referrers</h2><p class=\"note\">${o(g)}</p></div><div class=\"scroll\"><table>${m}</table></div><div><h2>Popular paths</h2></div><div class=\"scroll\"><table>${h}</table></div>`),y=_.querySelector(`svg`);return{el:_,redraw:()=>{y&&f.length!==0&&ke(y,{id:`traffic`,xs:f,axis:d,unit:{one:`per day`,other:`per day`},series:[{label:`Views`,color:Fe,values:u.map(e=>c.get(e)?.count??null)},{label:`Clones`,color:Ie,values:u.map(e=>l.get(e)?.count??null)}]})}}}function Re(e){if(e.releases.length===0)return{el:B(`<div><h2>Downloads by version and file</h2><p class=\"note\">No releases yet.</p></div>`)};let n=e.releases.slice().reverse(),r=l(e),i=p(e),a=r.filter(e=>i.some(t=>t.group.name===e.name)),c=n.map((e,t)=>`<option value=\"${t}\">${o(e.tag)} · ${s(e.publishedAt)}</option>`).join(``),u=`<tr><th rowspan=\"2\" scope=\"col\">Release</th>`+a.map(e=>`<th colspan=\"${i.filter(t=>t.group.name===e.name).length}\" scope=\"colgroup\"><i class=\"sw\" style=\"background:${E(e)}\"></i>${o(e.label)}</th>`).join(``)+`<th rowspan=\"2\" scope=\"col\">Total</th></tr>`,d=`<tr>${i.map(e=>`<th scope=\"col\">${o(e.label)}</th>`).join(``)}</tr>`,f=n.map(e=>{let n=m(e),a=r.reduce((t,n)=>t+(e.groups[n.name]??0),0);return`<tr><th scope=\"row\">${o(e.tag)}</th>${i.map(e=>`<td>${n.has(e.key)?t(n.get(e.key)??0):``}</td>`).join(``)}<td><b>${t(a)}</b></td></tr>`}).join(``),h=r.reduce((t,n)=>t+(e.totals.groups[n.name]??0),0),g=B(`<div><h2>Downloads by version and file</h2><p class=\"note\">Exact download count of every file in one release, from the GitHub Releases API. Bars share one scale; each group's files are listed apart, and ignored files sit in a collapsed group. Hover or tap a row for its full file name.</p></div><div class=\"vpick\"><button type=\"button\" data-old aria-label=\"Older release\" title=\"Older release\">&lsaquo;</button><select aria-label=\"Release\">${c}</select><button type=\"button\" data-new aria-label=\"Newer release\" title=\"Newer release\">&rsaquo;</button><span class=\"num\" data-meta></span></div><div class=\"vgroups\" data-bars></div><details><summary>All versions</summary><div class=\"scroll pivot\"><table><thead>${u}${d}</thead><tbody>${f}</tbody><tfoot>${`<tr><th scope=\"row\"><b>All</b></th>${i.map(e=>`<td><b>${t(e.downloads)}</b></td>`).join(``)}<td><b>${t(h)}</b></td></tr>`}</tfoot></table></div><p class=\"note\">Blank means the release had no such file. Row totals count the counted groups' files; ignored files are left out.</p>${ge(e)}</details>`),_=g.querySelector(`select`),v=g.querySelector(`[data-old]`),y=g.querySelector(`[data-new]`),b=g.querySelector(`[data-meta]`),x=g.querySelector(`[data-bars]`),S=0,C=e=>{L();let i=document.activeElement;S=e;let a=n[e],o=Math.max(1,...a.files.map(e=>e.downloads));_.value=String(e),v.disabled=e>=n.length-1,y.disabled=e<=0,(i===v||i===y)&&i.disabled&&([v,y].find(e=>!e.disabled)??_).focus(),b.textContent=`Published ${s(a.publishedAt)} · ${r.map(e=>`${e.label} ${t(a.groups[e.name]??0)}`).join(` · `)}`;let c=r.map(e=>ze(a,e,o));a.files.some(e=>e.group===`ignored`)&&c.push(Be(a,o)),x.replaceChildren(...c)};return _.addEventListener(`change`,()=>C(Number(_.value))),v.addEventListener(`click`,()=>C(S+1)),y.addEventListener(`click`,()=>C(S-1)),{el:g,redraw:()=>C(S)}}function ze(e,n,r){let a=e.files.filter(e=>e.group===n.name).sort((e,t)=>t.downloads-e.downloads),s=document.createElement(`div`);if(s.innerHTML=`<h3><i class=\"sw\" style=\"background:${E(n)}\"></i>${o(n.label)} · ${i(a.length,`file`)}, ${t(e.groups[n.name]??0)} downloads</h3>`,a.length===0)return s.insertAdjacentHTML(`beforeend`,`<p class=\"note\">None in this release.</p>`),s;let c=document.createElement(`div`);c.className=`bars`;for(let e of a)c.appendChild(Ve(e,n.label,E(n),r));return s.appendChild(c),s}function Be(e,n){let r=e.files.filter(e=>e.group===c).sort((e,t)=>t.downloads-e.downloads),a=r.reduce((e,t)=>e+t.downloads,0),o=document.createElement(`details`);o.innerHTML=`<summary>Ignored · ${i(r.length,`file`)}, ${t(a)} downloads</summary>`;let s=document.createElement(`div`);s.className=`bars`;for(let e of r)s.appendChild(Ve(e,`ignored`,`var(--muted)`,n));return o.appendChild(s),o}function Ve(e,n,r,i){let a=document.createElement(`div`);return a.className=`brow v`,a.innerHTML=`<span>${o(e.label)}</span><span class=\"t\"><i style=\"width:${e.downloads/i*100}%;background:${r}\"></i></span><span>${t(e.downloads)}</span>`,R(a,r=>I(`<b style=\"word-break:break-all\">${o(e.name)}</b><br>${o(n)}: ${t(e.downloads)} downloads`,r)),a}var He=[];function Ue(e,t,n){let r=[U(t),se(t),me(t),Re(t),ie(t),Z(t),ue(t),Pe(t),Le(t),ye(t)].filter(e=>e!==null);e.replaceChildren(Ge(t,n),...r.map(e=>e.el),Ke(t)),He=r;for(let e of r)e.redraw?.()}function We(){for(let e of He)e.redraw?.()}function Ge(e,t){let n=l(e).map(e=>e.label).join(` and `),r=document.createElement(`header`);if(r.innerHTML=`<h1>Download stats</h1><p class=\"sub\">GitHub release downloads for ${o(e.repo)}${n?`, split into ${o(n)}`:``}.</p>`,t){let e=document.createElement(`label`);e.className=`repo`,e.textContent=`Repository `;let n=document.createElement(`select`);t.repos.forEach((e,r)=>{let i=new Option(e,String(r),!1,r===t.selected);n.appendChild(i)}),n.addEventListener(`change`,()=>t.onSelect(Number(n.value))),e.appendChild(n),r.appendChild(e)}return r}function Ke(e){let t=e.counters.map(e=>`${o(e.label)} counts downloads of the files matching <code>${o(e.assets)}</code>${e.from?`, from ${o(e.from)}`:``}.`),n=document.createElement(`footer`);return n.innerHTML=`<p>Data built ${o(s(e.generatedAt))}, from the snapshot taken ${o(e.snapshotAt)}. Sources: the GitHub Releases API (per-file download counts, all releases), GitHub's repository counts, and Docker Hub pulls, as stored in the daily snapshots.</p><p>Method: groups are split by file name, and ignored files are left out of the totals. Per-day numbers are estimates from cumulative counts spread evenly over each release's live window, so they smooth over launch-day spikes. Counts include repeat downloads and automated fetches, and GitHub never reports downloads of deleted assets.</p>`+(t.length?`<p>${t.join(` `)}</p>`:``),n}function qe(){let e=document.getElementById(`gsa-config`)?.textContent??`{}`;try{return JSON.parse(e)}catch{return{}}}async function Je(e){let t=e.split(`/`).map(encodeURIComponent).join(`/`),n=await fetch(`data/${t}/dataset.json`);if(!n.ok)throw Error(`${e}: HTTP ${n.status}`);return await n.json()}async function Ye(){z();let e=document.getElementById(`app`),t=qe(),n,r=0;try{let e=t.datasets?null:await Promise.allSettled((t.repos??[]).map(Je));n=t.datasets??(e??[]).flatMap(e=>e.status===`fulfilled`?[e.value]:[]),r=e?.filter(e=>e.status===`rejected`).length??0}catch(t){e.textContent=`Could not load the stats: ${t instanceof Error?t.message:String(t)}`;return}if(n.length===0){e.textContent=r?`Could not load any repository stats.`:`No stats yet.`;return}let i=0,a=()=>{let t=n.length>1?{repos:n.map(e=>e.repo),selected:i,onSelect:e=>{i=e,a()}}:void 0;if(Ue(e,n[i],t),r){let t=document.createElement(`p`);t.className=`note`,t.textContent=`${r} repositor${r===1?`y`:`ies`} could not be loaded and ${r===1?`is`:`are`} left out.`,e.querySelector(`header`)?.after(t)}};a();let o;addEventListener(`resize`,()=>{clearTimeout(o),o=setTimeout(We,120)})}Ye();<\/script>\n    <style>:root{--bg:#f6f7f8;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#6f6e69;--grid:#e8eaeb;--line:#dcdedf;--border:#dcdedf;--good:#1f7a4d;--warn:#9a6700;--c0:#2a6ddc;--c1:#e5642e;--c2:#0d9683;--c3:#b07c00;--c4:#c4497e;--c5:#1f861f;--c6:#6b58e0;--c7:#dc3f3f;--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light;--sans:\"IBM Plex Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif;--mono:\"IBM Plex Mono\", ui-monospace, Menlo, Consolas, monospace}@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#121314;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--muted:#a09f98;--grid:#2a2b2e;--line:#33343a;--border:#33343a;--good:#5fc08a;--warn:#d9a441;--c0:#4189ea;--c1:#dd5f2f;--c2:#1c9f74;--c3:#c4860f;--c4:#d45287;--c5:#2b962b;--c6:#9085e9;--c7:#e66767;--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark}}:root[data-theme=dark]{--bg:#121314;--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--muted:#a09f98;--grid:#2a2b2e;--line:#33343a;--border:#33343a;--good:#5fc08a;--warn:#d9a441;--c0:#4189ea;--c1:#dd5f2f;--c2:#1c9f74;--c3:#c4860f;--c4:#d45287;--c5:#2b962b;--c6:#9085e9;--c7:#e66767;--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark}@font-face{font-family:IBM Plex Sans;font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,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)format(\"woff2\");unicode-range:U+??,U+131,U+152-153,U+2BB-2BC,U+2C6,U+2DA,U+2DC,U+304,U+308,U+329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}@font-face{font-family:IBM Plex Sans;font-style:normal;font-weight:600;font-display:swap;src:url(data:font/woff2;base64,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)format(\"woff2\");unicode-range:U+??,U+131,U+152-153,U+2BB-2BC,U+2C6,U+2DA,U+2DC,U+304,U+308,U+329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}@font-face{font-family:IBM Plex Sans;font-style:normal;font-weight:500;font-display:swap;src:url(data:font/woff2;base64,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)format(\"woff2\");unicode-range:U+??,U+131,U+152-153,U+2BB-2BC,U+2C6,U+2DA,U+2DC,U+304,U+308,U+329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}@font-face{font-family:IBM Plex Mono;font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,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)format(\"woff2\");unicode-range:U+??,U+131,U+152-153,U+2BB-2BC,U+2C6,U+2DA,U+2DC,U+304,U+308,U+329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}*{box-sizing:border-box}body{background:var(--bg);color:var(--ink);font:14px/1.5 var(--sans);padding-block:28px 48px;padding-left:max(16px, env(safe-area-inset-left,0px));padding-right:max(16px, env(safe-area-inset-right,0px));margin:0}main{flex-direction:column;gap:20px;min-width:0;max-width:1080px;margin:0 auto;display:flex}h1{letter-spacing:-.01em;text-wrap:balance;margin:0;font-size:26px;font-weight:600}h2{text-wrap:balance;margin:0 0 4px;font-size:16px;font-weight:600}h3{color:var(--ink2);margin:0 0 8px;font-size:13px;font-weight:600}p{margin:0}code{font-family:var(--mono);font-size:12px}.sub{color:var(--ink2);max-width:68ch}.note{color:var(--muted);max-width:78ch;font-size:12.5px;line-height:1.5}.num{font-variant-numeric:tabular-nums}.nw{white-space:nowrap}header{flex-direction:column;gap:6px;padding-bottom:4px;display:flex}.repo{color:var(--ink2);align-items:center;gap:8px;font-size:13px;display:flex}.repo select{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;max-width:100%;height:32px;padding:0 10px}section.kpis-wrap{box-shadow:none;background:0 0;border:0;padding:0}.kpis{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;display:grid}.kpi{background:var(--surface);border:1px solid var(--border);border-radius:8px;flex-direction:column;gap:2px;min-width:0;padding:14px 14px 12px;display:flex}.kpi .l{overflow-wrap:anywhere;text-transform:uppercase;letter-spacing:.07em;min-width:0;color:var(--muted);align-items:center;gap:6px;font-size:11.5px;font-weight:400;display:flex}.kpi .v{font-variant-numeric:tabular-nums;margin-top:2px;font-size:28px;font-weight:600;line-height:1.2}.kpi .d{color:var(--ink2);font-variant-numeric:tabular-nums;margin-top:4px;font-size:12.5px}.kpi .d b{color:var(--ink2);font-weight:600}.kpi .d b.pos{color:var(--good)}.sw{vertical-align:0;border-radius:50%;flex:none;width:8px;height:8px;margin-right:6px;display:inline-block}section{background:var(--surface);border:1px solid var(--border);border-radius:12px;flex-direction:column;gap:14px;min-width:0;padding:20px;display:flex;box-shadow:0 1px 2px #00000008}.legend{color:var(--ink2);flex-wrap:wrap;gap:16px;font-size:12.5px;display:flex}.legend span{align-items:center;display:inline-flex}.legend .line{border-radius:1px;width:14px;height:2px;margin-right:6px;display:inline-block}.scroll{max-width:100%;overflow-x:auto}.scroll.more{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),#0000);mask-image:linear-gradient(90deg,#000 calc(100% - 28px),#0000)}.scroll[hidden]{display:none}table{border-collapse:collapse;font-variant-numeric:tabular-nums;width:100%;font-size:13px;line-height:normal}th,td{text-align:right;border-bottom:1px solid var(--grid);white-space:nowrap;padding:8px 10px}th:first-child,td:first-child{text-align:left}th{color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-size:11.5px;font-weight:500}tbody tr:last-child td{border-bottom:0}tbody tr:hover td{background:color-mix(in srgb, var(--ink) 3%, transparent)}td small{color:var(--muted);font-size:11.5px;display:block}.periods th{white-space:normal;line-height:1.3}td.pos{color:var(--good)}.est{letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--warn);color:var(--warn);vertical-align:2px;border-radius:4px;margin-left:8px;padding:0 6px;font-size:11px;display:inline-block}.meas{border-color:var(--good);color:var(--good)}[hidden]{display:none!important}svg{display:block}svg text{fill:var(--muted);font:11px var(--sans)}svg .ink{fill:var(--ink2)}svg .strong{fill:var(--ink);font-size:12px;font-weight:600}svg .axis{stroke:var(--grid);stroke-width:1px}svg .base,svg .sep{stroke:var(--line);stroke-width:1px}svg .cap{fill:var(--muted)}[data-strip]{touch-action:none;-webkit-user-select:none;user-select:none;cursor:crosshair}[data-chart]{touch-action:pan-y}.cols{grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;display:grid}.bars{flex-direction:column;gap:8px;display:flex}.brow{grid-template-columns:minmax(110px,170px) 1fr 86px;align-items:center;gap:12px;font-size:13px;display:grid}.brow.v{grid-template-columns:minmax(110px,190px) 1fr 64px}.brow.v>span:first-child{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.brow>span:first-child{overflow-wrap:anywhere;min-width:0}.brow .t{background:var(--grid);border-radius:4px;height:8px;overflow:hidden}.brow .t i{border-radius:4px;min-width:2px;height:100%;display:block}.brow>span:last-child{text-align:right;font-variant-numeric:tabular-nums;color:var(--ink2)}#tip{z-index:20;pointer-events:none;background:var(--surface);color:var(--ink);border:1px solid var(--border);font-variant-numeric:tabular-nums;border-radius:8px;max-width:260px;padding:8px 10px;font-size:12px;line-height:1.5;display:none;position:fixed;box-shadow:0 4px 16px #00000024}#tip b{font-weight:600}details summary{cursor:pointer;color:var(--ink2);font-size:13px}summary:focus-visible{outline:2px solid var(--c0);outline-offset:2px}details>.scroll,details>p,details>.bars{margin-top:10px}.vgroups{flex-direction:column;gap:18px;display:flex}.vgroups details summary{margin-bottom:8px;font-size:13px}.vpick{flex-wrap:wrap;align-items:center;gap:8px;font-size:13px;display:flex}.vpick button,.vpick select{font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);cursor:pointer;border-radius:8px;height:32px}.vpick button{width:32px;color:var(--ink2);font-size:18px;line-height:1}.vpick select{max-width:100%;padding:0 10px}.vpick button:disabled{opacity:.4;cursor:default}.vpick button:focus-visible,.vpick select:focus-visible{outline:2px solid var(--c0);outline-offset:2px}[data-meta]{color:var(--ink2)}.pivot thead tr:first-child th:first-child,.pivot tbody th:first-child,.pivot tfoot th:first-child{background:var(--surface);z-index:1;position:sticky;left:0}.pivot tbody th,.pivot tfoot th{color:var(--ink);text-transform:none;letter-spacing:0;font-size:13px;font-weight:400}.pivot th[colspan]{text-align:left}.presets{flex-wrap:wrap;align-items:center;gap:10px;display:flex}.presets .group{background:var(--bg);border-radius:8px;gap:2px;padding:2px;display:inline-flex}.presets button{font:inherit;color:var(--ink2);cursor:pointer;background:0 0;border:1px solid #0000;border-radius:6px;padding:3px 10px;font-size:12.5px;font-weight:400}.presets button:hover{color:var(--ink)}.presets button[aria-pressed=true]{color:var(--ink);background:var(--surface);border-color:var(--border);box-shadow:0 1px 2px #0000000f}.presets button:focus-visible{outline:2px solid var(--c0);outline-offset:2px}.presets .note{margin:0 0 0 auto}footer code{overflow-wrap:anywhere}footer{color:var(--muted);flex-direction:column;gap:6px;max-width:90ch;padding-top:4px;font-size:12.5px;display:flex}@media (max-width:600px){body{padding-block:20px 40px}main{gap:14px}section{border-radius:10px;padding:16px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.kpi{border-radius:10px;padding:14px 14px 12px}.brow.v{grid-template-columns:minmax(96px,42%) 1fr 44px}}\n/*$vite$:1*/</style>\n  </head>\n  <body>\n    <main id=\"app\"></main>\n    <div id=\"tip\" role=\"tooltip\"></div>\n    <!-- render.ts replaces the placeholder with the datasets (standalone) or the repo list (pages) -->\n    <script id=\"gsa-config\" type=\"application/json\">__GSA_CONFIG__<\/script>\n  </body>\n</html>\n";
//#endregion
//#region packages/dashboard/src/render.ts
/** The placeholder element the build leaves for the datasets or the repo list. */
const CONFIG_PLACEHOLDER = "<script id=\"gsa-config\" type=\"application/json\">__GSA_CONFIG__<\/script>";
/** JSON that can sit inside a `<script>` element: `<` never closes it early. */
const embedJson = (value) => `<script id="gsa-config" type="application/json">${JSON.stringify(value).replace(/</g, "\\u003c")}<\/script>`;
function dashboardFiles(datasets, options) {
	if (options.mode === "standalone") return [{
		path: "dashboard/index.html",
		content: STANDALONE_HTML.replace(CONFIG_PLACEHOLDER, () => embedJson({ datasets }))
	}];
	const index = (PAGES_FILES["index.html"] ?? "").replace(CONFIG_PLACEHOLDER, () => embedJson({ repos: datasets.map((d) => d.repo) }));
	const assets = Object.entries(PAGES_FILES).filter(([path]) => path !== "index.html").map(([path, content]) => ({
		path,
		content
	}));
	const fonts = Object.entries(PAGES_BLOBS).map(([path, content]) => ({
		path,
		content,
		encoding: "base64"
	}));
	const data = datasets.map((d) => ({
		path: `data/${d.repo}/dataset.json`,
		content: `${JSON.stringify(d, null, 1)}\n`
	}));
	return [
		{
			path: "index.html",
			content: index
		},
		...assets,
		...fonts,
		...data
	];
}
const DAY_MS = 864e5;
/** Whether a chart shows its title and note: its own `title` option, else `charts.titles`, else yes. */
const showTitle = (dataset, chart) => dataset.charts?.[chart].title ?? dataset.charts?.titles ?? true;
/** The top of the plot: lower without a title, and lower again to make room for `labelled` rows above it. */
const plotTop = (titled, labelled = false) => (titled ? 80 : 40) + (labelled ? 32 : 0);
const ink = (theme) => INK[theme];
const seriesColor = (theme, slot) => seriesColor$1(theme, slot);
/** A NaN or Infinity from an empty series becomes 0, so it can't corrupt the markup. */
const finite = (n) => Number.isFinite(n) ? n : 0;
/** A coordinate with one decimal. */
const px = (n) => finite(n).toFixed(1);
const ESCAPES = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&apos;"
};
const esc = (text) => text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
/** `1 star`, `3 stars`. */
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** Rough width of a sans label at `size`: enough to keep labels apart, not to typeset them. */
const textWidth = (value, size = TYPE.xs) => value.length * size * .6;
const short = (v) => (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toString();
/** Compact value for axes and labels: 0, 2.5, 999, 1.2K, 3M. */
function compact(value) {
	const v = finite(value);
	if (Math.abs(v) >= 1e6) return `${short(v / 1e6)}M`;
	if (Math.abs(v) >= 1e3) return `${short(v / 1e3)}K`;
	return short(v);
}
/** Clean ticks from 0 to at least `max`, about `count` steps; never finer than 1, as the values are counts. */
function niceTicks(max, count = 4) {
	const top = finite(max);
	if (top <= 0) return [0, 1];
	const raw = top / count;
	const base = 10 ** Math.floor(Math.log10(raw));
	const step = Math.max(1, [
		1,
		2,
		2.5,
		5,
		10
	].map((m) => m * base).find((s) => s >= raw) ?? base * 10);
	const steps = Math.ceil(top / step);
	return Array.from({ length: steps + 1 }, (_, i) => i * step);
}
/** Day number of a YYYY-MM-DD date (UTC). */
const dayOf = (date) => Date.parse(date) / DAY_MS;
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec"
];
function monthLabel(day) {
	const d = /* @__PURE__ */ new Date(day * DAY_MS);
	return `${MONTHS[d.getUTCMonth()] ?? ""} ${d.getUTCFullYear()}`;
}
/** Labels for a time axis spanning `span` days: `Sep 9` while under four months, `Sep 2026` beyond. */
function timeLabel(span) {
	if (span > 120) return monthLabel;
	return (day) => {
		const d = /* @__PURE__ */ new Date(day * DAY_MS);
		return `${MONTHS[d.getUTCMonth()] ?? ""} ${d.getUTCDate()}`;
	};
}
function svgText(o) {
	const anchor = o.anchor && o.anchor !== "start" ? ` text-anchor="${o.anchor}"` : "";
	const size = o.size ? ` font-size="${o.size}"` : "";
	const weight = o.weight ? ` font-weight="${o.weight}"` : "";
	return `<text x="${px(o.x)}" y="${px(o.y)}" fill="${o.fill}"${anchor}${size}${weight}>${esc(o.value)}</text>`;
}
function svgDocument(theme, title, desc, body) {
	const c = INK[theme];
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300" viewBox="0 0 800 300" role="img" aria-labelledby="title desc">`,
		`<title id="title">${esc(title)}</title>`,
		`<desc id="desc">${esc(desc)}</desc>`,
		`<rect x="0.5" y="0.5" width="799" height="299" rx="${MARK.radius}" fill="${c.surface}" stroke="${c.border}"/>`,
		`<g font-family='${FONT.sans}' font-size="${TYPE.xs}" fill="${c.secondary}" style="font-variant-numeric:tabular-nums">`,
		...body,
		"</g>",
		"</svg>",
		""
	].join("\n");
}
/** A vertical fade for an area: the series hue at the line, almost nothing at the baseline. */
function areaGradient(id, color) {
	return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity="${MARK.areaTop}"/><stop offset="1" stop-color="${color}" stop-opacity="${MARK.areaBottom}"/></linearGradient>`;
}
/** The width of a legend row: a dot and a label per series, 18px apart. */
function legendWidth(keys) {
	return keys.reduce((sum, k) => sum + 14 + textWidth(k.label, TYPE.sm), 0) + 18 * Math.max(0, keys.length - 1);
}
/** Legend on the title line, right-aligned: a dot and a text label per series. */
function legend(keys, theme, right, y) {
	const widths = keys.map((k) => 14 + textWidth(k.label, TYPE.sm));
	let x = right - legendWidth(keys);
	return keys.flatMap((k, i) => {
		const at = x;
		x += (widths[i] ?? 0) + 18;
		return [`<circle cx="${px(at + 4)}" cy="${px(y - 4)}" r="4" fill="${k.color}"/>`, svgText({
			x: at + 14,
			y,
			value: k.label,
			fill: INK[theme].secondary,
			size: TYPE.sm
		})];
	});
}
/** Title, note line and legend (when there is more than one series). Without a title, the hint (a small note that says what the data is) and the legend stay on the top line. */
function heading(title, note, theme, keys = [], titled = true, hint = "") {
	if (!titled) {
		const legendLeft = 776 - (keys.length > 1 ? legendWidth(keys) : 0);
		const hintY = 24 + textWidth(hint, TYPE.xs) + 16 > legendLeft ? 34 : 20;
		return [...hint ? [svgText({
			x: 24,
			y: hintY,
			value: hint,
			fill: INK[theme].muted,
			size: TYPE.xs
		})] : [], ...keys.length > 1 ? legend(keys, theme, 776, 20) : []];
	}
	return [
		`<text x="24" y="32" fill="${INK[theme].primary}" font-size="${TYPE.lg}" font-weight="600">${esc(title)}</text>`,
		svgText({
			x: 24,
			y: 50,
			value: note,
			fill: INK[theme].muted,
			size: TYPE.sm
		}),
		...keys.length > 1 ? legend(keys, theme, 776, 32) : []
	];
}
/** Hairline gridlines with a value at each tick; the zero tick is the baseline, one step darker. */
function valueAxis(ticks, yOf, box, theme) {
	const c = INK[theme];
	return ticks.flatMap((v) => {
		const y = yOf(v);
		return [`<line x1="${px(box.left)}" x2="${px(box.right)}" y1="${px(y)}" y2="${px(y)}" stroke="${v === 0 ? c.axis : c.grid}"/>`, svgText({
			x: box.left - 10,
			y: y + 4,
			value: compact(v),
			fill: c.muted,
			anchor: "end"
		})];
	});
}
/** Labels under the plot, one per mark. */
function xLabels(items, y, theme) {
	return items.map((item) => svgText({
		x: item.x,
		y,
		value: item.value,
		fill: INK[theme].muted,
		anchor: item.anchor ?? "middle"
	}));
}
/** A centred message on an empty plot. */
function emptyNote(message, box, theme) {
	return svgText({
		x: (box.left + box.right) / 2,
		y: (box.top + box.bottom) / 2 + 4,
		value: message,
		fill: INK[theme].muted,
		anchor: "middle",
		size: TYPE.md
	});
}
/** A bar from the baseline: square on the baseline, rounded at the data end only. */
function barPath(x, top, width, height, roundTop) {
	const bottom = top + height;
	const r = roundTop ? Math.min(MARK.barRadius, width / 2, height) : 0;
	if (r === 0) return `M${px(x)} ${px(bottom)}V${px(top)}H${px(x + width)}V${px(bottom)}Z`;
	return `M${px(x)} ${px(bottom)}V${px(top + r)}Q${px(x)} ${px(top)} ${px(x + r)} ${px(top)}H${px(x + width - r)}Q${px(x + width)} ${px(top)} ${px(x + width)} ${px(top + r)}V${px(bottom)}Z`;
}
function stack(x, width, yOf, segments) {
	const shown = segments.filter((s) => finite(s.value) > 0);
	let base = 0;
	return shown.map((s, i) => {
		const lower = yOf(base);
		base += finite(s.value);
		const top = yOf(base) + (i < shown.length - 1 ? 1 : 0);
		const bottom = lower - (i > 0 ? 1 : 0);
		const height = Math.max(1, bottom - top);
		return `<path d="${barPath(x, bottom - height, width, height, i === shown.length - 1)}" fill="${s.color}"><title>${esc(s.title)}</title></path>`;
	});
}
/** An end-point dot with a surface ring, titled for hover. */
function endDot(x, y, color, theme, title) {
	return `<circle cx="${px(x)}" cy="${px(y)}" r="${MARK.dot}" fill="${color}" stroke="${INK[theme].surface}" stroke-width="2"><title>${esc(title)}</title></circle>`;
}
/** The bar width for slots of `slot` px: capped, with air between neighbours (a hairline once they are dense). */
function barWidth(slot) {
	const gap = slot < 6 ? 1 : MARK.gap;
	return Math.min(MARK.barMax, Math.max(1, slot - gap));
}
/** Up to five indices spread over `count` items, the first and last included. */
function sample(count) {
	if (count === 0) return [];
	if (count === 1) return [0];
	return [...new Set([
		0,
		1,
		2,
		3,
		4
	].map((k) => Math.round(k * (count - 1) / 4)))];
}
/** Labels at the plot's edges hang off them; the ones between are centred. */
function edgeAnchor(k, count) {
	if (count === 1 || k > 0 && k < count - 1) return "middle";
	return k === 0 ? "start" : "end";
}
/** The hint kept when titles are hidden: short, so it clears the legend. */
const ESTIMATED_HINT = "Estimated per day";
const MEASURED_HINT = "Measured per day";
const boxOf$1 = (titled) => ({
	left: 60,
	right: 776,
	top: plotTop(titled),
	bottom: 252
});
const title$1 = "Downloads per day";
function downloadsPerDayChart(dataset, theme) {
	const keys = dataset.groups.map((g) => ({
		label: g.label,
		color: seriesColor(theme, g.color)
	}));
	const measured = dataset.measuredDaily.length;
	const titled = showTitle(dataset, "downloads-per-day");
	const box = boxOf$1(titled);
	if (measured >= 14) return measuredBars(dataset, theme, keys, box, titled);
	return estimatedAreas(dataset, theme, keys, `Estimated, spread over each release's live window (measured needs 14 days, have ${plural(measured, "day")})`, box, titled);
}
function measuredBars(dataset, theme, keys, box, titled) {
	const days = dataset.measuredDaily;
	const totals = days.map((d) => dataset.groups.reduce((sum, g) => sum + finite(d.groups[g.name] ?? 0), 0));
	const ticks = niceTicks(Math.max(0, ...totals));
	const top = ticks.at(-1) ?? 1;
	const yOf = (v) => box.bottom - finite(v) / top * (box.bottom - box.top);
	const slot = (box.right - box.left) / days.length;
	const width = barWidth(slot);
	const bars = days.flatMap((d, i) => {
		const x = box.left + i * slot + (slot - width) / 2;
		const span = d.days > 1 ? ` (${d.days} days)` : "";
		const segments = dataset.groups.map((g) => {
			const value = finite(d.groups[g.name] ?? 0);
			return {
				value,
				color: seriesColor(theme, g.color),
				title: `${d.date}, ${g.label}: ${value}${span}`
			};
		});
		return stack(x, width, yOf, segments);
	});
	const picks = sample(days.length);
	const labels = picks.map((i, k) => ({
		x: box.left + i * slot + slot / 2,
		value: days[i]?.date ?? "",
		anchor: edgeAnchor(k, picks.length)
	}));
	const note = `Measured, change between daily snapshots (${plural(days.length, "day")})`;
	return svgDocument(theme, title$1, `${title$1}: measured from daily snapshots.`, [
		...heading(title$1, note, theme, keys, titled, MEASURED_HINT),
		...valueAxis(ticks, yOf, box, theme),
		...xLabels(labels, box.bottom + 20, theme),
		...bars
	]);
}
function estimatedAreas(dataset, theme, keys, note, box, titled) {
	const { estimatedDaily } = dataset;
	const count = Math.max(0, ...dataset.groups.map((g) => estimatedDaily.groups[g.name]?.length ?? 0));
	const start = dayOf(estimatedDaily.start);
	const valueOf = (name, i) => finite(estimatedDaily.groups[name]?.[i] ?? 0);
	const sums = Array.from({ length: count }, (_, i) => dataset.groups.reduce((sum, g) => sum + valueOf(g.name, i), 0));
	const ticks = niceTicks(Math.max(0, ...sums));
	const top = ticks.at(-1) ?? 1;
	const yOf = (v) => box.bottom - finite(v) / top * (box.bottom - box.top);
	const xOf = (i) => count > 1 ? box.left + i / (count - 1) * (box.right - box.left) : (box.left + box.right) / 2;
	const stacked = dataset.groups.filter((g) => (estimatedDaily.groups[g.name] ?? []).some((v) => v > 0)).length > 1;
	let lower = new Array(count).fill(0);
	const defs = [];
	const areas = [];
	dataset.groups.forEach((g, k) => {
		const base = lower;
		const upper = base.map((v, i) => v + valueOf(g.name, i));
		lower = upper;
		if (!upper.some((v, i) => v > (base[i] ?? 0))) return;
		const color = seriesColor(theme, g.color);
		const id = `day-fade-${k}`;
		if (!stacked) defs.push(areaGradient(id, color));
		areas.push(areaShape(xOf, yOf, upper, base, color, stacked ? `${color}" fill-opacity="${MARK.areaStack}` : `url(#${id})`));
	});
	const marks = sample(count);
	const label = timeLabel(count);
	const labels = marks.map((i, k) => ({
		x: xOf(i),
		value: label(start + i),
		anchor: edgeAnchor(k, marks.length)
	}));
	const body = count === 0 ? [emptyNote("No downloads yet", box, theme)] : [
		...defs.length ? [`<defs>${defs.join("")}</defs>`] : [],
		...valueAxis(ticks, yOf, box, theme),
		...xLabels(labels, box.bottom + 20, theme),
		...areas
	];
	return svgDocument(theme, title$1, `${title$1}: estimated per day by group.`, [...heading(title$1, note, theme, keys, titled, ESTIMATED_HINT), ...body]);
}
function areaShape(xOf, yOf, upper, base, color, fill) {
	const bends = (a, i) => a[i] !== a[i - 1] || a[i] !== a[i + 1];
	const kept = upper.map((_, i) => i).filter((i) => bends(upper, i) || bends(base, i));
	const top = kept.map((i, k) => `${k === 0 ? "M" : "L"}${px(xOf(i))} ${px(yOf(upper[i] ?? 0))}`).join("");
	return [`<path d="${top}${kept.map((i) => `L${px(xOf(i))} ${px(yOf(base[i] ?? 0))}`).reverse().join("")}Z" fill="${fill}"/>`, `<path d="${top}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`].join("");
}
//#endregion
//#region packages/svg/src/releases.ts
/** The plot starts lower when there are epoch labels to make room for above it. */
const plotBox = (labelled, titled) => ({
	left: 60,
	right: 776,
	top: plotTop(titled, labelled),
	bottom: 252
});
const title = "Downloads per release";
/** Label rows above the plot, nearest first. Past the last one a label is left out, its marker stays. */
const EPOCH_TIERS = 3;
const TIER_HEIGHT = 14;
function downloadsPerReleaseChart(dataset, theme) {
	const keys = dataset.groups.map((g) => ({
		label: g.label,
		color: seriesColor(theme, g.color)
	}));
	const note = "One column per release, stacked by group";
	const { releases } = dataset;
	const c = ink(theme);
	const titled = showTitle(dataset, "downloads-per-release");
	const box = plotBox(dataset.epochs.some((_, e) => releases.some((r) => r.epoch === e)), titled);
	if (releases.length === 0) return svgDocument(theme, title, `${title}: no releases yet.`, [...heading(title, note, theme, keys, titled), emptyNote("No releases yet", box, theme)]);
	const totals = releases.map((r) => dataset.groups.reduce((sum, g) => sum + finite(r.groups[g.name] ?? 0), 0));
	const ticks = niceTicks(Math.max(0, ...totals));
	const top = ticks.at(-1) ?? 1;
	const yOf = (v) => box.bottom - finite(v) / top * (box.bottom - box.top);
	const slot = (box.right - box.left) / releases.length;
	const width = barWidth(slot);
	const columns = releases.flatMap((r, i) => {
		return stack(box.left + i * slot + (slot - width) / 2, width, yOf, dataset.groups.map((g) => {
			const value = finite(r.groups[g.name] ?? 0);
			return {
				value,
				color: seriesColor(theme, g.color),
				title: `${r.tag}, ${g.label}: ${value}`
			};
		}));
	});
	const last = releases.length - 1;
	const lastTotal = totals[last] ?? 0;
	const totalLabel = lastTotal > 0 ? [svgText({
		x: box.left + last * slot + slot / 2,
		y: yOf(lastTotal) - 8,
		value: compact(lastTotal),
		fill: c.primary,
		anchor: "middle",
		size: TYPE.sm,
		weight: 600
	})] : [];
	const placed = [];
	const markers = dataset.epochs.flatMap((epoch, e) => {
		const k = releases.findIndex((r) => r.epoch === e);
		if (k < 0) return [];
		const x = box.left + k * slot;
		const text = `${epoch.version} ${epoch.label}`;
		const spot = placeLabel(x, text, placed);
		const capY = spot ? labelY(box, spot.tier) - 4 : box.top - 8;
		return [
			`<line x1="${px(x)}" x2="${px(x)}" y1="${px(capY)}" y2="${px(box.bottom)}" stroke="${c.axis}" stroke-width="1"><title>${esc(text)}</title></line>`,
			`<circle cx="${px(x)}" cy="${px(capY)}" r="2.5" fill="${c.muted}"/>`,
			...spot ? [svgText({
				x: spot.x,
				y: labelY(box, spot.tier),
				value: text,
				fill: c.secondary,
				anchor: spot.anchor
			})] : []
		];
	});
	const step = Math.max(1, Math.ceil(52 / slot));
	const tagLabels = releases.flatMap((r, i) => i % step === 0 ? [{
		x: box.left + i * slot + slot / 2,
		value: r.tag
	}] : []);
	return svgDocument(theme, title, `${title}: ${plural(releases.length, "release")}, stacked by group.`, [
		...heading(title, note, theme, keys, titled),
		...valueAxis(ticks, yOf, box, theme),
		...markers,
		...columns,
		...totalLabel,
		...xLabels(tagLabels, box.bottom + 20, theme)
	]);
}
const labelY = (box, tier) => box.top - 12 - tier * TIER_HEIGHT;
/** The first free spot for an epoch label: right of its marker, else left of it, nearest tier first. */
function placeLabel(x, text, placed) {
	const width = textWidth(text);
	for (let tier = 0; tier < EPOCH_TIERS; tier++) {
		const options = [{
			x: x + 7,
			anchor: "start",
			from: x + 7,
			to: x + 7 + width
		}, {
			x: x - 7,
			anchor: "end",
			from: x - 7 - width,
			to: x - 7
		}];
		for (const option of options) {
			if (option.from < 8 || option.to > 792) continue;
			if (placed.some((p) => p.tier === tier && option.from < p.to + 8 && p.from < option.to + 8)) continue;
			placed.push({
				from: option.from,
				to: option.to,
				tier
			});
			return {
				x: option.x,
				tier,
				anchor: option.anchor
			};
		}
	}
}
//#endregion
//#region packages/svg/src/stars.ts
const boxOf = (titled) => ({
	left: 60,
	right: 776,
	top: plotTop(titled),
	bottom: 252
});
/** The least gap between two axis labels, so they never run into each other. */
const LABEL_GAP = 44;
/** Spans up to this many days label only their two ends, with days. */
const DAY_LABELS_SPAN = 120;
/** From this many days the axis labels years, below it months. */
const YEAR_SPAN = 365;
function starsChart(dataset, theme) {
	const title = "Stars over time";
	const note = "Cumulative stargazers";
	const titled = showTitle(dataset, "stars");
	const box = boxOf(titled);
	const [head] = dataset.stars;
	const last = dataset.stars.at(-1);
	if (!head || !last) {
		const message = dataset.totals.stars === 0 ? "No stars yet" : "No stargazer history";
		return svgDocument(theme, title, `${title}: ${message}.`, [...heading(title, note, theme, [], titled), emptyNote(message, box, theme)]);
	}
	const ticks = niceTicks(Math.max(...dataset.stars.map((p) => p.stars)));
	const top = ticks.at(-1) ?? 1;
	const yOf = (v) => box.bottom - finite(v) / top * (box.bottom - box.top);
	const color = seriesColor(theme, 0);
	const first = dayOf(head.date);
	const end = dayOf(last.date);
	const span = end - first;
	const xOf = (day) => span > 0 ? box.left + (finite(day) - first) / span * (box.right - box.left) : (box.left + box.right) / 2;
	const samples = sampleStars(dataset.stars);
	const xs = samples.map((p) => xOf(dayOf(p.date)));
	const line = monotonePath(samples.map((p, i) => [xs[i], yOf(p.stars)]));
	const lastX = xs[xs.length - 1];
	const dots = samples.slice(0, -1).map((p, i) => {
		const tip = `${p.date}: ${plural(p.stars, "star")}`;
		return `<circle cx="${px(xs[i])}" cy="${px(yOf(p.stars))}" r="3" fill="${color}" stroke="${ink(theme).surface}" stroke-width="2"><title>${esc(tip)}</title></circle>`;
	});
	const hover = samples.map((p, i) => {
		const left = i === 0 ? box.left : (xs[i - 1] + xs[i]) / 2;
		const right = i === samples.length - 1 ? box.right : (xs[i] + xs[i + 1]) / 2;
		return `<rect x="${px(left)}" y="${box.top}" width="${px(right - left)}" height="${box.bottom - box.top}" fill-opacity="0"><title>${esc(p.date)}: ${plural(p.stars, "star")}</title></rect>`;
	});
	return svgDocument(theme, title, `${title}: ${last.stars} stargazers on ${last.date}.`, [
		`<defs>${areaGradient("stars-fade", color)}</defs>`,
		...heading(title, note, theme, [], titled),
		...valueAxis(ticks, yOf, box, theme),
		...xLabels(timeAxis(first, end, xOf), box.bottom + 20, theme),
		`<path d="${line}L${px(lastX)} ${px(box.bottom)}L${px(xs[0])} ${px(box.bottom)}Z" fill="url(#stars-fade)"/>`,
		`<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
		...dots,
		...endLabel(lastX, yOf(last.stars), last, color, theme, box),
		...hover
	]);
}
/** The labels of a linear time axis: both ends, then each January (or month start under a year) clear of its neighbours. */
function timeAxis(first, last, xOf) {
	const label = timeLabel(last - first);
	if (last <= first) return [{
		x: xOf(first),
		value: label(first),
		anchor: "middle"
	}];
	const yearly = last - first >= YEAR_SPAN;
	const inner = [];
	if (last - first > DAY_LABELS_SPAN) {
		const from = /* @__PURE__ */ new Date(first * DAY_MS);
		const to = /* @__PURE__ */ new Date(last * DAY_MS);
		const startMonth = from.getUTCFullYear() * 12 + from.getUTCMonth();
		const endMonth = to.getUTCFullYear() * 12 + to.getUTCMonth();
		for (let m = startMonth + 1; m <= endMonth; m++) {
			if (yearly && m % 12 !== 0) continue;
			const day = Date.UTC(Math.floor(m / 12), m % 12, 1) / DAY_MS;
			if (day <= first || day >= last) continue;
			const value = yearly ? String(Math.floor(m / 12)) : m % 12 === 0 ? monthLabel(day) : monthLabel(day).slice(0, 3);
			inner.push({
				x: xOf(day),
				value,
				anchor: "middle"
			});
		}
	}
	const x1 = xOf(last);
	const shown = [{
		x: xOf(first),
		value: label(first),
		anchor: "start"
	}];
	for (const tick of inner) if (tick.x - shown[shown.length - 1].x >= LABEL_GAP && x1 - tick.x >= LABEL_GAP) shown.push(tick);
	shown.push({
		x: x1,
		value: label(last),
		anchor: "end"
	});
	return shown;
}
function endLabel(lastX, lastY, last, color, theme, box) {
	const count = compact(last.stars);
	const labelX = lastX + 8 + count.length * 8 > box.right ? lastX - 8 : lastX + 8;
	const labelAnchor = labelX < lastX ? "end" : "start";
	return [endDot(lastX, lastY, color, theme, `${last.date}: ${plural(last.stars, "star")}`), svgText({
		x: labelX,
		y: Math.max(box.top + 10, lastY - 10),
		value: count,
		fill: ink(theme).primary,
		anchor: labelAnchor,
		size: TYPE.md,
		weight: 600
	})];
}
//#endregion
//#region packages/svg/src/index.ts
const CHARTS = [
	["stars", starsChart],
	["downloads-per-day", downloadsPerDayChart],
	["downloads-per-release", downloadsPerReleaseChart]
];
/** Paths are relative to `<owner>/<repo>/`: `charts/<name>-light.svg` and `-dark.svg`. */
function renderCharts(dataset) {
	const themes = ["light", "dark"];
	return CHARTS.flatMap(([name, chart]) => themes.map((theme) => ({
		path: `charts/${name}-${theme}.svg`,
		content: chart(dataset, theme)
	})));
}
//#endregion
//#region packages/action/src/render.ts
async function renderData(options) {
	const repos = await listRepos(options.dataRoot);
	if (repos.length === 0) throw new Error(`no snapshots under ${options.dataRoot}`);
	const selected = options.repo ? repos.filter((r) => r === options.repo) : repos;
	if (selected.length === 0) throw new Error(`${options.repo} has no snapshots under ${options.dataRoot}`);
	if (selected.length > 1) throw new Error(`the data holds ${selected.length} repos; pick one with --repo (${selected.join(", ")})`);
	const repo = selected[0];
	const source = repoDir(options.dataRoot, repo);
	const latest = (await readSnapshots(source)).at(-1);
	if (!latest) throw new Error(`${repo}: no snapshots in ${source}`);
	const { dataset, csv } = await deriveRepo(source, repo, options.config, new Date(latest.takenAt));
	const dir = repoDir(options.outDir, repo);
	await mkdir(dir, { recursive: true });
	await writeDerived(dir, dataset, csv);
	await writeOutputFiles(dir, [...renderCharts(dataset), ...renderBadges(dataset)]);
	await writeOutputFiles(options.outDir, dashboardFiles([dataset], { mode: "standalone" }));
	options.log.info(`rendered ${repo} into ${options.outDir}`);
	return {
		datasets: [dataset],
		datasetPaths: [join(dir, "dataset.json")]
	};
}
//#endregion
//#region packages/action/src/run.ts
/** One line for the job summary and the `summary` output. */
function summaryLine(dataset) {
	const groups = dataset.groups.map((g) => `${g.label} ${dataset.totals.groups[g.name] ?? 0}`).join(", ");
	const docker = dataset.totals.docker === null ? "" : `, Docker ${dataset.totals.docker}`;
	return `${dataset.repo}: ${dataset.totals.downloads} downloads (${groups}), ${dataset.totals.stars} stars${docker}`;
}
/** Rebuilds the derived files, charts, badges and dashboard from the stored snapshots of `repo`. */
async function writeDerivedOutputs(dataDir, repo, config, now) {
	const dir = repoDir(dataDir, repo);
	const { dataset, csv } = await deriveRepo(dir, repo, config, now);
	await writeDerived(dir, dataset, csv);
	await writeOutputFiles(dir, [...renderCharts(dataset), ...renderBadges(dataset)]);
	await writeOutputFiles(dataDir, dashboardFiles(await readDatasets(dataDir), { mode: "standalone" }));
	return dataset;
}
/** Writes the Pages site: the dashboard and the dataset, without traffic unless `traffic` is set. */
async function writePagesSite(pages, repo, dataset) {
	const pagesDataset = pages.traffic ? dataset : {
		...dataset,
		traffic: void 0
	};
	await writeOutputFiles(pages.dir, dashboardFiles([pagesDataset], { mode: "pages" }));
}
async function runStats(options) {
	const { repo, config, now, log } = options;
	const fetchFn = options.fetch ?? fetch;
	const api = githubClient(fetchFn, options.token);
	const dir = repoDir(options.dataDir, repo);
	const date = utcDate(now.getTime());
	const [counts, releases, known] = await Promise.all([
		fetchRepoCounts(api, repo),
		fetchReleases(api, repo),
		readStargazers(dir)
	]);
	const stargazers = await fetchStargazers(api, repo, known, counts.stars, log);
	const traffic = options.traffic ? await fetchTraffic(api, repo) : void 0;
	const dockerPulls = config.docker ? await fetchDockerPulls(createClient({
		fetch: fetchFn,
		baseUrl: "https://hub.docker.com"
	}), config.docker, log) : void 0;
	await writeSnapshot(dir, {
		schema: 1,
		date,
		takenAt: now.toISOString(),
		repo: counts,
		...config.docker && dockerPulls !== void 0 ? { docker: {
			image: config.docker,
			pulls: dockerPulls
		} } : {},
		releases
	});
	await writeStargazers(dir, stargazers);
	if (traffic) {
		await writeTrafficSeries(dir, "views", mergeTrafficDays(await readTrafficSeries(dir, "views"), traffic.views));
		await writeTrafficSeries(dir, "clones", mergeTrafficDays(await readTrafficSeries(dir, "clones"), traffic.clones));
		await writeTrafficAggregates(dir, date, traffic);
	}
	const dataset = await writeDerivedOutputs(options.dataDir, repo, config, now);
	if (options.pages) await writePagesSite(options.pages, repo, dataset);
	return {
		dataset,
		datasetPath: join(dir, "dataset.json"),
		summary: summaryLine(dataset)
	};
}
//#endregion
//#region packages/action/src/cli.ts
const USAGE = `usage:
  github-stats [collect] --repo owner/name --out <dir> [--config <file>] [--traffic] [--dry-run]
      fetch from GitHub, write the day's snapshot and render into <dir>.
      --traffic     collect traffic (needs a token with push access, a PAT)
      --dry-run     accepted for parity with the action; the CLI never pushes
      token         read from GITHUB_TOKEN

  github-stats render (--data <dir> | --from-branch <ref>) --out <dir> [--repo owner/name] [--config <file>]
      no API calls: rebuild the derived files and outputs from stored data.
      --data         a data branch checkout (<owner>/<repo>/ inside)
      --from-branch  a git ref of the repo in the current directory, e.g. origin/stats-data;
                     read with git, the working tree is not touched

  --config  stats config (default .github/stats.yml; only the default may be missing, giving the defaults)`;
const log = {
	info: (message) => console.log(message),
	warning: (message) => console.warn(`warning: ${message}`)
};
const OPTIONS = {
	repo: { type: "string" },
	out: { type: "string" },
	config: { type: "string" },
	traffic: {
		type: "boolean",
		default: false
	},
	"dry-run": {
		type: "boolean",
		default: false
	},
	data: { type: "string" },
	"from-branch": { type: "string" },
	help: {
		type: "boolean",
		short: "h",
		default: false
	}
};
/** The config from --config, or the default path when it was not given (which may then be missing). */
async function readConfig(values) {
	const { config, file } = await loadConfigFile(values.config ?? ".github/stats.yml", { explicit: values.config !== void 0 });
	log.info(file ? `config: ${file}` : "config: no config file, using the defaults");
	return config;
}
async function collect(values) {
	if (!values.repo || !values.out) throw new Error("collect needs --repo and --out");
	const config = await readConfig(values);
	const result = await runStats({
		repo: values.repo,
		token: process.env.GITHUB_TOKEN,
		config,
		dataDir: values.out,
		traffic: values.traffic,
		now: /* @__PURE__ */ new Date(),
		log
	});
	log.info(result.summary);
	log.info(`dataset: ${result.datasetPath}`);
}
async function render(values, cwd) {
	if (!values.out) throw new Error("render needs --out");
	if (Boolean(values.data) === Boolean(values["from-branch"])) throw new Error("render needs exactly one of --data or --from-branch");
	const config = await readConfig(values);
	const options = {
		outDir: values.out,
		config,
		repo: values.repo,
		log
	};
	if (values.data) {
		await renderData({
			...options,
			dataRoot: values.data
		});
		return;
	}
	const exported = await mkdtemp(join(tmpdir(), "github-stats-render-"));
	try {
		await exportBranchData(values["from-branch"], cwd, exported);
		await renderData({
			...options,
			dataRoot: exported
		});
	} finally {
		await rm(exported, {
			recursive: true,
			force: true
		});
	}
}
/** Runs the CLI with `argv` (without node and the script), in `cwd` for git. Returns the exit code. */
async function runCli(argv, cwd = process.cwd()) {
	let parsed;
	try {
		parsed = parseArgs({
			args: argv,
			options: OPTIONS,
			allowPositionals: true,
			strict: true
		});
	} catch (error) {
		console.error(`${error.message}\n\n${USAGE}`);
		return 2;
	}
	const { values, positionals } = parsed;
	if (values.help) {
		console.log(USAGE);
		return 0;
	}
	const command = positionals[0] ?? "collect";
	if (positionals.length > 1 || command !== "collect" && command !== "render") {
		console.error(`unknown command: ${positionals.join(" ")}\n\n${USAGE}`);
		return 2;
	}
	try {
		if (command === "render") await render(values, cwd);
		else await collect(values);
		return 0;
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		return 1;
	}
}
//#endregion
//#region packages/action/src/bin.ts
process.exitCode = await runCli(process.argv.slice(2));
//#endregion
export {};
