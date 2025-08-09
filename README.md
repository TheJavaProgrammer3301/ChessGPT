# ChessGPT
ChessGPT is a modified version of the [en-croissant](https://github.com/franciscoBSalgueiro/en-croissant) chess gui that allows you to play a game of chess against ChatGPT.

ChessGPT offers 3 modes:

## ChessGPT (normal)
The engine parses ChatGPT's moves using standard move notation. If ChatGPT tries to move a piece that does not exist in the place they are moving it from, a random piece will be picked instead.

## ChessGPT spawning allowed
The engine parses ChatGPT's moves using standard move notation. If ChatGPT tries to move a piece that does not exist in the place they are moving it from, a new piece will be spawned, which they will then move.

## ChessGPT fen mode
The engine will ask ChatGPT to return the state of the board after it's made its move into the FEN format (the standard notation used to save a chess board).
