declare module "markdown-it-sub";
declare module "markdown-it-sup";
declare module "markdown-it-emoji";
declare module "markdown-it-deflist";
declare module "markdown-it-implicit-figures";
declare module "markdown-it-table-of-contents";
declare module "markdown-it-ruby";
declare module "markdown-it-mark";
declare module "markdown-it-task-lists";

// ponytail: markdown-it v14 ships ESM .mjs files; re-export from @types/markdown-it
declare module "markdown-it/lib/token.mjs" {
  import Token_ from "markdown-it/lib/token";
  export default Token_;
}
