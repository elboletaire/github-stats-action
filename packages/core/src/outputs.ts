// The shape of a rendered output file. Renderers return these; the action and the CLI write them.

export interface OutputFile {
  path: string;
  /** Text, or base64 when `encoding` says so (the dashboard's fonts). */
  content: string;
  encoding?: 'base64';
}
