import { useState, useRef, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen = "input" | "generating" | "result" | "error";
type ErrorKind = "invalid_url" | "empty_file" | "generation_failure";

// ─── Constants ───────────────────────────────────────────────────────────────

const LOG_STEPS = [
  { delay: 0,    text: "> Resolving repository source…",                dim: false },
  { delay: 420,  text: "> Fetching file tree from origin…",             dim: false },
  { delay: 900,  text: "  found 34 files across 6 directories",         dim: true  },
  { delay: 1300, text: "> Detecting stack…",                            dim: false },
  { delay: 1700, text: "  TypeScript · React 19 · Vite · Tailwind",     dim: true  },
  { delay: 2100, text: "> Parsing package.json dependencies…",          dim: false },
  { delay: 2550, text: "  23 runtime deps · 11 dev deps",               dim: true  },
  { delay: 2950, text: "> Identifying entry points and exports…",       dim: false },
  { delay: 3400, text: "  src/main.tsx · src/App.tsx · vite.config.ts", dim: true  },
  { delay: 3800, text: "> Composing README sections…",                  dim: false },
  { delay: 4200, text: "  Installation · Usage · Scripts · License",    dim: true  },
  { delay: 4700, text: "> Running quality pass…",                       dim: false },
  { delay: 5150, text: "  badges · formatting · link validation",       dim: true  },
  { delay: 5600, text: "> Writing README.md",                           dim: false },
  { delay: 6100, text: "  done  ✓",                                     dim: false, accent: true },
];

const LOG_STEPS_ERROR = [
  { delay: 0,    text: "> Resolving repository source…",   dim: false },
  { delay: 420,  text: "> Fetching file tree from origin…",dim: false },
  { delay: 950,  text: "  error: request failed (404)",    dim: false, err: true  },
  { delay: 1400, text: "> Retrying with fallback resolver…",dim: false },
  { delay: 1900, text: "  error: no content returned",     dim: false, err: true  },
  { delay: 2300, text: "> Aborting process",               dim: false },
  { delay: 2700, text: "  exit 1",                         dim: false, err: true  },
];

// README content with [VERIFY] flags
const README_LINES: Array<{ text: string; type: "h1"|"h2"|"h3"|"body"|"code"|"verify"|"blank" }> = [
  { text: "# my-project", type: "h1" },
  { text: "", type: "blank" },
  { text: "A lightweight utility library for parsing and transforming structured data pipelines in Node.js environments.", type: "body" },
  { text: "", type: "blank" },
  { text: "## Requirements", type: "h2" },
  { text: "", type: "blank" },
  { text: "- Node.js ≥ 18.0.0", type: "body" },
  { text: "- pnpm 9 or npm 10", type: "body" },
  { text: "[VERIFY] Minimum Node version — package.json engines field not found", type: "verify" },
  { text: "", type: "blank" },
  { text: "## Installation", type: "h2" },
  { text: "", type: "blank" },
  { text: "npm install my-project", type: "code" },
  { text: "", type: "blank" },
  { text: "## Usage", type: "h2" },
  { text: "", type: "blank" },
  { text: "import { pipeline } from 'my-project';", type: "code" },
  { text: "", type: "blank" },
  { text: "const result = pipeline", type: "code" },
  { text: "  .from(source)", type: "code" },
  { text: "  .transform(fn)", type: "code" },
  { text: "  .run();", type: "code" },
  { text: "", type: "blank" },
  { text: "[VERIFY] Usage example inferred from source — no examples/ directory found", type: "verify" },
  { text: "", type: "blank" },
  { text: "## Scripts", type: "h2" },
  { text: "", type: "blank" },
  { text: "| Command         | Description                |", type: "body" },
  { text: "| --------------- | -------------------------- |", type: "body" },
  { text: "| `pnpm dev`      | Start development server   |", type: "body" },
  { text: "| `pnpm build`    | Production build           |", type: "body" },
  { text: "| `pnpm test`     | Run test suite             |", type: "body" },
  { text: "| `pnpm lint`     | Lint and format            |", type: "body" },
  { text: "", type: "blank" },
  { text: "## Configuration", type: "h2" },
  { text: "", type: "blank" },
  { text: "Create a `.myprojectrc` file in your project root:", type: "body" },
  { text: "", type: "blank" },
  { text: "{", type: "code" },
  { text: '  "timeout": 5000,', type: "code" },
  { text: '  "retries": 3,', type: "code" },
  { text: '  "strict": true', type: "code" },
  { text: "}", type: "code" },
  { text: "", type: "blank" },
  { text: "[VERIFY] Config schema inferred from source types — no docs/config.md found", type: "verify" },
  { text: "", type: "blank" },
  { text: "## Contributing", type: "h2" },
  { text: "", type: "blank" },
  { text: "Pull requests welcome. Please open an issue first to discuss what you would like to change.", type: "body" },
  { text: "", type: "blank" },
  { text: "## License", type: "h2" },
  { text: "", type: "blank" },
  { text: "MIT", type: "body" },
  { text: "[VERIFY] License detected as MIT — no LICENSE file present in root", type: "verify" },
];

const ERROR_MESSAGES: Record<ErrorKind, { title: string; reason: string; detail: string }> = {
  invalid_url: {
    title: "Invalid or unreachable URL",
    reason: "The URL you provided returned a 404 or could not be resolved.",
    detail: "Make sure the repository is public and the URL points to a valid GitHub, GitLab, or raw file tree.",
  },
  empty_file: {
    title: "File is empty or unreadable",
    reason: "The package.json you uploaded contains no parseable content.",
    detail: "Check that the file is valid JSON and not empty. Minified or corrupted files may also cause this.",
  },
  generation_failure: {
    title: "Generation failed",
    reason: "The model encountered an error while composing the README.",
    detail: "This can happen with unusual repository structures. Try simplifying your input or pasting a subset of the file tree.",
  },
};

// ─── Shared primitives ────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const CARD: React.CSSProperties = {
  backgroundColor: "#141417",
  border: "1px solid #252529",
  borderRadius: "10px",
  overflow: "hidden",
};
const TOPBAR: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 14px",
  borderBottom: "1px solid #252529",
  backgroundColor: "#111114",
};

function Label({ children, color = "#6b6b75" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ ...MONO, fontSize: "11px", color, letterSpacing: "0.08em" }}>
      {children}
    </span>
  );
}

function Btn({
  children, onClick, disabled, variant = "primary", style: extraStyle,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  style?: React.CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  const isPrimary = variant === "primary";
  const active = !disabled;

  const bg = isPrimary
    ? active ? (hover ? "#86efac" : "#4ade80") : "#1a3325"
    : active ? (hover ? "#252529" : "#1e1e22") : "#141417";

  const color = isPrimary
    ? active ? "#0d1f14" : "#2e6644"
    : active ? "#9b9ba8" : "#3e3e46";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: "7px",
        padding: "9px 18px", borderRadius: "6px",
        backgroundColor: bg, color,
        border: isPrimary ? "none" : "1px solid #252529",
        cursor: active ? "pointer" : "not-allowed",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600, fontSize: "13.5px",
        letterSpacing: "-0.01em",
        transition: "background-color 0.15s, color 0.15s",
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}

// ─── Typewriter ───────────────────────────────────────────────────────────────

function useTypewriter(text: string, started: boolean) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!started) { setDisplayed(""); return; }
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [text, started]);
  return displayed;
}

function LogLine({ text, dim, accent, err, started }: {
  text: string; dim?: boolean; accent?: boolean; err?: boolean; started: boolean;
}) {
  const displayed = useTypewriter(text, started);
  const color = err ? "#f87171" : accent ? "#4ade80" : dim ? "#474750" : "#9b9ba8";
  return (
    <div style={{ ...MONO, fontSize: "12.5px", lineHeight: "1.9", color, whiteSpace: "pre" }}>
      {displayed}
      {displayed.length < text.length && started && (
        <span style={{
          display: "inline-block", width: "7px", height: "13px",
          backgroundColor: err ? "#f87171" : "#4ade80",
          marginLeft: "1px", verticalAlign: "text-bottom",
          animation: "blink 1s step-end infinite",
        }} />
      )}
    </div>
  );
}

// ─── Generating view ──────────────────────────────────────────────────────────

function GeneratingView({ onDone, simulateError }: {
  onDone: (outcome: "result" | "error", errorKind?: ErrorKind) => void;
  simulateError: boolean;
}) {
  const steps = simulateError ? LOG_STEPS_ERROR : LOG_STEPS;
  const [visibleCount, setVisibleCount] = useState(0);
  const [done, setDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((step, i) => {
      timers.push(setTimeout(() => {
        setVisibleCount(i + 1);
        setTimeout(() => {
          if (containerRef.current)
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }, 50);
      }, step.delay));
    });
    const lastDelay = steps[steps.length - 1].delay + 700;
    timers.push(setTimeout(() => setDone(true), lastDelay));
    return () => timers.forEach(clearTimeout);
  }, []);

  const failed = simulateError;

  return (
    <div className="w-full max-w-2xl" style={CARD}>
      <div style={TOPBAR}>
        <Label>PROCESS</Label>
        <span style={{ flex: 1 }} />
        <Label color={done ? (failed ? "#f87171" : "#4ade80") : "#6b6b75"}>
          {done ? (failed ? "exit 1" : "exit 0") : "running…"}
        </Label>
      </div>

      <div ref={containerRef} style={{ padding: "18px 20px", minHeight: "220px", maxHeight: "320px", overflowY: "auto" }}>
        <style>{`
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes fadein { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:translateY(0)} }
        `}</style>
        {steps.slice(0, visibleCount).map((step, i) => (
          <div key={i} style={{ animation: "fadein 0.2s ease both" }}>
            <LogLine text={step.text} dim={step.dim} accent={(step as any).accent} err={(step as any).err} started />
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid #252529", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
        <Label>readme.gen · generating</Label>
        <Btn
          disabled={!done}
          onClick={() => done && onDone(failed ? "error" : "result", failed ? "invalid_url" : undefined)}
        >
          {done ? (failed ? "See what went wrong →" : "View README →") : "Working…"}
        </Btn>
      </div>
    </div>
  );
}

// ─── Result view ──────────────────────────────────────────────────────────────

function DownloadMenu({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const download = (ext: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `README.${ext}`; a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "7px",
          padding: "9px 18px", borderRadius: "6px",
          backgroundColor: open ? "#252529" : "#1e1e22",
          color: "#9b9ba8",
          border: "1px solid #252529",
          cursor: "pointer",
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600, fontSize: "13.5px",
          letterSpacing: "-0.01em",
          transition: "background-color 0.15s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#252529")}
        onMouseLeave={e => { if (!open) e.currentTarget.style.backgroundColor = "#1e1e22"; }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v9M5 8l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Download
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }}>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", right: 0,
          backgroundColor: "#1a1a1e", border: "1px solid #2e2e33",
          borderRadius: "7px", overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          minWidth: "160px",
          animation: "fadein 0.12s ease both",
          zIndex: 10,
        }}>
          {[
            { label: "Markdown (.md)", ext: "md", mime: "text/markdown" },
            { label: "Plain text (.txt)", ext: "txt", mime: "text/plain" },
          ].map(opt => (
            <button
              key={opt.ext}
              onClick={() => download(opt.ext, opt.mime)}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                width: "100%", padding: "10px 14px",
                background: "none", border: "none",
                color: "#c8c8d2", cursor: "pointer",
                fontFamily: "'Inter', sans-serif", fontSize: "13px",
                textAlign: "left", transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#252529")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <span style={{ ...MONO, fontSize: "10px", color: "#4ade80", minWidth: "24px" }}>
                .{opt.ext}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadmeLine({ item }: { item: typeof README_LINES[0] }) {
  if (item.type === "blank") return <div style={{ height: "0.6em" }} />;

  if (item.type === "verify") {
    return (
      <div style={{
        display: "flex", alignItems: "flex-start", gap: "10px",
        margin: "2px 0",
        padding: "6px 10px",
        backgroundColor: "#1e1600",
        border: "1px solid #3d2e00",
        borderLeft: "3px solid #f59e0b",
        borderRadius: "4px",
      }}>
        <span style={{
          ...MONO, fontSize: "9.5px", fontWeight: 600,
          color: "#f59e0b", letterSpacing: "0.1em",
          marginTop: "1px", flexShrink: 0,
        }}>
          VERIFY
        </span>
        <span style={{ ...MONO, fontSize: "11.5px", color: "#a37e2c", lineHeight: 1.6 }}>
          {item.text.replace("[VERIFY] ", "")}
        </span>
      </div>
    );
  }

  if (item.type === "code") {
    return (
      <span style={{
        display: "block", ...MONO, fontSize: "12px",
        color: "#9b9ba8", lineHeight: "1.7",
        backgroundColor: "#111114",
        padding: "0 14px",
      }}>
        {item.text}
      </span>
    );
  }

  const sizeMap = { h1: "1.1rem", h2: "0.95rem", h3: "0.875rem", body: "0.8125rem" };
  const colorMap = { h1: "#e2e2e6", h2: "#c8c8d2", h3: "#b0b0bc", body: "#8a8a96" };
  const weightMap = { h1: 600, h2: 600, h3: 600, body: 400 };
  const marginMap = { h1: "6px 0 2px", h2: "10px 0 2px", h3: "6px 0 2px", body: "0" };

  return (
    <div style={{
      fontSize: sizeMap[item.type as keyof typeof sizeMap],
      color: colorMap[item.type as keyof typeof colorMap],
      fontWeight: weightMap[item.type as keyof typeof weightMap],
      margin: marginMap[item.type as keyof typeof marginMap],
      lineHeight: 1.65,
      fontFamily: item.type === "body" ? "'Inter', sans-serif" : "'Inter', sans-serif",
    }}>
      {item.text}
    </div>
  );
}

function ResultView({ onReset }: { onReset: () => void }) {
  const verifyCount = README_LINES.filter(l => l.type === "verify").length;
  const rawContent = README_LINES
    .map(l => l.type === "verify" ? `<!-- [VERIFY] ${l.text.replace("[VERIFY] ", "")} -->` : l.text)
    .join("\n");

  return (
    <div className="w-full max-w-2xl" style={CARD}>
      {/* Top bar */}
      <div style={TOPBAR}>
        <Label>OUTPUT</Label>
        <span style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            ...MONO, fontSize: "10px",
            color: "#f59e0b",
            backgroundColor: "#1e1600",
            border: "1px solid #3d2e00",
            padding: "2px 8px",
            borderRadius: "4px",
            letterSpacing: "0.06em",
          }}>
            {verifyCount} VERIFY flag{verifyCount !== 1 ? "s" : ""}
          </span>
          <Label color="#4ade80">README.md</Label>
        </div>
      </div>

      {/* README content */}
      <div style={{ padding: "20px 22px", maxHeight: "380px", overflowY: "auto" }}>
        {/* Code block wrapper for code lines */}
        {(() => {
          const elements: React.ReactNode[] = [];
          let codeBuffer: string[] = [];
          let key = 0;

          const flushCode = () => {
            if (codeBuffer.length) {
              elements.push(
                <div key={`code-${key++}`} style={{
                  backgroundColor: "#111114",
                  border: "1px solid #1e1e22",
                  borderRadius: "5px",
                  margin: "4px 0 8px",
                  padding: "10px 0",
                  overflow: "auto",
                }}>
                  {codeBuffer.map((line, i) => (
                    <span key={i} style={{
                      display: "block", ...MONO, fontSize: "12px",
                      color: "#9b9ba8", lineHeight: "1.7", padding: "0 14px",
                    }}>
                      {line || " "}
                    </span>
                  ))}
                </div>
              );
              codeBuffer = [];
            }
          };

          README_LINES.forEach((item, i) => {
            if (item.type === "code") {
              codeBuffer.push(item.text);
            } else {
              flushCode();
              elements.push(<ReadmeLine key={`line-${i}`} item={item} />);
            }
          });
          flushCode();
          return elements;
        })()}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid #252529",
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px", gap: "10px", flexWrap: "wrap",
      }}>
        <button
          onClick={onReset}
          style={{
            ...MONO, fontSize: "11.5px", color: "#474750",
            background: "none", border: "none",
            cursor: "pointer", padding: "4px 0",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#6b6b75")}
          onMouseLeave={e => (e.currentTarget.style.color = "#474750")}
        >
          ← Start over
        </button>
        <DownloadMenu content={rawContent} />
      </div>
    </div>
  );
}

// ─── Error view ───────────────────────────────────────────────────────────────

function ErrorView({ kind, onRetry }: { kind: ErrorKind; onRetry: () => void }) {
  const info = ERROR_MESSAGES[kind];

  return (
    <div className="w-full max-w-2xl" style={CARD}>
      <div style={TOPBAR}>
        <Label>OUTPUT</Label>
        <span style={{ flex: 1 }} />
        <Label color="#f87171">generation failed</Label>
      </div>

      <div style={{ padding: "32px 28px 28px" }}>
        {/* Error header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "8px",
            backgroundColor: "#1f0e0e", border: "1px solid #3d1515",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 5v4M8 10.5v.5" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M6.5 2.5l-5 9a1 1 0 0 0 .87 1.5h11.26a1 1 0 0 0 .87-1.5l-5-9a1 1 0 0 0-1.74 0Z" stroke="#f87171" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 600,
              fontSize: "0.9375rem", color: "#e2e2e6",
              marginBottom: "4px",
            }}>
              {info.title}
            </p>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#6b6b75", lineHeight: 1.6 }}>
              {info.reason}
            </p>
          </div>
        </div>

        {/* Why it didn't work */}
        <div style={{
          backgroundColor: "#0f0f11",
          border: "1px solid #1e1e22",
          borderRadius: "6px",
          padding: "14px 16px",
          marginBottom: "24px",
        }}>
          <p style={{ ...MONO, fontSize: "10.5px", color: "#474750", letterSpacing: "0.08em", marginBottom: "6px" }}>
            WHY IT DIDN'T WORK
          </p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#6b6b75", lineHeight: 1.65 }}>
            {info.detail}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <Btn onClick={onRetry}>
            Try again
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Input view ───────────────────────────────────────────────────────────────

function InputView({
  input, setInput, fileName, setFileName, onGenerate,
}: {
  input: string;
  setInput: (v: string) => void;
  fileName: string | null;
  setFileName: (v: string | null) => void;
  onGenerate: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasInput = input.trim().length > 0 || fileName !== null;

  const handleFile = (file: File) => {
    if (file.name === "package.json" || file.type === "application/json") setFileName(file.name);
  };

  return (
    <div className="w-full max-w-2xl" style={CARD}>
      <div style={TOPBAR}>
        <Label>INPUT</Label>
        <span style={{ flex: 1 }} />
        {input.trim().length > 0 && (
          <Label color="#4ade80" >{input.trim().length} chars</Label>
        )}
      </div>

      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={"https://github.com/org/repo\n\nor paste a file tree:\n\n  src/\n  ├── index.ts\n  ├── utils/\n  │   └── parse.ts\n  └── types.ts"}
        rows={12}
        style={{
          width: "100%", backgroundColor: "transparent",
          border: "none", outline: "none", resize: "none",
          padding: "18px 20px",
          ...MONO, fontSize: "13px", lineHeight: "1.7",
          color: "#c8c8d2", caretColor: "#4ade80",
        }}
        spellCheck={false}
      />

      <div style={{ borderTop: "1px solid #252529" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", gap: "12px", flexWrap: "wrap" }}>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          style={{
            display: "flex", alignItems: "center", gap: "9px",
            padding: "8px 14px", borderRadius: "6px",
            border: `1px dashed ${dragOver ? "#4ade80" : "#353539"}`,
            backgroundColor: dragOver ? "#16532d22" : "transparent",
            cursor: "pointer", transition: "all 0.15s ease", flexShrink: 0,
          }}
          onMouseEnter={e => { if (!dragOver) (e.currentTarget as HTMLElement).style.borderColor = "#4a4a52"; }}
          onMouseLeave={e => { if (!dragOver) (e.currentTarget as HTMLElement).style.borderColor = "#353539"; }}
        >
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v8M5 7l3-3 3 3M3 12h10" stroke={fileName ? "#4ade80" : "#6b6b75"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ ...MONO, fontSize: "11.5px", color: fileName ? "#4ade80" : "#6b6b75", whiteSpace: "nowrap" }}>
            {fileName ?? "package.json"}
          </span>
          {fileName && (
            <button onClick={e => { e.stopPropagation(); setFileName(null); }}
              style={{ marginLeft: "2px", color: "#6b6b75", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1, fontSize: "14px" }}
              aria-label="Remove file">×</button>
          )}
        </div>

        <Btn onClick={onGenerate} disabled={!hasInput}>
          Generate README
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Btn>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("input");
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>("invalid_url");

  // For demo: short inputs (<= 8 chars non-URL) simulate error
  const simulateError = input.trim().length > 0 && input.trim().length <= 8 && !input.startsWith("http");

  const handleDone = (outcome: "result" | "error", kind?: ErrorKind) => {
    if (outcome === "error") { setErrorKind(kind ?? "invalid_url"); setScreen("error"); }
    else setScreen("result");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ backgroundColor: "#0d0d0f" }}>

      {/* Header */}
      <div className="w-full max-w-2xl mb-10">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
          <span style={{ ...MONO, fontSize: "11px", color: "#4ade80", letterSpacing: "0.15em", textTransform: "uppercase" }}>readme.gen</span>
          <span style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: "#4ade80", opacity: 0.6 }} />
          <span style={{ ...MONO, fontSize: "11px", color: "#6b6b75", letterSpacing: "0.1em" }}>v2.1.0</span>
        </div>
        <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.1rem)", fontWeight: 600, color: "#e2e2e6", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: "0.4rem" }}>
          Generate a README
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#6b6b75", lineHeight: 1.6 }}>
          Paste a GitHub URL, a raw file tree, or drop your{" "}
          <code style={{ ...MONO, fontSize: "0.8rem", color: "#9b9ba8", backgroundColor: "#1e1e22", padding: "1px 6px", borderRadius: "4px" }}>package.json</code>
          {" "}below.
        </p>
      </div>

      {/* Screens */}
      {screen === "input" && (
        <InputView
          input={input} setInput={setInput}
          fileName={fileName} setFileName={setFileName}
          onGenerate={() => setScreen("generating")}
        />
      )}
      {screen === "generating" && (
        <GeneratingView onDone={handleDone} simulateError={simulateError} />
      )}
      {screen === "result" && (
        <ResultView onReset={() => { setScreen("input"); }} />
      )}
      {screen === "error" && (
        <ErrorView kind={errorKind} onRetry={() => setScreen("input")} />
      )}

      <p style={{ marginTop: "20px", ...MONO, fontSize: "11px", color: "#3e3e46", letterSpacing: "0.06em", textAlign: "center" }}>
        supports github.com · gitlab.com · raw file trees
      </p>
    </div>
  );
}
