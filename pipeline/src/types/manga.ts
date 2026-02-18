/**
 * Manga domain types for the Plasma pipeline.
 *
 * These types model the structure of chapter scripts as parsed from
 * Markdown source files. They are the foundation for the script parser,
 * prompt template engine, and assembly stages.
 */

/** A single line of dialogue within a panel. */
export interface DialogueLine {
  character: string;
  line: string;
  type: 'speech' | 'thought' | 'narration';
}

/** A single panel within a manga page. */
export interface Panel {
  panelNumber: number;
  shotType: string;
  action: string;
  dialogue: DialogueLine[];
  sfx: string;
  notes: string;
  tags: string[];
}

/** A manga page containing one or more panels. */
export interface Page {
  pageNumber: number;
  panels: Panel[];
  isSplash: boolean;
  isDoubleSpread: boolean;
}

/** A complete manga chapter with metadata and page content. */
export interface Chapter {
  chapterNumber: number;
  title: string;
  themeBeat: string;
  estimatedPages: number;
  characters: string[];
  locations: string[];
  pages: Page[];
}
