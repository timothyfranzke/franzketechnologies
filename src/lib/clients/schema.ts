export type ClientItem =
  | { type: "image"; src: string; caption?: string; alt?: string }
  | { type: "pdf"; src: string; caption?: string }
  | { type: "link"; href: string; label: string; caption?: string };

export interface ClientSection {
  title: string;
  description?: string;
  items: ClientItem[];
}

export interface ClientPage {
  guid: string;
  client: string;
  title?: string;
  intro?: string;
  sections: ClientSection[];
  updatedAt?: string;
}

export function parseClientPage(raw: unknown, sourceFile: string): ClientPage {
  const fail = (msg: string): never => {
    throw new Error(`Invalid client manifest ${sourceFile}: ${msg}`);
  };

  if (!raw || typeof raw !== "object") fail("expected a JSON object");
  const obj = raw as Record<string, unknown>;

  const requireString = (key: string): string => {
    const v = obj[key];
    if (typeof v !== "string" || v.length === 0) fail(`missing or empty "${key}"`);
    return v as string;
  };

  const guid = requireString("guid");
  const client = requireString("client");

  const title = typeof obj.title === "string" ? obj.title : undefined;
  const intro = typeof obj.intro === "string" ? obj.intro : undefined;
  const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt : undefined;

  if (!Array.isArray(obj.sections)) fail(`"sections" must be an array`);
  const sections = (obj.sections as unknown[]).map((s, i) => parseSection(s, `${sourceFile}#sections[${i}]`));

  return { guid, client, title, intro, sections, updatedAt };
}

function parseSection(raw: unknown, path: string): ClientSection {
  if (!raw || typeof raw !== "object") throw new Error(`${path}: expected an object`);
  const obj = raw as Record<string, unknown>;
  if (typeof obj.title !== "string" || obj.title.length === 0) {
    throw new Error(`${path}: missing or empty "title"`);
  }
  if (!Array.isArray(obj.items)) throw new Error(`${path}: "items" must be an array`);
  const description = typeof obj.description === "string" ? obj.description : undefined;
  const items = (obj.items as unknown[]).map((it, i) => parseItem(it, `${path}.items[${i}]`));
  return { title: obj.title, description, items };
}

function parseItem(raw: unknown, path: string): ClientItem {
  if (!raw || typeof raw !== "object") throw new Error(`${path}: expected an object`);
  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  const caption = typeof obj.caption === "string" ? obj.caption : undefined;

  if (type === "image") {
    if (typeof obj.src !== "string" || obj.src.length === 0) {
      throw new Error(`${path}: image requires "src"`);
    }
    const alt = typeof obj.alt === "string" ? obj.alt : undefined;
    return { type: "image", src: obj.src, caption, alt };
  }
  if (type === "pdf") {
    if (typeof obj.src !== "string" || obj.src.length === 0) {
      throw new Error(`${path}: pdf requires "src"`);
    }
    return { type: "pdf", src: obj.src, caption };
  }
  if (type === "link") {
    if (typeof obj.href !== "string" || obj.href.length === 0) {
      throw new Error(`${path}: link requires "href"`);
    }
    if (typeof obj.label !== "string" || obj.label.length === 0) {
      throw new Error(`${path}: link requires "label"`);
    }
    return { type: "link", href: obj.href, label: obj.label, caption };
  }
  throw new Error(`${path}: unknown item type ${JSON.stringify(type)}`);
}
