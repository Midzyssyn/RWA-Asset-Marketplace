import { useId, useState, type ReactNode } from "react";

type Props = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

/** Admin 模块折叠：默认只露标题，点击展开表单 */
export function CollapsiblePanel({
  title,
  summary,
  defaultOpen = false,
  className = "",
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const bodyId = `${panelId}-body`;

  return (
    <div
      className={`panel collapsible-panel${open ? " is-open" : " is-collapsed"}${
        className ? ` ${className}` : ""
      }`}
    >
      <button
        type="button"
        className="collapsible-trigger"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="collapsible-trigger-text">
          <span className="collapsible-title">{title}</span>
          {!open && summary ? (
            <span className="collapsible-summary">{summary}</span>
          ) : null}
        </span>
        <span className="collapsible-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div id={bodyId} className="collapsible-body">
          {children}
        </div>
      ) : null}
    </div>
  );
}
