/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiImage from "../aiImage.js";
import type * as chat from "../chat.js";
import type * as chatOps from "../chatOps.js";
import type * as decks from "../decks.js";
import type * as demo from "../demo.js";
import type * as demoAssetStore from "../demoAssetStore.js";
import type * as demoAssets from "../demoAssets.js";
import type * as generate from "../generate.js";
import type * as images from "../images.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_imagen from "../lib/imagen.js";
import type * as lib_pubmed from "../lib/pubmed.js";
import type * as lib_stock from "../lib/stock.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiImage: typeof aiImage;
  chat: typeof chat;
  chatOps: typeof chatOps;
  decks: typeof decks;
  demo: typeof demo;
  demoAssetStore: typeof demoAssetStore;
  demoAssets: typeof demoAssets;
  generate: typeof generate;
  images: typeof images;
  "lib/ai": typeof lib_ai;
  "lib/imagen": typeof lib_imagen;
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
