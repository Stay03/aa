import { BLOCK, BRICK_H, alphabetBlock, blockStack, brick, book, crayon, pencilBridge, ruler, domino, ball, marble, toyCar, teddyBear } from './toys.js';

// Map 01, "The Spill". Hand-placed. Green spawns at +z, tan at -z by the
// toy chest. Three lanes: the car lane (-x), the bear in the middle, and the
// book-and-brick lane (+x), plus the route under the bed.
export const SPAWNS = {
  green: [[0, 116], [-26, 122], [26, 122], [-52, 128], [52, 128], [0, 140]],
  tan: [[-40, -68], [-8, -72], [12, -44], [-34, -42], [34, -58], [-64, -66]],
};

export function buildMap01(ctx) {
  const wallOfBlocks = (x, z, n, dx, dz, heights) => {
    for (let i = 0; i < n; i++) blockStack(ctx, x + dx * i * (BLOCK + 0.15), z + dz * i * (BLOCK + 0.15), heights[i % heights.length]);
  };

  // --- Green spawn cover
  wallOfBlocks(-16, 100, 3, 1, 0, [1, 2, 1]);
  wallOfBlocks(10, 100, 3, 1, 0, [2, 1, 1]);

  // --- Centre: the bear and a ring of blocks
  teddyBear(ctx, 0, 18, 0.25);
  wallOfBlocks(-30, 52, 4, 1, 0, [1, 1, 2, 1]);
  wallOfBlocks(22, 56, 3, 0.8, 0.6, [2, 2, 1]);

  // Pencil bridge between two block towers, with a block staircase up to it.
  blockStack(ctx, -44, 44, 2);
  blockStack(ctx, -24, 44, 2);
  alphabetBlock(ctx, -44, 0, 49);
  pencilBridge(ctx, [-42, 2 * BLOCK + 0.4, 44], [-26, 2 * BLOCK + 0.4, 44]);

  // --- +x lane: brick bunker and the book stack with a ruler ramp
  const R = 0xd8352a, B = 0x2b62c9, Y = 0xf0b41c, G = 0x2e9c4c;
  brick(ctx, 60, 0, 70, 2, 4, R);
  brick(ctx, 60, BRICK_H, 70, 2, 4, Y);
  brick(ctx, 72, 0, 62, 4, 2, B);
  brick(ctx, 84, 0, 70, 2, 4, G);
  brick(ctx, 84, BRICK_H, 70, 2, 2, R);
  brick(ctx, 72, 0, 80, 2, 2, Y);

  book(ctx, 52, 0, 20, 0x2f5d8a, 0.15);
  book(ctx, 53, 2.6, 21, 0xa33b3b, -0.1);
  book(ctx, 52, 5.2, 20, 0x3c8a5a, 0.3);
  ruler(ctx, [20.5, 0.1, 30], [48, 7.95, 23]);
  book(ctx, 78, 0, 8, 0x6b4a8a, 1.2, 15, 3.2, 21);

  brick(ctx, 66, 0, -34, 4, 2, Y, 0.3);
  brick(ctx, 66, BRICK_H, -34, 2, 2, B, 0.3);
  wallOfBlocks(40, -40, 3, 1, 0.2, [1, 2, 2]);

  // --- -x lane: cars, crayons, dominoes
  toyCar(ctx, -78, 62, 0xd83a2e, 0.5);
  toyCar(ctx, -70, -2, 0x2a6fd8, -1.1);
  wallOfBlocks(-96, 26, 3, 0, 1, [2, 1, 2]);
  blockStack(ctx, -84, -26, 2);
  blockStack(ctx, -76, -26, 1);

  const cols = [0xe23a3a, 0x3a6ee2, 0x35b558, 0xf0b41c, 0x9b4fd1, 0xf07d1c];
  const rand = ctx.rand;
  for (let i = 0; i < 9; i++) crayon(ctx, -60 + rand() * 30, 84 + rand() * 22, cols[i % 6], rand() * 6.28);
  for (let i = 0; i < 5; i++) crayon(ctx, 30 + rand() * 30, -8 + rand() * 16, cols[(i + 2) % 6], rand() * 6.28);

  for (let i = 0; i < 14; i++) {
    const a = i * 0.11;
    domino(ctx, -58 + Math.sin(a) * 10 + i * 0.4, 28 - i * 2.7, a * 0.6, i % 2 ? 0xf5f2ea : 0x202020);
  }

  // --- Loose physics toys
  ball(ctx, 24, 84);
  for (let i = 0; i < 10; i++) marble(ctx, -8 + rand() * 26, 66 + rand() * 14, cols[i % 6]);

  // --- Tan side, around the tipped chest
  wallOfBlocks(-58, -52, 3, 1, 0, [2, 1, 1]);
  wallOfBlocks(-4, -56, 3, 1, 0, [1, 1, 2]);
  brick(ctx, 22, 0, -72, 2, 4, R, 0.2);
  blockStack(ctx, -20, -64, 1);
}
