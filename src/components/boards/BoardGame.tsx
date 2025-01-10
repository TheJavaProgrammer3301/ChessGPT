import { type GoMode, events } from "@/bindings";
import {
	activeTabAtom,
	currentGameStateAtom,
	currentPlayersAtom,
	tabsAtom
} from "@/state/atoms";
import { type TimeControlField, getMainLine, getPGN } from "@/utils/chess";
import { positionFromFen } from "@/utils/chessops";
import type { LocalEngine } from "@/utils/engines";
import {
	type GameHeaders,
	getNodeAtPath,
	treeIteratorMainLine
} from "@/utils/treeReducer";
import {
	ActionIcon,
	Box,
	Button,
	Checkbox,
	Divider,
	Group,
	InputWrapper,
	Paper,
	Portal,
	ScrollArea,
	SegmentedControl,
	Select,
	Stack,
	Text,
	TextInput
} from "@mantine/core";
import {
	IconArrowsExchange,
	IconPlus,
	IconZoomCheck,
} from "@tabler/icons-react";
import {
	type NormalMove,
	parseSquare,
	parseUci
} from "chessops";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import { useAtom, useAtomValue } from "jotai";
import {
	Suspense,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import GameInfo from "../common/GameInfo";
import MoveControls from "../common/MoveControls";
import TimeInput from "../common/TimeInput";
import { TreeStateContext } from "../common/TreeStateContext";
import EngineSettingsForm from "../panels/analysis/EngineSettingsForm";
import Board from "./Board";
import GameNotation from "./GameNotation";

// const openai = new OpenAI({
// 	apiKey: "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",
// 	dangerouslyAllowBrowser: true
// })

// function makeMove({
// 	state,
// 	move,
// 	last,
// 	changePosition = true,
// 	changeHeaders = true,
// 	mainline = false,
// 	clock,
// 	sound = true,
// 	doNotApply = false
// }: {
// 	state: TreeState;
// 	move: Move;
// 	last: boolean;
// 	changePosition?: boolean;
// 	changeHeaders?: boolean;
// 	mainline?: boolean;
// 	clock?: number;
// 	sound?: boolean;
// 	doNotApply?: boolean
// }) {
// 	const mainLine = Array.from(treeIteratorMainLine(state.root));
// 	const position = last
// 		? mainLine[mainLine.length - 1].position
// 		: state.position;
// 	const moveNode = getNodeAtPath(state.root, position);
// 	if (!moveNode) return;
// 	const [pos] = positionFromFen(moveNode.fen);

// 	pos.play(move);

// 	const newFen = makeFen(pos.toSetup());
// }

function EnginesSelect({
	engine,
	setEngine,
}: {
	engine: LocalEngine | null;
	setEngine: (engine: LocalEngine | null) => void;
}) {
	const engines = [{
		name: "ChatGPT",
		path: "ChatGPT",
		elo: 5.5
	}]
	// useAtomValue(enginesAtom).filter(
	// 	(e): e is LocalEngine => e.type === "local",
	// );

	useEffect(() => {
		if (engines.length > 0 && engine === null) {
			setEngine(engines[0] as LocalEngine);
		}
	}, [engine, engines[0], setEngine]);

	return (
		<Suspense>
			<Select
				label="Engine"
				allowDeselect={false}
				data={engines?.map((engine) => ({
					label: engine.name,
					value: engine.path,
				}))}
				value={engine?.path ?? ""}
				onChange={(e) => {
					// setEngine(engines.find((engine) => engine.path === e) ?? null as LocalEngine);
				}}
			/>
		</Suspense>
	);
}

export type OpponentSettings =
	| {
		type: "human";
		timeControl?: TimeControlField;
		name?: string;
	}
	| {
		type: "engine";
		timeControl?: TimeControlField;
		engine: LocalEngine | null;
		go: GoMode;
	};

function OpponentForm({
	sameTimeControl,
	opponent,
	setOpponent,
	setOtherOpponent,
}: {
	sameTimeControl: boolean;
	opponent: OpponentSettings;
	setOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
	setOtherOpponent: React.Dispatch<React.SetStateAction<OpponentSettings>>;
}) {
	function updateType(type: "engine" | "human") {
		if (type === "human") {
			setOpponent((prev) => ({
				...prev,
				type: "human",
				name: "Player",
			}));
		} else {
			setOpponent((prev) => ({
				...prev,
				type: "engine",
				engine: null,
				go: {
					t: "Depth",
					c: 24,
				},
			}));
		}
	}

	return (
		<Stack flex={1}>
			<SegmentedControl
				data={[
					{ value: "human", label: "Human" },
					{ value: "engine", label: "Engine" },
				]}
				value={opponent.type}
				onChange={(v) => updateType(v as "human" | "engine")}
			/>

			{opponent.type === "human" && (
				<TextInput
					label="Name"
					value={opponent.name ?? ""}
					onChange={(e) =>
						setOpponent((prev) => ({ ...prev, name: e.target.value }))
					}
				/>
			)}

			{opponent.type === "engine" && (
				<EnginesSelect
					engine={opponent.engine}
					setEngine={(engine) => setOpponent((prev) => ({ ...prev, engine }))}
				/>
			)}

			<Divider variant="dashed" label="Time Settings" />
			<SegmentedControl
				data={["Time", "Unlimited"]}
				value={opponent.timeControl ? "Time" : "Unlimited"}
				onChange={(v) => {
					setOpponent((prev) => ({
						...prev,
						timeControl: v === "Time" ? DEFAULT_TIME_CONTROL : undefined,
					}));
					if (sameTimeControl) {
						setOtherOpponent((prev) => ({
							...prev,
							timeControl: v === "Time" ? DEFAULT_TIME_CONTROL : undefined,
						}));
					}
				}}
			/>
			<Group grow wrap="nowrap">
				{opponent.timeControl && (
					<>
						<InputWrapper label="Time">
							<TimeInput
								defaultType="m"
								value={opponent.timeControl.seconds}
								setValue={(v) => {
									setOpponent((prev) => ({
										...prev,
										timeControl: {
											seconds: v.t === "Time" ? v.c : 0,
											increment: prev.timeControl?.increment ?? 0,
										},
									}));
									if (sameTimeControl) {
										setOtherOpponent((prev) => ({
											...prev,
											timeControl: {
												seconds: v.t === "Time" ? v.c : 0,
												increment: prev.timeControl?.increment ?? 0,
											},
										}));
									}
								}}
							/>
						</InputWrapper>
						<InputWrapper label="Increment">
							<TimeInput
								defaultType="s"
								value={opponent.timeControl.increment ?? 0}
								setValue={(v) => {
									setOpponent((prev) => ({
										...prev,
										timeControl: {
											seconds: prev.timeControl?.seconds ?? 0,
											increment: v.t === "Time" ? v.c : 0,
										},
									}));
									if (sameTimeControl) {
										setOtherOpponent((prev) => ({
											...prev,
											timeControl: {
												seconds: prev.timeControl?.seconds ?? 0,
												increment: v.t === "Time" ? v.c : 0,
											},
										}));
									}
								}}
							/>
						</InputWrapper>
					</>
				)}
			</Group>

			{opponent.type === "engine" && (
				<Stack>
					{opponent.engine && !opponent.timeControl && (
						<EngineSettingsForm
							engine={opponent.engine}
							remote={false}
							gameMode
							settings={{
								go: opponent.go,
								settings: opponent.engine.settings || [],
								enabled: true,
								synced: false,
							}}
							setSettings={(fn) =>
								setOpponent((prev) => {
									if (prev.type === "human") {
										return prev;
									}
									const newSettings = fn({
										go: prev.go,
										settings: prev.engine?.settings || [],
										enabled: true,
										synced: false,
									});
									return { ...prev, ...newSettings };
								})
							}
							minimal={true}
						/>
					)}
				</Stack>
			)}
		</Stack>
	);
}

let k = 0

const DEFAULT_TIME_CONTROL: TimeControlField = {
	seconds: 180_000,
	increment: 2_000,
};

function randomSquare(set: SquareSet) {
	let r = Math.floor(Math.random() * set.size())

	for (let i = 0; i < set.size(); i++) {
		if (i < r) {
			set = set.withoutFirst()
		}
	}

	return set.first()
}

let ai_data: [ChatCompletionMessageParam] = [
	{ role: "system", content: "You are a chess AI. You are playing as black. Respond only with chess moves stating the start and end position of your move, such as b4-d4." }
]

import { SquareSet } from 'chessops';
import { attacks } from 'chessops/attacks';
import { Chess, Position } from 'chessops/chess';
import { CastlingSide, Move, Role, SquareName } from 'chessops/types';
import { charToRole, defined, opposite, squareFile } from 'chessops/util';
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";

const parseSanSource = (pos: Position, san: string): [Move | number | undefined, string | undefined, number | undefined] => {
	const ctx = pos.ctx();

	// Normal move
	const match = san.match(/([NBRQK])?([a-h])?([1-8])?[-x]?([a-h][1-8])(?:=?([nbrqkNBRQK]))?[+#]?$/) as
		| [
			string,
			'N' | 'B' | 'R' | 'Q' | 'K' | undefined,
			string | undefined,
			string | undefined,
			SquareName,
			'n' | 'b' | 'r' | 'q' | 'k' | 'N' | 'B' | 'R' | 'Q' | 'K' | undefined,
		]
		| null;
	if (!match) {
		// Castling
		let castlingSide: CastlingSide | undefined;
		if (san === 'O-O' || san === 'O-O+' || san === 'O-O#') castlingSide = 'h';
		else if (san === 'O-O-O' || san === 'O-O-O+' || san === 'O-O-O#') castlingSide = 'a';
		if (castlingSide) {
			const rook = pos.castles.rook[pos.turn][castlingSide];
			if (!defined(ctx.king) || !defined(rook) || !pos.dests(ctx.king, ctx).has(rook)) return [undefined, undefined, undefined];
			return [{
				from: ctx.king,
				to: rook,
			}, undefined, undefined];
		}

		// Drop
		const match = san.match(/^([pnbrqkPNBRQK])?@([a-h][1-8])[+#]?$/) as
			| [string, 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | undefined, SquareName]
			| null;
		if (!match) return [undefined, undefined, undefined];
		const move = {
			role: match[1] ? charToRole(match[1]) : 'pawn',
			to: parseSquare(match[2]),
		};
		if (pos.isLegal(move, ctx)) {
			return [move, undefined, undefined]
		} else {
			console.log("Error 345")

			return [undefined, undefined, undefined]
		}
	}
	const role = match[1] ? charToRole(match[1]) : 'pawn';
	const to = parseSquare(match[4]);

	const promotion = match[5] ? charToRole(match[5]) : undefined;
	if (!!promotion !== (role === 'pawn' && SquareSet.backranks().has(to))) return [undefined, undefined, undefined];
	if (promotion === 'king' && pos.rules !== 'antichess') return [undefined, undefined, undefined];

	{
		let candidates = pos.board.pieces(pos.turn, role);
		if (role === 'pawn' && !match[2]) candidates = candidates.intersect(SquareSet.fromFile(squareFile(to)));
		else if (match[2]) candidates = candidates.intersect(SquareSet.fromFile(match[2].charCodeAt(0) - 'a'.charCodeAt(0)));
		if (match[3]) candidates = candidates.intersect(SquareSet.fromRank(match[3].charCodeAt(0) - '1'.charCodeAt(0)));

		// Optimization: Reduce set of candidates
		const pawnAdvance = role === 'pawn' ? SquareSet.fromFile(squareFile(to)) : SquareSet.empty();
		candidates = candidates.intersect(
			pawnAdvance.union(attacks({ color: opposite(pos.turn), role }, to, pos.board.occupied)),
		);

		if (candidates.size() > 0) {
			let from;
			for (const candidate of candidates) {
				if (pos.dests(candidate, ctx).has(to)) {
					if (defined(from)) return [undefined, undefined, undefined]; // Ambiguous
					from = candidate;
				}
			}
			if (!defined(from)) return [undefined, undefined, undefined]; // Illegal

			return [{
				from,
				to,
				promotion,
			}, undefined, undefined];
		} else {
			let candidates = pos.board.pieces(pos.turn, role);

			console.log(candidates)

			// Check uniqueness and legality
			let from;

			for (const candidate of candidates) {
				from = candidate;
			}

			if (!defined(from)) {
				console.log("Error 379")

				return [379, role, to]
			} // Illegal

			console.warn("Success?")

			return [{
				from,
				to,
				promotion,
			}, undefined, undefined];
		}
	}
};

function BoardGame() {
	const activeTab = useAtomValue(activeTabAtom);

	const [inputColor, setInputColor] = useState<"white" | "random" | "black">(
		"white",
	);
	function cycleColor() {
		setInputColor((prev) =>
			match(prev)
				.with("white", () => "black" as const)
				.with("black", () => "random" as const)
				.with("random", () => "white" as const)
				.exhaustive(),
		);
	}

	const [player1Settings, setPlayer1Settings] = useState<OpponentSettings>({
		type: "human",
		name: "Player",
		timeControl: DEFAULT_TIME_CONTROL,
	});
	const [player2Settings, setPlayer2Settings] = useState<OpponentSettings>({
		type: "human",
		name: "Player",
		timeControl: DEFAULT_TIME_CONTROL,
	});

	function getPlayers() {
		let white = inputColor === "white" ? player1Settings : player2Settings;
		let black = inputColor === "black" ? player1Settings : player2Settings;
		if (inputColor === "random") {
			white = Math.random() > 0.5 ? player1Settings : player2Settings;
			black = white === player1Settings ? player2Settings : player1Settings;
		}
		return { white, black };
	}

	const store = useContext(TreeStateContext)!;
	const root = useStore(store, (s) => s.root);
	const position = useStore(store, (s) => s.position);
	const headers = useStore(store, (s) => s.headers);
	const setFen = useStore(store, (s) => s.setFen);
	const setHeaders = useStore(store, (s) => s.setHeaders);
	const appendMove = useStore(store, (s) => s.appendMove);
	const storeMakeMove = useStore(store, (s) => s.makeMove);

	const [, setTabs] = useAtom(tabsAtom);

	const boardRef = useRef(null);
	const [gameState, setGameState] = useAtom(currentGameStateAtom);

	function changeToAnalysisMode() {
		setTabs((prev) =>
			prev.map((tab) =>
				tab.value === activeTab ? { ...tab, type: "analysis" } : tab,
			),
		);
	}
	console.log("Reading last node?");
	const mainLine = Array.from(treeIteratorMainLine(root));
	const currentNode = getNodeAtPath(root, position);
	const lastNode = mainLine[mainLine.length - 1].node;
	const moves = useMemo(
		() => getMainLine(root, headers.variant === "Chess960"),
		[root, headers],
	);

	const [pos, error] = useMemo(() => {
		return positionFromFen(lastNode.fen);
	}, [lastNode.fen]);

	useEffect(() => {
		if (pos?.isEnd()) {
			setGameState("gameOver");
		}
	}, [pos, setGameState]);

	const [players, setPlayers] = useAtom(currentPlayersAtom);

	useEffect(() => {
		if (pos && gameState === "playing") {
			if (headers.result !== "*") {
				setGameState("gameOver");
				return;
			}
			const currentTurn = pos.turn;
			const player = currentTurn === "white" ? players.white : players.black;

			// k++

			// console.log(k)

			if (player.type === "engine") {
				ai_data.push({
					role: "user",
					content: lastNode.san
				} as ChatCompletionMessageParam)

				console.log(ai_data)

				!!(async () => {
					try {
						for (let j = 0; j < 5; j++) {
							console.log(getPGN(root, {
								comments: false,
								variations: false,
								extraMarkups: false,
								root: true,
								glyphs: false,
								headers: null
							}));
							let completion = (await (await fetch('https://chatgpt.thejavacoder.workers.dev/', {
								body: JSON.stringify({
									board: lastNode.fen,
									game: getPGN(root, {
										comments: false,
										variations: false,
										extraMarkups: false,
										root: true,
										glyphs: false,
										headers: null
									})
								}),
								method: 'POST'
							})).json()) as { piece: Role, start: string, end: string };

							const move = {
								from: parseSquare(completion.start),
								to: parseSquare(completion.end)
							} as NormalMove

							let [originalPos] = positionFromFen(lastNode.fen)

							if (!originalPos) return;

							let tempPos = originalPos.clone();

							console.log(move.from, tempPos.board.occupied);

							if (!tempPos.board.occupied.has(move.from)) {
								console.warn("Can't find!");

								const k = (originalPos.board as unknown as { [key: string]: SquareSet });
								// move.from = randomSquare(k[completion.piece].intersect(originalPos.board.black)) ?? randomSquare(originalPos.board.black) as number;

								tempPos.board.set(move.from, {
									color: "black",
									role: completion.piece
								});

								lastNode.fen = makeFen(tempPos.toSetup());
							}

							tempPos.play(move);

							const newFen = makeFen(tempPos.toSetup());
							const [newPos, newError] = positionFromFen(newFen)

							if (newError != null) {
								console.warn("Bad boy :)");

								continue;
							} else {
								// pos.board.set(move.from, {
								// 	color: "black",
								// 	role: completion.piece
								// });

								storeMakeMove({
									payload: move,
									clock: (pos.turn === "white" ? whiteTime : blackTime) ?? undefined
								});

								return;
							}

							// let completion = await openai.chat.completions.create({
							// 	messages: ai_data,
							// 	model: "gpt-3.5-turbo",
							// 	response_format: {"type": "json_object"}
							// });

							// console.log(completion.choices[0].message.content)

							// for (let i = 0; i < completion.choices.length; i++) {
							// 	const message = completion.choices[i].message;
							// 	const choice = message.content;

							// 	if (!choice) return;

							// 	ai_data.push(message)

							// 	let [originalPos] = positionFromFen(lastNode.fen)

							// 	if (!originalPos) return;

							// 	{
							// 		let match = choice?.match(/([a-z][1-8])[\-,x]([a-z][1-8])/)

							// 		if (match) {
							// 			const move = {
							// 				from: parseSquare(match[1]),
							// 				to: parseSquare(match[2])
							// 			} as NormalMove

							// 			console.log(move)

							// 			// Move is illegal if the AI tries to move from a square with no pieces
							// 			if (!pos.board.occupied.has(move.from)) {
							// 				console.warn("Using random piece!")

							// 				move.from = randomSquare(originalPos.board.black) as number
							// 			}

							// 			if (!originalPos?.board.black.has(move.from)) {
							// 				ai_data.push({
							// 					"role": "system", "content": "Your move is illegal, please try again with a different move. Remember to state the start and end position of your move, such as b4-d4."
							// 				})

							// 				console.warn("Failed!")

							// 				continue;
							// 			}

							// 			let tempPos = originalPos.clone()

							// 			tempPos.play(move);

							// 			const newFen = makeFen(tempPos.toSetup());
							// 			const [newPos, newError] = positionFromFen(newFen)

							// 			if (newError != null) {
							// 				ai_data.push({
							// 					"role": "system", "content": "Your move is illegal, please try again with a different move. Remember to state the start and end position of your move, such as b4-d4."
							// 				})

							// 				console.warn("Failed!")

							// 				continue;
							// 			}

							// 			console.log("Successfully parsed as an explicit coordinate.")

							// 			storeMakeMove({
							// 				payload: move,
							// 				clock: (pos.turn === "white" ? whiteTime : blackTime) ?? undefined
							// 			});

							// 			return;
							// 		}
							// 	}

							// 	{
							// 		let [sanMove, arg2, arg3] = parseSanSource(pos, choice)

							// 		if (sanMove == 379 && arg2 != undefined && arg3 != undefined) {
							// 			console.warn("Attempt to move piece that does not exist, setting", makeSquare(arg3), "to", arg2)

							// 			pos.board.set(arg3, {
							// 				color: "black",
							// 				role: arg2 as Role
							// 			})
							// 		}

							// 		[sanMove, arg2, arg3] = parseSanSource(pos, choice)

							// 		if (sanMove != undefined) {
							// 			let tempPos = originalPos.clone()

							// 			tempPos.play(sanMove as Move);

							// 			const newFen = makeFen(tempPos.toSetup());
							// 			const [newPos, newError] = positionFromFen(newFen)

							// 			if (newError != null) {
							// 				ai_data.push({
							// 					"role": "system", "content": "Your move is illegal, please try again with a different move. Remember to state the start and end position of your move, such as b4-d4."
							// 				})

							// 				continue;
							// 			}

							// 			if (!originalPos?.board.black.has((sanMove as NormalMove).from)) {
							// 				ai_data.push({
							// 					"role": "system", "content": "Your move is illegal, please try again with a different move. Remember to state the start and end position of your move, such as b4-d4."
							// 				})

							// 				continue;
							// 			}

							// 			console.log("Parsed SAN move successfully!")

							// 			storeMakeMove({
							// 				payload: sanMove as Move,
							// 				clock: (pos.turn === "white" ? whiteTime : blackTime) ?? undefined
							// 			});

							// 			return;
							// 		}
							// 	}
							// }

							console.warn("Retrying! Failed to parse: " + completion);
						}
					} catch (e) {
						console.warn(e)
					}

					console.warn("Could not find a solution! Using random!")

					let [tempPos] = positionFromFen(lastNode.fen)

					tempPos = tempPos as Chess

					const ctx = tempPos.ctx();

					let black = tempPos.board.black
					let randomChoice: number = randomSquare(black) as number

					let i = 0;

					while (randomChoice != undefined && pos.dests(randomChoice, ctx).size() == 0) {
						randomChoice = randomSquare(black) as number

						i++;

						if (i > 500) throw "bad boy";
					}

					const move: NormalMove = {
						from: randomChoice,
						to: randomSquare(pos.dests(randomChoice, ctx)) as number
					}

					console.log(pos.board.occupied.has(randomChoice), pos.dests(randomChoice, ctx))

					console.log(move, randomChoice)

					storeMakeMove({
						payload: move,
						clock: (pos.turn === "white" ? whiteTime : blackTime) ?? undefined
					});
				})();

				// const setup = parseFen(lastNode.fen).unwrap();

				// setup.board.set(parseSquare("d4"), {
				//   role: "rook",
				//   color: "black"
				// });

				// setFen(makeFen(setup))

				// // "d8-d4", "Rd4"

				// let x = {
				//   from: parseSquare("d8"),
				//   to: parseSquare("d4")
				// }

				// const newMoveNode = createNode({
				//   fen: makeFen(setup),
				//   move: x,
				//   san: "Rd4",
				//   halfMoves: lastNode.halfMoves + 1,
				//   // clock,
				// });
			}
		}
	}, [
		gameState,
		pos,
		players,
		headers.result,
		setGameState,
		activeTab,
		root.fen,
		moves,
	]);

	const [whiteTime, setWhiteTime] = useState<number | null>(null);
	const [blackTime, setBlackTime] = useState<number | null>(null);

	useEffect(() => {
		const unlisten = events.bestMovesPayload.listen(({ payload }) => {
			const ev = payload.bestLines;
			if (
				payload.progress === 100 &&
				payload.engine === pos?.turn &&
				payload.tab === activeTab + pos.turn &&
				payload.fen === root.fen &&
				payload.moves.join(",") === moves.join(",") &&
				!pos?.isEnd()
			) {
				appendMove({
					payload: parseUci(ev[0].uciMoves[0])!,
					clock: (pos.turn === "white" ? whiteTime : blackTime) ?? undefined,
				});
			}
		});
		return () => {
			unlisten.then((f) => f());
		};
	}, [activeTab, appendMove, pos, root.fen, moves, whiteTime, blackTime]);

	const movable = useMemo(() => {
		if (players.white.type === "human" && players.black.type === "human") {
			return "turn";
		}
		if (players.white.type === "human") {
			return "white";
		}
		if (players.black.type === "human") {
			return "black";
		}
		return "none";
	}, [players]);

	const [sameTimeControl, setSameTimeControl] = useState(true);

	const [intervalId, setIntervalId] = useState<ReturnType<
		typeof setInterval
	> | null>(null);

	useEffect(() => {
		if (intervalId) {
			clearInterval(intervalId);
			setIntervalId(null);
		}
	}, [pos?.turn]);

	useEffect(() => {
		if (gameState === "playing" && whiteTime !== null && whiteTime <= 0) {
			if (intervalId) {
				clearInterval(intervalId);
			}
			setIntervalId(null);
			setGameState("gameOver");
			setHeaders({
				...headers,
				result: "0-1",
			});
		}
	}, [gameState, whiteTime, setGameState, setHeaders, headers]);

	useEffect(() => {
		if (gameState !== "playing") {
			if (intervalId) {
				clearInterval(intervalId);
				setIntervalId(null);
			}
		}
	}, [gameState, intervalId]);

	useEffect(() => {
		if (gameState === "playing" && blackTime !== null && blackTime <= 0) {
			setGameState("gameOver");
			setHeaders({
				...headers,
				result: "1-0",
			});
		}
	}, [gameState, blackTime, setGameState, setHeaders, headers]);

	function decrementTime() {
		if (pos?.turn === "white" && whiteTime !== null) {
			setWhiteTime((prev) => prev! - 100);
		} else if (pos?.turn === "black" && blackTime !== null) {
			setBlackTime((prev) => prev! - 100);
		}
	}

	function startGame() {
		setGameState("playing");

		const players = getPlayers();

		if (players.white.timeControl) {
			setWhiteTime(players.white.timeControl.seconds);
		}

		if (players.black.timeControl) {
			setBlackTime(players.black.timeControl.seconds);
		}

		setPlayers(players);

		const newHeaders: Partial<GameHeaders> = {
			white:
				(players.white.type === "human"
					? players.white.name
					: players.white.engine?.name) ?? "?",
			black:
				(players.black.type === "human"
					? players.black.name
					: players.black.engine?.name) ?? "?",
			time_control: undefined,
		};

		if (sameTimeControl && players.white.timeControl) {
			newHeaders.time_control = `${players.white.timeControl.seconds / 1000}`;
			if (players.white.timeControl.increment) {
				newHeaders.time_control += `+${players.white.timeControl.increment / 1000
					}`;
			}
		}

		setHeaders({
			...headers,
			...newHeaders,
		});

		setTabs((prev) =>
			prev.map((tab) => {
				const whiteName =
					players.white.type === "human"
						? players.white.name
						: players.white.engine?.name ?? "?";

				const blackName =
					players.black.type === "human"
						? players.black.name
						: players.black.engine?.name ?? "?";

				return tab.value === activeTab
					? {
						...tab,
						name: `${whiteName} vs. ${blackName}`,
					}
					: tab;
			}),
		);
	}

	useEffect(() => {
		if (gameState === "playing" && !intervalId) {
			const intervalId = setInterval(decrementTime, 100);
			if (pos?.turn === "black" && whiteTime !== null) {
				setWhiteTime(
					(prev) => prev! + (players.white.timeControl?.increment ?? 0),
				);
			}
			if (pos?.turn === "white" && blackTime !== null) {
				setBlackTime(
					(prev) => prev! + (players.black.timeControl?.increment ?? 0),
				);
			}
			setIntervalId(intervalId);
		}
	}, [gameState, intervalId, pos?.turn]);

	const onePlayerIsEngine =
		(players.white.type === "engine" || players.black.type === "engine") &&
		players.white.type !== players.black.type;

	return (
		<>
			<Portal target="#left" style={{ height: "100%" }}>
				<Board
					dirty={false}
					editingMode={false}
					toggleEditingMode={() => undefined}
					viewOnly={gameState !== "playing"}
					disableVariations
					boardRef={boardRef}
					canTakeBack={onePlayerIsEngine}
					movable={movable}
					whiteTime={
						gameState === "playing" ? whiteTime ?? undefined : undefined
					}
					blackTime={
						gameState === "playing" ? blackTime ?? undefined : undefined
					}
					whiteTc={players.white.timeControl}
					blackTc={players.black.timeControl}
				/>
			</Portal>
			<Portal target="#topRight" style={{ height: "100%", overflow: "hidden" }}>
				<Paper withBorder shadow="sm" p="md" h="100%">
					{gameState === "settingUp" && (
						<ScrollArea h="100%" offsetScrollbars>
							<Stack>
								<Group>
									<Text flex={1} ta="center" fz="lg" fw="bold">
										{match(inputColor)
											.with("white", () => "White")
											.with("random", () => "Random")
											.with("black", () => "Black")
											.exhaustive()}
									</Text>
									<ActionIcon onClick={cycleColor}>
										<IconArrowsExchange />
									</ActionIcon>
									<Text flex={1} ta="center" fz="lg" fw="bold">
										{match(inputColor)
											.with("white", () => "Black")
											.with("random", () => "Random")
											.with("black", () => "White")
											.exhaustive()}
									</Text>
								</Group>
								<Box flex={1}>
									<Group style={{ alignItems: "start" }}>
										<OpponentForm
											sameTimeControl={sameTimeControl}
											opponent={player1Settings}
											setOpponent={setPlayer1Settings}
											setOtherOpponent={setPlayer2Settings}
										/>
										<Divider orientation="vertical" />
										<OpponentForm
											sameTimeControl={sameTimeControl}
											opponent={player2Settings}
											setOpponent={setPlayer2Settings}
											setOtherOpponent={setPlayer1Settings}
										/>
									</Group>
								</Box>

								<Checkbox
									label="Same time control"
									checked={sameTimeControl}
									onChange={(e) => setSameTimeControl(e.target.checked)}
								/>

								<Group>
									<Button onClick={startGame} disabled={error !== null}>
										Start game
									</Button>
								</Group>
							</Stack>
						</ScrollArea>
					)}
					{(gameState === "playing" || gameState === "gameOver") && (
						<Stack h="100%">
							<Box flex={1}>
								<GameInfo headers={headers} />
							</Box>
							<Group grow>
								<Button
									onClick={() => {
										setGameState("settingUp");
										setWhiteTime(null);
										setBlackTime(null);
										setFen(INITIAL_FEN);
										setHeaders({
											...headers,
											result: "*",
										});
									}}
									leftSection={<IconPlus />}
								>
									New Game
								</Button>
								<Button
									variant="default"
									onClick={() => changeToAnalysisMode()}
									leftSection={<IconZoomCheck />}
								>
									Analyze
								</Button>
							</Group>
						</Stack>
					)}
				</Paper>
			</Portal>
			<Portal target="#bottomRight" style={{ height: "100%" }}>
				<Stack h="100%" gap="xs">
					<GameNotation topBar />
					<MoveControls />
				</Stack>
			</Portal>
		</>
	);
}

export default BoardGame;
