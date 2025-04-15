// src/lib/rust-uwuify.ts
// This file provides a wrapper for the Rust uwuify implementation
// It imports from uwuify-core.ts to break circular dependencies

import { uwuifyTextCore } from './uwuify-core';

/**
 * Uwuifies text using the Rust binary implementation
 * This is a simple wrapper around the core implementation
 * to maintain the same API while breaking circular dependencies
 * 
 * @param text - The text to uwuify
 * @returns The uwuified text
 */
export async function uwuifyText(text: string): Promise<string> {
  return uwuifyTextCore(text);
}
