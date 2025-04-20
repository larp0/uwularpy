#!/usr/bin/env node

require('dotenv/config'); // Load environment variables from .env

import * as fs from "fs";
import * as path from "path";
import { Command } from "commander";
import { codexRepository } from "./codex";
import { logger } from "@trigger.dev/sdk/v3";

// Create a new command instance
const program = new Command();

// Configure the CLI program
program
  .name("codex-cli")
  .description("CLI wrapper for debugging the Codex repository interface")
  .version("1.0.0");

// Add commands
program
  .command("process")
  .description("Process a repository with Codex")
  .requiredOption("-r, --repo <url>", "GitHub repository URL")
  .requiredOption("-b, --branch <name>", "Branch name to create")
  .option("-p, --prompt <text>", "Direct prompt text")
  .option("-f, --file <path>", "Path to prompt file")
  .option("--no-push", "Skip pushing to remote (for local testing)")
  .option("--keep-temp", "Keep temporary repository directory after execution")
  .option("--verbose", "Enable verbose logging")
  .option("--installation-id <id>", "GitHub App installation ID")
  .action(async (options: {
    repo: string;
    branch: string;
    prompt?: string;
    file?: string;
    push: boolean;
    keepTemp: boolean;
    verbose: boolean;
    installationId?: string;
  }) => {
    try {
      // Configure logger
      if (options.verbose) {
        // Enable more detailed logging
        console.log("Verbose logging enabled");
        // Note: Cannot directly set logger level in trigger.dev logger
        // Using console.log for additional debug information
      }

      logger.info("Starting Codex CLI", { options: { ...options, prompt: options.prompt ? "Present" : undefined } });

      // Get prompt from file or direct input
      let prompt: string;
      if (options.file) {
        try {
          prompt = fs.readFileSync(path.resolve(options.file), "utf-8");
          logger.info(`Loaded prompt from file: ${options.file}`, { promptLength: prompt.length });
        } catch (err) {
          logger.error(`Failed to read prompt file: ${options.file}`, { error: (err as Error).message });
          process.exit(1);
        }
      } else if (options.prompt) {
        prompt = options.prompt;
        logger.info("Using direct prompt text", { promptLength: prompt.length });
      } else {
        logger.error("Must provide either --prompt or --file");
        process.exit(1);
      }

      // Monkey patch execSync if --no-push is specified
      if (!options.push) {
        logger.info("--no-push specified, will skip push operation");
        const originalExecSync = require("child_process").execSync;
        require("child_process").execSync = function (command: string, ...args: any[]) {
          if (command.includes("git push")) {
            logger.info(`SKIPPED: ${command} (--no-push option active)`);
            return "";
          }
          return originalExecSync(command, ...args);
        };
      }

      // Call codexRepository function
      const tempDir = await codexRepository(
        prompt,
        options.repo,
        options.branch,
        options.installationId
      );

      logger.info("Repository processing complete", { tempDir });

      // Handle tempDir based on --keep-temp option
      if (!options.keepTemp) {
        logger.info(`Removing temporary directory: ${tempDir}`);
        fs.rmSync(tempDir, { recursive: true, force: true });
      } else {
        logger.info(`Temporary directory preserved: ${tempDir}`);
      }

    } catch (error) {
      logger.error("Error during Codex processing", { error: (error as Error).stack });
      process.exit(1);
    }
  });

program
  .command("evaluate")
  .description("Test the evaluator-optimizer on a prompt file")
  .requiredOption("-f, --file <path>", "Path to input file")
  .option("-o, --output <path>", "Path to output file (default: stdout)")
  .action((options: {
    file: string;
    output?: string;
  }) => {
    try {
      // This is a special mode for testing the evaluator-optimizer function
      const { evaluateAndOptimize } = require("./codex");
      
      const inputText = fs.readFileSync(path.resolve(options.file), "utf-8");
      const optimizedText = evaluateAndOptimize(inputText, process.cwd());
      
      if (options.output) {
        fs.writeFileSync(options.output, optimizedText, "utf-8");
        console.log(`Optimized output written to: ${options.output}`);
      } else {
        console.log("\n--- OPTIMIZED OUTPUT ---\n");
        console.log(optimizedText);
      }
    } catch (error) {
      logger.error("Error during evaluation", { error: (error as Error).stack });
      process.exit(1);
    }
  });

program
  .command("search-replace")
  .description("Test the search & replace functionality on a local directory")
  .requiredOption("-f, --file <path>", "Path to file containing search/replace blocks")
  .requiredOption("-d, --dir <path>", "Directory to apply changes to")
  .option("--dry-run", "Don't apply changes, just show what would be done")
  .action((options: {
    file: string;
    dir: string;
    dryRun?: boolean;
  }) => {
    try {
      // This is a special mode for testing the search/replace function
      const { processSearchReplaceBlocks } = require("./codex");
      
      const inputText = fs.readFileSync(path.resolve(options.file), "utf-8");
      const targetDir = path.resolve(options.dir);
      
      if (options.dryRun) {
        console.log(`Dry run mode: Changes will not be applied to: ${targetDir}`);
        
        // Create a custom mock version that just logs what would happen
        const mockSearch = (text: string, dir: string) => {
          const regex = /```search-replace\n([\s\S]*?)```/g;
          const fileRegex = /FILE:\s*(.*)/;
          const opRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
          
          let match;
          while ((match = regex.exec(text)) !== null) {
            const block = match[1];
            const fileMatch = block.match(fileRegex);
            if (!fileMatch) continue;
            
            const filePath = path.join(dir, fileMatch[1].trim());
            console.log(`\nFile: ${filePath}`);
            
            let opMatch;
            while ((opMatch = opRegex.exec(block)) !== null) {
              console.log(`\n  SEARCH (${opMatch[1].length} chars):\n  ${opMatch[1].substring(0, 100)}${opMatch[1].length > 100 ? '...' : ''}`);
              console.log(`\n  REPLACE (${opMatch[2].length} chars):\n  ${opMatch[2].substring(0, 100)}${opMatch[2].length > 100 ? '...' : ''}`);
            }
          }
          return [];
        };
        
        mockSearch(inputText, targetDir);
      } else {
        const changes = processSearchReplaceBlocks(inputText, targetDir);
        console.log("Applied changes:", changes);
      }
    } catch (error) {
      logger.error("Error during search & replace", { error: (error as Error).stack });
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
