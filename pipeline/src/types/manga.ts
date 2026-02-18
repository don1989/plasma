/**
 * Manga domain types — stubs for Phase 2 to flesh out.
 */

/** A single panel within a manga page. */
export interface Panel {
  id: string;
  pageNumber: number;
  panelNumber: number;
  description: string;
}

/** A manga page containing one or more panels. */
export interface Page {
  pageNumber: number;
  panels: Panel[];
}

/** A complete manga chapter. */
export interface Chapter {
  chapterNumber: number;
  title: string;
  pages: Page[];
}
