/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chat from "../chat.js";
import type * as chatOps from "../chatOps.js";
import type * as decks from "../decks.js";
import type * as generate from "../generate.js";
import type * as images from "../images.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_pubmed from "../lib/pubmed.js";
import type * as lib_stock from "../lib/stock.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chat: typeof chat;
  chatOps: typeof chatOps;
  decks: typeof decks;
  generate: typeof generate;
  images: typeof images;
  "lib/ai": typeof lib_ai;
  "lib/pubmed": typeof lib_pubmed;
  "lib/stock": typeof lib_stock;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
