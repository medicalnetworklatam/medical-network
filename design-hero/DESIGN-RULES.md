# MNL site — design rules

1. **No photo is cut off by the edge of the screen.** When a section is at the
   scroll position where it is meant to be seen, every photo in it is visible
   whole. A photo may be cropped to its frame (`object-fit: cover`), and frames
   may change size to fit the screen (for example, take the height that is left
   in a one-screen grid), but a frame never runs past the top or bottom of the
   screen.
2. Sections built as a grid of cells are sized so the whole grid is visible at
   once. A long section is split into several screens rather than one tall grid
   (see "mi historia": two screens of `100svh`).
