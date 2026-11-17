# 0001. Electron and TypeScript

Date: 2026-11-17. Status: accepted, open to change until the module specs are written.

## Context

HSOS needs a terminal, a file viewer, a browser pane an AI can drive, a graph view and a HUD in one Windows app. A Haiku-class model will write the code from a spec. Research compared Electron, Tauri 2, WinUI or WPF with WebView2, native Rust GUI and Flutter (`docs/research/stack-options.md` on the branch `research/round-1`).

## Decision

HSOS uses Electron with TypeScript in every process, React for the UI, xterm.js with node-pty for the terminal, and Electron's `WebContentsView` for the browser pane.

## Why

- One language. A weak model writes TypeScript more reliably than Rust, and strict types catch its mistakes.
- Each hard part is proven on Windows: VS Code, Wave Terminal and Tabby use the same terminal pair.
- The browser pane is a stable API. On Tauri 2 a second webview in a window needs an unstable flag.

## Cost accepted

- More memory and a larger install than Tauri.
- Frequent Electron major versions. The spec pins a version.

## Alternative rejected

Tauri 2 with Rust and TypeScript. Lighter, with a strict core, but two languages, an unstable browser pane, and a higher chance the implementer stalls on async Rust and Windows COM calls.
