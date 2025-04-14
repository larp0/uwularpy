#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import pLimit from 'p-limit'; // For concurrency control

const exec = promisify(execCb);

// --- Configuration ---
const CONCURRENCY_LIMIT = 32; // Max files to process simultaneously
const PLACEHOLDER_PREFIX = '___UWU_PLACEHOLDER_';
const PLACEHOLDER_SUFFIX = '___';
// ---------------------

/**
 * Finds and extracts special content blocks (HTML, links, code) using regex.
 * @param {string} content - The original file content.
 * @returns {Array<[number, number, string]>} - Array of [start index, end index, matched content].
 */
function extractPreservedContent(content) {
    const preservedContent = [];
    const patterns = [
        // HTML comments and tags (basic matching)
        /|<\/?\w+(?:\s+[^>]*)?>/gs,
        // Markdown links: [![alt](img)](url) or [text](url)
        /\[!\[.*?\]\(.*?\)\]\(.*?\)|\(.*?\)|\[.*?\]\(.*?\)/g, // Matches badge links or standard links
        // Code blocks (```...```)
        /```[\s\S]*?```/g,
        // Inline code (`...`)
        /`[^`]+?`/g,
    ];

    patterns.forEach(pattern => {
        for (const match of content.matchAll(pattern)) {
            // Add check to prevent overlapping matches being added multiple times
            const overlap = preservedContent.some(([start, end]) =>
                (match.index >= start && match.index < end) || // New match starts inside existing
                (match.index + match[0].length > start && match.index + match[0].length <= end) || // New match ends inside existing
                (match.index <= start && match.index + match[0].length >= end) // New match encompasses existing
            );
            if (!overlap) {
                preservedContent.push([match.index, match.index + match[0].length, match[0]]);
            }
        }
    });


    // Sort by start position descending to replace from end to start
    preservedContent.sort((a, b) => b[0] - a[0]);

    return preservedContent;
}


/**
 * Process a single markdown file with uwuify while preserving special content.
 * @param {string} inputPath - Absolute path to the markdown file.
 */
async function uwuifyFile(inputPath) {
    console.log(`Processing: ${inputPath}`);
    let tempDir = null; // Define tempDir outside try for finally block access

    try {
        // Read original content
        const originalContent = await fs.readFile(inputPath, 'utf-8');

        // Create a temporary directory
        // Use a prefix related to the script/purpose for easier identification
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uwuify-node-'));

        // Step 1: Extract and store special content
        const preservedContent = extractPreservedContent(originalContent);

        // Step 2: Replace special content with unique placeholders
        let modifiedContent = originalContent;
        const placeholders = []; // Store placeholders in the order they are created
        preservedContent.forEach(([start, end, content], i) => {
            const placeholder = `${PLACEHOLDER_PREFIX}${i}${PLACEHOLDER_SUFFIX}`;
            placeholders.push({ placeholder, content }); // Store for restoration
            modifiedContent = modifiedContent.slice(0, start) + placeholder + modifiedContent.slice(end);
        });

        // Reverse placeholders array because we sorted preservedContent descendingly
        // for replacement, but need ascending index for restoration matching placeholder index.
        placeholders.reverse();


        // Step 3: Write modified content to temporary file
        const tempInput = path.join(tempDir, "input.md");
        await fs.writeFile(tempInput, modifiedContent, 'utf-8');

        // Step 4: Run uwuify on the temporary file
        const tempOutput = path.join(tempDir, "output.md");
        // Quote paths to handle spaces or special characters
        const command = `uwuify -t 32 "${tempInput}" "${tempOutput}"`;
        try {
            await exec(command);
        } catch (cmdError) {
            // Handle errors from the uwuify command specifically
            console.error(`'uwuify' command failed for ${inputPath}: ${cmdError.stderr || cmdError.stdout || cmdError.message}`);
            // Optionally re-throw or return early if uwuify failure should stop processing this file
            throw cmdError; // Propagate the error up
        }


        // Step 5: Read uwuified content
        let uwuifiedContent = await fs.readFile(tempOutput, 'utf-8');

        // Step 6: Restore special content
        // Use the placeholders array which maintains the original index `i` correspondence
        placeholders.forEach(({ placeholder, content }) => {
             // Use split/join for global replace, safer than regex if content has special chars
            uwuifiedContent = uwuifiedContent.split(placeholder).join(content);
        });

        // Step 7: Write final content back to original file
        await fs.writeFile(inputPath, uwuifiedContent, 'utf-8');

        console.log(`Successfully processed: ${inputPath}`);

    } catch (error) {
        console.error(`Error processing ${inputPath}: ${error.message}`);
        // console.error(error.stack); // Uncomment for more detailed stack trace
    } finally {
        // Step 8: Clean up temporary directory
        if (tempDir) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error(`Error cleaning up temporary directory ${tempDir}: ${cleanupError.message}`);
            }
        }
    }
}

/**
 * Recursively finds all markdown files in a directory.
 * @param {string} dir - The directory to start searching from.
 * @returns {Promise<string[]>} - A promise that resolves to an array of markdown file paths.
 */
async function findMarkdownFiles(dir) {
    let markdownFiles = [];
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                // Exclude common directories like .git, node_modules
                if (entry.name !== '.git' && entry.name !== 'node_modules') {
                    markdownFiles = markdownFiles.concat(await findMarkdownFiles(fullPath));
                }
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                markdownFiles.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}: ${error.message}`);
        // Decide if you want to stop or just skip this directory
    }
    return markdownFiles;
}


/**
 * Finds and processes all markdown files in the repository root.
 * @param {string} rootDir - The root directory of the repository.
 */
async function processMarkdownFiles(rootDir) {
    console.log(`Starting scan in directory: ${rootDir}`);
    const markdownFiles = await findMarkdownFiles(rootDir);

    if (markdownFiles.length === 0) {
        console.log("No markdown files found to process.");
        return;
    }

    console.log(`Found ${markdownFiles.length} markdown files to process.`);

    const limit = pLimit(CONCURRENCY_LIMIT); // Create a limiter

    // Create an array of promises, each wrapped by the limiter
    const tasks = markdownFiles.map(filePath => {
        return limit(() => uwuifyFile(filePath));
    });

    // Wait for all tasks to settle (finish or fail)
    const results = await Promise.allSettled(tasks);

    // Optional: Report summary of successes/failures
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;
    console.log(`\nProcessing complete. ${successCount} files succeeded, ${failureCount} files failed.`);

    // Log details for failed tasks
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`Failed task details for ${markdownFiles[index]}: ${result.reason}`);
        }
    });
}

// --- Main Execution ---
// Equivalent to Python's `if __name__ == "__main__":`
// This ensures the main logic runs only when the script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const repoRoot = process.cwd(); // Get current working directory
    processMarkdownFiles(repoRoot)
        .then(() => {
            console.log("Script finished.");
        })
        .catch(error => {
            console.error("An unexpected error occurred during the process:", error);
            process.exit(1); // Exit with error code
        });
}
