// src/lib/rust-uwuify.ts
// This file provides a wrapper for the direct Rust uwuify binary implementation

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Path to the uwuify binary
const UWUIFY_BINARY_PATH = path.join(process.cwd(), 'src', 'lib', 'bin', 'uwuify');

/**
 * Ensures the uwuify binary is executable
 * @returns Promise that resolves when the binary is ready
 */
async function ensureBinaryExecutable(): Promise<void> {
  try {
    // Check if the binary exists and is executable
    await fs.promises.access(UWUIFY_BINARY_PATH, fs.constants.X_OK);
    // Binary exists and is executable
    return;
  } catch (error) {
    // Binary doesn't exist or isn't executable
    console.error('Error accessing uwuify binary:', error);
    throw new Error(`Failed to access uwuify binary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Uwuifies text using the Rust binary implementation
 * 
 * @param text - The text to uwuify
 * @returns The uwuified text
 * @throws Error if the Rust uwuification fails
 */
export async function uwuifyText(text: string): Promise<string> {
  try {
    // Ensure the binary is executable
    await ensureBinaryExecutable();
    
    // Execute the uwuify binary with the input text
    // We use echo to pipe the text to the binary to handle large inputs and special characters
    const { stdout, stderr } = await execAsync(`echo "${text.replace(/"/g, '\\"')}" | ${UWUIFY_BINARY_PATH}`);
    
    if (stderr) {
      console.error('Error from uwuify binary:', stderr);
      throw new Error(`Rust uwuification failed: ${stderr}`);
    }
    
    return stdout.trim();
  } catch (error) {
    console.error('Error in Rust uwuify implementation:', error);
    // Instead of falling back to JavaScript, throw an error
    throw new Error(`Rust uwuification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
