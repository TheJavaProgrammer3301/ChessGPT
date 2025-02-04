import { positionFromFen } from "@/utils/chessops";
import { TreeNode } from "@/utils/treeReducer";
import { Chess, Move, NormalMove, parseSquare, Role, SquareSet } from "chessops";
import { makeFen, parseFen } from "chessops/fen";

function randomSquare(set: SquareSet) {
	let r = Math.floor(Math.random() * set.size())

	for (let i = 0; i < set.size(); i++) {
		if (i < r) {
			set = set.withoutFirst()
		}
	}

	return set.first()
}

export namespace ChessGPT {
	type Completion = { piece: Role, start: string, end: string, board: string };
	type ChessGPTCallback = (completion: Completion, args: ChessGPTArguments) => boolean;
	type NoPieceHandler = (completion: Completion, from: number, {
		currentTurn,
		lastNode,
		setFen
	}: ChessGPTArguments) => [boolean, number];

	export function doRandomMove({
		position,
		currentTurn,
		lastNode,
		storeMakeMove,
		whiteTime,
		blackTime
	}: ChessGPT.ChessGPTArguments) {
		if (!position) throw "Bad position";

		let [tempPos] = positionFromFen(lastNode.fen)

		tempPos = tempPos as Chess

		const ctx = tempPos.ctx();

		const g = tempPos.board[currentTurn];

		let randomChoice: number = randomSquare(g) as number

		let i = 0;

		while (randomChoice != undefined && position.dests(randomChoice, ctx).size() == 0) {
			randomChoice = randomSquare(g) as number

			i++;

			if (i > 500) throw "Could not find a move in 500 iterations";
		}

		const move: NormalMove = {
			from: randomChoice,
			to: randomSquare(position.dests(randomChoice, ctx)) as number
		}

		storeMakeMove({
			payload: move,
			clock: (position.turn === "white" ? whiteTime : blackTime) ?? undefined
		});
	}

	export type ChessGPTArguments = {
		setFen: (args: string) => void,
		lastNode: TreeNode,
		position: Chess | null,
		currentTurn: "white" | "black",
		storeMakeMove: (args: {
			payload: string | Move;
			changePosition?: boolean;
			mainline?: boolean;
			clock?: number;
			changeHeaders?: boolean;
			doNotApply?: boolean;
		}) => void,
		whiteTime: number,
		blackTime: number
	}

	function chatGPTFenMode(completion: Completion, {
		setFen,
	}: ChessGPTArguments): boolean {
		setFen(completion.board);

		return true
	}

	function parseChatGPTMove(completion: Completion, noPieceHandler: NoPieceHandler, args: ChessGPTArguments): boolean {
		if (args.position === null) throw "No position";

		console.log(completion);

		const move = {
			from: parseSquare(completion.start),
			to: parseSquare(completion.end)
		} as NormalMove

		let [originalPos] = positionFromFen(args.lastNode.fen)

		if (!originalPos) return false;

		let tempPos = originalPos.clone();

		if (!tempPos.board.occupied.has(move.from)) {
			const [didSucceed, newFrom] = noPieceHandler(completion, move.from, args);
			
			if (!didSucceed) return false;

			move.from = newFrom;
		}
			
		tempPos.play(move);

		const newFen = makeFen(tempPos.toSetup());
		const [newPos, newError] = positionFromFen(newFen)

		if (newError != null) {
			console.warn("Bad boy :)");

			return false;
		} else {
			args.storeMakeMove({
				payload: move,
				clock: (args.position.turn === "white" ? args.whiteTime : args.blackTime) ?? undefined
			});

			return true;
		}
	}

	function chatGPTNormalMode(completion: Completion, args: ChessGPTArguments): boolean {
		return parseChatGPTMove(completion, findRandomPiece, args);
	}

	function chatGPTSpawningMode(completion: Completion, args: ChessGPTArguments): boolean {
		return parseChatGPTMove(completion, setPieceTo, args);
	}

	function findRandomPiece(completion: Completion, from: number, {
		position,
		currentTurn,
	}: ChessGPTArguments) {
		if (position === null) throw "No position";

		const currentBoard = (position.board as unknown as { [key: string]: SquareSet });

		return [true, randomSquare(currentBoard[completion.piece].intersect(position.board[currentTurn])) ?? randomSquare(position.board[currentTurn]) as number] as [boolean, number];
	}

	function setPieceTo(completion: Completion, from: number, {
		currentTurn,
		lastNode,
		setFen
	}: ChessGPTArguments): [boolean, number] {
		const setup = parseFen(lastNode.fen).unwrap();

		// console.log(from, setup, completion.piece);
		console.log(setup.board[completion.piece], currentTurn);

		setup.board.set(from, {
			role: completion.piece,
			color: currentTurn
		});

		const newFen = makeFen(setup);
		const [newPos, posError] = positionFromFen(newFen);

		console.log(newPos === null);
		if (posError) return [false, 0];

		setFen(makeFen(setup));

		return [true, from];
	}

	export enum Modes {
		NORMAL = "ChessGPT",
		SPAWNING_ALLOWED = "ChessGPT Spawning Allowed",
		FEN_MODE = "ChessGPT Fen Mode"
	}

	export const ModeCallbacks = {
		[Modes.NORMAL]: chatGPTNormalMode,
		[Modes.SPAWNING_ALLOWED]: chatGPTSpawningMode,
		[Modes.FEN_MODE]: chatGPTFenMode
	} as { [key in Modes]: ChessGPTCallback };

	export const ModeAdditionalArguments = {
		[Modes.NORMAL]: {},
		[Modes.SPAWNING_ALLOWED]: {},
		[Modes.FEN_MODE]: {
			boardMode: true
		},
	} as { [key in Modes]: object }
}