import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "../src/react/hooks");

for (const file of fs.readdirSync(dir)) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, "utf8");

  if (!content.includes("queryClient")) continue;

  content = content.replace(
    /import \{ queryClient \} from "\.\.\/\.\.\/api\/transport";\n?/g,
    ""
  );
  content = content.replace(
    /import \{ apiRequest, queryClient \} from "\.\.\/\.\.\/api\/transport";/g,
    'import { apiRequest } from "../../api/transport";'
  );
  content = content.replace(
    /import \{ queryClient, apiRequest \} from "\.\.\/\.\.\/api\/transport";/g,
    'import { apiRequest } from "../../api/transport";'
  );

  if (
    content.includes("queryClient") &&
    !content.includes("useQueryClient")
  ) {
    content = content.replace(
      'from "@tanstack/react-query";',
      'from "@tanstack/react-query";'
    );
    content = content.replace(
      /import \{([^}]+)\} from "@tanstack\/react-query";/,
      (_match, inner) => {
        const parts = inner
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        if (!parts.includes("useQueryClient")) {
          parts.push("useQueryClient");
        }
        return `import { ${parts.join(", ")} } from "@tanstack/react-query";`;
      }
    );
  }

  if (!content.includes("const queryClient = useQueryClient()")) {
    content = content.replace(
      /(export const use[A-Za-z0-9]+ = \([^)]*\) => \{\n(?:  const \{ notify \} = useNotifications\(\);\n)?)/,
      "$1  const queryClient = useQueryClient();\n"
    );
    content = content.replace(
      /(export function use[A-Za-z0-9]+[^{]*\{\n(?:  const \{ notify \} = useNotifications\(\);\n)?)/,
      "$1  const queryClient = useQueryClient();\n"
    );
  }

  fs.writeFileSync(filePath, content);
}

console.log("fixed queryClient imports");
