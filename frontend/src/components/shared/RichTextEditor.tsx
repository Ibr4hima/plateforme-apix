"use client";

import { useEffect, useRef } from "react";

function RichToolBtn({ label, title, onExec, italic }: {
  label: string; title: string; onExec: () => void; italic?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onExec(); }}
      style={{ minWidth: 30, height: 28, padding: "0 5px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 5, border: "1px solid transparent", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: italic ? "normal" : 700, fontStyle: italic ? "italic" : "normal", color: "#4a5568", fontFamily: "var(--font-google-sans)" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#F2F0EF"; e.currentTarget.style.borderColor = "#C5BFBB"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
      {label}
    </button>
  );
}

const SEP = <div style={{ width: 1, background: "#E8E5E3", margin: "0 3px", alignSelf: "stretch" as const }} />;

export default function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const skipSync = useRef(false);

  useEffect(() => {
    if (ref.current && !skipSync.current) ref.current.innerHTML = value || "";
    skipSync.current = false;
  }, [value]);

  const emit = () => {
    skipSync.current = true;
    onChange(ref.current?.innerHTML || "");
  };

  const exec = (cmd: string) => {
    document.execCommand(cmd, false);
    emit();
    ref.current?.focus();
  };

  // Insère une liste à tirets cadratins — même comportement que la liste à puces,
  // avec list-style-type: "— " via la classe CSS dash-list.
  const insertDashList = () => {
    ref.current?.focus();
    document.execCommand("insertUnorderedList", false);
    // Après l'exécution, on cherche le <ul> courant et on lui applique dash-list.
    // Si la commande a toggleé la liste (supprimé), aucun <ul> ne sera trouvé → pas d'effet.
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.getRangeAt(0).startContainer;
      while (node && node !== ref.current) {
        if (node.nodeName === "UL") {
          (node as HTMLElement).classList.add("dash-list");
          break;
        }
        node = node.parentNode;
      }
    }
    emit();
  };

  return (
    <div style={{ border: "1px solid #C5BFBB", borderRadius: 8, overflow: "hidden" }}>
      <style>{`
        [data-rte] ul{padding-left:20px;list-style-type:disc}
        [data-rte] ul.dash-list{list-style-type:"— ";padding-left:22px}
        [data-rte] ol{padding-left:20px;list-style-type:decimal}
        [data-rte] li{margin-bottom:2px}
        [data-rte][contenteditable] *{font-family:var(--font-google-sans)!important;font-size:13px!important;background:transparent!important}
      `}</style>
      <div style={{ display: "flex", gap: 2, padding: "5px 8px", background: "#fff", borderBottom: "1px solid #E8E5E3", flexWrap: "wrap" as const }}>
        <RichToolBtn label="G"  title="Gras (Ctrl+B)"              onExec={() => exec("bold")} />
        <RichToolBtn label="I"  title="Italique (Ctrl+I)"          onExec={() => exec("italic")} italic />
        {SEP}
        <RichToolBtn label="•"  title="Liste à puces"              onExec={() => exec("insertUnorderedList")} />
        <RichToolBtn label="—"  title="Liste à tirets cadratins"   onExec={insertDashList} />
        <RichToolBtn label="1." title="Liste numérotée"            onExec={() => exec("insertOrderedList")} />
        {SEP}
        <RichToolBtn label="⇥"  title="Augmenter l'indentation"    onExec={() => exec("indent")} />
        <RichToolBtn label="⇤"  title="Diminuer l'indentation"     onExec={() => exec("outdent")} />
      </div>
      <div
        ref={ref}
        data-rte
        contentEditable
        suppressContentEditableWarning
        onKeyDown={e => {
          if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); exec("bold"); }
          if ((e.ctrlKey || e.metaKey) && e.key === "i") { e.preventDefault(); exec("italic"); }
        }}
        onPaste={e => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          emit();
        }}
        onInput={emit}
        style={{ minHeight: 120, padding: "10px 12px", outline: "none", fontSize: 13, color: "#1a1a2e", lineHeight: 1.7, background: "#F2F0EF", fontFamily: "var(--font-google-sans)" }}
      />
    </div>
  );
}
