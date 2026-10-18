// The shape of a rendered output file. Renderers return these; the action and the CLI write them.

export interface OutputFile {
  path: string;
  content: string;
}
