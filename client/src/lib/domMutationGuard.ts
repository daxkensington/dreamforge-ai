/**
 * Chrome/Edge's built-in page translator and Google Translate rewrite React-managed
 * text nodes into <font> wrappers. When React later commits an update that removes
 * one of those nodes, the native DOM call throws NotFoundError and unmounts the
 * whole tree (Sentry DREAMFORGE-8, react#11538). These guards make removeChild
 * and insertBefore no-ops when a third party has already re-parented the node.
 */
export function installDomMutationGuard() {
  if (typeof Node === "undefined") return;

  type RemoveChildFn = <T extends Node>(child: T) => T;
  const originalRemoveChild = Node.prototype.removeChild as RemoveChildFn;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      console.error("removeChild skipped: node was re-parented by a DOM mutation", child);
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  type InsertBeforeFn = <T extends Node>(node: T, child: Node | null) => T;
  const originalInsertBefore = Node.prototype.insertBefore as InsertBeforeFn;
  Node.prototype.insertBefore = function <T extends Node>(node: T, child: Node | null): T {
    if (child && child.parentNode !== this) {
      console.error("insertBefore skipped: reference node was re-parented by a DOM mutation", child);
      return node;
    }
    return originalInsertBefore.call(this, node, child) as T;
  };
}
