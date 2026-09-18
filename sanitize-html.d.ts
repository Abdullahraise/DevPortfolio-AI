declare module "sanitize-html" {
  type Transform = (
    tagName: string,
    attributes: Record<string, string>,
  ) => { tagName: string; attribs: Record<string, string> };

  type Options = {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    allowedSchemes?: string[];
    allowProtocolRelative?: boolean;
    allowVulnerableTags?: boolean;
    parseStyleAttributes?: boolean;
    nonTextTags?: string[];
    transformTags?: Record<string, Transform>;
  };

  export default function sanitizeHtml(input: string, options?: Options): string;
}
