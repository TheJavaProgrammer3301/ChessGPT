import type { FileMetadata } from "@/components/files/file";
import { Result } from "@badrap/result";
import { exists, writeTextFile } from "@tauri-apps/api/fs";
import { platform } from "@tauri-apps/api/os";
import { resolve } from "@tauri-apps/api/path";
import { defaultGame, makePgn } from "chessops/pgn";
import useSWR from "swr";
import { match } from "ts-pattern";
import { parsePGN } from "./chess";
import { count_pgn_games, read_games } from "./db";
import { type Tab, createTab } from "./tabs";
import { getGameName } from "./treeReducer";

export function usePlatform() {
  const r = useSWR("os", async () => {
    const p = await platform();
    const os = match(p)
      .with("win32", () => "windows" as const)
      .with("linux", () => "linux" as const)
      .with("darwin", () => "macos" as const)
      .otherwise(() => {
        throw Error("OS not supported");
      });
    return os;
  });
  return { os: r.data, ...r };
}

export async function openFile(
  file: string,
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  setActiveTab: React.Dispatch<React.SetStateAction<string | null>>,
) {
  const count = await count_pgn_games(file);
  const input = (await read_games(file, 0, 0))[0];

  const fileInfo = {
    metadata: {
      tags: [],
      type: "game" as const,
    },
    name: file,
    path: file,
    numGames: count,
    lastModified: new Date().getUTCSeconds(),
  };
  const tree = await parsePGN(input);
  createTab({
    tab: {
      name: getGameName(tree.headers),
      type: "analysis",
    },
    setTabs,
    setActiveTab,
    pgn: input,
    fileInfo,
  });
}

export async function createFile({
  filename,
  filetype,
  pgn,
  dir,
}: {
  filename: string;
  filetype: "game" | "repertoire" | "tournament" | "puzzle" | "other";
  pgn?: string;
  dir: string;
}): Promise<Result<FileMetadata>> {
  const file = await resolve(dir, `${filename}.pgn`);
  if (await exists(file)) {
    return Result.err(Error("File already exists"));
  }
  const metadata = {
    type: filetype,
    tags: [],
  };
  await writeTextFile(file, pgn || makePgn(defaultGame()));
  await writeTextFile(file.replace(".pgn", ".info"), JSON.stringify(metadata));
  return Result.ok({
    name: filename,
    path: file,
    numGames: 1,
    metadata,
    lastModified: new Date().getUTCSeconds(),
  });
}
