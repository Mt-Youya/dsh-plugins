// Local oxlint JS plugin (alpha API, ESLint-compatible).
//
// Rule: `local/prefer-function-declaration`
//
// oxlint's built-in `func-style` rule reports arrow functions assigned to
// variables but has NO fixer (see the "🚧" mark in `oxlint --rules`), so it can
// never be applied by `oxlint --fix`. This plugin adds the missing fixer for the
// narrow, safe subset: module-level `const name = (...) => { ... }` written as a
// multi-line block body.
//
// What is converted:
//   export const handleClick = (event: Event) => { ... }
//   → export function handleClick(event: Event) { ... }
//
//   const SparklesText: React.FC<SparklesTextProps> = ({ children }) => { ... }
//   → function SparklesText({ children }: SparklesTextProps) { ... }
//
// What is left alone (conversion would be wrong or surprising):
//   - single-expression arrows / one-line declarations ("one-liners stay arrows")
//   - arrows inside callbacks or local helpers (only module-level `const` is visited)
//   - arrows that use `this` / `arguments` / `super` / `new.target`
//   - non-`const` declarations (reassignment would break)
//   - multi-declarator statements: `const a = () => {}, b = 1`
//   - variable type annotations other than `React.FC<P>` / `FunctionComponent<P>`
//     (they cannot be moved onto the parameter mechanically)
//   - `export default () => ...` (no name to declare)
//
// Because every report is fixable, `oxlint --fix` leaves this rule clean.

const UNSAFE_NODE_TYPES = new Set(["ThisExpression", "Super", "MetaProperty"])

function isUnsafe(node, parentKey) {
  if (!node || typeof node !== "object") return false
  if (typeof node.type === "string") {
    if (UNSAFE_NODE_TYPES.has(node.type)) return true
    if (node.type === "Identifier" && node.name === "arguments") return true
  }
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === parentKey) continue
    const value = node[key]
    if (Array.isArray(value)) {
      if (value.some((child) => isUnsafe(child, key))) return true
    } else if (value && typeof value === "object" && typeof value.type === "string") {
      if (isUnsafe(value, key)) return true
    }
  }
  return false
}

// `const SparklesText: React.FC<SparklesTextProps> = (props) => {...}` keeps the
// props type on the variable, not on the parameter. Turning it into a function
// declaration would drop that type (and the interface becomes unused), so the
// generic argument has to move onto the single parameter.
// Returns the props type node, or `undefined` when the annotation is not a
// supported component type (then the declaration is left untouched).
function getComponentPropsType(annotation, text) {
  const typeReference = annotation?.typeAnnotation
  if (typeReference?.type !== "TSTypeReference") return undefined
  if (!/^(React\.)?(FC|FunctionComponent)$/.test(text(typeReference.typeName))) return undefined
  const args = typeReference.typeArguments ?? typeReference.typeParameters
  if (!args?.params || args.params.length !== 1) return undefined
  return args.params[0]
}

const rule = {
  meta: {
    type: "suggestion",
    fixable: "code",
    schema: [],
    messages: {
      preferFunctionDeclaration: "Use a function declaration instead of a const arrow function.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()
    const text = (node) => sourceCode.getText(node)

    return {
      VariableDeclaration(node) {
        if (node.kind !== "const") return
        if (node.declarations.length !== 1) return

        // Only module-level declarations: `const foo = ...` or `export const foo = ...`.
        const parent = node.parent
        const isModuleLevel =
          parent?.type === "Program" || (parent?.type === "ExportNamedDeclaration" && parent.parent?.type === "Program")
        if (!isModuleLevel) return

        const declarator = node.declarations[0]
        if (declarator.id?.type !== "Identifier") return
        const arrow = declarator.init
        if (arrow?.type !== "ArrowFunctionExpression") return

        // Keep one-liners as arrows: only convert functions written as a
        // multi-line block body (a single-expression arrow already reads well).
        if (arrow.body.type !== "BlockStatement") return
        if (!text(node).includes("\n")) return
        if (isUnsafe(arrow.body)) return

        // A variable-level type annotation can only be carried over for `React.FC<P>`.
        const variableAnnotation = declarator.id.typeAnnotation ?? declarator.typeAnnotation
        let propsType
        if (variableAnnotation) {
          propsType = getComponentPropsType(variableAnnotation, text)
          if (!propsType) return
          if (arrow.params.length !== 1 || arrow.params[0].typeAnnotation) return
        }

        context.report({
          node,
          messageId: "preferFunctionDeclaration",
          fix(fixer) {
            const params = arrow.params
              .map((param, index) => (index === 0 && propsType ? `${text(param)}: ${text(propsType)}` : text(param)))
              .join(", ")
            const typeParams = arrow.typeParameters ? text(arrow.typeParameters) : ""
            let returnType = ""
            if (arrow.returnType) {
              const raw = text(arrow.returnType)
              returnType = raw.startsWith(":") ? raw : `: ${raw}`
            }
            const asyncKeyword = arrow.async ? "async " : ""
            const replacement = `${asyncKeyword}function ${declarator.id.name}${typeParams}(${params})${returnType} ${text(arrow.body)}`
            return fixer.replaceText(node, replacement)
          },
        })
      },
    }
  },
}

export default {
  meta: { name: "local" },
  rules: { "prefer-function-declaration": rule },
}
