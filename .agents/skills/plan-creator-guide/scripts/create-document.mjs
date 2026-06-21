#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DOCUMENTS = {
  plan: {
    directory: path.join(".agents", "plans"),
    heading: "Plan",
    sections: ["Goal", "Context", "Steps", "Risks", "Validation"],
  },
  spec: {
    directory: path.join(".agents", "specs"),
    heading: "Spec",
    sections: [
      "Problem",
      "Requirements",
      "Acceptance Criteria",
      "Open Questions",
    ],
  },
  prompt: {
    directory: path.join(".agents", "promts"),
    heading: "Prompt",
    sections: ["Objective", "Context", "Instructions", "Expected Output"],
  },
};

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    printOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--type") {
      args.type = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--name") {
      args.name = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--root") {
      args.root = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--print-only") {
      args.printOnly = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function assertArgs(args) {
  if (!args.type || !DOCUMENTS[args.type]) {
    const types = Object.keys(DOCUMENTS).join(", ");
    throw new Error(`Missing or invalid --type. Expected one of: ${types}`);
  }
  if (!args.name) {
    throw new Error("Missing --name.");
  }
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  if (!slug) {
    throw new Error("--name must contain at least one letter or number.");
  }
  return slug;
}

function titleFromName(value) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|[-_\s])([a-z])/g, (_match, prefix, letter) => {
      return `${prefix === "-" || prefix === "_" ? " " : prefix}${letter.toUpperCase()}`;
    });
}

function getNextNumber(directory) {
  if (!fs.existsSync(directory)) {
    return "001";
  }
  const maxNumber = fs
    .readdirSync(directory, { withFileTypes: true })
    .reduce((max, item) => {
      const match = item.name.match(/^(\d+)-/);
      if (!match) {
        return max;
      }
      return Math.max(max, Number(match[1]));
    }, 0);
  return String(maxNumber + 1).padStart(3, "0");
}

function createTemplate(type, name) {
  const document = DOCUMENTS[type];
  const title = titleFromName(name);
  const sections = document.sections
    .map((section) => `## ${section}\n\nTODO`)
    .join("\n\n");
  return `# ${title} ${document.heading}\n\n${sections}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  assertArgs(args);
  const document = DOCUMENTS[args.type];
  const root = path.resolve(args.root);
  const directory = path.join(root, document.directory);
  const number = getNextNumber(directory);
  const filename = `${number}-${slugify(args.name)}.md`;
  const filePath = path.join(directory, filename);
  if (args.printOnly) {
    console.log(path.relative(root, filePath));
    return;
  }
  fs.mkdirSync(directory, { recursive: true });
  if (fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file: ${filePath}`);
  }
  fs.writeFileSync(filePath, createTemplate(args.type, args.name));
  console.log(path.relative(root, filePath));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
