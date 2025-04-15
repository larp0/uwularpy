// src/lib/rust-uwuify.ts
// This file provides a wrapper for the Rust uwuify implementation

import { uwuify } from 'uwuify-rs';

/**
 * Uwuifies text using the Rust implementation
 * 
 * @param text - The text to uwuify
 * @returns The uwuified text
 * @throws Error if the Rust uwuification fails
 */
export function uwuifyText(text: string): string {
  try {
    // Use the Rust implementation exclusively, with no JavaScript fallback
    return uwuify(text);
  } catch (error) {
    console.error('Error in Rust uwuify implementation:', error);
    // Instead of falling back to JavaScript, throw an error
    throw new Error(`Rust uwuification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
