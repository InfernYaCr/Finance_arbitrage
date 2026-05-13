import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { navItems as hardcodedNavItems } from './nav';
import type { NavItem } from './nav';

const DATA_ROOT = import.meta.env.CONTENT_OUTPUT_DIR
  ? resolve(process.cwd(), import.meta.env.CONTENT_OUTPUT_DIR as string)
  : resolve(process.cwd(), '..', 'site_pipeline', 'output');

const NAV_PATH = resolve(DATA_ROOT, 'nav.json');

function loadNavItems(): NavItem[] {
  if (!existsSync(NAV_PATH)) {
    return hardcodedNavItems;
  }
  try {
    return JSON.parse(readFileSync(NAV_PATH, 'utf-8')) as NavItem[];
  } catch {
    return hardcodedNavItems;
  }
}

export const navItems: NavItem[] = loadNavItems();
