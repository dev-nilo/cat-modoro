/** Tiny pixel-art icons as SVG (8x8 grid, one rect per run of pixels). */

import type { ReactElement } from "react";

type Pixels = readonly string[];

function PixelIcon({ pixels, label }: { pixels: Pixels; label?: string }) {
  const rects: ReactElement[] = [];
  pixels.forEach((row, y) => {
    let start = -1;
    for (let x = 0; x <= row.length; x++) {
      const on = row[x] === "#";
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        rects.push(<rect key={`${x}-${y}`} x={start} y={y} width={x - start} height={1} />);
        start = -1;
      }
    }
  });
  return (
    <svg
      viewBox="0 0 8 8"
      width="1em"
      height="1em"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className="pixel-icon"
    >
      {rects}
    </svg>
  );
}

const icon = (pixels: Pixels) =>
  function Icon(props: { label?: string }) {
    return <PixelIcon pixels={pixels} {...props} />;
  };

export const PlayIcon = icon(["..#.....", "..##....", "..###...", "..####..", "..####..", "..###...", "..##....", "..#....."]);
export const PauseIcon = icon(["........", ".##..##.", ".##..##.", ".##..##.", ".##..##.", ".##..##.", ".##..##.", "........"]);
export const SkipIcon = icon(["........", "#...#..#", "##..##.#", "###.####", "###.####", "##..##.#", "#...#..#", "........"]);
export const ResetIcon = icon(["..####..", ".#....#.", "#......#", "#.......", "#....#..", "#...###.", ".#.#####", "..####.."]);
export const GearIcon = icon(["..#..#..", ".######.", "###..###", ".#....#.", ".#....#.", "###..###", ".######.", "..#..#.."]);
export const HelpIcon = icon(["..####..", ".#....#.", "......#.", ".....#..", "....#...", "....#...", "........", "....#..."]);
export const PopOutIcon = icon(["....####", "......##", ".....#.#", "#..##..#", "#.##....", "#.......", "#.......", "#####..."]);
export const CloseIcon = icon(["........", ".#....#.", "..#..#..", "...##...", "...##...", "..#..#..", ".#....#.", "........"]);
export const DiceIcon = icon(["########", "#......#", "#.#..#.#", "#......#", "#......#", "#.#..#.#", "#......#", "########"]);
export const HeartIcon = icon(["........", ".##.##..", "#######.", "#######.", ".#####..", "..###...", "...#....", "........"]);
