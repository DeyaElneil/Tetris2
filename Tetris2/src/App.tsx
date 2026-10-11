import { useCallback, useEffect, useState } from "react";
import "./App.css";

const BOARD_WIDTH = 15;
const BOARD_HEIGHT = 22;
type Cell = string | null;
type Board = Cell[][];
type Piece = { shape: number[][]; color: string; x: number; y: number };
type Game = {
  board: Board; piece: Piece; next: Piece; score: number; lines: number;
  over: boolean; flash: number[]; drops: number;
};
type Action = "left" | "right" | "down" | "rotate" | "drop";

const SHAPES = [
  { shape: [[1, 1, 1, 1]], color: "I" },
  { shape: [[1, 1], [1, 1]], color: "O" },
  { shape: [[0, 1, 0], [1, 1, 1]], color: "T" },
  { shape: [[1, 0, 0], [1, 1, 1]], color: "J" },
  { shape: [[0, 0, 1], [1, 1, 1]], color: "L" },
  { shape: [[0, 1, 1], [1, 1, 0]], color: "S" },
  { shape: [[1, 1, 0], [0, 1, 1]], color: "Z" },
];
const LINE_POINTS = [0, 100, 300, 500, 800];

const emptyRow = (): Cell[] => Array(BOARD_WIDTH).fill(null);
const emptyBoard = (): Board => Array.from({ length: BOARD_HEIGHT }, emptyRow);

const randomPiece = (): Piece => {
  const p = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return { ...p, x: Math.floor((BOARD_WIDTH - p.shape[0].length) / 2), y: 0 };
};

const rotate = (s: number[][]) => s[0].map((_, i) => s.map(row => row[i]).reverse());

const collides = (b: Board, p: Piece) =>
  p.shape.some((row, r) => row.some((v, c) => {
    if (!v) return false;
    const x = p.x + c, y = p.y + r;
    return x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT || (y >= 0 && b[y][x] !== null);
  }));

const merge = (b: Board, p: Piece): Board => {
  const nb = b.map(row => [...row]);
  p.shape.forEach((row, r) => row.forEach((v, c) => { if (v) nb[p.y + r][p.x + c] = p.color; }));
  return nb;
};

const newGame = (): Game => ({
  board: emptyBoard(), piece: randomPiece(), next: randomPiece(),
  score: 0, lines: 0, over: false, flash: [], drops: 0,
});

function spawn(g: Game, board: Board): Game {
  return { ...g, board, piece: g.next, next: randomPiece(), over: collides(board, g.next) };
}

function lock(g: Game): Game {
  const board = merge(g.board, g.piece);
  const flash = board.flatMap((row, i) => (row.every(c => c !== null) ? [i] : []));
  return flash.length ? { ...g, board, flash } : spawn(g, board);
}

function finishClear(g: Game): Game {
  const kept = g.board.filter((_, i) => !g.flash.includes(i));
  const board = [...Array.from({ length: g.flash.length }, emptyRow), ...kept];
  return spawn({
    ...g, flash: [], lines: g.lines + g.flash.length,
    score: g.score + LINE_POINTS[g.flash.length],
  }, board);
}

function step(g: Game, a: Action): Game {
  if (g.over || g.flash.length) return g;
  const p = g.piece;
  const ok = (np: Piece) => (collides(g.board, np) ? p : np);
  switch (a) {
    case "left": return { ...g, piece: ok({ ...p, x: p.x - 1 }) };
    case "right": return { ...g, piece: ok({ ...p, x: p.x + 1 }) };
    case "rotate": return { ...g, piece: ok({ ...p, shape: rotate(p.shape) }) };
    case "down": {
      const np = { ...p, y: p.y + 1 };
      return collides(g.board, np) ? lock(g) : { ...g, piece: np };
    }
    case "drop": {
      let np = p;
      while (!collides(g.board, { ...np, y: np.y + 1 })) np = { ...np, y: np.y + 1 };
      return lock({ ...g, piece: np, drops: g.drops + 1 });
    }
  }
}

const cellClass = (c: Cell, flashing: boolean) =>
  c ? `game-cell game-cell--filled piece-${c}${flashing ? " game-cell--flash" : ""}` : "game-cell";

export default function App() {
  const [game, setGame] = useState<Game>(newGame);
  const [paused, setPaused] = useState(false);
  const act = useCallback((a: Action) => setGame(g => step(g, a)), []);
  const busy = paused || game.over;

  useEffect(() => {
    if (busy) return;
    const id = setInterval(() => act("down"), 500);
    return () => clearInterval(id);
  }, [act, busy]);

  useEffect(() => {
    if (!game.flash.length) return;
    const id = setTimeout(() => setGame(finishClear), 320);
    return () => clearTimeout(id);
  }, [game.flash]);

  useEffect(() => {
    const keys: Record<string, Action> = {
      ArrowLeft: "left", ArrowRight: "right", ArrowDown: "down", ArrowUp: "rotate", " ": "drop",
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") return setPaused(p => !p);
      const a = keys[e.key];
      if (!a || (e.target as HTMLElement).tagName === "BUTTON") return;
      e.preventDefault();
      if (!paused) act(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, paused]);

  const restart = () => { setGame(newGame()); setPaused(false); };
  const view = game.over || game.flash.length ? game.board : merge(game.board, game.piece);
  const nextGrid = Array.from({ length: 16 }, (_, i) => {
    const r = Math.floor(i / 4), c = i % 4;
    return game.next.shape[r]?.[c] ? game.next.color : null;
  });
  const ctl = (label: string, a: Action, aria: string, cls = "") => (
    <button className={`btn ${cls}`} aria-label={aria} disabled={busy} onClick={() => act(a)}>{label}</button>
  );

  return (
    <main className="app">
      <h1 className="title" aria-label="Tetris">
        {"TETRIS".split("").map((l, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.1}s` }} className={`piece-text-${"IOTSZJ"[i]}`}>{l}</span>
        ))}
      </h1>
      <div className="layout">
        <div key={game.drops} className={`board-wrap${game.drops ? " board-wrap--shake" : ""}`}>
          <div className="game-board" role="img" aria-label={`Tetris board, score ${game.score}`}>
            {view.flat().map((cell, i) => (
              <div key={i} className={cellClass(cell, game.flash.includes(Math.floor(i / BOARD_WIDTH)))} />
            ))}
          </div>
          {game.over && (
            <div className="overlay" role="alert">
              <p className="overlay__title overlay__title--over">GAME<br /><br />OVER</p>
              <button className="btn btn--alt" onClick={restart}>RETRY</button>
            </div>
          )}
          {paused && !game.over && <div className="overlay"><p className="overlay__title blink">PAUSED</p></div>}
        </div>
        <aside className="side">
          <div className="stat stat--score">
            <h2>SCORE</h2>
            <div key={game.score} className="stat__value pop" aria-live="polite">{game.score}</div>
          </div>
          <div className="stat stat--lines">
            <h2>LINES</h2>
            <div className="stat__value stat__value--sm">{game.lines}</div>
          </div>
          <div className="stat stat--next">
            <h2>NEXT</h2>
            <div className="next-grid" aria-hidden="true">
              {nextGrid.map((c, i) => <div key={i} className={c ? `mini piece-${c}` : "mini"} />)}
            </div>
          </div>
          <div className="controls">
            {ctl("<", "left", "Move left")}
            {ctl("▲", "rotate", "Rotate")}
            {ctl(">", "right", "Move right")}
            {ctl("▼", "down", "Soft drop")}
            {ctl("DROP", "drop", "Hard drop", "btn--alt btn--wide")}
            <button className="btn btn--alt btn--full" disabled={game.over} onClick={() => setPaused(p => !p)}>
              {paused ? "RESUME" : "PAUSE"}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
