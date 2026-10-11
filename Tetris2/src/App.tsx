import { useCallback, useEffect, useState } from "react";

const W = 10, H = 20;
type Board = (string | null)[][];
type Piece = { shape: number[][]; color: string; x: number; y: number };
type Game = { board: Board; piece: Piece; score: number; over: boolean };
type Action = "left" | "right" | "down" | "rotate" | "drop";

const SHAPES = [
  { shape: [[1, 1, 1, 1]], color: "cyan" },
  { shape: [[1, 1], [1, 1]], color: "yellow" },
  { shape: [[0, 1, 0], [1, 1, 1]], color: "purple" },
  { shape: [[1, 0, 0], [1, 1, 1]], color: "blue" },
  { shape: [[0, 0, 1], [1, 1, 1]], color: "orange" },
  { shape: [[0, 1, 1], [1, 1, 0]], color: "green" },
  { shape: [[1, 1, 0], [0, 1, 1]], color: "red" },
];

const emptyBoard = (): Board => Array.from({ length: H }, () => Array(W).fill(null));

const randomPiece = (): Piece => {
  const p = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return { ...p, x: Math.floor((W - p.shape[0].length) / 2), y: 0 };
};

const rotate = (s: number[][]) => s[0].map((_, i) => s.map(row => row[i]).reverse());

const collides = (b: Board, p: Piece) =>
  p.shape.some((row, r) => row.some((v, c) => {
    if (!v) return false;
    const x = p.x + c, y = p.y + r;
    return x < 0 || x >= W || y >= H || (y >= 0 && b[y][x] !== null);
  }));

const merge = (b: Board, p: Piece): Board => {
  const nb = b.map(row => [...row]);
  p.shape.forEach((row, r) => row.forEach((v, c) => { if (v) nb[p.y + r][p.x + c] = p.color; }));
  return nb;
};

const clearLines = (b: Board): [Board, number] => {
  const kept = b.filter(row => row.some(cell => cell === null));
  const cleared = H - kept.length;
  return [[...Array.from({ length: cleared }, () => Array(W).fill(null)), ...kept], cleared];
};

const newGame = (): Game => ({ board: emptyBoard(), piece: randomPiece(), score: 0, over: false });

function lock(g: Game): Game {
  const [board, lines] = clearLines(merge(g.board, g.piece));
  const next = randomPiece();
  return { board, piece: next, score: g.score + lines * 100, over: collides(board, next) };
}

function step(g: Game, a: Action): Game {
  if (g.over) return g;
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
      return lock({ ...g, piece: np });
    }
  }
}

export default function App() {
  const [game, setGame] = useState<Game>(newGame);
  const act = useCallback((a: Action) => setGame(g => step(g, a)), []);

  useEffect(() => {
    const id = setInterval(() => act("down"), 500);
    return () => clearInterval(id);
  }, [act]);

  useEffect(() => {
    const keys: Record<string, Action> = {
      ArrowLeft: "left", ArrowRight: "right", ArrowDown: "down", ArrowUp: "rotate", " ": "drop",
    };
    const onKey = (e: KeyboardEvent) => {
      const a = keys[e.key];
      if (a) { e.preventDefault(); act(a); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act]);

  const view = game.over ? game.board : merge(game.board, game.piece);

  return (
    <div style={{ fontFamily: "sans-serif", textAlign: "center" }}>
      <h2>Score: {game.score}</h2>
      <div style={{ display: "inline-grid", gridTemplateColumns: `repeat(${W}, 24px)`, gap: 1, background: "#333", padding: 1 }}>
        {view.flat().map((cell, i) => (
          <div key={i} style={{ width: 24, height: 24, background: cell ?? "#111" }} />
        ))}
      </div>
      {game.over && <p>Game over <button onClick={() => setGame(newGame())}>Restart</button></p>}
    </div>
  );
}